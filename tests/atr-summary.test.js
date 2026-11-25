import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyAtrSummary} from '../src/atr-summary.js';
import {atr} from '../src/analysis.js';
import {createReplaySession,replaySnapshot} from '../src/bar-replay.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const bars=n=>Array.from({length:n},(_,i)=>({time:new Date(Date.UTC(2025,0,i+1)).toISOString().slice(0,10),open:100+i*.2,high:102+i*.2+Math.sin(i)**2,low:98+i*.2,close:101+i*.2,volume:1000}));
test('the default daily ATR% uses the same Wilder ATR and reference close as the existing card',()=>{
 const data=bars(350),copy=structuredClone(data),summary=dailyAtrSummary(data,{currency:'KRW'}),card=atr(data);near(summary.value,card.value);near(summary.percent,card.percent);assert.equal(summary.period,14);assert.equal(summary.basis,'D');assert.equal(summary.currency,'KRW');assert.equal(summary.points.length,260);assert.equal(summary.asOf,data.at(-1).time);assert.equal(summary.points.at(-1).time,summary.asOf);near(summary.points.at(-1).value,card.percent);assert.deepEqual(data,copy);
});
test('the first fourteen true ranges seed ATR and a gap participates in the next Wilder update',()=>{
 const data=bars(15).map(b=>({...b,open:10,high:11,low:9,close:10})),first=dailyAtrSummary(data);near(first.value,2);near(first.percent,20);assert.equal(first.points.length,1);data.push({...data.at(-1),time:'2025-01-16',open:14,high:15,low:13,close:14});const next=dailyAtrSummary(data);near(next.value,(13*2+5)/14);near(next.percent,((13*2+5)/14)/14*100);
});
test('unavailable history and non-daily timestamps cannot be represented as a zero percent daily ATR',()=>{
 for(const data of [[],bars(14)]){const summary=dailyAtrSummary(data);assert.equal(summary.percent,null);assert.equal(summary.status,'insufficient');assert.equal(summary.points.length,0);}
 const intraday=bars(30).map((b,i)=>({...b,time:1794925800+i*900}));assert.equal(dailyAtrSummary(intraday).status,'invalid');assert.equal(dailyAtrSummary(intraday).percent,null);
 const zero=bars(30);zero.at(-1).close=0;assert.equal(dailyAtrSummary(zero).percent,null);
 const invalid=bars(30);invalid.at(-1).high=null;assert.equal(dailyAtrSummary(invalid).status,'invalid');
});
test('forming daily values are identified and replay uses only the revealed daily history',()=>{
 const data=bars(300),history={symbol:'NVDA',currency:'USD',timeZone:'America/New_York',bars:data,quality:{sessionOpen:false}},session=createReplaySession({chart:history,daily:history,interval:'D'}),snapshot=replaySnapshot(session,100),before=dailyAtrSummary(snapshot.dailyBars,{replay:true,forming:true});data[200].high=99999;near(dailyAtrSummary(snapshot.dailyBars,{replay:true}).percent,before.percent);assert.equal(before.forming,false);assert.equal(before.asOf,snapshot.dailyBars.at(-1).time);assert.ok(before.points.every(p=>p.time<=before.asOf));assert.equal(dailyAtrSummary(data,{forming:true}).forming,true);
});
