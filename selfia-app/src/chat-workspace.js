// Requests belong to an account and a context, never to whichever screen is visible later.
export function createChatWorkspace(storage) {
  // Goal/action identity stays stable when their subject link is established later.
  const routeFor=(area,link)=>JSON.stringify([area,link.commitment_id||link.goal_id?null:link.situation_id||null,link.commitment_id?null:link.goal_id||null,link.commitment_id||null]);
  let owner = null, active = '', epoch = 0;
  let contexts = new Map();
  const blank = (area = '', link = {}) => ({area, link, conv:null, messages:[], draft:'', busy:false, pending:null});
  const persist = () => {
    if (!storage || !owner) return;
    try { storage.setItem('selfia-chat-'+owner, JSON.stringify([...contexts].map(([k,v]) => [k,{...v,busy:false}]))); } catch {}
  };
  return {
    setOwner(id) {
      if (id === owner) return;
      this.clear(); owner = id;
      try { contexts = new Map(JSON.parse(storage?.getItem('selfia-chat-'+id) || '[]')); } catch { contexts = new Map(); }
      for(const state of contexts.values())if(state.link.goal_id||state.link.commitment_id||!state.route)state.route=routeFor(state.area,state.link);
    },
    clear() { if (owner) storage?.removeItem('selfia-chat-'+owner); owner=null; contexts.clear(); active=''; epoch++; },
    open(area='',link={situation_id:null,goal_id:null},fresh=false,initialDraft='') {
      const route=routeFor(area,link);
      active=fresh ? route+crypto.randomUUID() : [...contexts].reverse().find(([key,value])=>value.route===route)?.[0]||route;
      if (!contexts.has(active)) {contexts.set(active, {...blank(area,link),route,draft:initialDraft});persist();}
      else {if(link.situation_id||link.goal_id||link.commitment_id)contexts.get(active).link={...link};persist();}
      return contexts.get(active);
    },
    current() { return contexts.get(active); },
    patch(change) { Object.assign(this.current(),change); persist(); return this.current(); },
    begin(content) {
      const state=this.current(); if (state.busy) return null;
      if (state.pending?.content !== content) state.pending={content,request_id:crypto.randomUUID()};
      state.busy=true; persist();
      return {key:active,epoch,owner,request:{...state.pending},state:{...state,link:{...state.link}}};
    },
    complete(ticket,data) {
      if (ticket.epoch!==epoch || ticket.owner!==owner) return false;
      const state=contexts.get(ticket.key); if (!state) return false;
      state.conv={id:data.conversation_id};
      if (data.situation?.id) state.link={...state.link,situation_id:data.situation.id};
      state.messages=[...state.messages,{role:'user',content:ticket.request.content,id:ticket.request.request_id},
        {role:'assistant',content:data.reply,id:data.source_message_id,turn:data}];
      if (state.draft.trim()===ticket.request.content) state.draft='';
      state.pending=null; state.busy=false; persist(); return active===ticket.key;
    },
    fail(ticket) {
      if (ticket.epoch!==epoch || ticket.owner!==owner) return false;
      const state=contexts.get(ticket.key); if (state) state.busy=false; persist(); return active===ticket.key;
    },
    accepted(messageId,commitmentId) {
      for (const state of contexts.values()) state.messages=state.messages.map(m=>m.turn?.source_message_id===messageId?{...m,accepted:true,commitment_id:commitmentId}:m);
      persist();return this.current();
    }
  };
}
export function voiceTranscript(results, base='') {
  // The recognition result list retains previous finals; resultIndex only marks changed entries.
  return [base,...Array.from(results,result=>result[0]?.transcript||'')].join(' ').trim();
}
