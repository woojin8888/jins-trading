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
export function dottedTrend(bars,params){
  const input=bars.filter(b=>b.complete!==false),curve=kernelTrend(input,params.bandwidth);
  return {kind:'dottedTrend',curve,signals:[],last:curve.at(-1),requiredBars:Math.ceil(params.bandwidth*3),availableBars:input.length};
}
export function pivotLowStudy(bars,params){
  const input=bars.filter(b=>b.complete!==false);
  return {kind:'pivotLows',curve:[],signals:confirmedPivotLows(input,params.left,params.right),requiredBars:params.left+params.right+1,availableBars:input.length};
}
