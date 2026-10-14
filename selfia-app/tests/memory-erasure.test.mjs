import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {continuityContext} from '../../supabase/functions/_shared/continuity.ts';
const a='10000000-0000-4000-8000-000000000001',b='10000000-0000-4000-8000-000000000002';
test('individual memory erasure removes versions, blocks derived context and replay, preserves other owner and rolls back failures',async()=>{
 const db=new PGlite();const q=async(sql,args=[])=>(await db.query(sql,args)).rows;const one=async(sql,args=[])=>Object.values((await q(sql,args))[0])[0];
 try{
  await db.exec(await readFile(new URL('./baseline.sql',import.meta.url),'utf8'));
  const dir=new URL('../../supabase/migrations/',import.meta.url);for(const file of (await readdir(dir)).filter(x=>x.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,dir),'utf8'));
  await db.query('insert into auth.users values($1),($2)',[a,b]);
  const foreign=await one("insert into memories(user_id,memory_type,content) values($1,'conversation_note','Other owner') returning id",[b]);
  await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[a]);
  const conv=await one('insert into conversations(user_id) values($1) returning id',[a]);
  const msg=await one("insert into messages(user_id,conversation_id,role,content) values($1,$2,'user','Private source retained by explicit scope') returning id",[a,conv]);
  const subject=await one("insert into situations(user_id,title,summary,source_message_id) values($1,'Derived sensitive title','Derived private summary',$2) returning id",[a,msg]);
  const event=await one("insert into agenda_events(user_id,title,scheduled_start,situation_id,source_message_id) values($1,'Derived action',now()+interval '1 day',$2,$3) returning id",[a,subject,msg]);
  const review=await one("insert into action_reviews(user_id,event_id,status,learning,next_step,result_note,request_id) values($1,$2,'done','Delete this learning','A derived step','A private result',$3) returning id",[a,event,crypto.randomUUID()]);
  const memory=(await q("insert into memories(user_id,memory_type,content,status,user_validation,source_message_id,source_event_id,structured_data) values($1,'action_learning','Delete this learning','confirmed','confirmed',$2,$3,$4) returning *",[a,msg,event,{review_id:review,next_step:'A derived step'}]))[0];
  const changed=await one("select selfia_revise_memory($1,'correct','Corrected private learning',$2)",[memory.id,memory.updated_at]);
  await assert.rejects(()=>db.query('select selfia_erase_memory($1,$2)',[foreign,memory.updated_at]),/memory_not_found/);
  await assert.rejects(()=>db.query('select selfia_erase_memory($1,$2)',[memory.id,memory.updated_at]),/memory_changed_reload/);
  // Force a middle-of-transaction error: the initial content update must roll back.
  await db.exec("reset role;create function reject_erasure() returns trigger language plpgsql as $$begin raise exception 'injected_failure';end$$;create trigger reject_erasure before update on situation_summary_revisions for each row execute function reject_erasure();set role authenticated");
  await assert.rejects(()=>db.query('select selfia_erase_memory($1,$2)',[memory.id,changed.updated_at]),/injected_failure/);
  assert.equal(await one('select content from memories where id=$1',[memory.id]),'Corrected private learning');
  await db.exec('reset role;drop trigger reject_erasure on situation_summary_revisions;set role authenticated');
  const result=await one('select selfia_erase_memory($1,$2)',[memory.id,changed.updated_at]);assert.equal(result.erased,true);
  assert.deepEqual(await one('select selfia_erase_memory($1,$2)',[memory.id,changed.updated_at]),result,'lost response retry is safe');
  const marker=(await q('select * from memories where id=$1',[memory.id]))[0];assert.equal(marker.content,'');assert.ok(marker.structured_data.erased_at);
  assert.equal(await one('select count(*)::int from memory_revisions where memory_id=$1',[memory.id]),0);
  assert.equal(await one('select learning from action_reviews where id=$1',[review]),null);
  assert.equal(await one('select next_step from action_reviews where id=$1',[review]),null);
  assert.ok((await q('select summary from situation_summary_revisions')).every(r=>r.summary===null));
  await assert.rejects(()=>db.query("update memories set content='Resurrected',status='confirmed' where id=$1",[memory.id]),/memory_erased/);
  await assert.rejects(()=>db.query('delete from memories where id=$1',[memory.id]),/use_memory_erasure/);
  const data={};for(const [field,table] of Object.entries({memories:'memories',sources:'messages',history:'messages',situations:'situations',goals:'goals',agenda:'agenda_events',commitments:'commitments',reviews:'action_reviews',memoryUses:'turn_receipts',revisions:'memory_revisions'}))data[field]=await q('select * from '+table);
  const context=continuityContext(data);assert.equal(context.memories.length,0);assert.equal(context.history.length,0);assert.equal(context.agenda[0].title,null);assert.equal(context.reviews[0].result_note,null);assert.equal(context.reviews[0].next_step,null);assert.equal(context.situations[0].summary,null);assert.equal(context.allowLegacy,false);
  assert.ok(!JSON.stringify(context).includes('private'));assert.equal(await one('select content from messages where id=$1',[msg]),'Private source retained by explicit scope');
  await db.exec('reset role');assert.equal(await one('select content from memories where id=$1',[foreign]),'Other owner');
  await db.exec('set role anon');await db.query("select set_config('request.jwt.claim.sub','',false)");await assert.rejects(()=>db.query('select selfia_erase_memory($1,$2)',[memory.id,changed.updated_at]),e=>e.code==='42501');
 }finally{await db.close()}
});
