export function eligibleMemories(rows: any[]) {
 return rows.filter(m=>['confirmed','update'].includes(m.status)&&['confirmed','corrected'].includes(m.user_validation));
}
export function hasWithdrawnStep(review:any,reviews:any[],memories:any[]) {
 const seen=new Set();let current=review;
 while(current&&!seen.has(current.id)){
  seen.add(current.id);
  const declarations=memories.filter((m:any)=>m.structured_data?.review_id===current.id);
  if(declarations.some((m:any)=>['obsolete','do_not_store'].includes(m.status)||['rejected','corrected'].includes(m.user_validation)))return true;
  if(declarations.some((m:any)=>['confirmed','update'].includes(m.status)&&m.user_validation==='confirmed'))return false;
  const prior=reviews.find((r:any)=>r.id===current.supersedes_id);
  if(!prior||prior.next_step!==current.next_step)return false;
  current=prior;
 }
 return false;
}
export function continuityContext(data: any) {
 const blocked=data.memories.filter((m:any)=>['obsolete','do_not_store'].includes(m.status)||['rejected','corrected'].includes(m.user_validation));
 const blockedMessages=new Set(blocked.map((m:any)=>m.source_message_id).filter(Boolean));
 const blockedEvents=new Set(blocked.map((m:any)=>m.source_event_id).filter(Boolean));
 const blockedConversations=new Set(data.sources.filter((m:any)=>blockedMessages.has(m.id)).map((m:any)=>m.conversation_id));
 const blockedMemoryIds=new Set(blocked.map((m:any)=>m.id));
 for(const use of data.memoryUses||[])if(use.memory_ids.some((id:string)=>blockedMemoryIds.has(id)))blockedConversations.add(use.conversation_id);
 const tainted=(x:any)=>blockedMessages.has(x.source_message_id)||blockedConversations.has(data.sources.find((m:any)=>m.id===x.source_message_id)?.conversation_id);
 // Operational facts survive memory withdrawal. Repeated withdrawn text does not.
 const forbidden=[...blocked.filter((m:any)=>m.user_validation!=='corrected').map((m:any)=>m.content),
  ...(data.revisions||[]).filter((r:any)=>blockedMemoryIds.has(r.memory_id)).map((r:any)=>r.before_data?.content),
  ...data.reviews.filter((r:any)=>blocked.some((m:any)=>m.structured_data?.review_id===r.id)).map((r:any)=>r.learning)].filter(Boolean).map((s:string)=>s.trim().toLocaleLowerCase());
 const declared=(text:any)=>typeof text==='string'&&!forbidden.some((s:string)=>text.toLocaleLowerCase().includes(s))?text:null;
 const latest=[...new Map(data.reviews.slice().sort((a:any,b:any)=>new Date(a.created_at).getTime()-new Date(b.created_at).getTime()).map((r:any)=>[r.event_id,r])).values()] as any[];
 return {
  memories:eligibleMemories(data.memories).filter((m:any)=>m.user_validation==='corrected'||(!blockedMemoryIds.has(m.id)&&(m.structured_data?.review_id||(!blockedMessages.has(m.source_message_id)&&!blockedEvents.has(m.source_event_id))))).map((m:any)=>({id:m.id,updated_at:m.updated_at,content:m.content,life_area:m.life_area,epistemic_type:m.structured_data?.epistemic_type||'user_validated',scope:m.structured_data?.scope||'declared',source_message_id:m.source_message_id,source_event_id:m.source_event_id})),
  history:data.history.filter((m:any)=>!blockedConversations.has(m.conversation_id)&&!blockedMessages.has(m.id)),
  situations:data.situations.map((s:any)=>({id:s.id,title:declared(s.title)||'Asunto personal',life_area:s.life_area,status:s.status,summary:s.summary_needs_review||tainted(s)?null:declared(s.summary),summary_needs_review:Boolean(s.summary_needs_review||tainted(s))})),
  goals:data.goals.map((g:any)=>({id:g.id,title:declared(g.title),status:g.status,progress_state:g.progress_state,situation_id:g.situation_id,life_area:g.life_area})),
  commitments:data.commitments.map((c:any)=>({id:c.id,what:declared(c.what),why:tainted(c)?null:declared(c.why),status:c.status,situation_id:c.situation_id,goal_id:c.goal_id})),
  agenda:data.agenda.map((a:any)=>({id:a.id,title:declared(a.title),status:a.status,scheduled_start:a.scheduled_start,situation_id:a.situation_id,goal_id:a.goal_id,commitment_id:a.commitment_id,life_area:a.life_area,notes:tainted(a)?null:declared(a.notes),source_url:a.source_url})),
  reviews:latest.map((r:any)=>({event_id:r.event_id,status:r.status,result_note:declared(r.result_note),next_step:hasWithdrawnStep(r,data.reviews,data.memories)?null:declared(r.next_step),next_step_excluded:hasWithdrawnStep(r,data.reviews,data.memories),rescheduled_start:r.rescheduled_start,created_at:r.created_at})),
  allowLegacy:blocked.length===0
 };
}
