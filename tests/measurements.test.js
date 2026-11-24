import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeDrawings,anchorAtLogical,timeStamp} from '../src/drawing-model.js';
import {measurementContext,measurementValues,measurementDetails,measurementGeometry,translateMeasurement} from '../src/measurement-model.js';
const days=['2026-11-19','2026-11-20','2026-11-23','2026-11-24'];
const context=measurementContext(days.map(time=>({time})),'Asia/Seoul',2);
const point=(date,price)=>({time:timeStamp(date),price,dateOnly:true});
const row={id:'range-1',type:'datePriceRange',points:[point(days[1],100),point(days[2],110)],color:'#2463eb',width:2,text:'',visible:true};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9);

test('price difference and percent follow the selected start price, including reverse measurements',()=>{
  const forward=measurementValues(row.points,context),reverse=measurementValues([...row.points].reverse(),context);
  assert.equal(forward.difference,10);assert.equal(forward.percent,10);
  assert.equal(reverse.difference,-10);near(reverse.percent,-100/11);
  assert.equal(reverse.intervals,1);
});
test('weekends count as calendar elapsed time but never become synthetic trading bars',()=>{
  const measured=measurementValues(row.points,context);
  assert.equal(measured.intervals,1);assert.equal(measured.included,2);assert.equal(measured.elapsedMs,3*86400000);
  const lines=measurementDetails(row,context).lines;
  assert.ok(lines.includes('봉 간격 1 · 포함 2봉'));assert.ok(lines.includes('경과 3일 · 달력 기준'));
});
test('intraday intervals count only provided bars and display exchange-local dates',()=>{
  const bars=[Date.parse('2026-11-23T00:00:00Z')/1000,Date.parse('2026-11-23T00:30:00Z')/1000].map(time=>({time}));
  const ctx=measurementContext(bars,'Asia/Seoul',2),points=bars.map((bar,i)=>({time:bar.time*1000,price:100+i,dateOnly:false}));
  const details=measurementDetails({...row,points},ctx);
  assert.equal(details.intervals,1);assert.equal(details.included,2);assert.equal(details.elapsedMs,1800000);
  assert.match(details.lines[2],/09:00.*09:30/);
});
test('measurement drawing types round-trip through storage without changing older drawing validation',()=>{
  for(const type of ['priceRange','dateRange','datePriceRange']){
    const item={...row,type};assert.deepEqual(normalizeDrawings(JSON.parse(JSON.stringify({version:1,items:[item]}))).items,[item]);
  }
  const signed={...row,points:[point(days[1],-20),point(days[2],-10)]};
  assert.equal(normalizeDrawings({version:1,items:[signed]}).items.length,1);
  assert.equal(normalizeDrawings({version:1,items:[{...signed,type:'trend'}]}).items.length,0);
});
test('zero starts have no invented percentage and negative starts explicitly use absolute base',()=>{
  const zero=measurementDetails({...row,points:[point(days[1],0),point(days[2],10)]},context);
  assert.equal(zero.percent,null);assert.match(zero.lines[1],/시작값 0/);
  const negative=measurementDetails({...row,points:[point(days[1],-20),point(days[2],-10)]},context);
  assert.equal(negative.percent,50);assert.match(negative.lines[1],/절댓값 기준/);
  assert.equal(anchorAtLogical(0,0,context.times),null);
  assert.equal(anchorAtLogical(0,0,context.times,{allowSigned:true}).price,0);
});
test('moving a measurement preserves its bar span across a weekend and stops at actual data boundaries',()=>{
  const moved=translateMeasurement(row,point(days[1],100),point(days[2],105),context);
  assert.deepEqual(moved.points,[point(days[2],105),point(days[3],115)]);
  assert.equal(measurementValues(moved.points,context).intervals,1);
  assert.equal(measurementValues(moved.points,context).elapsedMs,86400000);
  const bounded=translateMeasurement(row,point(days[0],100),point(days[3],100),context);
  assert.equal(bounded.points[1].time,timeStamp(days[3]));
});
test('changed timeframes and off-data anchors never claim exact unseen bar counts',()=>{
  const weekly=measurementContext(['2026-11-16','2026-11-23'].map(time=>({time})),'Asia/Seoul');
  assert.equal(measurementValues(row.points,weekly).approximate,true);
  assert.equal(measurementValues([point('2026-11-01',100),row.points[1]],context).intervals,null);
});
test('the combined measurement draws orthogonal arrows and keeps the label inside the plot',()=>{
  const displayed={...row,points:[{x:10,y:20},{x:290,y:230}],measurement:measurementDetails(row,context)};
  const geometry=measurementGeometry(displayed,300,250);
  assert.equal(geometry.arrows.length,2);
  assert.equal(geometry.arrows[0][0],geometry.arrows[0][2]);
  assert.equal(geometry.arrows[1][1],geometry.arrows[1][3]);
  assert.ok(geometry.label.x>=0&&geometry.label.x+geometry.label.width<=300);
  assert.ok(geometry.label.y>=0&&geometry.label.y+geometry.label.height<=250);
});
