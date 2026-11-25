import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTreasuryXml,treasuryHistory} from '../server/treasury-rates.js';
import {aggregateTreasury} from '../src/treasury-rates.js';
const now=Date.parse('2026-11-25T03:00:00Z');
const xml=rows=>'<feed xmlns="http://www.w3.org/2005/Atom"><title>DailyTreasuryYieldCurveRateData</title>'+rows.map(([date,two,ten,thirty])=>'<m:properties><d:NEW_DATE>'+date+'T00:00:00</d:NEW_DATE><d:BC_2YEAR>'+two+'</d:BC_2YEAR><d:BC_10YEAR>'+ten+'</d:BC_10YEAR>'+(thirty===null?'<d:BC_30YEAR m:null="true"/>':'<d:BC_30YEAR>'+thirty+'</d:BC_30YEAR>')+'</m:properties>').join('')+'</feed>';
test('official percent observations keep all three tenors and never turn missing/zero rates into fabricated candles',()=>{
 const rows=parseTreasuryXml(xml([['2026-11-23',4.63,4.92,5.29],['2026-11-24',4.63,4.91,5.30],['2026-11-20',0,-.1,null],['2026-11-26',9,9,9],['2026-02-30',5,5,5]]),2026,now);
 assert.equal(rows.length,3);assert.equal(rows.at(-1).values.UST10Y,4.91);assert.equal(rows.at(-1).values.UST30Y,5.30);assert.equal(rows[0].values.UST2Y,0);assert.equal(rows[0].values.UST10Y,-.1);assert.equal(rows[0].values.UST30Y,undefined);
 assert.throws(()=>parseTreasuryXml('<html>blocked</html>',2026,now));assert.throws(()=>parseTreasuryXml('<!DOCTYPE x>'+xml([['2026-11-23',4,5,6]]),2026,now));
});
test('weekly and monthly charts retain the final real observation date, not synthetic OHLC',()=>{
 const rows=[['2026-10-30',4.8],['2026-11-02',4.9],['2026-11-06',5],['2026-11-09',4.7]].map(([time,close])=>({time,close,volume:null}));
 assert.deepEqual(aggregateTreasury(rows,'W').map(x=>x.time),['2026-10-30','2026-11-06','2026-11-09']);assert.deepEqual(aggregateTreasury(rows,'M').map(x=>x.time),['2026-10-30','2026-11-09']);assert.throws(()=>aggregateTreasury(rows,'4h'));
});
test('the data adapter reports missing years and percent-point changes without inventing timestamps or volume',async t=>{
 const original=global.fetch;t.after(()=>{global.fetch=original;});global.fetch=async url=>{const year=Number(new URL(url).searchParams.get('field_tdr_date_value'));return year===2026?new Response(xml([['2026-11-23',4.63,4.92,5.29],['2026-11-24',4.63,4.91,5.30]])):new Response('unavailable',{status:503});};
 const result=await treasuryHistory('UST10Y','2y',{now});assert.equal(result.asOfDate,'2026-11-24');assert.ok(Math.abs(result.changeBasisPoints+1)<1e-8);assert.equal(result.quality.ohlcAvailable,false);assert.equal(result.quality.volumeAvailable,false);assert.deepEqual(result.quality.missingYears,[2024,2025]);assert.match(result.basis,/TVC/);
 assert.ok(result.observations.every(row=>row.open===undefined&&row.high===undefined&&row.low===undefined&&row.volume===null));
 await assert.rejects(()=>treasuryHistory('US10Y','2y',{now}),/코드/);await assert.rejects(()=>treasuryHistory('UST10Y','100y',{now}),/기간/);
});
