export function independentProfileItems(items:any[]) {
 return items.filter(item=>item.active===true && item.epistemic_type==='user_declared' && item.user_validation==='confirmed' &&
  !item.source_message_id && item.provenance?.origin==='explicit_profile_declaration' &&
  typeof item.provenance.request_id==='string' && Array.isArray(item.provenance.memory_dependencies) && item.provenance.memory_dependencies.length===0);
}
export function eligiblePlanProposals(plans:any[],sources:any[]) {
 // A citation proves which source was used, not that a model verified its opening hours.
 return plans.filter(plan=>plan.timing_kind==='flexible' && plan.requires_opening_hours===false &&
  sources.some(source=>source.url===plan.source_url && /^https:\/\//.test(source.url)));
}
