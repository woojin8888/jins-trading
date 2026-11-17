import test from 'node:test';
import assert from 'node:assert/strict';
import {SCAN_COLUMNS,scanRequest,scanRows} from '../server/rankings.js';
import {normalizeSymbol,routeMarket} from '../server/market.js';
import {anchorAtLogical,drawingStorageKey,logicalAtTime,normalizeDrawings,projectDrawing,timeStamp,translateDrawing} from '../src/drawing-model.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const times=['2026-11-09','2026-11-10','2026-11-11','2026-11-12','2026-11-13','2026-11-16'].map(timeStamp);
const point=(i,price=100)=>({time:times[i],price});
const line={id:'test-line',type:'trend',points:[point(1),point(4,120)],color:'#123456',width:3,visible:true,text:''};
test('rankings ask the provider to sort the complete market, with independent pages',()=>{
  for(const [sort,field,direction] of [['value','Value.Traded','desc'],['marketCap','market_cap_basic','desc'],['gainers','change','desc'],['losers','change','asc'],['volume','volume','desc']]){
    const query=scanRequest('kr',sort,200);assert.deepEqual(query.range,[200,300]);assert.deepEqual(query.sort,{sortBy:field,sortOrder:direction});assert.equal(query.options.lang,'ko');
  }
  assert.equal(scanRequest('us').options.lang,'en');
});
test('invalid ranking fields and offsets fail before a request can be made',async()=>{
  for(const sort of ['__proto__','toString','javascript','']){
    const response=await routeMarket(new URL('https://test/api/market?action=rankings&sort='+encodeURIComponent(sort||'invalid')));assert.equal(response.status,400);
  }
  for(const offset of [-1,1,100.5,Infinity,NaN,20100])assert.throws(()=>scanRequest('kr','value',offset));
});
test('Korean names and KOSDAQ routing survive provider normalization; capitalization remains numeric',()=>{
  const row=Object.fromEntries(SCAN_COLUMNS.map(c=>[c,null]));Object.assign(row,{name:'247540',description:'에코프로비엠',exchange:'KOSDAQ',market_cap_basic:2e13,close:200000});
  const [stock]=scanRows([{d:SCAN_COLUMNS.map(c=>row[c])}],'kr');assert.equal(stock.symbol,'247540.KQ');assert.equal(stock.name,'에코프로비엠');assert.equal(stock.marketCap,2e13);
  row.name='005930';row.description='삼성전자';row.exchange='KRX';assert.equal(scanRows([{d:SCAN_COLUMNS.map(c=>row[c])}],'kr')[0].symbol,'005930.KS');
});
test('history localizes Korean names without replacing real price bars',async t=>{
  const original=global.fetch;let scanner;
  t.after(()=>{global.fetch=original;});
  global.fetch=async(url,options)=>{
    if(String(url).includes('naver.com'))return Response.json({stockName:'삼성전자'});
    if(String(url).includes('/scan')){scanner=JSON.parse(options.body);return Response.json({totalCount:900,data:[{d:SCAN_COLUMNS.map(key=>({name:'005930',description:'삼성전자',exchange:'KRX',close:100,market_cap_basic:1e12}[key]??null))}]});}
    return Response.json({chart:{result:[{meta:{longName:'Samsung Electronics',currency:'KRW',exchangeTimezoneName:'Asia/Seoul'},timestamp:[1794844800],indicators:{quote:[{open:[100],high:[110],low:[90],close:[105],volume:[500]}]}}]}});
  };
  const response=await routeMarket(new URL('https://test/api/market?action=history&market=kr&symbol=005930'));const data=await response.json();assert.equal(response.status,200);assert.equal(data.name,'삼성전자');assert.equal(data.koreanName,'삼성전자');assert.equal(data.bars[0].close,105);
  const ranks=await routeMarket(new URL('https://test/api/market?action=rankings&market=kr&sort=marketCap&offset=100'));const body=await ranks.json();assert.equal(ranks.status,200);assert.equal(body.total,900);assert.equal(body.hasMore,true);assert.equal(body.offset,100);assert.deepEqual(scanner.range,[100,200]);assert.equal(scanner.sort.sortBy,'market_cap_basic');
});
test('bundled Korean names preserve usable localized history when external name services are unavailable',async t=>{
  const original=global.fetch;t.after(()=>{global.fetch=original;});
  global.fetch=async url=>String(url).includes('naver.com')?new Response('',{status:503}):Response.json({chart:{result:[{meta:{longName:'Samsung Electronics'},timestamp:[1794844800],indicators:{quote:[{open:[100],high:[110],low:[90],close:[105],volume:[500]}]}}]}});
  const response=await routeMarket(new URL('https://test/api/market?market=kr&symbol=005930'));const data=await response.json();assert.equal(response.status,200);assert.equal(data.koreanName,'삼성전자');assert.equal(data.bars.length,1);
});
test('all six drawing tools persist their date-price anchors, style, text, and visibility',()=>{
  const types=['horizontal','trend','rectangle','ellipse','arrow','text'],doc={version:1,items:types.map(type=>({...line,id:type,type,visible:type!=='ellipse',points:type==='horizontal'||type==='text'?[point(2)]:line.points,text:type==='text'?'진입 관찰':''}))};
  assert.deepEqual(normalizeDrawings(JSON.parse(JSON.stringify(doc))),doc);assert.notEqual(drawingStorageKey('guest:us:NVDA'),drawingStorageKey('guest:kr:005930.KS'));assert.notEqual(drawingStorageKey('owner1:us:NVDA'),drawingStorageKey('owner2:us:NVDA'));
});
test('corrupt drawings cannot inject styles or invalid coordinates into the chart',()=>{
  const doc=normalizeDrawings({version:1,items:[line,line,{...line,id:'negative',points:[point(1,-1),point(2)]},{...line,id:'nan',points:[{time:NaN,price:1},point(2)]},{...line,id:'badtype',type:'script'},{...line,id:'badstyle',color:'url(secret)',width:999}]});
  assert.equal(doc.items.length,2);assert.equal(doc.items[1].color,'#2463eb');assert.equal(doc.items[1].width,2);assert.deepEqual(normalizeDrawings({version:999,items:[line]}),{version:1,items:[]});
});
test('pointer positions round-trip through calendar gaps and the empty space after the latest candle',()=>{
  for(const logical of [-4,0,.3,1,3.7,4.5,5,5.8,14]){const anchor=anchorAtLogical(logical,123,times);near(logicalAtTime(anchor.time,times),logical);assert.equal(anchor.price,123);}
  assert.equal(anchorAtLogical(1,0,times),null);assert.equal(anchorAtLogical(1,10,[]),null);
});
test('drawings retain their calendar date and price across daily, weekly, monthly views and viewport scales',()=>{
  const date=point(2,112),week=['2026-11-02','2026-11-09','2026-11-16','2026-11-23'].map(timeStamp),month=['2026-10-01','2026-11-01','2026-12-01'].map(timeStamp);
  for(const scale of [times,week,month]){const logical=logicalAtTime(date.time,scale),back=anchorAtLogical(logical,date.price,scale);near(back.time,date.time);assert.equal(back.price,112);}
  const first=projectDrawing(line,p=>({x:logicalAtTime(p.time,times)*10+20,y:500-p.price*2})),zoomed=projectDrawing(line,p=>({x:logicalAtTime(p.time,times)*25-15,y:700-p.price*3}));
  assert.equal(first.points[0].x,30);assert.equal(zoomed.points[0].x,10);assert.equal(zoomed.points[1].y,340);assert.deepEqual(line.points,[point(1),point(4,120)]);
});
test('moving an entire drawing preserves its date and price span and rejects invalid prices',()=>{
  const moved=translateDrawing(line,86400000,30);assert.equal(moved.points[0].price,130);assert.equal(moved.points[1].price,150);assert.equal(moved.points[1].time-moved.points[0].time,line.points[1].time-line.points[0].time);assert.equal(translateDrawing(line,0,-200),line);
});

test('Korean symbols resolve KOSDAQ codes before a price request and support lettered preferred-share codes',()=>{
  assert.equal(normalizeSymbol('247540','kr'),'247540.KQ');assert.equal(normalizeSymbol('247540.KS','kr'),'247540.KQ');assert.equal(normalizeSymbol('00680K','kr'),'00680K.KS');
});
