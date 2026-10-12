import assert from 'node:assert/strict';
Deno.test('four real AI handlers hide provider details and malformed output while preserving budget denial',async()=>{
 const oldServe=Deno.serve,oldFetch=globalThis.fetch,oldLog=console.log,oldError=console.error;
 const vars=['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','OPENAI_API_KEY'],old=vars.map(x=>Deno.env.get(x));
 const user=crypto.randomUUID(),conversation=crypto.randomUUID(),canary='SYNTHETIC_PRIVATE_PROVIDER_CANARY';
 let handler:any,mode='private_error',providerCalls=0,persistenceCalls=0;const logs:string[]=[];
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
 try{
  vars.forEach(x=>Deno.env.set(x,x==='SUPABASE_URL'?'https://selfia-synthetic.invalid':'synthetic'));
  Object.defineProperty(Deno,'serve',{configurable:true,value:(fn:any)=>{handler=fn}});
  console.log=(...x:any[])=>logs.push(x.join(' '));console.error=(...x:any[])=>logs.push(x.join(' '));
  globalThis.fetch=(async(input:any)=>{
   const u=new URL(input instanceof Request?input.url:String(input));
   if(u.pathname==='/auth/v1/user')return reply({id:user});
   if(u.pathname==='/rest/v1/rpc/selfia_reserve_ai_cost')return reply(['budget','daily_budget'].includes(mode)?{allowed:false,reason:mode==='budget'?'monthly_budget':'global_daily_budget'}:{allowed:true,reservation_id:crypto.randomUUID(),attempt:1});
   if(u.pathname==='/rest/v1/rpc/selfia_settle_ai_cost')return reply(null);
   if(u.pathname==='/rest/v1/ai_usage')return new Response(null,{status:204});
   if(u.pathname==='/rest/v1/profiles')return reply(null);
   if(u.pathname==='/rest/v1/conversations')return reply({id:conversation});
   if(u.pathname.includes('/rpc/selfia_save_')||u.pathname==='/rest/v1/plan_proposals'){persistenceCalls++;throw Error('must not persist a failed response');}
   if(u.pathname.startsWith('/rest/v1/'))return reply([]);
   if(u.origin==='https://api.openai.com'){
    providerCalls++;
    if(mode==='malformed')return new Response('{'+canary,{headers:{'content-type':'application/json'}});
    return reply({error:{code:canary,message:'Private credential '+canary}},401);
   }
   throw Error('Unexpected external access');
  }) as typeof fetch;
  for(const endpoint of ['chat','daily','motivation','discover']){
   await import(`../functions/selfia-${endpoint}/index.ts?provider-errors`);
   for(mode of ['private_error','malformed','budget','daily_budget']){
    const before=providerCalls;
    const response=await handler(new Request('https://selfia-synthetic.invalid',{method:'POST',headers:{authorization:'Bearer synthetic'},body:JSON.stringify({request_id:crypto.randomUUID(),conversation_id:conversation,content:'Caso sintético',city:'Madrid'})}));
    assert.equal(response.status,['budget','daily_budget'].includes(mode)?429:502,endpoint+' '+mode);
    const body=await response.text();assert.ok(!body.includes(canary),endpoint+' must not expose provider details');
    if(endpoint==='chat'){assert.match(body,/support_message/);assert.match(body,/servicios de emergencia/);assert.match(body,/No esperes/);}
    if(mode==='budget'){assert.match(body,/monthly_budget/);assert.equal(providerCalls,before,'budget denial must precede provider');}
    if(mode==='daily_budget'){assert.match(body,/global_daily_budget/);assert.match(body,/00:00 UTC/);assert.equal(providerCalls,before,'daily quota denial must precede provider');}
   }
  }
  assert.equal(persistenceCalls,0);assert.equal(providerCalls,8);
  assert.ok(!logs.join('\n').includes(canary),'logs must not include private provider details');
 }finally{
  Object.defineProperty(Deno,'serve',{configurable:true,value:oldServe});globalThis.fetch=oldFetch;console.log=oldLog;console.error=oldError;
  vars.forEach((x,i)=>old[i]===undefined?Deno.env.delete(x):Deno.env.set(x,old[i]!));
 }
});
