const period=(key='period',label='기간',value=14,max=500)=>({key,label,value,min:1,max,step:1});
export const INDICATORS=[
  {type:'sma',name:'SMA · 단순이동평균',short:'SMA',placement:'overlay',description:'종가의 단순 평균을 가격 차트에 표시합니다.',color:'#e8a02d',fields:[period('period','기간',20)]},
  {type:'ema',name:'EMA · 지수이동평균',short:'EMA',placement:'overlay',description:'최근 가격에 더 큰 가중치를 주는 이동평균입니다.',color:'#3878ed',fields:[period('period','기간',21)]},
  {type:'bollinger',name:'볼린저 밴드',short:'BB',placement:'overlay',description:'이동평균과 표준편차로 상단·하단 밴드를 표시합니다.',color:'#6489bd',fields:[period('period','기간',20),{key:'deviation',label:'표준편차 배수',value:2,min:.1,max:10,step:.1}]},
  {type:'vwap',name:'기간 누적 VWAP',short:'VWAP',placement:'overlay',description:'조회한 봉 전체의 거래량 가중 평균입니다. 장중 세션 VWAP과 계산 범위가 다릅니다.',color:'#c38a40',fields:[]},
  {type:'rsi',name:'RSI · 상대강도지수',short:'RSI',placement:'panel',description:'Wilder 방식으로 상승·하락 강도를 계산합니다. 기준선 30·70.',color:'#8a65d5',fields:[period()]},
  {type:'macd',name:'MACD',short:'MACD',placement:'panel',description:'빠른·느린 EMA의 차이, 시그널, 히스토그램을 함께 표시합니다.',color:'#367ceb',fields:[period('fast','빠른 EMA',12,499),period('slow','느린 EMA',26),period('signal','시그널 EMA',9,100)]},
  {type:'atr',name:'ATR · 평균 진폭',short:'ATR',placement:'panel',description:'갭을 포함한 True Range를 Wilder 방식으로 평활합니다.',color:'#df9b42',fields:[period()]},
  {type:'atrPercent',name:'ATR% · 평균 진폭 비율',short:'ATR%',placement:'panel',description:'각 봉의 ATR을 같은 봉의 종가로 나눈 백분율입니다.',color:'#bf9141',fields:[period()]},
  {type:'stochastic',name:'스토캐스틱',short:'Stoch',placement:'panel',description:'고저 범위에서 종가 위치를 계산한 %K·%D입니다. 기준선 20·80.',color:'#329a9d',fields:[period('period','고저 기간',14),period('smoothK','%K 평활',3,100),period('smoothD','%D 평활',3,100)]},
  {type:'obv',name:'OBV · 누적 거래량',short:'OBV',placement:'panel',description:'종가 상승일 거래량은 더하고 하락일은 뺍니다. 첫 봉은 0에서 시작합니다.',color:'#5d9c81',fields:[]},
];
export const MAX_STUDIES=12;
const catalog=new Map(INDICATORS.map(item=>[item.type,item]));
export const indicatorDefinition=type=>catalog.get(type);
export function createStudy(type){const definition=catalog.get(type);if(!definition)return null;return {id:crypto.randomUUID(),type,visible:true,color:definition.color,params:Object.fromEntries(definition.fields.map(f=>[f.key,f.value]))};}
export function normalizeStudy(raw){
  const definition=catalog.get(raw?.type);if(!definition||typeof raw.id!=='string'||['volume','rs'].includes(raw.id)||!/^[\w-]{1,80}$/.test(raw.id))return null;
  const params=Object.fromEntries(definition.fields.map(f=>{const value=Number(raw.params?.[f.key]);return [f.key,Number.isFinite(value)&&value>=f.min&&value<=f.max&&(f.step!==1||Number.isInteger(value))?value:f.value];}));
  if(raw.type==='macd'&&params.fast>=params.slow){params.fast=12;params.slow=26;}
  return {id:raw.id,type:raw.type,visible:raw.visible!==false,color:/^#[0-9a-f]{6}$/i.test(raw.color||'')?raw.color:definition.color,params};
}
export function studyLabel(study){const d=catalog.get(study.type);return `${d?.short||study.type}${d?.fields.length?' ('+d.fields.map(f=>study.params[f.key]).join(', ')+')':''}`;}
const avg=values=>values.reduce((a,b)=>a+b,0)/values.length;
export function rollingMean(values,n){let sum=0,count=0;return values.map((value,i)=>{if(Number.isFinite(value)){sum+=value;count++;}if(i>=n&&Number.isFinite(values[i-n])){sum-=values[i-n];count--;}return i>=n-1&&count===n?sum/n:null;});}
export function emaValues(values,n){let value=null,seed=[];const alpha=2/(n+1);return values.map(current=>{if(!Number.isFinite(current)){value=null;seed=[];return null;}if(value===null){seed.push(current);if(seed.length<n)return null;value=avg(seed);}else value=alpha*current+(1-alpha)*value;return value;});}
export function rsiValues(bars,n){
  let gains=0,losses=0,averageGain=null,averageLoss=null;
  return bars.map((b,i)=>{if(!i)return null;const change=b.close-bars[i-1].close,up=Math.max(change,0),down=Math.max(-change,0);if(i<=n){gains+=up;losses+=down;if(i<n)return null;averageGain=gains/n;averageLoss=losses/n;}else{averageGain=(averageGain*(n-1)+up)/n;averageLoss=(averageLoss*(n-1)+down)/n;}return averageGain===0&&averageLoss===0?50:averageLoss===0?100:100-100/(1+averageGain/averageLoss);});
}
export function atrValues(bars,n){let value=null,seed=[];return bars.map((b,i)=>{if(!i)return null;const prev=bars[i-1].close,tr=Math.max(b.high-b.low,Math.abs(b.high-prev),Math.abs(b.low-prev));if(value===null){seed.push(tr);if(seed.length<n)return null;value=avg(seed);}else value=(value*(n-1)+tr)/n;return value;});}
export function calculateStudy(study,bars){
  const definition=catalog.get(study.type);if(!definition)return {series:[],bands:[]};
  const p=study.params,close=bars.map(b=>b.close),line=(name,values,color=study.color,kind='line',format='price')=>({name,color,kind,format,data:values.flatMap((v,i)=>Number.isFinite(v)?[{time:bars[i].time,value:v}]:[])});
  let series=[],bands=[],bounds=null;
  switch(study.type){
    case 'sma':series=[line('SMA',rollingMean(close,p.period))];break;
    case 'ema':series=[line('EMA',emaValues(close,p.period))];break;
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
  }
  return {series,bands,bounds};
}
export function nextLogicalRange(previous,{dataChanged=false,intervalChanged=false,rangeChanged=false,oldLength=0,newLength=0}={}){
  if(!previous||intervalChanged||rangeChanged)return null;
  const shift=dataChanged&&previous.to>=oldLength-1?newLength-oldLength:0;
  return {from:previous.from+shift,to:previous.to+shift};
}
