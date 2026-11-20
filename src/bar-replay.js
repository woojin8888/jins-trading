import {aggregate} from './analysis.js';
import {completedAnalysisBars,isIntraday} from './timeframes.js';
import {assetKind} from './instruments.js';
const seconds={'15m':900,'30m':1800,'1h':3600,'4h':14400};
export const REPLAY_SPEEDS=[1,2,5];
function day(time,timeZone){
  return typeof time==='string'?time:new Date(time*1000).toLocaleDateString('sv-SE',{timeZone});
}
function group(time,interval){
  if(!['W','M'].includes(interval))return time;
  const d=new Date(time+'T00:00:00Z');
  if(interval==='M')d.setUTCDate(1);else d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));
  return d.toISOString().slice(0,10);
}
export function createReplaySession({chart,daily,benchmark,interval,now=Date.now()}){
  if(!chart?.bars?.length)throw Error('차트 자료를 불러온 뒤 리플레이를 시작하세요.');
  const source=structuredClone(chart),dailySource=daily?.symbol===chart.symbol?structuredClone(daily):null,bench=benchmark?structuredClone(benchmark):null;
  const frames=completedAnalysisBars(aggregate(source.bars,interval),interval,source.quality?.sessionOpen,{timeZone:source.timeZone,now,assetType:assetKind(source.symbol)}).map(bar=>({...bar}));
  if(!frames.length)throw Error('리플레이에 사용할 확정 봉이 없습니다.');
  let index=-1;
  for(const frame of frames){
    while(index+1<source.bars.length&&group(source.bars[index+1].time,interval)===frame.time)index++;
    frame.sourceIndex=index;
    const last=source.bars[index];
    frame.endTime=typeof last.time==='number'?(last.endTime??last.time+seconds[interval]):null;
    frame.date=day(last.time,source.timeZone||'UTC');
    frame.startDate=day(frame.time,source.timeZone||'UTC');
  }
  return {chart:source,daily:dailySource,benchmark:bench,interval,frames};
}
export function replayCursor(value,length){
  return Math.max(0,Math.min(length-1,Number.isFinite(value)?Math.trunc(value):0));
}
export function replayDateIndex(frames,date){
  if(!frames.length)return 0;
  const index=frames.findIndex(f=>f.startDate>=date);
  return index<0?frames.length-1:index;
}
export function replayStep(state,delta=1){
  const cursor=replayCursor(state.cursor+delta,state.session.frames.length);
  return {...state,cursor,playing:state.playing&&cursor<state.session.frames.length-1};
}
export function replaySnapshot(session,cursor){
  const frame=session.frames[replayCursor(cursor,session.frames.length)],chartBars=session.chart.bars.slice(0,frame.sourceIndex+1);
  // A daily candle includes the rest of its session. Intraday replay must never
  // use that candle's future high/low/close/volume in daily analysis cards.
  const dailyBars=(session.daily?.bars||[]).filter(b=>isIntraday(session.interval)?b.time<frame.date:b.time<=frame.date);
  const benchmark=(session.benchmark?.bars||[]).filter(b=>typeof b.time==='number'?(b.endTime??b.time+seconds[session.interval])<=frame.endTime:b.time<=frame.date);
  const previousClose=session.frames[replayCursor(cursor,session.frames.length)-1]?.close;
  const changePercent=Number.isFinite(previousClose)&&previousClose!==0?(frame.close/previousClose-1)*100:null;
  return {frame,chartBars,dailyBars,benchmark,price:frame.close,changePercent};
}
