import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {continuityContext} from '../../supabase/functions/_shared/continuity.ts';
import {loadContext} from '../../supabase/functions/_shared/load-context.ts';
import {futureSchedule,areaSummary} from '../src/continuity.js';
import {availablePlans} from '../../supabase/functions/_shared/plan-timing.ts';
import {build} from 'esbuild';
import {renderToStaticMarkup} from 'react-dom/server';
import React from 'react';
const empty=()=>({memories:[],sources:[],history:[],situations:[],commitments:[],agenda:[],goals:[],reviews:[],memoryUses:[],revisions:[]});
test('today plans reject closed venues, elapsed events and insufficient visit time',()=>{
 const now=new Date('2026-10-08T18:44:00Z');
 const closed={title:'Museo cerrado',source_url:'https://example.test/',timing_kind:'open_window',requires_opening_hours:true,time_verified:true,starts_at:'2026-10-08T08:00:00Z',ends_at:'2026-10-08T18:00:00Z',duration_minutes:60};
 const short={...closed,title:'Queda poco tiempo',ends_at:'2026-10-08T19:30:00Z'};
 const future={...closed,title:'Abierto esta noche',ends_at:'2026-10-08T21:00:00Z'};
 const flexible={title:'Plan en casa',source_url:'https://example.test/',timing_kind:'flexible',requires_opening_hours:false};
 const event={...future,title:'Evento empezado',timing_kind:'fixed_event',starts_at:'2026-10-08T18:00:00Z'};
 const unknown={...future,title:'Horario sin verificar',time_verified:false};
 assert.deepEqual(availablePlans([closed,short,future,flexible,event,unknown,{...flexible,requires_opening_hours:true}],now).map(p=>p.title),['Abierto esta noche','Plan en casa']);
});
test('chat renders emphasis and lists, escapes HTML, and keeps internal IDs out of display',async()=>{
 const result=await build({entryPoints:['src/ChatText.jsx'],bundle:true,platform:'node',format:'esm',write:false});
 const {ChatText}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
 const html=renderToStaticMarkup(React.createElement(ChatText,{text:'**Preparar** una frase\n\n- Paso uno\n- Paso dos\n\n<img src=x onerror=alert(1)> 10000000-0000-4000-8000-000000000001'}));
 assert.match(html,/<strong>Preparar<\/strong>/);assert.match(html,/<ul><li>Paso uno<\/li>/);assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('10000000-0000-4000-8000-000000000001'));
});
test('withdrawal retains latest independent result and schedule, excludes old learning and derived summaries',()=>{
 const d=empty();
 d.memories=[{id:'m',status:'do_not_store',user_validation:'rejected',content:'La maceta azul me ayudó',source_event_id:'a',structured_data:{review_id:'r1'}}];
 d.sources=[{id:'msg',conversation_id:'c'}];d.memoryUses=[{conversation_id:'c',memory_ids:['m']}];
 d.history=[{id:'msg',conversation_id:'c',content:'Usa la maceta azul'}];
 d.situations=[{id:'s',title:'Huerto',summary:'Usa la maceta azul',source_message_id:'msg'}];
 d.goals=[{id:'g',title:'Sembrar',situation_id:'s'}];
 d.agenda=[{id:'a',title:'Comprar semillas',status:'planned',scheduled_start:'2026-10-12T14:30:00Z',situation_id:'s',goal_id:'g',source_message_id:'msg',notes:'Usa la maceta azul'}];
 d.reviews=[{id:'r1',event_id:'a',status:'partially_done',learning:'La maceta azul me ayudó',result_note:'Antiguo resultado',created_at:'2026-10-07'}, {id:'r2',event_id:'a',status:'moved',result_note:'La tienda estaba cerrada',rescheduled_start:'2026-10-12T14:30:00Z',created_at:'2026-10-08'}];
 const c=continuityContext(d);
 assert.equal(c.agenda[0].scheduled_start,'2026-10-12T14:30:00Z');assert.equal(c.goals[0].id,'g');
 assert.equal(c.reviews.length,1);assert.equal(c.reviews[0].result_note,'La tienda estaba cerrada');
 assert.equal(c.situations[0].summary,null);assert.equal(c.situations[0].summary_needs_review,true);
 assert.equal(c.agenda[0].notes,null);assert.ok(!JSON.stringify(c).includes('maceta azul'));assert.ok(!JSON.stringify(c).includes('Antiguo resultado'));
 d.memories[0]={...d.memories[0],status:'confirmed',user_validation:'corrected',content:'Me ayudó preguntar en la tienda'};
 d.revisions=[{memory_id:'m',before_data:{content:'La maceta azul me ayudó'}}];
 const corrected=continuityContext(d);assert.equal(corrected.memories[0].content,'Me ayudó preguntar en la tienda');assert.equal(corrected.reviews[0].result_note,'La tienda estaba cerrada');
});
test('withdrawn learning cannot survive as a differently worded next-step recommendation',()=>{
 const d=empty();d.memories=[{id:'m',status:'do_not_store',user_validation:'rejected',content:'Me ayudó una maceta azul junto a la puerta',source_event_id:'a',structured_data:{review_id:'r'}}];
 d.agenda=[{id:'a',title:'Sembrar albahaca',scheduled_start:'2026-10-12T14:30:00Z'}];
 d.reviews=[{id:'r',event_id:'a',status:'partially_done',learning:'Me ayudó una maceta azul junto a la puerta',result_note:'Solo preparé la tierra',next_step:'Colocar la maceta azul en la entrada y reutilizarla',created_at:'2026-10-08'}];
 const c=continuityContext(d);assert.equal(c.reviews[0].result_note,'Solo preparé la tierra');assert.equal(c.reviews[0].next_step,null);assert.ok(!JSON.stringify(c).includes('maceta azul'));
 d.reviews.push({id:'r2',event_id:'a',supersedes_id:'r',status:'partially_done',result_note:'Contexto corregido sin aprendizaje',next_step:d.reviews[0].next_step,created_at:'2026-10-09'});
 const later=continuityContext(d);assert.equal(later.reviews[0].next_step,null);assert.equal(later.reviews[0].result_note,'Contexto corregido sin aprendizaje');assert.ok(!JSON.stringify(later).includes('maceta azul'));
});
test('selected old subject recovers events and results beyond general pages using owner-scoped queries',async()=>{
 const calls=[];const tables={profiles:[],profile_items:[],messages:[],situations:[{id:'s',user_id:'owner',status:'open',title:'Huerto'}],commitments:[],hypotheses:[],people:[],agenda_events:Array.from({length:40},(_,i)=>({id:'e'+i,user_id:'owner',situation_id:i===39?'s':'other',scheduled_start:new Date(2030,0,40-i).toISOString()})),goals:[{id:'g',user_id:'owner',situation_id:'s',status:'active'}],action_reviews:Array.from({length:40},(_,i)=>({id:'r'+i,user_id:'owner',event_id:'e'+i,status:'moved',result_note:i===39?'La tienda estaba cerrada':'Otro asunto',created_at:new Date(2030,0,40-i).toISOString()})),memories:[],turn_receipts:[],memory_revisions:[]};
 const sb={from(table){const filters=[],orders=[];let limit=Infinity,start=0,single=false;
  const q={select(){return q},eq(k,v){filters.push(x=>x[k]===v);return q},in(k,v){filters.push(x=>v.includes(x[k]));return q},order(k,{ascending=true}={}){orders.push([k,ascending]);return q},limit(n){limit=n;return q},range(a,b){start=a;limit=b-a+1;return q},overlaps(k,v){filters.push(x=>(x[k]||[]).some(id=>v.includes(id)));return q},maybeSingle(){single=true;return q},then(resolve){calls.push({table,ownerFiltered:filters.some(f=>!f({user_id:'outsider'}))});let rows=tables[table].filter(x=>filters.every(f=>f(x)));for(const[k,asc]of orders)rows.sort((a,b)=>String(a[k]).localeCompare(String(b[k]))*(asc?1:-1));rows=rows.slice(start,start+limit);return Promise.resolve({data:single?rows[0]||null:rows}).then(resolve)}};return q}};
 const c=await loadContext(sb,'owner',null,null,'g');assert.equal(c.selectedSituation,'s');assert.ok(c.agenda.some(a=>a.id==='e39'));assert.ok(c.reviews.some(r=>r.event_id==='e39'&&r.result_note==='La tienda estaba cerrada'));assert.ok(calls.every(x=>x.ownerFiltered));
 tables.action_reviews[0].next_step='Reutilizar objeto retirado';tables.action_reviews[0].supersedes_id='ancestor';
 tables.action_reviews.push({id:'ancestor',user_id:'owner',event_id:'e0',next_step:'Reutilizar objeto retirado',learning:'Declaración retirada',created_at:'1980-01-01'});
 tables.memories.push({id:'m',user_id:'owner',status:'do_not_store',user_validation:'rejected',content:'Declaración retirada',structured_data:{review_id:'ancestor'}});
 const general=await loadContext(sb,'owner');assert.equal(general.reviews.find(r=>r.event_id==='e0').next_step,null);assert.equal(general.reviews.find(r=>r.event_id==='e0').next_step_excluded,true);
});
test('summary invalidation is traceable and RLS isolated; plan sources persist and reject unsafe URLs',async()=>{
 const db=new PGlite(),uid='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002';
 try{
  for(const p of ['./baseline.sql','../../supabase/migrations/20261006142249_continuity_cycle.sql','../../supabase/migrations/20261008143624_astra_continuity_repairs.sql','../../supabase/migrations/20261008182709_audit_followup_context.sql'])await db.exec(await readFile(new URL(p,import.meta.url),'utf8'));
  await db.exec(`insert into auth.users values ('${uid}'),('${other}');set role authenticated;`);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);
  const val=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
  const cid=await val("insert into conversations(user_id) values($1) returning id",[uid]);
  const msg=await val("insert into messages(user_id,conversation_id,role,content) values($1,$2,'user','Huerto') returning id",[uid,cid]);
  const sid=await val("insert into situations(user_id,title,summary,source_message_id) values($1,'Huerto','Usar maceta azul',$2) returning id",[uid,msg]);
  const mid=await val("insert into memories(user_id,memory_type,content,status,user_validation,source_message_id) values($1,'conversation_note','Maceta azul','confirmed','confirmed',$2) returning id",[uid,msg]);
  await db.query("update memories set status='do_not_store',user_validation='rejected' where id=$1",[mid]);
  assert.equal(await val('select summary_needs_review from situations where id=$1',[sid]),true);
  assert.equal(await val('select summary from situation_summary_revisions'),'Usar maceta azul');
  assert.equal(await val('select summary from situations where id=$1',[sid]),'Usar maceta azul','history preserved rather than deleted');
  const event=await val("insert into agenda_events(user_id,title,scheduled_start,notes,source_url) values($1,'Paseo',now()+interval '1 day','Lugar y duración','https://example.test/plan') returning id",[uid]);
  assert.equal(await val('select source_url from agenda_events where id=$1',[event]),'https://example.test/plan');
  await assert.rejects(()=>db.query("update agenda_events set source_url='javascript:alert(1)' where id=$1",[event]),/agenda_source_https/);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[other]);assert.equal(await val('select count(*)::int from situation_summary_revisions'),0);
  await assert.rejects(()=>db.query("insert into situation_summary_revisions(user_id,situation_id,memory_id) values($1,$2,$3)",[other,sid,mid]),/linked_record_not_found/);
 }finally{await db.close()}
});
test('future suggestions cross midnight and moved corrections do not reuse an old completion in trend',()=>{
 const n=new Date(2026,9,8,23,45);const f=futureSchedule(n);assert.equal(f.date,'2026-10-09');assert.equal(f.time,'00:45');assert.ok(new Date(f.date+'T'+f.time)>n);
 const now=new Date('2026-10-28T12:00:00Z');const agenda=['a','b','c','d'].map(id=>({id,life_area:'work'}));
 const reviews=[{event_id:'a',status:'done',created_at:'2026-10-03'},{event_id:'b',status:'done',created_at:'2026-10-04'},{event_id:'c',status:'not_done',created_at:'2026-10-25'},{event_id:'d',status:'not_done',created_at:'2026-10-26'},{event_id:'a',status:'moved',created_at:'2026-10-27'}];
 assert.equal(areaSummary('work',{situations:[],goals:[],agenda,reviews},now).trend,'Sin información suficiente');
});
