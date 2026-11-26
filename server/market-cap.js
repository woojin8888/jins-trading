import {MARKETS,assetKind} from '../src/instruments.js';
import {assetQuote} from './global-data.js';
const cache=new Map(),TTL=300000;
const COLUMNS=['name','currency','market_cap_basic','type','time'];
export function capitalizationRequest(market,symbol){
 const config=MARKETS[market];if(!config?.scanner||config.kind!=='stock'||assetKind(symbol)!=='stock')return null;
 const name=symbol.replace(/\.(KS|KQ|T|HK|SS|SZ|L|DE|PA|TO|AX|NS|TW|TWO|SI)$/,'');
 const names=[...new Set([name,...(market==='us'?[name.replaceAll('-','.')]:[]),...(market==='hk'?[String(Number(name))]:[])])];
 const exchanges=market==='kr'?['KRX']:market==='cn'?[symbol.endsWith('.SS')?'SSE':'SZSE']:market==='tw'?[symbol.endsWith('.TWO')?'TPEX':'TWSE']:config.exchanges;
 return {symbols:{tickers:exchanges.flatMap(exchange=>names.map(name=>exchange+':'+name))},columns:COLUMNS,options:{lang:market==='kr'?'ko':'en'}};
}
export async function marketCapitalization(market,symbol,{fresh=false}={}){
 const request=capitalizationRequest(market,symbol),key=market+':'+symbol;
 if(!request)return {market,symbol,status:'not-applicable',krw:null};
 const saved=cache.get(key);if(!fresh&&saved&&Date.now()-saved.time<TTL)return saved.value;
 const response=await fetch(`https://scanner.tradingview.com/${MARKETS[market].scanner}/scan`,{method:'POST',headers:{'User-Agent':'Mozilla/5.0','Content-Type':'application/json'},body:JSON.stringify(request),signal:AbortSignal.timeout(9000)});
 if(!response.ok)throw Error('시가총액 자료를 불러오지 못했습니다.');
 const body=await response.json(),rows=(body.data||[]).filter(row=>request.symbols.tickers.includes(row.s));
 if(rows.length!==1)return {market,symbol,status:'unavailable',krw:null,reason:'종목의 시가총액을 확인하지 못했습니다.'};
 const row=Object.fromEntries(COLUMNS.map((name,index)=>[name,rows[0].d?.[index]]));
 if(row.type!=='stock')return {market,symbol,status:'not-applicable',krw:null};
 const allowedCurrencies=market==='uk'?['GBX','GBp','GBP']:[MARKETS[market].currency];
 if(!allowedCurrencies.includes(row.currency))return {market,symbol,status:'unavailable',krw:null,reason:'시가총액 자료의 통화를 확인하지 못했습니다.'};
 const currency=MARKETS[market].amountCurrency||row.currency;
 const result={market,symbol,status:'unavailable',nativeValue:Number.isFinite(row.market_cap_basic)&&row.market_cap_basic>0?row.market_cap_basic:null,currency,krw:null,source:'TradingView Screener',sourceSymbol:rows[0].s,asOf:Number.isFinite(row.time)&&row.time>0?new Date(row.time*1000).toISOString():null,fetchedAt:new Date().toISOString(),fx:null};
 if(!result.nativeValue||!/^[A-Z]{3}$/.test(currency||''))return result;
 if(currency==='KRW'){result.krw=result.nativeValue;result.status='available';}
 else{
  try{
   const fxSymbol=currency==='USD'?'KRW=X':currency+'KRW=X',fx=await assetQuote({symbol:fxSymbol,market:'fx',kind:'fx',currency:'KRW'},{fresh});
   if(fx.currency!=='KRW'||!Number.isFinite(fx.price)||fx.price<=0||!fx.asOf)throw Error('원화 환율을 확인하지 못했습니다.');
   result.fx={symbol:fxSymbol,rate:fx.price,asOf:fx.asOf,source:fx.provider};result.krw=result.nativeValue*fx.price;result.status=Number.isFinite(result.krw)&&result.krw>0?'available':'unavailable';
  }catch{result.reason='원화 환산에 필요한 환율을 확인하지 못했습니다.';}
 }
 cache.set(key,{time:Date.now(),value:result});while(cache.size>100)cache.delete(cache.keys().next().value);
 return result;
}
