import {pineTemplate} from './pine-template.js';
import {rollingMean,emaValues,rmaValues,movingAverageValues} from './technical-math.js';
import {trendLearning} from './trend-learning.js';
const avg=values=>values.reduce((a,b)=>a+b,0)/values.length;
export function rsiValues(bars,n){
  let gains=0,losses=0,averageGain=null,averageLoss=null;
  return bars.map((b,i)=>{if(!i)return null;const change=b.close-bars[i-1].close,up=Math.max(change,0),down=Math.max(-change,0);if(i<=n){gains+=up;losses+=down;if(i<n)return null;averageGain=gains/n;averageLoss=losses/n;}else{averageGain=(averageGain*(n-1)+up)/n;averageLoss=(averageLoss*(n-1)+down)/n;}return averageGain===0&&averageLoss===0?50:averageLoss===0?100:100-100/(1+averageGain/averageLoss);});
}
export function atrValues(bars,n){let value=null,seed=[];return bars.map((b,i)=>{if(!i)return null;const prev=bars[i-1].close,tr=Math.max(b.high-b.low,Math.abs(b.high-prev),Math.abs(b.low-prev));if(value===null){seed.push(tr);if(seed.length<n)return null;value=avg(seed);}else value=(value*(n-1)+tr)/n;return value;});}
export function calculateStudy(study,bars,context={}){
  if(study.type==='minerviniTemplate')return {series:[{name:'미너비니 조건표',color:study.color,data:[]}],bands:[],bounds:null,template:pineTemplate(bars,study.params,context.confirmedBars??bars,{profileAllowed:context.profileAllowed!==false})};
  if(study.type==='trendLearning'){const learning=trendLearning(bars,study.params);return {series:[{name:'과거 커널 평활',color:study.color,kind:'line',lineStyle:'dotted',confirmed:true,data:learning.curve.map(({time,value})=>({time,value}))}],bands:[],bounds:null,learning};}
  const p=study.params,close=bars.map(b=>b.close),line=(name,values,color=study.color,kind='line',format='price')=>({name,color,kind,format,data:values.flatMap((v,i)=>Number.isFinite(v)?[{time:bars[i].time,value:v}]:[])});
  let series=[],bands=[],bounds=null;
  switch(study.type){
    case 'sma':series=[line('SMA',rollingMean(close,p.period))];break;
    case 'ema':case 'wma':case 'rma':case 'vwma':case 'hma':series=[line(study.type.toUpperCase(),movingAverageValues(study.type,close,p.period,bars.map(b=>b.volume)))];break;
    case 'bollinger':{
      const middle=rollingMean(close,p.period),deviations=close.map((_,i)=>i<p.period-1?null:Math.sqrt(avg(close.slice(i-p.period+1,i+1).map(x=>(x-middle[i])**2)))*p.deviation);
      series=[line('중심',middle),line('상단',middle.map((m,i)=>m===null?null:m+deviations[i])),line('하단',middle.map((m,i)=>m===null?null:m-deviations[i]))];break;
    }
    case 'rsi':series=[line('RSI',rsiValues(bars,p.period))];bands=[30,70];bounds=[0,100];break;
    case 'macd':{
      const fast=emaValues(close,p.fast),slow=emaValues(close,p.slow),macd=close.map((_,i)=>fast[i]===null||slow[i]===null?null:fast[i]-slow[i]),signal=emaValues(macd,p.signal),hist=macd.map((v,i)=>v===null||signal[i]===null?null:v-signal[i]);
      series=[line('MACD',macd),line('Signal',signal,'#e4a147'),line('Histogram',hist,study.color,'histogram')];bands=[0];break;
    }
    case 'atr':case 'atrPercent':{
      const values=atrValues(bars,p.period);series=[line(study.type==='atr'?'ATR':'ATR%',study.type==='atr'?values:values.map((v,i)=>v===null?null:v/close[i]*100),study.color,'line',study.type==='atr'?'price':'percent')];break;
    }
    case 'stochastic':{
      const raw=bars.map((b,i)=>{if(i<p.period-1)return null;const window=bars.slice(i-p.period+1,i+1),low=Math.min(...window.map(v=>v.low)),high=Math.max(...window.map(v=>v.high));return high===low?null:(b.close-low)/(high-low)*100;}),k=rollingMean(raw,p.smoothK),d=rollingMean(k,p.smoothD);
      series=[line('%K',k),line('%D',d,'#db9a49')];bounds=[0,100];bands=[20,80];break;
    }
    case 'obv':{
      let value=0,valid=true;series=[line('OBV',bars.map((b,i)=>{if(!Number.isFinite(b.volume)||b.volume<0)valid=false;if(!valid)return null;if(i)value+=Math.sign(b.close-bars[i-1].close)*b.volume;return value;}),study.color,'line','volume')];break;
    }
    case 'vwap':{
      let value=0,volume=0,valid=true;series=[line('누적 VWAP',bars.map(b=>{if(!Number.isFinite(b.volume)||b.volume<0)valid=false;if(!valid)return null;value+=(b.high+b.low+b.close)/3*b.volume;volume+=b.volume;return volume>0?value/volume:null;}))];break;
    }
    case 'donchian':{
      const upper=bars.map((_,i)=>i<p.period-1?null:Math.max(...bars.slice(i-p.period+1,i+1).map(b=>b.high))),lower=bars.map((_,i)=>i<p.period-1?null:Math.min(...bars.slice(i-p.period+1,i+1).map(b=>b.low)));
      series=[line('중심',upper.map((v,i)=>v===null?null:(v+lower[i])/2)),line('상단',upper),line('하단',lower)];break;
    }
    case 'keltner':{
      const basis=emaValues(close,p.period),range=atrValues(bars,p.atrPeriod),ready=basis.map((v,i)=>v===null||range[i]===null?null:v);series=[line('중심',ready),line('상단',ready.map((v,i)=>v===null?null:v+range[i]*p.multiplier)),line('하단',ready.map((v,i)=>v===null?null:v-range[i]*p.multiplier))];break;
    }
    case 'dmi':{
      const tr=bars.map((b,i)=>!i?null:Math.max(b.high-b.low,Math.abs(b.high-bars[i-1].close),Math.abs(b.low-bars[i-1].close))),plus=bars.map((b,i)=>{if(!i)return null;const up=b.high-bars[i-1].high,down=bars[i-1].low-b.low;return up>down&&up>0?up:0;}),minus=bars.map((b,i)=>{if(!i)return null;const up=b.high-bars[i-1].high,down=bars[i-1].low-b.low;return down>up&&down>0?down:0;}),atr=rmaValues(tr,p.period),up=rmaValues(plus,p.period),down=rmaValues(minus,p.period),diPlus=atr.map((v,i)=>v===null?null:v===0?0:100*up[i]/v),diMinus=atr.map((v,i)=>v===null?null:v===0?0:100*down[i]/v),dx=diPlus.map((v,i)=>v===null?null:v+diMinus[i]===0?0:100*Math.abs(v-diMinus[i])/(v+diMinus[i]));
      series=[line('ADX',rmaValues(dx,p.smoothing)),line('+DI',diPlus,'#329a80'),line('−DI',diMinus,'#d76b7b')];bands=[25];bounds=[0,100];break;
    }
    case 'cci':{
      const typical=bars.map(b=>(b.high+b.low+b.close)/3),mean=rollingMean(typical,p.period),values=typical.map((v,i)=>{if(mean[i]===null)return null;const deviation=avg(typical.slice(i-p.period+1,i+1).map(t=>Math.abs(t-mean[i])));return deviation===0?0:(v-mean[i])/(.015*deviation);});series=[line('CCI',values)];bands=[-100,100];break;
    }
    case 'mfi':{
      const typical=bars.map(b=>(b.high+b.low+b.close)/3),positive=bars.map((b,i)=>!i||!Number.isFinite(b.volume)||b.volume<0?null:typical[i]>typical[i-1]?typical[i]*b.volume:0),negative=bars.map((b,i)=>!i||!Number.isFinite(b.volume)||b.volume<0?null:typical[i]<typical[i-1]?typical[i]*b.volume:0),up=rollingMean(positive,p.period),down=rollingMean(negative,p.period);
      series=[line('MFI',up.map((v,i)=>v===null||down[i]===null?null:v===0&&down[i]===0?50:down[i]===0?100:100-100/(1+v/down[i])))];bands=[20,80];bounds=[0,100];break;
    }
    case 'williams':{
      const values=bars.map((b,i)=>{if(i<p.period-1)return null;const window=bars.slice(i-p.period+1,i+1),high=Math.max(...window.map(v=>v.high)),low=Math.min(...window.map(v=>v.low));return high===low?null:-100*(high-b.close)/(high-low);});series=[line('%R',values)];bands=[-80,-20];bounds=[-100,0];break;
    }
    case 'roc':series=[line('ROC',close.map((v,i)=>i<p.period?null:(v/close[i-p.period]-1)*100),study.color,'line','percent')];bands=[0];break;
    case 'cmf':{
      const volumes=bars.map(b=>Number.isFinite(b.volume)&&b.volume>=0?b.volume:null),flow=bars.map((b,i)=>volumes[i]===null?null:b.high===b.low?0:(2*b.close-b.high-b.low)/(b.high-b.low)*b.volume),sum=rollingMean(flow,p.period),volume=rollingMean(volumes,p.period);series=[line('CMF',sum.map((v,i)=>v===null||!(volume[i]>0)?null:v/volume[i]))];bands=[0];bounds=[-1,1];break;
    }
    case 'stochRsi':{
      const rsi=rsiValues(bars,p.rsiPeriod),raw=rsi.map((v,i)=>{if(i<p.period-1||v===null)return null;const window=rsi.slice(i-p.period+1,i+1);if(!window.every(Number.isFinite))return null;const high=Math.max(...window),low=Math.min(...window);return high===low?null:(v-low)/(high-low)*100;}),k=rollingMean(raw,p.smoothK),d=rollingMean(k,p.smoothD);series=[line('%K',k),line('%D',d,'#db9a49')];bands=[20,80];bounds=[0,100];break;
    }
  }
  return {series,bands,bounds};
}
