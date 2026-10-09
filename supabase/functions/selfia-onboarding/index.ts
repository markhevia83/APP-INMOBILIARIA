import { createClient } from "npm:@supabase/supabase-js@2.57.4";
const corsHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...corsHeaders,"content-type":"application/json"}});
const dims=[
 ["priorities","Ahora mismo, ¿qué cosas son realmente importantes para ti en tu vida?"],
 ["enjoyment","¿Qué cosas hacen que disfrutes de verdad o sientas que el día ha merecido la pena?"],
 ["distress","¿Qué situaciones te pesan más o te hacen pasarlo mal últimamente?"],
 ["boundaries","¿Qué cosas puedes tolerar durante un tiempo y cuáles sientes que cruzan una línea para ti?"],
 ["decisions","Cuando tienes que tomar una decisión importante, ¿cómo sueles hacerlo?"],
 ["conflict","Cuando aparece un conflicto con alguien importante para ti, ¿qué tiendes a hacer?"],
 ["change","¿Cómo llevas normalmente los cambios y la incertidumbre?"],
 ["concerns","¿Hay algo que te preocupe especialmente en este momento?"],
 ["aspirations","Si las cosas fueran bien durante los próximos meses, ¿qué te gustaría que hubiera cambiado o avanzado?"],
 ["people","¿Quiénes son las personas que más peso tienen ahora mismo en tu vida?"],
 ["style","Y conmigo, ¿cómo prefieres que sea? Por ejemplo: muy directo, más suave, que te cuestione, que use humor, que tome iniciativa..."]
] as const;
Deno.serve(async(req)=>{ if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
 if(req.method!=="POST") return json({error:"method_not_allowed"},405);
 const auth=req.headers.get("Authorization"); if(!auth) return json({error:"unauthorized"},401);
 const token=auth.replace(/^Bearer\s+/,"");
 const sb=createClient(Deno.env.get("SUPABASE_URL")??"",Deno.env.get("SUPABASE_ANON_KEY")??"",{global:{headers:{Authorization:auth}}});
 const {data:{user}}=await sb.auth.getUser(token); if(!user) return json({error:"unauthorized"},401);
 const body=await req.json().catch(()=>({})); const action=body.action??"start";
 if(action==="start"){
   let {data:s}=await sb.from("onboarding_sessions").select("*").eq("user_id",user.id).eq("status","in_progress").order("started_at",{ascending:false}).limit(1).maybeSingle();
   if(!s){
     const {data:c,error:ce}=await sb.from("conversations").insert({user_id:user.id,kind:"onboarding",title:"Conocernos"}).select().single(); if(ce) return json({error:ce.message},400);
     const {data:ns,error:se}=await sb.from("onboarding_sessions").insert({user_id:user.id,conversation_id:c.id,current_dimension:dims[0][0]}).select().single(); if(se)return json({error:se.message},400); s=ns;
     await sb.from("profiles").upsert({user_id:user.id,onboarding_status:"in_progress"},{onConflict:"user_id"});
   }
   const idx=Math.max(0,dims.findIndex(d=>d[0]===s.current_dimension));
   return json({session_id:s.id,conversation_id:s.conversation_id,progress:{covered:s.dimensions_covered,total:dims.length},assistant_message:idx===0?"Antes de empezar quiero conocerte un poco. No es un test y no hay respuestas correctas. Quiero entender qué es importante para ti, cómo sueles afrontar las cosas y qué esperas de mí. Puedes saltártelo cuando quieras.\n\n"+dims[idx][1]:dims[idx][1]});
 }
 if(action==="answer"){
   const {session_id,content}=body; if(!session_id||typeof content!=="string"||!content.trim()) return json({error:"invalid_input"},400);
   const {data:s}=await sb.from("onboarding_sessions").select("*").eq("id",session_id).eq("user_id",user.id).single(); if(!s)return json({error:"session_not_found"},404);
   const dim=s.current_dimension; const idx=dims.findIndex(d=>d[0]===dim);
   const {data:m,error:me}=await sb.from("messages").insert({user_id:user.id,conversation_id:s.conversation_id,role:"user",content:content.trim()}).select().single(); if(me)return json({error:me.message},400);
   const draft={...(s.draft_profile??{}),[dim]:[...((s.draft_profile??{})[dim]??[]),content.trim()]};
   const covered=Array.from(new Set([...(s.dimensions_covered??[]),dim]));
   const next=idx+1;
   if(next>=dims.length){
     await sb.from("onboarding_sessions").update({status:"review",current_dimension:null,dimensions_covered:covered,draft_profile:draft,turn_count:s.turn_count+1}).eq("id",s.id);
     await sb.from("profiles").upsert({user_id:user.id,onboarding_status:"review",base_profile:draft},{onConflict:"user_id"});
     return json({status:"review",draft_profile:draft,review_message:"Esto es lo que he entendido de ti hasta ahora. Quiero que lo revises: no lo trataré como una verdad absoluta, sino como lo que tú me has contado sobre ti. Puedes confirmar o cambiar cualquier parte."});
   }
   await sb.from("onboarding_sessions").update({current_dimension:dims[next][0],dimensions_covered:covered,draft_profile:draft,turn_count:s.turn_count+1}).eq("id",s.id);
   return json({status:"in_progress",progress:{covered:covered.length,total:dims.length},assistant_message:dims[next][1]});
 }
 if(action==="validate"){
   const {session_id,profile}=body; if(!session_id||!profile||typeof profile!=="object")return json({error:"invalid_input"},400);
   const {data:s}=await sb.from("onboarding_sessions").select("*").eq("id",session_id).eq("user_id",user.id).single(); if(!s)return json({error:"session_not_found"},404);
   const now=new Date().toISOString();
   const {error:pe}=await sb.from("profiles").upsert({user_id:user.id,onboarding_status:"completed",base_profile:profile,validated_at:now,profile_version:1},{onConflict:"user_id"}); if(pe)return json({error:pe.message},400);
   await sb.from("onboarding_sessions").update({status:"completed",draft_profile:profile,completed_at:now}).eq("id",s.id);
   await sb.from("conversations").update({status:"closed",ended_at:now}).eq("id",s.conversation_id);
   return json({status:"completed",message:"Perfecto. Lo guardaré como tu punto de partida, sabiendo que puede cambiar y que podrás corregirlo cuando quieras."});
 }
 if(action==="skip"){
   const {session_id}=body; if(session_id) await sb.from("onboarding_sessions").update({status:"skipped",completed_at:new Date().toISOString()}).eq("id",session_id).eq("user_id",user.id);
   await sb.from("profiles").upsert({user_id:user.id,onboarding_status:"skipped"},{onConflict:"user_id"});
   return json({status:"skipped"});
 }
 return json({error:"unknown_action"},400);
});
