/*! @license MPL-2.0 | Minervini © yogy.frestarahmawan; Volume Profile © LonesomeTheBlue. Adapted source: /source/pine-template.js */
// This Source Code Form is subject to Mozilla Public License 2.0.
// https://mozilla.org/MPL/2.0/ — port of the user-provided combined Pine v5.
import {uploadedMinervini} from './pine-minervini.js';

const overlap=(lo,hi,a,b,height,volume)=>height>0&&Number.isFinite(volume)?Math.max(0,Math.min(hi,Math.max(a,b))-Math.max(lo,Math.min(a,b)))*volume/height:0;
export function pineFixedProfile(bars,{profileBars=150,rows=24,valueArea=70}={}){
 const window=bars.slice(-profileBars),valid=window.filter(b=>[b.open,b.high,b.low,b.close].every(Number.isFinite)&&b.high>=Math.max(b.open,b.close)&&b.low<=Math.min(b.open,b.close));
 const base={requestedBars:profileBars,usedBars:window.length,missingVolumeBars:valid.filter(b=>!Number.isFinite(b.volume)||b.volume<0).length,flatBars:0,allocatedVolume:0,inputVolume:valid.reduce((sum,b)=>sum+(Number.isFinite(b.volume)&&b.volume>=0?b.volume:0),0),originIndex:bars.length-profileBars,bins:[],pocPrice:null};
 if(!valid.length)return {...base,status:'unavailable'};
 const top=Math.max(...valid.map(b=>b.high)),bottom=Math.min(...valid.map(b=>b.low)),step=(top-bottom)/rows;
 if(!(step>0))return {...base,status:'flat',top,bottom,flatBars:valid.length};
 const bins=Array.from({length:rows},(_,i)=>({low:bottom+step*i,high:bottom+step*(i+1),up:0,down:0}));
 // Pine iterates newest first; retain that order to preserve ties/rounding.
 for(const b of [...valid].reverse()){
  if(!Number.isFinite(b.volume)||b.volume<0)continue;
  const high=Math.max(b.open,b.close),low=Math.min(b.open,b.close),body=high-low,upper=b.high-high,lower=low-b.low,den=2*upper+2*lower+body;
  if(!(den>0)){base.flatBars++;continue;}
  const bodyVolume=body*b.volume/den,upperVolume=2*upper*b.volume/den,lowerVolume=2*lower*b.volume/den;
  for(const bin of bins){const wick=(overlap(bin.low,bin.high,high,b.high,upper,upperVolume)+overlap(bin.low,bin.high,low,b.low,lower,lowerVolume))/2,bodyPart=overlap(bin.low,bin.high,low,high,body,bodyVolume);bin.up+=wick+(b.close>=b.open?bodyPart:0);bin.down+=wick+(b.close>=b.open?0:bodyPart);}
 }
 for(const bin of bins)bin.total=bin.up+bin.down;
 const total=bins.reduce((sum,b)=>sum+b.total,0),maximum=Math.max(...bins.map(b=>b.total));
 if(!(maximum>0))return {...base,bins,top,bottom,status:'unavailable'};
 const poc=bins.findIndex(b=>b.total===maximum);let up=poc,down=poc,accumulated=bins[poc].total;
 for(let i=0;i<rows&&accumulated<total*valueArea/100;i++){
  const above=up<rows-1?bins[up+1].total:0,below=down>0?bins[down-1].total:0;
  if(above===0&&below===0)break;
  if(above>=below){up++;accumulated+=above;}else{down--;accumulated+=below;}
 }
 const factor=profileBars/(3*maximum);
 return {...base,status:base.missingVolumeBars?'partial':'ready',top,bottom,allocatedVolume:total,pocIndex:poc,pocPrice:(bins[poc].low+bins[poc].high)/2,vah:bins[up].high,val:bins[down].low,actualValueAreaPercent:accumulated/total*100,
  bins:bins.map((b,i)=>({...b,inValueArea:i>=down&&i<=up,upWidth:Math.round(b.up*factor),downWidth:Math.round(b.down*factor)})),gap:(top-bottom)/500};
}
export function pineTemplate(bars,params,confirmedBars=bars,{profileAllowed=true}={}){
 const current=bars.slice(-params.highLookback),low=bars.slice(-params.lowLookback);
 return {table:uploadedMinervini(confirmedBars,{highLookback:params.highLookback,lowLookback:params.lowLookback}),currentAsOf:bars.at(-1)?.time,
  high:current.length?Math.max(...current.map(b=>b.high)):null,low:low.length?Math.min(...low.map(b=>b.low)):null,
  profile:params.showFixedProfile&&profileAllowed?pineFixedProfile(bars,params):null,profileAllowed};
}
