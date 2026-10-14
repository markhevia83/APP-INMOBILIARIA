import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
const config=JSON.parse(await readFile(new URL('../../.verification-tools/cloud-public.json',import.meta.url),'utf8'));
assert.equal(config.url,'https://tleqdegnzeukonbbrrzk.supabase.co');
const [fixture]=JSON.parse(await readFile(new URL('../../.verification-tools/cloud-users.json',import.meta.url),'utf8'));
assert.match(fixture.email,/^selfia-e2e-.*@example\.invalid$/);
const sb=createClient(config.url,config.key,{auth:{persistSession:false,autoRefreshToken:false}});
const login=await sb.auth.signInWithPassword(fixture);assert.ifError(login.error);assert.equal(login.data.user.id,fixture.id);
try{
 const count=async table=>{const r=await sb.from(table).select('*',{count:'exact',head:true}).eq('user_id',fixture.id);assert.ifError(r.error);return r.count;};
 const tables=['ai_usage','conversations','messages','mutation_receipts'];
 const before=await Promise.all(tables.map(count));
 for(const endpoint of ['chat','daily','motivation','discover','onboarding']){
  for(const body of ['null','{','[]','"synthetic"','42']){
   const r=await fetch(config.url+'/functions/v1/selfia-'+endpoint,{method:'POST',headers:{apikey:config.key,authorization:'Bearer '+login.data.session.access_token,'content-type':'application/json'},body,signal:AbortSignal.timeout(30000)});
   assert.equal(r.status,400,endpoint+' malformed body must be a controlled client error');
   assert.ok((await r.json()).error);
  }
 }
 assert.deepEqual(await Promise.all(tables.map(count)),before,'malformed input must never start model usage or write conversation state');
 console.log('PASS 25 malformed authenticated HTTP requests rejected without model usage or conversation writes');
}finally{await sb.auth.signOut({scope:'local'});}
