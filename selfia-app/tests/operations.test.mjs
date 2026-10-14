import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('operations SQL snapshot is content-free and denied to client/anonymous roles',async()=>{
 const db=new PGlite();try{
  await db.exec(await readFile(new URL('./baseline.sql',import.meta.url),'utf8'));
  const dir=new URL('../../supabase/migrations/',import.meta.url);for(const f of (await readdir(dir)).filter(x=>x.endsWith('.sql')).sort())await db.exec(await readFile(new URL(f,dir),'utf8'));
  const user=crypto.randomUUID();await db.query('insert into auth.users values($1)',[user]);
  await db.query("insert into conversations(user_id,title) values($1,'SYNTHETIC_PRIVATE_CONTENT')",[user]);
  const r=(await db.query('select selfia_operations_snapshot() as value')).rows[0].value;
  assert.equal(Number(r.budget.cap_microusd),75000000);assert.equal(Number(r.recent.requests),0);assert.ok(!JSON.stringify(r).includes(user));assert.ok(!JSON.stringify(r).includes('SYNTHETIC_PRIVATE_CONTENT'));
  for(const role of ['authenticated','anon']){await db.exec('set role '+role);await assert.rejects(()=>db.query('select selfia_operations_snapshot()'),e=>e.code==='42501');await db.exec('reset role');}
 }finally{await db.close()}
});
