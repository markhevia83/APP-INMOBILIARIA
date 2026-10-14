// Account-scoped, tab-local draft and request identity. Never reset terminal retries on reload.
export function createOnboardingRequests(storage){
 let owner=null,epoch=0,state={draft:'',hasDraft:false,pending:null};
 const persist=()=>{if(owner)try{storage?.setItem('selfia-onboarding-'+owner,JSON.stringify(state))}catch{}};
 const valid=t=>t.owner===owner&&t.epoch===epoch;
 return {
  setOwner(id){if(id===owner)return;this.clear();owner=id;try{const saved=JSON.parse(storage?.getItem('selfia-onboarding-'+id)||'null');if(saved&&typeof saved.draft==='string'&&typeof saved.hasDraft==='boolean'){state={draft:saved.draft,hasDraft:saved.hasDraft,pending:saved.pending&&typeof saved.pending.content==='string'&&/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(saved.pending.request_id)?{content:saved.pending.content,request_id:saved.pending.request_id,...(saved.pending.terminalReason==='retry_limit'?{terminalReason:'retry_limit'}:{})}:null}}}catch{}},
  clear(){if(owner)storage?.removeItem('selfia-onboarding-'+owner);owner=null;epoch++;state={draft:'',hasDraft:false,pending:null}},
  snapshot(){return {...state,pending:state.pending?{...state.pending}:null}},
  setDraft(draft){state.draft=draft;state.hasDraft=true;persist()},
  begin(content){if(!owner)throw Error('missing_owner');if(state.pending?.content!==content)state.pending={content,request_id:crypto.randomUUID()};if(state.pending.terminalReason==='retry_limit')return null;persist();return {owner,epoch,request:{content,request_id:state.pending.request_id}}},
  complete(t){if(!valid(t))return false;if(state.pending?.request_id===t.request.request_id){if(state.draft.trim()===t.request.content){state.draft='';state.hasDraft=false}state.pending=null;persist()}return true},
  fail(t,code){if(!valid(t))return false;if(code==='retry_limit'&&state.pending?.request_id===t.request.request_id){state.pending.terminalReason='retry_limit';persist()}return true},
  valid
 };
}
