import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {build} from 'esbuild';
import {chromium} from '@playwright/test';
import {PGlite} from '@electric-sql/pglite';
import {continuityContext} from '../../supabase/functions/_shared/continuity.ts';
const uid='10000000-0000-4000-8000-000000000001';
await mkdir('test-results',{recursive:true});
const bundle=await build({entryPoints:['src/main.jsx'],bundle:true,write:false,loader:{'.css':'empty'},define:{'import.meta.env':JSON.stringify({VITE_SUPABASE_URL:'https://selfia-test.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'test-publishable',VITE_CONTINUITY_READY:'true'})}});
const code=bundle.outputFiles[0].text,css=await readFile('src/styles.css','utf8');
const server=createServer((req,res)=>{res.setHeader('content-type',req.url==='/app.js'?'text/javascript':req.url==='/style.css'?'text/css':'text/html');res.end(req.url==='/app.js'?code:req.url==='/style.css'?css:'<html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root"></div><script src="/app.js"></script></html>')});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
const db=new PGlite();await db.exec(await readFile('tests/baseline.sql','utf8'));await db.exec(await readFile('../supabase/migrations/20261006142249_continuity_cycle.sql','utf8'));await db.exec(await readFile('../supabase/migrations/20261008143624_astra_continuity_repairs.sql','utf8'));await db.exec(await readFile('../supabase/migrations/20261008182709_audit_followup_context.sql','utf8'));
await db.exec("insert into auth.users values ('"+uid+"');set role authenticated;");await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);
await db.query("insert into profiles(user_id,onboarding_status) values($1,'skipped')",[uid]);
const q=async(sql,args=[])=> (await db.query(sql,args)).rows;
const scalar=async(sql,args=[])=>Object.values((await q(sql,args))[0])[0];
const collect=async()=>{const data={};for(const [field,table] of Object.entries({memories:'memories',history:'messages',sources:'messages',situations:'situations',commitments:'commitments',agenda:'agenda_events',goals:'goals',reviews:'action_reviews',memoryUses:'turn_receipts',revisions:'memory_revisions'}))data[field]=await q('select * from '+table);return continuityContext(data)};
await db.exec('reset role');await db.exec(await readFile('../supabase/migrations/20261011161012_audit_integrity.sql','utf8'));await db.exec('reset role');await db.exec(await readFile('../supabase/migrations/20261011162101_audit_provenance_plans.sql','utf8'));await db.exec('set role authenticated');
await db.exec('reset role');await db.exec(await readFile('../supabase/migrations/20261011163621_audit_ai_operations.sql','utf8'));await db.exec(await readFile('../supabase/migrations/20261011164245_audit_privacy_requests.sql','utf8'));await db.exec('reset role');await db.exec(await readFile('../supabase/migrations/20261011174000_audit_schedule_coherence.sql','utf8'));await db.exec(await readFile('../supabase/migrations/20261011174800_audit_link_indexes.sql','utf8'));await db.exec('set role authenticated');
const rpcNames=new Set(['selfia_export_data','selfia_request_erasure','selfia_schedule_plan','selfia_declare_profile_item','selfia_create_agenda','selfia_onboarding_transition','selfia_accept_action','selfia_schedule_commitment','selfia_review_action','selfia_revise_memory','selfia_correct_review']);
let lastContext,realRequests=0,holdNextChat=false,chatHeld=false,releaseChat,failNextChat=null;
let chatGate;
let page;
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'msedge',headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Europe/Madrid'});
 let session={access_token:'eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({sub:uid,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.test',refresh_token:'synthetic-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user:{id:uid,email:'synthetic@example.test'}};
 await context.addInitScript(value=>{if(!localStorage.getItem('sb-selfia-test-auth-token'))localStorage.setItem('sb-selfia-test-auth-token',JSON.stringify(value))},session);
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.origin===base)return route.continue();
  if(url.hostname!=='selfia-test.supabase.co'){realRequests++;return route.fulfill({status:500,body:'Unexpected external request'})}
  try{
   const body=route.request().postDataJSON();let data;
   if(url.pathname.startsWith('/functions/v1/')){
    const slug=url.pathname.split('/').at(-1);
    if(slug==='selfia-onboarding'){const{request_id,action,...payload}=body;data=await scalar('select selfia_onboarding_transition($1,$2,$3)',[request_id,action,payload]);}
    else if(slug==='selfia-daily')data={message:'Datos sintéticos para verificar el ciclo.',cta:'Continuar',prompt:'Una cosa de hoy'};
    else if(slug==='selfia-discover'){
     const now=new Date(),expires=new Date(now.getTime()+30*60000),plan={title:'Paseo tranquilo de prueba',category:'tranquilo',description:'Una opción sintética para probar la agenda.',why:'Baja fricción',source_url:'https://example.test/plan',timing_kind:'flexible',requires_opening_hours:false};
     const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
     await db.exec('reset role');const id=await scalar('insert into plan_proposals(user_id,payload,timezone,local_date,checked_at,expires_at,source_evidence) values($1,$2,$3,$4,$5,$6,$7) returning id',[uid,plan,'Europe/Madrid',date,now.toISOString(),expires.toISOString(),{kind:'web_citation',url:plan.source_url}]);await db.exec('set role authenticated');
     data={intro:'Una opción de prueba',plans:[{...plan,proposal_id:id,checked_at:now.toISOString(),expires_at:expires.toISOString()}]};
    }
    else if(slug==='selfia-chat'){
     lastContext=await collect();
     const cid=body.conversation_id||await scalar("insert into conversations(user_id,title) values($1,'Synthetic browser') returning id",[session.user.id]);
     const turn={context_memory_ids:lastContext.memories.map(m=>m.id),context_memory_versions:Object.fromEntries(lastContext.memories.map(m=>[m.id,m.updated_at])),reply:lastContext.memories.length?'Retomamos lo que te ayudó: '+lastContext.memories.map(m=>m.content).join('; '):'Podemos preparar un **guion** de diez minutos.',life_area:'work',intervention:'PROPOSE_ACTION',situation:{action:'create',situation_id:null,title:'Reunión pendiente',summary:'Preparar una reunión'},commitment:{create:true,what:'Preparar un guion de diez minutos',why:'Facilitar la reunión'},memory:{content:''}};
     data=await scalar('select '+(body.onboarding?'selfia_save_onboarding_turn':'selfia_save_turn')+'($1,$2,$3,$4,$5,$6)',[cid,body.request_id,body.content,turn,body.situation_id||null,body.goal_id||null]);
    if(holdNextChat){holdNextChat=false;chatHeld=true;await chatGate;}
     if(failNextChat){const failure=failNextChat;failNextChat=null;return route.fulfill({status:failure.status,contentType:'application/json',body:failure.body});}
    } else throw Error('unexpected function');
   }else if(url.pathname==='/auth/v1/token'){
    const next='10000000-0000-4000-8000-000000000002';
    await db.exec('reset role');await db.query('insert into auth.users values($1)',[next]);await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[next]);
    session={...session,user:{id:next,email:'synthetic-b@example.test'},access_token:'eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({sub:next,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.test'};data=session;
   }else if(url.pathname==='/auth/v1/logout'){data={};
   }else if(url.pathname.includes('/rpc/')){
    const name=url.pathname.split('/').at(-1);assert.ok(rpcNames.has(name));const entries=Object.entries(body);
    data=await scalar('select '+name+'('+entries.map(([k],i)=>k+' => $'+(i+1)).join(',')+')',entries.map(([,v])=>v));
   }else{
    const table=url.pathname.split('/').at(-1);assert.match(table,/^[a-z_]+$/);
    if(route.request().method()==='PATCH'){
     const entries=Object.entries(body),filters=[...url.searchParams.entries()].filter(([k,v])=>k!=='select'&&k!=='order'&&v.startsWith('eq.'));
     assert.ok(filters.length);data=await q('update '+table+' set '+entries.map(([k],i)=>k+'=$'+(i+1)).join(',')+' where '+filters.map(([k],i)=>k+'=$'+(entries.length+i+1)).join(' and ')+' returning *',[...entries.map(([,v])=>v),...filters.map(([,v])=>v.slice(3))]);
    }else if(route.request().method()==='POST'){
     const entries=Object.entries(body);data=await q('insert into '+table+'('+entries.map(([k])=>k).join(',')+') values('+entries.map((_,i)=>'$'+(i+1)).join(',')+') returning *',entries.map(([,v])=>v));
    }else{
     const filters=[...url.searchParams.entries()].filter(([k,v])=>k!=='select'&&k!=='order'&&v.startsWith('eq.'));
     data=await q('select * from '+table+(filters.length?' where '+filters.map(([k],i)=>k+'=$'+(i+1)).join(' and '):''),filters.map(([,v])=>v.slice(3)==='true'?true:v.slice(3)==='false'?false:v.slice(3)));
     if(route.request().headers().accept?.includes('object'))data=data[0]||null;
    }
   }
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  }catch(e){console.log(url.pathname,e.message);await route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({message:e.message,error:e.message})})}
 });
 page=await context.newPage();const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message)});
 await page.goto(base);await page.getByRole('button',{name:'Hablar',exact:true}).click();
 await page.getByPlaceholder('Escribe o háblame…').fill('Quiero preparar una reunión con mi responsable');
 await page.getByRole('button',{name:'Enviar',exact:true}).click();
 await page.getByRole('button',{name:'Guardar esta acción',exact:true}).click();
 assert.equal(await page.locator('.msg.assistant strong').count(),1);
 await page.getByRole('button',{name:'Ver compromiso y elegir fecha',exact:true}).click();
 await page.getByRole('heading',{name:'Compromisos sin fecha',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Elegir fecha y llevar a mi semana'}).count(),1);
 await page.getByRole('button',{name:'Mi vida',exact:true}).click();await page.getByRole('button',{name:'Asuntos abiertos',exact:true}).click();
 await page.getByRole('button',{name:'Elegir fecha y llevar a mi semana'}).click();
 const tomorrow=new Date(Date.now()+86400000).toISOString().slice(0,10);await page.locator('input[type=date]').fill(tomorrow);
 await page.getByRole('button',{name:'Guardar en mi semana',exact:true}).click();
 await page.getByRole('button',{name:'Revisar o corregir resultado'}).click();
 await page.getByLabel('¿Qué ocurrió?').selectOption('partially_done');
 await page.getByLabel('Resultado o contexto').fill('Preparé solo el inicio');
 await page.getByLabel('Qué quiero que SELF-IA recuerde').fill('Dividir el guion en pasos me ayudó');
 await page.getByLabel('Qué probaría la próxima vez').fill('Empezar por la primera frase');
 await page.getByRole('button',{name:'Guardar revisión',exact:true}).click();
 await page.getByLabel('Revisar acción').waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Revisar o corregir resultado'}).click();
 assert.equal(await page.getByLabel('¿Qué ocurrió?').inputValue(),'partially_done');
 assert.equal(await page.getByLabel('Resultado o contexto').inputValue(),'Preparé solo el inicio');
 assert.equal(await page.getByLabel('Qué quiero que SELF-IA recuerde').inputValue(),'Dividir el guion en pasos me ayudó');
 await page.getByLabel('Tipo de revisión').selectOption('new');
 assert.equal(await page.getByLabel('Resultado o contexto').inputValue(),'');
 await page.getByLabel('Tipo de revisión').selectOption('correct');
 await page.getByLabel('Resultado o contexto').fill('Corrección: preparé solo la primera frase');
 await page.getByRole('button',{name:'Guardar revisión',exact:true}).click();
 await page.getByLabel('Revisar acción').waitFor({state:'hidden'});
 await page.getByLabel('Tipo de revisión').waitFor({state:'hidden'});
 assert.equal(await scalar('select count(*)::int from action_reviews'),2);
 assert.equal(await scalar("select count(*)::int from memories where status='obsolete'"),1);
 await page.getByRole('button',{name:'Mi vida',exact:true}).click();await page.getByRole('button',{name:'Así me veo',exact:true}).click();
 let card=page.locator('.memoryCard').filter({hasText:'Dividir el guion en pasos me ayudó'});
 await card.getByRole('button',{name:'Corregir',exact:true}).click();await card.getByLabel('Corrección').fill('Escribir la primera frase me ayudó');
 await page.getByRole('button',{name:'Guardar corrección',exact:true}).click();
 card=page.locator('.memoryCard').filter({hasText:'Escribir la primera frase me ayudó'});
 await card.getByRole('button',{name:'Ver origen e historial',exact:true}).click();
 await page.getByText('Antes: Dividir el guion en pasos me ayudó',{exact:true}).waitFor();
 await page.getByText('Declaración de origen: Dividir el guion en pasos me ayudó',{exact:true}).waitFor();
 await page.getByText('Contexto del resultado: Corrección: preparé solo la primera frase',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Cerrar historial'}).click();
 await page.screenshot({path:'test-results/memory-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Hablar',exact:true}).click();await page.getByPlaceholder('Escribe o háblame…').fill('¿Cómo sigo con la reunión?');await page.getByRole('button',{name:'Enviar',exact:true}).click();
 await page.locator('.msg.assistant').filter({hasText:'Retomamos lo que te ayudó: Escribir la primera frase me ayudó'}).waitFor();
 assert.ok(!JSON.stringify(lastContext).includes('Dividir el guion'));
 await page.getByRole('button',{name:'Mi vida',exact:true}).click();await page.getByRole('button',{name:'Así me veo',exact:true}).click();card=page.locator('.memoryCard').filter({hasText:'Escribir la primera frase me ayudó'});
 await card.getByRole('button',{name:'No volver a usar',exact:true}).click();
 await card.waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Hoy',exact:true}).click();
 await page.getByRole('button',{name:'Mi semana',exact:true}).click();
 await page.getByRole('button',{name:'Revisar o corregir resultado',exact:true}).click();
 assert.equal(await page.getByLabel('Qué probaría la próxima vez').inputValue(),'');
 await page.getByRole('button',{name:'Cancelar',exact:true}).click();
 await page.getByRole('button',{name:'Mi vida',exact:true}).click();await page.getByRole('button',{name:'Asuntos abiertos',exact:true}).click();
 await page.getByRole('button',{name:'Ver resumen anterior',exact:true}).first().click();
 await page.getByLabel('Historial del resumen').waitFor({state:'visible'});
 await page.getByText('Versiones anteriores: no se usan como recomendaciones vigentes.',{exact:true}).waitFor();
 assert.ok(await page.getByLabel('Historial del resumen').locator('article').count());
 await page.getByRole('button',{name:'Cerrar historial del resumen',exact:true}).click();
 await page.getByRole('button',{name:'Hablar',exact:true}).click();await page.getByPlaceholder('Escribe o háblame…').fill('¿Qué probamos ahora?');await page.getByRole('button',{name:'Enviar',exact:true}).click();await page.locator('.msg.assistant').filter({hasText:'Podemos preparar un guion de diez minutos.'}).waitFor();
 assert.equal(lastContext.memories.length,0);assert.ok(!JSON.stringify(lastContext).includes('Escribir la primera frase'));
 await page.getByRole('button',{name:'Hoy',exact:true}).click();await page.getByRole('button',{name:'Qué hago hoy',exact:true}).click();await page.getByRole('button',{name:'Buscar planes',exact:true}).click();
 await page.getByRole('button',{name:'Elegir este plan',exact:true}).click();await page.getByLabel('Día',{exact:true}).fill(tomorrow);await page.getByRole('button',{name:'Guardar en mi semana',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'Busca propuestas de nuevo'}).waitFor();
 const planStart=new Date(Date.now()+45*60000);await page.getByLabel('Día',{exact:true}).fill(planStart.getFullYear()+'-'+String(planStart.getMonth()+1).padStart(2,'0')+'-'+String(planStart.getDate()).padStart(2,'0'));await page.getByLabel('Hora',{exact:true}).fill(String(planStart.getHours()).padStart(2,'0')+':'+String(planStart.getMinutes()).padStart(2,'0'));await page.getByRole('button',{name:'Guardar en mi semana',exact:true}).click();
 await page.getByRole('button',{name:'Guardado en mi semana',exact:true}).waitFor();
 await page.screenshot({path:'test-results/planner-mobile.png',fullPage:true});
 assert.equal((await q("select count(*)::int as n from agenda_events"))[0].n,2);
 await q("insert into goals(user_id,title,life_area,status) values($1,'Objetivo recuperable','work','paused')",[uid]);
 // Reload obtains the record through the UI's actual data path.
 await page.reload();await page.getByRole('button',{name:'Mi semana',exact:true}).click();
 const plan=page.locator('.agendaItem').filter({hasText:'Paseo tranquilo de prueba'});
 await plan.getByText('Una opción sintética para probar la agenda.',{exact:false}).waitFor();
 assert.equal(await plan.getByRole('link',{name:'Consultar fuente del plan'}).getAttribute('href'),'https://example.test/plan');
 await plan.getByRole('button',{name:'Revisar o corregir resultado'}).click();await page.getByLabel('Revisar acción').getByRole('link',{name:'Consultar fuente del plan'}).waitFor();
 await page.getByRole('button',{name:'Cancelar',exact:true}).click();
 await page.getByRole('button',{name:'Mi vida',exact:true}).click();await page.getByRole('button',{name:'Objetivos',exact:true}).click();
 await page.getByRole('button',{name:'Retomar objetivo',exact:true}).click();
 await page.locator('.goalCard').filter({hasText:'Objetivo recuperable'}).getByRole('button',{name:'Pausar',exact:true}).waitFor();
 assert.equal(await scalar("select status from goals where title='Objetivo recuperable'"),'active');
 const recoverable=page.locator('.goalCard').filter({hasText:'Objetivo recuperable'});
 await recoverable.getByRole('button',{name:'Ver historial del objetivo',exact:true}).click();
 await page.getByText('En pausa → Activo',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Cerrar historial del objetivo',exact:true}).click();
 await recoverable.getByRole('button',{name:'Hablar con SELF-IA',exact:true}).click();
 await page.getByRole('button',{name:'Enviar',exact:true}).click();
 await page.getByRole('button',{name:'Guardar esta acción',exact:true}).waitFor();
 const linked=await scalar("select situation_id from goals where title='Objetivo recuperable'");assert.ok(linked);
 const subjects=await scalar('select count(*)::int from situations');
 await page.getByRole('button',{name:'Mi vida',exact:true}).click();await page.getByRole('button',{name:'Objetivos',exact:true}).click();
 await page.locator('.goalCard').filter({hasText:'Objetivo recuperable'}).getByRole('button',{name:'Hablar con SELF-IA',exact:true}).click();
 await page.getByRole('button',{name:'Enviar',exact:true}).click();await page.getByRole('button',{name:'Guardar esta acción',exact:true}).waitFor();
 assert.equal(await scalar('select count(*)::int from situations'),subjects,'same goal must not create another subject');
 await page.getByRole('button',{name:'Mi vida',exact:true}).click();await page.getByRole('button',{name:'Objetivos',exact:true}).click();
 await page.locator('.goalCard').filter({hasText:'Objetivo recuperable'}).getByRole('button',{name:'Ya no encaja',exact:true}).click();
 await page.getByText('Objetivos cerrados (1)',{exact:true}).click();await page.getByRole('button',{name:'Reabrir objetivo',exact:true}).click();
 await page.locator('.goalCard').filter({hasText:'Objetivo recuperable'}).getByRole('button',{name:'Pausar',exact:true}).waitFor();
 assert.equal(await scalar("select status from goals where title='Objetivo recuperable'"),'active');
 await page.getByRole('button',{name:'Evolución',exact:true}).click();
 await page.getByText('0 completadas · 1 parciales · 0 movidas',{exact:true}).waitFor();
 await page.screenshot({path:'test-results/evolution-mobile.png',fullPage:true});
 // Real React regression: A resolves after navigating and editing a different goal context B.
 await page.getByRole('button',{name:'Hablar',exact:true}).click();await page.getByRole('button',{name:'Empezar otro asunto',exact:true}).click();
 chatGate=new Promise(resolve=>releaseChat=resolve);holdNextChat=true;chatHeld=false;
 await page.getByPlaceholder('Escribe o háblame…').fill('Slow A original');await page.getByRole('button',{name:'Enviar',exact:true}).click();
 for(let i=0;i<100&&!chatHeld;i++)await new Promise(resolve=>setTimeout(resolve,20));assert.ok(chatHeld);
 await page.getByRole('button',{name:'Mi vida',exact:true}).click();await page.getByRole('button',{name:'Objetivos',exact:true}).click();await page.locator('.goalCard').filter({hasText:'Objetivo recuperable'}).getByRole('button',{name:'Hablar con SELF-IA',exact:true}).click();
 await page.getByPlaceholder('Escribe o háblame…').fill('New B draft');releaseChat();
 await page.waitForResponse(r=>r.url().includes('/selfia-chat')&&r.request().postDataJSON()?.content==='Slow A original');
 assert.equal(await page.getByPlaceholder('Escribe o háblame…').inputValue(),'New B draft');assert.equal(await page.locator('.msg.user').filter({hasText:'Slow A original'}).count(),0);
 await page.getByRole('button',{name:'Hablar',exact:true}).click();await page.locator('.msg.user').filter({hasText:'Slow A original'}).waitFor();
 // Lost response after commit: invalid JSON must keep text and replay the exact request.
 const beforeReceipts=await scalar('select count(*)::int from turn_receipts');failNextChat={status:200,body:'{'};
 await page.getByPlaceholder('Escribe o háblame…').fill('Retry after lost response');await page.getByRole('button',{name:'Enviar',exact:true}).click();await page.getByRole('alert').filter({hasText:'respuesta llegó incompleta'}).waitFor();
 assert.equal(await page.getByPlaceholder('Escribe o háblame…').inputValue(),'Retry after lost response');
 await page.getByRole('button',{name:'Enviar',exact:true}).click();await page.locator('.msg.user').filter({hasText:'Retry after lost response'}).waitFor();assert.equal(await scalar('select count(*)::int from turn_receipts'),beforeReceipts+1);
 await page.reload();await page.getByRole('button',{name:'Hablar',exact:true}).click();await page.locator('.msg.user').filter({hasText:'Retry after lost response'}).waitFor();
 await page.getByRole('button',{name:'Mi vida',exact:true}).click();await page.getByRole('button',{name:'Así me veo',exact:true}).click();
 const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar mis datos',exact:true}).click();const download=await downloading;await download.saveAs('test-results/synthetic-export.json');
 const exported=JSON.parse(await readFile('test-results/synthetic-export.json','utf8'));assert.equal(exported.user_id,uid);assert.ok(exported.data.action_reviews.length);
 const beforeErasure=await scalar('select count(*)::int from agenda_events');await page.getByRole('button',{name:'Solicitar eliminación de mis datos',exact:true}).click();await page.getByRole('status').filter({hasText:'todavía no se han borrado'}).waitFor();assert.equal(await scalar('select count(*)::int from agenda_events'),beforeErasure);
 await page.setViewportSize({width:1366,height:900});await page.screenshot({path:'test-results/profile-desktop.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await page.getByRole('button',{name:'Entrar',exact:true}).waitFor();assert.ok(!(await page.locator('body').innerText()).includes('Retry after lost response'));
 // Second account: no A data; initial turn and onboarding checkpoint survive reload.
 await page.getByPlaceholder('Email',{exact:true}).fill('synthetic-b@example.test');await page.getByPlaceholder('Contraseña',{exact:true}).fill('Synthetic-password-for-local-only');await page.getByRole('button',{name:'Entrar',exact:true}).click();
 await page.getByRole('heading',{name:'¿Qué tienes ahora mismo en la cabeza?',exact:true}).waitFor();assert.ok(!(await page.locator('body').innerText()).includes('Retry after lost response'));
 await page.locator('.onboardingText').fill('Una primera conversación de la cuenta B');await page.getByRole('button',{name:'Hablar con SELF-IA',exact:true}).click();await page.getByRole('button',{name:'Entrar en SELF-IA',exact:true}).waitFor();
 const subjectsBeforeReload=await scalar('select count(*)::int from situations');
 await page.getByRole('button',{name:'Quiero reformularlo',exact:true}).click();await page.locator('.onboardingText').fill('Una reformulación del mismo asunto B');await page.getByRole('button',{name:'Hablar con SELF-IA',exact:true}).click();await page.getByRole('button',{name:'Entrar en SELF-IA',exact:true}).waitFor();assert.equal(await scalar('select count(*)::int from situations'),subjectsBeforeReload,'reformulation keeps the initial subject');
 // Reload uses the B session persisted by real Supabase client sign-in.
 await page.reload();await page.getByRole('button',{name:'Entrar en SELF-IA',exact:true}).waitFor();assert.equal(await scalar('select count(*)::int from situations'),subjectsBeforeReload);
 await page.getByRole('button',{name:'Entrar en SELF-IA',exact:true}).click();await page.getByRole('button',{name:'Hoy',exact:true}).waitFor();assert.equal(await scalar('select onboarding_status from profiles'),'completed');
 assert.deepEqual(errors,[]);assert.equal(realRequests,0);
 console.log('PASS browser cycle: action acceptance → schedule → partial outcome → learning → correction → next conversation → withdrawal → structured plan. Mobile and desktop, response/context races, replay after lost response, account isolation, initial-dialog reformulation/reload/completion, export and pending erasure verified. No external requests; Auth/AI simulated, PostgreSQL/RLS real.');
}catch(e){if(page){console.log('UI state:',await page.locator('body').innerText());await page.screenshot({path:'test-results/error.png',fullPage:true})}throw e}finally{await browser.close();server.close();await db.close()}



