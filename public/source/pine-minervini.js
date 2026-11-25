/*! @license MPL-2.0 | Minervini source © yogy.frestarahmawan. Modified source: https://github.com/woojin8888/jins-trading/blob/main/src/pine-minervini.js */
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. https://mozilla.org/MPL/2.0/
// Adapted from the user-provided Minervini Trend Template, © yogy.frestarahmawan.
// The original is combined with Volume Profile © LonesomeTheBlue; this file
// ports only the Minervini/RS section. Formula divisions intentionally retained.
import {sma} from './analysis.js';
export function uploadedRS(bars){
  return bars.flatMap((bar,index)=>{
    if(index<52)return [];
    const prices=[13,26,39,52].map(offset=>bars[index-offset]?.close);
    if(!Number.isFinite(bar.close)||!prices.every(price=>Number.isFinite(price)&&price>0))return [];
    const value=(.4*(bar.close/prices[0])+.2*(bar.close/(prices[1]*2))+.2*(bar.close/(prices[2]*3))+.2*(bar.close/(prices[3]*4)))*100;
    return [{time:bar.time,value}];
  });
}
export function uploadedMinervini(bars,{highLookback=260,lowLookback=260}={}){
  const price=bars.at(-1)?.close,ma50=sma(bars,50).at(-1)?.value,ma150=sma(bars,150).at(-1)?.value,ma200=sma(bars,200).at(-1)?.value,previous=sma(bars.slice(0,-22),200).at(-1)?.value,high=bars.length?Math.max(...bars.slice(-highLookback).map(b=>b.high)):null,low=bars.length?Math.min(...bars.slice(-lowLookback).map(b=>b.low)):null,rs=uploadedRS(bars).at(-1)?.value??null;
  const checks=[
    {label:'종가 > 150·200봉선',pass:ma200==null?null:price>ma150&&price>ma200},
    {label:'150봉선 > 200봉선',pass:ma200==null?null:ma150>ma200},
    {label:'200봉선 > 22봉 전 200봉선',pass:previous==null?null:ma200>previous},
    {label:'50봉선 > 150·200봉선',pass:ma200==null?null:ma50>ma150&&ma50>ma200},
    {label:'종가 > 50봉선',pass:ma50==null?null:price>ma50},
    {label:`${lowLookback}봉 저가 대비 ≥ 25%`,pass:low==null?null:(price/low-1)*100>=25},
    {label:`${highLookback}봉 고가에서 ≤ 25%`,pass:high==null?null:(1-price/high)*100<=25},
    {label:'업로드 RS > 70',pass:rs===null?null:rs>70},
  ];
  return {checks,score:checks.filter(row=>row.pass===true).length,known:checks.filter(row=>row.pass!==null).length,rs,ma50,ma150,ma200,high,low,asOf:bars.at(-1)?.time};
}
