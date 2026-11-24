import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDailyHistory,historyQuality} from '../server/history-data.js';
import {missingKoreanStockDates,parseDaumDaily,mergeKoreanStockRepair,repairKoreanStockHistory} from '../server/korean-stock-repair.js';
const now=Date.parse('2026-11-24T05:30:00Z'),symbol='180640.KS';
const rows=[
 ['2024-01-11',82800,83900,81300,83000,133793],['2024-01-12',83000,83400,74300,78000,346984],
 ['2024-01-15',77900,79300,77200,79700,23800],['2024-01-16',78500,80500,78500,80200,83490],['2024-01-17',79500,81400,75700,76100,165056],
 ['2025-09-17',115600,119700,114500,116500,53968],['2025-09-18',116000,116500,113200,113900,74598],['2025-09-19',null,null,null,null,null],
 ['2025-09-22',110000,111200,106400,106500,74566],['2025-09-23',105500,107300,104200,104500,59300],
];
const actual=rows.map(row=>row[0]==='2024-01-15'?['2024-01-15',77900,79900,77200,79700,102784]:row[0]==='2025-09-19'?['2025-09-19',112800,113900,108500,108500,371997]:row[0]==='2025-09-18'?['2025-09-18',116000,116500,113200,113800,74598]:row);
const body={code:200,data:actual.map(([date,openingPrice,highPrice,lowPrice,tradePrice,candleAccTradeVolume])=>({symbolCode:'KR7180640005',date,openingPrice,highPrice,lowPrice,tradePrice,candleAccTradeVolume}))};
const xml='<chartdata symbol="180640">'+actual.map(([date,...values])=>'<item data="'+date.replaceAll('-','')+'|'+values.map((value,i)=>date==='2025-09-19'&&i===4?374633:value).join('|')+'"/>').join('')+'</chartdata>';
function base(){return parseDailyHistory({meta:{symbol,currency:'KRW',exchangeTimezoneName:'Asia/Seoul',regularMarketPrice:227000,regularMarketTime:now/1000,priceHint:2},timestamp:rows.map(row=>Date.parse(row[0])/1000),indicators:{quote:[Object.fromEntries(['open','high','low','close','volume'].map((field,index)=>[field,rows.map(row=>row[index+1])]))]}},symbol);}

test('the two actual failure modes are identified: close above high and entirely null OHLCV',()=>{
 const data=base();assert.equal(data.invalidBarCount,2);assert.deepEqual(missingKoreanStockDates(data,symbol,now),['2024-01-15','2025-09-19']);
});
test('two matching providers restore complete OHLCV while preserving good candles and the latest quote',()=>{
 const data=base(),result=mergeKoreanStockRepair(data,symbol,xml,[body],now);
 assert.equal(result.bars.length,rows.length);assert.deepEqual(historyQuality(result,now).missingDailyDates,[]);
 for(const bar of data.bars)assert.equal(result.bars.find(candidate=>candidate.time===bar.time),bar);
 assert.equal(result.quote,data.quote);assert.equal(result.meta,data.meta);
 const jan=result.bars.find(bar=>bar.time==='2024-01-15');assert.equal(jan.high,79900);assert.equal(jan.close,79700);assert.equal(jan.volume,102784);
 const sep=result.bars.find(bar=>bar.time==='2025-09-19');assert.equal(sep.open,112800);assert.equal(sep.close,108500);assert.equal(sep.volume,371997);
 assert.deepEqual(result.dailyRepairs[1].contextDates,['2025-09-22','2025-09-23']);
 assert.equal(result.dailyRepairs[1].comparisonVolume,374633);assert.equal(result.dailyRepairs[1].volumeDifferent,true);assert.ok(result.dailyRepairs[1].volumeDifferencePercent>.7);
 assert.equal(historyQuality(result,now).invalidBarCount,2); // upstream errors remain auditable
 assert.equal(mergeKoreanStockRepair(result,symbol,xml,[body],now),result);
});
test('another security, currency, exchange, adjusted-price scale or disagreeing price cannot repair a candle',()=>{
 const data=base();
 assert.equal(mergeKoreanStockRepair(data,symbol,xml.replace('symbol="180640"','symbol="005930"'),[body],now),data);
 assert.equal(mergeKoreanStockRepair(data,symbol,xml,[{...body,data:body.data.map(row=>({...row,symbolCode:'KR7005930003'}))}],now),data);
 assert.deepEqual(missingKoreanStockDates({...data,meta:{...data.meta,currency:'USD'}},symbol,now),[]);
 assert.deepEqual(missingKoreanStockDates({...data,meta:{...data.meta,symbol:'180640.KQ'}},'180640.KQ',now),[]);
 const scaled={...data,bars:data.bars.map(bar=>({...bar,...Object.fromEntries(['open','high','low','close'].map(field=>[field,bar[field]*2]))}))};
 assert.equal(mergeKoreanStockRepair(scaled,symbol,xml,[body],now),scaled);
 const disagree={...body,data:body.data.map(row=>({...row,tradePrice:row.date==='2024-01-15'?79200:row.date==='2025-09-19'?109000:row.tradePrice}))};
 assert.equal(mergeKoreanStockRepair(data,symbol,xml,[disagree],now),data);
});
test('partial restoration keeps the remaining missing date visible and never manufactures volume',()=>{
 const data=base(),partial={...body,data:body.data.filter(row=>row.date!=='2025-09-19')},result=mergeKoreanStockRepair(data,symbol,xml,[partial],now);
 assert.deepEqual(historyQuality(result,now).missingDailyDates,['2025-09-19']);
 const noVolume={...body,data:body.data.map(row=>({...row,candleAccTradeVolume:null}))};
 assert.equal(mergeKoreanStockRepair(data,symbol,xml,[noVolume],now),data);
});
test('current sessions, holidays and invalid calendar dates are not fabricated as historical sessions',()=>{
 const data=base();assert.deepEqual(missingKoreanStockDates({...data,invalidBarDates:['2026-11-24','2026-02-30']},symbol,now),[]);
 assert.deepEqual(missingKoreanStockDates({...data,invalidBarDates:[]},symbol,now),[]);
 assert.deepEqual(parseDaumDaily({code:200,data:[{...body.data[0],date:'2026-11-24'}]},'180640',now),[]);
});
test('a source outage retains the original warning; successful source data is cached without caching user quotes',async t=>{
 const original=global.fetch;t.after(()=>{global.fetch=original;});
 global.fetch=async()=>new Response('unavailable',{status:503});
 const data=base();assert.equal(await repairKoreanStockHistory(data,symbol,now),data);
 let calls=0;global.fetch=async url=>{calls++;return String(url).includes('fchart.')?new Response(xml):Response.json(body);};
 const result=await repairKoreanStockHistory(data,symbol,now+61000);assert.equal(result.bars.length,rows.length);assert.equal(calls,3);
 const changed={...data,quote:{...data.quote,price:230000}},again=await repairKoreanStockHistory(changed,symbol,now+62000);
 assert.equal(calls,3);assert.equal(again.quote,changed.quote);assert.equal(again.quote.price,230000);
});
