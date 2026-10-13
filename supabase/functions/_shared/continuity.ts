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
 const erased=data.memories.filter((m:any)=>m.structured_data?.erased_at);
 const erasedIds=new Set(erased.map((m:any)=>m.id));
 const erasedMessages=new Set(erased.map((m:any)=>m.source_message_id).filter(Boolean));
 const erasedConversations=new Set(data.sources.filter((m:any)=>erasedMessages.has(m.id)).map((m:any)=>m.conversation_id));
 for(const use of data.memoryUses||[])if(use.memory_ids.some((id:string)=>erasedIds.has(id)))erasedConversations.add(use.conversation_id);
 const erasedSource=(x:any)=>erasedMessages.has(x.source_message_id)||erasedConversations.has(data.sources.find((m:any)=>m.id===x.source_message_id)?.conversation_id);
 const erasedEvents=new Set([...erased.map((m:any)=>m.source_event_id),...data.agenda.filter(erasedSource).map((a:any)=>a.id)].filter(Boolean));
 const erasedSituations=new Set([...data.situations.filter(erasedSource).map((s:any)=>s.id),...data.agenda.filter((a:any)=>erasedEvents.has(a.id)).map((a:any)=>a.situation_id)].filter(Boolean));
 const erasedGoals=new Set(data.agenda.filter((a:any)=>erasedEvents.has(a.id)).map((a:any)=>a.goal_id).filter(Boolean));
 const erasedCommitments=new Set(data.agenda.filter((a:any)=>erasedEvents.has(a.id)).map((a:any)=>a.commitment_id).filter(Boolean));
 const tainted=(x:any)=>blockedMessages.has(x.source_message_id)||blockedConversations.has(data.sources.find((m:any)=>m.id===x.source_message_id)?.conversation_id);
 // Operational facts survive memory withdrawal. Repeated withdrawn text does not.
 const forbidden=[...blocked.filter((m:any)=>m.user_validation!=='corrected').map((m:any)=>m.content),
  ...(data.revisions||[]).filter((r:any)=>blockedMemoryIds.has(r.memory_id)).map((r:any)=>r.before_data?.content),
  ...data.reviews.filter((r:any)=>blocked.some((m:any)=>m.structured_data?.review_id===r.id)).map((r:any)=>r.learning)].filter(Boolean).map((s:string)=>s.trim().toLocaleLowerCase());
 const declared=(text:any)=>typeof text==='string'&&!forbidden.some((s:string)=>text.toLocaleLowerCase().includes(s))?text:null;
 const latest=[...new Map(data.reviews.slice().sort((a:any,b:any)=>new Date(a.created_at).getTime()-new Date(b.created_at).getTime()).map((r:any)=>[r.event_id,r])).values()] as any[];
 return {
  memories:eligibleMemories(data.memories).filter((m:any)=>!erasedSource(m)&&!erasedEvents.has(m.source_event_id)).filter((m:any)=>m.user_validation==='corrected'||(!blockedMemoryIds.has(m.id)&&(m.structured_data?.review_id||(!blockedMessages.has(m.source_message_id)&&!blockedEvents.has(m.source_event_id))))).map((m:any)=>({id:m.id,updated_at:m.updated_at,content:m.content,life_area:m.life_area,epistemic_type:m.structured_data?.epistemic_type||'user_validated',scope:m.structured_data?.scope||'declared',source_message_id:m.source_message_id,source_event_id:m.source_event_id})),
  history:data.history.filter((m:any)=>!blockedConversations.has(m.conversation_id)&&!blockedMessages.has(m.id)),
  situations:data.situations.map((s:any)=>({id:s.id,title:erasedSituations.has(s.id)?'Asunto personal':declared(s.title)||'Asunto personal',life_area:s.life_area,status:s.status,summary:s.summary_needs_review||tainted(s)||erasedSituations.has(s.id)?null:declared(s.summary),summary_needs_review:Boolean(s.summary_needs_review||tainted(s))})),
  goals:data.goals.map((g:any)=>({id:g.id,title:erasedGoals.has(g.id)||erasedSituations.has(g.situation_id)?null:declared(g.title),status:g.status,progress_state:g.progress_state,situation_id:g.situation_id,life_area:g.life_area})),
  commitments:data.commitments.map((c:any)=>({id:c.id,what:erasedSource(c)||erasedCommitments.has(c.id)?null:declared(c.what),why:tainted(c)||erasedCommitments.has(c.id)?null:declared(c.why),status:c.status,situation_id:c.situation_id,goal_id:c.goal_id})),
  agenda:data.agenda.map((a:any)=>({id:a.id,title:erasedEvents.has(a.id)?null:declared(a.title),status:a.status,scheduled_start:a.scheduled_start,situation_id:a.situation_id,goal_id:a.goal_id,commitment_id:a.commitment_id,life_area:a.life_area,notes:tainted(a)||erasedEvents.has(a.id)?null:declared(a.notes),source_url:a.source_url})),
  reviews:latest.map((r:any)=>({event_id:r.event_id,status:r.status,result_note:erasedEvents.has(r.event_id)?null:declared(r.result_note),next_step:erasedEvents.has(r.event_id)||hasWithdrawnStep(r,data.reviews,data.memories)?null:declared(r.next_step),next_step_excluded:erasedEvents.has(r.event_id)||hasWithdrawnStep(r,data.reviews,data.memories),rescheduled_start:r.rescheduled_start,created_at:r.created_at})),
  allowLegacy:blocked.length===0
 };
}
