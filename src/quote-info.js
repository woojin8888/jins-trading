export function formatQuoteTime(value){
  if(!value||!Number.isFinite(Date.parse(value)))return '미제공';
  return new Date(value).toLocaleString('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'})+' KST';
}
export function delayLabel(row){return Number.isFinite(row?.delaySeconds)&&row.delaySeconds>0?`${Math.ceil(row.delaySeconds/60)}분 지연`:'지연 정보 미제공';}
export function quoteComparison(history,row){
  const bar=history?.bars?.at(-1);
  if(!bar||!Number.isFinite(row?.price)||row.price<=0)return {status:'unavailable'};
  if(history.currency&&row.currency&&history.currency!==row.currency)return {status:'currency-mismatch'};
  const date=row.barAt?new Date(row.barAt).toLocaleDateString('sv-SE',{timeZone:history.timeZone||'UTC'}):null;
  if(!date)return {status:'unknown-session'};
  const chartDate=typeof bar.time==='number'?new Date(bar.time*1000).toLocaleDateString('sv-SE',{timeZone:history.timeZone||'UTC'}):bar.time;
  if(date!==chartDate)return {status:'different-session',chartDate,listDate:date};
  const difference=Math.abs(bar.close-row.price),percent=difference/row.price*100,tick=Math.max(Number.isFinite(row.tickSize)&&row.tickSize>0?row.tickSize:0,10**-(history.quote?.precision??2));
  return {status:difference<=tick+tick*1e-5?'within-tick':'different-price',percent,difference,tick};
}
