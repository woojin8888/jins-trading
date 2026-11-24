import test from 'node:test';
import assert from 'node:assert/strict';
import {CHART_TIME_ZONE,chartDate} from '../src/chart-timezone.js';
import {formatBarTime,tickTime,completedAnalysisBars} from '../src/timeframes.js';
import {measurementContext,measurementDetails} from '../src/measurement-model.js';
import {chartAnchorTime} from '../src/drawing-model.js';
import {exportChartCSV} from '../src/chart-csv.js';
const sec=value=>Date.parse(value)/1000;

test('US winter and daylight-saving candles display Korean dates and hours without shifting timestamps',()=>{
 const winter=sec('2026-11-23T18:30:00Z'),summer=sec('2026-07-06T13:30:00Z');
 assert.equal(formatBarTime(winter,CHART_TIME_ZONE),'11-24 03:30');
 assert.equal(formatBarTime(summer,CHART_TIME_ZONE),'07-06 22:30');
 assert.equal(tickTime(winter,3,CHART_TIME_ZONE),'03:30');
 assert.equal(chartDate(winter),'2026-11-24');
 assert.equal(chartDate('2026-11-23'),'2026-11-23');
 assert.equal(formatBarTime(sec('2026-11-24T00:00:00Z'),CHART_TIME_ZONE),'11-24 09:00');
});
test('Korean measurement labels preserve exchange-date drawing anchors and real bar intervals',()=>{
 const bars=[sec('2026-11-23T14:30:00Z'),sec('2026-11-23T18:30:00Z')].map(time=>({time}));
 const context=measurementContext(bars,'America/New_York',2,CHART_TIME_ZONE);
 const points=[{time:Date.parse('2026-11-23'),dateOnly:true,price:100},{time:bars[1].time*1000,dateOnly:false,price:110}];
 assert.equal(chartAnchorTime(points[0],context.map),bars[0].time*1000);
 assert.equal(context.map.formatter.resolvedOptions().timeZone,'America/New_York');
 const details=measurementDetails({type:'datePriceRange',points},context);
 assert.equal(details.intervals,1);assert.equal(details.difference,10);assert.equal(details.elapsedMs,4*3600000);
 assert.match(details.lines[2],/11-23 23:30.*11-24 03:30/);
});
test('weekly completion still follows the exchange calendar when Korea has already reached Saturday',()=>{
 const bars=[{time:'2026-11-16'},{time:'2026-11-23'}],now=Date.parse('2026-11-27T20:45:00Z');
 assert.equal(completedAnalysisBars(bars,'W',false,{timeZone:'America/New_York',now}).length,1);
 assert.equal(completedAnalysisBars(bars,'W',false,{timeZone:CHART_TIME_ZONE,now}).length,2);
});
test('CSV exports Korean display time and the original UTC time, while daily dates retain the trading day',()=>{
 const bar={time:sec('2026-11-23T18:30:00Z'),open:100,high:110,low:99,close:105,volume:10};
 const csv=exportChartCSV({bars:[bar],market:'us',symbol:'NVDA',interval:'4h',timeZone:CHART_TIME_ZONE});
 assert.ok(csv.includes('"2026-11-23T18:30:00.000Z","2026-11-24 03:30:00","Asia/Seoul"'));
 const daily=exportChartCSV({bars:[{...bar,time:'2026-11-23'}],market:'us',symbol:'NVDA',interval:'D',timeZone:CHART_TIME_ZONE});
 assert.ok(daily.includes('"2026-11-23","","2026-11-23","Asia/Seoul"'));
});
