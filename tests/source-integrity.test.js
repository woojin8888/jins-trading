import test from 'node:test';
import assert from 'node:assert/strict';
import {parseIntraday} from '../server/intraday-data.js';
import {sessionCoverage} from '../server/session-coverage.js';
import {intradayQuality} from '../server/history-data.js';
import {quoteComparison,volumeComparison} from '../src/quote-info.js';
const sec=s=>Date.parse(s)/1000;
test('coverage excludes weekends, future intervals and a truncated range start but detects internal and closing slots',()=>{
  const start=sec('2026-11-19T14:30:00Z'),next=start+86400,seconds=900,sessions=[{start,end:start+3600},{start:next,end:next+3600}];
  const found=sessionCoverage([{time:start+900},{time:start+2700},{time:next}],sessions,seconds,next+901,start+900);
  assert.equal(found.missingSourceBars,2);assert.equal(found.affectedSessions,2);assert.equal(found.missingSourceSeconds,901);assert.deepEqual(found.sourceGaps,[{start:start+1800,end:start+2700},{start:next+900,end:next+901}]);
});
test('a flat price cannot hide an older final intraday bar',()=>{
  const end=sec('2026-11-19T21:00:00Z'),info={timeZone:'America/New_York',bars:[],meta:{},quote:{asOf:new Date((end+900)*1000).toISOString(),price:100,precision:2,sessionDate:'2026-11-19'}};
  assert.equal(intradayQuality(info,[{time:end-900,endTime:end,close:100}]).priceMismatch,false);assert.equal(intradayQuality(info,[{time:end-900,endTime:end,close:100}]).dataGap,true);
});
test('valid Korean 4h closing bars retain every real hour including 15:00–15:30',()=>{
  const start=sec('2026-11-19T00:00:00Z'),end=start+23400,times=Array.from({length:7},(_,i)=>start+i*3600),q={open:times.map(()=>100),high:times.map(()=>102),low:times.map(()=>99),close:times.map(()=>101),volume:times.map(()=>10)};
  const data={meta:{symbol:'005930.KS',currency:'KRW',exchangeTimezoneName:'Asia/Seoul',regularMarketTime:end,regularMarketPrice:101,tradingPeriods:[[{start,end}]]},timestamp:times,indicators:{quote:[q]}};
  const result=parseIntraday(data,'005930.KS','4h');assert.equal(result.bars.length,2);assert.equal(result.bars.at(-1).endTime,end);assert.equal(result.bars.at(-1).volume,30);assert.equal(result.quality.incompleteGroups,0);assert.equal(result.quality.missingSourceBars,0);
  // An internal null hour invalidates the aggregate even if both end points exist.
  q.close[5]=null;const broken=parseIntraday(data,'005930.KS','4h');assert.equal(broken.bars.length,1);assert.equal(broken.quality.missingSourceBars,1);assert.equal(broken.quality.incompleteGroups,1);
});
test('comparison never labels unknown tick size, missing currency, another symbol or an extended session as a one-tick match',()=>{
  const h={symbol:'NVDA',currency:'USD',timeZone:'America/New_York',quote:{price:100,asOf:'2026-11-19T21:00:00Z',sessionDate:'2026-11-19',precision:2},bars:[{time:'2026-11-19',close:100}]};
  const row={symbol:'NVDA',currency:'USD',price:100,barAt:'2026-11-19T14:30:00Z',quoteBarAt:'2026-11-19T20:59:00Z'};
  assert.equal(quoteComparison(h,row).status,'within-precision');assert.equal(quoteComparison(h,{...row,tickSize:.001}).status,'within-precision');assert.equal(quoteComparison(h,{...row,tickSize:.01}).status,'within-tick');
  assert.equal(quoteComparison(h,{...row,symbol:'MSFT'}).status,'symbol-mismatch');assert.equal(quoteComparison(h,{...row,currency:null}).status,'unknown-currency');assert.equal(quoteComparison(h,{...row,currentSession:'premarket'}).status,'different-session-type');assert.equal(quoteComparison(h,{...row,barAt:'bad'}).status,'unknown-session');
});
test('zero trade volume is a real observation but cannot create an infinite percentage',()=>{
  const h={symbol:'NVDA',currency:'USD',timeZone:'America/New_York',quality:{marketOpen:false},quote:{asOf:'2026-11-19T21:00:01Z'},bars:[{time:'2026-11-19',volume:10}]},row={symbol:'NVDA',currency:'USD',volume:0,barAt:'2026-11-19T14:30:00Z',quoteBarAt:'2026-11-19T20:59:00Z'};
  const result=volumeComparison(h,row);assert.equal(result.percent,null);assert.equal(result.different,true);h.bars[0].volume=0;assert.equal(volumeComparison(h,row).percent,0);
});
