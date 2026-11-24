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
  const coverageWarning=quality.missingSourceBars>0||quality.incompleteGroups>0||quality.providerSessionDiffers;
  const warning=stale||coverageWarning||quality.missingDailyDates?.length>0||quality.missingLatestSession||quality.priceMismatch||quality.dataGap||freshness.invalidTime||freshness.providerDelayed||freshness.viewStale||['currency-mismatch','symbol-mismatch','different-price'].includes(comparison.status)||volume?.different;
  const price=value=>formatPrice(value,latest.currency,quote?.precision??2);
  return <details className={`quote-provenance ${warning?'quote-warning':''}`}><summary>
    <span>{quality.missingDailyDates?.length>0?'일봉 '+quality.missingDailyDates.length+'일 미제공':freshness.viewStale?'화면 갱신 지연':freshness.providerDelayed?'25분 이상 지난 시세':coverageWarning?'정규장 자료 일부 미제공·세션 확인 필요':quality.dataGap?'차트 자료 지연':volume?.different?'거래량 출처 차이':warning?'시세 기준 확인 필요':'제공처 시세 기준'}</span>
    <span>{listQuote?`목록 ${delayLabel(listQuote)}`:'지연 가능 · 실시간 보장 없음'}</span>
    <span>{comparison.status==='within-tick'?'가격 대조 · 1호가 내 일치':comparison.status==='within-precision'?'가격 대조 · 표시 정밀도 내 일치':comparison.status==='different-price'?'가격 대조 · 차이 있음':comparison.status==='same-provider'?'동일 공급처 · 독립 대조 아님':['different-time','different-session','different-session-type'].includes(comparison.status)?'시각·세션 달라 대조 보류':'외부 가격 대조 미확인'}</span>
    <span className="quote-summary-time">가격 기준 {formatQuoteTime(quote?.asOf)} · {elapsedLabel(freshness.ageSeconds)}</span>
    <span>{freshness.marketOpen===false?'거래시간 밖 · 마지막 시세':freshness.marketOpen===true?'제공처 거래시간 중':'거래시간 정보 미제공'}</span>
    <span>{autoRefresh?'1분 자동 갱신':'자동 갱신 꺼짐'}</span><span>상세 보기</span>
  </summary><div className="quote-provenance-body">
    {quality.missingDailyDates?.length>0&&<p role="status">제공처가 날짜는 반환했지만 유효한 OHLC를 제공하지 않은 일봉: {quality.missingDailyDates.join(', ')}. 지표도 실제 받은 봉만 사용하므로 누락이 없는 자료와 계산값이 다를 수 있습니다.</p>}
    {quality.repairedDailyDates?.length>0&&<p>일봉 보완: {quality.repairedDailyDates.join(', ')} · {quality.dailyRepairSource}. 종목과 주변 두 거래일의 가격 단위를 대조한 뒤 빈 날짜만 보완했습니다. 상단 최신 가격과 가격 기준 시각은 기존 제공처 기준입니다.</p>}
    {quality.dailyRepairs?.map(repair=><p key={repair.date}>{repair.date}: {repair.source} · {repair.verifiedWith}. 거래량 {repair.sourceVolume.toLocaleString('ko-KR')}주{repair.volumeDifferent?` · 비교 출처와 거래량 차이${Number.isFinite(repair.volumeDifferencePercent)?' '+repair.volumeDifferencePercent.toFixed(2)+'%':''} (출처별 집계 차이 가능)`:''}. 해당 봉의 OHLC와 거래량은 같은 출처의 원본을 사용합니다.</p>)}
    {stale&&<p role="status">새로고침에 실패해 마지막으로 받은 자료를 표시하고 있습니다.</p>}
    {freshness.invalidTime&&<p role="status">가격 기준 시각이 없거나 유효하지 않아 최신 여부를 확인할 수 없습니다.</p>}
    {freshness.viewStale&&<p role="status">화면을 조회한 지 2분이 넘었습니다. 새로고침하거나 자동 갱신을 켜 주세요.</p>}
    {freshness.providerDelayed&&<p role="status">제공처 거래시간 중이지만 가격 기준 시각이 25분 이상 지났습니다. 지연·중간 휴장·제공처 갱신 상태를 확인해 주세요.</p>}
    {quality.missingLatestSession&&<p role="status">제공처 최신 거래일 {quality.expectedSessionDate}에 비해 차트는 {quality.latestBarDate}까지의 봉만 있습니다.</p>}
    {quality.priceMismatch&&<p role="status">최근 봉 종가와 제공처 최신 시세가 다릅니다. 상단 가격은 최신 시세, 아래 OHLC는 선택한 봉의 값입니다.</p>}
    {quality.dataGap&&<p role="status">제공처 최신 시각에 비해 차트의 마지막 봉 범위가 뒤처져 있습니다. 누락 구간을 임의의 봉으로 채우지 않았습니다.</p>}
    {quality.missingSourceBars>0&&<p role="status">응답에 포함된 거래일의 정규장 시간격자에서 원본 {quality.missingSourceBars.toLocaleString('ko-KR')}봉이 미제공되었습니다 ({quality.affectedSessions.toLocaleString('ko-KR')}개 세션). 거래정지·무체결·제공처 누락 여부는 확정하지 않았으며 0거래량이나 가상 봉으로 채우지 않습니다. 조회 시작 이전과 아직 도달하지 않은 시각은 제외합니다. 지표와 매물대도 제공된 봉만 사용하므로 전체 자료로 계산한 값과 다를 수 있습니다.</p>}
    {quality.incompleteGroups>0&&<p role="status">실제 원본이 끝까지 없는 집계 봉 {quality.incompleteGroups.toLocaleString('ko-KR')}개를 제외했습니다. 일부 데이터만으로 정규장 종료까지 완성된 4시간봉을 만들지 않습니다.</p>}
    {quality.providerSessionDiffers&&<p role="status">제공처의 한국장 세션 종료 표기가 실제 정규장 종료와 다릅니다. 실제 마감까지 원본이 있는지 별도로 확인합니다.</p>}
    <dl><dt>{['stock','etf'].includes(assetKind(history.symbol))?'정규장 최신 시세':'제공처 최신 시세'}</dt><dd>{price(quote?.price)} {latest.currency}</dd>
      <dt>전일 기준값</dt><dd>{price(quote?.previousClose)} {latest.currency} · {assetKind(history.symbol)==='future'?'제공처 전일 정산·종가 기준':assetKind(history.symbol)==='fx'?'제공처 거래일 기준':'정규장 기준'}{!Number.isFinite(quote?.previousClose)&&' · 미제공 시 등락률을 계산하지 않습니다.'}</dd>
      <dt>차트 최근 {barLabel}</dt><dd>{intraday?formatBarTime(history.bars.at(-1)?.time,history.timeZone):history.asOf} · 종가 {formatPrice(history.bars.at(-1)?.close,history.currency,history.quote?.precision??2)} {history.currency}{quality.confirmationPending?' · 제공처 마감 확인 대기':quality.sessionOpen?' · 진행 중':''}</dd>
      <dt>가격 제공처 시각</dt><dd>{formatQuoteTime(quote?.asOf)}</dd><dt>차트 제공처</dt><dd>{history.source||'Yahoo Finance · 정규장 · 배당 미보정'}</dd><dt>차트 조회 시각</dt><dd>{formatQuoteTime(history.fetchedAt)}</dd>
      {intraday&&<><dt>원본 구간 점검</dt><dd>{quality.sourceCoverageChecked?`정규장 시간격자 점검 · 미제공 ${quality.missingSourceBars||0}봉`:'제공처 휴장·중간 휴식 유지 · 전체 구간 완전성 미확인'}</dd></>}
      {listQuote&&<><dt>목록 최근 가격</dt><dd>{formatPrice(listQuote.price,listQuote.currency||history.currency,listQuote.precision??2)} {listQuote.currency||history.currency} · {delayLabel(listQuote)}</dd><dt>목록 가격·최근 1분봉 기준</dt><dd>{formatQuoteTime(listQuote.quoteBarAt||listQuote.asOf)}</dd><dt>목록 제공처</dt><dd>{listQuote.provider||'TradingView Screener'}</dd></>}
    </dl>
    {comparison.status==='within-tick'&&<p>가까운 기준 시각의 두 가격이 표시 정밀도·최소 호가 기준 안에서 일치했습니다. 이 조회의 대조 결과이며 사이트 전체의 장기 정확도를 뜻하지 않습니다.</p>}
    {comparison.status==='within-precision'&&<p>가까운 기준 시각의 두 가격이 표시 정밀도 허용오차 안에서 일치했습니다. 최소 호가를 확인한 결과와 구분하며 장기 정확도를 뜻하지 않습니다.</p>}
    {comparison.status==='same-provider'&&<p>목록과 차트가 같은 시세 공급처이므로 두 화면의 일치를 독립적인 외부 검증으로 계산하지 않습니다.</p>}
    {comparison.status==='different-session'&&<p>최신 시세와 목록의 거래일이 다릅니다 ({comparison.chartDate} / {comparison.listDate}).</p>}
    {comparison.status==='different-time'&&<p>두 출처의 가격 기준 시각이 다릅니다. 동일 순간의 가격 정확도 비교로 보지 않습니다.</p>}
    {comparison.status==='different-session-type'&&<p>목록이 프리·애프터 등 정규장 외 세션이므로 정규장 시세와 대조하지 않습니다.</p>}
    {comparison.status==='symbol-mismatch'&&<p role="status">차트와 목록의 종목 코드가 달라 대조하지 않습니다.</p>}
    {comparison.status==='different-price'&&<p>가까운 기준 시각의 두 출처 가격 차이 {comparison.percent===null?'비교 기준가 0 · 비율 미산출':comparison.percent.toFixed(3)+'%'}. 거래소·반영 시각 차이도 확인해 주세요.</p>}
    {comparison.status==='currency-mismatch'&&<p role="status">차트와 목록의 통화가 달라 가격을 직접 비교할 수 없습니다.</p>}
    {volume?.different&&<p role="status">거래량 출처 차이 {volume.percent===null?'목록 거래량 0 · 비율 미산출':volume.percent.toFixed(3)+'%'} · 차트 {volume.chartVolume.toLocaleString('ko-KR')}, 목록 {volume.listVolume.toLocaleString('ko-KR')}. 차트 지표는 차트에 표시된 봉의 원본 거래량을 사용합니다.</p>}
    {listQuote&&!volume&&<p>거래량은 확정된 같은 거래일·종목·통화와 가까운 기준 시각이 확인된 경우에만 대조합니다. 현재는 대조 조건을 확인하지 못했거나 동일 공급처이므로 거래량 일치 여부를 판정하지 않습니다.</p>}
    <p className="quote-data-note">자동 갱신은 제공처의 시세 지연을 없애지 않습니다. 조회 시각과 가격 기준 시각은 다릅니다. 가격·등락률은 최신 정규장 시세 기준이며 선택 봉의 OHLC·거래량과 구분합니다. 한 봉의 OHLC와 거래량은 같은 출처의 원본을 사용하며, 보완한 과거 봉의 출처와 거래량 차이는 위에 표시합니다.</p>
  </div></details>;
}
