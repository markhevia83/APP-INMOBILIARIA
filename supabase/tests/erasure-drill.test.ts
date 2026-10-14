import assert from 'node:assert/strict';
Deno.test('erasure drill refuses real identities and supplied targets, deletes only its own disposable user and checks stale access',async()=>{
 const serve=Deno.serve,fetcher=globalThis.fetch,vars=['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY'],old=vars.map(x=>Deno.env.get(x));
 const auditor='892e6eae-5abb-4ff3-bfe7-b9d371101931',fixture=crypto.randomUUID(),jwt='synthetic-fixture';
 let handler:any,actor=auditor,email='',deleted=false,creates=0,deletes=0,writes=0;
 const respond=(v:any,status=200)=>new Response(v===null?null:JSON.stringify(v),{status,headers:{'content-type':'application/json'}});
 try{
  vars.forEach(x=>Deno.env.set(x,x==='SUPABASE_URL'?'https://tleqdegnzeukonbbrrzk.supabase.co':'synthetic'));
  Object.defineProperty(Deno,'serve',{configurable:true,value:(fn:any)=>handler=fn});
  globalThis.fetch=(async(input:any,init:any)=>{
   const url=new URL(input instanceof Request?input.url:String(input)),method=init?.method||'GET',body=init?.body?JSON.parse(init.body):null;
   const headers=new Headers(init?.headers);
   if(url.pathname==='/auth/v1/user')return headers.get('authorization')==='Bearer '+jwt&&deleted?respond({message:'deleted'},401):respond({id:actor,email:actor===auditor?'selfia-e2e-guard@example.invalid':'real-person@example.com'});
   if(url.pathname==='/auth/v1/admin/users'&&method==='POST'){creates++;email=body.email;assert.match(email,/^selfia-erasure-.*@example\.invalid$/);return respond({id:fixture,email});}
   if(url.pathname==='/auth/v1/token')return respond({user:{id:fixture,email},access_token:jwt,refresh_token:'synthetic',token_type:'bearer',expires_in:3600});
   if(url.pathname==='/auth/v1/logout'){assert.equal(headers.get('authorization'),'Bearer '+jwt);return respond(null,204);}
   if(url.pathname==='/auth/v1/admin/users/'+fixture){
    if(method==='DELETE'){assert.equal(body?.should_soft_delete,false);deleted=true;deletes++;return respond({id:fixture,email});}
    return deleted?respond({message:'gone'},404):respond({id:fixture,email});
   }
   if(url.pathname==='/rest/v1/rpc/selfia_erasure_preflight'){assert.equal(body.p_user,fixture);return respond({ready_for_auth_delete:true,owned_storage_objects:0,counts:Object.fromEntries(Array.from({length:22},(_,i)=>['table'+i,1]))});}
   if(url.pathname.startsWith('/rest/v1/')){
    if(method==='POST'){
     assert.equal(body.user_id,fixture,'must never write auditor or real identity');
     if(headers.get('authorization')==='Bearer '+jwt&&deleted)return respond({message:'foreign key',code:'23503'},409);
     writes++;return respond(null,201);
    }
    assert.ok(deleted,'residual verification must follow deletion');return respond([]);
   }
   throw Error('Unexpected access: '+method+' '+url.pathname);
  }) as typeof fetch;
  await import('../functions/selfia-erasure-drill/index.ts?guard-test');
  const call=(body:any,auth=true)=>handler(new Request('https://synthetic.invalid',{method:'POST',headers:auth?{authorization:'Bearer synthetic-auditor'}:{},body:JSON.stringify(body)}));
  assert.equal((await call({},false)).status,401);actor=crypto.randomUUID();assert.equal((await call({confirm:'DISPOSABLE_TEST_ACCOUNT_ONLY'})).status,403);actor=auditor;
  assert.equal((await call({confirm:'DISPOSABLE_TEST_ACCOUNT_ONLY',user_id:auditor})).status,400);assert.equal(creates,0);
  const result=await call({confirm:'DISPOSABLE_TEST_ACCOUNT_ONLY'});assert.equal(result.status,200);const data=await result.json();assert.equal(data.passed,true);assert.equal(data.stale_write_rejected,true);assert.equal(data.provider_backup_retention_verified,false);
  assert.equal(creates,1);assert.equal(deletes,1);assert.equal(writes,22);
 }finally{Object.defineProperty(Deno,'serve',{configurable:true,value:serve});globalThis.fetch=fetcher;vars.forEach((v,i)=>old[i]===undefined?Deno.env.delete(v):Deno.env.set(v,old[i]!));}
});
