import React from 'react';
import {delayLabel,formatQuoteTime,quoteComparison} from './quote-info.js';
const price=(value,currency)=>Number.isFinite(value)?value.toLocaleString('ko-KR',{maximumFractionDigits:currency==='KRW'?0:2}):'미제공';
export default function QuoteInfo({history,listQuote,stale=false,autoRefresh=false}){
  if(!history)return null;
  const quality=history.quality||{},comparison=quoteComparison(history,listQuote),warning=stale||quality.missingLatestSession||quality.priceMismatch||comparison.status==='currency-mismatch';
  return <details className={`quote-provenance ${warning?'quote-warning':''}`}><summary><span>{warning?'시세 확인 필요':'정규장 일봉 기준'}</span><span>{listQuote?`목록 ${delayLabel(listQuote)}`:'지연 가능 · 실시간 보장 없음'}</span><span className="quote-summary-time">가격 기준 {formatQuoteTime(history.quote?.asOf)}</span><span>{autoRefresh?'1분 자동 갱신':'자동 갱신 꺼짐'}</span><span>시세 기준 확인</span></summary><div className="quote-provenance-body">
    {stale&&<p role="status">새로고침에 실패해 마지막으로 받은 자료를 표시하고 있습니다.</p>}
    {quality.missingLatestSession&&<p role="status">최신 거래일 {quality.expectedSessionDate}의 일봉이 누락됐습니다. 차트는 {quality.latestBarDate}까지의 유효한 봉만 표시합니다.</p>}
    {quality.priceMismatch&&<p role="status">제공처의 최신 가격과 최근 봉의 종가가 다릅니다. 아래 기준 시각을 확인해 주세요.</p>}
    <dl><dt>차트 최근 일봉</dt><dd>{history.asOf} · {price(history.bars.at(-1)?.close,history.currency)} {history.currency||''}{quality.sessionOpen?' · 장중 변동 가능':''}</dd><dt>가격 제공 시각</dt><dd>{formatQuoteTime(history.quote?.asOf)}</dd><dt>차트 제공처</dt><dd>Yahoo Finance · 정규장 · 배당 미보정</dd><dt>차트 조회 시각</dt><dd>{formatQuoteTime(history.fetchedAt)}</dd>
      {listQuote&&<><dt>목록 최근 가격</dt><dd>{price(listQuote.price,listQuote.currency||history.currency)} {listQuote.currency||history.currency} · {delayLabel(listQuote)}</dd><dt>목록 최근 1분봉</dt><dd>{formatQuoteTime(listQuote.quoteBarAt)}</dd><dt>목록 제공처</dt><dd>TradingView Screener</dd></>}
    </dl>
    {comparison.status==='different-session'&&<p>차트와 목록의 거래일이 다릅니다 ({comparison.chartDate} / {comparison.listDate}).</p>}
    {comparison.status==='different-price'&&<p>두 가격 차이 {comparison.percent.toFixed(3)}%. 제공처와 반영 시각이 달라 값이 다를 수 있습니다.</p>}
    {comparison.status==='currency-mismatch'&&<p role="status">차트와 목록의 통화가 달라 가격을 직접 비교할 수 없습니다.</p>}
    <p className="quote-data-note">지연 시간은 목록 제공처의 표시입니다. 차트의 지연 시간은 보장되지 않으며 가격 제공 시각으로 확인합니다. 목록의 1분봉 시각은 최종 체결 시각과 다를 수 있습니다. 조회 시각은 가격의 기준 시각이 아닙니다.</p>
  </div></details>;
}
