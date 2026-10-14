// In-process handler test: no network, personal data or real accounts.
import assert from 'node:assert/strict';
Deno.test('plan search only sends explicit search choices and does not load intimate account context',async()=>{
 const oldServe=Deno.serve,oldFetch=globalThis.fetch;
 const names=['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','OPENAI_API_KEY'];
 const old=names.map(name=>Deno.env.get(name));let handler:any,payload:any,stored=0;
 const user='10000000-0000-4000-8000-000000000001';
 try{
  names.forEach(name=>Deno.env.set(name,name==='SUPABASE_URL'?'https://selfia-synthetic.invalid':'synthetic-key'));
  Object.defineProperty(Deno,'serve',{configurable:true,value:(fn:any)=>{handler=fn}});
  globalThis.fetch=(async(input:any,init:any)=>{
   const url=new URL(input instanceof Request?input.url:String(input));
   const body=init?.body?JSON.parse(String(init.body)):null;
   const reply=(data:any)=>new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});
   if(url.pathname==='/auth/v1/user')return reply({id:user,email:'synthetic@example.test'});
   if(url.pathname==='/rest/v1/rpc/selfia_reserve_ai_cost')return reply({allowed:true,reservation_id:crypto.randomUUID(),attempt:1});
   if(url.pathname==='/rest/v1/rpc/selfia_settle_ai_cost')return reply(null);
   if(url.pathname==='/rest/v1/ai_usage')return new Response(null,{status:204});
   if(url.origin==='https://api.openai.com'&&url.pathname==='/v1/responses'){
    payload=body;return reply({model:'synthetic',usage:{input_tokens:20,output_tokens:20},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({intro:'Prueba',plans:[{title:'Paseo',source_url:'https://example.test/plan',timing_kind:'flexible',requires_opening_hours:false}]}),annotations:[{type:'url_citation',url:'https://example.test/plan',title:'Fuente'}]}]}]});
   }
   if(url.pathname==='/rest/v1/plan_proposals'){stored++;return reply(body.map((row:any)=>({id:crypto.randomUUID(),payload:row.payload,checked_at:row.checked_at,expires_at:row.expires_at})))}
   throw Error('Unexpected request: '+url.pathname);
  }) as typeof fetch;
  await import('../functions/selfia-discover/index.ts?privacy-test');
  const response=await handler(new Request('https://selfia-synthetic.invalid/functions/v1/selfia-discover',{method:'POST',headers:{Authorization:'Bearer synthetic','Content-Type':'application/json'},body:JSON.stringify({city:'Madrid',country:'España',vibe:'tranquilo',intent:'today_plan',timezone:'Europe/Madrid',profile:'PRIVATE_PROFILE',memories:'PRIVATE_MEMORY',situations:'PRIVATE_SITUATION'})}));
  assert.equal(response.status,200);assert.equal(stored,1);assert.equal((await response.json()).plans.length,1);
  const text=JSON.stringify(payload);assert.ok(text.includes('Madrid'));assert.ok(text.includes('tranquilo'));
  for(const privateValue of ['PRIVATE_PROFILE','PRIVATE_MEMORY','PRIVATE_SITUATION',user,'synthetic@example.test'])assert.ok(!text.includes(privateValue));
  assert.equal(payload.store,false);
 }finally{
  Object.defineProperty(Deno,'serve',{configurable:true,value:oldServe});globalThis.fetch=oldFetch;
  names.forEach((name,index)=>old[index]===undefined?Deno.env.delete(name):Deno.env.set(name,old[index]!));
 }
});
