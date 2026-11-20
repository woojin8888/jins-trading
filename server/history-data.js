import {expectedCurrencies,assetKind,knownAsset,hasVolume,volumeUnit} from '../src/instruments.js';
const validPrice=n=>Number.isFinite(n)&&n>0;
const iso=seconds=>Number.isFinite(seconds)&&seconds>0?new Date(seconds*1000).toISOString():null;
// Yahoo sometimes returns the explicit USD pair for these documented short codes.
// Never accept arbitrary symbol changes, inverted pairs, or another currency.
const FX_ALIASES={'JPY=X':'USDJPY=X','KRW=X':'USDKRW=X','CAD=X':'USDCAD=X','CHF=X':'USDCHF=X','CNY=X':'USDCNY=X','HKD=X':'USDHKD=X','SGD=X':'USDSGD=X'};
function regularSession(meta,symbol=meta.symbol||''){
  const period=meta.currentTradingPeriod?.regular;
  if(!period)return null;
  return /\.(KS|KQ)$/.test(symbol)||['^KS11','^KQ11'].includes(symbol)?{...period,end:period.start+390*60}:period;
}
export function quoteChange(meta,price){
  let previousClose=null,previousCloseSource=null;
  for(const key of ['previousClose','regularMarketPreviousClose'])if(Number.isFinite(meta[key])&&meta[key]!==0){previousClose=meta[key];previousCloseSource=key;break;}
  if(previousClose===null&&Number.isFinite(meta.fulldayPrice)&&Number.isFinite(meta.fulldayChange)&&Math.abs(meta.fulldayPrice-price)<=10**-(meta.priceHint??2)+1e-8){
    previousClose=meta.fulldayPrice-meta.fulldayChange;previousCloseSource='fulldayPrice-fulldayChange';
  }
  if(previousClose===null&&Number.isFinite(price)&&Number.isFinite(meta.regularMarketChangePercent)&&meta.regularMarketChangePercent!==-100){
    previousClose=price/(1+meta.regularMarketChangePercent/100);previousCloseSource='regularMarketChangePercent';
  }
  // chartPreviousClose is the beginning of the requested range, NOT yesterday.
  if(!Number.isFinite(previousClose)||previousClose<=0)return {previousClose:null,previousCloseSource:null,changePercent:null};
  return {previousClose,previousCloseSource,changePercent:Number.isFinite(price)?(price/previousClose-1)*100:null};
}
export function sessionDate(seconds,timeZone='UTC'){
  return Number.isFinite(seconds)?new Date(seconds*1000).toLocaleDateString('sv-SE',{timeZone}):null;
}
export function parseDailyHistory(result,symbol){
  if(!result)throw Error('해당 종목의 가격 데이터를 찾지 못했습니다.');
  const meta=result.meta||{},timeZone=meta.exchangeTimezoneName||'UTC';
  const alias=FX_ALIASES[symbol.toUpperCase()]===String(meta.symbol).toUpperCase()&&meta.instrumentType==='CURRENCY';
  if(meta.symbol&&String(meta.symbol).toUpperCase()!==symbol.toUpperCase()&&!alias)throw Error('시세 제공처의 종목 코드가 요청과 다릅니다.');
  const currencies=expectedCurrencies(symbol),expectedCurrency=currencies[0],kind=assetKind(symbol),priceValid=n=>Number.isFinite(n)&&(kind==='future'||n>0);
  if(meta.currency&&!currencies.includes(meta.currency))throw Error('시세 통화가 요청한 시장과 다릅니다.');
  const values=result.indicators?.quote?.[0]||{},bars=[];let invalidBarCount=0;
  for(const [i,timestamp] of (result.timestamp||[]).entries()){
    const bar={time:sessionDate(timestamp,timeZone),open:values.open?.[i],high:values.high?.[i],low:values.low?.[i],close:values.close?.[i],volume:hasVolume(symbol)&&Number.isFinite(values.volume?.[i])&&values.volume[i]>=0?values.volume[i]:null};
    if(!bar.time||![bar.open,bar.high,bar.low,bar.close].every(priceValid)||bar.high<Math.max(bar.open,bar.close)||bar.low>Math.min(bar.open,bar.close)){invalidBarCount++;continue;}
    bars.push(bar);
  }
  const unique=[...new Map(bars.map(bar=>[bar.time,bar])).values()].sort((a,b)=>a.time.localeCompare(b.time));
  const quoteAt=iso(meta.regularMarketTime),precision=Number.isInteger(meta.priceHint)&&meta.priceHint>=0&&meta.priceHint<=8?meta.priceHint:expectedCurrency==='KRW'?0:2;
  const price=priceValid(meta.regularMarketPrice)?meta.regularMarketPrice:null,regular=regularSession(meta,symbol);
  return {bars:unique,meta,timeZone,invalidBarCount,quote:{price,...quoteChange(meta,price),asOf:quoteAt,sessionDate:quoteAt?sessionDate(meta.regularMarketTime,timeZone):null,currency:meta.currency||null,precision,session:'regular',provider:'Yahoo Finance',providerSymbol:meta.symbol||symbol,regularStart:iso(regular?.start),regularEnd:iso(regular?.end)}};
}
export function historyQuality(data,now=Date.now()){
  const latest=data.bars.at(-1),quote=data.quote,missingLatestSession=!!(latest&&quote.sessionDate&&latest.time<quote.sessionDate),sameSession=!!latest&&latest.time===quote.sessionDate;
  const priceDiff=sameSession&&Number.isFinite(quote.price)&&(quote.price>0||assetKind(data.meta.symbol||'')==='future')?Math.abs(latest.close-quote.price):null,priceMismatch=priceDiff!==null&&priceDiff>10**-quote.precision+1e-8;
  const regular=regularSession(data.meta);
  const marketOpen=regular&&Number.isFinite(regular.start)&&Number.isFinite(regular.end)?now>=regular.start*1000&&now<regular.end*1000:null;
  const currentBar=!!regular&&sameSession&&latest.time===sessionDate(regular.start,data.timeZone);
  const confirmationPending=!!(currentBar&&!marketOpen&&now>=regular.end*1000&&Date.parse(quote.asOf)<regular.end*1000&&sessionDate(now/1000,data.timeZone)===latest.time);
  const sessionOpen=currentBar&&(marketOpen===true||confirmationPending);
  return {latestBarDate:latest?.time||null,expectedSessionDate:quote.sessionDate,missingLatestSession,priceMismatch,sessionOpen,marketOpen,confirmationPending,invalidBarCount:data.invalidBarCount,latestSessionPatched:!!data.latestSessionPatched,regularSessionOnly:true};
}
export function intradayQuality(info,bars,now=Date.now()){
  const last=bars.at(-1),date=last?sessionDate(last.time,info.timeZone):null,quote=info.quote;
  const priceMismatch=!!last&&Number.isFinite(quote.price)&&Math.abs(last.close-quote.price)>10**-quote.precision+1e-8;
  const sourceGapSeconds=last&&quote.asOf?Math.max(0,Date.parse(quote.asOf)/1000-last.endTime):null;
  return {marketOpen:historyQuality(info,now).marketOpen,latestBarDate:date,expectedSessionDate:quote.sessionDate,missingLatestSession:!!date&&!!quote.sessionDate&&date<quote.sessionDate,priceMismatch,sourceGapSeconds,dataGap:priceMismatch&&sourceGapSeconds>60};
}
export function needsLatestSession(data){const quality=historyQuality(data);return !data.bars.length||quality.missingLatestSession||quality.priceMismatch;}
export function mergeLatestSession(base,recent){
  if(base.quote.asOf&&(!recent.quote.asOf||recent.quote.asOf<base.quote.asOf))return base;
  const cutoff=base.bars.at(-1)?.time||'',updates=recent.bars.filter(bar=>bar.time>=cutoff);
  if(!updates.length)return base;
  const newerQuote=!base.quote.asOf||recent.quote.asOf&&recent.quote.asOf>=base.quote.asOf;
  return {...base,...(newerQuote?{meta:recent.meta,quote:recent.quote,timeZone:recent.timeZone}:{}),bars:[...new Map([...base.bars,...updates].map(bar=>[bar.time,bar])).values()].sort((a,b)=>a.time.localeCompare(b.time)),latestSessionPatched:true};
}
