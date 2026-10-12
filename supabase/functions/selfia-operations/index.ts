import {createClient} from 'npm:@supabase/supabase-js@2.57.4';
import {operationAlerts} from '../_shared/operations.ts';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'content-type':'application/json'}});
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return json({error:'method_not_allowed'},405);
 const auth=req.headers.get('authorization');if(!auth)return json({error:'unauthorized'},401);
 const url=Deno.env.get('SUPABASE_URL')||'';
 const sb=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')||'',{global:{headers:{Authorization:auth}}});
 const {data:{user},error}=await sb.auth.getUser(auth.replace(/^Bearer\s+/,''));if(error||!user)return json({error:'unauthorized'},401);
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
  const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const r=await admin.rpc('selfia_operations_snapshot');if(r.error)throw Error('snapshot_unavailable');
  return json({drill:false,...r.data,alerts:operationAlerts(r.data),delivery:'panel_only_while_open',invoice_cap_verified:false});
 }catch{return json({error:'operations_unavailable',message:'No se pudo comprobar el estado. Revisa el servicio.'},503)}
});
