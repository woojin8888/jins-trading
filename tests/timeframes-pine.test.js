import test from 'node:test';
import assert from 'node:assert/strict';
import {uploadedRS,uploadedMinervini} from '../src/pine-minervini.js';
import {parseIntraday} from '../server/intraday-data.js';
import {routeMarket} from '../server/market.js';
import {aggregate} from '../src/analysis.js';
import {chartTimeKey,resolveCandle,formatVolume} from '../src/technical-math.js';
import {completedAnalysisBars,formatBarTime,tickTime} from '../src/timeframes.js';
import {defaultChartPreferences,normalizePreferences} from '../src/chart-preferences.js';
import {drawingTimeMap,chartAnchorTime,normalizeDrawings} from '../src/drawing-model.js';
import {INDICATORS,createStudy,calculateStudy} from '../src/indicators.js';
const sec=iso=>Date.parse(iso)/1000,near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const daily=length=>Array.from({length},(_,i)=>({time:new Date(Date.UTC(2025,0,i+1)).toISOString().slice(0,10),open:100,high:101,low:99,close:100,volume:1000}));
function source({kr=false,start=sec('2026-11-17T14:30:00Z'),count=7,seconds=3600,earlyEnd=null,quoteAt=null,snapshot=true}={}){
  const end=earlyEnd??start+390*60,times=Array.from({length:count},(_,i)=>start+i*seconds),q={open:[],high:[],low:[],close:[],volume:[]};times.forEach((_,i)=>{q.open.push(100+i);q.high.push(102+i);q.low.push(99+i);q.close.push(101+i);q.volume.push(100);});
  if(snapshot){times.push(quoteAt??end);q.open.push(105);q.high.push(105);q.low.push(105);q.close.push(105);q.volume.push(0);}
  return {meta:{symbol:kr?'005930.KS':'NVDA',currency:kr?'KRW':'USD',exchangeTimezoneName:kr?'Asia/Seoul':'America/New_York',regularMarketTime:quoteAt??end,regularMarketPrice:105,tradingPeriods:[[{start,end}]]},timestamp:times,indicators:{quote:[q]}};
}
test('uploaded RS reproduces the actual 13/26/39/52-bar Pine expression, including the 2/3/4 divisors',()=>{
  const data=daily(100);data.at(-1).close=120;data[99-13].close=80;data[99-26].close=90;data[99-39].close=100;data[99-52].close=110;
  const expected=(.4*(120/80)+.2*(120/(90*2))+.2*(120/(100*3))+.2*(120/(110*4)))*100;near(uploadedRS(data).at(-1).value,expected);near(uploadedRS(daily(60)).at(-1).value,61+2/3);assert.equal(uploadedRS(daily(52)).length,0);
});
test('Pine RS is causal, uses selected candle offsets, and preserves its timestamps',()=>{
  const data=daily(120),before=uploadedRS(data.slice(0,90)),after=uploadedRS(data);assert.deepEqual(after.slice(0,before.length),before);
  const numeric=data.map((bar,i)=>({...bar,time:sec('2026-11-17T14:30:00Z')+i*900}));assert.equal(uploadedRS(numeric).at(-1).time,numeric.at(-1).time);near(uploadedRS(numeric).at(-1).value,61+2/3);
});
test('uploaded Minervini uses the source 25-percent low condition, available 260-bar range and strict RS > 70',()=>{
  const data=daily(260);data.forEach(b=>{b.low=80;b.high=120;});const last=data.length-1;data[last-52].close=50;data[last-39].close=200/3;
  const result=uploadedMinervini(data);near(result.rs,70);assert.equal(result.checks[7].pass,false);assert.equal(result.checks[5].pass,true);assert.equal(result.low,80);data.at(-1).close=100.01;assert.equal(uploadedMinervini(data).checks[7].pass,true);
  data[0].high=200;data[0].low=40;assert.equal(uploadedMinervini(data).high,200);assert.equal(uploadedMinervini(data).low,40);assert.equal(uploadedMinervini(data.slice(0,10)).low,40);
});
test('the analysis table excludes a forming bar while the selected timeframe determines the lookback unit',()=>{
  const data=daily(60);assert.equal(completedAnalysisBars(data,'D',true).length,59);assert.equal(completedAnalysisBars(data,'D',false).length,60);
  const intraday=data.map((bar,i)=>({...bar,time:i*900,complete:i<59}));assert.equal(completedAnalysisBars(intraday,'15m',false).length,59);assert.equal(completedAnalysisBars(intraday.slice(0,-1),'15m',true).length,59);
});
test('four-hour candles start at NY 09:30, retain a shorter closing candle and conserve real source OHLCV',()=>{
  const result=parseIntraday(source(),'NVDA','4h');assert.equal(result.bars.length,2);const [first,last]=result.bars;assert.equal(first.time,sec('2026-11-17T14:30:00Z'));assert.equal(last.time,sec('2026-11-17T18:30:00Z'));assert.equal(first.open,100);assert.equal(first.high,105);assert.equal(first.low,99);assert.equal(first.close,104);assert.equal(first.volume,400);assert.equal(last.volume,300);assert.equal(last.endTime,sec('2026-11-17T21:00:00Z'));assert.equal(result.quality.snapshotQuotesSkipped,1);
});
test('US summer-time and early-close sessions retain the provider session boundary',()=>{
  const start=sec('2026-10-30T13:30:00Z'),result=parseIntraday(source({start,count:4,earlyEnd:start+210*60}),'NVDA','4h');assert.equal(result.bars.length,1);assert.equal(result.bars[0].endTime,start+210*60);assert.equal(result.bars[0].volume,400);assert.equal(formatBarTime(start,'America/New_York'),'10-30 09:30');assert.equal(tickTime(start,3,'America/New_York'),'09:30');
});
test('a partial first group is omitted and no four-hour candle combines different trading sessions',()=>{
  const raw=source({snapshot:false});raw.timestamp=raw.timestamp.slice(2);for(const key of Object.keys(raw.indicators.quote[0]))raw.indicators.quote[0][key]=raw.indicators.quote[0][key].slice(2);
  const parsed=parseIntraday(raw,'NVDA','4h');assert.equal(parsed.bars.length,1);assert.equal(parsed.quality.incompleteGroups,1);assert.equal(parsed.bars[0].time,sec('2026-11-17T18:30:00Z'));
});
test('KR provider session differences are disclosed without fabricating missing half-hour OHLCV',()=>{
  const start=sec('2026-11-17T00:00:00Z'),data=source({kr:true,start,count:6,earlyEnd:start+360*60,quoteAt:start+390*60});const parsed=parseIntraday(data,'005930.KS','4h');assert.equal(parsed.bars.length,1);assert.equal(parsed.bars[0].endTime,start+240*60);assert.equal(parsed.quality.incompleteGroups,1);assert.equal(parsed.quality.providerSessionDiffers,true);assert.equal(parsed.quality.missingSourceBars,1);assert.equal(parsed.quality.missingSourceSeconds,1800);assert.deepEqual(parsed.quality.sourceGaps,[{start:start+360*60,end:start+390*60}]);
});
test('off-grid quote snapshots are excluded and an actual forming intraday candle is unconfirmed',()=>{
  const start=sec('2026-11-17T14:30:00Z'),raw=source({start,count:3,seconds:900,quoteAt:start+31*60});const result=parseIntraday(raw,'NVDA','15m');assert.equal(result.bars.length,3);assert.equal(result.quality.snapshotQuotesSkipped,1);assert.equal(result.bars.at(-1).complete,false);assert.equal(result.bars.at(-1).volume,100);
});
test('intraday API validation rejects unsupported intervals and requests actual fifteen-minute source bars',async t=>{
  const original=global.fetch;t.after(()=>{global.fetch=original;});let requested;
  global.fetch=async url=>{requested=new URL(url);return Response.json({chart:{result:[source({count:26,seconds:900})]}});};
  const result=await routeMarket(new URL('https://test/api/market?symbol=NVDA&interval=15m'));const data=await result.json();assert.equal(result.status,200);assert.equal(requested.searchParams.get('interval'),'15m');assert.equal(requested.searchParams.get('range'),'1mo');assert.equal(data.interval,'15m');assert.equal(typeof data.bars[0].time,'number');
  const invalid=await routeMarket(new URL('https://test/api/market?symbol=NVDA&interval=2m'));assert.equal(invalid.status,400);
});
test('timestamp crosshair lookups never collapse intraday candles to the same daily date',()=>{
  const a={time:sec('2026-11-17T14:30:00Z'),close:100},b={time:sec('2026-11-17T14:45:00Z'),close:110},map=new Map([[a.time,a],[b.time,b]]);assert.equal(chartTimeKey(a.time),a.time);assert.equal(resolveCandle(map,a.time),a);assert.equal(resolveCandle(map,b.time),b);assert.notEqual(chartTimeKey(a.time),chartTimeKey(b.time));
});
test('all existing study calculations accept real numeric intraday timestamps',()=>{
  const bars=daily(400).map((bar,i)=>({...bar,time:sec('2026-11-17T14:30:00Z')+i*900,close:100+i*.1+Math.sin(i*.2)*3,high:105+i*.1,low:95+i*.1}));
  assert.equal(aggregate(bars,'15m'),bars);for(const definition of INDICATORS){const result=calculateStudy(createStudy(definition.type),bars);if(result.template?.kind==='pineVolumeProfile'){assert.equal(result.template.currentAsOf,bars.at(-1).time);assert.ok(result.template.profile.bins.every(bin=>Number.isFinite(bin.total)));continue;}if(result.template){assert.equal(typeof result.template.table.asOf,'number');assert.equal(result.template.table.asOf,bars.at(-1).time);assert.ok(Number.isFinite(result.template.table.rs));continue;}for(const series of result.series){assert.ok(series.data.length>0,definition.type);assert.ok(series.data.every(point=>typeof point.time==='number'&&Number.isFinite(point.value)),definition.type);}}
});
test('Korean short volume labels stay readable while exact share counts remain available',()=>{
  assert.equal(formatVolume(12345678,'korean'),'1,234.6만주');assert.equal(formatVolume(123456789,'korean'),'1.23억주');assert.equal(formatVolume(1200,'korean'),'1.2천주');assert.equal(formatVolume(12345678,'shares'),'12,345,678주');assert.equal(formatVolume(null,'korean'),'—');
});
test('existing preferences migrate to readable volume and persist the optional ticker watermark and RS mode',()=>{
  const prior=normalizePreferences({version:2,volume:{format:'shares'},showVolume:false,showRS:false});assert.equal(prior.volume.format,'korean');assert.equal(prior.showVolume,false);assert.equal(prior.showRS,false);assert.equal(prior.showTickerWatermark,true);assert.equal(prior.rsMode,'uploaded');
  const selected={...defaultChartPreferences(),showTickerWatermark:false,rsMode:'benchmark',volume:{...prior.volume,format:'shares'}};assert.deepEqual(normalizePreferences(JSON.parse(JSON.stringify(selected))),selected);
});
test('drawings retain their trading date when switching between daily and intraday views',()=>{
  const open=sec('2026-11-17T14:30:00Z'),minuteMap=drawingTimeMap([{time:open},{time:open+900}],'America/New_York'),dailyMap=drawingTimeMap([{time:'2026-11-17'}],'America/New_York'),dailyPoint={time:Date.parse('2026-11-17T00:00:00Z'),price:100,dateOnly:true},minutePoint={time:(open+900)*1000,price:110,dateOnly:false};
  assert.equal(chartAnchorTime(dailyPoint,minuteMap),open*1000);assert.equal(chartAnchorTime(minutePoint,dailyMap),dailyPoint.time);const saved=normalizeDrawings({version:1,items:[{id:'line',type:'trend',points:[dailyPoint,minutePoint],color:'#123456',width:2,text:'',visible:true}]});assert.deepEqual(saved.items[0].points,[dailyPoint,minutePoint]);
});
