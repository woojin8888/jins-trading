import test from 'node:test';
import assert from 'node:assert/strict';
import {pineFixedProfile,pineTemplate} from '../src/pine-template.js';
import {createStudy,normalizeStudy} from '../src/indicators.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('Pine body/wick allocation conserves non-flat volume and splits candle bodies by direction',()=>{
 const up={time:'2026-11-20',open:2,close:4,low:0,high:6,volume:100},down={...up,time:'2026-11-23',open:4,close:2},profile=pineFixedProfile([up,down],{profileBars:2,rows:6,valueArea:70});
 near(profile.inputVolume,200);near(profile.allocatedVolume,200);
 for(const bin of profile.bins)near(bin.up,bin.down);
 // Denominator = 2*2 + 2*2 + 2 = 10: each candle's
 // body gets 20, each wick gets 40, split half to both sides.
 profile.bins.forEach((bin,i)=>near(bin.total,[40,40,20,20,40,40][i]));
 assert.equal(profile.pocIndex,0);assert.equal(profile.pocPrice,.5);
 assert.equal(profile.originIndex,0);
});
test('Pine doji/flat rules do not manufacture a price distribution or a POC',()=>{
 const flat={time:'2026-11-20',open:3,close:3,low:3,high:3,volume:500};
 const profile=pineFixedProfile([flat],{profileBars:150,rows:24,valueArea:70});
 assert.equal(profile.status,'flat');assert.equal(profile.pocPrice,null);assert.equal(profile.inputVolume,500);assert.equal(profile.allocatedVolume,0);
 const doji={...flat,low:0,high:6};const split=pineFixedProfile([doji],{profileBars:1,rows:6,valueArea:70});near(split.allocatedVolume,500);for(const bin of split.bins)near(bin.up,bin.down);
});
test('value-area ties expand upward and zero adjacent bins stop expansion like Pine',()=>{
 const bars=[{open:0,close:1,low:0,high:1,volume:100},{open:2,close:3,low:2,high:3,volume:100}];
 const profile=pineFixedProfile(bars,{profileBars:2,rows:3,valueArea:100});
 assert.equal(profile.pocIndex,0);assert.equal(profile.actualValueAreaPercent,50);assert.equal(profile.val,0);assert.equal(profile.vah,1);
 const uniform=pineFixedProfile([{open:0,close:4,low:0,high:4,volume:400}],{profileBars:1,rows:4,valueArea:70});assert.equal(uniform.pocIndex,0);assert.equal(uniform.vah,3);
});
test('unconfirmed price moves update the fixed profile but not the confirmed criteria table',()=>{
 const study=createStudy('minerviniTemplate'),bars=Array.from({length:280},(_,i)=>({time:i,open:100+i,close:101+i,low:99+i,high:102+i,volume:1000})),confirmed=bars.slice(0,-1);
 const before=pineTemplate(bars,study.params,confirmed),changed=[...bars.slice(0,-1),{...bars.at(-1),close:999,high:1000}];
 const after=pineTemplate(changed,study.params,confirmed);
 assert.deepEqual(after.table,before.table);assert.equal(after.table.asOf,278);assert.equal(after.high,1000);assert.notDeepEqual(after.profile.bins,before.profile.bins);
 const rsIndex=confirmed.length-1,expected=(.4*confirmed[rsIndex].close/confirmed[rsIndex-13].close+.2*confirmed[rsIndex].close/(confirmed[rsIndex-26].close*2)+.2*confirmed[rsIndex].close/(confirmed[rsIndex-39].close*3)+.2*confirmed[rsIndex].close/(confirmed[rsIndex-52].close*4))*100;near(after.table.rs,expected);
 assert.equal(pineTemplate(bars,study.params,confirmed,{profileAllowed:false}).profile,null);
});
test('partial volume stays explicit and selection/color inputs are validated',()=>{
 const profile=pineFixedProfile([{open:1,close:2,low:0,high:3,volume:100},{open:2,close:3,low:1,high:4,volume:null}],{profileBars:150,rows:24,valueArea:70});assert.equal(profile.status,'partial');assert.equal(profile.missingVolumeBars,1);near(profile.allocatedVolume,100);
 const study=createStudy('minerviniTemplate'),normalized=normalizeStudy({...study,params:{...study.params,tablePosition:'javascript:bad',upColor:'url(x)',language:'en'}});assert.equal(normalized.params.tablePosition,'bottom-right');assert.equal(normalized.params.upColor,'#9ca3af');assert.equal(normalized.params.language,'en');
});
