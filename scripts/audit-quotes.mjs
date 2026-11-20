import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {auditHistory,compareNasdaqHistory} from '../server/data-audit.js';

const args=process.argv.slice(2),option=(key,fallback)=>{const index=args.indexOf(key);return index<0?fallback:args[index+1];};
const base=new URL(option('--url','https://jins-trading.vercel.app'));
if(!['https:','http:'].includes(base.protocol)||base.username||base.password)throw Error('인증정보 없는 HTTP(S) 사이트 주소를 지정하세요.');
const output=resolve(option('--output',`./audit-results/quotes-${Date.now()}.json`));
const rounds=Number(option('--rounds','1'));
if(!Number.isInteger(rounds)||rounds<1||rounds>3)throw Error('--rounds는 1~3 사이입니다. 반복 실행은 1분 간격입니다.');
const cases=[['us','NVDA','1d'],['etf','SPY','1d'],['kr','005930','1d'],['kr','000660','1d'],['indices','^GSPC','1d'],['fx','JPY=X','1d'],['us','NVDA','15m'],['us','NVDA','4h'],['kr','005930','15m'],['kr','005930','30m'],['kr','005930','1h'],['kr','005930','4h'],['commodities','GC=F','4h'],['hk','0700.HK','4h']];
const headers={'User-Agent':'Mozilla/5.0','Accept':'application/json'};
async function get(url){const response=await fetch(url,{headers,signal:AbortSignal.timeout(25000),cache:'no-store'});if(!response.ok)throw Error(`HTTP ${response.status}`);return response.json();}
const report={site:base.origin,startedAt:new Date().toISOString(),method:{historicalPriceAbsoluteTolerance:.01,historicalVolumeRelativeTolerancePercent:.1,historyMaxBarsPerSymbol:14,independentReference:'Nasdaq historical · NVDA/SPY only',notMeasured:['전체 사이트 신뢰도 백분율','장기간 가동률','거래소 원장과의 일치율','TradingView 원본 지표 실행 결과']},rounds:[]};
for(let round=0;round<rounds;round++){
  if(round)await new Promise(resolve=>setTimeout(resolve,60000));
  const current={startedAt:new Date().toISOString(),observations:[],referenceChecks:[]},histories=new Map();
  // Bound concurrency and request count; no database, broker key, cron, or paid monitor.
  for(let i=0;i<cases.length;i+=3)await Promise.all(cases.slice(i,i+3).map(async([market,symbol,interval])=>{
    const url=new URL('/api/market',base);url.search=new URLSearchParams({market,symbol,interval,range:'2y',fresh:'1'}).toString();const started=Date.now();
    try{const history=await get(url);histories.set(`${symbol}:${interval}`,history);current.observations.push({market,symbol,interval,ok:true,elapsedMs:Date.now()-started,checkedAt:new Date().toISOString(),source:history.source,quote:history.quote,quality:history.quality,...auditHistory(history)});}
    catch(error){current.observations.push({market,symbol,interval,ok:false,error:error.message,checkedAt:new Date().toISOString()});}
  }));
  for(const [symbol,assetclass] of [['NVDA','stocks'],['SPY','etf']]){
    const history=histories.get(`${symbol}:1d`);if(!history)continue;
    if(args.includes('--skip-reference')){current.referenceChecks.push({symbol,status:'skipped'});continue;}
    const to=history.bars.at(-1).time,fromDate=new Date(to+'T00:00:00Z');fromDate.setUTCDate(fromDate.getUTCDate()-31);
    const url=new URL(`https://api.nasdaq.com/api/quote/${symbol}/historical`);url.search=new URLSearchParams({assetclass,fromdate:fromDate.toISOString().slice(0,10),todate:to,limit:'30'}).toString();
    try{const comparisons=compareNasdaqHistory(history,await get(url));current.referenceChecks.push({symbol,url:url.href,status:comparisons.length?'compared':'no-overlap',comparisons});}
    catch(error){current.referenceChecks.push({symbol,url:url.href,status:'unavailable',error:error.message});}
  }
  current.finishedAt=new Date().toISOString();report.rounds.push(current);
  const observations=report.rounds.flatMap(r=>r.observations),comparisons=report.rounds.flatMap(r=>r.referenceChecks.flatMap(c=>c.comparisons||[]));
  const count=rows=>({matched:rows.filter(x=>x.match).length,total:rows.length,percent:rows.length?rows.filter(x=>x.match).length/rows.length*100:null});
  report.summary={apiSuccessful:observations.filter(o=>o.ok).length,apiTotal:observations.length,integrityFailures:observations.filter(o=>!o.ok||o.errors.length).length,observationsWithWarnings:observations.filter(o=>o.warnings?.length).length,referenceChecksIncomplete:report.rounds.flatMap(r=>r.referenceChecks).filter(r=>r.status!=='compared').length,priceSample:count(comparisons.filter(c=>c.field!=='volume')),volumeSample:count(comparisons.filter(c=>c.field==='volume')),overallReliabilityPercent:null};
  report.finishedAt=current.finishedAt;await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2));
  console.log(JSON.stringify({round:round+1,...report.summary,output}));
}
if(report.summary.integrityFailures||report.summary.priceSample.matched<report.summary.priceSample.total)process.exitCode=1;
else if(!args.includes('--skip-reference')&&(report.summary.referenceChecksIncomplete||!report.summary.priceSample.total))process.exitCode=2;
