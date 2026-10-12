import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
const c=JSON.parse(await readFile(new URL('../../.verification-tools/cloud-public.json',import.meta.url),'utf8'));
assert.equal(c.url,'https://tleqdegnzeukonbbrrzk.supabase.co');
const [a]=JSON.parse(await readFile(new URL('../../.verification-tools/cloud-users.json',import.meta.url),'utf8'));
assert.equal(a.id,'892e6eae-5abb-4ff3-bfe7-b9d371101931');assert.match(a.email,/^selfia-e2e-.*@example\.invalid$/);
const sb=createClient(c.url,c.key,{auth:{persistSession:false,autoRefreshToken:false}});
const login=await sb.auth.signInWithPassword(a);assert.ifError(login.error);
try{
 const headers={apikey:c.key,authorization:'Bearer '+login.data.session.access_token,'content-type':'application/json'};
 const invoke=(body,auth=headers)=>fetch(c.url+'/functions/v1/selfia-erasure-drill',{method:'POST',headers:auth,body:JSON.stringify(body),signal:AbortSignal.timeout(120000)});
 assert.equal((await invoke({}, {apikey:c.key,'content-type':'application/json'})).status,401);
 assert.equal((await invoke({confirm:'DISPOSABLE_TEST_ACCOUNT_ONLY',user_id:a.id})).status,400);
 const r=await invoke({confirm:'DISPOSABLE_TEST_ACCOUNT_ONLY'}),data=await r.json();
 await writeFile(new URL('../../.verification-tools/cloud-erasure-report.json',import.meta.url),JSON.stringify({date:new Date().toISOString(),status:r.status,...data},null,2));
 assert.equal(r.status,200,JSON.stringify(data));assert.equal(data.passed,true);assert.notEqual(data.disposable_user,a.id);assert.equal(data.populated_owner_tables,22);assert.equal(data.auth_deleted,true);assert.equal(data.stale_identity_rejected,true);assert.equal(data.stale_write_rejected,true);assert.equal(data.provider_backup_retention_verified,false);
 assert.ifError((await sb.auth.getUser(login.data.session.access_token)).error);
 console.log('PASS actual Auth Admin disposable deletion across 22 populated tables, stale identity/write denial and auditor session preserved. Provider backup retention remains unverified.');
}finally{await sb.auth.signOut({scope:'local'});}
