const validPrice=n=>Number.isFinite(n)&&n>0;
const iso=seconds=>Number.isFinite(seconds)&&seconds>0?new Date(seconds*1000).toISOString():null;
export function sessionDate(seconds,timeZone='UTC'){
  return Number.isFinite(seconds)?new Date(seconds*1000).toLocaleDateString('sv-SE',{timeZone}):null;
}
export function parseDailyHistory(result,symbol){
  if(!result)throw Error('해당 종목의 가격 데이터를 찾지 못했습니다.');
  const meta=result.meta||{},timeZone=meta.exchangeTimezoneName||'UTC';
  if(meta.symbol&&String(meta.symbol).toUpperCase()!==symbol.toUpperCase())throw Error('시세 제공처의 종목 코드가 요청과 다릅니다.');
  const expectedCurrency=/\.(KS|KQ)$/.test(symbol)||['^KS11','^KQ11'].includes(symbol)?'KRW':'USD';
  if(meta.currency&&meta.currency!==expectedCurrency)throw Error('시세 통화가 요청한 시장과 다릅니다.');
  const values=result.indicators?.quote?.[0]||{},bars=[];let invalidBarCount=0;
  for(const [i,timestamp] of (result.timestamp||[]).entries()){
    const bar={time:sessionDate(timestamp,timeZone),open:values.open?.[i],high:values.high?.[i],low:values.low?.[i],close:values.close?.[i],volume:Number.isFinite(values.volume?.[i])&&values.volume[i]>=0?values.volume[i]:null};
    if(!bar.time||![bar.open,bar.high,bar.low,bar.close].every(validPrice)||bar.high<Math.max(bar.open,bar.close)||bar.low>Math.min(bar.open,bar.close)){invalidBarCount++;continue;}
    bars.push(bar);
  }
  const unique=[...new Map(bars.map(bar=>[bar.time,bar])).values()].sort((a,b)=>a.time.localeCompare(b.time));
  const quoteAt=iso(meta.regularMarketTime),precision=Number.isInteger(meta.priceHint)&&meta.priceHint>=0&&meta.priceHint<=8?meta.priceHint:expectedCurrency==='KRW'?0:2;
  return {bars:unique,meta,timeZone,invalidBarCount,quote:{price:validPrice(meta.regularMarketPrice)?meta.regularMarketPrice:null,asOf:quoteAt,sessionDate:quoteAt?sessionDate(meta.regularMarketTime,timeZone):null,currency:meta.currency||null,precision,session:'regular',provider:'Yahoo Finance'}};
}
export function historyQuality(data,now=Date.now()){
  const latest=data.bars.at(-1),quote=data.quote,missingLatestSession=!!(latest&&quote.sessionDate&&latest.time<quote.sessionDate),sameSession=!!latest&&latest.time===quote.sessionDate;
  const priceDiff=sameSession&&validPrice(quote.price)?Math.abs(latest.close-quote.price):null,priceMismatch=priceDiff!==null&&priceDiff>10**-quote.precision+1e-8;
  const regular=data.meta.currentTradingPeriod?.regular,sessionOpen=!!(regular&&Number.isFinite(regular.start)&&Number.isFinite(regular.end)&&now>=regular.start*1000&&now<regular.end*1000&&sameSession);
  return {latestBarDate:latest?.time||null,expectedSessionDate:quote.sessionDate,missingLatestSession,priceMismatch,sessionOpen,invalidBarCount:data.invalidBarCount,latestSessionPatched:!!data.latestSessionPatched,regularSessionOnly:true};
}
export function needsLatestSession(data){const quality=historyQuality(data);return !data.bars.length||quality.missingLatestSession||quality.priceMismatch;}
export function mergeLatestSession(base,recent){
  const cutoff=base.bars.at(-1)?.time||'',updates=recent.bars.filter(bar=>bar.time>=cutoff);
  if(!updates.length)return base;
  const newerQuote=!base.quote.asOf||recent.quote.asOf&&recent.quote.asOf>=base.quote.asOf;
  return {...base,...(newerQuote?{meta:recent.meta,quote:recent.quote,timeZone:recent.timeZone}:{}),bars:[...new Map([...base.bars,...updates].map(bar=>[bar.time,bar])).values()].sort((a,b)=>a.time.localeCompare(b.time)),latestSessionPatched:true};
}
