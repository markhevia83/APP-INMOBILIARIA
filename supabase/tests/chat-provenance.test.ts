import assert from 'node:assert/strict';
Deno.test('actual chat handler keeps fresh independent profile facts after withdrawal without legacy context',async()=>{
 const oldServe=Deno.serve,oldFetch=globalThis.fetch;
 const names=['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','OPENAI_API_KEY'];
 const old=names.map(name=>Deno.env.get(name));let handler:any,payload:any;
 const user=crypto.randomUUID(),conversation=crypto.randomUUID(),independent='SYNTHETIC_INDEPENDENT_PREFERENCE';
 try{
  names.forEach(name=>Deno.env.set(name,name==='SUPABASE_URL'?'https://selfia-synthetic.invalid':'synthetic-key'));
  Object.defineProperty(Deno,'serve',{configurable:true,value:(fn:any)=>{handler=fn}});
  globalThis.fetch=(async(input:any,init:any)=>{
   const url=new URL(input instanceof Request?input.url:String(input));
   const body=init?.body?JSON.parse(String(init.body)):null;
   const reply=(data:any)=>new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});
   if(url.pathname==='/auth/v1/user')return reply({id:user});
   if(url.pathname==='/rest/v1/rpc/selfia_reserve_ai_cost')return reply({allowed:true,reservation_id:crypto.randomUUID(),attempt:1});
   if(url.pathname==='/rest/v1/rpc/selfia_settle_ai_cost')return reply(null);
   if(url.pathname==='/rest/v1/ai_usage')return new Response(null,{status:204});
   if(url.pathname==='/rest/v1/conversations')return reply({id:conversation});
   if(url.pathname==='/rest/v1/profiles')return reply({base_profile:{secret:'SYNTHETIC_LEGACY_PROFILE'}});
   if(url.pathname==='/rest/v1/profile_items')return reply([{id:crypto.randomUUID(),content:independent,active:true,epistemic_type:'user_declared',user_validation:'confirmed',source_message_id:null,provenance:{origin:'explicit_profile_declaration',request_id:crypto.randomUUID(),memory_dependencies:[]}},{content:'SYNTHETIC_UNKNOWN_FACT',active:true}]);
   if(url.pathname==='/rest/v1/memories')return reply([{id:crypto.randomUUID(),content:'SYNTHETIC_WITHDRAWN_MEMORY',status:'do_not_store',user_validation:'rejected'}]);
   if(url.pathname==='/rest/v1/rpc/selfia_save_turn')return reply({conversation_id:conversation,source_message_id:crypto.randomUUID(),reply:body.p_turn.reply,situation:null,commitment:null,goal_id:null});
   if(url.pathname.startsWith('/rest/v1/'))return reply([]);
   if(url.origin==='https://api.openai.com'){
    payload=body;return reply({output_text:JSON.stringify({reply:'Respuesta sintética',intervention:'LISTEN',loop_detected:false,life_area:'self',situation:{action:'none',situation_id:null,title:'',summary:''},commitment:{create:false,what:'',why:''},suggested_support:'',memory:{content:''}}),usage:{input_tokens:1,output_tokens:1}});
   }
   throw Error('Unexpected request: '+url.pathname);
  }) as typeof fetch;
  await import('../functions/selfia-chat/index.ts?provenance-test');
  const response=await handler(new Request('https://selfia-synthetic.invalid/functions/v1/selfia-chat',{method:'POST',headers:{Authorization:'Bearer synthetic','Content-Type':'application/json'},body:JSON.stringify({conversation_id:conversation,request_id:crypto.randomUUID(),content:'Una declaración independiente'})}));
  assert.equal(response.status,200);
  assert.ok(payload.instructions.includes(independent),'fresh explicit preference must reach the model after a withdrawal');
  for(const excluded of ['SYNTHETIC_LEGACY_PROFILE','SYNTHETIC_UNKNOWN_FACT','SYNTHETIC_WITHDRAWN_MEMORY'])assert.ok(!payload.instructions.includes(excluded));
 }finally{
  Object.defineProperty(Deno,'serve',{configurable:true,value:oldServe});globalThis.fetch=oldFetch;
  names.forEach((name,index)=>old[index]===undefined?Deno.env.delete(name):Deno.env.set(name,old[index]!));
 }
});
