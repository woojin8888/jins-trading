import {marketFromSearch,canonicalMarketSymbol} from './market-selection.js';
import {benchmarkFor} from './instruments.js';

export function stockFromSearch(search=''){
 const params=new URLSearchParams(search),market=marketFromSearch(search),raw=params.get('symbol')||params.get('ticker');if(!market||!raw)return null;
 try{const exchange=(params.get('exchange')||'').toUpperCase();let symbol=canonicalMarketSymbol(raw,market,exchange);
  if(market==='kr'&&/^\d[A-Z0-9]{5}$/.test(symbol)){if(exchange.includes('KOSDAQ'))symbol+='.KQ';else if(exchange.includes('KOSPI'))symbol+='.KS'}
  return {market,symbol,name:(params.get('name')||symbol).replace(/[\u0000-\u001f\u007f]/g,'').slice(0,120),exchange:exchange.slice(0,40)};
 }catch{return null}
}
export function linkedWorkspaceView(savedView,requestedMarket,requestedStock){
 const market=requestedMarket||savedView.market,linked=requestedStock?.market===market?requestedStock:null;
 return {...savedView,market,symbols:linked?{...savedView.symbols,[market]:linked}:savedView.symbols,interval:linked?'D':savedView.interval,benchmarkSymbol:market===savedView.market?savedView.benchmarkSymbol:benchmarkFor(market)};
}

export function fullscreenFromSearch(search=''){return new URLSearchParams(search).get('view')!=='workspace'&&stockFromSearch(search)!==null;}
