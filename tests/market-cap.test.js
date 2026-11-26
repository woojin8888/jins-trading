import test from 'node:test';
import assert from 'node:assert/strict';
import {marketCapitalization,capitalizationRequest} from '../server/market-cap.js';
import {formatMarketCapKRW} from '../src/market-cap.js';
import {routeMarket} from '../server/market.js';
import {assetQuote} from '../server/global-data.js';
import {knownAsset} from '../src/instruments.js';
const stamp=1795651200;
function fakeFetch({marketCap=306331050110,currency='KRW',type='stock',fxPrice=1400,failFX=false,wrongSymbol=false}={}){
 return async(url,options)=>{
  if(String(url).includes('/scan')){const query=JSON.parse(options.body);return Response.json({data:[{s:wrongSymbol?'NASDAQ:WRONG':query.symbols.tickers[0],d:['name',currency,marketCap,type,stamp]}]});}
  if(failFX)return new Response('',{status:503});
  return Response.json({chart:{result:[{meta:{symbol:'USDKRW=X',instrumentType:'CURRENCY',currency:'KRW',regularMarketTime:stamp,regularMarketPrice:fxPrice,exchangeTimezoneName:'Europe/London'},timestamp:[stamp],indicators:{quote:[{open:[fxPrice],high:[fxPrice+1],low:[fxPrice-1],close:[fxPrice],volume:[0]}]}}]}});
 };
}
test('Korean capitalization is expressed in KRW without any exchange-rate multiplication',async t=>{
 const original=global.fetch;t.after(()=>global.fetch=original);global.fetch=fakeFetch();const r=await marketCapitalization('kr','263860.KQ',{fresh:true});assert.equal(r.status,'available');assert.equal(r.krw,306331050110);assert.equal(r.currency,'KRW');assert.equal(r.fx,null);assert.equal(r.sourceSymbol,'KRX:263860');assert.equal(formatMarketCapKRW(r.krw),'0.31조 원');
});
test('foreign capitalization multiplies the actual rate and keeps both source units and timestamps',async t=>{
 const original=global.fetch;t.after(()=>global.fetch=original);global.fetch=fakeFetch({marketCap:3.5e12,currency:'USD',fxPrice:1400});const r=await marketCapitalization('us','NVDA',{fresh:true});assert.equal(r.krw,4.9e15);assert.equal(r.nativeValue,3.5e12);assert.equal(r.fx.rate,1400);assert.equal(r.fx.symbol,'KRW=X');assert.equal(formatMarketCapKRW(r.krw),'4,900.00조 원');assert.ok(r.fx.asOf);
});
test('unsupported assets never display fund AUM, index levels, or futures as company capitalization',async t=>{
 const original=global.fetch;t.after(()=>global.fetch=original);let calls=0;global.fetch=async()=>{calls++;throw Error('unexpected');};for(const [market,symbol] of [['indices','^GSPC'],['fx','KRW=X'],['etf','SPY'],['us','SPY'],['commodities','GC=F']])assert.equal((await marketCapitalization(market,symbol)).status,'not-applicable');assert.equal(calls,0);
});
test('missing caps, unknown currencies, mismatched symbols and failed FX never become fake zero-valued caps',async t=>{
 const original=global.fetch;t.after(()=>global.fetch=original);
 for(const params of [{marketCap:null},{marketCap:0},{currency:'EUR'},{wrongSymbol:true}]){global.fetch=fakeFetch(params);const r=await marketCapitalization('kr','263860.KQ',{fresh:true});assert.equal(r.status,'unavailable');assert.equal(r.krw,null);}
 global.fetch=fakeFetch({currency:'USD',marketCap:1e12,failFX:true});const r=await marketCapitalization('us','NVDA',{fresh:true});assert.equal(r.krw,null);assert.equal(r.status,'unavailable');
});
test('British share prices in pennies do not multiply pound-denominated cap by 100',async t=>{
 const original=global.fetch;t.after(()=>global.fetch=original);global.fetch=async(url,options)=>{
  if(String(url).includes('/scan'))return Response.json({data:[{s:'LSE:AZN',d:['AZN','GBX',216073868752,'stock',stamp]}]});
  return Response.json({chart:{result:[{meta:{symbol:'GBPKRW=X',instrumentType:'CURRENCY',currency:'KRW',regularMarketTime:stamp,regularMarketPrice:1800},timestamp:[stamp],indicators:{quote:[{open:[1800],high:[1801],low:[1799],close:[1800],volume:[0]}]}}]}});
 };const r=await marketCapitalization('uk','AZN.L',{fresh:true});assert.equal(r.currency,'GBP');assert.equal(r.krw,216073868752*1800);
});
test('small cap formatting preserves the trillion-won unit without rounding a real amount to zero',()=>{
 assert.equal(formatMarketCapKRW(null),'—');assert.equal(formatMarketCapKRW(0),'—');assert.equal(formatMarketCapKRW(1.234e12),'1.23조 원');assert.equal(formatMarketCapKRW(1e9),'0.001조 원');assert.equal(formatMarketCapKRW(1e7),'0.0001조 원 미만');
});
test('request identities cover Korean boards and common international symbol spellings',()=>{
 assert.deepEqual(capitalizationRequest('kr','263860.KQ').symbols.tickers,['KRX:263860']);assert.ok(capitalizationRequest('us','BRK-B').symbols.tickers.includes('NYSE:BRK.B'));assert.ok(capitalizationRequest('hk','0700.HK').symbols.tickers.includes('HKEX:700'));
});
test('the capitalization API validates symbols before any external fetch',async t=>{
 const original=global.fetch;t.after(()=>global.fetch=original);global.fetch=()=>{throw Error('unexpected fetch');};const r=await routeMarket(new URL('https://test/api/market?action=capitalization&market=kr&symbol=not-a-stock'));assert.equal(r.status,400);
});

test('capitalization FX lookup preserves the public currency listing identity in the shared quote cache',async t=>{
 const original=global.fetch;t.after(()=>global.fetch=original);global.fetch=fakeFetch({marketCap:1e12,currency:'USD',fxPrice:1400});await marketCapitalization('us','NVDA',{fresh:true});const row=await assetQuote(knownAsset('KRW=X'));assert.equal(row.name,'달러 / 원');assert.equal(row.market,'fx');assert.equal(row.symbol,'KRW=X');
});
