// A transparent teaching example, not a reverse-engineering of a protected script.
// One-sided Gaussian kernel: only values available at the observation are used.
export function kernelTrend(bars,bandwidth=8){
  const window=Math.ceil(3*bandwidth),weights=Array.from({length:window},(_,j)=>Math.exp(-.5*(j/bandwidth)**2)),denominator=weights.reduce((a,b)=>a+b,0);
  return bars.flatMap((bar,index)=>{
    if(index<window-1)return [];
    let total=0;for(let j=0;j<window;j++){const close=bars[index-j].close;if(!Number.isFinite(close))return [];total+=weights[j]*close;}
    return [{time:bar.time,index,value:total/denominator}];
  });
}
export function confirmedPivotLows(bars,left=3,right=3){
  const signals=[];
  for(let confirmation=left+right;confirmation<bars.length;confirmation++){
    const pivot=confirmation-right,price=bars[pivot].low;
    if(!Number.isFinite(price))continue;
    // Choose the first equal low; ties cannot generate multiple signals.
    if(bars.slice(pivot-left,pivot).every(b=>Number.isFinite(b.low)&&b.low>price)&&bars.slice(pivot+1,confirmation+1).every(b=>Number.isFinite(b.low)&&b.low>=price))signals.push({pivotTime:bars[pivot].time,confirmedTime:bars[confirmation].time,pivotIndex:pivot,confirmedIndex:confirmation,price,confirmationLow:bars[confirmation].low,delay:right});
  }
  return signals;
}
export function trendLearning(bars,params){
  const input=bars.filter(b=>b.complete!==false),curve=kernelTrend(input,params.bandwidth),last=curve.at(-1),pattern=curve.slice(-(params.pattern+1)),projection=[];
  if(params.showProjection&&last&&pattern.length===params.pattern+1){
    const base=pattern[0].value;
    for(let h=1;h<=Math.min(params.horizon,params.pattern);h++)projection.push({step:h,value:last.value+pattern[h].value-base});
  }
  return {curve,projection,signals:params.showLows?confirmedPivotLows(input,params.left,params.right):[],last,requiredBars:Math.ceil(params.bandwidth*3)+params.pattern,availableBars:input.length,projectionLength:projection.length};
}
