import test from 'node:test';
import assert from 'node:assert/strict';
import {movingAverageValues,movingAveragePoints,formatVolume,profileValueArea,resolveCandle} from '../src/technical-math.js';
import {defaultChartPreferences,normalizePreferences} from '../src/chart-preferences.js';
import {INDICATORS,BUILTIN_INDICATORS,createStudy,calculateStudy} from '../src/indicators.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const candles=values=>values.map((close,i)=>({time:new Date(Date.UTC(2024,0,i+1)).toISOString().slice(0,10),open:close-.2,high:close+1,low:close-1,close,volume:100}));
test('legacy settings migrate without losing studies or hidden averages, with the requested black 20 line',()=>{
  const study=createStudy('rsi'),prefs=normalizePreferences({version:1,averages:[20,200],showVolume:false,showProfile:true,studies:[study]});
  assert.equal(prefs.version,4);assert.deepEqual(prefs.movingAverages.filter(ma=>ma.visible).map(ma=>ma.period),[20,200]);
  const twenty=prefs.movingAverages.find(ma=>ma.period===20);assert.equal(twenty.color,'#111111');assert.equal(twenty.width,3);
  assert.equal(prefs.profile.color,'#9a9a9a');
  const prior={...defaultChartPreferences(),version:3,showProfile:true};prior.profile.color='#6DA4ED';assert.equal(normalizePreferences(prior).profile.color,'#9a9a9a');assert.equal(normalizePreferences(prior).showProfile,true);
  prior.profile.color='#123456';assert.equal(normalizePreferences(prior).profile.color,'#123456');
  assert.equal(normalizePreferences({...prior,version:4,profile:{...prior.profile,color:'#6da4ed'}}).profile.color,'#6da4ed');
  assert.equal(prefs.showVolume,false);assert.equal(prefs.showProfile,true);assert.equal(prefs.studies[0].id,study.id);assert.equal(prefs.volume.format,'korean');assert.deepEqual(normalizePreferences(prefs),prefs);
});
test('custom moving average type, source, period, width and color survive settings reload',()=>{
  const prefs=defaultChartPreferences();prefs.movingAverages=[{id:'ma-custom',type:'vwma',source:'hlc3',period:60,color:'#123456',width:4,visible:false}];prefs.volume.averageWidth=3;prefs.profile.rows=64;prefs.profile.mode='recent';
  assert.deepEqual(normalizePreferences(JSON.parse(JSON.stringify(prefs))),prefs);
  const bad=normalizePreferences({...prefs,movingAverages:[{...prefs.movingAverages[0],type:'script',source:'bad',period:-1,color:'url(bad)',width:99}]});
  assert.equal(bad.movingAverages[0].type,'sma');assert.equal(bad.movingAverages[0].period,20);assert.equal(bad.movingAverages[0].source,'close');assert.equal(bad.movingAverages[0].color,'#111111');
});
test('SMA, EMA, WMA, RMA, VWMA and HMA match independently known simple sequences',()=>{
  const values=[1,2,3,4,5,6];near(movingAverageValues('sma',values,3)[3],3);near(movingAverageValues('ema',values,3)[3],3);near(movingAverageValues('wma',values,3)[3],20/6);near(movingAverageValues('rma',values,3)[3],8/3);near(movingAverageValues('vwma',[1,2,3,4],3,[1,1,1,10]).at(-1),45/12);near(movingAverageValues('hma',values,4)[4],5);
  assert.equal(movingAverageValues('vwma',[1,2,3],3,[1,null,1]).at(-1),null);
  const bars=candles([10,20,30]);bars[2].high=40;near(movingAveragePoints({type:'sma',period:1,source:'high'},bars).at(-1).value,40);
});
test('volume readout retains exact share counts and formats absent data distinctly from zero',()=>{
  assert.equal(formatVolume(1234567),'1,234,567주');assert.equal(formatVolume(0),'0주');assert.equal(formatVolume(null),'—');assert.equal(formatVolume(1234567,'compact'),'1.23M');near(movingAverageValues('sma',[10,20,30],3).at(-1),20);
});
test('crosshair selection resolves the original candle including volume for all chart time formats',()=>{
  const bar={...candles([100])[0],volume:1234567},map=new Map([[bar.time,bar]]);
  assert.equal(resolveCandle(map,'2024-01-01'),bar);assert.equal(resolveCandle(map,{year:2024,month:1,day:1}).volume,1234567);assert.equal(resolveCandle(map,Date.UTC(2024,0,1)/1000),bar);assert.equal(resolveCandle(map,{year:2024,month:1,day:2}),null);
});
test('volume profile POC and contiguous value area cover the chosen share of volume',()=>{
  const bins=[1,2,10,6,1].map((volume,i)=>({low:i,high:i+1,volume})),area=profileValueArea(bins,70);
  assert.equal(area.poc,2);assert.equal(area.pocPrice,2.5);assert.equal(area.val,2);assert.equal(area.vah,4);assert.ok(area.covered>=area.total*.7);
  const all=profileValueArea(bins,100);assert.equal(all.val,0);assert.equal(all.vah,5);assert.equal(all.covered,all.total);assert.equal(profileValueArea([]),null);
});
test('Donchian and Keltner channel levels agree with known high/low and ATR ranges',()=>{
  const dc=createStudy('donchian');dc.params.period=3;const d=calculateStudy(dc,candles([1,2,3,4,5]));near(d.series[0].data.at(-1).value,4);near(d.series[1].data.at(-1).value,6);near(d.series[2].data.at(-1).value,2);
  const kc=createStudy('keltner');kc.params={period:3,atrPeriod:2,multiplier:2};const k=calculateStudy(kc,candles([10,12,14,16,18]));near(k.series[0].data.at(-1).value,16);near(k.series[1].data.at(-1).value,22);near(k.series[2].data.at(-1).value,10);
});
test('DMI has +DI strength and ADX 100 on a constant upward directional trend',()=>{
  const study=createStudy('dmi');study.params={period:3,smoothing:3};const r=calculateStudy(study,candles([1,2,3,4,5,6,7,8]));near(r.series[0].data.at(-1).value,100);near(r.series[1].data.at(-1).value,50);near(r.series[2].data.at(-1).value,0);
});
test('CCI, MFI, Williams %R, ROC and CMF match direct reference calculations',()=>{
  const data=candles([1,2,3,4,5]);const last=(type,period,bars=data)=>{const study=createStudy(type);study.params.period=period;return calculateStudy(study,bars).series[0].data.at(-1).value;};
  near(last('cci',3),100);near(last('mfi',3),100);near(last('williams',3),-25);near(last('roc',2),(5/3-1)*100);near(last('cmf',3),0);
  const upper=candles([12,12,12,12]).map(b=>({...b,high:12,low:10}));near(last('cmf',3,upper),1);
});
test('catalogue exposes built-in volume and profile controls without pretending they are custom scripts',()=>{
  assert.ok(BUILTIN_INDICATORS.some(d=>d.type==='volume'&&d.builtin==='showVolume'));assert.ok(BUILTIN_INDICATORS.some(d=>d.type==='volumeProfile'&&d.builtin==='showProfile'));assert.equal(new Set([...INDICATORS,...BUILTIN_INDICATORS].map(d=>d.type)).size,26);
});
