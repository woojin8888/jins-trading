import {readFile,writeFile} from 'node:fs/promises';
const file=path=>new URL('../'+path,import.meta.url);
const engine=(await readFile(file('src/low-signal-research.js'),'utf8')).replace(/^export /gm,'');
const template=await readFile(file('research/low-signals/template.html'),'utf8');
const data=JSON.parse(await readFile(file('research/low-signals/data.json'),'utf8'));
const stats=JSON.parse(await readFile(file('research/low-signals/stats.json'),'utf8'));
const html=template.replace('__ENGINE__',()=>engine).replace('__DATA__',()=>JSON.stringify(data)).replace('__STATS__',()=>JSON.stringify(stats));
const output=file('public/research/low-signals.html');
if(process.argv.includes('--check')){
 if(await readFile(output,'utf8')!==html)throw Error('연구실 생성 파일이 다릅니다. npm run prepare:signal-research를 실행하세요.');
 console.log('저점 신호 연구실: 소스·저장 데이터·생성 화면 일치');
}else{
 await writeFile(output,html);
 console.log('저점 신호 연구실 생성 완료');
}
