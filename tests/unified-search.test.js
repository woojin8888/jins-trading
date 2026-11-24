import test from 'node:test';
import assert from 'node:assert/strict';
import {classifySearchQuote,searchAllInstruments} from '../server/unified-search.js';
import {routeMarket} from '../server/market.js';
import {directSearchTarget} from '../src/symbol-search.js';

test('Korean names and popular US tickers resolve without the selected market or an external request',async t=>{
  const original=global.fetch;t.after(()=>{global.fetch=original;});global.fetch=()=>{throw Error('unexpected network');};
  const korean=await routeMarket(new URL('https://test/api/market?action=search&market=us&scope=all&q='+encodeURIComponent('한진칼')));
  const ko=(await korean.json()).rows.find(row=>row.symbol==='180640.KS');assert.equal(ko.market,'kr');assert.equal(ko.name,'한진칼');
  const american=await routeMarket(new URL('https://test/api/market?action=search&market=kr&scope=all&q=NVDA'));
  const us=(await american.json()).rows.find(row=>row.symbol==='NVDA');assert.equal(us.market,'us');
  assert.ok((await searchAllInstruments('애플')).rows.some(row=>row.symbol==='AAPL'&&row.market==='us'));
  assert.ok((await searchAllInstruments('KODEX 200')).rows.some(row=>row.symbol==='069500.KS'&&row.market==='etfkr'));
});
test('remote listings retain the actual country, ETF class and Korean name',()=>{
  for(const [symbol,type,market] of [['180640.KS','EQUITY','kr'],['069500.KS','ETF','etfkr'],['NVDA','EQUITY','us'],['SPY','ETF','etf'],['SAP.DE','EQUITY','de'],['7203.T','EQUITY','jp'],['^N225','INDEX','indices']])assert.equal(classifySearchQuote({symbol,quoteType:type,shortname:'source name'}).market,market);
  assert.equal(classifySearchQuote({symbol:'180640.KS',quoteType:'EQUITY',shortname:'HANJIN KAL'}).name,'한진칼');
  assert.equal(classifySearchQuote({symbol:'GC=F',quoteType:'FUTURE'}).kind,'future');
  assert.equal(classifySearchQuote({symbol:'^UNSUPPORTED',quoteType:'INDEX'}),null);
  assert.equal(classifySearchQuote({symbol:'AAPL<script>',quoteType:'EQUITY'}),null);assert.equal(classifySearchQuote({symbol:'180640.KQ',quoteType:'EQUITY'}),null);
});
test('an international provider response is classified once and deduplicated without forcing the current market',async t=>{
  const original=global.fetch;let calls=0;t.after(()=>{global.fetch=original;});global.fetch=async()=>{calls++;return Response.json({quotes:[{symbol:'ZZWIDGET','quoteType':'EQUITY',longname:'Zephyr Widgets'},{symbol:'ZZWIDGET','quoteType':'EQUITY',longname:'Zephyr Widgets'},{symbol:'6501.T',quoteType:'EQUITY',longname:'Hitachi'},{symbol:'BAD=X',quoteType:'CURRENCY'}]});};
  const result=await searchAllInstruments('Zephyr Widgets');
  assert.equal(calls,1);assert.equal(result.rows.filter(row=>row.symbol==='ZZWIDGET').length,1);
  assert.equal(result.rows.find(row=>row.symbol==='6501.T').market,'jp');assert.equal(result.rows.some(row=>row.symbol==='BAD=X'),false);
});
test('direct tickers infer their own market and company-name queries are not turned into Korean codes',()=>{
  assert.equal(directSearchTarget('NVDA').market,'us');assert.equal(directSearchTarget('180640').market,'kr');
  assert.equal(directSearchTarget('NASDAQ:NVDA').symbol,'NVDA');assert.equal(directSearchTarget('BRK.B').symbol,'BRK-B');
  assert.equal(directSearchTarget('7203.T').market,'jp');assert.equal(directSearchTarget('^KS11').market,'indices');
  assert.equal(directSearchTarget('069500').market,'etfkr');assert.equal(directSearchTarget('javascript:SPY'),null);assert.equal(directSearchTarget('한진칼'),null);assert.equal(directSearchTarget('javascript:alert(1)'),null);
});
test('empty and oversized queries are bounded and upstream failure is shown rather than an invented listing',async t=>{
  assert.deepEqual((await searchAllInstruments('')).rows,[]);await assert.rejects(()=>searchAllInstruments('x'.repeat(61)),/60자/);
  const original=global.fetch;t.after(()=>{global.fetch=original;});global.fetch=async()=>new Response('unavailable',{status:503});
  await assert.rejects(()=>searchAllInstruments('___MISSING_7___'),/연결하지 못/);
});
