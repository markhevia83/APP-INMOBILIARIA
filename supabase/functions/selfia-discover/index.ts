import {safeAiError} from '../_shared/ai-errors.ts';
import {limitedAiFetch} from '../_shared/ai-request.ts';
import {eligiblePlanProposals} from '../_shared/profile-provenance.ts';
import {availablePlans} from '../_shared/plan-timing.ts';
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
 const intent=String(body.intent??"weekend_plan");
 const vibe=String(body.vibe??"surprise_me").trim();
 const city=String(body.city??"").trim();
 const country=String(body.country??"España").trim();
 if(!["today_plan","weekend_plan"].includes(intent)||!["tranquilo","movido","social","casa","noche","surprise_me"].includes(vibe)||city.length>120||country.length>80)return json({error:"invalid_input"},400);
 const now=new Date();let timezone='Europe/Madrid';
 try{if(body.timezone){new Intl.DateTimeFormat('es-ES',{timeZone:body.timezone}).format(now);timezone=body.timezone}}catch{}
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const part=(kind:string)=>parts.find(p=>p.type===kind)?.value;
 const localDate=part('year')+'-'+part('month')+'-'+part('day');
 const localTime=new Intl.DateTimeFormat('es-ES',{timeZone:timezone,timeStyle:'short'}).format(now);
 const apiKey=Deno.env.get("OPENAI_API_KEY")??Deno.env.get("openai_api_key");
 if(!apiKey)return json({error:"ai_not_configured"},503);

 const instructions=`Eres SELF-IA. Busca en internet planes, estrenos o contenidos REALES y ACTUALES que puedan encajar con la persona.
Tu objetivo es bienestar, disfrute, curiosidad y conexión social razonable; no terapia.
No inventes eventos, horarios, estrenos, trailers ni enlaces. Si no encuentras algo verificable, dilo.
Utiliza exclusivamente la ciudad y el tipo de plan de esta búsqueda. No conoces el perfil, las conversaciones ni las memorias de esta persona.
Prioriza opciones cercanas si hay ciudad. Si no hay ciudad, ofrece propuestas que no dependan de ubicación.
Para cine, puedes sugerir un estreno actual y enlazar a trailer o fuente fiable.
Para planes, intenta incluir al menos una opción de baja fricción y una algo más activa/social.
Sé breve y natural, y explica cada propuesta por el tipo de plan solicitado.
Fecha y hora ACTUALES verificadas por el servidor: ${localDate}, ${localTime}, zona ${timezone}; instante UTC ${now.toISOString()}.
Para today_plan ofrece únicamente planes realizables a partir de AHORA, dejando al menos 30 minutos para prepararse/desplazarse y tiempo suficiente para disfrutarlos antes del cierre. Nunca recomiendes esta tarde una visita que ya ha cerrado ni un evento empezado. Verifica horarios de hoy y fechas en la fuente oficial. Si está cerrado, busca otra opción, no cambies el día en silencio. Flexible sólo significa actividad sin entradas, cierre, reserva ni evento a hora fija (por ejemplo, casa o paseo libre). Si no puedes verificar el horario de un recinto/evento, exclúyelo.
Ciudad: ${city||"no indicada"}. País: ${country}. Intención: ${intent}. Tipo de plan pedido: ${vibe}.
`;

 try{
 const rr=await limitedAiFetch(user.id,'discover',null,{method:"POST",headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json"},body:JSON.stringify({
  store:false,model:"gpt-5.6",
  reasoning:{effort:"low"},
  tools:[{type:"web_search"}],
  tool_choice:"required",
  instructions,
  input:`Devuelve SOLO JSON válido con esta forma exacta: {"intro":"frase breve","plans":[{"title":"...","category":"tranquilo|movido|social|casa|noche","vibe":"frase de 2-5 palabras","description":"2 frases claras","why":"por qué puede encajar","when":"cuándo/cuánto dura","source_title":"fuente","source_url":"https://..."}]}. Incluye en cada plan timing_kind (flexible|open_window|fixed_event), requires_opening_hours (boolean), time_verified (boolean), starts_at y ends_at (ISO 8601 con zona explícita o null), duration_minutes (entero). En recintos/eventos verifica ventana de apertura y cierre para el día propuesto, y que permita llegar y disfrutar el plan. En flexible requires_opening_hours=false, starts_at=null y ends_at=null. Encuentra hasta 2 planes concretos, actuales y distintos. Durante esta prueba solo devuelve planes flexible sin dependencia de horarios de recintos ni eventos; si no hay ninguno, devuelve plans=[]. Si vibe no es surprise_me, adapta ambos a ese tipo. Si no puedes verificar un dato, no lo inventes.`,
  max_output_tokens:2000
 })});
 const out=await rr.json();
 if(!rr.ok){const failure=safeAiError(rr.status,out?.error?.code);return json(failure,failure.status);}
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
 const checkedAt=new Date();
 const candidates=eligiblePlanProposals(availablePlans(plans,checkedAt,intent==='today_plan',timezone),sources);
 let currentPlans:any[]=[];
 if(candidates.length){
  const serverKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!serverKey)return json({error:'plan_persistence_unavailable'},503);
  const server=createClient(Deno.env.get('SUPABASE_URL')??'',serverKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const expiresAt=new Date(checkedAt.getTime()+30*60000).toISOString();
  const rows=candidates.map((p:any)=>({user_id:user.id,payload:p,timezone,local_date:localDate,checked_at:checkedAt.toISOString(),expires_at:expiresAt,source_evidence:{kind:'web_citation',url:p.source_url,title:sources.find((s:any)=>s.url===p.source_url)?.title}}));
  const{data:saved,error}=await server.from('plan_proposals').insert(rows).select('id,payload,checked_at,expires_at');
  if(error||!saved)return json({error:'plan_persistence_failed'},503);
  currentPlans=saved.map((row:any)=>({...row.payload,proposal_id:row.id,checked_at:row.checked_at,expires_at:row.expires_at}));
 }
 return json({intro:currentPlans.length?String(parsed?.intro??""):"No he encontrado una propuesta con fuente que pueda guardarse ahora. Los planes con horarios de recintos o eventos siguen pendientes de verificación. Prueba un plan en casa u otro ritmo.",plans:currentPlans,sources,intent,vibe,city:city||null,local_date:localDate});
 }catch{return json({error:'ai_response_failed',message:'No se pudo completar la respuesta. Inténtalo más tarde.'},502)}
});
