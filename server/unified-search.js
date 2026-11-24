import {assetSearch,knownAsset,MARKET_IDS} from '../src/instruments.js';
import {canonicalMarketSymbol,validMarketSymbol} from '../src/market-selection.js';
import {koreanStock} from './rankings.js';
import {searchKoreanStocks} from './korean-directory.js';
import etfs from './korean-etfs.json' with {type:'json'};

const US_NAMES=[['NVDA','엔비디아','NVIDIA'],['AAPL','애플','APPLE'],['MSFT','마이크로소프트','MICROSOFT'],['TSLA','테슬라','TESLA'],['AMZN','아마존','AMAZON'],['GOOGL','알파벳 A · 구글','GOOGLE ALPHABET 구글 알파벳'],['GOOG','알파벳 C · 구글','GOOGLE ALPHABET 구글 알파벳'],['META','메타 플랫폼스','META FACEBOOK 페이스북'],['NFLX','넷플릭스','NETFLIX'],['AVGO','브로드컴','BROADCOM'],['AMD','AMD · 에이엠디','ADVANCED MICRO DEVICES 에이엠디'],['PLTR','팔란티어','PALANTIR'],['IONQ','아이온큐','IONQ'],['CPNG','쿠팡','COUPANG'],['RKLB','로켓랩','ROCKET LAB']];
const normalize=value=>String(value||'').normalize('NFKC').replace(/\s/g,'').toUpperCase();
const cache=new Map();
function searchRank(row,q){const exact=[row.symbol,row.ticker,row.name,...(row.searchNames||[])].map(normalize);return exact.includes(q)?0:exact.some(value=>value.startsWith(q))?1:2;}
function finish(rows,q){const unique=[...new Map(rows.map(row=>[row.market+':'+row.symbol,row])).values()];return unique.sort((a,b)=>searchRank(a,q)-searchRank(b,q)).slice(0,25).map(({searchNames,...row})=>row);}

export function classifySearchQuote(quote){
  const symbol=quote?.symbol;if(typeof symbol!=='string'||!['EQUITY','ETF','INDEX','CURRENCY','FUTURE'].includes(quote.quoteType))return null;
  const asset=knownAsset(symbol);let market=asset?.market;
  if(!market&&/\.(KS|KQ)$/.test(symbol))market=quote.quoteType==='ETF'?'etfkr':'kr';
  if(!market)market=MARKET_IDS.filter(id=>!['us','etf','kr','etfkr','indices','fx','commodities'].includes(id)).find(id=>validMarketSymbol(symbol,id));
  if(!market&&['EQUITY','ETF'].includes(quote.quoteType))market=quote.quoteType==='ETF'?'etf':'us';
  if(!market||!validMarketSymbol(symbol,market))return null;
  try{if(canonicalMarketSymbol(symbol,market)!==symbol)return null;}catch{return null;}
  const native=market==='kr'?koreanStock(symbol.slice(0,6)):null;
  if(native&&!symbol.endsWith(native.exchange==='KOSDAQ'?'.KQ':'.KS'))return null;
  return {market,symbol,ticker:market==='kr'||market==='etfkr'?symbol.slice(0,6):symbol,name:[native?.name,market==='etfkr'?etfs.names[symbol.slice(0,6)]:null,asset?.name,quote.longname,quote.shortname,symbol].find(value=>typeof value==='string'&&value).slice(0,200),exchange:native?.exchange||quote.exchDisp||quote.exchange,kind:asset?.kind||(quote.quoteType==='ETF'?'etf':quote.quoteType==='INDEX'?'index':'stock')};
}

export async function searchAllInstruments(query){
  if(typeof query!=='string'||query.length>60)throw Error('검색어는 60자 이하로 입력하세요.');
  const text=query.trim().replace(/^(?:NASDAQ|NYSE|AMEX|KRX|KOSPI|KOSDAQ):/i,''),q=normalize(text);if(!q)return {rows:[],total:0};
  const cached=cache.get(q);if(cached&&Date.now()-cached.at<60000)return cached.value;
  const korean=searchKoreanStocks(text).rows;
  const koreanEtfs=Object.entries(etfs.names).filter(([code,name])=>code.includes(q.replace('.KS',''))||normalize(name).includes(q)).map(([code,name])=>({market:'etfkr',symbol:code+'.KS',ticker:code,name,exchange:'KRX',kind:'etf'})).sort((a,b)=>searchRank(a,q)-searchRank(b,q)).slice(0,25);
  const american=US_NAMES.filter(([symbol,name,aliases])=>normalize(symbol+' '+name+' '+aliases).includes(q)).map(([symbol,name,aliases])=>({market:'us',symbol,ticker:symbol,name,exchange:'미국',kind:'stock',searchNames:[aliases]}));
  const local=[...korean,...koreanEtfs,...american,...assetSearch(text)];
  const exactLocal=local.some(row=>searchRank(row,q)===0);
  if(local.length&&(/[가-힣]/.test(text)||exactLocal))return {rows:finish(local,q),source:'미국·한국·ETF·주요 자산 통합 검색 · 내장 종목 목록'};
  let remote=[],warning='';
  try{
    const response=await fetch('https://query1.finance.yahoo.com/v1/finance/search?'+new URLSearchParams({q:text,quotesCount:'30',newsCount:'0',enableFuzzyQuery:'false'}),{headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(6000)});
    if(!response.ok)throw Error('search unavailable');const data=await response.json();remote=(data.quotes||[]).map(classifySearchQuote).filter(Boolean);
  }catch{if(!local.length)throw Error('통합 검색 제공처에 연결하지 못했습니다. 종목 코드를 직접 입력하거나 다시 시도하세요.');warning='외부 검색에 연결하지 못해 내장 종목 목록을 표시합니다.';}
  const value={rows:finish([...remote,...local],q),source:'미국·한국·해외 시장 통합 검색 · Yahoo Finance 및 내장 목록',warning};
  cache.set(q,{at:Date.now(),value});while(cache.size>100)cache.delete(cache.keys().next().value);
  return value;
}
