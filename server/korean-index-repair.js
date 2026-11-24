import {parseKoreanHistory} from './korean-history.js';
const CODES={'^KS11':'KOSPI','^KQ11':'KOSDAQ'};
const fields=['open','high','low','close'];
const localDate=now=>new Date(now).toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'});

export function missingIndexDates(data,symbol,now=Date.now()){
  if(!Object.hasOwn(CODES,symbol)||data.meta?.symbol!==symbol||data.meta?.currency!=='KRW')return [];
  const today=localDate(now),cutoff=new Date(now-31*86400000).toISOString().slice(0,10),present=new Set(data.bars.map(bar=>bar.time));
  // Only dates explicitly returned with invalid OHLC are candidates. Never
  // infer a missing session from weekends, holidays or absent timestamps.
  return [...new Set(data.invalidBarDates||[])].filter(date=>date>=cutoff&&date<today&&!present.has(date)).sort();
}

export function mergeKoreanIndexRepair(data,symbol,xml,now=Date.now()){
  const missing=missingIndexDates(data,symbol,now);if(!missing.length)return data;
  const parsed=parseKoreanHistory(xml,CODES[symbol],now).map(bar=>({time:new Date(bar.t*1000).toISOString().slice(0,10),open:bar.o,high:bar.h,low:bar.l,close:bar.c,volume:null}));
  const source=new Map(parsed.map(bar=>[bar.time,bar]));
  const anchors=data.bars.filter(bar=>bar.time<missing[0]&&source.has(bar.time)).slice(-2);
  // Check the same index and point scale against two prior closed OHLC bars.
  if(anchors.length<2||anchors.some(bar=>fields.some(field=>Math.abs(bar[field]-source.get(bar.time)[field])>.011)))return data;
  const restored=missing.flatMap(date=>source.has(date)?[source.get(date)]:[]);if(!restored.length)return data;
  return {...data,bars:[...data.bars,...restored].sort((a,b)=>a.time.localeCompare(b.time)),repairedDailyDates:restored.map(bar=>bar.time),dailyRepairSource:'네이버페이 증권 · '+CODES[symbol]+' 실제 일봉'};
}

export async function repairKoreanIndexHistory(data,symbol,now=Date.now()){
  if(!missingIndexDates(data,symbol,now).length)return data;
  try{
    const response=await fetch(`https://fchart.stock.naver.com/sise.nhn?symbol=${CODES[symbol]}&timeframe=day&count=40&requestType=0`,{headers:{'User-Agent':'Mozilla/5.0',Referer:'https://finance.naver.com/'},signal:AbortSignal.timeout(5000),cache:'no-store'});
    if(!response.ok)return data;const xml=await response.text();if(xml.length>1000000)return data;
    return mergeKoreanIndexRepair(data,symbol,xml,now);
  }catch{return data;}
}
