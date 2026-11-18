import test from 'node:test';
import assert from 'node:assert/strict';
import {attachChartWatermark} from '../src/chart-watermark.js';
function harness(){
  let primitive,updates=0,detaches=0;const texts=[];
  const pane={attachPrimitive:p=>{primitive=p;p.attached({requestUpdate:()=>updates++});},detachPrimitive:p=>{assert.equal(p,primitive);p.detached();detaches++;}};
  const ctx={save(){},restore(){},fillText:(text,x,y,maxWidth)=>texts.push({text,x,y,maxWidth})};
  return {pane,texts,view:()=>primitive.paneViews()[0],draw:(width=640,height=360)=>primitive.paneViews()[0].renderer().draw({useMediaCoordinateSpace:draw=>draw({context:ctx,mediaSize:{width,height}})}),updates:()=>updates,detaches:()=>detaches};
}
test('watermark is a native background primitive behind series and stays inside a corner of the price pane',()=>{
  const h=harness(),watermark=attachChartWatermark(h.pane,{symbol:'NVDA',showTicker:true});
  assert.equal(h.view().zOrder(),'bottom');h.draw();assert.deepEqual(h.texts.map(t=>t.text),['J TRADING','NVDA']);assert.ok(h.texts.every(t=>t.x<30&&t.y>300&&t.y<360));
  h.texts.length=0;h.draw(240,120);assert.ok(h.texts.every(t=>t.x+t.maxWidth<=240&&t.y<120));watermark.detach();
});
test('ticker check and symbol updates repaint the same background primitive and detach safely',()=>{
  const h=harness(),watermark=attachChartWatermark(h.pane,{symbol:'005930.KS',showTicker:true}),view=h.view();h.draw();assert.equal(h.texts.at(-1).text,'005930');h.texts.length=0;
  watermark.applyOptions({showTicker:false});assert.equal(h.view(),view);h.draw();assert.deepEqual(h.texts.map(t=>t.text),['J TRADING']);h.texts.length=0;
  watermark.applyOptions({symbol:'TSLA',showTicker:true});h.draw();assert.equal(h.texts.at(-1).text,'TSLA');const count=h.updates();watermark.detach();watermark.detach();watermark.applyOptions({symbol:'AAPL'});assert.equal(h.detaches(),1);assert.equal(h.updates(),count);
});
