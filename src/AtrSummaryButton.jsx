import React,{useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {createChart,LineSeries,ColorType} from 'lightweight-charts';
import {formatBarTime} from './timeframes.js';
import {CHART_TIME_ZONE} from './chart-timezone.js';
import './atr-summary.css';
const percent=value=>Number.isFinite(value)?value.toFixed(2)+'%':'—';
const number=value=>Number.isFinite(value)?value.toLocaleString('ko-KR',{maximumFractionDigits:3}):'—';
function AtrTrendChart({points,onHover}){
 const host=useRef(null),runtime=useRef(null);
 useEffect(()=>{
  const chart=createChart(host.current,{autoSize:true,layout:{background:{type:ColorType.Solid,color:'#fff'},textColor:'#738096',fontSize:10},grid:{vertLines:{color:'#f0f3f8'},horzLines:{color:'#f0f3f8'}},rightPriceScale:{borderColor:'#e1e7f0',scaleMargins:{top:.15,bottom:.1}},timeScale:{borderColor:'#e1e7f0',timeVisible:false},localization:{locale:'ko-KR',timeFormatter:time=>formatBarTime(time,CHART_TIME_ZONE)}}),series=chart.addSeries(LineSeries,{color:'#496fb5',lineWidth:2,priceFormat:{type:'custom',minMove:.01,formatter:percent}});
  const move=event=>{const point=event.seriesData.get(series);onHover(point&&Number.isFinite(point.value)?{time:event.time,value:point.value}:null);};chart.subscribeCrosshairMove(move);runtime.current={chart,series};
  return()=>{chart.unsubscribeCrosshairMove(move);chart.remove();runtime.current=null;};
 },[onHover]);
 useEffect(()=>{if(!runtime.current)return;runtime.current.series.setData(points);runtime.current.chart.timeScale().fitContent();host.current.dataset.pointCount=String(points.length);host.current.dataset.lastDate=String(points.at(-1)?.time||'');host.current.dataset.lastValue=String(points.at(-1)?.value??'');onHover(null);},[points,onHover]);
 return <div className="atr-summary-chart" ref={host} aria-label="일봉 ATR% 추이"/>;
}
function AtrSummaryDialog({summary,symbol,onClose,id}){
 const ref=useRef(null),[ready,setReady]=useState(false),[hover,setHover]=useState(null);
 useEffect(()=>{const dialog=ref.current;dialog.showModal();setReady(true);return()=>dialog.close();},[]);
 return <dialog ref={ref} id={id} className="atr-summary-dialog" aria-labelledby={id+'-title'} onCancel={onClose} onClick={event=>{if(event.target===event.currentTarget)onClose();}}>
  <header><h2 id={id+'-title'}>ATR% · 일봉 {summary.period}기간</h2><button type="button" aria-label="ATR% 상세 닫기" autoFocus onClick={onClose}>닫기</button></header>
  <div className="atr-summary-body"><p className="atr-summary-symbol">{symbol} · {summary.replay?'과거 재생 일봉':'제공처 일봉'} 기준</p><div className="atr-summary-current"><strong>{percent(hover?.value??summary.percent)}</strong><span>{hover?formatBarTime(hover.time,CHART_TIME_ZONE):summary.asOf||'기준일 미확인'}{hover?' · 선택 값':summary.forming?' · 장중 일봉 포함':' · 최근 계산 값'}</span></div>
   {summary.stale&&<p className="atr-summary-note" role="status">일봉 갱신에 실패해 마지막으로 조회한 자료를 표시합니다.</p>}
   {summary.points.length>0&&ready?<AtrTrendChart points={summary.points} onHover={setHover}/>:<p className="atr-summary-empty">{summary.status==='invalid'?'ATR%를 계산할 수 있는 일봉 자료가 없습니다.':`최소 ${summary.period+1}개 일봉이 필요합니다. 현재 ${summary.availableBars}개입니다.`}</p>}
   <p className="atr-summary-note">최근 최대 260개 일봉의 ATR% 추이입니다. 봉 주기를 바꿔도 이 버튼은 일봉 기준을 유지합니다.</p>
   <dl><div><dt>ATR ({summary.period}일)</dt><dd>{number(summary.value)} {summary.currency}</dd></div><div><dt>기준 일봉 종가</dt><dd>{number(summary.referenceClose)} {summary.currency}</dd></div><div><dt>계산식</dt><dd>Wilder ATR({summary.period}) ÷ 같은 일봉 종가 × 100</dd></div></dl>
   <details><summary>계산 기준 보기</summary><p>각 일봉의 고가−저가, |고가−직전 종가|, |저가−직전 종가| 중 가장 큰 값을 사용합니다. 처음 {summary.period}개 진폭의 평균에서 시작해 Wilder 방식으로 평활합니다. 일봉 {summary.period+1}개가 있어야 첫 값을 계산하며, 제공되지 않은 날짜는 채우지 않습니다.</p><p>{summary.replay?'리플레이에서 공개된 일봉까지만 계산합니다.':summary.forming?'현재 계산에는 조회 시점의 장중 일봉이 포함되어 값이 변할 수 있습니다.':'마지막으로 제공된 일봉까지 계산합니다.'} 가격 차트의 일반·로그 눈금 선택은 ATR% 계산을 바꾸지 않습니다.</p></details>
  </div>
 </dialog>;
}
export default function AtrSummaryButton({summary,symbol,container}){
 const [open,setOpen]=useState(false),id='atr-summary-'+useId();
 if(!container||!summary)return null;
 return createPortal(<><button type="button" className="atr-summary-trigger" aria-label={`ATR% 상세 보기 · ${percent(summary.percent)}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={id} title={`일봉 ${summary.period}기간 ATR% · ${summary.asOf||'일봉 자료 확인 중'}`} onClick={()=>setOpen(true)}>ATR% {percent(summary.percent)}</button>{open&&<AtrSummaryDialog summary={summary} symbol={symbol} id={id} onClose={()=>setOpen(false)}/>}</>,container);
}
