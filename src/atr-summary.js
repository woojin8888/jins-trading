import {atrValues} from './indicator-calculations.js';
export const ATR_SUMMARY_PERIOD=14;
// Always use provider daily bars. Price-chart timeframe and axis mode do not change this metric.
export function dailyAtrSummary(bars,{currency='',forming=false,replay=false,stale=false}={}){
 const period=ATR_SUMMARY_PERIOD,isDaily=bars.every(bar=>typeof bar.time==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(bar.time)),valid=isDaily&&bars.every(bar=>[bar.high,bar.low,bar.close].every(Number.isFinite)&&bar.high>=bar.low),last=valid?bars.at(-1):null;
 const base={period,basis:'D',currency,asOf:last?.time||null,referenceClose:last?.close??null,forming:!!last&&!replay&&(forming||last.complete===false),replay,stale,availableBars:valid?bars.length:0,value:null,percent:null,points:[],status:valid?'insufficient':'invalid'};
 if(!valid||bars.length<period+1)return base;
 const values=atrValues(bars,period),points=values.flatMap((value,index)=>Number.isFinite(value)&&bars[index].close>0?[{time:bars[index].time,value:value/bars[index].close*100}]:[]),value=values.at(-1),percent=last.close>0?value/last.close*100:null;
 return {...base,value:Number.isFinite(value)?value:null,percent:Number.isFinite(percent)?percent:null,points:points.slice(-260),status:Number.isFinite(percent)?'ready':'invalid'};
}
