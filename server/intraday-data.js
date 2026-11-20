import {parseGlobalIntraday} from './global-intraday.js';
import {assetKind,hasVolume} from '../src/instruments.js';
import {parseDailyHistory,intradayQuality} from './history-data.js';
import {sessionCoverage} from './session-coverage.js';
export const INTRADAY={ '15m':{source:'15m',range:'1mo',seconds:900},'30m':{source:'30m',range:'1mo',seconds:1800},'1h':{source:'60m',range:'2y',seconds:3600},'4h':{source:'60m',range:'2y',seconds:14400}};
const parts=(time,formatter)=>Object.fromEntries(formatter.formatToParts(new Date(time*1000)).map(p=>[p.type,p.value]));
function periods(value){if(Array.isArray(value))return value.flatMap(periods);if(value&&Number.isFinite(value.start)&&Number.isFinite(value.end))return [value];if(value&&typeof value==='object')return Object.values(value).flatMap(periods);return [];}
export function parseIntraday(result,symbol,interval){
  const config=INTRADAY[interval];if(!config)throw Error('지원하지 않는 분봉 주기입니다.');
  const zone=result.meta?.exchangeTimezoneName,kind=assetKind(symbol);if(!/\.(KS|KQ)$/.test(symbol)&&!['^KS11','^KQ11'].includes(symbol)&&(!(zone==='America/New_York'&&['stock','etf','index'].includes(kind))||symbol==='DX-Y.NYB'))return parseGlobalIntraday(result,symbol,interval,config);
  // Reuse identity/currency validation and quote metadata, not the daily bars.
  const info=parseDailyHistory({...result,timestamp:[]},symbol),timeZone=info.timeZone,kr=/\.(KS|KQ)$/.test(symbol)||['^KS11','^KQ11'].includes(symbol),sessions=periods(result.meta.tradingPeriods?.regular??result.meta.tradingPeriods),q=result.indicators?.quote?.[0]||{},sourceSeconds=interval==='4h'?3600:config.seconds;
  const formatter=new Intl.DateTimeFormat('en-GB',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  let providerSessionDiffers=false;
  const quoteTime=Number.isFinite(result.meta.regularMarketTime)?result.meta.regularMarketTime:Math.floor(Date.now()/1000);
  let invalid=0,snapshots=0;const bars=[],observedSessions=[];
  for(const [i,time] of (result.timestamp||[]).entries()){
    if(!Number.isFinite(time)){invalid++;continue;}
    const p=parts(time,formatter),minute=Number(p.hour)*60+Number(p.minute),openMinute=kr?540:570;
    const defaultStart=time-(minute-openMinute)*60-Number(p.second),session=sessions.find(s=>time>=s.start&&time<=s.end),start=session?.start??defaultStart;
    // Yahoo publishes a 15:00 KRX end in some responses; KRX regular trading is
    // 09:00–15:30. US provider sessions retain early-close/DST boundaries.
    const end=kr?start+390*60:session?.end??start+390*60,providerEnd=session?.end??end;
    if(kr&&providerEnd!==end)providerSessionDiffers=true;
    if(time<start||time>=end){snapshots++;continue;}
    if((time-start)%sourceSeconds!==0){snapshots++;continue;}
    observedSessions.push({start,end});
    const bar={time,open:q.open?.[i],high:q.high?.[i],low:q.low?.[i],close:q.close?.[i],volume:hasVolume(symbol)&&Number.isFinite(q.volume?.[i])&&q.volume[i]>=0?q.volume[i]:null,sessionStart:start,sessionEnd:end,providerEnd,endTime:Math.min(time+sourceSeconds,end)};
    if(![bar.open,bar.high,bar.low,bar.close].every(n=>Number.isFinite(n)&&n>0)||bar.high<Math.max(bar.open,bar.close)||bar.low>Math.min(bar.open,bar.close)){invalid++;continue;}
    // A flat zero-volume closing snapshot at Yahoo's erroneous KRX 15:00
    // boundary is not a real 15:00–15:15/15:30 candle or a missing closing hour.
    if(kr&&time===providerEnd&&providerEnd<end&&bar.volume===0&&bar.open===bar.high&&bar.high===bar.low&&bar.low===bar.close){snapshots++;continue;}
    bar.complete=bar.endTime<=quoteTime;bars.push(bar);
  }
  let unique=[...new Map(bars.map(bar=>[bar.time,bar])).values()].sort((a,b)=>a.time-b.time),incompleteGroups=0;
  const sourceCoverage=sessionCoverage(unique,observedSessions,sourceSeconds,quoteTime,Math.min(...(result.timestamp||[]).filter(Number.isFinite)));
  if(interval==='4h'){
    const groups=new Map();
    for(const bar of unique){const key=bar.sessionStart+Math.floor((bar.time-bar.sessionStart)/14400)*14400,current=groups.get(key);if(current)current.push(bar);else groups.set(key,[bar]);}
    unique=[...groups].flatMap(([time,members])=>{
      if(members[0].time!==time||members.some((bar,index)=>bar.time!==time+index*3600)){incompleteGroups++;return [];}
      const last=members.at(-1),endTime=Math.min(time+14400,last.sessionEnd),bar={...members[0],time,high:Math.max(...members.map(b=>b.high)),low:Math.min(...members.map(b=>b.low)),close:last.close,volume:members.every(b=>b.volume!==null)?members.reduce((sum,b)=>sum+b.volume,0):null,endTime,complete:endTime<=quoteTime};
      if(bar.complete&&last.endTime<endTime){incompleteGroups++;return [];}
      return [bar];
    });
  }
  if(!unique.length)throw Error('분봉 데이터가 제공되지 않거나 유효한 정규장 봉이 없습니다. 일봉을 선택해 주세요.');
  return {symbol,currency:result.meta.currency,timeZone,interval,bars:unique,asOf:new Date(unique.at(-1).time*1000).toISOString(),quote:info.quote,quality:{intraday:true,sessionOpen:unique.at(-1).complete===false,...intradayQuality(info,unique),...sourceCoverage,invalidBarCount:invalid,snapshotQuotesSkipped:snapshots,incompleteGroups,providerSessionDiffers,regularSessionOnly:true},coverage:{from:new Date(unique[0].time*1000).toISOString(),to:new Date(unique.at(-1).time*1000).toISOString(),sourceInterval:config.source,range:config.range},source:`Yahoo Finance · 정규장 ${interval}${interval==='4h'?' (1시간봉 집계)':''} · 배당 보정 미적용`};
}
