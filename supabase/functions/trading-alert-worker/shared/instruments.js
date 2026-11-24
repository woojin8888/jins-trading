// Shared, public instrument identity. Currency codes describe quote units;
// GBp is pennies and must never silently be treated as GBP pounds.
const country=(label,currency,timeZone,scanner,exchanges,suffix,symbol,name,benchmark)=>({label,currency,timeZone,scanner,exchanges,suffix,kind:'stock',symbol,name,benchmark});
export const MARKETS={
 us:country('미국장','USD','America/New_York','america',['NASDAQ','NYSE','AMEX'],'','NVDA','NVIDIA','SPY'),
 kr:country('한국장','KRW','Asia/Seoul','korea',['KRX'],'','005930.KS','삼성전자','^KS11'),
 jp:country('일본','JPY','Asia/Tokyo','japan',['TSE'],'.T','7203.T','도요타 자동차','^N225'),
 hk:country('홍콩','HKD','Asia/Hong_Kong','hongkong',['HKEX'],'.HK','0700.HK','텐센트','^HSI'),
 cn:country('중국','CNY','Asia/Shanghai','china',['SSE','SZSE'],'','600519.SS','귀주모태','000001.SS'),
 uk:{...country('영국','GBp','Europe/London','uk',['LSE'],'.L','AZN.L','아스트라제네카','^FTSE'),amountCurrency:'GBP'},
 de:country('독일','EUR','Europe/Berlin','germany',['XETR'],'.DE','SAP.DE','SAP','^GDAXI'),
 fr:country('프랑스','EUR','Europe/Paris','france',['EURONEXT'],'.PA','MC.PA','LVMH','^FCHI'),
 ca:country('캐나다','CAD','America/Toronto','canada',['TSX'],'.TO','RY.TO','캐나다 왕립은행','^GSPTSE'),
 au:country('호주','AUD','Australia/Sydney','australia',['ASX'],'.AX','BHP.AX','BHP','^AXJO'),
 in:country('인도','INR','Asia/Kolkata','india',['NSE'],'.NS','RELIANCE.NS','릴라이언스','^NSEI'),
 tw:country('대만','TWD','Asia/Taipei','taiwan',['TWSE','TPEX'],'','2330.TW','TSMC','^TWII'),
 sg:country('싱가포르','SGD','Asia/Singapore','singapore',['SGX'],'.SI','D05.SI','DBS','^STI'),
 etf:{...country('미국 ETF','USD','America/New_York','america',['NASDAQ','NYSE','AMEX'],'','SPY','SPDR S&P 500 ETF','SPY'),kind:'etf'},
 etfkr:{...country('한국 ETF','KRW','Asia/Seoul','korea',['KRX'],'.KS','069500.KS','KODEX 200','^KS11'),kind:'etf'},
 indices:{label:'세계 지수',kind:'index',symbol:'^GSPC',name:'S&P 500',currency:'USD',timeZone:'America/New_York',benchmark:'^GSPC'},
 fx:{label:'달러·환율',kind:'fx',symbol:'KRW=X',name:'달러 / 원',currency:'KRW',timeZone:'Europe/London',benchmark:'DX-Y.NYB'},
 commodities:{label:'금·원유·원자재',kind:'future',symbol:'GC=F',name:'금 선물',currency:'USD',timeZone:'America/New_York',benchmark:'GC=F'},
};
export const MARKET_IDS=Object.keys(MARKETS),isMarket=value=>Object.hasOwn(MARKETS,value),marketLabel=value=>MARKETS[value]?.label||value;
const asset=(market,symbol,name,currency,unit='',aliases='')=>({market,symbol,name,currency,unit,aliases,kind:MARKETS[market].kind});
export const ASSETS=[
 ...[['^GSPC','S&P 500','USD'],['^NDX','나스닥 100','USD'],['^DJI','다우존스 30','USD'],['^IXIC','나스닥 종합','USD'],['^RUT','러셀 2000','USD'],['^VIX','변동성 지수 VIX','USD'],['^KS11','코스피','KRW'],['^KQ11','코스닥','KRW'],['^N225','닛케이 225','JPY'],['^HSI','항셍','HKD'],['000001.SS','상하이 종합','CNY'],['399001.SZ','선전 성분','CNY'],['^FTSE','FTSE 100','GBP'],['^GDAXI','DAX','EUR'],['^FCHI','CAC 40','EUR'],['^GSPTSE','캐나다 TSX 종합','CAD'],['^AXJO','호주 ASX 200','AUD'],['^NSEI','인도 NIFTY 50','INR'],['^TWII','대만 가권','TWD'],['^STI','싱가포르 STI','SGD']].map(([s,n,c])=>asset('indices',s,n,c,'포인트')),
 asset('fx','DX-Y.NYB','달러인덱스 DXY','USD','지수 포인트','dollar index 미국 달러'),
 ...[['KRW=X','달러 / 원','KRW','USD/KRW 원달러 달러원'],['JPY=X','달러 / 엔','JPY','USD/JPY 달러엔'],['EURUSD=X','유로 / 달러','USD','EUR/USD'],['GBPUSD=X','파운드 / 달러','USD','GBP/USD'],['CNY=X','달러 / 위안','CNY','USD/CNY'],['HKD=X','달러 / 홍콩달러','HKD','USD/HKD'],['AUDUSD=X','호주달러 / 달러','USD','AUD/USD'],['CAD=X','달러 / 캐나다달러','CAD','USD/CAD'],['CHF=X','달러 / 스위스프랑','CHF','USD/CHF'],['SGD=X','달러 / 싱가포르달러','SGD','USD/SGD']].map(([s,n,c,a])=>asset('fx',s,n,c,'표시통화 / 기준통화',a)),
 ...[['GC=F','금 선물','트로이온스','gold 골드'],['SI=F','은 선물','트로이온스','silver 실버'],['CL=F','WTI 원유 선물','배럴','oil crude 오일'],['BZ=F','브렌트유 선물','배럴','brent 원유'],['NG=F','천연가스 선물','MMBtu','natural gas'],['HG=F','구리 선물','파운드','copper']].map(([s,n,u,a])=>asset('commodities',s,n,'USD',u,a)),
 ...[['SPY','SPDR S&P 500 ETF'],['QQQ','Invesco 나스닥 100 ETF'],['VOO','Vanguard S&P 500 ETF'],['VTI','Vanguard 미국 전체시장 ETF'],['SMH','VanEck 반도체 ETF'],['SOXX','iShares 반도체 ETF'],['GLD','SPDR 금 ETF'],['TLT','iShares 미국 장기국채 ETF'],['DIA','SPDR 다우 ETF'],['IWM','iShares 러셀 2000 ETF']].map(([s,n])=>asset('etf',s,n,'USD','주')),
 ...[['069500.KS','KODEX 200'],['229200.KS','KODEX 코스닥 150'],['102110.KS','TIGER 200'],['133690.KS','TIGER 미국나스닥 100'],['360750.KS','TIGER 미국 S&P 500']].map(([s,n])=>asset('etfkr',s,n,'KRW','주')),
 ...Object.entries(MARKETS).filter(([,m])=>m.kind==='stock'&&!['미국장','한국장'].includes(m.label)).map(([id,m])=>asset(id,m.symbol,m.name,m.currency,'주')),
];
export const knownAsset=symbol=>ASSETS.find(a=>a.symbol===symbol);
export function assetKind(symbol){return knownAsset(symbol)?.kind||(/=X$/.test(symbol)?'fx':/=F$/.test(symbol)?'future':symbol.startsWith('^')?'index':'stock');}
export function expectedCurrencies(symbol){
 const found=knownAsset(symbol);if(found)return [found.currency];
 if(/=X$/.test(symbol))return [symbol.replace(/=X$/,'').slice(-3)];
 if(/\.(KS|KQ)$/.test(symbol))return ['KRW'];
 if(/\.T$/.test(symbol))return ['JPY'];if(/\.HK$/.test(symbol))return ['HKD'];if(/\.(SS|SZ)$/.test(symbol))return ['CNY'];
 if(/\.L$/.test(symbol))return ['GBp','GBP'];if(/\.(DE|PA)$/.test(symbol))return ['EUR'];if(/\.TO$/.test(symbol))return ['CAD'];if(/\.AX$/.test(symbol))return ['AUD'];if(/\.NS$/.test(symbol))return ['INR'];if(/\.(TW|TWO)$/.test(symbol))return ['TWD'];if(/\.SI$/.test(symbol))return ['SGD'];return ['USD'];
}
export const isIndexAggregateVolume=symbol=>['^GSPC','^NDX','^RUT'].includes(symbol);
export const volumeUnit=symbol=>isIndexAggregateVolume(symbol)?'':assetKind(symbol)==='future'?'계약':'주';
export const hasVolume=symbol=>isIndexAggregateVolume(symbol)||!['index','fx'].includes(assetKind(symbol));
export function reportedVolume(symbol,value){return hasVolume(symbol)&&Number.isFinite(value)&&value>=0&&(!isIndexAggregateVolume(symbol)||value>0)?value:null;}
export const indexVolumeBasis=symbol=>isIndexAggregateVolume(symbol)?{kind:'provider-aggregate',provider:'Yahoo Finance',unit:null,constituentVolumeVerified:false,zeroPolicy:'unconfirmed'}:null;
export const currencyLabel=c=>c==='GBp'?'GBp · 영국 펜스':c||'통화 미제공';
export function formatPrice(value,currency='USD',precision=2){return Number.isFinite(value)?value.toLocaleString('ko-KR',{minimumFractionDigits:0,maximumFractionDigits:Math.min(8,Math.max(0,precision))}):'—';}
export const defaultSymbols=()=>Object.fromEntries(Object.entries(MARKETS).map(([id,m])=>[id,{symbol:m.symbol,name:m.name}]));
export const benchmarkFor=market=>MARKETS[market]?.benchmark||'SPY';
export function assetSearch(query,market){const q=String(query).normalize('NFKC').replace(/\s/g,'').toLowerCase();return ASSETS.filter(a=>(!market||a.market===market)&&`${a.name}${a.symbol}${a.aliases}`.replace(/\s/g,'').toLowerCase().includes(q)).slice(0,20).map(a=>({...a,ticker:a.symbol,exchange:marketLabel(a.market)}));}

export function quoteUnit(symbol,currency){const asset=knownAsset(symbol);return assetKind(symbol)==='index'||symbol==='DX-Y.NYB'?'지수 포인트':assetKind(symbol)==='future'?currencyLabel(currency)+' / '+(asset?.unit||'계약'):currencyLabel(currency);}
