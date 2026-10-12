import assert from 'node:assert/strict';
import {operationAlerts} from '../functions/_shared/operations.ts';
Deno.test('operations thresholds catch budget, failures, latency and uncertain spend without refunding or exposing data',()=>{
 const sample={budget:{cap_microusd:75000000,spent_microusd:61000000,held_microusd:0},recent:{failures:3,p95_duration_ms:65000,stale_in_progress:1},uncertain_reservations:1,unsettled_reservations:1};
 const before=JSON.stringify(sample),codes=operationAlerts(sample,Date.parse('2026-10-12')).map(x=>x.code);
 for(const code of ['budget_80','provider_failures','slow_responses','stale_requests','uncertain_cost'])assert.ok(codes.includes(code));
 assert.equal(JSON.stringify(sample),before,'alert checks never release money or edit state');
 assert.ok(operationAlerts({...sample,budget:{...sample.budget,spent_microusd:75000000}},Date.parse('2026-10-12')).some(x=>x.code==='budget_blocked'));
 assert.ok(operationAlerts(sample,Date.parse('2026-11-11')).some(x=>x.code==='pricing_review'));
 assert.throws(()=>operationAlerts({...sample,budget:{...sample.budget,cap_microusd:100}}));
 assert.ok(operationAlerts({...sample,daily_capacity:{units_used:974,units_limit:1000,calls_used:52,calls_limit:200}}).some(x=>x.code==='daily_capacity'),'daily limit can deny requests even with monthly money remaining');
});
Deno.test('operations endpoint validates identity, denies other users before admin access and clearly marks drills',async()=>{
 const oldServe=Deno.serve,oldFetch=globalThis.fetch,names=['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','SELFIA_OPERATOR_USER_ID'];
 const old=names.map(x=>Deno.env.get(x));const operator=crypto.randomUUID();let handler:any,actor=operator,valid=true,adminCalls=0;
 try{
  Deno.env.set('SUPABASE_URL','https://tleqdegnzeukonbbrrzk.supabase.co');Deno.env.set('SELFIA_OPERATOR_USER_ID',operator);Deno.env.set('SUPABASE_ANON_KEY','synthetic');Deno.env.set('SUPABASE_SERVICE_ROLE_KEY','synthetic-service');
  Object.defineProperty(Deno,'serve',{configurable:true,value:(fn:any)=>{handler=fn}});
  globalThis.fetch=(async(input:any)=>{
   const u=new URL(input instanceof Request?input.url:String(input));
   if(u.pathname==='/auth/v1/user')return new Response(JSON.stringify(valid?{id:actor}:{message:'invalid JWT'}),{status:valid?200:401,headers:{'content-type':'application/json'}});
   assert.equal(u.pathname,'/rest/v1/rpc/selfia_operations_snapshot');adminCalls++;
   return new Response(JSON.stringify({checked_at:new Date().toISOString(),budget:{cap_microusd:75000000,spent_microusd:0,held_microusd:0},recent:{failures:0},uncertain_reservations:0,unsettled_reservations:0}),{headers:{'content-type':'application/json'}});
  }) as typeof fetch;
  await import('../functions/selfia-operations/index.ts?operations-test');
  const call=(body={},auth=true)=>handler(new Request('https://selfia-synthetic.invalid',{method:'POST',headers:auth?{authorization:'Bearer synthetic'}:{},body:JSON.stringify(body)}));
  assert.equal((await call({},false)).status,401);valid=false;assert.equal((await call()).status,401);valid=true;
  actor=crypto.randomUUID();assert.equal((await call()).status,403);assert.equal(adminCalls,0);
  actor=operator;const normal=await call();assert.equal(normal.status,200);assert.equal((await normal.json()).invoice_cap_verified,false);assert.equal(adminCalls,1);
  const drill=await call({drill:true});assert.equal(drill.status,200);const data=await drill.json();assert.equal(data.drill,true);assert.ok(data.alerts.every((x:any)=>x.message.startsWith('PRUEBA DE AVISO:')));assert.equal(adminCalls,1,'drill never touches billing state');
 }finally{Object.defineProperty(Deno,'serve',{configurable:true,value:oldServe});globalThis.fetch=oldFetch;names.forEach((x,i)=>old[i]===undefined?Deno.env.delete(x):Deno.env.set(x,old[i]!));}
});
