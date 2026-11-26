export function dottedTrend(bars,params){
  const input=bars.filter(b=>b.complete!==false),curve=shiftedBollingerUpper(input,params);
  return {kind:'dottedTrend',curve,signals:[],last:curve.at(-1),nativeEndIndex:input.length-1,requiredBars:params.period,availableBars:input.length};
}
// Population deviation, matching Pine ta.stdev(close, period)'s default.
// The +offset is a chart position, never a fabricated future quote/date.
export function shiftedBollingerUpper(bars,{period=30,deviation=2,offset=26}={}){
  const curve=[];
  for(let sourceIndex=period-1;sourceIndex<bars.length;sourceIndex++){
    const values=bars.slice(sourceIndex-period+1,sourceIndex+1).map(bar=>bar.close);
    if(!values.every(Number.isFinite))continue;
    const mean=values.reduce((sum,value)=>sum+value,0)/period;
    const variance=values.reduce((sum,value)=>sum+(value-mean)**2,0)/period;
    const index=sourceIndex+offset,value=mean+deviation*Math.sqrt(variance);
    curve.push({sourceTime:bars[sourceIndex].time,sourceIndex,index,...(bars[index]?{time:bars[index].time}:{}),value});
  }
  return curve;
}

// Include only the line actually visible, interpolating at viewport boundaries.
export function curvePriceRange(curve,visible){
  if(!curve.length||!visible)return null;
  const values=[];
  for(let i=0;i<curve.length;i++){
    const point=curve[i];
    if(point.index>=visible.from&&point.index<=visible.to)values.push(point.value);
    const next=curve[i+1];
    if(next)for(const edge of [visible.from,visible.to])if(point.index<edge&&next.index>edge)values.push(point.value+(next.value-point.value)*(edge-point.index)/(next.index-point.index));
  }
  return values.length?{minValue:Math.min(...values),maxValue:Math.max(...values)}:null;
}

export function mergeCurveAutoscale(original,curves,visible){
  let result=original;
  for(const curve of curves){
    const range=curvePriceRange(curve,visible);if(!range)continue;
    result={...result,priceRange:{minValue:Math.min(result?.priceRange.minValue??range.minValue,range.minValue),maxValue:Math.max(result?.priceRange.maxValue??range.maxValue,range.maxValue)}};
  }
  return result;
}
