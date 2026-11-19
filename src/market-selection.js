import {MARKETS,MARKET_IDS,isMarket,knownAsset} from './instruments.js';
export function marketFromSearch(search=''){const market=new URLSearchParams(search).get('market');return isMarket(market)?market:null;}
export function validMarketSymbol(symbol,market){
 if(typeof symbol!=='string'||!isMarket(market)||symbol.length>20)return false;
 if(['indices','fx','commodities'].includes(market))return knownAsset(symbol)?.market===market;
 if(market==='us'||market==='etf')return /^(\^[A-Z]{2,8}|[A-Z][A-Z0-9.\-]{0,11})$/.test(symbol);
 if(market==='kr')return ['^KS11','^KQ11'].includes(symbol)||/^\d[A-Z0-9]{5}(\.(KS|KQ))?$/.test(symbol);
 if(market==='etfkr')return /^\d[A-Z0-9]{5}\.KS$/.test(symbol);
 const patterns={jp:/^[0-9A-Z]{4}\.T$/,hk:/^\d{4,5}\.HK$/,cn:/^\d{6}\.(SS|SZ)$/,uk:/^[A-Z0-9-]{1,10}\.L$/,de:/^[A-Z0-9-]{1,10}\.DE$/,fr:/^[A-Z0-9-]{1,10}\.PA$/,ca:/^[A-Z0-9-]{1,10}\.TO$/,au:/^[A-Z0-9-]{1,10}\.AX$/,in:/^[A-Z0-9&-]{1,15}\.NS$/,tw:/^[A-Z0-9]{4,8}\.(TW|TWO)$/,sg:/^[A-Z0-9]{2,10}\.SI$/};return patterns[market]?.test(symbol)===true;
}
export function canonicalMarketSymbol(raw,market,exchange=''){
 const symbol=String(raw||'').trim().normalize('NFKC').toUpperCase(),config=MARKETS[market];if(!config)throw Error('지원하지 않는 시장입니다.');
 if(knownAsset(symbol)&&['indices','fx','commodities'].includes(market)){if(validMarketSymbol(symbol,market))return symbol;throw Error('자산 분류를 확인하세요.');}
 if(['indices','fx','commodities'].includes(market))throw Error('검색 목록에서 자산을 선택하세요.');
 if(market==='us'||market==='etf'){const value=symbol.startsWith('^')?symbol:symbol.replaceAll('.','-');if(validMarketSymbol(value,market))return value;}
 if(market==='kr'&&['^KS11','^KQ11'].includes(symbol))return symbol;
 if(market==='kr'&&/^\d[A-Z0-9]{5}(\.(KS|KQ))?$/.test(symbol))return symbol;
 if(market==='etfkr'&&/^\d[A-Z0-9]{5}(\.KS)?$/.test(symbol))return symbol.endsWith('.KS')?symbol:symbol+'.KS';
 if(market==='hk'&&/^\d{1,5}(\.HK)?$/.test(symbol))return String(Number(symbol.replace('.HK',''))).padStart(4,'0')+'.HK';
 if(validMarketSymbol(symbol,market))return symbol;
 let result=symbol;
 if(market==='hk'&&/^\d{1,5}$/.test(symbol))result=symbol.padStart(4,'0')+'.HK';
 else if(market==='cn'&&/^\d{6}$/.test(symbol)){if(!['SSE','SZSE'].includes(exchange))throw Error('중국 코드는 .SS(상하이) 또는 .SZ(선전)를 붙이거나 검색 결과에서 선택하세요.');result+=exchange==='SSE'?'.SS':'.SZ';}
 else if(market==='tw'&&/^[A-Z0-9]{4,8}$/.test(symbol))result+=exchange==='TPEX'?'.TWO':'.TW';
 else if(config.suffix&&!symbol.endsWith(config.suffix))result=symbol.replace(/\.+$/,'').replaceAll('.','-')+config.suffix;
 if(validMarketSymbol(result,market))return result;throw Error(`${config.label} 종목 코드를 확인하세요.`);
}
export function paneSymbols(raw={}){raw=raw||{};const symbols={us:'',kr:''};for(const market of MARKET_IDS){const explicit=raw.symbols?.[market];if(validMarketSymbol(explicit,market))symbols[market]=explicit;}const legacy=MARKET_IDS.find(m=>validMarketSymbol(raw.symbol,m));if(legacy&&!symbols[legacy])symbols[legacy]=raw.symbol;return symbols;}
export function paneSymbol(config,market,fallback){return paneSymbols(config)[market]||fallback;}
