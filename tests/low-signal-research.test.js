import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {computeSignals,compareSignals,rolling,wilderRsi,normalizedConfig} from '../src/low-signal-research.js';
const json=JSON.parse(await readFile(new URL('../research/low-signals/data.json',import.meta.url),'utf8'));
const bars=json.NVDA.bars.filter(b=>b.time<='2026-11-25');
const cfg={model:'rebound',period:30,deviation:2,rebound:2.5};
const sample=closes=>closes.map((close,i)=>({time:`2026-01-${String(i+1).padStart(2,'0')}`,open:close,high:close+1,low:close-1,close,volume:1}));
test('population deviation and Wilder warmup independently computed',()=>{
  assert.deepEqual(rolling([1,2,3],3),[null,null,2]);
  assert.equal(rolling([1,2,3],3,'std')[2],Math.sqrt(2/3));
  assert.deepEqual(wilderRsi([10,11,10,12],2),[null,null,50,83.33333333333333]);
  assert.equal(wilderRsi([2,2,2],2)[2],50);
});
test('cursor screenshots align with independently calculated RSI2 values',()=>{
  const r=computeSignals(bars,{model:'rsi'});
  for(const [time,expected] of [['2026-11-02',3.6787],['2026-11-05',4.9813]])assert.ok(Math.abs(r.rsi[r.bars.findIndex(b=>b.time===time)]-expected)<.0001);
});
test('a closed-bar rebound is known later than its plotted historical origin',()=>{
  const s=computeSignals(bars,cfg).signals.filter(s=>s.originTime>='2026-04-01');
  assert.deepEqual(s.map(s=>[s.originTime,s.confirmedTime]),[['2026-06-26','2026-06-30'],['2026-11-05','2026-11-06'],['2026-11-10','2026-11-11'],['2026-11-20','2026-11-23']]);
});
test('replay prefixes never contain signals confirmed in the future',()=>{
  const all=computeSignals(bars,cfg).signals;
  for(const time of ['2026-06-25','2026-06-26','2026-06-29','2026-06-30','2026-11-04','2026-11-05','2026-11-06','2026-11-10','2026-11-11','2026-11-20','2026-11-23']) {
    const prefix=bars.filter(b=>b.time<=time);
    assert.deepEqual(computeSignals(prefix,cfg).signals,all.filter(s=>s.confirmedTime<=time));
  }
});
test('incomplete confirmation candle cannot create a completed signal',()=>{
  const b=bars.filter(b=>b.time<='2026-11-06').map(b=>b.time==='2026-11-06'?{...b,complete:false}:b);
  assert.ok(!computeSignals(b,cfg).signals.some(s=>s.originTime==='2026-11-05'));
});
test('confirmation placement is evaluated separately from historical placement',()=>{
  const model=computeSignals(bars,cfg),refs=[{time:'2026-11-05',value:1,precision:'cursor'},{time:'2026-11-06',value:0,precision:'cursor'}];
  const opt={startTime:'2026-11-04',endTime:'2026-11-09'};
  const origin=compareSignals(model.signals,refs,model.bars,{...opt,position:'origin'});
  const confirmed=compareSignals(model.signals,refs,model.bars,opt);
  assert.equal(origin.matched,1);assert.equal(origin.contradictions,0);
  assert.equal(confirmed.matched,0);assert.equal(confirmed.contradictions,1);
});
test('image tolerance does not apply to exact cursor observations',()=>{
  const b=sample([10,9,8]),signals=[{originTime:b[1].time,confirmedTime:b[1].time}];
  const reference=[{time:b[0].time,value:1,precision:'cursor'}];
  assert.equal(compareSignals(signals,reference,b,{tolerance:2}).matched,0);
  assert.equal(compareSignals(signals,[{...reference[0],precision:'image'}],b,{tolerance:2}).matched,1);
});
test('reject bad dates and OHLC rather than silently charting invalid inputs',()=>{
  assert.throws(()=>computeSignals([...sample([10]),...sample([10])]),/날짜/);
  assert.throws(()=>computeSignals([{...sample([10])[0],close:NaN}]),/가격/);
  assert.equal(normalizedConfig({period:0,rebound:Infinity}).period,20);
});
