import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createChatWorkspace,voiceTranscript} from '../src/chat-workspace.js';
import {readApiResponse,ProtocolError} from '../src/api-protocol.js';
import {independentProfileItems,eligiblePlanProposals} from '../../supabase/functions/_shared/profile-provenance.ts';
const uid='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002';
test('scheduling keeps action, objective and subject coherent and rejects foreign or conflicting objectives',async()=>{
 const db=new PGlite();try{
  await db.exec(await readFile(new URL('./baseline.sql',import.meta.url),'utf8'));
  const dir=new URL('../../supabase/migrations/',import.meta.url);
  for(const file of (await readdir(dir)).filter(x=>x.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,dir),'utf8'));
  await db.exec(`insert into auth.users values ('${uid}'),('${other}');set role authenticated`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);
  const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
  const sid=await scalar("insert into situations(user_id,title,life_area) values($1,'Asunto','work') returning id",[uid]);
  const cid=await scalar("insert into commitments(user_id,what,situation_id) values($1,'Acción',$2) returning id",[uid,sid]);
  const goal=await scalar("insert into goals(user_id,title,life_area) values($1,'Objetivo','work') returning id",[uid]);
  const date=new Date(Date.now()+86400000).toISOString();
  const event=await scalar("select selfia_schedule_commitment($1,$2,'work','commitment',$3)",[cid,date,goal]);
  assert.equal(event.goal_id,goal);assert.equal(event.situation_id,sid);
  assert.equal(await scalar('select goal_id from commitments where id=$1',[cid]),goal);
  assert.equal(await scalar('select situation_id from goals where id=$1',[goal]),sid);
  assert.equal((await scalar("select selfia_schedule_commitment($1,$2,'work','commitment',$3)",[cid,date,goal])).id,event.id);
  const conflicting=await scalar("insert into goals(user_id,title,life_area) values($1,'Otro','work') returning id",[uid]);
  await assert.rejects(()=>scalar("select selfia_schedule_commitment($1,$2,'work','commitment',$3)",[cid,date,conflicting]),/schedule_conflict/);
  const unlinked=await scalar("insert into commitments(user_id,what) values($1,'Nueva') returning id",[uid]);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[other]);
  const foreign=await scalar("insert into goals(user_id,title,life_area) values($1,'Ajeno','work') returning id",[other]);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);
  await assert.rejects(()=>scalar("select selfia_schedule_commitment($1,$2,'work','commitment',$3)",[unlinked,date,foreign]),/goal_context_conflict/);
  assert.equal(await scalar('select count(*)::int from agenda_events'),1);
 }finally{await db.close()}
});
test('real SQL: corrected skip, conflicting scheduling, atomic idempotent agenda and onboarding with RLS',async()=>{
 const db=new PGlite();try{
  await db.exec(await readFile(new URL('./baseline.sql',import.meta.url),'utf8'));
  const dir=new URL('../../supabase/migrations/',import.meta.url);
  for(const file of (await readdir(dir)).filter(x=>x.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,dir),'utf8'));
  await db.exec(`insert into auth.users values ('${uid}'),('${other}');set role authenticated`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);
  const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
  const row=async(sql,args=[])=> (await db.query(sql,args)).rows[0];
  const uuid=()=>scalar('select gen_random_uuid()');
  const c=await scalar("insert into commitments(user_id,what,why) values($1,'Probar','Motivo') returning id",[uid]);
  const start=new Date(Date.now()+86400000).toISOString();
  const schedule=()=>scalar("select selfia_schedule_commitment($1,$2,'work','commitment',null)",[c,start]);
  const e=await schedule();assert.equal((await schedule()).id,e.id);
  await assert.rejects(()=>scalar("select selfia_schedule_commitment($1,$2,'work','commitment',null)",[c,new Date(Date.now()+172800000).toISOString()]),/schedule_conflict/);
  const statuses=['done','partially_done','not_done','moved','no_longer_relevant','skipped_review'];
  for(const from of statuses)for(const to of statuses){
   let event=await row('select * from agenda_events where id=$1',[e.id]);
   const result=await scalar("select selfia_review_action($1,$2,'','','',$3,$4,$5)",[e.id,from,from==='moved'?start:null,await uuid(),event.updated_at]);
   event=await row('select * from agenda_events where id=$1',[e.id]);
   await scalar("select selfia_correct_review($1,$2,$3,'','','',$4,$5,$6)",[result.review.id,e.id,to,to==='moved'?start:null,await uuid(),event.updated_at]);
   const mapped={done:'done',not_done:'not_done',no_longer_relevant:'obsolete',moved:'postponed'};
   assert.equal(await scalar('select status from commitments where id=$1',[c]),mapped[to]||'pending',from+'→'+to);
   assert.equal(await scalar('select status from agenda_events where id=$1',[e.id]),to==='moved'?'planned':to);
  }
  const request=await uuid(),payload={title:'Manual',scheduled_start:start,life_area:'work',event_kind:'obligation'};
  const create=()=>scalar('select selfia_create_agenda($1,$2)',[request,payload]);
  const saved=await create();assert.equal((await create()).id,saved.id);
  assert.equal(await scalar("select count(*)::int from agenda_events where title='Manual'"),1);
  await assert.rejects(()=>scalar('select selfia_create_agenda($1,$2)',[request,{...payload,title:'Otra'}]),/request_conflict/);
  const transition=(action,body={},id)=>scalar('select selfia_onboarding_transition($1,$2,$3)',[id,action,body]);
  const onboardingRequest=await uuid(),session=await transition('start',{},onboardingRequest);
  assert.equal((await transition('start',{},onboardingRequest)).session_id,session.session_id);
  const answerRequest=await uuid(),body={session_id:session.session_id,expected_revision:0,content:'Un valor independiente'};
  assert.equal((await transition('answer',body,answerRequest)).revision,1);
  assert.equal((await transition('answer',body,answerRequest)).revision,1);
  const staleRequest=await uuid();await assert.rejects(()=>transition('answer',body,staleRequest),/session_changed_reload/);
  await db.exec("reset role;create function fail_profile() returns trigger language plpgsql as $$ begin raise exception 'injected_profile_failure'; end $$;create trigger fail_profile before update on profiles for each row execute function fail_profile();set role authenticated;");
  const before=await scalar('select count(*)::int from mutation_receipts');
  await assert.rejects(()=>transition('skip',{session_id:session.session_id},crypto.randomUUID()),/injected_profile_failure/);
  assert.equal(await scalar('select status from onboarding_sessions where id=$1',[session.session_id]),'in_progress');
  assert.equal(await scalar('select count(*)::int from mutation_receipts'),before);
  await db.exec('reset role;drop trigger fail_profile on profiles;set role authenticated;');
  await db.query("insert into messages(user_id,conversation_id,role,content) values($1,$2,'assistant','Respuesta inicial')",[uid,session.conversation_id]);
  assert.equal((await transition('complete',{session_id:session.session_id},await uuid())).status,'completed');
  assert.equal(await scalar('select onboarding_status from profiles'),'completed');
  const independent=await scalar('select selfia_declare_profile_item($1,$2)',[await uuid(),'Prefiero escribir por la mañana']);
  assert.equal(independentProfileItems([independent]).length,1);
  const exported=await scalar('select selfia_export_data()');assert.equal(exported.user_id,uid);assert.ok(exported.data.profile_items.some(item=>item.id===independent.id));assert.ok(exported.data.action_reviews.length>=72);
  const erasure=await scalar('select selfia_request_erasure($1)',[await uuid()]);assert.equal(erasure.status,'pending');assert.equal((await scalar('select selfia_request_erasure($1)',[await uuid()])).id,erasure.id);
  assert.equal(await scalar('select count(*)::int from agenda_events'),2,'requesting erasure does not falsely pretend deletion');
  const proposal=crypto.randomUUID(),checked=new Date().toISOString(),expires=new Date(Date.now()+1800000).toISOString();
  const tz='Europe/Madrid',date=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const plan={title:'Plan flexible',description:'Actividad en casa',timing_kind:'flexible',requires_opening_hours:false,source_url:'https://example.test/plan'};
  await db.exec('reset role');
  await db.query('insert into plan_proposals(id,user_id,payload,timezone,local_date,checked_at,expires_at,source_evidence) values($1,$2,$3,$4,$5,$6,$7,$8)',[proposal,uid,plan,tz,date,checked,expires,{kind:'web_citation',url:plan.source_url}]);
  await db.exec('set role authenticated');
  const planRequest=await uuid(),planStart=new Date(Date.now()+31*60000).toISOString();
  // At midnight this may be tomorrow; use an explicit day-mismatch assertion instead of a flaky success.
  if(new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(planStart))===date){
   const scheduled=await scalar('select selfia_schedule_plan($1,$2,$3)',[proposal,planStart,planRequest]);
   assert.equal((await scalar('select selfia_schedule_plan($1,$2,$3)',[proposal,planStart,planRequest])).id,scheduled.id);
  }
  await assert.rejects(()=>scalar('select selfia_schedule_plan($1,$2,$3)',[proposal,new Date(Date.now()+1000).toISOString(),crypto.randomUUID()]),/margin_invalid/);
  await assert.rejects(()=>scalar('select selfia_schedule_plan($1,$2,$3)',[proposal,start,crypto.randomUUID()]),/margin_invalid/);
  await assert.rejects(()=>db.query('insert into plan_proposals(user_id,payload,timezone,local_date,expires_at,source_evidence) values($1,$2,$3,$4,$5,$6)',[uid,plan,tz,date,expires,{}]),/permission denied/);
  await db.exec('reset role');await db.query("update plan_proposals set checked_at=now()-interval '1 hour',expires_at=now()-interval '31 minutes' where id=$1",[proposal]);await db.exec('set role authenticated');
  await assert.rejects(()=>scalar('select selfia_schedule_plan($1,$2,$3)',[proposal,planStart,crypto.randomUUID()]),/plan_expired/);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[other]);
  assert.equal(await scalar('select count(*)::int from mutation_receipts'),0);
  assert.equal((await scalar('select selfia_export_data()')).data.profile_items.length,0);
  assert.equal(await scalar('select count(*)::int from erasure_requests'),0);
  await assert.rejects(()=>transition('skip',{session_id:session.session_id},crypto.randomUUID()),/session_not_found/);
  await db.exec('reset role;set role anon;');await assert.rejects(()=>create(),/permission denied/);
 }finally{await db.close()}
});
test('out-of-order replies preserve context, new drafts, reload and logout isolation',()=>{
 const map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
 const w=createChatWorkspace(storage);w.setOwner('A');w.open('work');w.patch({draft:'A original'});const a=w.begin('A original');
 w.open('self',{goal_id:'GB'});w.patch({draft:'B new'});const b=w.begin('B new');w.patch({draft:'B next draft'});
 assert.equal(w.complete(a,{conversation_id:'CA',source_message_id:'MA',reply:'Reply A',situation:{id:'SA'}}),false);
 assert.equal(w.current().draft,'B next draft');assert.equal(w.current().conv,null);assert.equal(w.current().link.goal_id,'GB');
 w.complete(b,{conversation_id:'CB',source_message_id:'MB',reply:'Reply B'});assert.equal(w.current().draft,'B next draft');
 assert.equal(w.open('work').conv.id,'CA');assert.equal(w.current().messages.length,2);
 const reload=createChatWorkspace(storage);reload.setOwner('A');assert.equal(reload.open('work').conv.id,'CA');
 reload.clear();assert.equal(map.size,0);reload.setOwner('B');assert.equal(reload.open('work').messages.length,0);
 w.clear();assert.equal(w.complete(a,{reply:'Too late'}),false);
});
test('invalid success payload and transient failures never erase a draft',async()=>{
 for(const value of ['','{','{}','{"reply":"alone"}'])await assert.rejects(()=>readApiResponse(new Response(value),'selfia-chat'),ProtocolError);
 for(const status of [401,429,503])await assert.rejects(()=>readApiResponse(new Response('{}',{status}),'selfia-chat'),e=>e.status===status);
 assert.deepEqual(await readApiResponse(new Response('{"message":"Hello","cta":"Continue","prompt":"Today"}'),'selfia-daily'),{message:'Hello',cta:'Continue',prompt:'Today'});
});
test('voice retains previous final segments when resultIndex advances',()=>{
 const result=(text,final)=>Object.assign([{transcript:text}],{isFinal:final});
 assert.equal(voiceTranscript([result('primera',true),result('segunda',false)],'borrador'),'borrador primera segunda');
 assert.equal(voiceTranscript([result('primera',true),result('segunda final',true)],'borrador'),'borrador primera segunda final');
});
test('independent declarations survive withdrawal; legacy and derived profile facts remain excluded',()=>{
 const independent={active:true,epistemic_type:'user_declared',user_validation:'confirmed',provenance:{origin:'explicit_profile_declaration',request_id:crypto.randomUUID(),memory_dependencies:[]}};
 assert.equal(independentProfileItems([independent,{...independent,source_message_id:'derived'}, {...independent,provenance:{}}, {...independent,provenance:{...independent.provenance,memory_dependencies:['withdrawn']}}]).length,1);
 const source_url='https://example.test/source',flexible={timing_kind:'flexible',requires_opening_hours:false,source_url};
 assert.deepEqual(eligiblePlanProposals([flexible,{...flexible,timing_kind:'open_window',time_verified:true},{...flexible,source_url:'https://unrelated.test'}],[{url:source_url}]),[flexible]);
});
test('onboarding failure at each write rolls back profile, session, message, conversation and receipt',async()=>{
 const db=new PGlite();try{
  await db.exec(await readFile(new URL('./baseline.sql',import.meta.url),'utf8'));
  const dir=new URL('../../supabase/migrations/',import.meta.url);
  for(const file of (await readdir(dir)).filter(x=>x.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,dir),'utf8'));
  await db.exec("create function injected_failure() returns trigger language plpgsql as $$ begin raise exception 'injected_write_failure'; end $$;");
  const phases={start:['conversations','onboarding_sessions','profiles','mutation_receipts'],answer:['messages','onboarding_sessions','profiles','mutation_receipts'],validate:['profiles','onboarding_sessions','conversations','mutation_receipts'],skip:['profiles','onboarding_sessions','mutation_receipts']};
  let index=10;
  for(const [phase,tables] of Object.entries(phases))for(const table of tables){
   const id='10000000-0000-4000-8000-'+String(index++).padStart(12,'0');
   await db.exec('reset role');await db.query('insert into auth.users values($1)',[id]);await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
   const call=async(action,payload)=>Object.values((await db.query('select selfia_onboarding_transition($1,$2,$3)',[crypto.randomUUID(),action,payload])).rows[0])[0];
   let payload={};
   if(phase!=='start'){
    const session=await call('start',{});payload={session_id:session.session_id};
    await db.exec('reset role');
    if(phase==='answer'){await db.query("update onboarding_sessions set current_dimension='style' where id=$1",[session.session_id]);payload={...payload,expected_revision:0,content:'Última respuesta'};}
    if(phase==='validate'){await db.query("update onboarding_sessions set status='review' where id=$1",[session.session_id]);payload={...payload,expected_revision:0,profile:{priorities:['Mi declaración']}};}
    await db.exec('set role authenticated');
   }
   const snapshot=async()=>{const result={};for(const name of ['conversations','onboarding_sessions','profiles','messages','mutation_receipts'])result[name]=(await db.query('select * from '+name+' where user_id=$1 order by 1',[id])).rows;return result;};
   const before=await snapshot();
   await db.exec(`reset role;create trigger injected_failure before insert or update on ${table} for each row execute function injected_failure();set role authenticated;`);
   await assert.rejects(()=>call(phase,payload),/injected_write_failure/,phase+':'+table);
   assert.deepEqual(await snapshot(),before,phase+':'+table);
   await db.exec(`reset role;drop trigger injected_failure on ${table};set role authenticated;`);
   await call(phase,payload);
  }
 }finally{await db.close()}
});
test('server-only AI reservation enforces concurrency, retry and daily budgets without intimate logs',async()=>{
 const db=new PGlite();try{
  await db.exec(await readFile(new URL('./baseline.sql',import.meta.url),'utf8'));
  const dir=new URL('../../supabase/migrations/',import.meta.url);
  for(const file of (await readdir(dir)).filter(x=>x.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,dir),'utf8'));
  await db.exec(`insert into auth.users values ('${uid}'),('${other}')`);
  const reserve=async(user,id,units=1,endpoint='chat')=>Object.values((await db.query('select selfia_reserve_ai_usage($1,$2,$3,$4)',[user,id,endpoint,units])).rows[0])[0];
  const first=crypto.randomUUID(),second=crypto.randomUUID();assert.equal((await reserve(uid,first)).allowed,true);
  assert.equal((await reserve(uid,first)).reason,'request_already_running_or_completed');
  assert.equal((await reserve(uid,second)).allowed,true);assert.equal((await reserve(uid,crypto.randomUUID())).reason,'concurrency_limit');
  await db.query("update ai_usage set status='failed' where request_id=$1",[first]);
  assert.equal((await reserve(uid,first)).allowed,true);await db.query("update ai_usage set status='failed' where request_id=$1",[first]);assert.equal((await reserve(uid,first)).allowed,true);
  await db.query("update ai_usage set status='failed' where request_id=$1",[first]);assert.equal((await reserve(uid,first)).reason,'retry_limit');
  await db.exec("update ai_usage set status='failed',reserved_units=1000");assert.equal((await reserve(other,crypto.randomUUID())).reason,'global_daily_budget');
  await db.exec("set role authenticated");await db.query("select set_config('request.jwt.claim.sub',$1,false)",[other]);
  assert.equal((await db.query('select * from ai_usage')).rows.length,0);
  await assert.rejects(()=>reserve(other,crypto.randomUUID()),/permission denied/);
  await assert.rejects(()=>db.query("update ai_usage set status='completed'"),/permission denied/);
 }finally{await db.close()}
});
