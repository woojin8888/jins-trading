import {parseKoreanHistory} from './korean-history.js';
import {koreanStock} from './rankings.js';
import etfs from './korean-etfs.json' with {type:'json'};

const DAY=86400000,fields=['open','high','low','close'],cache=new Map();
const localDate=now=>new Date(now).toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'});
const validDate=date=>typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date))&&new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date;
const samePrices=(a,b)=>fields.every(field=>Number.isFinite(a?.[field])&&Number.isFinite(b?.[field])&&Math.abs(a[field]-b[field])<=1);

export function missingKoreanStockDates(data,symbol,now=Date.now()){
  if(!/^\d{6}\.(KS|KQ)$/.test(symbol)||data.meta?.symbol!==symbol||data.meta?.currency!=='KRW')return [];
  const code=symbol.slice(0,6),stock=koreanStock(code),suffix=stock?(stock.exchange==='KOSDAQ'?'.KQ':'.KS'):etfs.names[code]?'.KS':null;
  if(!suffix||!symbol.endsWith(suffix))return [];
  const today=localDate(now),present=new Set(data.bars.map(bar=>bar.time));
  return [...new Set(data.invalidBarDates||[])].filter(date=>validDate(date)&&date<today&&!present.has(date)).sort();
}

export function parseDaumDaily(body,code,now=Date.now()){
  if(body?.code!==200||!/^\d{6}$/.test(code)||!Array.isArray(body.data))return [];
  const identity=new RegExp('^KR7'+code+'[A-Z0-9]{3}$'),today=localDate(now),rows=new Map();
  for(const row of body.data){
    if(!identity.test(row?.symbolCode||'')||!validDate(row.date)||row.date>=today)continue;
    // The timestamp is midnight KST (the preceding UTC date). Use the source's
    // explicit exchange-local date so a repaired bar cannot move to another day.
    const bar={time:row.date,open:row.openingPrice,high:row.highPrice,low:row.lowPrice,close:row.tradePrice,volume:row.candleAccTradeVolume};
    if(!fields.every(field=>Number.isFinite(bar[field])&&bar[field]>0)||bar.high<Math.max(bar.open,bar.close)||bar.low>Math.min(bar.open,bar.close)||!Number.isSafeInteger(bar.volume)||bar.volume<0)continue;
    rows.set(bar.time,bar);
  }
  return [...rows.values()].sort((a,b)=>a.time.localeCompare(b.time));
}

function compatibleContext(base,source,date){
  const rows=new Map(source.map(bar=>[bar.time,bar]));
  // Two consecutive verified bars on either side protect against a different
  // adjustment basis or volume unit. A separate field comparison verifies the
  // actual repaired day's OHLC against the second provider.
  const sides=[base.filter(bar=>bar.time<date).slice(-2),base.filter(bar=>bar.time>date).slice(0,2)];
  return sides.find(group=>group.length===2&&group.every(bar=>{
    const other=rows.get(bar.time);if(!samePrices(bar,other)||!Number.isFinite(bar.volume))return false;
    return Math.abs(bar.volume-other.volume)<=Math.max(1,bar.volume*.01);
  }))?.map(bar=>bar.time)||null;
}

export function mergeKoreanStockRepair(data,symbol,xml,verificationBodies,now=Date.now()){
  const missing=missingKoreanStockDates(data,symbol,now);if(!missing.length)return data;
  const code=symbol.slice(0,6),naver=new Map(parseKoreanHistory(xml,code,now).map(bar=>{const value={time:new Date(bar.t*1000).toISOString().slice(0,10),open:bar.o,high:bar.h,low:bar.l,close:bar.c,volume:bar.v};return [value.time,value];}));
  const source=[...new Map(verificationBodies.flatMap(body=>parseDaumDaily(body,code,now)).map(bar=>[bar.time,bar])).values()].sort((a,b)=>a.time.localeCompare(b.time)),daum=new Map(source.map(bar=>[bar.time,bar])),repairs=[];
  for(const date of missing){
    const candidate=daum.get(date),comparison=naver.get(date);if(!candidate||!comparison||!samePrices(candidate,comparison))continue;
    const contextDates=compatibleContext(data.bars,source,date);if(!contextDates)continue;
    repairs.push({date,source:'다음 금융 실제 일봉',verifiedWith:'네이버페이 증권 OHLC 대조',contextDates,sourceVolume:candidate.volume,comparisonVolume:comparison.volume,volumeDifferent:candidate.volume!==comparison.volume,volumeDifferencePercent:candidate.volume>0?Math.abs(candidate.volume-comparison.volume)/candidate.volume*100:null});
  }
  if(!repairs.length)return data;
  return {...data,bars:[...data.bars,...repairs.map(repair=>daum.get(repair.date))].sort((a,b)=>a.time.localeCompare(b.time)),repairedDailyDates:[...new Set([...(data.repairedDailyDates||[]),...repairs.map(repair=>repair.date)])].sort(),dailyRepairSource:'다음 금융 실제 일봉 · 네이버페이 증권 OHLC 대조',dailyRepairs:[...(data.dailyRepairs||[]),...repairs]};
}

async function textResponse(url,referer){
  const response=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0',Referer:referer},signal:AbortSignal.timeout(5000),cache:'no-store'});
  if(!response.ok)throw Error('historical source unavailable');const text=await response.text();if(text.length>1500000)throw Error('historical response too large');return text;
}
export async function repairKoreanStockHistory(data,symbol,now=Date.now()){
  const dates=missingKoreanStockDates(data,symbol,now).slice(0,8);if(!dates.length)return data;
  const code=symbol.slice(0,6),key=symbol+':'+dates.join(','),prior=cache.get(key);
  if(prior&&now-prior.at<prior.ttl)return prior.xml?mergeKoreanStockRepair(data,symbol,prior.xml,prior.bodies,now):data;
  try{
    const count=Math.min(3000,Math.max(40,Math.ceil((now-Date.parse(dates[0]))/DAY)+14));
    const xmlPromise=textResponse(`https://fchart.stock.naver.com/sise.nhn?symbol=${code}&timeframe=day&count=${count}&requestType=0`,'https://finance.naver.com/');
    const bodies=new Array(dates.length);let cursor=0;
    async function worker(){while(cursor<dates.length){const index=cursor++,end=new Date(Date.parse(dates[index])+7*DAY).toISOString().slice(0,10)+'T00:00:00';try{bodies[index]=JSON.parse(await textResponse(`https://finance.daum.net/api/charts/A${code}/days?`+new URLSearchParams({limit:'16',adjusted:'true',to:end}),`https://finance.daum.net/quotes/A${code}`));}catch{bodies[index]=null;}}}
    const [xml]=await Promise.all([xmlPromise,Promise.all(Array.from({length:Math.min(2,dates.length)},worker))]);
    const result=mergeKoreanStockRepair(data,symbol,xml,bodies,now);
    const restored=new Set(result.bars.map(bar=>bar.time));cache.set(key,{at:now,ttl:dates.every(date=>restored.has(date))?3600000:60000,xml,bodies});while(cache.size>200)cache.delete(cache.keys().next().value);
    return result;
  }catch{cache.set(key,{at:now,ttl:60000,xml:null});while(cache.size>200)cache.delete(cache.keys().next().value);return data;}
}
