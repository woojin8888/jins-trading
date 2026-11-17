import React,{useEffect,useMemo,useState} from 'react';
import {ChevronDown,LoaderCircle,RefreshCw,Star} from 'lucide-react';
import {marketData} from './backend.js';
export const RANKING_OPTIONS=[['value','거래대금순'],['marketCap','시가총액순'],['gainers','상승률순'],['losers','하락률순'],['volume','거래량순']];
const price=(n,market)=>Number.isFinite(n)?n.toLocaleString('ko-KR',{maximumFractionDigits:market==='kr'?0:2}):'—';
const percent=n=>Number.isFinite(n)?`${n>0?'+':''}${n.toFixed(2)}%`:'—';
export function marketAmount(n,market){
  if(!Number.isFinite(n))return '—';
  if(market==='kr'){
    if(n>=1e12)return (n/1e12).toLocaleString('ko-KR',{maximumFractionDigits:2})+'조';
    if(n>=1e8)return (n/1e8).toLocaleString('ko-KR',{maximumFractionDigits:1})+'억';
    if(n>=1e4)return (n/1e4).toLocaleString('ko-KR',{maximumFractionDigits:1})+'만';
    return n.toLocaleString('ko-KR');
  }
  return '$'+Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:2}).format(n);
}
function RankingList({market,sort,onSelect,symbol,watchlist,onWatch,ready,onQuotes,forceRefresh}){
  const [offset,setOffset]=useState(0),[rows,setRows]=useState([]),[info,setInfo]=useState(null),[busy,setBusy]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();setBusy(true);setError('');
    marketData({action:'rankings',market,sort,offset},controller.signal,(retry>0||forceRefresh)).then(data=>{
      if(controller.signal.aborted)return;
      setRows(previous=>[...new Map([...(offset?previous:[]),...data.rows].map(row=>[row.symbol,row])).values()]);setInfo(data);onQuotes?.(data.rows);
    }).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setBusy(false);});
    return()=>controller.abort();
  },[market,sort,offset,retry,onQuotes,forceRefresh]);
  const saved=useMemo(()=>new Set(watchlist.map(row=>row.symbol)),[watchlist]);
  return <><div className="ranking-caption"><span>{info?`전체 ${info.total.toLocaleString()}개 · ${rows.length.toLocaleString()}개 표시`:'시장 종목 조회 중'}</span><span>{market==='kr'?'원화 기준':'USD 기준'}</span></div>
    <div className="ranking-columns"><span>종목 / 정렬 지표</span><span>현재가 / 등락률</span></div>
    <div className="ranking-list" aria-label="시장 종목 순위" aria-busy={busy}>
      {rows.map((stock,index)=>{const isSaved=saved.has(stock.symbol);return <div className={`ranking-row ${symbol===stock.symbol?'selected':''}`} key={stock.symbol}>
        <span className="ranking-number">{index+1}</span><button className="ranking-security" onClick={()=>onSelect(stock)} aria-label={`${stock.name} ${stock.ticker} 차트 열기`}><span className="ranking-identity"><b>{market==='kr'?stock.name:stock.ticker}</b><small>{market==='kr'?`${stock.ticker} · ${stock.exchange}`:stock.name}</small><em>{sort==='marketCap'?'시총 '+marketAmount(stock.marketCap,market):sort==='volume'?'거래량 '+price(stock.volume,'kr')+'주':'거래대금 '+marketAmount(stock.value,market)}</em></span><span className="ranking-quote"><b>{price(stock.price,market)}</b><small className={stock.change>=0?'positive':'negative'}>{percent(stock.change)}</small></span></button>
        <button className={`icon-button ranking-star ${isSaved?'star-saved':''}`} aria-label={`${stock.name} 관심종목 ${isSaved?'해제':'추가'}`} disabled={!ready} onClick={()=>onWatch({...stock,market})}><Star size={13} fill={isSaved?'currentColor':'none'}/></button>
      </div>;})}
      {busy&&<div className="ranking-status" role="status"><LoaderCircle size={17} className="spin"/>종목 목록을 불러오는 중…</div>}
      {error&&<div className="ranking-status error-text" role="alert"><span>{error}</span><button onClick={()=>setRetry(n=>n+1)}>다시 시도</button></div>}
      {!busy&&!error&&!rows.length&&<p className="ranking-status">표시할 종목이 없습니다.</p>}
      {!busy&&!error&&info?.hasMore&&<button className="ranking-more" onClick={()=>setOffset(info.offset+100)}><ChevronDown size={15}/>다음 100개 더 보기</button>}
    </div><p className="ranking-source">{market==='kr'?'코스피·코스닥':'NASDAQ·NYSE·AMEX'} 개별주식 기준 · ETF 제외. 시세는 지연될 수 있습니다. {info?.fetchedAt&&`조회 ${new Date(info.fetchedAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}`}</p></>;
}
export default function MarketBrowser({market,refreshTick,...props}){
  const [sort,setSort]=useState('value'),[refresh,setRefresh]=useState(0);
  return <section className="market-browser"><div className="section-heading"><h3>{market==='kr'?'한국':'미국'} 종목 목록</h3><button className="icon-button" aria-label="시장 종목 목록 새로고침" onClick={()=>setRefresh(n=>n+1)}><RefreshCw size={15}/></button></div><div className="ranking-sort"><label htmlFor="market-ranking-sort">정렬</label><select id="market-ranking-sort" value={sort} onChange={e=>setSort(e.target.value)}>{RANKING_OPTIONS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div><RankingList key={`${market}:${sort}:${refresh}:${refreshTick}`} market={market} sort={sort} forceRefresh={refresh>0||refreshTick>0} {...props}/></section>;
}
