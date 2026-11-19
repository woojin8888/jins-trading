export const MA_TYPES=[['sma','SMA · 단순'],['ema','EMA · 지수'],['wma','WMA · 가중'],['rma','RMA · 평활'],['vwma','VWMA · 거래량가중'],['hma','HMA · Hull']];
export const MA_SOURCES=[['close','종가'],['open','시가'],['high','고가'],['low','저가'],['hl2','고저 평균'],['hlc3','고저종 평균'],['ohlc4','시고저종 평균']];
export function chartTimeKey(time){if(typeof time==='string'||typeof time==='number')return time;return time?`${time.year}-${String(time.month).padStart(2,'0')}-${String(time.day).padStart(2,'0')}`:'';}
export function resolveCandle(candles,time){return candles.get(chartTimeKey(time))||(typeof time==='number'?candles.get(new Date(time*1000).toISOString().slice(0,10)):null)||null;}
export function rollingMean(values,n){let sum=0,count=0;return values.map((value,i)=>{if(Number.isFinite(value)){sum+=value;count++;}if(i>=n&&Number.isFinite(values[i-n])){sum-=values[i-n];count--;}return i>=n-1&&count===n?sum/n:null;});}
export function emaValues(values,n){let value=null,seed=[];const alpha=2/(n+1);return values.map(current=>{if(!Number.isFinite(current)){value=null;seed=[];return null;}if(value===null){seed.push(current);if(seed.length<n)return null;value=seed.reduce((a,b)=>a+b,0)/n;}else value=alpha*current+(1-alpha)*value;return value;});}
export function rmaValues(values,n){let value=null,seed=[];return values.map(current=>{if(!Number.isFinite(current)){value=null;seed=[];return null;}if(value===null){seed.push(current);if(seed.length<n)return null;value=seed.reduce((a,b)=>a+b,0)/n;}else value=(value*(n-1)+current)/n;return value;});}
export function wmaValues(values,n){return values.map((_,i)=>{if(i<n-1)return null;const window=values.slice(i-n+1,i+1);return window.every(Number.isFinite)?window.reduce((sum,v,j)=>sum+v*(j+1),0)/(n*(n+1)/2):null;});}
export function movingAverageValues(type,values,n,volumes=[]){
  if(type==='ema')return emaValues(values,n);
  if(type==='rma')return rmaValues(values,n);
  if(type==='wma')return wmaValues(values,n);
  if(type==='hma'){const fast=wmaValues(values,Math.max(1,Math.floor(n/2))),slow=wmaValues(values,n);return wmaValues(values.map((_,i)=>fast[i]===null||slow[i]===null?null:2*fast[i]-slow[i]),Math.max(1,Math.round(Math.sqrt(n))));}
  if(type==='vwma'){const valid=volumes.map(v=>Number.isFinite(v)&&v>=0?v:null),weighted=rollingMean(values.map((v,i)=>valid[i]===null?null:v*valid[i]),n),volume=rollingMean(valid,n);return values.map((_,i)=>weighted[i]===null||!(volume[i]>0)?null:weighted[i]/volume[i]);}
  return rollingMean(values,n);
}
export function sourceValue(bar,source='close'){if(source==='hl2')return (bar.high+bar.low)/2;if(source==='hlc3')return (bar.high+bar.low+bar.close)/3;if(source==='ohlc4')return (bar.open+bar.high+bar.low+bar.close)/4;return bar[source]??bar.close;}
export function movingAveragePoints(config,bars){const values=movingAverageValues(config.type,bars.map(b=>sourceValue(b,config.source)),config.period,bars.map(b=>b.volume));return values.flatMap((value,i)=>Number.isFinite(value)?[{time:bars[i].time,value}]:[]);}
export function formatVolume(value,mode='shares',unit='주'){if(!Number.isFinite(value))return '—';if(mode==='korean'){if(value>=1e8)return (value/1e8).toLocaleString('ko-KR',{maximumFractionDigits:2})+'억'+unit;if(value>=1e4)return (value/1e4).toLocaleString('ko-KR',{maximumFractionDigits:1})+'만'+unit;if(value>=1e3)return (value/1e3).toLocaleString('ko-KR',{maximumFractionDigits:1})+'천'+unit;}
  return mode==='compact'?Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:2}).format(value):`${Math.round(value).toLocaleString('ko-KR')}${unit}`;}
export function profileValueArea(bins,percent=70){
  if(!bins.length)return null;let poc=0;bins.forEach((bin,i)=>{if(bin.volume>bins[poc].volume)poc=i;});
  const total=bins.reduce((sum,b)=>sum+b.volume,0);if(!(total>0))return null;
  let low=poc,high=poc,covered=bins[poc].volume;const target=total*Math.max(1,Math.min(100,percent))/100;
  while(covered<target&&(low>0||high<bins.length-1)){const below=low>0?bins[low-1].volume:-1,above=high<bins.length-1?bins[high+1].volume:-1;if(above>=below){high++;covered+=bins[high].volume;}else{low--;covered+=bins[low].volume;}}
  return {poc,pocPrice:(bins[poc].low+bins[poc].high)/2,low,high,val:bins[low].low,vah:bins[high].high,covered,total};
}
