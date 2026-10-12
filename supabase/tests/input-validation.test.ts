import assert from 'node:assert/strict';
Deno.test('malformed authenticated bodies rejected before data/model access by all five body-consuming handlers',async()=>{
 const serve=Deno.serve,fetch=globalThis.fetch;
 const variables=['SUPABASE_URL','SUPABASE_ANON_KEY'],previous=variables.map(x=>Deno.env.get(x));
 let handler:any,authCalls=0;
 try{
  Deno.env.set('SUPABASE_URL','https://selfia-synthetic.invalid');Deno.env.set('SUPABASE_ANON_KEY','synthetic');
  Object.defineProperty(Deno,'serve',{configurable:true,value:(fn:any)=>{handler=fn}});
  globalThis.fetch=(async(input:any)=>{
   const url=new URL(input instanceof Request?input.url:String(input));
   assert.equal(url.pathname,'/auth/v1/user','invalid input must never access data/model');authCalls++;
   return new Response(JSON.stringify({id:crypto.randomUUID()}),{headers:{'content-type':'application/json'}});
  }) as typeof fetch;
  for(const endpoint of ['chat','daily','motivation','discover','onboarding']){
   await import(`../functions/selfia-${endpoint}/index.ts?input-validation`);
   for(const body of ['null','{','[]','"synthetic"','42']){
    const response=await handler(new Request('https://selfia-synthetic.invalid',{method:'POST',headers:{authorization:'Bearer synthetic'},body}));
    assert.equal(response.status,400,endpoint+' '+body);assert.ok((await response.json()).error);
   }
  }
  assert.equal(authCalls,25,'validate identity before input parsing');
 }finally{
  Object.defineProperty(Deno,'serve',{configurable:true,value:serve});globalThis.fetch=fetch;
  variables.forEach((name,i)=>previous[i]===undefined?Deno.env.delete(name):Deno.env.set(name,previous[i]!));
 }
});
