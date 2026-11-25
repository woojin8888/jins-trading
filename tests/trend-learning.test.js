import test from 'node:test';
import assert from 'node:assert/strict';
import {confirmedPivotLows,dottedTrend,pivotLowStudy} from '../src/trend-learning.js';
import {shiftedBollingerUpper,curvePriceRange} from '../src/trend-learning.js';
import {readFileSync} from 'node:fs';
import {createStudy,normalizeStudy,calculateStudy} from '../src/indicators.js';
import {normalizePreferences,defaultChartPreferences} from '../src/chart-preferences.js';
import {createReplaySession,replaySnapshot} from '../src/bar-replay.js';
const data=n=>Array.from({length:n},(_,i)=>({time:new Date(Date.UTC(2025,0,i+1)).toISOString().slice(0,10),open:100+i*.1,high:105+i*.1,low:95+i*.1,close:100+i*.1+Math.sin(i*.3)*3,volume:1000}));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('new bars never rewrite calculated source values or previously confirmed pivot signals',()=>{
  const bars=data(300),short=bars.slice(0,150),prefix=shiftedBollingerUpper(short),full=shiftedBollingerUpper(bars);
  assert.deepEqual(full.slice(0,prefix.length).map(p=>[p.sourceTime,p.value,p.index]),prefix.map(p=>[p.sourceTime,p.value,p.index]));
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
test('dotted trend and pivot lows are separate models with no invented future path',()=>{
  const bars=data(200),line=createStudy('dottedTrend'),low=createStudy('pivotLows'),lineResult=calculateStudy(line,bars),lowResult=calculateStudy(low,bars);
  assert.deepEqual(lineResult.learning.curve,shiftedBollingerUpper(bars,line.params));assert.deepEqual(lineResult.learning.signals,[]);assert.equal(lineResult.learning.projection,undefined);
  assert.equal(lineResult.series[0].lineStyle,'dotted');assert.equal(lineResult.series[0].data.at(-1).time,bars.at(-1).time);
  assert.deepEqual(lowResult.learning.curve,[]);assert.deepEqual(lowResult.learning.signals,confirmedPivotLows(bars,3,3));assert.deepEqual(lowResult.series[0].data,[]);assert.equal(lowResult.learning.projection,undefined);
  assert.deepEqual(Object.keys(line.params),['period','deviation','offset']);assert.deepEqual(Object.keys(low.params),['left','right','showPivotOrigin']);
});
test('forming candles cannot influence either independent indicator',()=>{
  const bars=data(200),forming={...bars.at(-1),time:'2030-01-01',close:999999,low:1,complete:false};
  for(const [type,calculate] of [['dottedTrend',dottedTrend],['pivotLows',pivotLowStudy]]){const params=createStudy(type).params;assert.deepEqual(calculate([...bars,forming],params),calculate(bars,params));}
  assert.deepEqual(dottedTrend(bars.slice(0,10),createStudy('dottedTrend').params).curve,[]);
});
test('both independent studies in replay only use revealed history',()=>{
  const bars=data(300),h={symbol:'NVDA',currency:'USD',timeZone:'America/New_York',bars,quality:{sessionOpen:false}},session=createReplaySession({chart:h,daily:h,interval:'D'}),snapshot=replaySnapshot(session,150);
  const expected=['dottedTrend','pivotLows'].map(type=>calculateStudy(createStudy(type),bars.slice(0,151)).learning);bars[200].close=999999;bars[200].low=-999999;
  for(const [i,type] of ['dottedTrend','pivotLows'].entries())assert.deepEqual(calculateStudy(createStudy(type),snapshot.chartBars).learning,expected[i]);
});
test('legacy combined studies keep their line identity and style, without automatically enabling low markers or future paths',()=>{
  const legacy={id:'saved-combined',type:'trendLearning',visible:false,color:'#123456',width:3,params:{bandwidth:12,left:5,right:4,showLows:true,showProjection:true,pattern:30,horizon:20}};
  const next=normalizeStudy(legacy);assert.deepEqual(next,{id:legacy.id,type:'dottedTrend',visible:false,color:legacy.color,width:3,params:{period:30,deviation:2,offset:26}});
  assert.equal(createStudy('trendLearning'),null);const others=Array.from({length:11},()=>createStudy('ema')),stored=normalizePreferences({...defaultChartPreferences(),studies:[legacy,...others]});
  assert.equal(stored.studies.length,12);assert.deepEqual(stored.studies.slice(1),others);assert.equal(stored.studies[0].id,legacy.id);assert.ok(stored.studies.every(s=>s.type!=='pivotLows'));assert.deepEqual(normalizePreferences(stored),stored);
});
test('separate settings persist and invalid settings cannot enable extra overlays',()=>{
  assert.equal(defaultChartPreferences().studies.length,0);const line=createStudy('dottedTrend'),low=createStudy('pivotLows');assert.equal(line.color,'#111111');assert.equal(line.width,2);low.params.showPivotOrigin=true;low.params.right=5;
  const saved=normalizePreferences({...defaultChartPreferences(),studies:[line,low]});assert.deepEqual(saved.studies,[line,low]);assert.deepEqual(normalizeStudy({...line,params:{bandwidth:99,showProjection:true}}).params,{period:30,deviation:2,offset:26});
  assert.deepEqual(normalizeStudy({...low,params:{...low.params,showPivotOrigin:'true',right:999}}).params,{left:3,right:3,showPivotOrigin:false});
});

test('shifted upper band independently matches all six supplied chart readouts without retuning',()=>{
  const examples=JSON.parse(readFileSync(new URL('./fixtures/dotted-trend-snapshots.json',import.meta.url)));
  for(const example of examples){
    const bars=example.closes.map((close,time)=>({time,close})),point=shiftedBollingerUpper(bars).at(-1);
    assert.equal(Number(point.value.toFixed(2)),example.expectedReadout,example.symbol);
    assert.equal(point.sourceIndex,29);assert.equal(point.index,55);assert.equal(point.time,undefined);
    assert.equal(point.sourceTime,29);
  }
});
test('the displacement uses actual candle indices across missing dates, without inventing future timestamps',()=>{
  const bars=[1,2,3,4,5].map((close,i)=>({time:['2026-11-19','2026-11-20','2026-11-23','2026-11-24','2026-11-25'][i],close}));
  const curve=shiftedBollingerUpper(bars,{period:3,deviation:2,offset:2});
  near(curve[0].value,2+2*Math.sqrt(2/3));assert.equal(curve[0].time,'2026-11-25');assert.equal(curve[0].sourceTime,'2026-11-23');
  assert.deepEqual(curve.map(point=>point.index),[4,5,6]);assert.equal(curve[1].time,undefined);assert.equal(curve[2].time,undefined);
  const zero=shiftedBollingerUpper(bars,{period:3,deviation:2,offset:0});assert.equal(zero.at(-1).time,bars.at(-1).time);
});
test('displacement never rewrites calculated values and needs only the source period, not future candles',()=>{
  const bars=data(100),prefix=shiftedBollingerUpper(bars.slice(0,30));assert.equal(prefix.length,1);assert.equal(prefix[0].time,undefined);
  const full=shiftedBollingerUpper(bars);near(prefix[0].value,full[0].value);assert.equal(full[0].sourceTime,prefix[0].sourceTime);assert.equal(full[0].time,bars[55].time);
  const invalid=bars.slice(0,30);invalid[10]={...invalid[10],close:null};assert.deepEqual(shiftedBollingerUpper(invalid),[]);
});
test('future chart positions autoscale only the visible segment, with exact boundary interpolation',()=>{
  const curve=[{index:10,value:20},{index:20,value:40},{index:30,value:10}];
  assert.deepEqual(curvePriceRange(curve,{from:15,to:25}),{minValue:25,maxValue:40});
  assert.deepEqual(curvePriceRange(curve,{from:11,to:12}),{minValue:22,maxValue:24});
  assert.equal(curvePriceRange(curve,{from:0,to:9}),null);assert.equal(curvePriceRange([],null),null);
});

test('a wholly forward curve still contributes to the price scale, while offscreen values do not',async()=>{
  const {mergeCurveAutoscale}=await import('../src/trend-learning.js');
  const original={priceRange:{minValue:10,maxValue:20},margins:{above:2,below:3}},curve=[{index:100,value:30},{index:101,value:40},{index:102,value:1000}];
  assert.deepEqual(mergeCurveAutoscale(original,[curve],{from:100,to:101}),{priceRange:{minValue:10,maxValue:40},margins:original.margins});
  assert.deepEqual(mergeCurveAutoscale(null,[curve],{from:100,to:101}),{priceRange:{minValue:30,maxValue:40}});
  assert.equal(mergeCurveAutoscale(original,[curve],{from:0,to:90}),original);
});
