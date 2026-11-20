import test from 'node:test';
import assert from 'node:assert/strict';
import {quoteChange,parseDailyHistory,mergeLatestSession,intradayQuality,historyQuality} from '../server/history-data.js';
import {assetQuote} from '../server/global-data.js';
import {latestQuoteHistory,quoteFreshness,quoteComparison,volumeComparison} from '../src/quote-info.js';
import {completedAnalysisBars} from '../src/timeframes.js';
import {aggregate} from '../src/analysis.js';
import {defaultChartPreferences,normalizePreferences} from '../src/chart-preferences.js';
import {startQuoteRefresh} from '../src/quote-refresh.js';
const sec=s=>Date.parse(s)/1000;
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
function raw(symbol='CL=F'){
  return {meta:{symbol,currency:'USD',exchangeTimezoneName:'America/New_York',regularMarketTime:sec('2026-11-20T05:00:00Z'),regularMarketPrice:83.01,fulldayPrice:83.01,fulldayChange:.57,chartPreviousClose:85.72,priceHint:2},timestamp:['2026-11-17T05:00:00Z','2026-11-18T05:00:00Z','2026-11-19T05:00:00Z','2026-11-20T05:00:00Z'].map(sec),indicators:{quote:[{open:[85,85,82,null],high:[87,86,84,null],low:[84,82,81,null],close:[86.01,83.26,83.21,null],volume:[100,200,300,null]}]}};
}
test('WTI increase stays positive with a missing latest OHLC; range-start and older bars cannot change the daily denominator',async t=>{
  const original=global.fetch;t.after(()=>{global.fetch=original;});global.fetch=async()=>Response.json({chart:{result:[raw()]}});
  const row=await assetQuote({symbol:'CL=F',currency:'USD'});near(row.previousClose,82.44);near(row.change,(83.01/82.44-1)*100);assert.ok(row.change>0);assert.equal(row.volume,null);
});
test('KOSDAQ metadata restores the correct prior close even when the previous daily candle is absent',()=>{
  const data=raw('^KQ11');data.meta={...data.meta,currency:'KRW',regularMarketPrice:651.16,fulldayPrice:651.16,fulldayChange:-33.65};const h=parseDailyHistory(data,'^KQ11');near(h.quote.previousClose,684.81);near(h.quote.changePercent,(651.16/684.81-1)*100);
});
test('unavailable or invalid prior-close metadata yields no daily percentage rather than a guessed multi-day return',()=>{
  assert.equal(quoteChange({chartPreviousClose:100},120).changePercent,null);
  assert.equal(quoteChange({previousClose:0,regularMarketChangePercent:-100},0).changePercent,null);
  near(quoteChange({regularMarketChangePercent:2},102).previousClose,100);
  near(quoteChange({previousClose:100},-37).changePercent,-137);
});
test('an unrelated fullday snapshot cannot be mixed with the regular quote price',()=>{
  assert.equal(quoteChange({fulldayPrice:120,fulldayChange:5,priceHint:2},100).previousClose,null);
});
test('USD/JPY explicit aliases are accepted only for the same currency instrument; other pairs and equity aliases stay rejected',()=>{
  const data=raw('USDJPY=X');data.meta={...data.meta,currency:'JPY',instrumentType:'CURRENCY'};
  assert.equal(parseDailyHistory(data,'JPY=X').quote.providerSymbol,'USDJPY=X');
  assert.throws(()=>parseDailyHistory({...data,meta:{...data.meta,symbol:'EURJPY=X'}},'JPY=X'),/종목 코드/);
  assert.throws(()=>parseDailyHistory({...data,meta:{...data.meta,instrumentType:'EQUITY'}},'JPY=X'),/종목 코드/);
  assert.throws(()=>parseDailyHistory({...data,meta:{...data.meta,currency:'USD'}},'JPY=X'),/통화/);
});
test('asset quotes retry a provider host failure and still expose per-asset failures when both hosts fail',async t=>{
  const original=global.fetch,calls=[];t.after(()=>{global.fetch=original;});global.fetch=async url=>{calls.push(String(url));if(String(url).includes('query1.'))throw Error('upstream unavailable');return Response.json({chart:{result:[raw('BZ=F')]}});};
  const row=await assetQuote({symbol:'BZ=F'});assert.equal(row.price,83.01);assert.equal(calls.length,2);assert.ok(calls[1].includes('query2.'));
  global.fetch=async()=>{throw Error('both hosts unavailable');};await assert.rejects(assetQuote({symbol:'NG=F'}),/both hosts/);
});
test('explicit refresh bypasses the short-lived asset cache instead of silently returning an older snapshot',async t=>{
  const original=global.fetch;let calls=0;t.after(()=>{global.fetch=original;});global.fetch=async()=>{calls++;const r=raw('SI=F');r.meta.regularMarketPrice=40+calls;r.meta.fulldayPrice=40+calls;return Response.json({chart:{result:[r]}});};
  const first=await assetQuote({symbol:'SI=F'}),cached=await assetQuote({symbol:'SI=F'}),fresh=await assetQuote({symbol:'SI=F'},{fresh:true});assert.equal(calls,2);assert.equal(first.price,cached.price);assert.notEqual(first.price,fresh.price);
});
test('switching candle intervals does not replace the latest quote with an older last-candle close',()=>{
  const daily={symbol:'NVDA',currency:'USD',quote:{price:145.98,changePercent:-3.2,asOf:'2026-11-19T21:00:01Z'}},four={...daily,bars:[{close:146}],quote:{...daily.quote,asOf:'2026-11-19T20:59:00Z'}};
  assert.equal(latestQuoteHistory([daily,four]),daily);assert.equal(latestQuoteHistory([four,daily]),daily);
  assert.equal(latestQuoteHistory([daily,{...four,symbol:'MSFT',quote:{...four.quote,asOf:'2026-11-19T22:00:00Z'}}]),daily);
  assert.equal(latestQuoteHistory([{symbol:'NVDA',bars:[{close:146}]}]),null);
});
test('older one-day responses cannot overwrite newer OHLC or volume',()=>{
  const base=parseDailyHistory(raw(),'CL=F'),recent=parseDailyHistory({...raw(),meta:{...raw().meta,regularMarketTime:sec('2026-11-19T04:00:00Z')}},'CL=F');recent.bars.at(-1).volume=9999;assert.equal(mergeLatestSession(base,recent),base);
});
test('intraday quality reports actual quote differences and chart gaps while accepting a closing-auction timestamp',()=>{
  const info=parseDailyHistory(raw(),'CL=F'),bars=[{time:sec('2026-11-20T01:00:00Z'),endTime:sec('2026-11-20T04:00:00Z'),close:84}];const q=intradayQuality(info,bars);assert.equal(q.priceMismatch,true);assert.equal(q.dataGap,true);assert.equal(q.sourceGapSeconds,3600);
  info.quote.asOf='2026-11-20T04:00:01Z';assert.equal(intradayQuality(info,bars).dataGap,false);
});
test('Korean daily confirmation keeps the 15:00–15:30 regular session open despite a provider 15:00 boundary',()=>{
  const r=raw('005930.KS');r.meta={...r.meta,currency:'KRW',exchangeTimezoneName:'Asia/Seoul',regularMarketTime:sec('2026-11-20T06:10:00Z'),currentTradingPeriod:{regular:{start:sec('2026-11-20T00:00:00Z'),end:sec('2026-11-20T06:00:00Z')}}};
  r.timestamp=[sec('2026-11-20T00:00:00Z')];r.indicators.quote=[{open:[100],high:[110],low:[95],close:[105],volume:[20]}];const info=parseDailyHistory(r,'005930.KS');assert.equal(historyQuality(info,Date.parse('2026-11-20T06:10:00Z')).sessionOpen,true);assert.equal(info.quote.regularEnd,'2026-11-20T06:30:00.000Z');
});
test('a delayed daily candle is not finalized immediately at market close, and yesterday is not treated as today forming',()=>{
  const r=raw('005930.KS');r.meta={...r.meta,currency:'KRW',exchangeTimezoneName:'Asia/Seoul',regularMarketTime:sec('2026-11-20T06:10:00Z'),currentTradingPeriod:{regular:{start:sec('2026-11-20T00:00:00Z'),end:sec('2026-11-20T06:00:00Z')}}};r.timestamp=[sec('2026-11-20T00:00:00Z')];r.indicators.quote=[{open:[100],high:[110],low:[95],close:[105],volume:[20]}];
  const info=parseDailyHistory(r,'005930.KS'),q=historyQuality(info,Date.parse('2026-11-20T06:35:00Z'));assert.equal(q.marketOpen,false);assert.equal(q.confirmationPending,true);assert.equal(q.sessionOpen,true);
  info.quote.asOf='2026-11-20T06:30:00Z';assert.equal(historyQuality(info,Date.parse('2026-11-20T06:50:00Z')).sessionOpen,false);
  info.quote.asOf='2026-11-19T06:30:00Z';info.quote.sessionDate='2026-11-19';info.bars[0].time='2026-11-19';assert.equal(historyQuality(info,Date.parse('2026-11-20T04:00:00Z')).sessionOpen,false);
});
test('price age, stale local view and expected closed-market age remain distinct',()=>{
  const h={quote:{asOf:'2026-11-20T04:30:00Z'},fetchedAt:'2026-11-20T04:55:00Z',quality:{marketOpen:true}},now=Date.parse('2026-11-20T05:00:00Z');const f=quoteFreshness(h,now);assert.equal(f.ageSeconds,1800);assert.equal(f.providerDelayed,true);assert.equal(f.viewStale,true);
  assert.equal(quoteFreshness({...h,quality:{marketOpen:false}},now).providerDelayed,false);assert.equal(quoteFreshness({...h,quality:{marketOpen:false}},now).viewStale,false);
  assert.equal(quoteFreshness({quote:{asOf:'2026-11-21T00:00:00Z'}},now).invalidTime,true);
});
test('cross-source comparisons use quote prices and do not score unaligned timestamps',()=>{
  const h={currency:'USD',timeZone:'America/New_York',quote:{price:145.98,asOf:'2026-11-19T21:00:01Z',sessionDate:'2026-11-19'},bars:[{time:'2026-11-19',close:146}]};
  const row={price:145.98,currency:'USD',barAt:'2026-11-19T14:30:00Z',quoteBarAt:'2026-11-19T20:59:00Z',tickSize:.01};assert.equal(quoteComparison(h,row).status,'within-tick');assert.equal(quoteComparison(h,{...row,quoteBarAt:'2026-11-19T20:30:00Z'}).status,'different-time');
});
test('closed-session volume divergence is reported without altering source bars or comparing a forming session',()=>{
  const h={timeZone:'America/New_York',quality:{marketOpen:false},bars:[{time:'2026-11-19',volume:320588100}]},row={volume:322939561,barAt:'2026-11-19T14:30:00Z'};assert.equal(volumeComparison(h,row).different,true);assert.equal(h.bars[0].volume,320588100);assert.equal(volumeComparison({...h,quality:{marketOpen:true}},row),null);
});
test('weekly and monthly analyses exclude unfinished periods even after a daily session closes',()=>{
  const bars=[{time:'2026-11-09'},{time:'2026-11-16'}],context={timeZone:'America/New_York',now:Date.parse('2026-11-20T02:00:00Z')};assert.equal(completedAnalysisBars(bars,'W',false,context).length,1);
  assert.equal(completedAnalysisBars([{time:'2026-10-01'},{time:'2026-11-01'}],'M',false,context).length,1);
  assert.equal(completedAnalysisBars(bars,'W',false,{...context,now:Date.parse('2026-11-21T18:00:00Z')}).length,2);
  assert.equal(completedAnalysisBars(bars,'W',false,{...context,assetType:'future',now:Date.parse('2026-11-22T18:00:00Z')}).length,1);
  assert.equal(completedAnalysisBars(bars,'W',false,{...context,assetType:'future',now:Date.parse('2026-11-23T06:00:00Z')}).length,2);
});
test('month rollover follows exchange local date, and grouped pane RS uses weekly dates rather than raw daily dates',()=>{
  const m=[{time:'2026-10-01'},{time:'2026-11-01'}],now=Date.parse('2026-12-01T02:00:00Z');assert.equal(completedAnalysisBars(m,'M',false,{timeZone:'America/New_York',now}).length,1);assert.equal(completedAnalysisBars(m,'M',false,{timeZone:'Asia/Seoul',now}).length,2);
  const b=[{time:'2026-11-12',close:100,high:101,low:99,volume:10},{time:'2026-11-19',close:102,high:103,low:100,volume:20}];assert.equal(completedAnalysisBars(aggregate(b,'W'),'W',false,{now:Date.parse('2026-11-20T05:00:00Z')}).at(-1).time,'2026-11-09');
});
test('safe refresh default migrates once while retaining custom averages, profile colors, and a subsequent explicit opt-out',()=>{
  const prior={...defaultChartPreferences(),version:4,autoRefresh:false};prior.movingAverages[0].color='#101010';prior.profile.color='#999999';const next=normalizePreferences(prior);assert.equal(next.version,5);assert.equal(next.autoRefresh,true);assert.equal(next.movingAverages[0].color,'#101010');assert.equal(next.profile.color,'#999999');assert.equal(normalizePreferences({...next,autoRefresh:false}).autoRefresh,false);
});
test('automatic quotes recover on foreground/online, skip hidden tabs, coalesce events and detach on disable',()=>{
  const win=new EventTarget(),doc=new EventTarget();let timer,cleared=false,time=0,count=0;doc.visibilityState='visible';win.setInterval=fn=>{timer=fn;return 1;};win.clearInterval=()=>{cleared=true;};const stop=startQuoteRefresh(()=>count++,{window:win,document:doc,now:()=>time});
  time=60000;timer();assert.equal(count,1);doc.visibilityState='hidden';time=120000;timer();assert.equal(count,1);doc.visibilityState='visible';doc.dispatchEvent(new Event('visibilitychange'));win.dispatchEvent(new Event('focus'));win.dispatchEvent(new Event('online'));assert.equal(count,2);stop();assert.equal(cleared,true);time=180000;win.dispatchEvent(new Event('focus'));assert.equal(count,2);
});
