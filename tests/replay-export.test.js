import test from 'node:test';
import assert from 'node:assert/strict';
import {createReplaySession,replaySnapshot,replayStep,replayDateIndex} from '../src/bar-replay.js';
import {exportChartCSV,chartCSVFilename} from '../src/chart-csv.js';
import {parseCSV} from '../src/watchlist-csv.js';
import {sma,atr,volumeProfile} from '../src/analysis.js';
import {uploadedRS} from '../src/pine-minervini.js';
const sec=s=>Date.parse(s)/1000;
const bars=n=>Array.from({length:n},(_,i)=>({time:new Date(Date.UTC(2025,0,i+1)).toISOString().slice(0,10),open:100+i,high:102+i,low:99+i,close:101+i,volume:1000+i}));
function daily(data=bars(300)){return {symbol:'NVDA',currency:'USD',timeZone:'America/New_York',bars:data,quote:{price:9999,asOf:'2026-11-20T21:00:00Z'},quality:{sessionOpen:false}};}
test('historical replay freezes source arrays and never reveals future candles to MA, ATR, RS, or volume profile',()=>{
  const h=daily(),session=createReplaySession({chart:h,daily:h,interval:'D'}),snapshot=replaySnapshot(session,80),prefix=structuredClone(h.bars.slice(0,81));
  assert.deepEqual(snapshot.chartBars,prefix);assert.deepEqual(snapshot.dailyBars,prefix);assert.equal(snapshot.price,prefix.at(-1).close);assert.notEqual(snapshot.price,h.quote.price);
  h.bars[0].close=999999;h.bars[200].high=999999;session.chart.bars[200].volume=999999;
  assert.deepEqual(sma(replaySnapshot(session,80).chartBars,20),sma(prefix,20));assert.deepEqual(atr(snapshot.chartBars),atr(prefix));assert.deepEqual(uploadedRS(snapshot.chartBars),uploadedRS(prefix));assert.deepEqual(volumeProfile(snapshot.chartBars),volumeProfile(prefix));
});
test('an unfinished daily or intraday candle cannot be revealed as a complete replay candle',()=>{
  const h=daily(bars(2));h.quality.sessionOpen=true;const session=createReplaySession({chart:h,daily:h,interval:'D'});assert.equal(session.frames.length,1);
  const hour={...h,bars:[{time:100,endTime:1000,open:1,high:2,low:1,close:2,volume:10,complete:true},{time:1000,endTime:1900,open:2,high:3,low:2,close:3,volume:20,complete:false}]};assert.equal(createReplaySession({chart:hour,interval:'15m'}).frames.length,1);
  assert.throws(()=>createReplaySession({chart:{...hour,bars:hour.bars.slice(1)},interval:'15m'}),/확정 봉/);
});
test('weekly/monthly replay clips original daily inputs before grouping, so future highs and volume cannot bleed into a visible period',()=>{
  const b=[{time:'2026-10-29',open:1,high:3,low:1,close:2,volume:10},{time:'2026-10-30',open:2,high:4,low:2,close:3,volume:20},{time:'2026-11-02',open:3,high:500,low:1,close:400,volume:9999}];const h=daily(b);
  const now=Date.parse('2026-12-01T12:00:00Z'),w=createReplaySession({chart:h,daily:h,interval:'W',now}),m=createReplaySession({chart:h,daily:h,interval:'M',now});
  for(const session of [w,m]){const first=replaySnapshot(session,0);assert.equal(first.chartBars.length,2);assert.equal(first.frame.high,4);assert.equal(first.frame.volume,30);assert.equal(first.price,3);assert.equal(first.dailyBars.length,2);assert.equal(first.frame.date,'2026-10-30');}
});
test('intraday replay excludes same-day daily OHLC and later or overlapping benchmark candles',()=>{
  const t=sec('2026-11-19T14:30:00Z'),data=[0,1,2].map(i=>({time:t+i*900,endTime:t+(i+1)*900,open:10+i,high:12+i,low:9+i,close:11+i,volume:100,complete:true}));
  const h={...daily(),bars:data,quality:{intraday:true}},d=daily([{time:'2026-11-18',open:10,high:11,low:9,close:10,volume:100},{time:'2026-11-19',open:10,high:9999,low:1,close:9999,volume:999999}]);
  const benchmark={...h,bars:[...data,{...data[1],endTime:t+9999}]};const session=createReplaySession({chart:h,daily:d,benchmark,interval:'15m'}),snapshot=replaySnapshot(session,1);
  assert.equal(snapshot.dailyBars.length,1);assert.equal(snapshot.dailyBars[0].time,'2026-11-18');assert.equal(snapshot.benchmark.length,2);assert.equal(snapshot.chartBars.length,2);assert.equal(snapshot.price,12);assert.equal(snapshot.changePercent,(12/11-1)*100);
});
test('replay seeks by date and stepping stops exactly at data boundaries without extending the dataset',()=>{
  const session=createReplaySession({chart:daily(bars(5)),interval:'D'});let state={session,cursor:3,playing:true};state=replayStep(state);assert.equal(state.cursor,4);assert.equal(state.playing,false);assert.equal(replayStep(state).cursor,4);assert.equal(replayStep({...state,cursor:0},-1).cursor,0);
  assert.equal(replayDateIndex(session.frames,'2025-01-03'),2);assert.equal(replayDateIndex(session.frames,'2099-01-01'),4);assert.equal(replaySnapshot(session,999).chartBars.length,5);
});
test('replay does not read a daily or benchmark source from another security as the primary OHLC input',()=>{
  const h=daily(bars(4)),session=createReplaySession({chart:h,daily:{...h,symbol:'MSFT'},interval:'D'});assert.equal(replaySnapshot(session,1).dailyBars.length,0);assert.equal(replaySnapshot(session,1).chartBars[1].close,h.bars[1].close);
});
test('OHLCV export preserves unknown volume, real zero and negative futures prices, and labels partial candles explicitly',()=>{
  const data=[{time:'2026-11-18',open:-37,high:-20,low:-40,close:-25,volume:null},{time:'2026-11-19',open:-25,high:1,low:-26,close:0,volume:0}],csv=exportChartCSV({bars:data,market:'commodities',symbol:'CL=F',interval:'D',currency:'USD',volumeUnit:'계약',confirmedTimes:['2026-11-18']});
  const [header,...raw]=parseCSV(csv.replace(/^\uFEFF/,'')),rows=raw.map(r=>Object.fromEntries(header.map((h,i)=>[h,r[i]])));
  assert.equal(rows[0].open,'-37');assert.equal(rows[0].volume,'');assert.equal(rows[1].volume,'0');assert.equal(rows[1].close,'0');assert.equal(rows[0].confirmed,'true');assert.equal(rows[1].confirmed,'false');assert.equal(rows[0].volume_unit,'계약');
});
test('intraday export gives UTC and exchange-local time without inventing an exact daily quote timestamp',()=>{
  const b={time:sec('2026-11-19T14:30:00Z'),open:1,high:2,low:1,close:2,volume:10};const [header,row]=parseCSV(exportChartCSV({bars:[b],symbol:'NVDA',market:'us',interval:'15m',timeZone:'America/New_York'}).replace(/^\uFEFF/,'')),r=Object.fromEntries(header.map((h,i)=>[h,row[i]]));
  assert.equal(r.time_utc,'2026-11-19T14:30:00.000Z');assert.equal(r.time_local,'2026-11-19 09:30:00');
  const [dh,dr]=parseCSV(exportChartCSV({bars:[{...b,time:'2026-11-19'}],interval:'D'}).replace(/^\uFEFF/,''));assert.equal(dr[dh.indexOf('time_utc')],'');
});
test('export handles text quoting and spreadsheet formulas safely, and replay export contains only revealed history',()=>{
  const session=createReplaySession({chart:daily(bars(10)),interval:'D'}),snapshot=replaySnapshot(session,2);const csv=exportChartCSV({bars:snapshot.chartBars,symbol:'=HYPERLINK("bad")',source:'source,"quoted"',mode:'replay'}),rows=parseCSV(csv.replace(/^\uFEFF/,''));
  assert.equal(rows.length,4);assert.ok(rows[1][1].startsWith("'="));assert.equal(rows[1].at(-1),'source,"quoted"');assert.equal(rows[1][15],'replay');assert.ok(!csv.includes('2025-01-04'));assert.equal(chartCSVFilename('../NVDA','D','replay'),'jins-trading-___NVDA-D-replay.csv');
});
