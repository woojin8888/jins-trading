import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),target=new URL('supabase/functions/trading-alert-worker/shared/',root);
await mkdir(target,{recursive:true});
for(const name of ['alert-engine.js','analysis.js','pine-minervini.js','timeframes.js']){
  const source=await readFile(new URL('src/'+name,root),'utf8'),path=new URL(name,target);
  if(process.argv.includes('--check')){if(await readFile(path,'utf8')!==source)throw Error('Run npm run prepare:alerts to synchronize '+fileURLToPath(path));}
  else await writeFile(path,source);
}
console.log('Alert worker shared calculations synchronized.');
