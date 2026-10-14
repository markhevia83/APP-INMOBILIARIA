import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {readApiResponse} from '../src/api-protocol.js';
const user='10000000-0000-4000-8000-000000000001';
test('monthly money guard reserves before use, retains unknown charges, settles once and denies client access',async()=>{
 const db=new PGlite();try{
  await db.exec(await readFile(new URL('./baseline.sql',import.meta.url),'utf8'));
  const dir=new URL('../../supabase/migrations/',import.meta.url);
  for(const file of (await readdir(dir)).filter(x=>x.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,dir),'utf8'));
  await db.query('insert into auth.users values($1)',[user]);
  const reserve=async cost=>(await db.query("select selfia_reserve_ai_cost($1,$2,'chat',1,$3) as r",[user,crypto.randomUUID(),cost])).rows[0].r;
  const balance=async()=>(await db.query('select * from ai_monthly_budget')).rows[0];
  const first=await reserve(60000000);assert.equal(first.allowed,true);assert.equal(first.attempt,1);
  assert.equal((await balance()).warning_80,true);
  assert.equal((await reserve(15000001)).reason,'monthly_budget');
  assert.equal((await db.query('select count(*)::int n from ai_usage')).rows[0].n,1,'denial cannot reserve capacity');
  await db.query('select selfia_settle_ai_cost($1,$2)',[first.reservation_id,1000000]);
  const snapshot=await balance();assert.equal(Number(snapshot.spent_microusd),1000000);assert.equal(Number(snapshot.held_microusd),0);
  await db.query('select selfia_settle_ai_cost($1,$2)',[first.reservation_id,70000000]);assert.deepEqual(await balance(),snapshot,'duplicate settlement cannot charge twice');
  const unknown=await reserve(74000000);assert.equal(unknown.allowed,true);
  await db.exec("update ai_usage set lease_until=now()-interval '1 day',status='failed'");
  assert.equal((await reserve(1)).reason,'monthly_budget','expired request does not refund financial reserve');
  await db.query('select selfia_settle_ai_cost($1,null)',[unknown.reservation_id]);
  assert.equal(Number((await balance()).spent_microusd),75000000);assert.equal((await balance()).uncertain_usage,true);assert.equal((await balance()).blocked,true);
  await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
  for(const table of ['ai_monthly_budget','ai_cost_reservations'])await assert.rejects(()=>db.query('select * from '+table),e=>e.code==='42501');
  await assert.rejects(()=>reserve(1),e=>e.code==='42501');
  await assert.rejects(()=>db.query('select selfia_settle_ai_cost($1,0)',[first.reservation_id]),e=>e.code==='42501');
  await db.exec('reset role;set role anon');
  for(const table of ['ai_monthly_budget','ai_cost_reservations'])await assert.rejects(()=>db.query('select * from '+table),e=>e.code==='42501');
  await assert.rejects(()=>reserve(1),e=>e.code==='42501');
  await db.exec('reset role');
  assert.equal((await db.query("select count(*)::int n from information_schema.columns where table_schema='public' and table_name in ('ai_monthly_budget','ai_cost_reservations') and column_name='user_id'")).rows[0].n,0,'deleting user data cannot refund the aggregate budget');
 }finally{await db.close()}
});
test('unexpected excess charges block new calls and last-month spending cannot use this-month allowance',async()=>{
 const db=new PGlite();try{
  await db.exec(await readFile(new URL('./baseline.sql',import.meta.url),'utf8'));
  const dir=new URL('../../supabase/migrations/',import.meta.url);
  for(const file of (await readdir(dir)).filter(x=>x.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,dir),'utf8'));
  await db.query('insert into auth.users values($1)',[user]);
  await db.exec("insert into ai_monthly_budget(month,spent_microusd,blocked) values((date_trunc('month',now() at time zone 'UTC')-interval '1 month')::date,75000000,true)");
  const r=(await db.query("select selfia_reserve_ai_cost($1,$2,'chat',1,1000) r",[user,crypto.randomUUID()])).rows[0].r;assert.equal(r.allowed,true);
  await db.query('select selfia_settle_ai_cost($1,1001)',[r.reservation_id]);
  const denied=(await db.query("select selfia_reserve_ai_cost($1,$2,'chat',1,1) r",[user,crypto.randomUUID()])).rows[0].r;
  assert.equal(denied.reason,'monthly_budget','unexpected extra billing must block before the full cap');
  const previous=(await db.query("select spent_microusd from ai_monthly_budget where month=(date_trunc('month',now() at time zone 'UTC')-interval '1 month')::date")).rows[0];assert.equal(Number(previous.spent_microusd),75000000);
 }finally{await db.close()}
});
test('monthly budget exhaustion preserves a meaningful client error instead of encouraging repeated retries',async()=>{
 for(const error of [{code:'monthly_budget'},'monthly_budget'])await assert.rejects(()=>readApiResponse(new Response(JSON.stringify({error}),{status:429}),'selfia-chat'),/presupuesto mensual/);
});
test('daily quota exhaustion explains the UTC reset even when the server message is private or absent',async()=>{
 for(const error of [{code:'global_daily_budget'},'global_daily_budget','user_daily_limit'])await assert.rejects(()=>readApiResponse(new Response(JSON.stringify({error,message:'SYNTHETIC_PRIVATE_DETAIL'}),{status:429}),'selfia-chat'),e=>e.status===429&&e.message.includes('00:00 UTC')&&!e.message.includes('SYNTHETIC_PRIVATE_DETAIL')&&!e.message.includes('un momento'));
});
test('an exhausted chat request preserves its draft and terminal refusal across reload without silently creating a fresh retry',async()=>{
 const {createChatWorkspace}=await import('../src/chat-workspace.js');const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 const w=createChatWorkspace(storage);w.setOwner('synthetic');w.open();w.patch({draft:'Synthetic terminal request'});
 const ticket=w.begin('Synthetic terminal request');w.fail(ticket,'retry_limit');assert.equal(w.begin('Synthetic terminal request'),null);assert.equal(w.current().draft,'Synthetic terminal request');
 const reload=createChatWorkspace(storage);reload.setOwner('synthetic');reload.open();assert.equal(reload.begin('Synthetic terminal request'),null);assert.equal(reload.current().draft,'Synthetic terminal request');
 await assert.rejects(()=>readApiResponse(new Response(JSON.stringify({error:'retry_limit'}),{status:429}),'selfia-chat'),e=>e.code==='retry_limit'&&e.message.includes('agotado sus intentos')&&e.message.includes('No esperes')&&!e.message.includes('un momento'));
});
test('onboarding preserves failed request identity and terminal refusal, keeps edits during a reply, and clears account-private drafts on logout',async()=>{
 const {createOnboardingRequests}=await import('../src/onboarding-requests.js');const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 const a=createOnboardingRequests(storage);a.setOwner('a');a.setDraft('Synthetic initial draft');const ticket=a.begin('Synthetic initial draft');a.fail(ticket,'retry_limit');
 const reload=createOnboardingRequests(storage);reload.setOwner('a');assert.equal(reload.snapshot().pending.request_id,ticket.request.request_id);assert.equal(reload.begin('Synthetic initial draft'),null);
 reload.setDraft('Explicit edited draft');const edited=reload.begin('Explicit edited draft');assert.notEqual(edited.request.request_id,ticket.request.request_id);reload.setDraft('New text while waiting');reload.complete(edited);assert.equal(reload.snapshot().draft,'New text while waiting');assert.equal(reload.snapshot().hasDraft,true);
 reload.setDraft('');const empty=createOnboardingRequests(storage);empty.setOwner('a');assert.equal(empty.snapshot().hasDraft,true);assert.equal(empty.snapshot().draft,'');
 const old=reload.begin('Old account request');reload.clear();reload.setOwner('b');assert.equal(reload.fail(old,'retry_limit'),false);assert.equal(reload.snapshot().hasDraft,false);assert.equal(storage.getItem('selfia-onboarding-a'),undefined);
});
