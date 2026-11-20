export function formatQuoteTime(value){
  if(!value||!Number.isFinite(Date.parse(value)))return '미제공';
  return new Date(value).toLocaleString('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'})+' KST';
}
export function delayLabel(row){return Number.isFinite(row?.delaySeconds)&&row.delaySeconds>0?`${Math.ceil(row.delaySeconds/60)}분 지연`:'지연 정보 미제공';}
export function latestQuoteHistory(histories){
  const first=histories.find(h=>h?.symbol);
  return histories.filter(h=>h?.symbol===first?.symbol&&(!first.currency||h.currency===first.currency)&&Number.isFinite(h.quote?.price)&&Number.isFinite(Date.parse(h.quote?.asOf))).sort((a,b)=>Date.parse(b.quote.asOf)-Date.parse(a.quote.asOf))[0]||null;
}
export function quoteFreshness(history,now=Date.now()){
  const quoteAt=Date.parse(history?.quote?.asOf),fetchedAt=Date.parse(history?.fetchedAt);
  const ageSeconds=Number.isFinite(quoteAt)?Math.max(0,(now-quoteAt)/1000):null,viewAgeSeconds=Number.isFinite(fetchedAt)?Math.max(0,(now-fetchedAt)/1000):null;
  const marketOpen=history?.quality?.marketOpen??null;
  return {ageSeconds,viewAgeSeconds,marketOpen,invalidTime:!Number.isFinite(quoteAt)||quoteAt>now+60000,providerDelayed:marketOpen===true&&ageSeconds>25*60,viewStale:marketOpen===true&&viewAgeSeconds>120};
}
export function elapsedLabel(seconds){
  if(!Number.isFinite(seconds))return '기준 시각 미제공';
  if(seconds<60)return '1분 이내';
  if(seconds<3600)return Math.floor(seconds/60)+'분 전';
  if(seconds<86400)return Math.floor(seconds/3600)+'시간 '+Math.floor(seconds%3600/60)+'분 전';
  return Math.floor(seconds/86400)+'일 전';
}
export function volumeComparison(history,row){
  const bar=history?.bars?.at(-1);
  if(history?.quality?.intraday||history?.quality?.marketOpen!==false||!Number.isFinite(bar?.volume)||!Number.isFinite(row?.volume)||!(row.volume>0))return null;
  const date=row.barAt?new Date(row.barAt).toLocaleDateString('sv-SE',{timeZone:history.timeZone||'UTC'}):null;
  if(date!==bar.time)return null;
  const percent=Math.abs(bar.volume-row.volume)/row.volume*100;
  return {percent,different:percent>.1,chartVolume:bar.volume,listVolume:row.volume};
}
export function quoteComparison(history,row){
  const bar=history?.bars?.at(-1),quote=history?.quote;
  if(!bar||!Number.isFinite(quote?.price)||!Number.isFinite(row?.price))return {status:'unavailable'};
  if(history.currency&&row.currency&&history.currency!==row.currency)return {status:'currency-mismatch'};
  const date=row.barAt?new Date(row.barAt).toLocaleDateString('sv-SE',{timeZone:history.timeZone||'UTC'}):null;
  if(!date)return {status:'unknown-session'};
  const chartDate=quote.sessionDate;
  if(date!==chartDate)return {status:'different-session',chartDate,listDate:date};
  const a=Date.parse(quote.asOf),b=Date.parse(row.quoteBarAt||row.asOf);
  if(!Number.isFinite(a)||!Number.isFinite(b))return {status:'unknown-time'};
  if(Math.abs(a-b)>90000)return {status:'different-time',seconds:Math.abs(a-b)/1000};
  const difference=Math.abs(quote.price-row.price),percent=row.price!==0?difference/Math.abs(row.price)*100:0,tick=Math.max(Number.isFinite(row.tickSize)&&row.tickSize>0?row.tickSize:0,10**-(history.quote?.precision??2));
  return {status:difference<=tick+tick*1e-5?'within-tick':'different-price',percent,difference,tick};
}
