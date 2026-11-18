import test from 'node:test';
import assert from 'node:assert/strict';
import {historyQuality,mergeLatestSession,needsLatestSession,parseDailyHistory,sessionDate} from '../server/history-data.js';
import {routeMarket} from '../server/market.js';
import {SCAN_COLUMNS,scanRows} from '../server/rankings.js';
import {CHART_COLORS,volumeColor,volumePoints} from '../src/chart-colors.js';
import {delayLabel,formatQuoteTime,quoteComparison} from '../src/quote-info.js';
const seconds=value=>Date.parse(value)/1000;
const meta={symbol:'NVDA',currency:'USD',exchangeTimezoneName:'America/New_York',regularMarketPrice:155.46,regularMarketTime:seconds('2026-11-17T21:00:00Z'),priceHint:2,currentTradingPeriod:{regular:{start:seconds('2026-11-17T14:30:00Z'),end:seconds('2026-11-17T21:00:00Z')}}};
function raw({latest=false,invalid=false}={}){return {meta,timestamp:latest?[seconds('2026-11-17T21:00:00Z')]:[seconds('2026-11-16T14:30:00Z'),seconds('2026-11-17T14:30:00Z')],indicators:{quote:latest?[{open:[156.2],high:[158],low:[154],close:[invalid?null:155.46],volume:[1200]}]:[{open:[157,null],high:[158,null],low:[155,null],close:[156.14,null],volume:[1000,null]}]}};}
test('long-range Yahoo history with a null latest candle is identified using its regular-session quote date',()=>{
  const data=parseDailyHistory(raw(),'NVDA');assert.equal(data.bars.at(-1).time,'2026-11-16');assert.equal(data.quote.sessionDate,'2026-11-17');assert.equal(data.invalidBarCount,1);assert.equal(needsLatestSession(data),true);assert.equal(historyQuality(data).missingLatestSession,true);
});
test('verified one-day OHLC repairs the missing session without inventing prices or discarding prior history',()=>{
  const base=parseDailyHistory(raw(),'NVDA'),recent=parseDailyHistory(raw({latest:true}),'NVDA'),merged=mergeLatestSession(base,recent);
  assert.equal(merged.bars.length,2);assert.deepEqual(merged.bars[0],base.bars[0]);assert.deepEqual(merged.bars[1],{time:'2026-11-17',open:156.2,high:158,low:154,close:155.46,volume:1200});assert.equal(historyQuality(merged).missingLatestSession,false);assert.equal(historyQuality(merged).priceMismatch,false);assert.equal(historyQuality(merged).latestSessionPatched,true);
});
test('quote metadata alone and another null candle cannot be turned into a fabricated latest-day OHLC bar',()=>{
  const base=parseDailyHistory(raw(),'NVDA'),recent=parseDailyHistory(raw({latest:true,invalid:true}),'NVDA'),merged=mergeLatestSession(base,recent);assert.equal(merged.bars.length,1);assert.equal(historyQuality(merged).missingLatestSession,true);assert.equal(merged.bars[0].close,156.14);
});
test('provider symbol/currency mismatches are rejected instead of silently drawing a different security',()=>{
  assert.throws(()=>parseDailyHistory(raw(),'MSFT'),/종목 코드/);assert.throws(()=>parseDailyHistory({...raw(),meta:{...meta,currency:'KRW'}},'NVDA'),/통화/);
});
test('a US closing timestamp stays on its New York trading date while displayed times use Korean time',()=>{
  assert.equal(sessionDate(meta.regularMarketTime,'America/New_York'),'2026-11-17');assert.equal(sessionDate(meta.regularMarketTime,'Asia/Seoul'),'2026-11-18');assert.ok(formatQuoteTime('2026-11-17T21:00:00Z').includes('2026-11-18 06:00:00'));assert.equal(formatQuoteTime(null),'미제공');
});
test('closed sessions and weekends do not become missing-session warnings merely because time passes',()=>{
  const data=parseDailyHistory(raw({latest:true}),'NVDA'),quality=historyQuality(data,Date.parse('2026-11-22T12:00:00Z'));assert.equal(quality.missingLatestSession,false);assert.equal(quality.sessionOpen,false);
});
test('ranking metadata keeps explicit feed delay, minute-bar timestamp, currency and minimum tick',()=>{
  const values={name:'NVDA',description:'NVIDIA',close:155.46,update_mode:'delayed_streaming_900',time:seconds('2026-11-17T14:30:00Z'),'time|1':seconds('2026-11-17T20:59:00Z'),currency:'USD',pricescale:100,minmov:1};
  const [row]=scanRows([{d:SCAN_COLUMNS.map(key=>values[key]??null)}],'us');assert.equal(row.delaySeconds,900);assert.equal(row.quoteBarAt,'2026-11-17T20:59:00.000Z');assert.equal(row.tickSize,.01);assert.equal(delayLabel(row),'15분 지연');assert.equal(delayLabel({delaySeconds:1200}),'20분 지연');assert.equal(delayLabel({}),'지연 정보 미제공');
});
test('cross-source comparisons distinguish different trading dates and currencies from normal tick rounding',()=>{
  const data=mergeLatestSession(parseDailyHistory(raw(),'NVDA'),parseDailyHistory(raw({latest:true}),'NVDA')),history={...data,currency:'USD'};
  const row={price:155.46,currency:'USD',barAt:'2026-11-17T14:30:00Z',tickSize:.01};assert.equal(quoteComparison(history,row).status,'within-tick');assert.equal(quoteComparison(history,{...row,price:155.47}).status,'within-tick');assert.equal(quoteComparison(history,{...row,price:156}).status,'different-price');assert.equal(quoteComparison(history,{...row,barAt:'2026-11-16T14:30:00Z'}).status,'different-session');assert.equal(quoteComparison(history,{...row,currency:'KRW'}).status,'currency-mismatch');
});
test('the history endpoint requests the latest real daily bar and fresh requests bypass the application CDN cache',async t=>{
  const original=global.fetch,calls=[];t.after(()=>{global.fetch=original;});
  global.fetch=async url=>{calls.push(String(url));return Response.json({chart:{result:[raw({latest:new URL(url).searchParams.get('range')==='1d'})]}});};
  const response=await routeMarket(new URL('https://test/api/market?symbol=NVDA&range=10y&fresh=1')),data=await response.json();assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal(data.bars.at(-1).time,'2026-11-17');assert.equal(data.bars.at(-1).close,155.46);assert.equal(data.quality.missingLatestSession,false);assert.equal(calls.length,2);assert.ok(calls[1].includes('range=1d'));assert.ok(calls.every(url=>url.includes('includePrePost=false')));
});
test('failure to fetch the latest session preserves verified history with an explicit missing-session flag',async t=>{
  const original=global.fetch;t.after(()=>{global.fetch=original;});global.fetch=async url=>new URL(url).searchParams.get('range')==='1d'?new Response('',{status:503}):Response.json({chart:{result:[raw()]}});
  const response=await routeMarket(new URL('https://test/api/market?symbol=NVDA')),data=await response.json();assert.equal(response.status,200);assert.equal(data.bars.length,1);assert.equal(data.quality.missingLatestSession,true);assert.equal(data.asOf,'2026-11-16');
});
test('volume colors use previous-candle volume independently of the candlestick price direction',()=>{
  const bars=[{time:'2026-11-16',open:100,close:110,volume:100},{time:'2026-11-17',open:110,close:100,volume:150},{time:'2026-11-18',open:100,close:110,volume:80}];const points=volumePoints(bars);
  assert.equal(points[0].color,CHART_COLORS.neutral);assert.equal(points[1].color,CHART_COLORS.up);assert.equal(points[2].color,CHART_COLORS.down);assert.equal(points[1].value,150);assert.equal(CHART_COLORS.up,'#e5484d');assert.equal(CHART_COLORS.down,'#2878eb');
});
test('equal, zero and unknown previous volumes are handled distinctly without comparing across a missing bar',()=>{
  assert.equal(volumeColor(100,100),CHART_COLORS.neutral);assert.equal(volumeColor(0,0),CHART_COLORS.neutral);assert.equal(volumeColor(10,0),CHART_COLORS.up);assert.equal(volumeColor(0,10),CHART_COLORS.down);assert.equal(volumeColor(10,null),CHART_COLORS.neutral);
  const values=volumePoints([{time:'a',volume:100},{time:'b',volume:null},{time:'c',volume:150}]);assert.equal(values.length,2);assert.equal(values[1].color,CHART_COLORS.neutral);
});
