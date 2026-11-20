export function formatQuoteTime(value){
  if(!value||!Number.isFinite(Date.parse(value)))return '미제공';
  return new Date(value).toLocaleString('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'})+' KST';
}
export function delayLabel(row){return Number.isFinite(row?.delaySeconds)&&row.delaySeconds>0?`${Math.ceil(row.delaySeconds/60)}분 지연`:'지연 정보 미제공';}
export function latestQuoteHistory(histories){
  const first=histories.find(h=>h?.symbol);
  if(!first)return null;
  return histories.filter(h=>h?.symbol===first.symbol&&(!first.currency||h.currency===first.currency)&&Number.isFinite(h.quote?.price)&&Number.isFinite(Date.parse(h.quote?.asOf))).sort((a,b)=>Date.parse(b.quote.asOf)-Date.parse(a.quote.asOf))[0]||null;
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
const explicitExtended=row=>['pre','post','premarket','postmarket','pre-market','post-market','extended'].includes(String(row?.currentSession||'').toLowerCase());
function localDate(value,timeZone){
  return Number.isFinite(Date.parse(value))?new Date(value).toLocaleDateString('sv-SE',{timeZone:timeZone||'UTC'}):null;
}
export function volumeComparison(history,row){
  const bar=history?.bars?.at(-1);
  if(history?.quality?.intraday||history?.quality?.marketOpen!==false||history.quality.sessionOpen||history.quality.confirmationPending||!Number.isFinite(bar?.volume)||!Number.isFinite(row?.volume)||row.volume<0||explicitExtended(row))return null;
  if(!history.currency||!row.currency||history.currency!==row.currency||row.symbol&&history.symbol!==row.symbol)return null;
  if(history.quote?.provider&&history.quote.provider===row.provider)return null;
  const date=localDate(row.barAt,history.timeZone);
  if(date!==bar.time)return null;
  const a=Date.parse(history.quote?.asOf),b=Date.parse(row.quoteBarAt||row.asOf);
  if(!Number.isFinite(a)||!Number.isFinite(b)||Math.abs(a-b)>90000||localDate(history.quote?.asOf,history.timeZone)!==date)return null;
  const difference=Math.abs(bar.volume-row.volume),percent=row.volume>0?difference/row.volume*100:bar.volume===0?0:null;
  return {percent,different:percent===null?difference>0:percent>.1,chartVolume:bar.volume,listVolume:row.volume};
}
export function quoteComparison(history,row){
  const bar=history?.bars?.at(-1),quote=history?.quote;
  if(!bar||!Number.isFinite(quote?.price)||!Number.isFinite(row?.price))return {status:'unavailable'};
  if(row.symbol&&history.symbol!==row.symbol)return {status:'symbol-mismatch'};
  if(!history.currency||!row.currency)return {status:'unknown-currency'};
  if(history.currency&&row.currency&&history.currency!==row.currency)return {status:'currency-mismatch'};
  if(quote.provider&&row.provider&&quote.provider===row.provider)return {status:'same-provider'};
  if(explicitExtended(row))return {status:'different-session-type'};
  const date=localDate(row.barAt,history.timeZone);
  if(!date)return {status:'unknown-session'};
  const chartDate=quote.sessionDate;
  if(date!==chartDate)return {status:'different-session',chartDate,listDate:date};
  const a=Date.parse(quote.asOf),b=Date.parse(row.quoteBarAt||row.asOf);
  if(!Number.isFinite(a)||!Number.isFinite(b))return {status:'unknown-time'};
  if(Math.abs(a-b)>90000)return {status:'different-time',seconds:Math.abs(a-b)/1000};
  const difference=Math.abs(quote.price-row.price),percent=row.price!==0?difference/Math.abs(row.price)*100:null,precision=10**-(quote.precision??2),knownTick=Number.isFinite(row.tickSize)&&row.tickSize>0?row.tickSize:null,tolerance=Math.max(knownTick||0,precision);
  const status=difference<=tolerance+tolerance*1e-5?(knownTick!==null&&knownTick>=precision?'within-tick':'within-precision'):'different-price';
  return {status,percent,difference,tick:knownTick,tolerance};
}
