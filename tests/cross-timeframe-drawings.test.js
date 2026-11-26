import test from 'node:test';
import assert from 'node:assert/strict';
import {drawingTimeMap,chartAnchorTime,timeStamp,normalizeDrawings,projectDrawing,logicalAtTime} from '../src/drawing-model.js';
const at=iso=>Date.parse(iso),sec=iso=>at(iso)/1000;
const daily=[{time:'2026-11-16'},{time:'2026-11-19'},{time:'2026-11-20'},{time:'2026-11-23'}];
test('daily anchors map to their containing week/month and return unchanged on the daily chart',()=>{
 const p={time:at('2026-11-19T00:00:00Z'),price:41400,dateOnly:true,interval:'D'},before=structuredClone(p);
 assert.equal(chartAnchorTime(p,drawingTimeMap([{time:'2026-11-16'},{time:'2026-11-23'}],'Asia/Seoul','W')),at('2026-11-16T00:00:00Z'));
 assert.equal(chartAnchorTime(p,drawingTimeMap([{time:'2026-11-01'}],'Asia/Seoul','M')),at('2026-11-01T00:00:00Z'));
 assert.equal(chartAnchorTime(p,drawingTimeMap(daily,'Asia/Seoul','D')),p.time);assert.deepEqual(p,before);
});
test('daily lines follow the exchange session even when US opens on the next Korean calendar day',()=>{
 const start=sec('2026-11-19T14:30:00Z'),bars=[{time:start},{time:start+3600}],p={time:at('2026-11-19T00:00:00Z'),price:150,dateOnly:true,interval:'D'};
 assert.equal(chartAnchorTime(p,drawingTimeMap(bars,'America/New_York','1h')),start*1000);
 assert.equal(chartAnchorTime({...p,time:at('2026-11-19T15:30:00Z'),dateOnly:false,interval:'1h'},drawingTimeMap(daily,'America/New_York','D')),p.time);
});
test('fine-timeframe anchors land on the containing four-hour candle without rewriting stored anchors',()=>{
 const start=sec('2026-11-19T14:30:00Z'),bars=[{time:start,endTime:start+14400},{time:start+14400,endTime:start+23400}];
 const p={time:(start+3600)*1000,price:150,dateOnly:false,interval:'1h'};
 assert.equal(chartAnchorTime(p,drawingTimeMap(bars,'America/New_York','4h')),start*1000);
 assert.equal(chartAnchorTime(p,drawingTimeMap([{time:start},{time:start+3600}],'America/New_York','1h')),p.time);
});
test('a weekly anchor on a holiday maps to the first provided trading session in that week',()=>{
 const p={time:at('2026-11-16T00:00:00Z'),price:100,dateOnly:true,interval:'W'},bars=[{time:'2026-11-13'},{time:'2026-11-17'},{time:'2026-11-18'}];
 assert.equal(chartAnchorTime(p,drawingTimeMap(bars,'Asia/Seoul','D')),at('2026-11-17T00:00:00Z'));
});
test('resistance, support and trend preserve IDs, prices and source frame metadata across persisted views',()=>{
 const p={time:at('2026-11-19T00:00:00Z'),price:100,dateOnly:true,interval:'D'},q={...p,time:at('2026-11-23T00:00:00Z'),price:110};
 const doc=normalizeDrawings({version:1,items:[{id:'support',type:'horizontal',points:[p],visible:true,color:'#111111',width:2},{id:'trend',type:'trend',points:[p,q],visible:true,color:'#111111',width:2}]});
 assert.deepEqual(normalizeDrawings(JSON.parse(JSON.stringify(doc))),doc);
 const bars=[{time:'2026-11-16'},{time:'2026-11-23'}],map=drawingTimeMap(bars,'Asia/Seoul','W'),times=bars.map(b=>timeStamp(b.time));
 const row=projectDrawing(doc.items[1],p=>({x:logicalAtTime(chartAnchorTime(p,map),times),y:p.price}));assert.deepEqual(row.points,[{x:0,y:100},{x:1,y:110}]);assert.deepEqual(doc.items[1].points,[p,q]);
});
