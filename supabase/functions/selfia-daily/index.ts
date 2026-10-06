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
 const body=await req.json().catch(()=>({}));
 const isoDate=String(body.local_date??"");
 const weekday=String(body.weekday??"");
 const hour=Number(body.hour??12);
 const timezone=String(body.timezone??"Europe/Madrid");
 const country=String(body.country_code??"ES").toUpperCase();
 const region=String(body.region_code??"");
 const apiKey=Deno.env.get("OPENAI_API_KEY")??Deno.env.get("openai_api_key");
 if(!apiKey)return json({error:"ai_not_configured"},503);
 let context:any;try{context=await loadContext(sb,user.id)}catch{return json({error:"context_unavailable"},503)}
 const profile=context.profile,situations=context.situations,commitments=context.commitments;
 let holiday=null;
 try{
   const year=isoDate.slice(0,4);
   if(year&&country.length===2){
     const hr=await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`);
     if(hr.ok){
       const hs=await hr.json();
       holiday=(Array.isArray(hs)?hs:[]).find((h:any)=>h.date===isoDate && (!Array.isArray(h.counties)||!region||h.counties.includes(region)))??null;
     }
   }
 }catch{}
 const weekend=["sábado","domingo","saturday","sunday"].includes(weekday.toLowerCase());
 const period=hour<12?"mañana":hour<18?"tarde":"noche";
 const instructions=`Eres SELF-IA y generas el saludo contextual diario de una app de acompañamiento personal.
Debe sentirse como un compañero de vida: cercano, fresco, breve y con iniciativa, nunca pesado ni cursi.
Adapta el tono al día de la semana, momento del día y si es fin de semana o festivo.
Ejemplos de espíritu, no para copiar literalmente:
- Lunes: energía para arrancar y preguntar cómo viene la semana.
- Martes/Miércoles: sensación de avance, revisar cómo va el ritmo.
- Jueves: recta final, comprobar carga y prioridades.
- Viernes: cierre de semana, alivio, balance o plan.
- Sábado: bajar revoluciones, disfrutar, cuidarse o hacer algo pendiente.
- Domingo: descanso, peli, paseo, reflexión ligera o preparar la semana.
Si hay festivo, tenlo en cuenta de forma natural.
Si hay situaciones o compromisos relevantes, puedes enlazar UNO de ellos con tacto.
No hagas terapia, no hagas preguntas múltiples y no conviertas el saludo en una tarea.
Devuelve un texto de 1-3 frases y una CTA muy corta.
Datos del día: fecha ${isoDate}, día ${weekday}, momento ${period}, zona ${timezone}, fin de semana ${weekend}, festivo ${holiday?JSON.stringify(holiday):"no detectado"}.
Memorias validadas (cada intento es evidencia limitada, no un rasgo): ${JSON.stringify(context.memories)}
Perfil declarado: ${JSON.stringify(profile?.base_profile??{})}
Situaciones abiertas: ${JSON.stringify(situations??[])}
Compromisos: ${JSON.stringify(commitments??[])}`;
 const schema={type:"object",additionalProperties:false,properties:{message:{type:"string"},cta:{type:"string"},prompt:{type:"string"}},required:["message","cta","prompt"]};
 const rr=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json"},body:JSON.stringify({model:Deno.env.get("OPENAI_MODEL")||"gpt-5.6",reasoning:{effort:"low"},instructions,input:"Genera el saludo de hoy.",max_output_tokens:350,text:{format:{type:"json_schema",name:"daily_checkin",strict:true,schema}}})});
 const out=await rr.json();
 if(!rr.ok)return json({error:out?.error?.code??"openai_error",message:out?.error?.message??"No se pudo generar el saludo."},502);
 let raw=String(out?.output_text??"").trim();
 if(!raw&&Array.isArray(out?.output))raw=out.output.flatMap((x:any)=>x?.content??[]).filter((x:any)=>x?.type==="output_text").map((x:any)=>x.text).join("\n").trim();
 const parsed=JSON.parse(raw);
 return json({...parsed,holiday:holiday?{name:holiday.localName??holiday.name,date:holiday.date}:null,weekday,period,local_date:isoDate});
});
