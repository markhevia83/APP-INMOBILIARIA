// Disposable-account verification only. Never accepts a target user or a real mailbox.
import {createClient} from 'npm:@supabase/supabase-js@2.57.4';
const testUrl='https://tleqdegnzeukonbbrrzk.supabase.co';
const auditor='892e6eae-5abb-4ff3-bfe7-b9d371101931';
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
Deno.serve(async req=>{
 if(req.method!=='POST')return json({error:'method_not_allowed'},405);
 const url=Deno.env.get('SUPABASE_URL');if(url!==testUrl)return json({error:'test_only'},403);
 const auth=req.headers.get('authorization');if(!auth)return json({error:'unauthorized'},401);
 const token=auth.replace(/^Bearer\s+/,'');
 const client=createClient(testUrl,Deno.env.get('SUPABASE_ANON_KEY')||'',{auth:{persistSession:false,autoRefreshToken:false}});
 const identity=await client.auth.getUser(token);
 if(identity.error||!identity.data.user)return json({error:'unauthorized'},401);
 if(identity.data.user.id!==auditor||!/^selfia-e2e-.*@example\.invalid$/.test(identity.data.user.email||''))return json({error:'synthetic_auditor_required'},403);
 let body:any;try{body=await req.json()}catch{return json({error:'invalid_json'},400)}
 if(body?.confirm!=='DISPOSABLE_TEST_ACCOUNT_ONLY'||Object.keys(body).some(x=>x!=='confirm'))return json({error:'confirmation_required_no_target_allowed'},400);
 const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!key)return json({error:'verification_unavailable'},503);
 const admin=createClient(testUrl,key,{auth:{persistSession:false,autoRefreshToken:false}});
 let created:string|undefined,deleted=false,phase='create';
 const email='selfia-erasure-'+crypto.randomUUID()+'@example.invalid',password=crypto.randomUUID()+crypto.randomUUID();
 const checked=(r:any)=>{if(r.error)throw Error('verification_step_failed');return r.data};
 const remove=async()=>{
  if(!created||created===auditor)throw Error('unsafe_target');
  const target=checked(await admin.auth.admin.getUserById(created));
  if(target.user.id!==created||target.user.email!==email||!/^selfia-erasure-.*@example\.invalid$/.test(target.user.email))throw Error('unsafe_target');
  checked(await admin.auth.admin.deleteUser(created,false));deleted=true;
 };
 try{
  const account=checked(await admin.auth.admin.createUser({email,password,email_confirm:true}));created=account.user.id;
  if(!created||created===auditor)throw Error('unsafe_target');
  const session=checked(await client.auth.signInWithPassword({email,password}));const jwt=session.session.access_token;
  phase='seed';const id=()=>crypto.randomUUID(),conv=id(),msg=id(),subject=id(),goal=id(),action=id(),event=id(),memory=id();
  const seed:[string,Record<string,unknown>][]=[
   ['profiles',{}],['conversations',{id:conv}],['messages',{id:msg,conversation_id:conv,role:'user',content:'Synthetic erasure fixture'}],
   ['situations',{id:subject,title:'Synthetic',source_message_id:msg}],['goals',{id:goal,title:'Synthetic',situation_id:subject}],
   ['commitments',{id:action,what:'Synthetic',situation_id:subject,goal_id:goal,source_message_id:msg}],
   ['agenda_events',{id:event,title:'Synthetic',scheduled_start:new Date(Date.now()+172800000).toISOString(),commitment_id:action,goal_id:goal,situation_id:subject,source_message_id:msg}],
   ['memories',{id:memory,memory_type:'conversation_note',content:'Synthetic',source_message_id:msg,source_event_id:event}],
   ['people',{name_or_label:'Synthetic'}],['hypotheses',{statement:'Synthetic'}],['profile_items',{category:'declared_trait',content:'Synthetic',source_message_id:msg}],
   ['onboarding_sessions',{conversation_id:conv}],['motivation_feedback',{prompt_type:'start',content:'Synthetic'}],
   ['action_reviews',{event_id:event,status:'done',request_id:id()}],['memory_revisions',{memory_id:memory,action:'correct',before_data:{},after_data:{}}],
   ['goal_revisions',{goal_id:goal,before_data:{},after_data:{}}],['situation_summary_revisions',{situation_id:subject,memory_id:memory,summary:'Synthetic',source_message_id:msg}],
   ['turn_receipts',{request_id:id(),conversation_id:conv,response:{},memory_ids:[memory]}],['mutation_receipts',{request_id:id(),operation:'synthetic',payload:{},response:{}}],
   ['plan_proposals',{payload:{},timezone:'Europe/Madrid',local_date:new Date().toISOString().slice(0,10),expires_at:new Date(Date.now()+1200000).toISOString(),source_evidence:{}}],
   ['ai_usage',{request_id:id(),endpoint:'chat',status:'failed',attempts:1,reserved_units:1,lease_until:new Date().toISOString()}],['erasure_requests',{request_id:id()}]
  ];
  for(const [table,row] of seed)checked(await admin.from(table).insert({...row,user_id:created}));
  phase='preflight';const pre=checked(await admin.rpc('selfia_erasure_preflight',{p_user:created}));
  if(!pre.ready_for_auth_delete||pre.owned_storage_objects!==0||Object.keys(pre.counts).length!==22||Object.values(pre.counts).some(n=>Number(n)!==1))throw Error('preflight_failed');
  phase='revoke';checked(await admin.auth.admin.signOut(jwt,'global')); // Only the NEW disposable identity.
  phase='delete';await remove();
  phase='verify';
  for(const [table] of seed){const rows=checked(await admin.from(table).select('user_id').eq('user_id',created).limit(1));if(rows.length)throw Error('residual_data');}
  const gone=await admin.auth.admin.getUserById(created);if(!gone.error)throw Error('auth_still_present');
  const stale=await client.auth.getUser(jwt);if(!stale.error)throw Error('stale_identity_accepted');
  const old=createClient(testUrl,Deno.env.get('SUPABASE_ANON_KEY')||'',{global:{headers:{authorization:'Bearer '+jwt}},auth:{persistSession:false,autoRefreshToken:false}});
  const write=await old.from('profiles').insert({user_id:created});if(!write.error)throw Error('stale_identity_write_accepted');
  return json({passed:true,disposable_user:created,populated_owner_tables:22,residual_owner_rows:0,auth_deleted:true,stale_identity_rejected:true,stale_write_rejected:true,owned_storage_objects:0,provider_backup_retention_verified:false});
 }catch{
  return json({passed:false,phase,disposable_user:created||null,message:'La verificación no se ha completado; revisa la fase indicada.'},503);
 }finally{
  // Cleanup may delete ONLY the identity created by this request, never a supplied target.
  if(created&&!deleted){try{await remove()}catch{console.error(JSON.stringify({error_code:'disposable_cleanup_required',disposable_user:created}));}}
 }
});
