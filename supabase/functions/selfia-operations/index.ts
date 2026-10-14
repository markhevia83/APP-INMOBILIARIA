import {operationAlerts} from '../_shared/operations.ts';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'content-type':'application/json'}});
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return json({error:'method_not_allowed'},405);
 const auth=req.headers.get('authorization');if(!auth)return json({error:'unauthorized'},401);
 const url=Deno.env.get('SUPABASE_URL')||'';
 if(url!=='https://tleqdegnzeukonbbrrzk.supabase.co')return json({error:'test_environment_required'},403);
 // Ask Auth to validate the bearer; never trust a decoded or client-supplied identity.
 let user:any;
 try{const r=await fetch(url+'/auth/v1/user',{headers:{apikey:Deno.env.get('SUPABASE_ANON_KEY')||'',authorization:auth},signal:AbortSignal.timeout(10000)});if(!r.ok)return json({error:'unauthorized'},401);user=await r.json();}catch{return json({error:'operations_unavailable'},503)}
 if(!user?.id)return json({error:'unauthorized'},401);
 const operator=Deno.env.get('SELFIA_OPERATOR_USER_ID');if(!operator||user.id!==operator)return json({error:'operator_required'},403);
 if(url!=='https://tleqdegnzeukonbbrrzk.supabase.co')return json({error:'test_environment_required'},403);
 let body:any;try{body=await req.json()}catch{return json({error:'invalid_json'},400)}
 if(!body||typeof body!=='object'||Array.isArray(body))return json({error:'invalid_input'},400);
 if(body.drill===true){
  const sample={budget:{cap_microusd:75000000,spent_microusd:61000000,held_microusd:0},recent:{failures:3,p95_duration_ms:65000},uncertain_reservations:0,unsettled_reservations:0};
  return json({drill:true,checked_at:new Date().toISOString(),alerts:operationAlerts(sample).map(a=>({...a,message:'PRUEBA DE AVISO: '+a.message}))});
 }
 const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!key)return json({error:'operations_unavailable'},503);
 try{
  const r=await fetch(url+'/rest/v1/rpc/selfia_operations_snapshot',{method:'POST',headers:{apikey:key,authorization:'Bearer '+key,'content-type':'application/json'},body:'{}',signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('snapshot_unavailable');
  const snapshot=await r.json();
  return json({drill:false,...snapshot,alerts:operationAlerts(snapshot),delivery:'panel_only_while_open',invoice_cap_verified:false});
 }catch{return json({error:'operations_unavailable',message:'No se pudo comprobar el estado. Revisa el servicio.'},503)}
});
