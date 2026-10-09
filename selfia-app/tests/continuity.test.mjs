import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {continuityContext} from '../../supabase/functions/_shared/continuity.ts';
import {areaSummary,localDate,safeLink,reviewSummary} from '../src/continuity.js';
test('evolution keeps moved actions and replaces corrected outcomes without double counting',()=>{
 const agenda=[{id:'a',status:'planned'},{id:'b',status:'done'},{id:'c',status:'planned'},{id:'legacy',status:'partially_done'}];
 const reviews=[{event_id:'a',status:'moved',created_at:'2026-10-08T10:00:00Z'},{event_id:'b',status:'done',created_at:'2026-10-08T11:00:00Z'},{event_id:'a',status:'partially_done',created_at:'2026-10-07T10:00:00Z'}];
 assert.deepEqual(reviewSummary(agenda,reviews),{total:3,done:1,partial:1,moved:1});
 assert.deepEqual(reviewSummary(agenda,[...reviews,{event_id:'a',status:'done',created_at:'2026-10-09T10:00:00Z'}]),{total:3,done:2,partial:1,moved:0});
});
const uid='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002';
const req='20000000-0000-4000-8000-000000000001';
test('complete synthetic cycle, correction, withdrawal, rollback and user isolation',async()=>{
 const db=new PGlite();
 await db.exec(await readFile(new URL('./baseline.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../../supabase/migrations/20261006142249_continuity_cycle.sql',import.meta.url),'utf8'));await db.exec(await readFile(new URL('../../supabase/migrations/20261008143624_astra_continuity_repairs.sql',import.meta.url),'utf8'));await db.exec(await readFile(new URL('../../supabase/migrations/20261008182709_audit_followup_context.sql',import.meta.url),'utf8'));
 await db.exec("insert into auth.users values ('"+uid+"'),('"+other+"');set role authenticated;");
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);
 const row=async(sql,args=[])=> (await db.query(sql,args)).rows[0];
 const scalar=async(sql,args=[])=>Object.values(await row(sql,args))[0];
 const conversation=await scalar("insert into conversations(user_id,title) values ($1,'Synthetic') returning id",[uid]);
 const goal=await scalar("insert into goals(user_id,title,life_area) values ($1,'Hablar con mi responsable','work') returning id",[uid]);
 const turn={reply:'Podemos preparar un guion y probarlo.',life_area:'work',intervention:'PROPOSE_ACTION',situation:{action:'create',situation_id:null,title:'Hablar con mi responsable',summary:'El usuario quiere pedir una reunión'},commitment:{create:true,what:'Preparar un guion de diez minutos',why:'Facilitar la conversación'},memory:{content:'Quiero pedir una reunión'}};
 const saved=await scalar("select selfia_save_turn($1,$2,$3,$4,$5,$6)",[conversation,req,'Quiero pedir una reunión',turn,null,goal]);
 assert.ok(saved.situation.id); assert.equal(await scalar("select count(*)::int from commitments"),0,'a suggestion is not an accepted action');
 const again=await scalar("select selfia_save_turn($1,$2,$3,$4,$5,$6)",[conversation,req,'Quiero pedir una reunión',turn,null,goal]);
 assert.deepEqual(saved,again);assert.equal(await scalar("select count(*)::int from messages"),2);
 const action=await scalar("select selfia_accept_action($1,$2,$3,$4,$5)",[saved.source_message_id,turn.commitment.what,turn.commitment.why,saved.situation.id,goal]);
 assert.equal(action.situation_id,saved.situation.id);
 const event=await scalar("select selfia_schedule_commitment($1,now()+interval '1 day','work','commitment',$2)",[action.id,goal]);
 const event2=await scalar("select selfia_schedule_commitment($1,now()+interval '2 days','work','commitment',$2)",[action.id,goal]);assert.equal(event.id,event2.id);
 const reviewReq='30000000-0000-4000-8000-000000000001';
 const review=await scalar("select selfia_review_action($1,'partially_done',$2,$3,$4,null,$5,$6)",[event.id,'Preparé el principio del guion','Dividir el guion en pasos me ayudó','Probar otro paso',reviewReq,event.updated_at]);
 assert.ok(review.memory_id);
 assert.equal(await scalar("select count(*)::int from action_reviews"),1);
 await scalar("select selfia_review_action($1,'partially_done',$2,$3,$4,null,$5,$6)",[event.id,'Preparé el principio del guion','Dividir el guion en pasos me ayudó','Probar otro paso',reviewReq,event.updated_at]);
 assert.equal(await scalar("select count(*)::int from action_reviews"),1);
 const getContext=async()=>continuityContext({
  memories:(await db.query("select * from memories")).rows,
  history:(await db.query("select * from messages")).rows,
  sources:(await db.query("select id,conversation_id from messages")).rows,
  situations:(await db.query("select * from situations")).rows,
  commitments:(await db.query("select * from commitments")).rows,
  agenda:(await db.query("select * from agenda_events")).rows,
  goals:(await db.query("select * from goals")).rows,
  reviews:(await db.query("select * from action_reviews")).rows
 });
 let ctx=await getContext();assert.equal(ctx.memories.length,1);assert.match(ctx.memories[0].content,/Dividir/);assert.equal(ctx.reviews[0].status,'partially_done');
 const learning=await row("select * from memories where id=$1",[review.memory_id]);
 const corrected=await scalar("select selfia_revise_memory($1,'correct',$2,$3)",[learning.id,'Me ayudó escribir solo la primera frase',learning.updated_at]);
 assert.equal(await scalar("select count(*)::int from memory_revisions"),1);
 const staleTurn={...turn,context_memory_ids:[learning.id],context_memory_versions:{[learning.id]:learning.updated_at}};
 const beforeStale=await scalar("select count(*)::int from messages");
 await assert.rejects(()=>scalar("select selfia_save_turn($1,gen_random_uuid(),'stale context',$2,null,null)",[conversation,staleTurn]),/memory_context_changed/);
 assert.equal(await scalar("select count(*)::int from messages"),beforeStale);

 ctx=await getContext();assert.equal(ctx.memories[0].content,'Me ayudó escribir solo la primera frase');
 assert.ok(!JSON.stringify(ctx).includes('Dividir el guion'));
 await assert.rejects(()=>scalar("select selfia_revise_memory($1,'correct','stale',$2)",[learning.id,learning.updated_at]),/memory_changed_reload/);
 await scalar("select selfia_revise_memory($1,'dontuse','',$2)",[corrected.id,corrected.updated_at]);
 ctx=await getContext();assert.equal(ctx.memories.length,0);assert.ok(!JSON.stringify(ctx).includes('Me ayudó escribir'));
 assert.equal(await scalar("select count(*)::int from memory_revisions"),2);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[other]);
 assert.equal(await scalar("select count(*)::int from memories"),0);
 assert.equal(await scalar("select count(*)::int from action_reviews"),0);
 await assert.rejects(()=>scalar("select selfia_revise_memory($1,'confirm','',$2)",[learning.id,corrected.updated_at]),/memory_not_found/);
 await assert.rejects(()=>scalar("select selfia_schedule_commitment($1,now()+interval '1 day','work','commitment',null)",[action.id]),/commitment_not_found/);
 await assert.rejects(()=>db.query("insert into agenda_events(user_id,title,scheduled_start,situation_id) values($1,'cross owner',now(),$2)",[other,saved.situation.id]),/linked_record_not_found/);
 await assert.rejects(()=>db.query("insert into messages(user_id,conversation_id,role,content) values($1,$2,'user','cross owner')",[other,conversation]),/linked_record_not_found/);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);
 for(const status of ['done','not_done','no_longer_relevant']){
  const fresh=await row("insert into agenda_events(user_id,title,scheduled_start) values($1,'Synthetic outcome',now()) returning *",[uid]);
  await scalar("select selfia_review_action($1,$2,'Recorded result','','',null,gen_random_uuid(),$3)",[fresh.id,status,fresh.updated_at]);
  assert.equal(await scalar("select status from agenda_events where id=$1",[fresh.id]),status);
 }
 assert.equal(await scalar("select count(*)::int from memories"),2,'outcomes without declared learning never create personal memory');
 const current=await row("select * from agenda_events where id=$1",[event.id]);
 await assert.rejects(()=>scalar("select selfia_review_action($1,'moved','','','',null,gen_random_uuid(),$2)",[event.id,current.updated_at]),/future_date_required/);
 assert.equal(await scalar("select count(*)::int from action_reviews"),4);
 await scalar("select selfia_review_action($1,'moved','','','',now()+interval '3 days',gen_random_uuid(),$2)",[event.id,current.updated_at]);
 const moved=await row("select * from agenda_events where id=$1",[event.id]);assert.equal(moved.status,'planned');
 assert.equal(await scalar("select status from commitments where id=$1",[action.id]),'postponed');
 await scalar("select selfia_review_action($1,'skipped_review','','','',null,gen_random_uuid(),$2)",[event.id,moved.updated_at]);
 assert.equal(await scalar("select count(*)::int from memories"),2);
 const count=await scalar("select count(*)::int from messages");
 const invalid={...turn,situation:{...turn.situation,action:'update',situation_id:'99999999-0000-4000-8000-000000000001'}};
 await assert.rejects(()=>scalar("select selfia_save_turn($1,gen_random_uuid(),'invalid',$2,null,null)",[conversation,invalid]),/situation_not_found/);
 assert.equal(await scalar("select count(*)::int from messages"),count,'failed save is atomic');
 await db.exec('reset role;set role anon;');
 await assert.rejects(()=>db.query("select selfia_revise_memory($1,'confirm','',$2)",[learning.id,corrected.updated_at]),/permission denied/);
 await db.close();
});
test('map separates pending decisions from trend and rejects a one-attempt trend',()=>{
 const now=new Date('2026-10-06T12:00:00Z');
 const data={situations:[],goals:[{life_area:'work',status:'active',progress_state:'pending_decision'}],agenda:[{id:'a',life_area:'work',status:'done'}],reviews:[{event_id:'a',status:'done',created_at:now.toISOString()}]};
 const result=areaSummary('work',data,now);assert.equal(result.trend,'Sin información suficiente');assert.equal(result.pending.decisions,1);
 assert.equal(areaSummary('health',data,now).state,'Sin información suficiente');
 assert.equal(safeLink('javascript:alert(1)'),null);
 assert.equal(localDate(new Date(2026,9,6,0,5)),'2026-10-06');
});

