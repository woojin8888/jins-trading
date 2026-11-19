import React,{useEffect,useMemo,useState} from 'react';
import {ChevronDown,LoaderCircle,RefreshCw,Star} from 'lucide-react';
import {delayLabel,formatQuoteTime} from './quote-info.js';
import {marketData} from './backend.js';
import KoreanBoardSelect from './KoreanBoardSelect.jsx';
import {MARKETS,marketLabel,currencyLabel,formatPrice} from './instruments.js';
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
  return Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:2}).format(n)+' '+(MARKETS[market]?.amountCurrency||MARKETS[market]?.currency||'');
}
function RankingList({market,sort,board='all',onSelect,symbol,watchlist,onWatch,ready,onQuotes,forceRefresh}){
  const [offset,setOffset]=useState(0),[rows,setRows]=useState([]),[info,setInfo]=useState(null),[busy,setBusy]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();setBusy(true);setError('');
    marketData({action:'rankings',market,sort,offset,board:market==='kr'?board:'all'},controller.signal,(retry>0||forceRefresh)).then(data=>{
      if(controller.signal.aborted)return;
      setRows(previous=>[...new Map([...(offset?previous:[]),...data.rows].map(row=>[row.symbol,row])).values()]);setInfo(data);onQuotes?.(data.rows);
    }).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setBusy(false);});
    return()=>controller.abort();
  },[market,sort,board,offset,retry,onQuotes,forceRefresh]);
  const saved=useMemo(()=>new Set(watchlist.map(row=>row.symbol)),[watchlist]);
  return <><div className="ranking-caption"><span>{info?`전체 ${info.total.toLocaleString()}개 · ${rows.length.toLocaleString()}개 표시`:'시장 종목 조회 중'}</span><span>{currencyLabel(MARKETS[market].currency)}</span></div>
    <div className="ranking-columns"><span>종목 / 정렬 지표</span><span>최근 가격 / 등락률</span></div>
    <div className="ranking-list" aria-label="시장 종목 순위" aria-busy={busy}>
      {rows.map((stock,index)=>{const isSaved=saved.has(stock.symbol);return <div className={`ranking-row ${symbol===stock.symbol?'selected':''}`} key={stock.symbol}>
        <span className="ranking-number">{index+1}</span><button className="ranking-security" onClick={()=>onSelect(stock)} aria-label={`${stock.name} ${stock.ticker} 차트 열기`}><span className="ranking-identity"><b>{market==='kr'?stock.name:stock.ticker}</b><small>{market==='kr'?`${stock.ticker} · ${stock.exchange}`:stock.name}</small><em>{sort==='marketCap'?'시총 '+marketAmount(stock.marketCap,market):sort==='volume'?'거래량 '+price(stock.volume,'kr')+'주':'거래대금 '+marketAmount(stock.value,market)}</em></span><span className="ranking-quote" title={`${stock.currency||''} · ${stock.provider||'TradingView Screener'} · ${delayLabel(stock)} · 최근 1분봉 ${formatQuoteTime(stock.quoteBarAt)}`}><b>{formatPrice(stock.price,stock.currency,stock.tickSize>0?Math.min(8,Math.max(0,-Math.floor(Math.log10(stock.tickSize)))):2)}</b><small className={stock.change>=0?'positive':'negative'}>{percent(stock.change)}</small></span></button>
        <button className={`icon-button ranking-star ${isSaved?'star-saved':''}`} aria-label={`${stock.name} 관심종목 ${isSaved?'해제':'추가'}`} disabled={!ready} onClick={()=>onWatch({...stock,market})}><Star size={13} fill={isSaved?'currentColor':'none'}/></button>
      </div>;})}
      {busy&&<div className="ranking-status" role="status"><LoaderCircle size={17} className="spin"/>종목 목록을 불러오는 중…</div>}
      {error&&<div className="ranking-status error-text" role="alert"><span>{error}</span><button onClick={()=>setRetry(n=>n+1)}>다시 시도</button></div>}
      {!busy&&!error&&!rows.length&&<p className="ranking-status">표시할 종목이 없습니다.</p>}
      {!busy&&!error&&info?.hasMore&&<button className="ranking-more" onClick={()=>setOffset(info.offset+100)}><ChevronDown size={15}/>다음 100개 더 보기</button>}
    </div><p className="ranking-source">{MARKETS[market].exchanges?.join('·')} · {MARKETS[market].kind==='etf'?'ETF·상장펀드':'개별주식'}. TradingView Screener{info?.unsupportedCount?` · 코드 변환 미지원 ${info.unsupportedCount}종목 제외`:''} · {info?.rows?.length?[...new Set(info.rows.map(delayLabel))].join(' / '):'지연 시세'}. 최근 1분봉은 각 가격의 도움말에서 확인합니다. {info?.fetchedAt&&`조회 ${new Date(info.fetchedAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}`}</p></>;
}
export default function MarketBrowser({market,refreshTick,board='all',onBoard,boardReady,...props}){
  const [sort,setSort]=useState('value'),[refresh,setRefresh]=useState(0);
  return <section className="market-browser"><div className="section-heading"><h3>{marketLabel(market)} 목록</h3><button className="icon-button" aria-label="시장 종목 목록 새로고침" onClick={()=>setRefresh(n=>n+1)}><RefreshCw size={15}/></button></div>{market==='kr'&&<KoreanBoardSelect value={board} onChange={onBoard} disabled={!boardReady}/>}<div className="ranking-sort"><label htmlFor="market-ranking-sort">정렬</label><select id="market-ranking-sort" value={sort} onChange={e=>setSort(e.target.value)}>{RANKING_OPTIONS.filter(([id])=>MARKETS[market].kind!=='etf'||id!=='marketCap').map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div><RankingList key={`${market}:${board}:${sort}:${refresh}:${refreshTick}`} board={board} market={market} sort={MARKETS[market].kind==='etf'&&sort==='marketCap'?'value':sort} forceRefresh={refresh>0||refreshTick>0} {...props}/></section>;
}
