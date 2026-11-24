import {koreanDailyFallback} from './korean-history.js';
import {repairKoreanIndexHistory} from './korean-index-repair.js';
import {repairKoreanStockHistory} from './korean-stock-repair.js';
import {searchAllInstruments} from './unified-search.js';
import {INTRADAY,parseIntraday} from './intraday-data.js';
import {parseDailyHistory,needsLatestSession,mergeLatestSession,historyQuality} from './history-data.js';
import {RANK_SORTS,scanRequest,scanRows,koreanStock} from './rankings.js';
import {searchKoreanStocks,validateBoard,KOREAN_BOARDS} from './korean-directory.js';
import {MARKETS,isMarket,knownAsset,assetKind,hasVolume,volumeUnit,marketLabel} from '../src/instruments.js';
import {canonicalMarketSymbol} from '../src/market-selection.js';
import {searchInstruments,globalAssetRows} from './global-data.js';
import etfs from './korean-etfs.json' with {type:'json'};
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
  return canonicalMarketSymbol(value,market);
}
async function koreanName(symbol){
  if(knownAsset(symbol)?.name)return knownAsset(symbol).name;
  if(!/^\d[A-Z0-9]{5}\.(KS|KQ)$/.test(symbol))return null;
  const native=koreanStock(symbol.slice(0,6));if(native)return native.name;if(etfs.names[symbol.slice(0,6)])return etfs.names[symbol.slice(0,6)];
  try{const response=await fetch(`https://m.stock.naver.com/api/stock/${symbol.slice(0,6)}/basic`,{headers:HEADERS,signal:AbortSignal.timeout(4500)});if(!response.ok)return null;const data=await response.json();return typeof data.stockName==='string'?data.stockName:null;}catch{return null;}
}
async function history(symbol,range='2y',marketForSymbolCheck=null){
  const nativeName=koreanName(symbol);
  let lastError;
  for(const host of ['query1.finance.yahoo.com','query2.finance.yahoo.com']){
    try{
      const response=await fetch(`https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d&events=history&includePrePost=false`,{headers:HEADERS,signal:AbortSignal.timeout(9000),cache:'no-store'});
      if(!response.ok)throw Error(`시세 제공처 응답 ${response.status}`);
      const body=await response.json();let data=parseDailyHistory(body?.chart?.result?.[0],symbol);if(marketForSymbolCheck?.kind==='etf'&&data.meta.instrumentType&&data.meta.instrumentType!=='ETF')throw Error('이 코드는 ETF가 아닙니다. 해당 주식 시장에서 선택하세요.');
      // Yahoo's long daily range can omit the latest day's OHLC while its quote
      // metadata is already current. Fetch actual daily OHLC; never invent a bar.
      if(range!=='1d'&&needsLatestSession(data)){
        for(const recentHost of [host,...['query1.finance.yahoo.com','query2.finance.yahoo.com'].filter(value=>value!==host)]){
          try{
            const latest=await fetch(`https://${recentHost}/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d&events=history&includePrePost=false`,{headers:HEADERS,signal:AbortSignal.timeout(6000),cache:'no-store'});
            if(latest.ok){const latestBody=await latest.json();data=mergeLatestSession(data,parseDailyHistory(latestBody?.chart?.result?.[0],symbol));}
          }catch{/* Preserve verified older history and surface the missing session. */}
          if(!needsLatestSession(data))break;
        }
      }
      if(!data.bars.length)throw Error('유효한 일봉이 없습니다.');
      data=await repairKoreanIndexHistory(data,symbol);
      data=await repairKoreanStockHistory(data,symbol);
      const localizedName=await nativeName;
      return {symbol,assetType:assetKind(symbol),volumeUnit:volumeUnit(symbol),unit:knownAsset(symbol)?.unit||'',name:localizedName||data.meta.longName||data.meta.shortName||symbol,koreanName:localizedName,currency:data.meta.currency,bars:data.bars,volumeBasis:data.volumeBasis,asOf:data.bars.at(-1).time,quote:data.quote,timeZone:data.timeZone,quality:{...historyQuality(data),volumeUnavailable:!hasVolume(symbol)},fetchedAt:new Date().toISOString(),source:'Yahoo Finance · 제공처 세션 일봉 · 배당 보정 미적용'+(data.volumeBasis?' · 지수 거래량: 제공처 집계 · 단위/구성종목 범위 미확인':'')+(data.dailyRepairSource?' · 누락 일봉 보완: '+data.dailyRepairSource:'')};
    }catch(error){lastError=error;}
  }
  if(marketForSymbolCheck?.kind==='stock'&&/^\d{6}\.(KS|KQ)$/.test(symbol)){const fallback=await koreanDailyFallback(symbol,await nativeName);if(fallback)return fallback;}
  throw lastError;
}
async function intraday(symbol,interval,requestedMarket){
  const config=INTRADAY[interval];let failure;
  for(const host of ['query1.finance.yahoo.com','query2.finance.yahoo.com']){
    try{const response=await fetch(`https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?range=${config.range}&interval=${config.source}&includePrePost=false&includeTradingPeriods=true`,{headers:HEADERS,signal:AbortSignal.timeout(12000),cache:'no-store'});if(!response.ok)throw Error(`분봉 제공처 응답 ${response.status}`);const body=await response.json(),result=body.chart?.result?.[0];if(!result)throw Error('분봉 자료가 없습니다.');if(requestedMarket?.kind==='etf'&&result.meta?.instrumentType&&result.meta.instrumentType!=='ETF')throw Error('이 코드는 ETF가 아닙니다.');return {...parseIntraday(result,symbol,interval),assetType:assetKind(symbol),volumeUnit:volumeUnit(symbol),unit:knownAsset(symbol)?.unit||'',name:await koreanName(symbol)||result.meta.longName||symbol,fetchedAt:new Date().toISOString()};}catch(error){failure=error;}
  }
  throw failure;
}
async function rankedStocks(market,sort='value',offset=0,board='all'){
  const response=await fetch(`https://scanner.tradingview.com/${MARKETS[market].scanner}/scan`,{method:'POST',headers:{...HEADERS,'Content-Type':'application/json'},body:JSON.stringify(scanRequest(market,sort,offset,board)),signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error('종목 목록을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.');
  const body=await response.json(),rows=scanRows(body.data,market);
  if(market==='kr')await Promise.all(rows.filter(row=>!koreanStock(row.ticker)).map(async row=>{const name=await koreanName(row.symbol);if(name)row.name=name;}));
  return {rows,market,board,total:body.totalCount,offset,hasMore:offset+100<body.totalCount,unsupportedCount:(body.data?.length||0)-rows.length,sort,fetchedAt:new Date().toISOString(),source:`TradingView Stock Screener · ${RANK_SORTS[sort].label} · ${MARKETS[market].kind==='etf'?'ETF':'개별주식'}`,currency:MARKETS[market].currency};
}
async function universe(market,board='all'){
  if(!MARKETS[market].scanner)return {market,board:'all',rows:[],total:0,source:'주요 자산 탐색'};
  const result=await rankedStocks(market,'value',0,board),rows=result.rows;
  const scores=rows.filter(r=>Number.isFinite(r.return1y)).map(r=>r.return1y).sort((a,b)=>a-b);
  for(const row of rows)row.rsRating=Number.isFinite(row.return1y)&&scores.length>1?Math.round(1+98*scores.filter(n=>n<row.return1y).length/(scores.length-1)):null;
  return {rows,market,board,total:result.total,fetchedAt:result.fetchedAt,source:`TradingView Stock Screener · ${market==='kr'?KOREAN_BOARDS[board]+' · ':''}${marketLabel(market)} 거래대금 상위 100개 ${MARKETS[market].kind==='etf'?'ETF':'개별주식'}`,rsMethod:'거래대금 TOP100 안의 1년 수익률 백분위. IBD 공식 RS Rating이 아닙니다.'};
}
export async function routeMarket(url){
  const market=url.searchParams.get('market')||'us',reply=(data,status=200)=>json(data,status,url.searchParams.has('fresh'));
  try{
    if(!isMarket(market))return reply({error:'지원하지 않는 시장입니다.'},400);
    const action=url.searchParams.get('action')||'history';
    const board=url.searchParams.get('board')||'all';
    try{validateBoard(market,board);}catch(error){return reply({error:error.message},400);}
    if(action==='assets')return reply(await globalAssetRows(market,Number(url.searchParams.get('offset')||0),{fresh:url.searchParams.has('fresh')}));
    if(action==='search'){try{return reply(await (url.searchParams.get('scope')==='all'?searchAllInstruments(url.searchParams.get('q')||''):searchInstruments(url.searchParams.get('q')||'',market)));}catch(error){return reply({error:error.message},400);}}
    if(action==='universe')return reply(await universe(market,board));
    if(action==='rankings'){
      const sort=url.searchParams.get('sort')||'value',offset=Number(url.searchParams.get('offset')||0);
      try{scanRequest(market,sort,offset,board);}catch(error){return reply({error:error.message},400);}
      return reply(await rankedStocks(market,sort,offset,board));
    }
    if(action!=='history')return reply({error:'지원하지 않는 조회입니다.'},400);
    let symbol;
    try{symbol=normalizeSymbol(url.searchParams.get('symbol'),market);}catch(error){return reply({error:error.message},400);}
    const interval=url.searchParams.get('interval')||'1d';
    if(interval!=='1d'){if(!Object.hasOwn(INTRADAY,interval))return reply({error:'지원하지 않는 분봉 주기입니다.'},400);return reply(await intraday(symbol,interval,MARKETS[market]));}
    const range=url.searchParams.get('range')||'2y';
    if(!['1y','2y','5y','10y'].includes(range))return reply({error:'지원하지 않는 조회 기간입니다.'},400);
    try{return reply(await history(symbol,range,MARKETS[market]));}catch(error){if(market==='kr'&&/^\d[A-Z0-9]{5}(\.KS)?$/.test(url.searchParams.get('symbol')||''))return reply(await history(symbol.replace('.KS','.KQ'),range,MARKETS[market]));throw error;}
  }catch(error){console.error('market-data',error.name,error.message);return reply({error:error.name==='TimeoutError'?'시세 조회 시간이 초과되었습니다. 다시 시도해 주세요.':error.message||'시세를 불러오지 못했습니다.'},502);}
}
