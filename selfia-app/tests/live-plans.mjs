import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
const config=JSON.parse(await readFile(new URL('../../.verification-tools/cloud-public.json',import.meta.url),'utf8'));assert.equal(config.url,'https://tleqdegnzeukonbbrrzk.supabase.co');
const [fixture]=JSON.parse(await readFile(new URL('../../.verification-tools/cloud-users.json',import.meta.url),'utf8'));assert.match(fixture.email,/^selfia-e2e-.*@example\.invalid$/);
const sb=createClient(config.url,config.key,{auth:{persistSession:false,autoRefreshToken:false}});const auth=await sb.auth.signInWithPassword(fixture);assert.ifError(auth.error);
try{
 const r=await fetch(config.url+'/functions/v1/selfia-discover',{method:'POST',headers:{apikey:config.key,authorization:'Bearer '+auth.data.session.access_token,'content-type':'application/json'},body:JSON.stringify({intent:'today_plan',vibe:'tranquilo',city:'Madrid',country:'España',timezone:'Europe/Madrid'}),signal:AbortSignal.timeout(120000)});
 const data=await r.json();assert.equal(r.status,200,JSON.stringify(data));assert.ok(data.intro);assert.ok(data.plans.length<=2);
 assert.ok(!('text'in data),'discarded proposals must not survive in raw response text');
 for(const p of data.plans){assert.match(p.source_url,/^https:\/\//);assert.ok(p.description&&p.when);if(p.timing_kind!=='flexible'){assert.equal(p.time_verified,true);assert.ok(Date.parse(p.ends_at)>Date.now());assert.ok(Date.parse(p.ends_at)>=Math.max(Date.parse(p.starts_at),Date.now()+25*60000)+p.duration_minutes*60000)}else assert.equal(p.requires_opening_hours,false)}
 console.log('PASS LIVE PLANS: current server clock, verified usable windows or flexible plans, HTTPS sources, no discarded raw proposals.');
 console.log(JSON.stringify(data.plans.map(p=>({title:p.title,when:p.when,timing_kind:p.timing_kind,starts_at:p.starts_at,ends_at:p.ends_at})),null,2));
}finally{await sb.auth.signOut({scope:'local'})}
