import {availablePlans} from '../_shared/plan-timing.ts';
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
 const intent=String(body.intent??"weekend_plan");
 const vibe=String(body.vibe??"surprise_me").trim();
 const city=String(body.city??"").trim();
 const country=String(body.country??"España").trim();
 const now=new Date();let timezone='Europe/Madrid';
 try{if(body.timezone){new Intl.DateTimeFormat('es-ES',{timeZone:body.timezone}).format(now);timezone=body.timezone}}catch{}
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const part=(kind:string)=>parts.find(p=>p.type===kind)?.value;
 const localDate=part('year')+'-'+part('month')+'-'+part('day');
 const localTime=new Intl.DateTimeFormat('es-ES',{timeZone:timezone,timeStyle:'short'}).format(now);
 const apiKey=Deno.env.get("OPENAI_API_KEY")??Deno.env.get("openai_api_key");
 if(!apiKey)return json({error:"ai_not_configured"},503);

 let context:any;
 try{context=await loadContext(sb,user.id)}catch{return json({error:"context_unavailable"},503)}
 const profile=context.profile,items=context.profileItems,situations=context.situations;
 const {data:feedback,error:fe}=await sb.from("motivation_feedback").select("prompt_type,content,content_format,rating").eq("user_id",user.id).not("rating","is",null).order("created_at",{ascending:false}).limit(10);
 if(fe)return json({error:"context_unavailable"},503);

 const instructions=`Eres SELF-IA. Busca en internet planes, estrenos o contenidos REALES y ACTUALES que puedan encajar con la persona.
Tu objetivo es bienestar, disfrute, curiosidad y conexión social razonable; no terapia.
No inventes eventos, horarios, estrenos, trailers ni enlaces. Si no encuentras algo verificable, dilo.
No asumas que un rasgo provisional define a la persona. Usa preferencias declaradas y patrones repetidos con prudencia.
Prioriza opciones cercanas si hay ciudad. Si no hay ciudad, ofrece propuestas que no dependan de ubicación.
Para cine, puedes sugerir un estreno actual y enlazar a trailer o fuente fiable.
Para planes, intenta incluir al menos una opción de baja fricción y una algo más activa/social.
Sé breve y natural, como un amigo que conoce a la persona y propone algo con motivo.
Fecha y hora ACTUALES verificadas por el servidor: ${localDate}, ${localTime}, zona ${timezone}; instante UTC ${now.toISOString()}.
Para today_plan ofrece únicamente planes realizables a partir de AHORA, dejando al menos 30 minutos para prepararse/desplazarse y tiempo suficiente para disfrutarlos antes del cierre. Nunca recomiendes esta tarde una visita que ya ha cerrado ni un evento empezado. Verifica horarios de hoy y fechas en la fuente oficial. Si está cerrado, busca otra opción, no cambies el día en silencio. Flexible sólo significa actividad sin entradas, cierre, reserva ni evento a hora fija (por ejemplo, casa o paseo libre). Si no puedes verificar el horario de un recinto/evento, exclúyelo.
Ciudad: ${city||"no indicada"}. País: ${country}. Intención: ${intent}. Tipo de plan pedido: ${vibe}.
Perfil declarado: ${JSON.stringify(profile?.base_profile??{})}
Cómo se ha descrito/observado: ${JSON.stringify(items??[])}
Situaciones abiertas relevantes: ${JSON.stringify(situations??[])}
Recuerdos validados y corregibles (un intento no define a la persona): ${JSON.stringify(context.memories)}
Preferencias de motivación aprendidas: ${JSON.stringify(context.allowLegacy?feedback??[]:[])}`;

 const rr=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json"},body:JSON.stringify({
  model:"gpt-5.6",
  reasoning:{effort:"low"},
  tools:[{type:"web_search"}],
  tool_choice:"required",
  instructions,
  input:`Devuelve SOLO JSON válido con esta forma exacta: {"intro":"frase breve","plans":[{"title":"...","category":"tranquilo|movido|social|casa|noche","vibe":"frase de 2-5 palabras","description":"2 frases claras","why":"por qué puede encajar","when":"cuándo/cuánto dura","source_title":"fuente","source_url":"https://..."}]}. Incluye en cada plan timing_kind (flexible|open_window|fixed_event), requires_opening_hours (boolean), time_verified (boolean), starts_at y ends_at (ISO 8601 con zona explícita o null), duration_minutes (entero). En recintos/eventos verifica ventana de apertura y cierre para el día propuesto, y que permita llegar y disfrutar el plan. En flexible requires_opening_hours=false, starts_at=null y ends_at=null. Encuentra hasta 2 planes concretos, actuales y distintos. Si vibe no es surprise_me, adapta ambos a ese tipo. Si no puedes verificar un dato, no lo inventes.`,
  max_output_tokens:2000
 })});
 const out=await rr.json();
 if(!rr.ok)return json({error:out?.error?.code??"openai_error",message:out?.error?.message??"No se pudieron buscar planes."},502);
 let textOut=String(out?.output_text??"").trim();
 let annotations:any[]=[];
 if(Array.isArray(out?.output)){
   for(const item of out.output){
     if(item?.type==="message"&&Array.isArray(item.content)){
       for(const c of item.content){
         if(c?.type==="output_text"){
           if(!textOut) textOut+=String(c.text??"");
           if(Array.isArray(c.annotations))annotations.push(...c.annotations);
         }
       }
     }
   }
 }
 const sources=annotations.filter((a:any)=>a?.type==="url_citation"&&(a?.url||a?.url_citation?.url)).map((a:any)=>({url:a.url||a.url_citation?.url,title:a.title||a.url_citation?.title||a.url||a.url_citation?.url})).filter((x:any,i:number,arr:any[])=>arr.findIndex(y=>y.url===x.url)===i).slice(0,8);
 let parsed:any=null;
 try{parsed=JSON.parse(textOut.replace(/^```json\\s*/i,"").replace(/```$/,"").trim())}catch{}
 const plans=Array.isArray(parsed?.plans)?parsed.plans.slice(0,2).map((p:any,i:number)=>({title:String(p?.title??"Plan"),category:String(p?.category??vibe),vibe:String(p?.vibe??""),description:String(p?.description??""),why:String(p?.why??""),when:String(p?.when??""),source_title:String(p?.source_title??sources[i]?.title??"Fuente"),source_url:String(p?.source_url??sources[i]?.url??""),timing_kind:p?.timing_kind,requires_opening_hours:p?.requires_opening_hours,time_verified:p?.time_verified,starts_at:p?.starts_at,ends_at:p?.ends_at,duration_minutes:p?.duration_minutes})):[];
 const currentPlans=availablePlans(plans,new Date(),intent==='today_plan',timezone);
 return json({intro:currentPlans.length?String(parsed?.intro??""):"No he encontrado un plan con horario verificable que siga siendo realizable. Prueba un plan en casa u otro ritmo.",plans:currentPlans,sources,intent,vibe,city:city||null,local_date:localDate});
});
