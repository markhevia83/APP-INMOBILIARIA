import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const config=JSON.parse(await readFile(new URL('../../.verification-tools/cloud-public.json',import.meta.url),'utf8'));
assert.equal(config.url,'https://tleqdegnzeukonbbrrzk.supabase.co');
const fixtures=JSON.parse(await readFile(new URL('../../.verification-tools/cloud-users.json',import.meta.url),'utf8'));
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
 for(const table of tables){
  const r=await b.sb.from(table).select('*').eq('user_id',a.id).limit(10);assert.ifError(r.error);assert.deepEqual(r.data,[],table+' foreign owner');
  const anonymous=await fetch(config.url+'/rest/v1/'+table+'?select=*&limit=1',{headers:{apikey:config.key}});assert.ok([401,403].includes(anonymous.status),table+' anonymous '+anonymous.status);
 }
 console.log('PASS HTTP RLS owner isolation and anonymous rejection for '+tables.length+' user tables');
 const profile=await rpc(a.sb,'selfia_declare_profile_item',{p_request:randomUUID(),p_content:'Synthetic independent preference: quiet mornings '+request});
 const contextResponse=await fetch(config.url+'/functions/v1/selfia-context',{method:'POST',headers:{apikey:config.key,authorization:'Bearer '+a.token,'content-type':'application/json'},body:'{}'});
 assert.equal(contextResponse.status,200);const context=await contextResponse.json();assert.ok(context.profile_items.some(item=>item.id===profile.id));
 assert.equal((await b.sb.from('profile_items').select().eq('id',profile.id)).data.length,0);
 const otherSession=await a2.sb.auth.getUser();assert.ifError(otherSession.error);
 await a.sb.auth.signOut({scope:'local'});
 assert.ifError((await a2.sb.auth.getUser()).error);assert.ifError((await b.sb.auth.getUser()).error);
 console.log('PASS independent declared profile survives withdrawn legacy context; local logout preserves second session and account B');
}finally{for(const sb of clients)await sb.auth.signOut({scope:'local'});}
