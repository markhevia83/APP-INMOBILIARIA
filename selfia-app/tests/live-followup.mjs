import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const config=JSON.parse(await readFile(new URL('../../.verification-tools/cloud-public.json',import.meta.url),'utf8'));
assert.equal(config.url,'https://tleqdegnzeukonbbrrzk.supabase.co');
const [fixture]=JSON.parse(await readFile(new URL('../../.verification-tools/cloud-users.json',import.meta.url),'utf8'));assert.match(fixture.email,/^selfia-e2e-.*@example\.invalid$/);
const sb=createClient(config.url,config.key,{auth:{persistSession:false,autoRefreshToken:false}});
const auth=await sb.auth.signInWithPassword(fixture);assert.ifError(auth.error);
const run=randomUUID(),owner=fixture.id;
const row=async(q)=>{const r=await q.single();assert.ifError(r.error);return r.data};
const rpc=async(name,args)=>{const r=await sb.rpc(name,args);assert.ifError(r.error);return r.data};
const edge=async(name,body={})=>{const r=await fetch(config.url+'/functions/v1/selfia-'+name,{method:'POST',headers:{apikey:config.key,authorization:'Bearer '+auth.data.session.access_token,'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(120000)});const d=await r.json();assert.equal(r.status,200,JSON.stringify(d));return d};
try{
 const goal=await row(sb.from('goals').insert({user_id:owner,title:'Huerto sintético '+run,life_area:'self'}).select());
 const conversation=await row(sb.from('conversations').insert({user_id:owner,title:'Huerto sintético '+run}).select());
 const turn={reply:'Prepararemos la siembra',life_area:'self',situation:{action:'create',situation_id:null,title:goal.title,summary:'Comprar semillas'},commitment:{create:true,what:'Comprar semillas de albahaca',why:'Iniciar el huerto'},memory:{content:''}};
 const saved=await rpc('selfia_save_turn',{p_conversation:conversation.id,p_request:randomUUID(),p_content:'Caso ficticio de huerto',p_turn:turn,p_situation:null,p_goal:goal.id});
 const action=await rpc('selfia_accept_action',{p_message:saved.source_message_id,p_what:turn.commitment.what,p_why:turn.commitment.why,p_situation:saved.situation.id,p_goal:goal.id});
 const event=await rpc('selfia_schedule_commitment',{p_commitment:action.id,p_start:'2026-10-12T14:30:00Z',p_area:'self',p_kind:'commitment',p_goal:goal.id});
 const old=await rpc('selfia_review_action',{p_event:event.id,p_status:'partially_done',p_result:'Solo preparé la tierra',p_learning:'En este intento me ayudó la maceta azul junto a la puerta',p_next:'Usar la maceta azul junto a la puerta',p_rescheduled:null,p_request:randomUUID(),p_expected:event.updated_at});
 const current=await row(sb.from('agenda_events').select().eq('id',event.id));
 const correction=await rpc('selfia_correct_review',{p_review:old.review.id,p_event:event.id,p_status:'moved',p_result:'La tienda estaba cerrada por inventario',p_learning:'',p_next:'Comprar semillas cuando abra',p_rescheduled:'2026-10-12T14:30:00Z',p_request:randomUUID(),p_expected:current.updated_at});
 assert.equal(correction.memory_id,null);
 // Push the selected event outside the general agenda page without deleting data.
 const decoys=Array.from({length:35},(_,i)=>({user_id:owner,title:'Otro asunto sintético '+run+' '+i,scheduled_start:new Date(2031,0,i+1).toISOString(),status:'planned'}));const insert=await sb.from('agenda_events').insert(decoys);assert.ifError(insert.error);
 const query={request_id:randomUUID(),goal_id:goal.id,timezone:'Europe/Madrid',content:'Retoma exclusivamente este objetivo. Dime el último resultado y el motivo registrado, y la fecha y hora locales en que quedó programada su acción. No inventes un aprendizaje si no hay uno vigente.'};
 const response=await edge('chat',query);
 assert.match(response.reply,/inventario/i);assert.match(response.reply,/12/);assert.match(response.reply,/16[:.]30/);assert.ok(!/maceta azul/i.test(response.reply));assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(response.reply));assert.equal(response.situation.id,saved.situation.id);
 const receipt=await row(sb.from('turn_receipts').select('memory_ids').eq('request_id',query.request_id));assert.ok(!receipt.memory_ids.includes(old.memory_id));
 console.log('PASS LIVE: corrected outcome without learning, reason, local rescheduled time, selected event beyond 30-item page, withdrawn learning absent, no internal IDs, same subject.');
 const plan=await row(sb.from('agenda_events').insert({user_id:owner,title:'Plan sintético '+run,notes:'Recorrido y punto de encuentro',source_url:'https://www.madrid.es/',scheduled_start:new Date(Date.now()+86400000).toISOString(),event_kind:'leisure',status:'planned'}).select());
 assert.equal((await row(sb.from('agenda_events').select().eq('id',plan.id))).source_url,'https://www.madrid.es/');
 const summaries=await sb.from('situation_summary_revisions').select().eq('situation_id',saved.situation.id);assert.ifError(summaries.error);assert.ok(summaries.data.length);
 console.log('PASS CLOUD: HTTPS plan source and description persisted; dependent summary history retained.');
}finally{await sb.auth.signOut({scope:'local'})}
