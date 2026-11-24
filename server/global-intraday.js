import {parseDailyHistory,intradayQuality} from './history-data.js';
import {assetKind,hasVolume,reportedVolume,indexVolumeBasis} from '../src/instruments.js';
const periods=value=>Array.isArray(value)?value.flatMap(periods):value&&Number.isFinite(value.start)&&Number.isFinite(value.end)?[value]:value&&typeof value==='object'?Object.values(value).flatMap(periods):[];
// Foreign exchanges, FX and futures retain provider timestamps and breaks.
// Four-hour bars group at most four consecutive real hourly bars per session;
// a lunch break, holiday, maintenance break or missing source bar starts a new run.
export function parseGlobalIntraday(result,symbol,interval,config){
 const info=parseDailyHistory({...result,timestamp:[]},symbol),q=result.indicators?.quote?.[0]||{},sessions=periods(result.meta.tradingPeriods?.regular??result.meta.tradingPeriods),seconds=interval==='4h'?3600:config.seconds,kind=assetKind(symbol),quoteTime=result.meta.regularMarketTime??Math.floor(Date.now()/1000),format=new Intl.DateTimeFormat('sv-SE',{timeZone:info.timeZone,year:'numeric',month:'2-digit',day:'2-digit'});
 let invalid=0,snapshots=0;const bars=[],coverageStart=sessions.length?Math.min(...sessions.map(s=>s.start)):Infinity,coverageEnd=sessions.length?Math.max(...sessions.map(s=>s.end)):-Infinity;
 for(const [i,time] of (result.timestamp||[]).entries()){
  if(!Number.isFinite(time)){invalid++;continue;}
  const matching=sessions.filter(s=>time>=s.start&&time<s.end).sort((a,b)=>(a.end-a.start)-(b.end-b.start)),session=matching[0];
  if(sessions.length&&time>=coverageStart&&time<=coverageEnd&&!session){snapshots++;continue;}
  const o=q.open?.[i],h=q.high?.[i],l=q.low?.[i],c=q.close?.[i];
  if(![o,h,l,c].every(v=>Number.isFinite(v)&&(kind==='future'||v>0))||h<Math.max(o,c)||l>Math.min(o,c)){invalid++;continue;}
  if(i===result.timestamp.length-1&&time===quoteTime&&time%300!==0&&o===h&&h===l&&l===c){snapshots++;continue;}
  const endTime=Math.min(time+seconds,session?.end??Infinity);
  bars.push({time,open:o,high:h,low:l,close:c,volume:reportedVolume(symbol,q.volume?.[i]),sessionStart:session?.start??null,sessionEnd:session?.end??null,endTime,complete:endTime<=quoteTime,date:format.format(new Date(time*1000))});
 }
 let unique=[...new Map(bars.map(b=>[b.time,b])).values()].sort((a,b)=>a.time-b.time),splitRuns=0;
 if(interval==='4h'){
  const runs=[];for(const bar of unique){const run=runs.at(-1),previous=run?.at(-1);if(!previous||(!bar.sessionStart&&bar.date!==previous.date)||bar.sessionStart!==previous.sessionStart||bar.time!==previous.time+3600){runs.push([bar]);if(previous)splitRuns++;}else run.push(bar);}
  unique=runs.flatMap(run=>{const grouped=[];for(let i=0;i<run.length;i+=4){const members=run.slice(i,i+4),first=members[0],last=members.at(-1);grouped.push({...first,high:Math.max(...members.map(b=>b.high)),low:Math.min(...members.map(b=>b.low)),close:last.close,volume:members.every(b=>b.volume!==null)?members.reduce((n,b)=>n+b.volume,0):null,endTime:last.endTime,complete:last.complete});}return grouped;});
 }
 if(!unique.length)throw Error('이 자산의 해당 분봉은 제공되지 않습니다. 일봉을 선택해 주세요.');
 return {symbol,currency:info.meta.currency,timeZone:info.timeZone,interval,volumeBasis:indexVolumeBasis(symbol),bars:unique.map(({date,...bar})=>bar),asOf:new Date(unique.at(-1).time*1000).toISOString(),quote:info.quote,quality:{intraday:true,sessionOpen:!unique.at(-1).complete,...intradayQuality(info,unique),invalidBarCount:invalid,snapshotQuotesSkipped:snapshots,incompleteGroups:0,splitRuns,providerSessions:true,volumeUnavailable:!hasVolume(symbol)},coverage:{from:new Date(unique[0].time*1000).toISOString(),to:new Date(unique.at(-1).time*1000).toISOString(),sourceInterval:config.source,range:config.range},source:`Yahoo Finance · 제공처 세션 ${interval}${interval==='4h'?' (연속 실제 1시간봉 최대 4개, 휴장·중간 공백 분리)':''} · 배당 보정 미적용`};
}
