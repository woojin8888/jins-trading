import React from 'react';
import {timeframeLabel,formatBarTime} from './timeframes.js';
import {delayLabel,formatQuoteTime,quoteComparison,quoteFreshness,elapsedLabel,volumeComparison} from './quote-info.js';
import {formatPrice,assetKind} from './instruments.js';
import {useMarketClock} from './useMarketClock.js';
export default function QuoteInfo({history,quoteHistory,dailyHistory,listQuote,stale=false,autoRefresh=false}){
  const now=useMarketClock();
  if(!history)return null;
  const latest=quoteHistory||history,quote=latest.quote,quality=history.quality||{},freshness=quoteFreshness(latest,now);
  const intraday=!!quality.intraday,barLabel=intraday?timeframeLabel(history.interval)+'봉':'일봉';
  const comparison=quoteComparison(latest,listQuote),volume=volumeComparison(dailyHistory||history,listQuote);
  const warning=stale||quality.missingLatestSession||quality.priceMismatch||quality.dataGap||freshness.invalidTime||freshness.providerDelayed||freshness.viewStale||comparison.status==='currency-mismatch'||volume?.different;
  const price=value=>formatPrice(value,latest.currency,quote?.precision??2);
  return <details className={`quote-provenance ${warning?'quote-warning':''}`}><summary>
    <span>{freshness.viewStale?'화면 갱신 지연':freshness.providerDelayed?'25분 이상 지난 시세':quality.dataGap?'차트 자료 지연':volume?.different?'거래량 출처 차이':warning?'시세 기준 확인 필요':'제공처 시세 기준'}</span>
    <span>{listQuote?`목록 ${delayLabel(listQuote)}`:'지연 가능 · 실시간 보장 없음'}</span>
    <span>{comparison.status==='within-tick'?'가격 대조 · 1호가 내 일치':comparison.status==='different-price'?'가격 대조 · 차이 있음':comparison.status==='same-provider'?'동일 공급처 · 독립 대조 아님':['different-time','different-session'].includes(comparison.status)?'시각·세션 달라 대조 보류':'외부 가격 대조 미확인'}</span>
    <span className="quote-summary-time">가격 기준 {formatQuoteTime(quote?.asOf)} · {elapsedLabel(freshness.ageSeconds)}</span>
    <span>{freshness.marketOpen===false?'거래시간 밖 · 마지막 시세':freshness.marketOpen===true?'제공처 거래시간 중':'거래시간 정보 미제공'}</span>
    <span>{autoRefresh?'1분 자동 갱신':'자동 갱신 꺼짐'}</span><span>상세 보기</span>
  </summary><div className="quote-provenance-body">
    {stale&&<p role="status">새로고침에 실패해 마지막으로 받은 자료를 표시하고 있습니다.</p>}
    {freshness.invalidTime&&<p role="status">가격 기준 시각이 없거나 유효하지 않아 최신 여부를 확인할 수 없습니다.</p>}
    {freshness.viewStale&&<p role="status">화면을 조회한 지 2분이 넘었습니다. 새로고침하거나 자동 갱신을 켜 주세요.</p>}
    {freshness.providerDelayed&&<p role="status">제공처 거래시간 중이지만 가격 기준 시각이 25분 이상 지났습니다. 지연·중간 휴장·제공처 갱신 상태를 확인해 주세요.</p>}
    {quality.missingLatestSession&&<p role="status">제공처 최신 거래일 {quality.expectedSessionDate}에 비해 차트는 {quality.latestBarDate}까지의 봉만 있습니다.</p>}
    {quality.priceMismatch&&<p role="status">최근 봉 종가와 제공처 최신 시세가 다릅니다. 상단 가격은 최신 시세, 아래 OHLC는 선택한 봉의 값입니다.</p>}
    {quality.dataGap&&<p role="status">제공처 최신 시각에 비해 차트의 마지막 봉 범위가 뒤처져 있습니다. 누락 구간을 임의의 봉으로 채우지 않았습니다.</p>}
    <dl><dt>{['stock','etf'].includes(assetKind(history.symbol))?'정규장 최신 시세':'제공처 최신 시세'}</dt><dd>{price(quote?.price)} {latest.currency}</dd>
      <dt>전일 기준값</dt><dd>{price(quote?.previousClose)} {latest.currency} · {assetKind(history.symbol)==='future'?'제공처 전일 정산·종가 기준':assetKind(history.symbol)==='fx'?'제공처 거래일 기준':'정규장 기준'}{!Number.isFinite(quote?.previousClose)&&' · 미제공 시 등락률을 계산하지 않습니다.'}</dd>
      <dt>차트 최근 {barLabel}</dt><dd>{intraday?formatBarTime(history.bars.at(-1)?.time,history.timeZone):history.asOf} · 종가 {formatPrice(history.bars.at(-1)?.close,history.currency,history.quote?.precision??2)} {history.currency}{quality.confirmationPending?' · 제공처 마감 확인 대기':quality.sessionOpen?' · 진행 중':''}</dd>
      <dt>가격 제공처 시각</dt><dd>{formatQuoteTime(quote?.asOf)}</dd><dt>차트 제공처</dt><dd>{history.source||'Yahoo Finance · 정규장 · 배당 미보정'}</dd><dt>차트 조회 시각</dt><dd>{formatQuoteTime(history.fetchedAt)}</dd>
      {listQuote&&<><dt>목록 최근 가격</dt><dd>{formatPrice(listQuote.price,listQuote.currency||history.currency,listQuote.precision??2)} {listQuote.currency||history.currency} · {delayLabel(listQuote)}</dd><dt>목록 가격·최근 1분봉 기준</dt><dd>{formatQuoteTime(listQuote.quoteBarAt||listQuote.asOf)}</dd><dt>목록 제공처</dt><dd>{listQuote.provider||'TradingView Screener'}</dd></>}
    </dl>
    {comparison.status==='within-tick'&&<p>가까운 기준 시각의 두 가격이 표시 정밀도·최소 호가 기준 안에서 일치했습니다. 이 조회의 대조 결과이며 사이트 전체의 장기 정확도를 뜻하지 않습니다.</p>}
    {comparison.status==='same-provider'&&<p>목록과 차트가 같은 시세 공급처이므로 두 화면의 일치를 독립적인 외부 검증으로 계산하지 않습니다.</p>}
    {comparison.status==='different-session'&&<p>최신 시세와 목록의 거래일이 다릅니다 ({comparison.chartDate} / {comparison.listDate}).</p>}
    {comparison.status==='different-time'&&<p>두 출처의 가격 기준 시각이 다릅니다. 동일 순간의 가격 정확도 비교로 보지 않습니다.</p>}
    {comparison.status==='different-price'&&<p>가까운 기준 시각의 두 출처 가격 차이 {comparison.percent.toFixed(3)}%. 거래소·반영 시각 차이도 확인해 주세요.</p>}
    {comparison.status==='currency-mismatch'&&<p role="status">차트와 목록의 통화가 달라 가격을 직접 비교할 수 없습니다.</p>}
    {volume?.different&&<p role="status">거래량 출처 차이 {volume.percent.toFixed(3)}% · 차트 {volume.chartVolume.toLocaleString('ko-KR')}, 목록 {volume.listVolume.toLocaleString('ko-KR')}. 차트 지표는 Yahoo 봉 거래량을 사용합니다.</p>}
    <p className="quote-data-note">자동 갱신은 제공처의 시세 지연을 없애지 않습니다. 조회 시각과 가격 기준 시각은 다릅니다. 가격·등락률은 최신 정규장 시세 기준이며 선택 봉의 OHLC·거래량과 구분합니다. 거래량 집계와 배당·분할 보정 기준이 다른 출처의 숫자를 섞어 지표를 보정하지 않습니다.</p>
  </div></details>;
}
