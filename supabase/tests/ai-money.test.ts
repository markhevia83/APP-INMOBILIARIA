import assert from 'node:assert/strict';
import {preparePricedRequest,pricedUsage} from '../functions/_shared/ai-pricing.ts';
import {limitedAiFetch} from '../functions/_shared/ai-request.ts';
Deno.test('pricing bounds tokens, tools and tier and holds estimates when usage is unknown',()=>{
 const request={model:'gpt-5.6',max_output_tokens:1000,input:'Synthetic',service_tier:'priority',store:true};
 const priced=preparePricedRequest(request);assert.equal(priced.payload.service_tier,'default');assert.equal(priced.payload.store,false);
 assert.ok(priced.reserve>40960);
 const search=preparePricedRequest({...request,tools:[{type:'web_search_preview'}]});assert.equal(search.payload.max_tool_calls,1);assert.ok(search.reserve>10000000);
 assert.throws(()=>preparePricedRequest({...request,model:'unknown'}));assert.throws(()=>preparePricedRequest(request,Date.parse('2026-11-11')));
 assert.throws(()=>preparePricedRequest({...request,tools:[{type:'image_generation'}]}));
 const result={model:'gpt-5.6-sol',service_tier:'default',usage:{input_tokens:20,output_tokens:5},output:[]};
 assert.equal(pricedUsage(result,request),350);assert.equal(pricedUsage({...result,service_tier:'priority'},request),null);
 assert.equal(pricedUsage({...result,usage:null},request),null);
});
Deno.test('money denial never calls provider; timeout retains full estimate; settlement identifies its attempt',async()=>{
 const previous=globalThis.fetch,env=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'],old=env.map(x=>Deno.env.get(x));
 let allowed=false,timeout=false,providerCalls=0;const settlements:any[]=[],updates:string[]=[];
 try{
  Deno.env.set(env[0],'https://synthetic.invalid');Deno.env.set(env[1],'synthetic-key');
  globalThis.fetch=(async(input:any,init:any)=>{
   const url=new URL(String(input)),body=JSON.parse(String(init?.body));
   const reply=(data:any)=>new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
   if(url.pathname.endsWith('/selfia_reserve_ai_cost'))return reply(allowed?{allowed:true,reservation_id:'10000000-0000-4000-8000-000000000001',attempt:2}:{allowed:false,reason:'monthly_budget'});
   if(url.pathname.endsWith('/selfia_settle_ai_cost')){settlements.push(body);return reply(null)}
   if(url.pathname==='/rest/v1/ai_usage'){updates.push(url.search);return new Response(null,{status:204})}
   if(url.hostname==='api.openai.com'){providerCalls++;assert.equal(body.service_tier,'default');if(timeout)throw Error('synthetic timeout');return reply({model:'gpt-5.6-sol',service_tier:'default',usage:{input_tokens:20,output_tokens:5},output:[]})}
   throw Error('Unexpected request');
  }) as typeof fetch;
  const request=()=>limitedAiFetch(crypto.randomUUID(),'chat',crypto.randomUUID(),{method:'POST',body:JSON.stringify({model:'gpt-5.6',max_output_tokens:1000,input:'synthetic'})});
  assert.equal((await request()).status,429);assert.equal(providerCalls,0);
  allowed=true;assert.equal((await request()).status,200);assert.equal(settlements[0].p_actual_microusd,350);assert.ok(updates[0].includes('attempts=eq.2'));
  timeout=true;assert.equal((await request()).status,504);assert.equal(settlements[1].p_actual_microusd,null);
 }finally{globalThis.fetch=previous;env.forEach((name,i)=>old[i]===undefined?Deno.env.delete(name):Deno.env.set(name,old[i]!))}
});
