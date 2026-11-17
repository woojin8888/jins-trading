export const DRAWING_TYPES=['horizontal','trend','rectangle','ellipse','arrow','text'];
export const DRAWING_LABELS={horizontal:'지지·저항 수평선',trend:'추세선',rectangle:'사각형',ellipse:'원·타원',arrow:'화살표',text:'텍스트'};
const DAY=86400000;
export const drawingStorageKey=id=>'jins-trading:drawings:v1:'+id;
const validPoint=p=>p&&Number.isFinite(p.time)&&p.time>=0&&p.time<8640000000000000&&Number.isFinite(p.price)&&p.price>0&&p.price<1e15;
export function normalizeDrawings(raw){
  if(raw?.version!==1||!Array.isArray(raw.items))return {version:1,items:[]};
  const ids=new Set();
  return {version:1,items:raw.items.slice(0,200).flatMap(row=>{
    if(!row||typeof row.id!=='string'||ids.has(row.id.slice(0,100))||!DRAWING_TYPES.includes(row.type)||!Array.isArray(row.points)||row.points.length!==(row.type==='horizontal'||row.type==='text'?1:2)||!row.points.every(validPoint))return [];
    ids.add(row.id.slice(0,100));return [{id:row.id.slice(0,100),type:row.type,points:row.points.map(p=>({time:p.time,price:p.price})),color:/^#[\da-f]{6}$/i.test(row.color)?row.color:'#2463eb',width:[1,2,3,4].includes(row.width)?row.width:2,text:typeof row.text==='string'?row.text.slice(0,200):'',visible:row.visible!==false}];
  })};
}
export const timeStamp=time=>typeof time==='string'?Date.parse(time+'T00:00:00Z'):typeof time==='number'?time*1000:Date.UTC(time.year,time.month-1,time.day);
function step(times){const deltas=times.slice(-31).slice(1).map((value,i)=>value-times.slice(-31)[i]).filter(n=>n>0).sort((a,b)=>a-b);return deltas[Math.floor(deltas.length/2)]||DAY;}
export function anchorAtLogical(logical,price,times){
  if(!times.length||!Number.isFinite(logical)||!Number.isFinite(price)||price<=0)return null;
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
  const points=item.points.map(p=>({time:p.time+deltaTime,price:p.price+deltaPrice}));
  return points.every(validPoint)?{...item,points}:item;
}
