import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
const config=JSON.parse(await readFile(new URL('../../.verification-tools/cloud-public.json',import.meta.url),'utf8'));
assert.equal(config.url,'https://tleqdegnzeukonbbrrzk.supabase.co');
const fixtures=JSON.parse(await readFile(new URL('../../.verification-tools/cloud-users.json',import.meta.url),'utf8'));
const clients=[];
try{
 for(const f of fixtures){assert.match(f.email,/^selfia-e2e-.*@example\.invalid$/);const sb=createClient(config.url,config.key,{auth:{persistSession:false,autoRefreshToken:false}});const {data,error}=await sb.auth.signInWithPassword({email:f.email,password:f.password});assert.ifError(error);assert.equal(data.user.id,f.id);clients.push({sb,id:f.id,token:data.session.access_token});}
 const [a,b]=clients;assert.ok(a&&b);
 const single=async query=>{const r=await query.single();assert.ifError(r.error);return r.data;};
 const rpc=async(sb,name,args)=>{const r=await sb.rpc(name,args);assert.ifError(r.error);return r.data;};
 const otherBefore=await b.sb.from('memories').select('*').order('id');assert.ifError(otherBefore.error);
 const secret='Synthetic erasure '+crypto.randomUUID();
 const conversation=await single(a.sb.from('conversations').insert({user_id:a.id,title:'Synthetic memory deletion'}).select());
 const message=await single(a.sb.from('messages').insert({user_id:a.id,conversation_id:conversation.id,role:'user',content:secret}).select());
 const memory=await single(a.sb.from('memories').insert({user_id:a.id,memory_type:'conversation_note',content:secret,source_message_id:message.id,status:'confirmed',user_validation:'confirmed'}).select());
 const foreign=await b.sb.rpc('selfia_erase_memory',{p_id:memory.id,p_expected:memory.updated_at});assert.match(foreign.error?.message||'',/memory_not_found/);
 const corrected=await rpc(a.sb,'selfia_revise_memory',{p_id:memory.id,p_action:'correct',p_content:secret+' corrected',p_expected:memory.updated_at});
 const stale=await a.sb.rpc('selfia_erase_memory',{p_id:memory.id,p_expected:memory.updated_at});assert.match(stale.error?.message||'',/memory_changed_reload/);
 const args={p_id:memory.id,p_expected:corrected.updated_at};const erased=await rpc(a.sb,'selfia_erase_memory',args);assert.equal(erased.erased,true);assert.deepEqual(await rpc(a.sb,'selfia_erase_memory',args),erased);
 const marker=await single(a.sb.from('memories').select('*').eq('id',memory.id));assert.equal(marker.content,'');assert.ok(marker.structured_data.erased_at);
 const revisions=await a.sb.from('memory_revisions').select('*').eq('memory_id',memory.id);assert.ifError(revisions.error);assert.deepEqual(revisions.data,[]);
 const reactivation=await a.sb.from('memories').update({content:'Resurrected',status:'confirmed'}).eq('id',memory.id);assert.match(reactivation.error?.message||'',/memory_erased/);
 const response=await fetch(config.url+'/functions/v1/selfia-context',{method:'POST',headers:{apikey:config.key,authorization:'Bearer '+a.token,'content-type':'application/json'},body:'{}'});assert.equal(response.status,200);assert.ok(!JSON.stringify(await response.json()).includes(secret));
 const otherAfter=await b.sb.from('memories').select('*').order('id');assert.ifError(otherAfter.error);assert.deepEqual(otherAfter.data,otherBefore.data);
 console.log('PASS hosted memory erasure: real Auth/RPC, stale version, foreign owner, retries, content/history removal, reactivation denied, deployed context excludes content, B memories unchanged. No model calls. Synthetic source and content-free marker retained.');
}finally{for(const c of clients)await c.sb.auth.signOut({scope:'local'});}
