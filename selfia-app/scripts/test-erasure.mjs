// Operator prototype: defaults to a read-only preflight. Only dedicated disposable test accounts.
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
const execute=process.argv.includes('--execute');
const arg=name=>process.argv[process.argv.indexOf(name)+1];
assert.ok(process.argv.includes('--user'),'--user UUID required');const id=arg('--user');
assert.match(id,/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i);
const url=process.env.SELFIA_TEST_SUPABASE_URL,key=process.env.SELFIA_TEST_SERVICE_KEY;
assert.equal(url,'https://tleqdegnzeukonbbrrzk.supabase.co','production is forbidden');assert.ok(key,'test service credential must be supplied securely through environment');
const sb=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const user=await sb.auth.admin.getUserById(id);assert.ifError(user.error);
assert.match(user.data.user.email,/^selfia-erasure-.*@example\.invalid$/,'refuse real mailboxes and auditor A/B');
const pre=await sb.rpc('selfia_erasure_preflight',{p_user:id});assert.ifError(pre.error);
assert.ok(pre.data.ready_for_auth_delete,'Storage needs a separate deletion procedure');
console.log(JSON.stringify({mode:execute?'execute':'dry_run',counts:pre.data.counts,owned_storage_objects:pre.data.owned_storage_objects}));
if(execute){
 assert.ok(process.argv.includes('--confirm-user')&&arg('--confirm-user')===id,'repeat exact target UUID with --confirm-user');
 // Supabase Auth Admin API performs hard deletion; never edit live auth.users directly.
 const result=await sb.auth.admin.deleteUser(id,false);assert.ifError(result.error);
 for(const table of Object.keys(pre.data.counts)){
  const r=await sb.from(table).select('user_id').eq('user_id',id).limit(1);assert.ifError(r.error);assert.equal(r.data.length,0,table+' residual data');
 }
 const gone=await sb.auth.admin.getUserById(id);assert.ok(gone.error,'Auth account must be gone');
 console.log('PASS disposable test account hard deletion and no application rows. Provider/backup retention not certified.');
}
