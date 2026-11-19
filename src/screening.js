import {atr,mean,vcp} from './analysis.js';
import {uploadedMinervini} from './pine-minervini.js';
import {completedAnalysisBars} from './timeframes.js';
export const defaultFilters=()=>({query:'',minValue:'',minCap:'',minChange:'',maxChange:'',maxATR:'',minRS:'',minScore:'',minVolume:'',vcp:false,watch:false});
export function normalizeFilters(raw){return Object.fromEntries(Object.entries(defaultFilters()).map(([k,v])=>[k,typeof v==='boolean'?raw?.[k]===true:k==='query'?typeof raw?.[k]==='string'?raw[k].slice(0,80):'':typeof raw?.[k]==='string'&&raw[k].length<32&&(raw[k]===''||Number.isFinite(Number(raw[k])))?raw[k]:'']));}
export function screenMetrics(history){
  const bars=completedAnalysisBars(history.bars||[],'D',history.quality?.sessionOpen),current=bars.at(-1),prior=bars.slice(-21,-1),analysis=uploadedMinervini(bars);
  return {atrPercent:atr(bars)?.percent??null,uploadedRS:analysis.rs??null,score:analysis.known===8?analysis.score:null,known:analysis.known,volumeRatio:current&&Number.isFinite(current.volume)&&prior.length===20&&prior.every(b=>Number.isFinite(b.volume))&&mean(prior.map(b=>b.volume))>0?current.volume/mean(prior.map(b=>b.volume)):null,vcp:vcp(bars)?.candidate??null,analysisAt:current?.time??null};
}
export function matchesFilters(row,filters,saved=new Set()){
  const f={...defaultFilters(),...filters},minimum=(value,limit)=>limit===''||Number.isFinite(value)&&value>=Number(limit),maximum=(value,limit)=>limit===''||Number.isFinite(value)&&value<=Number(limit);
  return `${row.symbol} ${row.name}`.toLowerCase().includes(f.query.toLowerCase())&&minimum(row.value,f.minValue)&&minimum(row.marketCap,f.minCap)&&minimum(row.change,f.minChange)&&maximum(row.change,f.maxChange)&&maximum(row.atrPercent,f.maxATR)&&minimum(row.uploadedRS,f.minRS)&&minimum(row.score,f.minScore)&&minimum(row.volumeRatio,f.minVolume)&&(!f.vcp||row.vcp===true)&&(!f.watch||saved.has(row.symbol));
}
