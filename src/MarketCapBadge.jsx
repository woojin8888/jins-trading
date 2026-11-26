import React,{useEffect,useState} from 'react';
import {marketData} from './backend.js';
import {MARKETS,assetKind} from './instruments.js';
import {formatQuoteTime} from './quote-info.js';
import {formatMarketCapKRW} from './market-cap.js';
const pending=new Map();
export function useMarketCap(market,symbol,refresh=0,enabled=true){
 const key=market+':'+symbol,eligible=enabled&&MARKETS[market]?.kind==='stock'&&assetKind(symbol)==='stock';
 const [state,setState]=useState({key:'',status:'loading',data:null});
 useEffect(()=>{
  if(!eligible)return;let active=true;const requestKey=key+':'+refresh;
  setState(previous=>previous.key===key?{...previous,status:'loading'}:{key,status:'loading',data:null});
  if(!pending.has(requestKey)){const request=marketData({action:'capitalization',market,symbol},undefined,refresh>0);pending.set(requestKey,request);request.finally(()=>{if(pending.get(requestKey)===request)pending.delete(requestKey);}).catch(()=>{});}
  pending.get(requestKey).then(data=>{if(active)setState({key,status:data.status,data});}).catch(()=>{if(active)setState({key,status:'unavailable',data:null});});
  return()=>{active=false;};
 },[key,market,symbol,refresh,eligible]);
 return !eligible?null:state.key===key?state:{key,status:'loading',data:null};
}
export default function MarketCapBadge({model}){
 if(!model||model.status==='not-applicable')return null;
 const data=model.data,available=model.status==='available'&&data?.krw>0;
 const title=available?`${data.krw.toLocaleString('ko-KR',{maximumFractionDigits:0})}원 · ${data.source} · 조회 ${formatQuoteTime(data.fetchedAt)} · 제공처 시세 ${formatQuoteTime(data.asOf)}${data.fx?` · 원화 환산 추정 · 환율 ${data.fx.rate.toLocaleString('ko-KR')}원/${data.currency} · 환율 기준 ${formatQuoteTime(data.fx.asOf)}`:''}`:model.status==='loading'?'시가총액 확인 중':data?.reason||'시가총액 자료를 확인하지 못했습니다.';
 return <span className="market-cap-badge" data-status={model.status} title={title} aria-label={`시가총액 ${available?formatMarketCapKRW(data.krw):model.status==='loading'?'확인 중':'자료 없음'}`}><span>시총</span> <b>{available?formatMarketCapKRW(data.krw):model.status==='loading'?'확인 중…':'—'}</b>{available&&data.fx&&<small>환산</small>}</span>;
}
