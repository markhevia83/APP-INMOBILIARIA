import {createClient} from "npm:@supabase/supabase-js@2.57.4";
import {loadContext} from "../_shared/load-context.ts";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,"content-type":"application/json"}});
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({error:"method_not_allowed"},405);
 const auth=req.headers.get("Authorization");if(!auth)return json({error:"unauthorized"},401);
 const sb=createClient(Deno.env.get("SUPABASE_URL")??"",Deno.env.get("SUPABASE_ANON_KEY")??"",{global:{headers:{Authorization:auth}}});
 const {data:{user},error}=await sb.auth.getUser(auth.replace(/^Bearer\s+/,""));
 if(error||!user)return json({error:"unauthorized"},401);
 try{const c=await loadContext(sb,user.id);return json({profile:c.profile,profile_items:c.profileItems,confirmed_memories:c.memories,open_situations:c.situations,pending_commitments:c.commitments,validated_hypotheses:c.hypotheses,agenda:c.agenda,goals:c.goals,recent_results:c.reviews,epistemic_notice:"Single-attempt outcomes and user declarations are not independently verified traits."})}catch{return json({error:"context_unavailable"},503)}
});

