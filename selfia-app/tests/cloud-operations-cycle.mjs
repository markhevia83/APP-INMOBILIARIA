import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
const c=JSON.parse(await readFile(new URL('../../.verification-tools/cloud-public.json',import.meta.url),'utf8'));assert.equal(c.url,'https://tleqdegnzeukonbbrrzk.supabase.co');
const [a]=JSON.parse(await readFile(new URL('../../.verification-tools/cloud-users.json',import.meta.url),'utf8'));assert.match(a.email,/^selfia-e2e-.*@example\.invalid$/);
const sb=createClient(c.url,c.key,{auth:{persistSession:false,autoRefreshToken:false}});const login=await sb.auth.signInWithPassword(a);assert.ifError(login.error);
try{
 const invoke=(token,body={})=>fetch(c.url+'/functions/v1/selfia-operations',{method:'POST',headers:{apikey:c.key,'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
 assert.equal((await invoke()).status,401);assert.equal((await invoke('invalid')).status,401);
 for(const body of [{},{drill:true}]){const r=await invoke(login.data.session.access_token,body);assert.equal(r.status,403);assert.equal((await r.json()).error,'operator_required');}
 assert.ok((await sb.rpc('selfia_operations_snapshot')).error,'client cannot bypass the private endpoint through RPC');
 console.log('PASS hosted operations: anonymous/invalid 401, synthetic non-operator 403 for real and drill views, direct RPC denied.');
}finally{await sb.auth.signOut({scope:'local'});}
