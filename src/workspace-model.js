import {TIMEFRAMES} from './timeframes.js';
import {normalizeFilters} from './screening.js';
export const stockKey=stock=>`${stock.market}:${stock.symbol}`;
const frames=new Set(TIMEFRAMES.map(([key])=>key));
export const defaultWorkspace=()=>({version:1,watchMigrated:false,main:{market:'us',symbols:{us:{symbol:'NVDA',name:'NVIDIA'},kr:{symbol:'005930.KS',name:'삼성전자'}},interval:'D',range:'180',benchmarkSymbol:'SPY'},layout:1,syncSymbol:true,syncCrosshair:true,syncTime:true,panes:[{interval:'W',symbol:''},{interval:'1h',symbol:''},{interval:'4h',symbol:''}],lists:[],order:[],colors:{},savedFilters:[]});
export function normalizeWorkspace(raw){
  const d=defaultWorkspace(),r=raw||{},m=r.main||{},main={...d.main,market:m.market==='kr'?'kr':'us',interval:frames.has(m.interval)?m.interval:'D',range:['1','5','30','90','180','365','ALL'].includes(m.range)?m.range:'180',benchmarkSymbol:['SPY','QQQ','^KS11','^KQ11'].includes(m.benchmarkSymbol)?m.benchmarkSymbol:'SPY'};
  for(const market of ['us','kr']){const stock=m.symbols?.[market];if(typeof stock?.symbol==='string'&&(market==='us'?/^[A-Z][A-Z0-9.\-]{0,11}$/:/^\d[A-Z0-9]{5}(\.(KS|KQ))?$/).test(stock.symbol))main.symbols[market]={symbol:stock.symbol,name:typeof stock.name==='string'?stock.name.slice(0,200):stock.symbol};}
  return {...d,main,watchMigrated:r.watchMigrated===true,layout:[1,2,4].includes(r.layout)?r.layout:1,...Object.fromEntries(['syncSymbol','syncCrosshair','syncTime'].map(k=>[k,r[k]!==false])),panes:d.panes.map((p,i)=>({interval:frames.has(r.panes?.[i]?.interval)?r.panes[i].interval:p.interval,symbol:typeof r.panes?.[i]?.symbol==='string'?r.panes[i].symbol.slice(0,20):''})),
    lists:(Array.isArray(r.lists)?r.lists:[]).slice(0,20).filter(l=>typeof l?.id==='string'&&typeof l?.name==='string').map(l=>({id:l.id.slice(0,80),name:l.name.slice(0,60),keys:[...new Set((Array.isArray(l.keys)?l.keys:[]).filter(k=>typeof k==='string'&&k.length<30))].slice(0,500)})),
    order:[...new Set((Array.isArray(r.order)?r.order:[]).filter(k=>typeof k==='string'&&k.length<30))].slice(0,1000),colors:Object.fromEntries(Object.entries(r.colors||{}).filter(([k,v])=>k.length<30&&/^#[a-f0-9]{6}$/i.test(v)).slice(0,1000)),
    savedFilters:(Array.isArray(r.savedFilters)?r.savedFilters:[]).slice(0,20).filter(f=>typeof f?.name==='string'&&f.filters&&typeof f.filters==='object').map(f=>({name:f.name.slice(0,60),filters:normalizeFilters(f.filters)})),
  };
}
export function createChartSync(){
  const members=new Map();let active=null;
  return {register(id,receive){members.set(id,receive);return()=>{members.delete(id);if(active===id)active=null;};},activate(id){active=id;},publish(id,event){if(id!==active)return;for(const [key,receive] of members)if(key!==id)receive(event);}};
}
export function nearestTimeBar(bars,time,{clamp=false,endOfDay=false}={}){
  const stamp=t=>typeof t==='number'?t:Date.parse((typeof t==='string'?t:`${t.year}-${String(t.month).padStart(2,'0')}-${String(t.day).padStart(2,'0')}`)+'T00:00:00Z')/1000;
  if(!bars.length||time==null)return null;const target=stamp(time);if(!Number.isFinite(target))return null;let lo=0,hi=bars.length-1;
  if(typeof time!=='number'&&typeof bars[0].time==='number'){const end=target+86400,boundary=value=>{let l=0,h=bars.length;while(l<h){const m=Math.floor((l+h)/2);if(bars[m].time<value)l=m+1;else h=m;}return l;},first=boundary(target),after=boundary(end);if(first<after)return bars[endOfDay?after-1:first];}
  if(target<stamp(bars[0].time))return clamp?bars[0]:null;
  if(target>stamp(bars.at(-1).time)+(typeof bars.at(-1).time==='number'?14400:7*86400))return clamp?bars.at(-1):null;
  while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(stamp(bars[mid].time)<=target)lo=mid;else hi=mid-1;}return bars[lo];
}
