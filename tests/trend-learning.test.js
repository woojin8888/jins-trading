import test from 'node:test';
import assert from 'node:assert/strict';
import {kernelTrend,confirmedPivotLows,trendLearning} from '../src/trend-learning.js';
import {createStudy,normalizeStudy,calculateStudy} from '../src/indicators.js';
import {normalizePreferences,defaultChartPreferences} from '../src/chart-preferences.js';
import {createReplaySession,replaySnapshot} from '../src/bar-replay.js';
const data=n=>Array.from({length:n},(_,i)=>({time:new Date(Date.UTC(2025,0,i+1)).toISOString().slice(0,10),open:100+i*.1,high:105+i*.1,low:95+i*.1,close:100+i*.1+Math.sin(i*.3)*3,volume:1000}));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('one-sided Gaussian smoothing matches an independent three-price weighted calculation',()=>{
  const bars=[1,2,4].map((close,i)=>({time:i,close})),curve=kernelTrend(bars,1),weights=[1,Math.exp(-.5),Math.exp(-2)];
  assert.equal(curve.length,1);near(curve[0].value,(4*weights[0]+2*weights[1]+weights[2])/weights.reduce((a,b)=>a+b));
  assert.equal(curve[0].time,2);assert.equal(kernelTrend([{time:0,close:4}],1).length,0);
});
test('new bars never rewrite earlier curve values or previously confirmed pivot signals',()=>{
  const bars=data(300),short=bars.slice(0,150),prefix=kernelTrend(short,8),full=kernelTrend(bars,8);assert.deepEqual(full.filter(p=>p.time<=short.at(-1).time),prefix);
  assert.deepEqual(confirmedPivotLows(bars).filter(p=>p.confirmedTime<=short.at(-1).time),confirmedPivotLows(short));
});
test('a bottom becomes knowable only after right-hand completed bars, with its confirmation date separate from the pivot date',()=>{
  const bars=[5,4,2,3,4,5].map((low,i)=>({time:i,low}));assert.equal(confirmedPivotLows(bars.slice(0,-1),2,3).length,0);
  assert.deepEqual(confirmedPivotLows(bars,2,3),[{pivotTime:2,confirmedTime:5,pivotIndex:2,confirmedIndex:5,price:2,confirmationLow:5,delay:3}]);
  bars.push({time:6,low:1});assert.equal(confirmedPivotLows(bars,2,3).length,1); // A later lower low doesn't make the earlier confirmed fact disappear.
});
test('flat equal lows select the first eligible low instead of printing several apparent perfect bottoms',()=>{
  const bars=[5,4,2,2,2,4,5].map((low,i)=>({time:i,low}));assert.equal(confirmedPivotLows(bars,2,2).length,1);assert.equal(confirmedPivotLows(bars,2,2)[0].pivotTime,2);
});
test('future path is explicitly a translated past waveform, capped by its source pattern, with no invented quote timestamps',()=>{
  const bars=data(200),params={...createStudy('trendLearning').params,pattern:12,horizon:60},model=trendLearning(bars,params),pattern=model.curve.slice(-13);
  assert.equal(model.projection.length,12);model.projection.forEach((p,i)=>{assert.equal(p.step,i+1);near(p.value,model.last.value+pattern[i+1].value-pattern[0].value);assert.equal(p.time,undefined);});
  assert.equal(bars.length,200);assert.equal(model.curve.at(-1).time,bars.at(-1).time);
});
test('forming candles cannot influence the curve, hypothetical path or delayed-low signals',()=>{
  const bars=data(200),params=createStudy('trendLearning').params,forming={...bars.at(-1),time:'2030-01-01',close:999999,low:1,complete:false};
  assert.deepEqual(trendLearning([...bars,forming],params),trendLearning(bars,params));assert.equal(trendLearning(bars.slice(0,10),params).projection.length,0);
});
test('a replay projection only uses revealed history even when the future contains extreme values',()=>{
  const bars=data(300),h={symbol:'NVDA',currency:'USD',timeZone:'America/New_York',bars,quality:{sessionOpen:false}},session=createReplaySession({chart:h,daily:h,interval:'D'}),snapshot=replaySnapshot(session,150),params=createStudy('trendLearning').params,expected=trendLearning(bars.slice(0,151),params);
  bars[200].close=999999;assert.deepEqual(trendLearning(snapshot.chartBars,params),expected);assert.equal(expected.last.time,snapshot.chartBars.at(-1).time);
});
test('study settings retain the opt-in flags, reject string booleans, and do not turn on a speculative overlay by default',()=>{
  assert.equal(defaultChartPreferences().studies.length,0);const study=createStudy('trendLearning');assert.equal(study.color,'#111111');assert.equal(study.width,2);study.params.showProjection=false;study.params.showPivotOrigin=true;
  const saved=normalizePreferences({...defaultChartPreferences(),studies:[study]});assert.deepEqual(saved.studies[0],study);assert.deepEqual(normalizeStudy({...study,params:{...study.params,showProjection:'false',right:999}}).params,{...study.params,showProjection:true,right:3});
  const result=calculateStudy(study,data(100));assert.equal(result.series[0].lineStyle,'dotted');assert.equal(result.learning.projection.length,0);assert.ok(result.learning.signals.every(s=>s.confirmedIndex>s.pivotIndex));
});
