import koreanStocks from './korean-stocks.json' with {type:'json'};
export const koreanStock=code=>koreanStocks.stocks[code]||null;
export const RANK_SORTS={value:{field:'Value.Traded',direction:'desc',label:'거래대금순'},marketCap:{field:'market_cap_basic',direction:'desc',label:'시가총액순'},gainers:{field:'change',direction:'desc',label:'상승률순'},losers:{field:'change',direction:'asc',label:'하락률순'},volume:{field:'volume',direction:'desc',label:'거래량순'}};
export const SCAN_COLUMNS=['name','description','close','change','volume','Perf.Y','Value.Traded','exchange','sector','SMA50','SMA150','SMA200','price_52_week_high','price_52_week_low','market_cap_basic','update_mode','time','time|1','currency','current_session','pricescale','minmov'];
export function scanRequest(market,sort='value',offset=0){
  const order=Object.hasOwn(RANK_SORTS,sort)?RANK_SORTS[sort]:null;
  if(!order)throw Error('지원하지 않는 정렬 기준입니다.');
  if(!Number.isInteger(offset)||offset<0||offset>20000||offset%100!==0)throw Error('올바른 목록 페이지를 선택해 주세요.');
  return {filter:[{left:'type',operation:'equal',right:'stock'},...(market==='us'?[{left:'exchange',operation:'in_range',right:['NASDAQ','NYSE','AMEX']}]:[{left:'name',operation:'in_range',right:Object.keys(koreanStocks.stocks)}])],options:{lang:market==='kr'?'ko':'en'},columns:SCAN_COLUMNS,sort:{sortBy:order.field,sortOrder:order.direction},range:[offset,offset+100]};
}
export function scanRows(data,market){
  return (data||[]).map(item=>{
    const d=Object.fromEntries(SCAN_COLUMNS.map((key,i)=>[key,item.d[i]]));
    const native=market==='kr'?koreanStock(d.name):null,exchange=native?.exchange||d.exchange;
    const symbol=market==='kr'?d.name+(String(exchange).includes('KOSDAQ')?'.KQ':'.KS'):d.name.replaceAll('.','-');
    const updateMode=typeof d.update_mode==='string'?d.update_mode:'unknown',delay=/^delayed_streaming_(\d+)$/.exec(updateMode),toISO=seconds=>Number.isFinite(seconds)&&seconds>0?new Date(seconds*1000).toISOString():null;
    return {tickSize:Number.isFinite(d.minmov)&&Number.isFinite(d.pricescale)&&d.pricescale>0?d.minmov/d.pricescale:null,provider:'TradingView Screener',updateMode,delaySeconds:delay?Number(delay[1]):null,barAt:toISO(d.time),quoteBarAt:toISO(d['time|1']),currency:d.currency||null,currentSession:d.current_session||null,symbol,ticker:d.name,name:native?.name||d.description||d.name,price:d.close,change:d.change,volume:d.volume,return1y:d['Perf.Y'],value:d['Value.Traded'],marketCap:d.market_cap_basic,exchange,sector:d.sector,sma50:d.SMA50,sma150:d.SMA150,sma200:d.SMA200,high:d.price_52_week_high,low:d.price_52_week_low};
  });
}
