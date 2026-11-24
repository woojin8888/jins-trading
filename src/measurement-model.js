import {chartAnchorTime,drawingTimeMap,logicalAtTime,timeStamp} from './drawing-model.js';
import {formatBarTime} from './timeframes.js';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export function measurementContext(bars,timeZone='UTC',precision=2,displayTimeZone=timeZone){
  return {times:bars.map(bar=>timeStamp(bar.time)),map:drawingTimeMap(bars,timeZone),precision,displayTimeZone};
}
export function measurementValues(points,context){
  if(points.length!==2||!context.times.length)return null;
  const [a,b]=points,first=chartAnchorTime(a,context.map),last=chartAnchorTime(b,context.map);
  const left=logicalAtTime(first,context.times),right=logicalAtTime(last,context.times);
  const within=left>=0&&right>=0&&left<=context.times.length-1&&right<=context.times.length-1;
  const exact=within&&Math.abs(left-Math.round(left))<1e-6&&Math.abs(right-Math.round(right))<1e-6;
  const difference=b.price-a.price,percent=a.price===0?null:difference/Math.abs(a.price)*100;
  const intervals=within?Math.abs(Math.round(right)-Math.round(left)):null;
  return {startPrice:a.price,endPrice:b.price,difference,percent,intervals,included:intervals===null?null:intervals+1,approximate:!exact,elapsedMs:Math.abs(last-first),startTime:first,endTime:last};
}
const signed=(value,precision)=>`${value>0?'+':''}${value.toLocaleString('ko-KR',{maximumFractionDigits:precision})}`;
export function elapsedMeasurement(milliseconds){
  const minutes=Math.floor(milliseconds/60000),days=Math.floor(minutes/1440),hours=Math.floor(minutes%1440/60),rest=minutes%60;
  return [days?days+'일':'',hours?hours+'시간':'',rest?rest+'분':''].filter(Boolean).join(' ')||(milliseconds===0?'0분':'1분 미만');
}
export function measurementDetails(row,context){
  const value=measurementValues(row.points,context);if(!value)return null;
  const precision=Math.min(8,Math.max(0,context.precision)),price=n=>n.toLocaleString('ko-KR',{maximumFractionDigits:precision});
  const date=time=>context.map.intraday?formatBarTime(time/1000,context.displayTimeZone||context.map.formatter.resolvedOptions().timeZone):new Date(time).toISOString().slice(0,10);
  const lines=[];
  if(row.type!=='dateRange'){
    lines.push(`${price(value.startPrice)} → ${price(value.endPrice)}`);
    lines.push(`차이 ${signed(value.difference,precision)} · ${value.percent===null?'등락률 — (시작값 0)':signed(value.percent,2)+'%'+(value.startPrice<0?' (절댓값 기준)':'')}`);
  }
  if(row.type!=='priceRange'){
    lines.push(`${date(value.startTime)} → ${date(value.endTime)}`);
    lines.push(value.intervals===null?'봉 수 미확인':`봉 간격 ${value.approximate?'약 ':''}${value.intervals} · 포함 ${value.included}봉`);
    lines.push(`경과 ${elapsedMeasurement(value.elapsedMs)} · ${context.map.intraday?'휴장 포함':'달력 기준'}`);
  }
  return {...value,lines};
}
export function translateMeasurement(row,start,end,context){
  const {times,map}=context;if(!times.length)return row;
  const indices=row.points.map(point=>clamp(Math.round(logicalAtTime(chartAnchorTime(point,map),times)),0,times.length-1));
  const wanted=Math.round(logicalAtTime(end.time,times)-logicalAtTime(start.time,times));
  const shift=clamp(wanted,-Math.min(...indices),times.length-1-Math.max(...indices)),delta=end.price-start.price;
  return {...row,points:row.points.map((point,index)=>({...point,time:times[indices[index]+shift],price:point.price+delta,dateOnly:!map.intraday}))};
}
export function measurementGeometry(row,plotWidth,plotHeight){
  const [a,b]=row.points,left=Math.min(a.x,b.x),right=Math.max(a.x,b.x),top=Math.min(a.y,b.y),bottom=Math.max(a.y,b.y),x=(a.x+b.x)/2,y=(a.y+b.y)/2;
  const lines=row.measurement?.lines||[],labelWidth=Math.max(0,Math.min(plotWidth-8,Math.max(140,...lines.map(line=>[...line].length*6.8+16)))),labelHeight=lines.length*15+12;
  const arrows=[],caps=[];
  if(row.type!=='dateRange'){arrows.push([x,a.y,x,b.y]);caps.push([left,a.y,right,a.y],[left,b.y,right,b.y]);}
  if(row.type!=='priceRange'){arrows.push([a.x,y,b.x,y]);caps.push([a.x,y-7,a.x,y+7],[b.x,y-7,b.x,y+7]);}
  return {left,top,width:right-left,height:bottom-top,arrows,caps,label:{x:clamp(x-labelWidth/2,4,Math.max(4,plotWidth-labelWidth-4)),y:clamp((row.type==='dateRange'?y:top)-labelHeight-7,4,Math.max(4,plotHeight-labelHeight-4)),width:labelWidth,height:labelHeight,lines}};
}
