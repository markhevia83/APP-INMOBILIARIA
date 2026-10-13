// Reproducible fallback for remote bundling failures. Does not deploy or load secrets.
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../../',import.meta.url));
const allowed=new Set(['context','chat','daily','motivation','discover','operations','erasure-drill']);
const readable=process.argv.includes('--readable');
for(const name of process.argv.slice(2).filter(x=>x!=='--readable')){
 if(!allowed.has(name))throw Error('Unknown test function');
 const outfile=resolve(root,'.verification-tools/functions/selfia-'+name+'.js');
 await build({absWorkingDir:resolve(root,'selfia-app'),entryPoints:[resolve(root,'supabase/functions/selfia-'+name+'/index.ts')],outfile,bundle:true,minify:!readable,format:'esm',platform:'browser',alias:{'npm:@supabase/supabase-js@2.57.4':'@supabase/supabase-js'},logLevel:'warning'});
 const content=await readFile(outfile);console.log(JSON.stringify({function:'selfia-'+name,bytes:content.length,sha256:createHash('sha256').update(content).digest('hex')}));
}
