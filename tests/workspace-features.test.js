import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocumentStore} from '../src/cloud-document-store.js';
import {defaultWorkspace,normalizeWorkspace,createChartSync,nearestTimeBar} from '../src/workspace-model.js';
import {chartAnchor,nearestAverage,menuPosition} from '../src/chart-interactions.js';
import {defaultFilters,matchesFilters,screenMetrics} from '../src/screening.js';
import {importWatchCSV,exportWatchCSV} from '../src/watchlist-csv.js';
import {evaluateAlert,validateAlert} from '../src/alert-engine.js';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const normalize=x=>({...x}),initial={period:20};
test('cloud read blocks edits and preserves the remote document rather than overwriting it with defaults',async()=>{
  const request=deferred(),writes=[],store=createDocumentStore({initial,normalize,read:()=>request.promise,write:async v=>writes.push(v),delay:10000});
  const loading=store.load();assert.equal(store.update({period:5}),false);request.resolve({period:200});await loading;assert.equal(store.snapshot().value.period,200);await store.flush();assert.equal(writes.length,0);
});
test('changes made during a cloud write serialize and the final value reaches the backend',async()=>{
  const first=deferred(),writes=[],store=createDocumentStore({initial,normalize,read:async()=>({period:20}),write:async v=>{writes.push(v.period);if(writes.length===1)await first.promise;},delay:10000});
  await store.load();store.update({period:50});const flushing=store.flush();store.update({period:150});first.resolve();await flushing;assert.deepEqual(writes,[50,150]);assert.equal(store.snapshot().status,'계정 저장');
});
test('failed cloud reads never authorize local defaults to replace existing data, and retry recovers',async()=>{
  let attempt=0;const store=createDocumentStore({initial,normalize,read:async()=>{if(!attempt++)throw Error('offline');return {period:100};},write:async()=>{}});
  await store.load();assert.equal(store.snapshot().ready,false);assert.equal(store.update({period:5}),false);await store.retry();assert.equal(store.snapshot().value.period,100);
});
test('failed writes remain dirty for retry and separate owners cannot overwrite one another',async()=>{
  let fail=true;const a=[],b=[],one=createDocumentStore({initial,normalize,write:async v=>{if(fail)throw Error('offline');a.push(v.period);},delay:10000}),two=createDocumentStore({initial,normalize,write:async v=>b.push(v.period),delay:10000});
  one.update({period:30});two.update({period:60});await one.flush();assert.equal(one.snapshot().status,'저장 실패');await two.flush();fail=false;await one.retry();assert.deepEqual(a,[30]);assert.deepEqual(b,[60]);
});
test('a first cloud document uploads the existing owner-scoped preferences without waiting for an edit',async()=>{
  let saved;const store=createDocumentStore({initial:{period:120},normalize,read:async()=>null,write:async v=>{saved=v;},delay:10000});await store.load();await store.flush();assert.equal(saved.period,120);
});
test('workspace data restores layouts, independent timeframes, named lists, flags and saved filters and rejects corrupt shapes',()=>{
  const raw={...defaultWorkspace(),layout:4,panes:[{interval:'15m',symbol:'AAPL'}],lists:[{id:'one',name:'주도주',keys:['us:NVDA','us:NVDA']}],colors:{'us:NVDA':'#e5484d'},savedFilters:[{name:'RS',filters:{minRS:'70',query:15}}]};
  const normalized=normalizeWorkspace(raw);assert.equal(normalized.layout,4);assert.equal(normalized.panes[0].interval,'15m');assert.deepEqual(normalized.lists[0].keys,['us:NVDA']);assert.equal(normalized.savedFilters[0].filters.query,'');assert.deepEqual(normalizeWorkspace(normalized),normalized);
  assert.doesNotThrow(()=>normalizeWorkspace({lists:[null],savedFilters:[null],main:{symbols:{us:{symbol:15}}}}));
});
test('only the actively manipulated chart broadcasts; synchronized receivers cannot cause a feedback loop',()=>{
  const hub=createChartSync(),received=[];hub.register('main',event=>received.push(['main',event]));const remove=hub.register('other',event=>{received.push(['other',event]);hub.publish('other',event);});
  hub.activate('main');hub.publish('main',{type:'range',range:{from:'2026-01-01',to:'2026-02-01'}});assert.equal(received.length,1);hub.activate('other');hub.publish('other',{type:'crosshair',time:'2026-01-01'});assert.equal(received.length,2);remove();hub.publish('main',{});assert.equal(received.length,2);
});
test('crosshair alignment uses real timestamps and the containing candle across different timeframes',()=>{
  const first=Date.parse('2026-11-17T14:30:00Z')/1000,bars=[{time:first,close:100},{time:first+3600,close:110}];assert.equal(nearestTimeBar(bars,first+900),bars[0]);assert.equal(nearestTimeBar(bars,first+3601),bars[1]);assert.equal(nearestTimeBar(bars,first-1),null);assert.equal(nearestTimeBar(bars,null),null);
});
test('daily-to-intraday synchronization aligns the trading date and clamps shared ranges to available history',()=>{
  const open=Date.parse('2026-11-17T14:30:00Z')/1000,bars=[{time:open,close:100},{time:open+3600,close:110}];
  assert.equal(nearestTimeBar(bars,'2026-11-17'),bars[0]);assert.equal(nearestTimeBar(bars,'2026-11-17',{endOfDay:true}),bars[1]);assert.equal(nearestTimeBar(bars,'2020-01-01',{clamp:true}),bars[0]);assert.equal(nearestTimeBar(bars,'2030-01-01',{clamp:true}),bars[1]);
});
test('context-menu price anchors reject indicator panes and moving-average hit testing follows interpolation and tolerance',()=>{
  const bars=[{time:'2026-01-01'},{time:'2026-01-02'}],series={priceToCoordinate:v=>v},api={data:bars,chart:{timeScale:()=>({width:()=>100,coordinateToLogical:x=>x/100}),panes:()=>[{getHeight:()=>200}]},candles:{coordinateToPrice:y=>y},groups:[{id:'ma-20',pane:0,members:[{api:series,data:[{time:bars[0].time,value:100},{time:bars[1].time,value:120}]}]}]};
  const anchor=chartAnchor(api,50,100);assert.equal(anchor.price,100);assert.equal(anchor.dateOnly,true);assert.equal(chartAnchor(api,50,220),null);assert.equal(nearestAverage(api,{x:50,y:112}),'ma-20');assert.equal(nearestAverage(api,{x:50,y:125}),null);assert.ok(menuPosition(999,999,300,300).left<=70);
});
const bars=Array.from({length:300},(_,i)=>({time:new Date(Date.UTC(2025,0,i+1)).toISOString().slice(0,10),open:100,high:101,low:99,close:100,volume:1000}));
test('screener calculations use confirmed daily bars and the same uploaded RS rather than TOP100 percentiles',()=>{
  const history={bars:[...bars,{...bars.at(-1),time:'2026-11-19',close:500}],quality:{sessionOpen:true}},metrics=screenMetrics(history);assert.ok(Math.abs(metrics.uploadedRS-61.6666666667)<1e-8);assert.equal(metrics.analysisAt,bars.at(-1).time);assert.equal(metrics.volumeRatio,1);assert.equal(metrics.known,8);
});
test('combined screener filters reject missing metrics rather than treating them as passes',()=>{
  const filters={...defaultFilters(),minRS:'70',minScore:'7',maxATR:'5',minVolume:'2',vcp:true},row={symbol:'NVDA',name:'NVIDIA',uploadedRS:75,score:7,atrPercent:3,volumeRatio:2.5,vcp:true};assert.equal(matchesFilters(row,filters),true);assert.equal(matchesFilters({...row,score:null},filters),false);assert.equal(matchesFilters({...row,vcp:null},filters),false);assert.equal(matchesFilters(row,{...filters,watch:true},new Set(['NVDA'])),true);
});
test('watchlist CSV round-trips Korean names, quotes and embedded commas without losing exchange suffixes',()=>{
  const rows=[{market:'kr',symbol:'247540.KQ',name:'에코프로비엠',group_name:'주도주'},{market:'us',symbol:'NVDA',name:'NVIDIA, "A"',group_name:'미국'}];assert.deepEqual(importWatchCSV(exportWatchCSV(rows)),rows);
  assert.throws(()=>importWatchCSV('market,symbol\nkr,247540'),/코드/);assert.throws(()=>importWatchCSV('market,symbol\nus,https://evil.test'),/코드/);assert.throws(()=>importWatchCSV('market,symbol\nus,"NVDA'),/따옴표/);
});
test('CSV imports deduplicate symbols and exports neutralize spreadsheet formulas in names',()=>{
  assert.equal(importWatchCSV('market,symbol,name\nus,NVDA,one\nus,NVDA,two').length,1);assert.ok(exportWatchCSV([{market:'us',symbol:'NVDA',name:'=1+1'}]).includes("'=1+1"));
});
const history={symbol:'NVDA',bars,quote:{price:100,asOf:'2026-11-19T01:00:00Z'},quality:{sessionOpen:false}},rule={market:'us',symbol:'NVDA',kind:'price_above',threshold:99,period:20,created_at:'2026-11-18T00:00:00Z',last_condition:null};
test('price alerts require matching symbols, valid source times and quotes after rule creation',()=>{
  assert.equal(evaluateAlert(rule,history,Date.parse('2026-11-19T02:00:00Z')).trigger,true);assert.equal(evaluateAlert({...rule,created_at:'2026-11-19T02:00:00Z'},history,Date.parse('2026-11-19T02:00:00Z')).trigger,false);assert.throws(()=>evaluateAlert(rule,{...history,symbol:'AAPL'}),/종목/);assert.throws(()=>evaluateAlert(rule,{...history,quote:{price:100}}),/시각/);
});
test('indicator alerts first establish a baseline, trigger only on a new condition, and use the uploaded RS',()=>{
  const rs={...rule,kind:'rs_above',threshold:60};assert.equal(evaluateAlert(rs,history).trigger,false);assert.equal(evaluateAlert({...rs,last_condition:false},history).trigger,true);assert.equal(evaluateAlert({...rs,last_condition:true},history).trigger,false);assert.ok(Math.abs(evaluateAlert(rs,history).value-61.6666666667)<1e-8);
});
test('alert validation rejects non-stock symbols and invalid thresholds or periods',()=>{
  assert.equal(validateAlert({...rule,name:'NVIDIA'}).threshold,99);assert.throws(()=>validateAlert({...rule,threshold:NaN}));assert.throws(()=>validateAlert({...rule,period:0}));assert.throws(()=>validateAlert({...rule,symbol:'https://example.com'}));assert.throws(()=>validateAlert({...rule,kind:'unknown'}));
});
