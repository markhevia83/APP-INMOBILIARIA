import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';

// Credentials live only in ignored local files. This harness refuses production.
const config=JSON.parse(await readFile(new URL('../../.verification-tools/cloud-public.json',import.meta.url),'utf8'));
assert.equal(config.url,'https://tleqdegnzeukonbbrrzk.supabase.co','only the explicitly created test project is permitted');
const fixtures=JSON.parse(await readFile(new URL('../../.verification-tools/cloud-users.json',import.meta.url),'utf8'));
assert.equal(fixtures.length,2);
const clients=[];
for(const fixture of fixtures){
 assert.match(fixture.email,/^selfia-e2e-.*@example\.invalid$/);
 const sb=createClient(config.url,config.key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await sb.auth.signInWithPassword({email:fixture.email,password:fixture.password});
 assert.ifError(error);assert.equal(data.user.id,fixture.id);
 clients.push({sb,token:data.session.access_token,id:fixture.id});
}
const [a,b]=clients;
const run=randomUUID();
const rpc=async(sb,name,args)=>{const r=await sb.rpc(name,args);assert.ifError(r.error);return r.data;};
const single=async(query)=>{const r=await query.single();assert.ifError(r.error);return r.data;};
const edge=async(name,token,body={})=>{
 const response=await fetch(config.url+'/functions/v1/selfia-'+name,{method:'POST',headers:{apikey:config.key,...(token?{authorization:'Bearer '+token}:{}),'content-type':'application/json'},body:JSON.stringify(body)});
 return {status:response.status,body:await response.json()};
};
for(const name of ['chat','context','daily','motivation','discover','onboarding']){
 assert.equal((await edge(name,null)).status,401,name+' anonymous guard');
 assert.equal((await edge(name,'invalid-token')).status,401,name+' invalid-token guard');
}
console.log('PASS: real Auth login and all six deployed authentication guards');
const conversation=await single(a.sb.from('conversations').insert({user_id:a.id,title:'Synthetic cloud cycle'}).select());
const goal=await single(a.sb.from('goals').insert({user_id:a.id,title:'Synthetic: preparar una reunión',life_area:'work'}).select());
const request=randomUUID();
const turn={reply:'Podemos preparar una primera frase.',life_area:'work',intervention:'PROPOSE_ACTION',situation:{action:'create',situation_id:null,title:'Synthetic: pedir una reunión',summary:'El usuario quiere practicar'},commitment:{create:true,what:'Synthetic: escribir una primera frase',why:'Practicar'},memory:{content:'Synthetic: quiero practicar'}};
const args={p_conversation:conversation.id,p_request:request,p_content:'Synthetic: quiero preparar una reunión',p_turn:turn,p_situation:null,p_goal:goal.id};
const saved=await rpc(a.sb,'selfia_save_turn',args);
assert.deepEqual(await rpc(a.sb,'selfia_save_turn',args),saved);
const action=await rpc(a.sb,'selfia_accept_action',{p_message:saved.source_message_id,p_what:turn.commitment.what,p_why:turn.commitment.why,p_situation:saved.situation.id,p_goal:goal.id});
const event=await rpc(a.sb,'selfia_schedule_commitment',{p_commitment:action.id,p_start:new Date(Date.now()+86400000).toISOString(),p_area:'work',p_kind:'commitment',p_goal:goal.id});
const reviewArgs={p_event:event.id,p_status:'partially_done',p_result:'Synthetic: escribí el principio',p_learning:`Synthetic ${run}: dividir el guion me ayudó`,p_next:'Synthetic: probar otra frase',p_rescheduled:null,p_request:randomUUID(),p_expected:event.updated_at};
const review=await rpc(a.sb,'selfia_review_action',reviewArgs);
await rpc(a.sb,'selfia_review_action',reviewArgs);
assert.ok(review.memory_id);
const memory=await single(a.sb.from('memories').select().eq('id',review.memory_id));
const corrected=await rpc(a.sb,'selfia_revise_memory',{p_id:memory.id,p_action:'correct',p_content:`Synthetic ${run}: me ayudó escribir solo la primera frase`,p_expected:memory.updated_at});
let context=await edge('context',a.token);
assert.equal(context.status,200);
assert.ok(context.body.confirmed_memories.some(m=>m.id===memory.id&&m.content===corrected.content));
assert.ok(!JSON.stringify(context.body).includes(memory.content),'old wording excluded');
const stale=await a.sb.rpc('selfia_revise_memory',{p_id:memory.id,p_action:'correct',p_content:'Synthetic: stale',p_expected:memory.updated_at});
assert.match(stale.error?.message||'',/memory_changed_reload/);
for(const table of ['memories','action_reviews','commitments','agenda_events','messages','turn_receipts']){
 const r=await b.sb.from(table).select(table==='turn_receipts'?'request_id':'id');assert.ifError(r.error);assert.equal(r.data.length,0,table+' cross-user read denied');
}
const cross=await b.sb.rpc('selfia_revise_memory',{p_id:memory.id,p_action:'confirm',p_content:'',p_expected:corrected.updated_at});
assert.match(cross.error?.message||'',/memory_not_found/);
await rpc(a.sb,'selfia_revise_memory',{p_id:memory.id,p_action:'dontuse',p_content:'',p_expected:corrected.updated_at});
context=await edge('context',a.token);assert.equal(context.status,200);
assert.ok(!context.body.confirmed_memories.some(m=>m.id===memory.id));
assert.ok(!JSON.stringify(context.body).includes(corrected.content));
const revisions=await a.sb.from('memory_revisions').select('id').eq('memory_id',memory.id);
assert.ifError(revisions.error);assert.equal(revisions.data.length,2);
console.log('PASS: cloud transaction retries, situation/action/goal links, outcome/learning, correction/audit, withdrawal, stale edit and two-user RLS');
const live=await edge('chat',a.token,{request_id:randomUUID(),content:'Synthetic: ¿qué paso pequeño puedo preparar para mi reunión?'});
if(live.status===503&&live.body.error==='ai_not_configured'){
 console.log('PENDING: live AI cycle requires OPENAI_API_KEY configured server-side in SELF-IA Pruebas');
}else{
 assert.equal(live.status,200,JSON.stringify(live.body));assert.ok(live.body.reply);
 console.log('PASS: live model chat response (full model quality/continuity assessment still required)');
}
for(const {sb} of clients)await sb.auth.signOut();
