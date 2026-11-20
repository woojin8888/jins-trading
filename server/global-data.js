import {MARKETS,ASSETS,assetSearch,knownAsset,expectedCurrencies} from '../src/instruments.js';
import {canonicalMarketSymbol,validMarketSymbol} from '../src/market-selection.js';
import {searchKoreanStocks} from './korean-directory.js';
import {parseDailyHistory} from './history-data.js';
import etfs from './korean-etfs.json' with {type:'json'};
const headers={'User-Agent':'Mozilla/5.0'},cache=new Map();
export async function searchInstruments(query,market){
 if(typeof query!=='string'||query.length>60)throw Error('검색어는 60자 이하로 입력하세요.');if(!query.trim())return {rows:[],total:0};
 const local=assetSearch(query,market);if(market==='etfkr'){const q=query.replace(/\s/g,'').toUpperCase();const rows=Object.entries(etfs.names).filter(([code,name])=>code.includes(q.replace('.KS',''))||name.replace(/\s/g,'').toUpperCase().includes(q)).sort((a,b)=>Number(b[0]===q||b[1]===query)-Number(a[0]===q||a[1]===query)).slice(0,20).map(([code,name])=>({market,symbol:code+'.KS',ticker:code,name,exchange:'KRX',kind:'etf'}));if(rows.length)return {rows,asOf:etfs.asOf,source:etfs.source};}if(market==='kr'){const result=searchKoreanStocks(query);return {...result,rows:result.rows};}
 if(!MARKETS[market]?.scanner)return {rows:local,total:local.length};
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6000);let remote=[];
 try{const response=await fetch('https://query1.finance.yahoo.com/v1/finance/search?'+new URLSearchParams({q:query,quotesCount:'25',newsCount:'0',enableFuzzyQuery:'false'}),{headers,signal:controller.signal});if(!response.ok)throw Error('검색 제공처 응답 '+response.status);const data=await response.json();
  remote=(data.quotes||[]).filter(q=>q.symbol&&validMarketSymbol(q.symbol,market)&&canonicalMarketSymbol(q.symbol,market)===q.symbol&&(MARKETS[market].kind==='etf'?q.quoteType==='ETF':['EQUITY','ETF','INDEX'].includes(q.quoteType))).map(q=>({market,symbol:q.symbol,ticker:q.symbol,name:knownAsset(q.symbol)?.name||q.longname||q.shortname||q.symbol,exchange:q.exchDisp||q.exchange,kind:q.quoteType==='ETF'?'etf':q.quoteType==='INDEX'?'index':'stock'}));
 }catch(error){if(!local.length&&market!=='etfkr')throw Error('종목 검색을 불러오지 못했습니다. 전체 코드를 입력하거나 다시 시도하세요.');}finally{clearTimeout(timer);}
 return {rows:[...new Map([...local,...remote].map(q=>[q.symbol,q])).values()].slice(0,20),source:'Yahoo Finance 검색 · 주요 자산 이름 목록'};
}
export async function assetQuote(asset,{fresh=false}={}){
 const existing=cache.get(asset.symbol);if(!fresh&&existing&&Date.now()-existing.time<30000)return existing.value;
 let data,failure;
 for(const host of ['query1.finance.yahoo.com','query2.finance.yahoo.com']){
  try{const response=await fetch('https://'+host+'/v8/finance/chart/'+encodeURIComponent(asset.symbol)+'?range=5d&interval=1d&includePrePost=false',{headers,signal:AbortSignal.timeout(7000)});if(!response.ok)throw Error('시세 응답 '+response.status);const body=await response.json();data=parseDailyHistory(body.chart?.result?.[0],asset.symbol);if(!Number.isFinite(data.quote.price)||!data.quote.asOf)throw Error('가격 또는 기준 시각이 없습니다.');break;}catch(error){data=null;failure=error;}
 }
 if(!data)throw failure;
 const last=data.bars.at(-1),price=data.quote.price;
 if(!Number.isFinite(price)||!data.quote.asOf)throw Error('가격 또는 기준 시각이 없습니다.');
 const row={...asset,ticker:asset.symbol,price,change:data.quote.changePercent,previousClose:data.quote.previousClose,previousCloseSource:data.quote.previousCloseSource,precision:data.quote.precision,currency:data.meta.currency,provider:'Yahoo Finance',asOf:data.quote.asOf,quoteBarAt:data.quote.asOf,barAt:data.quote.asOf,delaySeconds:null,volume:last?.time===data.quote.sessionDate?last.volume:null};cache.set(asset.symbol,{time:Date.now(),value:row});while(cache.size>100)cache.delete(cache.keys().next().value);return row;
}
export async function globalAssetRows(market,offset=0,options={}){
 if(!Number.isInteger(offset)||offset<0||offset%8!==0||offset>200)throw Error('올바른 자산 목록 페이지를 선택하세요.');
 const list=ASSETS.filter(a=>a.market===market),page=list.slice(offset,offset+8),rows=new Array(page.length);let cursor=0;
 async function worker(){while(cursor<page.length){const i=cursor++;try{rows[i]=await assetQuote(page[i],options);}catch(error){rows[i]={...page[i],ticker:page[i].symbol,price:null,error:error.message};}}}
 await Promise.all(Array.from({length:Math.min(3,page.length)},worker));return {rows,market,total:list.length,offset,hasMore:offset+8<list.length,fetchedAt:new Date().toISOString(),source:'Yahoo Finance · 주요 자산 시세 · 지연 가능'};
}
