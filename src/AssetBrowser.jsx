import React,{useEffect,useState} from 'react';
import {marketData} from './backend.js';
import {formatPrice,currencyLabel,marketLabel,knownAsset,quoteUnit} from './instruments.js';
import {formatQuoteTime} from './quote-info.js';
export default function AssetBrowser({market,onSelect,symbol,watchlist=[],onWatch,ready,onQuotes,refreshTick=0}){
 const [page,setPage]=useState(0),[retry,setRetry]=useState(0),[state,setState]=useState({key:'',data:null,error:'',busy:true}),key=market+':'+page;
 useEffect(()=>{setPage(0);},[market]);
 useEffect(()=>{const controller=new AbortController();setState({key,data:null,error:'',busy:true});marketData({action:'assets',market,offset:page*8},controller.signal,retry>0||refreshTick>0).then(data=>{if(!controller.signal.aborted){setState({key,data,error:'',busy:false});onQuotes?.(data.rows);}}).catch(e=>{if(!controller.signal.aborted)setState({key,data:null,error:e.message,busy:false});});return()=>controller.abort();},[market,page,retry,refreshTick,onQuotes]);
 const data=state.key===key?state.data:null;
 return <section className="asset-browser"><div className="section-heading"><h3>{marketLabel(market)}</h3><button onClick={()=>setRetry(n=>n+1)}>새로고침</button></div><p className="asset-browser-note">{market==='commodities'?'금·원유 등은 최근월물 선물입니다. 현물 가격과 다르며 계약 교체 시 가격 차이가 생길 수 있습니다.':market==='fx'?'달러인덱스와 통화쌍을 구분합니다. 달러/원은 1달러당 원화 가격입니다.':'실제 지수 · 지연 가능 · 가격 기준 시각 확인'}</p>
 {data?.rows.map(row=><article key={row.symbol} className={row.symbol===symbol?'selected':''}><button className="asset-identity" onClick={()=>onSelect(row)}><b>{row.name}</b><small>{row.symbol} · {row.unit||currencyLabel(row.currency)}</small><strong>{formatPrice(row.price,row.currency,row.precision??(market==='fx'?5:2))} <em>{quoteUnit(row.symbol,row.currency)}</em></strong>{Number.isFinite(row.change)&&<span className={row.change>=0?'positive':'negative'}>{row.change>0?'+':''}{row.change.toFixed(2)}%</span>}<small>{row.error?'조회 실패 · '+row.error:'가격 기준 '+formatQuoteTime(row.asOf)}</small></button>{onWatch&&<button className="asset-watch" disabled={!ready} aria-label={`${row.name} 관심 전환`} onClick={()=>onWatch({...row,market})}>{watchlist.some(w=>w.symbol===row.symbol)?'★':'☆'}</button>}</article>)}
 {state.busy&&<p role="status">실제 시세 조회 중…</p>}{state.error&&<p className="error-text" role="alert">{state.error}</p>}
 <div className="asset-pagination"><button disabled={page===0||state.busy} onClick={()=>setPage(p=>p-1)}>이전</button><span>{page+1}페이지</span><button disabled={!data?.hasMore||state.busy} onClick={()=>setPage(p=>p+1)}>다음</button></div></section>;
}
