import test from 'node:test';import assert from 'node:assert/strict';import {koreanDailyFallback} from '../server/korean-history.js';
test('Korean fallback displays actual daily candles with identified exchange and a separately dated regular quote',async()=>{
 const old=globalThis.fetch;try{globalThis.fetch=async url=>String(url).includes('/basic')?Response.json({itemCode:'471800',stockName:'에이엘로봇',stockExchangeType:{code:'KQ'},closePrice:'12,070',fluctuationsRatio:'8.15',localTradedAt:'2026-11-24T09:11:20+09:00'}):new Response('<chartdata symbol="471800"><item data="20261123|9970|12770|9910|11160|12431309"/><item data="20261124|11440|12380|11410|12180|893923"/></chartdata>');
 const r=await koreanDailyFallback('471800.KS',null,Date.parse('2026-11-24T01:00:00Z'));assert.equal(r.symbol,'471800.KQ');assert.equal(r.bars.length,2);assert.equal(r.bars.at(-1).close,12180);assert.equal(r.quote.price,12070);assert.equal(r.quote.asOf,'2026-11-24T00:11:20.000Z');assert.equal(r.quality.sessionOpen,true);assert.equal(r.quality.priceMismatch,true);assert.match(r.source,/네이버/);
 }finally{globalThis.fetch=old}
});
test('a mismatched basic quote never becomes a candle or a fabricated price timestamp',async()=>{
 const old=globalThis.fetch;try{globalThis.fetch=async url=>String(url).includes('/basic')?Response.json({itemCode:'005930',closePrice:'100',localTradedAt:'2026-11-24T10:00:00+09:00'}):new Response('<chartdata symbol="471800"><item data="20261123|9970|12770|9910|11160|12431309"/></chartdata>');const r=await koreanDailyFallback('471800.KQ',null,Date.parse('2026-11-24T01:00:00Z'));assert.equal(r.quote.price,null);assert.equal(r.quote.asOf,null);assert.equal(r.bars[0].close,11160);assert.equal(await koreanDailyFallback('BAD',null),null)}finally{globalThis.fetch=old}
});
