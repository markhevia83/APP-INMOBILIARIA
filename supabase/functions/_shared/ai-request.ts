import {createClient} from 'npm:@supabase/supabase-js@2.57.4';
export async function limitedAiFetch(userId:string,endpoint:string,requestId:string|null,init:RequestInit) {
 const id=requestId||crypto.randomUUID(),start=Date.now();
 const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 const failure=(status:number,code:string)=>new Response(JSON.stringify({error:{code,message:status===429?'Has alcanzado un límite temporal de uso. Espera antes de reintentar.':'No se pudo completar la petición de IA.'}}),{status,headers:{'content-type':'application/json','x-request-id':id,'retry-after':'60'}});
 if(!key)return failure(503,'usage_guard_unavailable');
 const server=createClient(Deno.env.get('SUPABASE_URL')??'',key,{auth:{persistSession:false,autoRefreshToken:false}});
 const payload=JSON.parse(String(init.body));
 payload.store=false;
 const units=Math.ceil(new TextEncoder().encode(JSON.stringify(payload)).length/1000)+Math.ceil(Number(payload.max_output_tokens||4000)/1000)+(payload.tools?10:0);
 if(units>200)return failure(413,'context_too_large');
 const{data:reservation,error}=await server.rpc('selfia_reserve_ai_usage',{p_user:userId,p_request:id,p_endpoint:endpoint,p_units:units});
 if(error||!reservation)return failure(503,'usage_guard_unavailable');
 if(!reservation.allowed)return failure(429,reservation.reason||'usage_limit');
 let response:Response,usage:any=null;
 try{
  response=await fetch('https://api.openai.com/v1/responses',{...init,body:JSON.stringify(payload),signal:AbortSignal.timeout(90000)});
  try{usage=await response.clone().json()}catch{}
 }catch{
  await server.from('ai_usage').update({status:'failed',duration_ms:Date.now()-start,http_status:504,error_code:'provider_timeout'}).eq('user_id',userId).eq('request_id',id);
  console.error(JSON.stringify({request_id:id,endpoint,status:504,error_code:'provider_timeout'}));return failure(504,'provider_timeout');
 }
 const outcome={status:response.ok?'completed':'failed',model:typeof usage?.model==='string'?usage.model:payload.model,
  input_tokens:Number.isInteger(usage?.usage?.input_tokens)?usage.usage.input_tokens:null,output_tokens:Number.isInteger(usage?.usage?.output_tokens)?usage.usage.output_tokens:null,
  web_search_calls:Array.isArray(usage?.output)?usage.output.filter((item:any)=>item.type==='web_search_call').length:0,duration_ms:Date.now()-start,http_status:response.status,
  error_code:response.ok?null:'provider_'+response.status};
 const{error:recordError}=await server.from('ai_usage').update(outcome).eq('user_id',userId).eq('request_id',id);
 if(recordError)console.error(JSON.stringify({request_id:id,endpoint,error_code:'usage_record_failed'}));
 console.log(JSON.stringify({request_id:id,endpoint,status:response.status,duration_ms:outcome.duration_ms,input_tokens:outcome.input_tokens,output_tokens:outcome.output_tokens,web_search_calls:outcome.web_search_calls}));
 return response;
}
