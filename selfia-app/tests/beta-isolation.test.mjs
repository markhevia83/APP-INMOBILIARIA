import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const a='10000000-0000-4000-8000-000000000001',b='10000000-0000-4000-8000-000000000002';
const setup=async()=>{const db=new PGlite();await db.exec(await readFile(new URL('./baseline.sql',import.meta.url),'utf8'));const dir=new URL('../../supabase/migrations/',import.meta.url);for(const file of (await readdir(dir)).filter(x=>x.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,dir),'utf8'));await db.exec(`insert into auth.users values('${a}'),('${b}')`);return db};
test('all 22 owner tables deny foreign reads, writes, deletes, spoofed ownership and anonymous access',async()=>{
 const db=await setup();try{
  const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
  const fixture=async owner=>{
   const id=()=>crypto.randomUUID();const conv=id(),message=id(),subject=id(),goal=id(),action=id(),event=id(),memory=id();
   await db.query('insert into profiles(user_id) values($1)',[owner]);
   await db.query('insert into conversations(id,user_id) values($1,$2)',[conv,owner]);
   await db.query("insert into messages(id,user_id,conversation_id,role,content) values($1,$2,$3,'user','Synthetic text')",[message,owner,conv]);
   await db.query("insert into situations(id,user_id,title,source_message_id) values($1,$2,'Synthetic subject',$3)",[subject,owner,message]);
   await db.query("insert into goals(id,user_id,title,situation_id) values($1,$2,'Synthetic goal',$3)",[goal,owner,subject]);
   await db.query("insert into commitments(id,user_id,what,situation_id,goal_id,source_message_id) values($1,$2,'Synthetic action',$3,$4,$5)",[action,owner,subject,goal,message]);
   await db.query("insert into agenda_events(id,user_id,title,scheduled_start,commitment_id,goal_id,situation_id,source_message_id) values($1,$2,'Synthetic event',now()+interval '2 days',$3,$4,$5,$6)",[event,owner,action,goal,subject,message]);
   await db.query("insert into memories(id,user_id,memory_type,content,source_message_id,source_event_id) values($1,$2,'conversation_note','Synthetic memory',$3,$4)",[memory,owner,message,event]);
   await db.query("insert into people(user_id,name_or_label) values($1,'Synthetic person')",[owner]);
   await db.query("insert into hypotheses(user_id,statement) values($1,'Synthetic hypothesis')",[owner]);
   await db.query("insert into profile_items(user_id,category,content,source_message_id) values($1,'declared_trait','Synthetic declaration',$2)",[owner,message]);
   await db.query('insert into onboarding_sessions(user_id,conversation_id) values($1,$2)',[owner,conv]);
   await db.query("insert into motivation_feedback(user_id,prompt_type,content) values($1,'start','Synthetic motivation')",[owner]);
   await db.query("insert into action_reviews(user_id,event_id,status,request_id) values($1,$2,'done',$3)",[owner,event,id()]);
   await db.query("insert into memory_revisions(user_id,memory_id,action,before_data,after_data) values($1,$2,'correct','{}','{}')",[owner,memory]);
   await db.query("insert into goal_revisions(user_id,goal_id,before_data,after_data) values($1,$2,'{}','{}')",[owner,goal]);
   await db.query("insert into situation_summary_revisions(user_id,situation_id,memory_id,summary,source_message_id) values($1,$2,$3,'Synthetic old summary',$4)",[owner,subject,memory,message]);
   await db.query("insert into turn_receipts(user_id,request_id,conversation_id,response,memory_ids) values($1,$2,$3,'{}',array[$4::uuid])",[owner,id(),conv,memory]);
   await db.query("insert into mutation_receipts(user_id,request_id,operation,payload,response) values($1,$2,'synthetic','{}','{}')",[owner,id()]);
   await db.query("insert into plan_proposals(user_id,payload,timezone,local_date,expires_at,source_evidence) values($1,'{}','Europe/Madrid',current_date,now()+interval '20 minutes','{}')",[owner]);
   await db.query("insert into ai_usage(user_id,request_id,endpoint,status,attempts,reserved_units,lease_until) values($1,$2,'chat','failed',1,1,now())",[owner,id()]);
   await db.query('insert into erasure_requests(user_id,request_id) values($1,$2)',[owner,id()]);
  };
  await fixture(a);await fixture(b);
  const tables=(await db.query("select table_name from information_schema.columns where table_schema='public' and column_name='user_id' order by table_name")).rows.map(x=>x.table_name);assert.equal(tables.length,22);
  const snapshots={};for(const table of tables)snapshots[table]=await scalar('select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from '+table+' t');
  await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[b]);
  for(const table of tables){
   assert.equal((await db.query('select * from '+table+' where user_id=$1',[a])).rows.length,0,table+' foreign SELECT');
   assert.equal((await db.query('select * from '+table+' where user_id=$1',[b])).rows.length,1,table+' own SELECT');
   for(const sql of ['update '+table+' set user_id=user_id where user_id=$1 returning *','delete from '+table+' where user_id=$1 returning *']){
    try{assert.equal((await db.query(sql,[a])).rows.length,0,table+' foreign mutation')}catch(error){assert.equal(error.code,'42501',table+' mutation must fail by permission, not unrelated error')}
   }
   const spoof={...snapshots[table][0],user_id:a};if('id' in spoof)spoof.id=crypto.randomUUID();if('request_id' in spoof)spoof.request_id=crypto.randomUUID();
   await assert.rejects(()=>db.query('insert into '+table+' select (jsonb_populate_record(null::'+table+',$1::jsonb)).*',[spoof]),error=>error.code==='42501',table+' spoofed owner');
  }
  await db.exec('reset role');for(const table of tables)assert.deepEqual(await scalar('select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from '+table+' t'),snapshots[table],table+' unchanged');
  await db.exec('set role anon');
  for(const table of [...tables,'brain_versions'])await assert.rejects(()=>db.query('select * from '+table),error=>error.code==='42501',table+' anonymous SELECT');
  await db.exec('reset role;set role authenticated');assert.equal((await db.query('select * from brain_versions')).rows.length,0);
 }finally{await db.close()}
});
test('profile source and onboarding conversation cannot point to another owner on insert or update',async()=>{
 const db=await setup();try{
  const cid=crypto.randomUUID(),mid=crypto.randomUUID();
  await db.query('insert into conversations(id,user_id) values($1,$2)',[cid,a]);await db.query("insert into messages(id,user_id,conversation_id,role,content) values($1,$2,$3,'user','Synthetic A')",[mid,a,cid]);
  await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[b]);
  await assert.rejects(()=>db.query("insert into profile_items(user_id,category,content,source_message_id) values($1,'declared_trait','Synthetic B',$2)",[b,mid]),/linked_record_not_found/);
  await assert.rejects(()=>db.query('insert into onboarding_sessions(user_id,conversation_id) values($1,$2)',[b,cid]),/linked_record_not_found/);
  const item=(await db.query("insert into profile_items(user_id,category,content) values($1,'declared_trait','Synthetic B') returning id",[b])).rows[0].id;
  const session=(await db.query('insert into onboarding_sessions(user_id) values($1) returning id',[b])).rows[0].id;
  await assert.rejects(()=>db.query('update profile_items set source_message_id=$1 where id=$2',[mid,item]),/linked_record_not_found/);
  await assert.rejects(()=>db.query('update onboarding_sessions set conversation_id=$1 where id=$2',[cid,session]),/linked_record_not_found/);
 }finally{await db.close()}
});
