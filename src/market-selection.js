export function marketFromSearch(search=''){
  const market=new URLSearchParams(search).get('market');return ['us','kr'].includes(market)?market:null;
}
export const validMarketSymbol=(symbol,market)=>typeof symbol==='string'&&(market==='kr'?/^\d[A-Z0-9]{5}(\.(KS|KQ))?$/:/^(\^[A-Z]{2,8}|[A-Z][A-Z0-9.\-]{0,11})$/).test(symbol);
export function paneSymbols(raw={}){
  raw=raw||{};const symbols={us:'',kr:''};for(const market of ['us','kr']){const explicit=raw.symbols?.[market];if(validMarketSymbol(explicit,market))symbols[market]=explicit;else if(validMarketSymbol(raw.symbol,market))symbols[market]=raw.symbol;}return symbols;
}
export function paneSymbol(config,market,fallback){return paneSymbols(config)[market]||fallback;}
