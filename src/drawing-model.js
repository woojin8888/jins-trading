export const MEASUREMENT_TYPES=['priceRange','dateRange','datePriceRange'];
export const isMeasurement=type=>MEASUREMENT_TYPES.includes(type);
export const DRAWING_TYPES=['horizontal','trend','rectangle','ellipse','arrow','text',...MEASUREMENT_TYPES];
export const DRAWING_LABELS={horizontal:'지지·저항 수평선',trend:'추세선',rectangle:'사각형',ellipse:'원·타원',arrow:'화살표',text:'텍스트',priceRange:'가격 범위',dateRange:'기간 범위',datePriceRange:'기간·가격 범위'};
const DAY=86400000;
const INTERVALS=new Set(['D','W','M','15m','30m','1h','4h']);
export const drawingStorageKey=id=>'jins-trading:drawings:v1:'+id;
const validPoint=(p,signed=false)=>p&&Number.isFinite(p.time)&&p.time>=0&&p.time<8640000000000000&&Number.isFinite(p.price)&&(signed?Math.abs(p.price)<1e15:p.price>0&&p.price<1e15);
export function normalizeDrawings(raw){
  if(raw?.version!==1||!Array.isArray(raw.items))return {version:1,items:[]};
  const ids=new Set();
  return {version:1,items:raw.items.slice(0,200).flatMap(row=>{
    if(!row||typeof row.id!=='string'||ids.has(row.id.slice(0,100))||!DRAWING_TYPES.includes(row.type)||!Array.isArray(row.points)||row.points.length!==(row.type==='horizontal'||row.type==='text'?1:2)||!row.points.every(point=>validPoint(point,isMeasurement(row.type))))return [];
    ids.add(row.id.slice(0,100));return [{id:row.id.slice(0,100),type:row.type,points:row.points.map(p=>({time:p.time,price:p.price,...(typeof p.dateOnly==='boolean'?{dateOnly:p.dateOnly}:{}),...(INTERVALS.has(p.interval)?{interval:p.interval}:{})})),color:/^#[\da-f]{6}$/i.test(row.color)?row.color:'#2463eb',width:[1,2,3,4].includes(row.width)?row.width:2,text:typeof row.text==='string'?row.text.slice(0,200):'',visible:row.visible!==false}];
  })};
}
export const timeStamp=time=>typeof time==='string'?Date.parse(time+'T00:00:00Z'):typeof time==='number'?time*1000:Date.UTC(time.year,time.month-1,time.day);
function step(times){const deltas=times.slice(-31).slice(1).map((value,i)=>value-times.slice(-31)[i]).filter(n=>n>0).sort((a,b)=>a-b);return deltas[Math.floor(deltas.length/2)]||DAY;}
export function anchorAtLogical(logical,price,times,{allowSigned=false}={}){
  if(!times.length||!Number.isFinite(logical)||!Number.isFinite(price)||!allowSigned&&price<=0)return null;
  const left=Math.floor(logical),fraction=logical-left;
  const time=logical<0?times[0]+logical*step(times):logical>times.length-1?times.at(-1)+(logical-times.length+1)*step(times):times[left]+fraction*((times[left+1]??times[left]+step(times))-times[left]);
  return {time,price};
}
export function logicalAtTime(time,times){
  if(!times.length)return null;
  if(time<times[0])return (time-times[0])/step(times);
  if(time>times.at(-1))return times.length-1+(time-times.at(-1))/step(times);
  let low=0,high=times.length-1;
  while(low<high){const mid=Math.ceil((low+high)/2);if(times[mid]<=time)low=mid;else high=mid-1;}
  return low+(time-times[low])/((times[low+1]??times[low]+step(times))-times[low]);
}
export function projectDrawing(item,project){
  const points=item.points.map(project);
  return points.every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y))?{...item,points}:null;
}
export function translateDrawing(item,deltaTime,deltaPrice){
  const points=item.points.map(p=>({...p,time:p.time+deltaTime,price:p.price+deltaPrice}));
  return points.every(point=>validPoint(point,isMeasurement(item.type)))?{...item,points}:item;
}

export function drawingTimeMap(bars,timeZone='UTC',interval){
  const formatter=new Intl.DateTimeFormat('sv-SE',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}),intraday=typeof bars[0]?.time==='number',byDate=new Map();
  for(const bar of bars){const date=intraday?formatter.format(new Date(bar.time*1000)):new Date(timeStamp(bar.time)).toISOString().slice(0,10);if(!byDate.has(date))byDate.set(date,timeStamp(bar.time));}
  return {intraday,byDate,formatter,bars,interval:interval||(intraday?'intraday':'D')};
}
function periodBounds(time,interval){
  const first=new Date(time);first.setUTCHours(0,0,0,0);
  if(interval==='W')first.setUTCDate(first.getUTCDate()-((first.getUTCDay()+6)%7));
  if(interval==='M')first.setUTCDate(1);
  const end=new Date(first);if(interval==='M')end.setUTCMonth(end.getUTCMonth()+1);else end.setUTCDate(end.getUTCDate()+(interval==='W'?7:1));
  return [first.getTime(),end.getTime()];
}
export function chartAnchorTime(point,map){
  const dateOnly=point.dateOnly??point.time%DAY===0;
  const date=dateOnly?new Date(point.time).toISOString().slice(0,10):map.formatter.format(new Date(point.time));
  const day=Date.parse(date+'T00:00:00Z');
  // An anchor keeps its original time and price in storage. Only its chart
  // position changes, using the candle that contains that time on a new frame.
  if(point.interval===map.interval)return point.time;
  if(['W','M'].includes(map.interval))return periodBounds(day,map.interval)[0];
  if(['W','M'].includes(point.interval)){
    const [start,end]=periodBounds(day,point.interval);
    for(const [date,time] of map.byDate)if(Date.parse(date+'T00:00:00Z')>=start&&Date.parse(date+'T00:00:00Z')<end)return time;
  }
  if(map.intraday){
    if(dateOnly)return map.byDate.get(date)??point.time;
    const bars=map.bars||[];let lo=0,hi=bars.length-1;
    while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(bars[mid].time*1000<=point.time)lo=mid;else hi=mid-1;}
    const bar=bars[lo],span=({'15m':900,'30m':1800,'1h':3600,'4h':14400})[map.interval];
    const start=bar?.time*1000,end=bar?.endTime?bar.endTime*1000:start+(span||Math.min(14400,(bars[lo+1]?.time??bar?.time)-bar?.time))*1000;
    return start<=point.time&&point.time<end?start:point.time;
  }
  return dateOnly?point.time:day;
}
