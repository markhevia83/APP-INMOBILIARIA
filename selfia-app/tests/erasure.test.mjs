import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const a='10000000-0000-4000-8000-000000000001',b='10000000-0000-4000-8000-000000000002';
test('hard deletion cascades all 22 owner tables, leaves other owner unchanged and cannot refund anonymous money reservations',async()=>{
 const db=new PGlite();try{
  await db.exec(await readFile(new URL('./baseline.sql',import.meta.url),'utf8'));
  const dir=new URL('../../supabase/migrations/',import.meta.url);for(const file of (await readdir(dir)).filter(x=>x.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,dir),'utf8'));
  await db.exec(`insert into auth.users values('${a}'),('${b}')`);
  const seed=async owner=>{
   const id=()=>crypto.randomUUID(),conv=id(),msg=id(),subject=id(),goal=id(),action=id(),event=id(),memory=id();
   await db.query('insert into profiles(user_id) values($1)',[owner]);
   await db.query('insert into conversations(id,user_id) values($1,$2)',[conv,owner]);
   await db.query("insert into messages(id,user_id,conversation_id,role,content) values($1,$2,$3,'user','Synthetic')",[msg,owner,conv]);
   await db.query("insert into situations(id,user_id,title,source_message_id) values($1,$2,'Synthetic',$3)",[subject,owner,msg]);
   await db.query("insert into goals(id,user_id,title,situation_id) values($1,$2,'Synthetic',$3)",[goal,owner,subject]);
   await db.query("insert into commitments(id,user_id,what,situation_id,goal_id,source_message_id) values($1,$2,'Synthetic',$3,$4,$5)",[action,owner,subject,goal,msg]);
   await db.query("insert into agenda_events(id,user_id,title,scheduled_start,commitment_id,goal_id,situation_id,source_message_id) values($1,$2,'Synthetic',now()+interval '2 days',$3,$4,$5,$6)",[event,owner,action,goal,subject,msg]);
   await db.query("insert into memories(id,user_id,memory_type,content,source_message_id,source_event_id) values($1,$2,'conversation_note','Synthetic',$3,$4)",[memory,owner,msg,event]);
   await db.query("insert into people(user_id,name_or_label) values($1,'Synthetic')",[owner]);
   await db.query("insert into hypotheses(user_id,statement) values($1,'Synthetic')",[owner]);
   await db.query("insert into profile_items(user_id,category,content,source_message_id) values($1,'declared_trait','Synthetic',$2)",[owner,msg]);
   await db.query('insert into onboarding_sessions(user_id,conversation_id) values($1,$2)',[owner,conv]);
   await db.query("insert into motivation_feedback(user_id,prompt_type,content) values($1,'start','Synthetic')",[owner]);
   await db.query("insert into action_reviews(user_id,event_id,status,request_id) values($1,$2,'done',$3)",[owner,event,id()]);
   await db.query("insert into memory_revisions(user_id,memory_id,action,before_data,after_data) values($1,$2,'correct','{}','{}')",[owner,memory]);
   await db.query("insert into goal_revisions(user_id,goal_id,before_data,after_data) values($1,$2,'{}','{}')",[owner,goal]);
   await db.query("insert into situation_summary_revisions(user_id,situation_id,memory_id,summary,source_message_id) values($1,$2,$3,'Synthetic',$4)",[owner,subject,memory,msg]);
   await db.query("insert into turn_receipts(user_id,request_id,conversation_id,response,memory_ids) values($1,$2,$3,'{}',array[$4::uuid])",[owner,id(),conv,memory]);
   await db.query("insert into mutation_receipts(user_id,request_id,operation,payload,response) values($1,$2,'synthetic','{}','{}')",[owner,id()]);
   await db.query("insert into plan_proposals(user_id,payload,timezone,local_date,expires_at,source_evidence) values($1,'{}','Europe/Madrid',current_date,now()+interval '20 minutes','{}')",[owner]);
   await db.query("insert into ai_usage(user_id,request_id,endpoint,status,attempts,reserved_units,lease_until) values($1,$2,'chat','failed',1,1,now())",[owner,id()]);
   await db.query('insert into erasure_requests(user_id,request_id) values($1,$2)',[owner,id()]);
  };
  await seed(a);await seed(b);
  const pre=(await db.query('select selfia_erasure_preflight($1) r',[a])).rows[0].r;assert.equal(Object.keys(pre.counts).length,22);assert.ok(Object.values(pre.counts).every(n=>Number(n)===1));assert.equal(pre.ready_for_auth_delete,true);
  const tables=Object.keys(pre.counts);const snapshot={};for(const t of tables)snapshot[t]=(await db.query('select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) r from '+t+' t where user_id=$1',[b])).rows[0].r;
  const reserve=(await db.query("select selfia_reserve_ai_cost($1,$2,'chat',1,123456) r",[a,crypto.randomUUID()])).rows[0].r;assert.equal(reserve.allowed,true);
  await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[a]);
  await assert.rejects(()=>db.query('select selfia_erasure_preflight($1)',[a]),e=>e.code==='42501');
  await assert.rejects(()=>db.query('delete from auth.users where id=$1',[a]),e=>e.code==='42501');
  await db.exec('reset role');await db.query('delete from auth.users where id=$1',[a]);
  for(const t of tables){assert.equal((await db.query('select count(*)::int n from '+t+' where user_id=$1',[a])).rows[0].n,0,t+' erased');assert.deepEqual((await db.query('select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) r from '+t+' t where user_id=$1',[b])).rows[0].r,snapshot[t],t+' other owner unchanged')}
  assert.equal(Number((await db.query('select held_microusd from ai_monthly_budget')).rows[0].held_microusd),123456);
  await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[a]);
  assert.equal((await db.query('select * from agenda_events')).rows.length,0,'stale owner claims cannot read deleted data');
  await assert.rejects(()=>db.query("insert into agenda_events(user_id,title,scheduled_start) values($1,'Synthetic',now())",[a]),e=>e.code==='23503','stale claim cannot recreate data without Auth user');
  await db.exec('reset role');await db.query('select selfia_settle_ai_cost($1,null)',[reserve.reservation_id]);
  assert.equal(Number((await db.query('select spent_microusd from ai_monthly_budget')).rows[0].spent_microusd),123456);
  await db.exec('create schema storage;create table storage.objects(owner_id text)');await db.query('insert into storage.objects values($1)',[b]);
  assert.equal((await db.query('select selfia_erasure_preflight($1) r',[b])).rows[0].r.ready_for_auth_delete,false,'storage stops operator deletion');
 }finally{await db.close()}
});
