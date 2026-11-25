import test from 'node:test';
import assert from 'node:assert/strict';
import {pineFixedProfile,pineTemplate,pineProfile} from '../src/pine-template.js';
import {createStudy,normalizeStudy,calculateStudy} from '../src/indicators.js';
import {defaultChartPreferences,normalizePreferences} from '../src/chart-preferences.js';
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
 const after=pineTemplate(changed,study.params,confirmed),profile=createStudy('pineVolumeProfile');
 assert.deepEqual(after.table,before.table);assert.equal(after.table.asOf,278);assert.equal(after.profile,undefined);assert.equal(after.high,undefined);assert.notDeepEqual(pineProfile(changed,profile.params).profile.bins,pineProfile(bars,profile.params).profile.bins);
 const rsIndex=confirmed.length-1,expected=(.4*confirmed[rsIndex].close/confirmed[rsIndex-13].close+.2*confirmed[rsIndex].close/(confirmed[rsIndex-26].close*2)+.2*confirmed[rsIndex].close/(confirmed[rsIndex-39].close*3)+.2*confirmed[rsIndex].close/(confirmed[rsIndex-52].close*4))*100;near(after.table.rs,expected);
 assert.equal(pineProfile(bars,profile.params,{profileAllowed:false}).profile,null);assert.equal(calculateStudy(profile,bars).template.table,undefined);assert.deepEqual(calculateStudy(profile,bars).series,[]);
});
test('partial volume stays explicit and selection/color inputs are validated',()=>{
 const profile=pineFixedProfile([{open:1,close:2,low:0,high:3,volume:100},{open:2,close:3,low:1,high:4,volume:null}],{profileBars:150,rows:24,valueArea:70});assert.equal(profile.status,'partial');assert.equal(profile.missingVolumeBars,1);near(profile.allocatedVolume,100);
 const study=createStudy('minerviniTemplate'),normalized=normalizeStudy({...study,params:{...study.params,tablePosition:'javascript:bad',upColor:'url(x)',language:'en'}});assert.equal(normalized.params.tablePosition,'bottom-right');assert.equal(normalized.params.upColor,undefined);assert.equal(normalizeStudy({...createStudy('pineVolumeProfile'),params:{upColor:'url(x)'}}).params.upColor,'#9ca3af');assert.equal(normalized.params.language,'en');
});

test('legacy combined Pine overlays split without changing table or profile settings',()=>{
 const old={...createStudy('minerviniTemplate'),id:'legacy-combined',color:'#ef5350',width:3,params:{highLookback:200,lowLookback:240,showTable:true,tablePosition:'top-left',language:'en',showHighLow:true,showFixedProfile:true,profileBars:180,rows:36,valueArea:68,showPocLabel:true,upColor:'#aaaaaa',downColor:'#777777',opacity:23}};
 const next=normalizePreferences({...defaultChartPreferences(),studies:[old],showProfile:true,profile:{...defaultChartPreferences().profile,pocColor:'#dba141'}});
 assert.equal(next.studies.length,2);const [table,profile]=next.studies;assert.equal(table.id,old.id);assert.equal(table.params.tablePosition,'top-left');assert.equal(table.params.showHighLow,undefined);assert.equal(table.params.showFixedProfile,undefined);assert.equal(profile.type,'pineVolumeProfile');assert.notEqual(profile.id,table.id);assert.equal(profile.params.profileBars,180);assert.equal(profile.params.rows,36);assert.equal(profile.params.upColor,'#aaaaaa');assert.equal(profile.params.opacity,23);assert.equal(profile.params.showPOC,true);assert.equal(profile.params.showPocLabel,undefined);assert.equal(profile.color,'#6b7280');assert.equal(profile.width,3);assert.equal(next.profile.pocColor,'#6b7280');assert.equal(next.showProfile,true);assert.deepEqual(normalizePreferences(next),next);
 const disabled=normalizePreferences({...defaultChartPreferences(),studies:[{...old,params:{...old.params,showFixedProfile:false}}]});assert.equal(disabled.studies.length,1);
 const hidden=normalizePreferences({...defaultChartPreferences(),studies:[{...old,visible:false}]});assert.ok(hidden.studies.every(s=>s.visible===false));
});
test('a full study list keeps all existing overlays and queues the split profile without losing it',()=>{
 const old={...createStudy('minerviniTemplate'),params:{...createStudy('minerviniTemplate').params,showFixedProfile:true,profileBars:200}},others=Array.from({length:11},()=>createStudy('ema'));
 const next=normalizePreferences({...defaultChartPreferences(),studies:[old,...others]});assert.equal(next.studies.length,12);assert.deepEqual(next.studies.slice(1),others);assert.equal(next.pendingSeparatedProfiles.length,1);assert.equal(next.pendingSeparatedProfiles[0].params.profileBars,200);assert.deepEqual(normalizePreferences(next),next);
 const freed=normalizePreferences({...next,studies:next.studies.slice(0,-1)});assert.equal(freed.studies.length,12);assert.equal(freed.pendingSeparatedProfiles.length,0);assert.equal(freed.studies.at(-1).type,'pineVolumeProfile');assert.equal(freed.studies.at(-1).params.profileBars,200);assert.deepEqual(normalizePreferences(freed),freed);
});
test('split profile IDs are valid and unique even with old long IDs and an existing suffix collision',()=>{
 const old={...createStudy('minerviniTemplate'),id:'a'.repeat(80),params:{showFixedProfile:true}},collision={...createStudy('ema'),id:'a'.repeat(72)+'-pine-vp'};
 const next=normalizePreferences({...defaultChartPreferences(),studies:[old,collision]});assert.equal(new Set(next.studies.map(s=>s.id)).size,3);assert.ok(next.studies.every(s=>s.id.length<=80));assert.deepEqual(normalizePreferences(next),next);
});
