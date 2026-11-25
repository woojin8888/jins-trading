import {readFile,mkdir,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url),target=new URL('public/source/',root);
await mkdir(target,{recursive:true});
for(const file of ['pine-template.js','pine-minervini.js']){
 const source=await readFile(new URL('src/'+file,root),'utf8'),path=new URL(file,target);
 if(process.argv.includes('--check')){if(await readFile(path,'utf8')!==source)throw Error('Run npm run prepare:pine to synchronize licensed Pine source.');}
 else await writeFile(path,source);
}
