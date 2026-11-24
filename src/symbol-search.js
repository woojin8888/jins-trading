import {knownAsset,MARKET_IDS,MARKETS} from './instruments.js';
import {canonicalMarketSymbol,validMarketSymbol} from './market-selection.js';

export function directSearchTarget(raw){
  const text=String(raw).trim().normalize('NFKC').toUpperCase(),parts=text.split(':'),prefix=parts.length===2?parts[0]:'',symbol=parts.at(-1);
  if(parts.length>2)return null;
  if(prefix&&!['NASDAQ','NYSE','AMEX','KRX','KOSPI','KOSDAQ'].includes(prefix))return null;
  const asset=knownAsset(symbol)||(/^\d{6}$/.test(symbol)?knownAsset(symbol+'.KS'):null);if(asset)return {...asset};
  let market;
  if(/^(?:\d[A-Z0-9]{5})(?:\.(KS|KQ))?$/.test(symbol))market='kr';
  else market=MARKET_IDS.filter(id=>!['us','etf','kr','etfkr','indices','fx','commodities'].includes(id)).find(id=>validMarketSymbol(symbol,id));
  if(!market&&/^[A-Z][A-Z0-9.\-]{0,11}$/.test(symbol))market='us';
  if(!market||prefix&&!['NASDAQ','NYSE','AMEX','KRX','KOSPI','KOSDAQ'].includes(prefix))return null;
  if(prefix&&['KRX','KOSPI','KOSDAQ'].includes(prefix)&&market!=='kr')return null;
  try{return {market,symbol:canonicalMarketSymbol(symbol,market),name:symbol,exchange:MARKETS[market].label};}catch{return null;}
}
