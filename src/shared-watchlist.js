import {stockKey} from './workspace-model.js';

export const SHARED_WATCHLIST_ID='tradingview-341719008';
export const SHARED_WATCHLIST_URL='https://kr.tradingview.com/watchlists/341719008/';
// Public shared list, read 2026-11-24. This is a snapshot, not an account sync.
const native=(source,symbol,market,name)=>({source,symbol,market,name});
const reference=(source,name,reason)=>({source,name,reason});
export const SHARED_WATCHLIST_GROUPS=[
  {name:'매크로',rows:[
    reference('TVC:US10Y','미국 10년 국채 수익률','동일 기준의 수익률 데이터 미연결'),
    native('TVC:DXY','DX-Y.NYB','fx','달러인덱스 DXY'),
    native('FX_IDC:USDKRW','KRW=X','fx','달러 / 원'),
    reference('TVC:USOIL','WTI 원유 · USOIL','TradingView 원유 가격과 현재 제공하는 선물은 다른 상품'),
    reference('OANDA:XAUUSD','금 현물 · XAUUSD','금 현물과 현재 제공하는 금 선물은 다른 상품'),
    native('TVC:VIX','^VIX','indices','변동성 지수 VIX'),
  ]},
  {name:'미국지수',rows:[
    native('AMEX:SPY','SPY','etf','SPDR S&P 500 ETF'),
    native('NASDAQ:QQQ','QQQ','etf','Invesco 나스닥 100 ETF'),
    native('AMEX:IWM','IWM','etf','iShares 러셀 2000 ETF'),
  ]},
  {name:'미국 업종 ETF',rows:[
    native('NASDAQ:SMH','SMH','etf','VanEck 반도체 ETF'),
    native('CBOE:IGV','IGV','etf','iShares 소프트웨어 ETF'),
    native('CBOE:MAGS','MAGS','etf','Roundhill 매그니피센트 7 ETF'),
    native('NASDAQ:CIBR','CIBR','etf','First Trust 사이버보안 ETF'),
    native('NASDAQ:GRID','GRID','etf','First Trust 스마트그리드 ETF'),
    native('AMEX:XLE','XLE','etf','Energy Select Sector ETF'),
    native('AMEX:XBI','XBI','etf','SPDR 바이오테크 ETF'),
  ]},
  {name:'한국/아시아 지수',rows:[
    native('KRX:KOSPI','^KS11','indices','코스피'),
    native('KRX:KOSDAQ','^KQ11','indices','코스닥'),
    native('TVC:NI225','^N225','indices','닛케이 225'),
    native('TWSE:IX0001','^TWII','indices','대만 가권'),
  ]},
  {name:'한국 업종 ETF',rows:[
    native('KRX:091160','091160.KS','etfkr','KODEX 반도체'),
    native('KRX:487240','487240.KS','etfkr','KODEX AI전력핵심설비'),
    native('KRX:305720','305720.KS','etfkr','KODEX 2차전지산업'),
    native('KRX:449450','449450.KS','etfkr','PLUS K방산'),
    native('KRX:466920','466920.KS','etfkr','SOL 조선TOP3플러스'),
  ]},
];
export const sharedNativeRows=()=>SHARED_WATCHLIST_GROUPS.flatMap(group=>group.rows.filter(row=>row.symbol).map(({market,symbol,name})=>({market,symbol,name,group_name:group.name})));
export function sharedWatchlistPlan(watchlist,lists){
  const rows=sharedNativeRows(),existing=new Set(watchlist.map(stockKey));
  if(!lists.some(list=>list.id===SHARED_WATCHLIST_ID)&&lists.length>=20)throw Error('목록은 20개까지 만들 수 있습니다. 사용하지 않는 목록을 삭제한 뒤 다시 시도하세요.');
  return {rows:rows.filter(row=>!existing.has(stockKey(row))),keys:rows.map(stockKey)};
}
