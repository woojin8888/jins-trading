import test from 'node:test';
import assert from 'node:assert/strict';
import {MARKETS,MARKET_IDS,ASSETS,expectedCurrencies,hasVolume,assetKind,volumeUnit,quoteUnit,defaultSymbols} from '../src/instruments.js';
import {canonicalMarketSymbol,validMarketSymbol,marketFromSearch} from '../src/market-selection.js';
import {scanRequest,scanRows,SCAN_COLUMNS} from '../server/rankings.js';
import {parseDailyHistory} from '../server/history-data.js';
import {parseIntraday} from '../server/intraday-data.js';
import {normalizeWorkspace,nearestTimeBar} from '../src/workspace-model.js';
import {searchInstruments} from '../server/global-data.js';
import {validateAlert} from '../src/alert-engine.js';
import {formatVolume} from '../src/technical-math.js';
import {importWatchCSV,exportWatchCSV} from '../src/watchlist-csv.js';
const sec=s=>Date.parse(s)/1000;
function source(symbol,currency,timeZone,prices=[100,101],times=[sec('2026-11-18T00:00:00Z'),sec('2026-11-19T00:00:00Z')]){return {meta:{symbol,currency,exchangeTimezoneName:timeZone,regularMarketTime:times.at(-1)+3600,regularMarketPrice:prices.at(-1),priceHint:symbol.endsWith('=X')?5:2},timestamp:times,indicators:{quote:[{open:prices,high:prices.map(n=>n+1),low:prices.map(n=>n-1),close:prices,volume:prices.map(()=>100)}]}};}
test('every market has a valid default and deep link and all existing scopes survive normalization',()=>{
 const defaults=defaultSymbols();for(const id of MARKET_IDS){assert.ok(validMarketSymbol(defaults[id].symbol,id),id);assert.equal(marketFromSearch('?market='+id),id);assert.equal(canonicalMarketSymbol(defaults[id].symbol,id),defaults[id].symbol);const doc=normalizeWorkspace({main:{market:id,symbols:defaults}});assert.equal(doc.main.market,id);assert.deepEqual(doc.main.symbols,defaults);assert.deepEqual(normalizeWorkspace(doc),doc);}
});
test('foreign symbol normalization preserves exchange suffixes and rejects ambiguous Chinese bare codes',()=>{
 for(const [market,input,expected] of [['jp','7203','7203.T'],['jp','285A','285A.T'],['hk','700','0700.HK'],['hk','00700.HK','0700.HK'],['cn','600519.SS','600519.SS'],['uk','BT.A','BT-A.L'],['uk','RR.','RR.L'],['de','SAP','SAP.DE'],['fr','MC','MC.PA'],['ca','BBD.B','BBD-B.TO'],['au','BHP','BHP.AX'],['in','RELIANCE','RELIANCE.NS'],['tw','2330','2330.TW'],['sg','D05','D05.SI']])assert.equal(canonicalMarketSymbol(input,market),expected);
 assert.throws(()=>canonicalMarketSymbol('000001','cn'),/SS/);assert.equal(canonicalMarketSymbol('000001','cn','SZSE'),'000001.SZ');assert.throws(()=>canonicalMarketSymbol('https://evil.test','jp'));
});
test('world indices, FX and futures have distinct identities, units and validated quote currencies',()=>{
 assert.equal(assetKind('^N225'),'index');assert.equal(assetKind('KRW=X'),'fx');assert.equal(assetKind('GC=F'),'future');assert.equal(quoteUnit('DX-Y.NYB','USD'),'지수 포인트');assert.match(quoteUnit('GC=F','USD'),/트로이온스/);assert.equal(volumeUnit('CL=F'),'계약');
 for(const [symbol,currency] of [['^N225','JPY'],['^HSI','HKD'],['^FTSE','GBP'],['AZN.L','GBp'],['7203.T','JPY'],['600519.SS','CNY'],['RY.TO','CAD'],['BHP.AX','AUD'],['2330.TW','TWD'],['D05.SI','SGD'],['KRW=X','KRW'],['EURUSD=X','USD']])assert.ok(expectedCurrencies(symbol).includes(currency),symbol);
 assert.throws(()=>parseDailyHistory(source('7203.T','USD','Asia/Tokyo'),'7203.T'),/통화/);assert.equal(parseDailyHistory(source('AZN.L','GBp','Europe/London'),'AZN.L').quote.currency,'GBp');
});
test('index and FX bars never fabricate tradable volume while ETF and futures keep their actual volume',()=>{
 for(const symbol of ['^GSPC','^N225','KRW=X','DX-Y.NYB']){const currency=expectedCurrencies(symbol)[0],history=parseDailyHistory(source(symbol,currency,'UTC'),symbol);assert.ok(history.bars.every(b=>b.volume===null));assert.equal(hasVolume(symbol),false);}
 for(const symbol of ['GC=F','SPY','069500.KS'])assert.equal(parseDailyHistory(source(symbol,expectedCurrencies(symbol)[0],'UTC'),symbol).bars[0].volume,100);
 assert.equal(formatVolume(12345,'korean','계약'),'1.2만계약');
});
test('negative historical futures prices are retained and nonpositive equity candles are still rejected',()=>{
 const negativeQuote=parseDailyHistory(source('CL=F','USD','America/New_York',[-37,-20]),'CL=F');assert.equal(negativeQuote.quote.price,-20);const oil=parseDailyHistory(source('CL=F','USD','America/New_York',[-37,10]),'CL=F');assert.equal(oil.bars[0].close,-37);const equity=parseDailyHistory(source('AAPL','USD','America/New_York',[-37,10]),'AAPL');assert.equal(equity.bars.length,1);
});
test('ETF requests require the ETF type flag and country scans restrict known compatible exchanges',()=>{
 for(const market of ['etf','etfkr']){const request=scanRequest(market);assert.ok(request.filter.some(f=>f.left==='type'&&f.right==='fund'));assert.ok(request.filter.some(f=>f.left==='typespecs'&&f.right.includes('etf')));}
 for(const market of ['jp','hk','cn','uk','de','fr','ca','au','in','tw','sg']){const request=scanRequest(market);assert.deepEqual(request.filter.find(f=>f.left==='exchange').right,MARKETS[market].exchanges);assert.deepEqual(request.range,[0,100]);}
 assert.throws(()=>scanRequest('fx'));
});
test('scanner codes map to actual provider symbols without converting GBp prices to GBP',()=>{
 const row=(name,exchange,currency)=>({d:SCAN_COLUMNS.map(k=>({name,exchange,currency,description:name,close:13646,'Value.Traded':214357099.32}[k]??null))});
 assert.equal(scanRows([row('700','HKEX','HKD')],'hk')[0].symbol,'0700.HK');assert.equal(scanRows([row('600519','SSE','CNY')],'cn')[0].symbol,'600519.SS');assert.equal(scanRows([row('000001','SZSE','CNY')],'cn')[0].symbol,'000001.SZ');
 const uk=scanRows([row('BT.A','LSE','GBX')],'uk')[0];assert.equal(uk.symbol,'BT-A.L');assert.equal(uk.currency,'GBp');assert.equal(uk.price,13646);assert.equal(uk.value,214357099.32);assert.equal(MARKETS.uk.amountCurrency,'GBP');
});
test('foreign one-hour bars retain morning and afternoon sessions without US opening-hour assumptions',()=>{
 const times=['2026-11-19T01:30:00Z','2026-11-19T02:30:00Z','2026-11-19T03:30:00Z','2026-11-19T05:00:00Z','2026-11-19T06:00:00Z','2026-11-19T07:00:00Z'].map(sec),raw=source('0700.HK','HKD','Asia/Hong_Kong',times.map(()=>100),times);
 raw.meta.regularMarketTime=sec('2026-11-19T08:00:00Z');raw.meta.tradingPeriods={regular:[[{start:times[0],end:sec('2026-11-19T04:00:00Z')},{start:times[3],end:sec('2026-11-19T08:00:00Z')}]]};
 const hour=parseIntraday(raw,'0700.HK','1h');assert.equal(hour.bars.length,6);assert.equal(hour.bars[3].time,times[3]);const four=parseIntraday(raw,'0700.HK','4h');assert.equal(four.bars.length,2);assert.equal(four.bars[0].volume,300);assert.equal(four.bars[1].volume,300);assert.equal(four.bars[0].endTime,sec('2026-11-19T04:00:00Z'));
});
test('generic four-hour aggregation does not span a missing hourly source bar and FX volume stays unavailable',()=>{
 const start=sec('2026-11-19T00:00:00Z'),times=[0,1,3,4,5,6].map(h=>start+h*3600),raw=source('KRW=X','KRW','Europe/London',times.map(()=>1400),times);raw.meta.regularMarketTime=start+7*3600;
 const result=parseIntraday(raw,'KRW=X','4h');assert.equal(result.bars.length,2);assert.equal(result.bars[0].time,times[0]);assert.equal(result.bars[1].time,times[2]);assert.ok(result.bars.every(b=>b.volume===null));
});
test('global and ETF native-name searches are bounded and work without an external network call',async t=>{
 const original=global.fetch;t.after(()=>{global.fetch=original;});global.fetch=()=>{throw Error('unexpected fetch');};
 for(const [market,q,symbol] of [['fx','달러인덱스','DX-Y.NYB'],['fx','원달러','KRW=X'],['commodities','금','GC=F'],['commodities','WTI','CL=F'],['indices','닛케이','^N225'],['etfkr','KODEX 200','069500.KS']])assert.equal((await searchInstruments(q,market)).rows[0].symbol,symbol);
});
test('overseas search does not misclassify another country listing or ordinary stock as an ETF',async t=>{
 const original=global.fetch;t.after(()=>{global.fetch=original;});global.fetch=async()=>Response.json({quotes:[{symbol:'SAP.DE',quoteType:'EQUITY',shortname:'SAP'},{symbol:'SAP',quoteType:'EQUITY',shortname:'SAP ADR'},{symbol:'SPY',quoteType:'ETF',shortname:'SPY'}]});
 const us=await searchInstruments('SAP','us');assert.ok(us.rows.some(r=>r.symbol==='SAP'));assert.ok(!us.rows.some(r=>r.symbol==='SAP.DE'));const etf=await searchInstruments('SPY','etf');assert.ok(etf.rows.every(r=>r.kind==='etf'));const de=await searchInstruments('SAP','de');assert.ok(de.rows.some(r=>r.symbol==='SAP.DE'));
});
test('cloud layouts and CSV preserve extended markets and special characters without guest-data mixing',()=>{
 const entries=[{market:'fx',symbol:'KRW=X',name:'달러/원',group_name:'거시'},{market:'commodities',symbol:'GC=F',name:'금 선물',group_name:'거시'},{market:'jp',symbol:'7203.T',name:'도요타',group_name:'해외'},{market:'etfkr',symbol:'069500.KS',name:'KODEX 200',group_name:'ETF'}];assert.deepEqual(importWatchCSV(exportWatchCSV(entries)),entries);
 const workspace=normalizeWorkspace({main:{market:'fx',symbols:defaultSymbols()},panes:[{interval:'1h',symbols:{us:'AAPL',jp:'7203.T',fx:'KRW=X',commodities:'GC=F'}}]});assert.equal(workspace.main.market,'fx');assert.equal(workspace.panes[0].symbols.fx,'KRW=X');assert.deepEqual(normalizeWorkspace(workspace),workspace);
});
test('new-market alert validation accepts valid identities and rejects unavailable FX volume',()=>{
 for(const market of MARKET_IDS){const def=MARKETS[market];assert.equal(validateAlert({market,symbol:def.symbol,kind:'price_above',threshold:100,period:20}).symbol,def.symbol);}
 assert.throws(()=>validateAlert({market:'fx',symbol:'KRW=X',kind:'volume_above',threshold:2,period:20}),/거래량/);assert.throws(()=>validateAlert({market:'jp',symbol:'NVDA',kind:'price_above',threshold:100}));
});
test('Sydney daily/intraday synchronization uses the exchange date rather than the prior UTC date',()=>{
 const bars=[{time:sec('2026-11-18T23:00:00Z'),close:10},{time:sec('2026-11-19T00:00:00Z'),close:11}];assert.equal(nearestTimeBar(bars,'2026-11-19',{timeZone:'Australia/Sydney'}),bars[0]);assert.equal(nearestTimeBar(bars,'2026-11-19',{timeZone:'Australia/Sydney',endOfDay:true}),bars[1]);
 const daily=[{time:'2026-11-18'},{time:'2026-11-19'}];assert.equal(nearestTimeBar(daily,bars[0].time,{timeZone:'Australia/Sydney'}),daily[1]);
 const restored=normalizeWorkspace({panes:[{market:'fx',interval:'1h',symbols:{fx:'KRW=X'}},{market:'commodities',interval:'D',symbols:{commodities:'GC=F'}}]});assert.equal(restored.panes[0].market,'fx');assert.equal(restored.panes[1].symbols.commodities,'GC=F');assert.deepEqual(normalizeWorkspace(restored),restored);
});
