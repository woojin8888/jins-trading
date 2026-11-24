import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDailyHistory,historyQuality} from '../server/history-data.js';
import {missingIndexDates,mergeKoreanIndexRepair,repairKoreanIndexHistory} from '../server/korean-index-repair.js';
const now=Date.parse('2026-11-24T03:00:00Z');
const dates=['2026-11-19','2026-11-20','2026-11-23','2026-11-24'];
function history(){return parseDailyHistory({meta:{symbol:'^KS11',currency:'KRW',exchangeTimezoneName:'Asia/Seoul',regularMarketPrice:5055,regularMarketTime:now/1000,priceHint:2},timestamp:dates.map(date=>Date.parse(date+'T00:00:00Z')/1000),indicators:{quote:[{open:[5090.04,4928.51,null,4880.16],high:[5137.89,4971.31,null,5065.74],low:[4963.61,4831.69,null,4880.16],close:[5137.89,4869.96,null,5055],volume:[195700,206700,null,68870]}]}},'^KS11');}
const xml='<chartdata symbol="KOSPI"><item data="20261119|5090.04|5137.89|4963.61|5137.89|195695"/><item data="20261120|4928.51|4971.31|4831.69|4869.96|206729"/><item data="20261123|4734.90|4759.88|4586.80|4708.54|218577"/><item data="20261124|4880.16|5065.74|4880.16|5024.69|77251"/></chartdata>';

test('a valid latest candle cannot hide an invalid earlier session',()=>{
  const data=history(),quality=historyQuality(data,now);
  assert.equal(quality.missingLatestSession,false);
  assert.deepEqual(quality.missingDailyDates,['2026-11-23']);
  assert.deepEqual(missingIndexDates(data,'^KS11',now),['2026-11-23']);
});
test('verified index OHLC fills the empty date without overwriting the latest quote, candles or volume units',()=>{
  const data=history(),result=mergeKoreanIndexRepair(data,'^KS11',xml,now);
  assert.equal(result.bars.length,4);
  assert.deepEqual(result.bars[2],{time:'2026-11-23',open:4734.9,high:4759.88,low:4586.8,close:4708.54,volume:null});
  assert.equal(result.bars[3],data.bars[2]);assert.equal(result.quote,data.quote);
  assert.equal(result.bars[3].close,5055);
  assert.deepEqual(historyQuality(result,now).missingDailyDates,[]);
  assert.deepEqual(result.repairedDailyDates,['2026-11-23']);
  assert.match(result.dailyRepairSource,/네이버.*KOSPI/);
  assert.equal(mergeKoreanIndexRepair(result,'^KS11',xml,now),result);
});
test('wrong index identity, currency or OHLC scale cannot fill a missing candle',()=>{
  const data=history();
  assert.equal(mergeKoreanIndexRepair(data,'^KS11',xml.replace('symbol="KOSPI"','symbol="KOSDAQ"'),now),data);
  assert.equal(mergeKoreanIndexRepair(data,'^KS11',xml.replace('4869.96','48.6996'),now),data);
  assert.deepEqual(missingIndexDates({...data,meta:{...data.meta,currency:'USD'}},'^KS11',now),[]);
  assert.deepEqual(missingIndexDates(data,'^KQ11',now),[]);
});
test('holidays, absent timestamps and a still-forming current session are never inferred as missing OHLC',()=>{
  const data=history();
  assert.deepEqual(missingIndexDates({...data,invalidBarDates:[]},'^KS11',now),[]);
  assert.deepEqual(missingIndexDates({...data,invalidBarDates:['2026-11-24']},'^KS11',now),[]);
  assert.equal(mergeKoreanIndexRepair(data,'^KS11',xml.replace(/<item data="20261123[^>]+\/>/,''),now),data);
});
test('a secondary provider failure keeps verified history and the explicit missing-date warning',async()=>{
  const original=globalThis.fetch,data=history();
  try{globalThis.fetch=async()=>new Response('unavailable',{status:503});const result=await repairKoreanIndexHistory(data,'^KS11',now);assert.equal(result,data);assert.deepEqual(historyQuality(result,now).missingDailyDates,['2026-11-23']);}
  finally{globalThis.fetch=original;}
});
