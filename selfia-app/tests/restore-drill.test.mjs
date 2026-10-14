import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const a='10000000-0000-4000-8000-000000000001',b='10000000-0000-4000-8000-000000000002';
test('isolated backup restore retains corrected outcomes, withdrawn memory, ownership and monetary reserves',async()=>{
 const source=new PGlite();let restored;try{
  await source.exec(await readFile(new URL('./baseline.sql',import.meta.url),'utf8'));
  const dir=new URL('../../supabase/migrations/',import.meta.url);
  for(const file of (await readdir(dir)).filter(x=>x.endsWith('.sql')).sort())await source.exec(await readFile(new URL(file,dir),'utf8'));
  await source.exec(`insert into auth.users values('${a}'),('${b}');set role authenticated`);
  await source.query("select set_config('request.jwt.claim.sub',$1,false)",[a]);
  const scalar=async(db,sql,args=[])=>(await db.query(sql,args)).rows[0].r;
  const req=crypto.randomUUID(),payload={title:'Synthetic restoration event',life_area:'work',scheduled_start:new Date(Date.now()+86400000).toISOString()};
  const event=await scalar(source,'select selfia_create_agenda($1,$2) r',[req,payload]);
  const review=await scalar(source,"select selfia_review_action($1,'done','Synthetic outcome','Synthetic learning','Synthetic next',null,$2,$3) r",[event.id,crypto.randomUUID(),event.updated_at]);
  assert.ok(review.memory_id);
  const prior=(await source.query('select updated_at from memories where id=$1',[review.memory_id])).rows[0];
  await source.query("select selfia_revise_memory($1,'dontuse','',$2)",[review.memory_id,prior.updated_at]);
  const current=(await source.query('select updated_at from agenda_events where id=$1',[event.id])).rows[0].updated_at;
  await scalar(source,"select selfia_correct_review($1,$2,'skipped_review','','','',null,$3,$4) r",[review.review.id,event.id,crypto.randomUUID(),current]);
  await source.query("select set_config('request.jwt.claim.sub',$1,false)",[b]);
  await scalar(source,'select selfia_create_agenda($1,$2) r',[crypto.randomUUID(),{...payload,title:'Synthetic other owner'}]);
  await source.exec('reset role');
  const cost=await scalar(source,"select selfia_reserve_ai_cost($1,$2,'chat',1,123456) r",[a,crypto.randomUUID()]);assert.equal(cost.allowed,true);
  const snapshot=async db=>{
   const tables=(await db.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows;
   const result={};for(const {tablename} of tables)result[tablename]=(await db.query('select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),\'[]\'::jsonb) r from '+tablename+' t')).rows[0].r;
   return result;
  };
  const before=await snapshot(source),backup=await source.dumpDataDir();assert.ok(backup.size>0);
  restored=await PGlite.create({loadDataDir:backup});assert.deepEqual(await snapshot(restored),before,'all public rows and history restored exactly');
  await restored.exec('set role authenticated');await restored.query("select set_config('request.jwt.claim.sub',$1,false)",[b]);
  assert.deepEqual((await restored.query('select * from agenda_events where user_id=$1',[a])).rows,[]);
  await assert.rejects(()=>restored.query('select * from ai_monthly_budget'),e=>e.code==='42501');
  await restored.query("select set_config('request.jwt.claim.sub',$1,false)",[a]);
  assert.equal((await restored.query('select status from agenda_events where id=$1',[event.id])).rows[0].status,'skipped_review');
  const withdrawn=(await restored.query('select status,user_validation from memories where id=$1',[review.memory_id])).rows[0];
  assert.ok(withdrawn.status==='do_not_store'||withdrawn.user_validation==='rejected','obsolete learning stays excluded after restore');
  assert.equal((await scalar(restored,'select selfia_create_agenda($1,$2) r',[req,payload])).id,event.id,'lost response replay after restore does not duplicate');
  await restored.exec('reset role');
  await restored.query('select selfia_settle_ai_cost($1,null)',[cost.reservation_id]);
  assert.equal(Number((await restored.query('select spent_microusd from ai_monthly_budget')).rows[0].spent_microusd),123456,'uncertain usage cannot disappear after restore');
 }finally{if(restored)await restored.close();await source.close()}
});
