import { createClient } from "npm:@supabase/supabase-js@2.57.4";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"content-type":"application/json"}});
const questions:Record<string,string>={priorities:"¿Qué cosas son importantes para ti ahora?",enjoyment:"¿Qué cosas disfrutas?",distress:"¿Qué te pesa últimamente?",boundaries:"¿Cuáles son tus límites?",decisions:"¿Cómo tomas decisiones?",conflict:"¿Cómo afrontas los conflictos?",change:"¿Cómo llevas los cambios?",concerns:"¿Qué te preocupa ahora?",aspirations:"¿Qué te gustaría cambiar?",people:"¿Quiénes son importantes para ti?",style:"¿Cómo prefieres que te acompañe?"};
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return json({error:'method_not_allowed'},405);
 const auth=req.headers.get('Authorization');if(!auth)return json({error:'unauthorized'},401);
 const sb=createClient(Deno.env.get('SUPABASE_URL')??'',Deno.env.get('SUPABASE_ANON_KEY')??'',{global:{headers:{Authorization:auth}}});
 const {data:{user},error:authError}=await sb.auth.getUser(auth.replace(/^Bearer\s+/,''));
 if(authError||!user)return json({error:'unauthorized'},401);
 let body:any;try{body=await req.json()}catch{return json({error:'invalid_json'},400)}
 if(!body||typeof body!=='object'||Array.isArray(body)||!/^([\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12})$/i.test(body.request_id||''))return json({error:'request_id_required'},400);
 const {request_id,action='start',...payload}=body;
 const {data,error}=await sb.rpc('selfia_onboarding_transition',{p_request:request_id,p_action:action,p_payload:payload});
 if(error)return json({error:error.message,message:'No se pudo guardar este paso. Reintenta con los mismos datos.'},/conflict|changed|closed/.test(error.message)?409:400);
 if(!data||!['in_progress','review','completed','skipped'].includes(data.status))return json({error:'invalid_saved_state'},503);
 return json({...data,assistant_message:questions[data.current_dimension]||null,review_message:data.status==='review'?'Revisa lo que me has contado antes de confirmarlo.':null});
});
