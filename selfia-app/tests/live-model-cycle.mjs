import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const config=JSON.parse(await readFile(new URL('../../.verification-tools/cloud-public.json',import.meta.url),'utf8'));
assert.equal(config.url,'https://tleqdegnzeukonbbrrzk.supabase.co');
const [fixture]=JSON.parse(await readFile(new URL('../../.verification-tools/cloud-users.json',import.meta.url),'utf8'));
assert.match(fixture.email,/^selfia-e2e-.*@example\.invalid$/);
const sb=createClient(config.url,config.key,{auth:{persistSession:false,autoRefreshToken:false}});
const auth=await sb.auth.signInWithPassword(fixture);assert.ifError(auth.error);assert.equal(auth.data.user.id,fixture.id);
const run=randomUUID();
const edge=async(name,body={})=>{
 const response=await fetch(config.url+'/functions/v1/selfia-'+name,{method:'POST',headers:{apikey:config.key,authorization:'Bearer '+auth.data.session.access_token,'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(120000)});
 const data=await response.json();assert.equal(response.status,200,JSON.stringify(data));return data;
};
const rpc=async(name,args)=>{const r=await sb.rpc(name,args);assert.ifError(r.error);return r.data;};
const row=async(query)=>{const r=await query.single();assert.ifError(r.error);return r.data;};
try{
 const goal=await row(sb.from('goals').insert({user_id:fixture.id,title:'Synthetic live '+run,life_area:'work'}).select());
 const first=await edge('chat',{request_id:randomUUID(),goal_id:goal.id,content:`Caso ficticio ${run}: quiero pedir una reunión a mi responsable para hablar de horarios. Me bloqueo al empezar. Quiero preparar una tarjeta con tres preguntas. Ayúdame a convertirlo en una acción pequeña y concreta que pueda aceptar y revisar mañana.`});
 assert.ok(first.reply);assert.ok(first.situation?.id,'live turn records the situation');assert.ok(first.commitment?.what,'live turn proposes an actionable step');
 const action=await rpc('selfia_accept_action',{p_message:first.source_message_id,p_what:first.commitment.what,p_why:first.commitment.why,p_situation:first.situation.id,p_goal:goal.id});
 const event=await rpc('selfia_schedule_commitment',{p_commitment:action.id,p_start:new Date(Date.now()+86400000).toISOString(),p_area:'work',p_kind:'commitment',p_goal:goal.id});
 const review=await rpc('selfia_review_action',{p_event:event.id,p_status:'partially_done',p_result:'Caso ficticio: preparé la tarjeta pero todavía no pedí la reunión.',p_learning:`En el caso ${run} me ayudó una tarjeta azul con tres preguntas.`,p_next:'Probar otra forma de arrancar',p_rescheduled:null,p_request:randomUUID(),p_expected:event.updated_at});
 const memory=await row(sb.from('memories').select().eq('id',review.memory_id));
 const corrected=await rpc('selfia_revise_memory',{p_id:memory.id,p_action:'correct',p_content:`En el caso ${run} lo que me ayudó fue grabar una nota de voz de veinte segundos antes de hablar. La tarjeta azul no me ayudó.`,p_expected:memory.updated_at});
 const nextRequest=randomUUID();
 const next=await edge('chat',{request_id:nextRequest,situation_id:first.situation.id,goal_id:goal.id,content:`Retomemos el caso ficticio ${run}. Según mi recuerdo confirmado y corregido, ¿qué me ayudó realmente? Dame un siguiente paso que parta de eso.`});
 assert.equal(next.situation?.id,first.situation.id,'explicit situation link survives source filtering');
 assert.equal(next.goal_id,goal.id,'explicit goal link survives source filtering');
 assert.match(next.reply,/nota de voz/i,'next live conversation uses the corrected learning');
 const receipt=await row(sb.from('turn_receipts').select('memory_ids').eq('request_id',nextRequest));assert.ok(receipt.memory_ids.includes(memory.id));
 const context=await edge('context');assert.ok(context.confirmed_memories.some(m=>m.id===memory.id&&m.content===corrected.content));assert.ok(!JSON.stringify(context).includes(memory.content));
 await rpc('selfia_revise_memory',{p_id:memory.id,p_action:'dontuse',p_content:'',p_expected:corrected.updated_at});
 const lastRequest=randomUUID();
 const last=await edge('chat',{request_id:lastRequest,content:`Caso ficticio ${run}: ¿tienes algún recuerdo confirmado sobre lo que me ayudó? Si no tienes información suficiente, dilo sin inventar.`});
 const lastReceipt=await row(sb.from('turn_receipts').select('memory_ids').eq('request_id',lastRequest));assert.ok(!lastReceipt.memory_ids.includes(memory.id));
 assert.ok(!/nota de voz de veinte segundos/i.test(last.reply),'withdrawn wording must not return through prior usage');
 console.log('PASS: LIVE MODEL → situation → accepted action → schedule → partial outcome → declared learning → corrected memory → adapted next conversation → withdrawal → later conversation');
 const plans=await edge('discover',{intent:'weekend_plan',vibe:'tranquilo',city:'Madrid',country:'España',local_date:'2026-10-06'});
 assert.ok(plans.plans.length<=2);assert.ok(plans.intro);for(const p of plans.plans){assert.ok(p.title&&p.description);assert.match(p.source_url,/^https:\/\//);}
 console.log('PASS: live Qué hago hoy returns available structured plans or an honest empty result, with HTTPS sources');
 const fixtures=JSON.parse(await readFile(new URL('../../.verification-tools/cloud-users.json',import.meta.url),'utf8'));
 const other=createClient(config.url,config.key,{auth:{persistSession:false,autoRefreshToken:false}});
 const otherAuth=await other.auth.signInWithPassword(fixtures[1]);assert.ifError(otherAuth.error);
 try{
  const denied=await fetch(config.url+'/functions/v1/selfia-chat',{method:'POST',headers:{apikey:config.key,authorization:'Bearer '+otherAuth.data.session.access_token,'content-type':'application/json'},body:JSON.stringify({request_id:randomUUID(),situation_id:first.situation.id,goal_id:goal.id,content:'Synthetic cross-owner attempt'})});
  assert.notEqual(denied.status,200);assert.equal((await denied.json()).error,'context_unavailable');
  console.log('PASS: explicitly selected links remain owner-scoped in deployed chat');
 }finally{await other.auth.signOut();}
}finally{await sb.auth.signOut();}
