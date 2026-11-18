import {INTRADAY,parseIntraday} from './intraday-data.js';
import {parseDailyHistory,needsLatestSession,mergeLatestSession,historyQuality} from './history-data.js';
import {RANK_SORTS,scanRequest,scanRows,koreanStock} from './rankings.js';
const HEADERS={'User-Agent':'Mozilla/5.0','Accept':'application/json'};
const json=(data,status=200,fresh=false)=>Response.json(data,{status,headers:{'Cache-Control':status===200&&!fresh?'public, max-age=0, s-maxage=30':'no-store'}});
export function normalizeSymbol(raw,market){
  const value=String(raw||'').trim().toUpperCase();
  if(market==='kr'){
    if(['^KS11','^KQ11'].includes(value))return value;
    if(!/^\d[A-Z0-9]{5}(\.(KS|KQ))?$/.test(value))throw Error('한국 종목은 6자리 코드로 입력해 주세요. 예: 005930');
    const native=koreanStock(value.slice(0,6));
    return native?value.slice(0,6)+(native.exchange==='KOSDAQ'?'.KQ':'.KS'):value.includes('.')?value:value+'.KS';
  }
  if(!/^(\^[A-Z]{2,8}|[A-Z][A-Z0-9.\-]{0,11})$/.test(value))throw Error('올바른 미국 주식 티커를 입력해 주세요. 예: AAPL');
  return value.startsWith('^')?value:value.replaceAll('.','-');
}
async function koreanName(symbol){
  if(!/^\d[A-Z0-9]{5}\.(KS|KQ)$/.test(symbol))return null;
  const native=koreanStock(symbol.slice(0,6));if(native)return native.name;
  try{const response=await fetch(`https://m.stock.naver.com/api/stock/${symbol.slice(0,6)}/basic`,{headers:HEADERS,signal:AbortSignal.timeout(4500)});if(!response.ok)return null;const data=await response.json();return typeof data.stockName==='string'?data.stockName:null;}catch{return null;}
}
async function history(symbol,range='2y'){
  const nativeName=koreanName(symbol);
  let lastError;
  for(const host of ['query1.finance.yahoo.com','query2.finance.yahoo.com']){
    try{
      const response=await fetch(`https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d&events=history&includePrePost=false`,{headers:HEADERS,signal:AbortSignal.timeout(9000),cache:'no-store'});
      if(!response.ok)throw Error(`시세 제공처 응답 ${response.status}`);
      const body=await response.json();let data=parseDailyHistory(body?.chart?.result?.[0],symbol);
      // Yahoo's long daily range can omit the latest day's OHLC while its quote
      // metadata is already current. Fetch actual daily OHLC; never invent a bar.
      if(range!=='1d'&&needsLatestSession(data)){
        try{
          const latest=await fetch(`https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d&events=history&includePrePost=false`,{headers:HEADERS,signal:AbortSignal.timeout(6000),cache:'no-store'});
          if(latest.ok){const latestBody=await latest.json();data=mergeLatestSession(data,parseDailyHistory(latestBody?.chart?.result?.[0],symbol));}
        }catch{/* Preserve verified older history and surface the missing session. */}
      }
      if(!data.bars.length)throw Error('유효한 일봉이 없습니다.');
      const localizedName=await nativeName;
      return {symbol,name:localizedName||data.meta.longName||data.meta.shortName||symbol,koreanName:localizedName,currency:data.meta.currency,bars:data.bars,asOf:data.bars.at(-1).time,quote:data.quote,timeZone:data.timeZone,quality:historyQuality(data),fetchedAt:new Date().toISOString(),source:'Yahoo Finance · 정규장 일봉 · 배당 보정 미적용'};
    }catch(error){lastError=error;}
  }
  throw lastError;
}
async function intraday(symbol,interval){
  const config=INTRADAY[interval];let failure;
  for(const host of ['query1.finance.yahoo.com','query2.finance.yahoo.com']){
    try{const response=await fetch(`https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?range=${config.range}&interval=${config.source}&includePrePost=false`,{headers:HEADERS,signal:AbortSignal.timeout(12000),cache:'no-store'});if(!response.ok)throw Error(`분봉 제공처 응답 ${response.status}`);const body=await response.json(),result=body.chart?.result?.[0];if(!result)throw Error('분봉 자료가 없습니다.');return {...parseIntraday(result,symbol,interval),name:await koreanName(symbol)||result.meta.longName||symbol,fetchedAt:new Date().toISOString()};}catch(error){failure=error;}
  }
  throw failure;
}
async function rankedStocks(market,sort='value',offset=0){
  const response=await fetch(`https://scanner.tradingview.com/${market==='kr'?'korea':'america'}/scan`,{method:'POST',headers:{...HEADERS,'Content-Type':'application/json'},body:JSON.stringify(scanRequest(market,sort,offset)),signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error('종목 목록을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.');
  const body=await response.json(),rows=scanRows(body.data,market);
  if(market==='kr')await Promise.all(rows.filter(row=>!koreanStock(row.ticker)).map(async row=>{const name=await koreanName(row.symbol);if(name)row.name=name;}));
  return {rows,total:body.totalCount,offset,hasMore:rows.length>0&&offset+rows.length<body.totalCount,sort,fetchedAt:new Date().toISOString(),source:`TradingView Stock Screener · ${RANK_SORTS[sort].label} · 개별주식`,currency:market==='kr'?'KRW':'USD'};
}
async function universe(market){
  const result=await rankedStocks(market),rows=result.rows;
  const scores=rows.filter(r=>Number.isFinite(r.return1y)).map(r=>r.return1y).sort((a,b)=>a-b);
  for(const row of rows)row.rsRating=Number.isFinite(row.return1y)&&scores.length>1?Math.round(1+98*scores.filter(n=>n<row.return1y).length/(scores.length-1)):null;
  return {rows,total:result.total,fetchedAt:result.fetchedAt,source:'TradingView Stock Screener · 거래대금 상위 100개 개별주식',rsMethod:'거래대금 TOP100 안의 1년 수익률 백분위. IBD 공식 RS Rating이 아닙니다.'};
}
export async function routeMarket(url){
  const market=url.searchParams.get('market')==='kr'?'kr':'us',reply=(data,status=200)=>json(data,status,url.searchParams.has('fresh'));
  try{
    const action=url.searchParams.get('action')||'history';
    if(action==='universe')return reply(await universe(market));
    if(action==='rankings'){
      const sort=url.searchParams.get('sort')||'value',offset=Number(url.searchParams.get('offset')||0);
      try{scanRequest(market,sort,offset);}catch(error){return reply({error:error.message},400);}
      return reply(await rankedStocks(market,sort,offset));
    }
    if(action!=='history')return reply({error:'지원하지 않는 조회입니다.'},400);
    let symbol;
    try{symbol=normalizeSymbol(url.searchParams.get('symbol'),market);}catch(error){return reply({error:error.message},400);}
    const interval=url.searchParams.get('interval')||'1d';
    if(interval!=='1d'){if(!Object.hasOwn(INTRADAY,interval))return reply({error:'지원하지 않는 분봉 주기입니다.'},400);return reply(await intraday(symbol,interval));}
    const range=url.searchParams.get('range')||'2y';
    if(!['1y','2y','5y','10y'].includes(range))return reply({error:'지원하지 않는 조회 기간입니다.'},400);
    try{return reply(await history(symbol,range));}catch(error){if(market==='kr'&&/^\d[A-Z0-9]{5}(\.KS)?$/.test(url.searchParams.get('symbol')||''))return reply(await history(symbol.replace('.KS','.KQ'),range));throw error;}
  }catch(error){console.error('market-data',error.name,error.message);return reply({error:error.name==='TimeoutError'?'시세 조회 시간이 초과되었습니다. 다시 시도해 주세요.':error.message||'시세를 불러오지 못했습니다.'},502);}
}
