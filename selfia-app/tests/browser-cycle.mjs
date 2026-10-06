import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {build} from 'esbuild';
import {chromium} from '@playwright/test';
import {PGlite} from '@electric-sql/pglite';
import {continuityContext} from '../../supabase/functions/_shared/continuity.ts';
const uid='10000000-0000-4000-8000-000000000001';
await mkdir('test-results',{recursive:true});
const bundle=await build({entryPoints:['src/main.jsx'],bundle:true,write:false,loader:{'.css':'empty'},define:{'import.meta.env':JSON.stringify({VITE_SUPABASE_URL:'https://selfia-test.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'test-publishable'})}});
const code=bundle.outputFiles[0].text,css=await readFile('src/styles.css','utf8');
const server=createServer((req,res)=>{res.setHeader('content-type',req.url==='/app.js'?'text/javascript':req.url==='/style.css'?'text/css':'text/html');res.end(req.url==='/app.js'?code:req.url==='/style.css'?css:'<html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root"></div><script src="/app.js"></script></html>')});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
const db=new PGlite();await db.exec(await readFile('tests/baseline.sql','utf8'));await db.exec(await readFile('../supabase/migrations/20261006142249_continuity_cycle.sql','utf8'));
await db.exec("insert into auth.users values ('"+uid+"');set role authenticated;");await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);
await db.query("insert into profiles(user_id,onboarding_status) values($1,'skipped')",[uid]);
const q=async(sql,args=[])=> (await db.query(sql,args)).rows;
const scalar=async(sql,args=[])=>Object.values((await q(sql,args))[0])[0];
const collect=async()=>{const data={};for(const [field,table] of Object.entries({memories:'memories',history:'messages',sources:'messages',situations:'situations',commitments:'commitments',agenda:'agenda_events',goals:'goals',reviews:'action_reviews',memoryUses:'turn_receipts'}))data[field]=await q('select * from '+table);return continuityContext(data)};
const rpcNames=new Set(['selfia_accept_action','selfia_schedule_commitment','selfia_review_action','selfia_revise_memory']);
let lastContext,realRequests=0;
let page;
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'msedge',headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Europe/Madrid'});
 const session={access_token:'eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({sub:uid,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.test',refresh_token:'synthetic-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user:{id:uid,email:'synthetic@example.test'}};
 await context.addInitScript(value=>localStorage.setItem('sb-selfia-test-auth-token',JSON.stringify(value)),session);
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.origin===base)return route.continue();
  if(url.hostname!=='selfia-test.supabase.co'){realRequests++;return route.fulfill({status:500,body:'Unexpected external request'})}
  try{
   const body=route.request().postDataJSON();let data;
   if(url.pathname.startsWith('/functions/v1/')){
    const slug=url.pathname.split('/').at(-1);
    if(slug==='selfia-daily')data={message:'Datos sintéticos para verificar el ciclo.'};
    else if(slug==='selfia-discover')data={intro:'Dos opciones de prueba',plans:[{title:'Paseo tranquilo de prueba',category:'tranquilo',description:'Una opción sintética para probar la agenda.',why:'Baja fricción',source_url:'https://example.test/plan'}]};
    else if(slug==='selfia-chat'){
     lastContext=await collect();
     const cid=body.conversation_id||await scalar("insert into conversations(user_id,title) values($1,'Synthetic browser') returning id",[uid]);
     const turn={context_memory_ids:lastContext.memories.map(m=>m.id),context_memory_versions:Object.fromEntries(lastContext.memories.map(m=>[m.id,m.updated_at])),reply:lastContext.memories.length?'Retomamos lo que te ayudó: '+lastContext.memories.map(m=>m.content).join('; '):'Podemos preparar un guion de diez minutos.',life_area:'work',intervention:'PROPOSE_ACTION',situation:{action:'create',situation_id:null,title:'Reunión pendiente',summary:'Preparar una reunión'},commitment:{create:true,what:'Preparar un guion de diez minutos',why:'Facilitar la reunión'},memory:{content:''}};
     data=await scalar("select selfia_save_turn($1,$2,$3,$4,$5,$6)",[cid,body.request_id,body.content,turn,body.situation_id||null,body.goal_id||null]);
    } else throw Error('unexpected function');
   }else if(url.pathname.includes('/rpc/')){
    const name=url.pathname.split('/').at(-1);assert.ok(rpcNames.has(name));const entries=Object.entries(body);
    data=await scalar('select '+name+'('+entries.map(([k],i)=>k+' => $'+(i+1)).join(',')+')',entries.map(([,v])=>v));
   }else{
    const table=url.pathname.split('/').at(-1);assert.match(table,/^[a-z_]+$/);
    if(route.request().method()==='POST'){
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
 await page.getByRole('button',{name:'Mi vida',exact:true}).click();await page.getByRole('button',{name:'Así me veo',exact:true}).click();
 let card=page.locator('.memoryCard').filter({hasText:'Dividir el guion en pasos me ayudó'});
 await card.getByRole('button',{name:'Corregir',exact:true}).click();await card.getByLabel('Corrección').fill('Escribir la primera frase me ayudó');
 await page.getByRole('button',{name:'Guardar corrección',exact:true}).click();
 card=page.locator('.memoryCard').filter({hasText:'Escribir la primera frase me ayudó'});
 await card.getByRole('button',{name:'Ver origen e historial',exact:true}).click();
 await page.getByText('Antes: Dividir el guion en pasos me ayudó',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Cerrar historial'}).click();
 await page.screenshot({path:'test-results/memory-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Hablar',exact:true}).click();await page.getByPlaceholder('Escribe o háblame…').fill('¿Cómo sigo con la reunión?');await page.getByRole('button',{name:'Enviar',exact:true}).click();
 await page.locator('.msg.assistant').filter({hasText:'Retomamos lo que te ayudó: Escribir la primera frase me ayudó'}).waitFor();
 assert.ok(!JSON.stringify(lastContext).includes('Dividir el guion'));
 await page.getByRole('button',{name:'Mi vida',exact:true}).click();await page.getByRole('button',{name:'Así me veo',exact:true}).click();card=page.locator('.memoryCard').filter({hasText:'Escribir la primera frase me ayudó'});
 await card.getByRole('button',{name:'No volver a usar',exact:true}).click();
 await page.getByRole('button',{name:'Hablar',exact:true}).click();await page.getByPlaceholder('Escribe o háblame…').fill('¿Qué probamos ahora?');await page.getByRole('button',{name:'Enviar',exact:true}).click();await page.locator('.msg.assistant').filter({hasText:'Podemos preparar un guion de diez minutos.'}).waitFor();
 assert.equal(lastContext.memories.length,0);assert.ok(!JSON.stringify(lastContext).includes('Escribir la primera frase'));
 await page.getByRole('button',{name:'Hoy',exact:true}).click();await page.getByRole('button',{name:'Qué hago hoy',exact:true}).click();await page.getByRole('button',{name:'Buscar planes',exact:true}).click();
 await page.getByRole('button',{name:'Elegir este plan',exact:true}).click();await page.getByLabel('Día',{exact:true}).fill(tomorrow);await page.getByRole('button',{name:'Guardar en mi semana',exact:true}).click();
 await page.getByRole('button',{name:'Guardado en mi semana',exact:true}).waitFor();
 await page.screenshot({path:'test-results/planner-mobile.png',fullPage:true});
 assert.equal((await q("select count(*)::int as n from agenda_events"))[0].n,2);
 assert.deepEqual(errors,[]);assert.equal(realRequests,0);
 console.log('PASS browser cycle: action acceptance → schedule → partial outcome → learning → correction → next conversation → withdrawal → structured plan. No external requests; AI simulated, PostgreSQL/RLS real.');
}catch(e){if(page){console.log('UI state:',await page.locator('body').innerText());await page.screenshot({path:'test-results/error.png',fullPage:true})}throw e}finally{await browser.close();server.close();await db.close()}




