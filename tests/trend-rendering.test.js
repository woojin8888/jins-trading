import test from 'node:test';
import assert from 'node:assert/strict';
import {learningGeometry,paintLearning} from '../src/trend-rendering.js';
import {dottedTrend} from '../src/trend-learning.js';
const bars=Array.from({length:80},(_,i)=>({time:1700000000+i*3600,close:100+i,low:90+i}));
function api(data,model,offset=26){return {data,learningStudies:[{study:{id:'trend',type:'dottedTrend',color:'#111111',width:2,params:{offset}},model}],chart:{timeScale:()=>({getVisibleLogicalRange:()=>({from:60,to:110}),logicalToCoordinate:i=>i*5})},candles:{priceToCoordinate:value=>1000-value*2}};}
test('forward extension starts at the native line endpoint and occupies exactly the requested number of chart positions',()=>{
 const model=dottedTrend(bars,{period:30,deviation:2,offset:26}),rows=learningGeometry(api(bars,model));
 assert.equal(rows.length,1);assert.equal(rows[0].curve.length,27);assert.equal(rows[0].curve[0].x,79*5);assert.equal(rows[0].curve.at(-1).x,105*5);assert.deepEqual(rows[0].signals,[]);
});
test('one forming candle neither changes the curve nor shifts its logical position',()=>{
 const model=dottedTrend(bars,{period:30,deviation:2,offset:26});const base=learningGeometry(api(bars,model));
 const extended=learningGeometry(api([...bars,{time:1800000000,close:999999,complete:false}],model));assert.deepEqual(extended,base);
});
test('the screenshot draws the same forward vertices and restores canvas line styles',()=>{
 const model=dottedTrend(bars,{period:30,deviation:2,offset:26}),rows=learningGeometry(api(bars,model)),commands=[];
 const ctx=new Proxy({},{get:(_,key)=>(...args)=>commands.push([key,...args]),set:()=>true});paintLearning(ctx,rows,1000);
 assert.deepEqual(commands.filter(c=>c[0]==='moveTo'||c[0]==='lineTo').map(c=>c.slice(1)),rows[0].curve.map(p=>[p.x,p.y]));
 assert.deepEqual(commands.filter(c=>c[0]==='setLineDash').at(-1),['setLineDash',[]]);assert.equal(commands.at(-1)[0],'restore');
});
