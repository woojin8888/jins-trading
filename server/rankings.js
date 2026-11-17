import koreanStocks from './korean-stocks.json' with {type:'json'};
export const koreanStock=code=>koreanStocks.stocks[code]||null;
export const RANK_SORTS={value:{field:'Value.Traded',direction:'desc',label:'거래대금순'},marketCap:{field:'market_cap_basic',direction:'desc',label:'시가총액순'},gainers:{field:'change',direction:'desc',label:'상승률순'},losers:{field:'change',direction:'asc',label:'하락률순'},volume:{field:'volume',direction:'desc',label:'거래량순'}};
export const SCAN_COLUMNS=['name','description','close','change','volume','Perf.Y','Value.Traded','exchange','sector','SMA50','SMA150','SMA200','price_52_week_high','price_52_week_low','market_cap_basic'];
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
    return {symbol,ticker:d.name,name:native?.name||d.description||d.name,price:d.close,change:d.change,volume:d.volume,return1y:d['Perf.Y'],value:d['Value.Traded'],marketCap:d.market_cap_basic,exchange,sector:d.sector,sma50:d.SMA50,sma150:d.SMA150,sma200:d.SMA200,high:d.price_52_week_high,low:d.price_52_week_low};
  });
}
