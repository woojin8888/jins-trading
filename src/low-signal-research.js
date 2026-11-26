// Independent research hypotheses. This is NOT the protected indicator's source.
export function rolling(values, period, statistic='mean') {
  return values.map((_, i) => {
    if (i < period - 1) return null;
    const window=values.slice(i-period+1,i+1);
    if (!window.every(Number.isFinite)) return null;
    const mean=window.reduce((sum,x)=>sum+x,0)/period;
    return statistic==='std' ? Math.sqrt(window.reduce((sum,x)=>sum+(x-mean)**2,0)/period) : mean;
  });
}

export function wilderRsi(closes, period=14) {
  const result=Array(closes.length).fill(null);
  if (closes.length<=period) return result;
  let gain=0, loss=0;
  for(let i=1;i<=period;i++) {const delta=closes[i]-closes[i-1];gain+=Math.max(delta,0);loss+=Math.max(-delta,0);}
  gain/=period;loss/=period;
  const value=()=>loss===0 ? gain===0 ? 50 : 100 : 100-100/(1+gain/loss);
  result[period]=value();
  for(let i=period+1;i<closes.length;i++) {
    const delta=closes[i]-closes[i-1];
    gain=(gain*(period-1)+Math.max(delta,0))/period;
    loss=(loss*(period-1)+Math.max(-delta,0))/period;
    result[i]=value();
  }
  return result;
}

const integer=(value,fallback,min,max)=>Number.isInteger(Number(value))&&Number(value)>=min&&Number(value)<=max ? Number(value):fallback;
const number=(value,fallback,min,max)=>value!==null&&value!==''&&Number.isFinite(Number(value))&&Number(value)>=min&&Number(value)<=max ? Number(value):fallback;
export function normalizedConfig(raw={}) {
  return {
    model:['rsi','band','return','rebound'].includes(raw.model)?raw.model:'band',
    period:integer(raw.period,20,2,500),deviation:number(raw.deviation,2,.1,10),
    rsiPeriod:integer(raw.rsiPeriod,2,2,100),rsiThreshold:number(raw.rsiThreshold,10,0,100),
    returnPeriod:integer(raw.returnPeriod,5,1,100),returnWindow:integer(raw.returnWindow,60,2,500),
    rebound:number(raw.rebound,2.5,.1,100),bearish:raw.bearish!==false,entry:raw.entry!==false,
  };
}

export function computeSignals(input,raw={}) {
  const config=normalizedConfig(raw), bars=input.filter(b=>b.complete!==false);
  for(let i=0;i<bars.length;i++) {
    const b=bars[i];
    if(!['open','high','low','close'].every(k=>Number.isFinite(b[k])) || b.close<=0 || b.low<=0 || b.high<Math.max(b.open,b.close,b.low) || b.low>Math.min(b.open,b.close) || typeof b.time!=='string' || (i>0&&bars[i-1].time>=b.time)) throw Error('봉 데이터의 날짜·가격을 확인해 주세요.');
  }
  const close=bars.map(b=>b.close),rsi=wilderRsi(close,config.rsiPeriod);
  const mid=rolling(close,config.period),sd=rolling(close,config.period,'std');
  const lower=close.map((_,i)=>mid[i]===null?null:mid[i]-config.deviation*sd[i]);
  const signals=[];
  const emit=(originIndex,confirmedIndex,detail)=>signals.push({originIndex,confirmedIndex,originTime:bars[originIndex].time,confirmedTime:bars[confirmedIndex].time,originPrice:bars[originIndex].low,confirmedPrice:bars[confirmedIndex].low,detail});
  if(config.model==='rebound') {
    let candidate=null;
    for(let i=0;i<bars.length;i++) {
      if(candidate!==null&&close[i]>=close[candidate]*(1+config.rebound/100)) {
        emit(candidate,i,`종가 기준 ${config.rebound}% 반등 확인 · 후보봉은 사후에만 확정`);
        candidate=null;
      }
      if(candidate!==null&&close[i]<close[candidate])candidate=i;
      if(candidate===null&&lower[i]!==null&&close[i]<lower[i])candidate=i;
    }
    return {bars,signals,lower,rsi,config,pending:candidate===null?null:bars[candidate].time};
  }
  let returns,returnMean,returnSd;
  if(config.model==='return') {
    returns=close.map((v,i)=>i<config.returnPeriod?null:v/close[i-config.returnPeriod]-1);
    returnMean=rolling(returns,config.returnWindow);returnSd=rolling(returns,config.returnWindow,'std');
  }
  let previous=false;
  for(let i=0;i<bars.length;i++) {
    let qualifies;
    if(config.model==='rsi')qualifies=rsi[i]!==null&&rsi[i]<config.rsiThreshold;
    else if(config.model==='band')qualifies=lower[i]!==null&&bars[i].low<lower[i]&&(!config.bearish||close[i]<bars[i].open);
    else qualifies=returnMean[i]!==null&&returnSd[i]>0&&returns[i]<returnMean[i]-config.deviation*returnSd[i]&&rsi[i]!==null&&rsi[i]<config.rsiThreshold;
    if(qualifies&&(!config.entry||!previous))emit(i,i,'이 봉까지의 데이터로 조건 충족 · 봉 확정 기준');
    previous=qualifies;
  }
  return {bars,signals,lower,rsi,config,pending:null};
}

export function compareSignals(signals,reference,bars,{position='confirmed',startTime=bars[0]?.time,endTime=bars.at(-1)?.time,tolerance=0}={}) {
  const index=new Map(bars.map((b,i)=>[b.time,i]));
  const predictions=signals.map(s=>position==='origin'?s.originTime:s.confirmedTime).filter(t=>t>=startTime&&t<=endTime);
  const positives=reference.filter(r=>r.value===1&&r.time>=startTime&&r.time<=endTime);
  const negatives=reference.filter(r=>r.value===0&&r.time>=startTime&&r.time<=endTime);
  const used=new Set();let matched=0;
  for(const ref of positives) {
    const distance=ref.precision==='cursor'?0:tolerance;
    const candidates=predictions.map((t,i)=>({i,d:Math.abs(index.get(t)-index.get(ref.time))})).filter(x=>x.d<=distance&&!used.has(x.i)).sort((a,b)=>a.d-b.d);
    if(candidates.length){matched++;used.add(candidates[0].i);}
  }
  return {matched,total:positives.length,extra:predictions.length-matched,missed:positives.length-matched,contradictions:negatives.filter(r=>predictions.includes(r.time)).length,checkedNegatives:negatives.length};
}
