import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const config=JSON.parse(await readFile(new URL('../../.verification-tools/cloud-public.json',import.meta.url),'utf8'));
assert.equal(config.url,'https://tleqdegnzeukonbbrrzk.supabase.co');
const fixtures=JSON.parse(await readFile(new URL('../../.verification-tools/cloud-users.json',import.meta.url),'utf8'));
assert.equal(fixtures.length,2);
for(const fixture of fixtures){assert.match(fixture.email,/^selfia-e2e-.*@example\.invalid$/);assert.match(fixture.id,/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i);}
const clients=[];
const login=async index=>{const sb=createClient(config.url,config.key,{auth:{persistSession:false,autoRefreshToken:false}});const{data,error}=await sb.auth.signInWithPassword(fixtures[index]);assert.ifError(error);clients.push(sb);return{sb,token:data.session.access_token,id:data.user.id};};
const a=await login(0),a2=await login(0),b=await login(1);
try{
 const rpc=async(sb,name,args)=>{const{data,error}=await sb.rpc(name,args);assert.ifError(error);return data;};
 const request=randomUUID(),payload={title:'Synthetic concurrent '+request,scheduled_start:new Date(Date.now()+86400000).toISOString(),life_area:'work',event_kind:'obligation'};
 const results=await Promise.all([a,a2,a,a2].map(client=>rpc(client.sb,'selfia_create_agenda',{p_request:request,p_payload:payload})));
 assert.equal(new Set(results.map(row=>row.id)).size,1);
 const{data:events,error}=await a.sb.from('agenda_events').select('id').eq('title',payload.title);assert.ifError(error);assert.equal(events.length,1);
 const conflict=await a2.sb.rpc('selfia_create_agenda',{p_request:request,p_payload:{...payload,title:'Different intent'}});assert.match(conflict.error?.message||'',/request_conflict/);
 console.log('PASS real parallel sessions: one manual agenda event; mismatched replay rejected');
 const tables=['profiles','people','conversations','messages','memories','hypotheses','situations','commitments','onboarding_sessions','profile_items','agenda_events','goals','motivation_feedback','memory_revisions','action_reviews','turn_receipts','goal_revisions','situation_summary_revisions','mutation_receipts','plan_proposals','ai_usage','erasure_requests'];
 let writeTables=0;
 for(const table of tables){
  const r=await b.sb.from(table).select('*').eq('user_id',a.id).limit(10);assert.ifError(r.error);assert.deepEqual(r.data,[],table+' foreign owner');
  const anonymous=await fetch(config.url+'/rest/v1/'+table+'?select=*&limit=1',{headers:{apikey:config.key}});
  if(anonymous.status===200)assert.deepEqual(await anonymous.json(),[],table+' anonymous must never expose rows');
  else assert.ok([401,403].includes(anonymous.status),table+' anonymous '+anonymous.status);
  const own=await a.sb.from(table).select('*').eq('user_id',a.id).limit(1);assert.ifError(own.error);
  if(own.data.length){
   writeTables++;
   const foreignUpdate=await b.sb.from(table).update({user_id:a.id}).eq('user_id',a.id).select('user_id');
   if(foreignUpdate.error)assert.equal(foreignUpdate.error.code,'42501',table+' update denied by permission');else assert.deepEqual(foreignUpdate.data,[],table+' foreign update');
   const spoof={...own.data[0],user_id:a.id};if('id' in spoof)spoof.id=randomUUID();if('request_id' in spoof)spoof.request_id=randomUUID();
   const insert=await b.sb.from(table).insert(spoof);
   assert.ok(insert.error,table+' owner-spoof insert must fail');
   assert.ok(['42501','P0001'].includes(insert.error.code),table+' ownership rejection, not incidental constraint '+insert.error.code);
   const anonymousInsert=await fetch(config.url+'/rest/v1/'+table,{method:'POST',headers:{apikey:config.key,'content-type':'application/json'},body:JSON.stringify(spoof)});
   assert.ok([401,403].includes(anonymousInsert.status),table+' anonymous write '+anonymousInsert.status);
  }
 }
 for(const table of ['ai_monthly_budget','ai_cost_reservations']){
  assert.equal((await b.sb.from(table).select('*').limit(1)).error?.code,'42501',table+' private budget');
  const response=await fetch(config.url+'/rest/v1/'+table+'?select=*&limit=1',{headers:{apikey:config.key}});assert.ok([401,403].includes(response.status),table+' anonymous budget');
 }
 assert.equal((await b.sb.rpc('selfia_erasure_preflight',{p_user:a.id})).error?.code,'42501','erasure operator preflight not callable by app users');
 const anonPreflight=await fetch(config.url+'/rest/v1/rpc/selfia_erasure_preflight',{method:'POST',headers:{apikey:config.key,'content-type':'application/json'},body:JSON.stringify({p_user:a.id})});assert.ok([401,403].includes(anonPreflight.status));
 console.log('PASS HTTP RLS reads for '+tables.length+' user tables; owner-spoof and foreign updates/anonymous writes for '+writeTables+' populated tables; two server-only budget tables private');
 const profile=await rpc(a.sb,'selfia_declare_profile_item',{p_request:randomUUID(),p_content:'Synthetic independent preference: quiet mornings '+request});
 const contextResponse=await fetch(config.url+'/functions/v1/selfia-context',{method:'POST',headers:{apikey:config.key,authorization:'Bearer '+a.token,'content-type':'application/json'},body:'{}'});
 assert.equal(contextResponse.status,200);const context=await contextResponse.json();assert.ok(context.profile_items.some(item=>item.id===profile.id));
 assert.equal((await b.sb.from('profile_items').select().eq('id',profile.id)).data.length,0);
 const otherSession=await a2.sb.auth.getUser();assert.ifError(otherSession.error);
 await a.sb.auth.signOut({scope:'local'});
 assert.ifError((await a2.sb.auth.getUser()).error);assert.ifError((await b.sb.auth.getUser()).error);
 console.log('PASS independent declared profile survives withdrawn legacy context; local logout preserves second session and account B');
}finally{for(const sb of clients)await sb.auth.signOut({scope:'local'});}
