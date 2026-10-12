import {SELFIA_SAFETY_RULES} from '../_shared/safety-rules.ts';
import {safeAiError} from '../_shared/ai-errors.ts';
import {limitedAiFetch} from '../_shared/ai-request.ts';
import {loadContext} from "../_shared/load-context.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,"content-type":"application/json"}});
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({error:"method_not_allowed"},405);
 const auth=req.headers.get("Authorization"); if(!auth)return json({error:"unauthorized"},401);
 const token=auth.replace(/^Bearer\s+/,"");
 const sb=createClient(Deno.env.get("SUPABASE_URL")??"",Deno.env.get("SUPABASE_ANON_KEY")??"",{global:{headers:{Authorization:auth}}});
 const {data:{user}}=await sb.auth.getUser(token); if(!user)return json({error:"unauthorized"},401);
 let body:any;try{body=await req.json()}catch{return json({error:'invalid_json'},400)}
 if(!body||typeof body!=='object'||Array.isArray(body))return json({error:'invalid_input'},400);
 const promptType=String(body.prompt_type??"boost");
 const apiKey=Deno.env.get("OPENAI_API_KEY")??Deno.env.get("openai_api_key");
 if(!apiKey)return json({error:"ai_not_configured",message:"Falta la clave de OpenAI en Supabase."},503);
 let context:any;try{context=await loadContext(sb,user.id)}catch{return json({error:"context_unavailable"},503)}
 const profile=context.profile,situations=context.situations,commitments=context.commitments;
 const {data:rawFeedback,error:fe}=await sb.from("motivation_feedback").select("prompt_type,content,content_format,rating").eq("user_id",user.id).not("rating","is",null).order("created_at",{ascending:false}).limit(12);
 if(fe)return json({error:"context_unavailable"},503);
 const feedback=context.allowLegacy?rawFeedback:[];
 const promptLabels:any={start:"Necesito arrancar",stuck:"Estoy bloqueado",low:"Necesito ánimo",prepare:"Prepárame para algo"};
 const instructions=`Eres SELF-IA. Genera una intervención breve de motivación personalizada y útil, no una frase vacía.
El usuario ha elegido: ${promptLabels[promptType]??promptType}.
Usa su perfil declarado y situaciones abiertas solo cuando sean relevantes. No recites el perfil.
Objetivo: activar, dar perspectiva o preparar para actuar. Sé concreto, humano y con iniciativa.
Si conviene, incluye una frase potente y una acción de 2-10 minutos.
Si un vídeo puede ayudar, genera una búsqueda breve para YouTube; no inventes títulos, canales ni enlaces concretos.
Ten en cuenta feedback previo: evita patrones similares a contenidos con dislike y favorece estilos similares a contenidos con like.
Memorias validadas (cada intento es evidencia limitada, no un rasgo): ${JSON.stringify(context.memories)}
Perfil declarado: ${JSON.stringify(profile?.base_profile??{})}
Situaciones abiertas: ${JSON.stringify(situations??[])}
Compromisos: ${JSON.stringify(commitments??[])}
Feedback previo: ${JSON.stringify(feedback??[])}`;
 const schema={type:"object",additionalProperties:false,properties:{
  title:{type:"string"},text:{type:"string"},format:{type:"string",enum:["phrase","boost","video"]},video_query:{type:["string","null"]}
 },required:["title","text","format","video_query"]};
 try{
  const rr=await limitedAiFetch(user.id,'motivation',null,{method:"POST",headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json"},body:JSON.stringify({
   store:false,model:Deno.env.get("OPENAI_MODEL")||"gpt-5.6",reasoning:{effort:"low"},instructions:instructions+'\n'+SELFIA_SAFETY_RULES,input:"Genera una intervención para este momento.",max_output_tokens:600,
   text:{format:{type:"json_schema",name:"motivation",strict:true,schema}}
  })});
  const out=await rr.json();
 if(!rr.ok){const failure=safeAiError(rr.status,out?.error?.code);return json(failure,failure.status);}
  let raw=String(out?.output_text??"").trim();
  if(!raw&&Array.isArray(out?.output))raw=out.output.flatMap((x:any)=>x?.content??[]).filter((x:any)=>x?.type==="output_text").map((x:any)=>x.text).join("\n").trim();
  const parsed=JSON.parse(raw);
  const {data:row,error}=await sb.from("motivation_feedback").insert({user_id:user.id,prompt_type:promptType,content:parsed.text,content_format:parsed.format,video_query:parsed.video_query}).select("id").single();
  if(error)return json({error:"motivation_not_saved",message:"No se pudo guardar la propuesta."},503);
  return json({id:row.id,...parsed});
 }catch(e){return json({error:"motivation_failed",message:"No se pudo generar la propuesta. Inténtalo más tarde."},502)}
});
