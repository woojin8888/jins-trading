import React,{useEffect,useState} from 'react';
import {formatBarTime} from './timeframes.js';
import {CHART_TIME_ZONE} from './chart-timezone.js';
import {learningGeometry} from './trend-rendering.js';
export {paintLearning} from './trend-rendering.js';

function useChartRevision(api){
  const [,setRevision]=useState(0);
  useEffect(()=>{if(!api)return;const update=()=>setRevision(n=>n+1);api.drawingListeners.add(update);update();return()=>api.drawingListeners.delete(update);},[api]);
}
export function TrendLearningLayer({api}){
  useChartRevision(api);
  if(!api||api.disposed||!api.data.length)return null;
  const width=api.chart.timeScale().width(),height=api.chart.panes()[0].getHeight(),rows=learningGeometry(api);api.learningRendered=rows;
  if(!rows.length)return null;
  return <svg className="trend-learning-layer" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-label="점선 추세선의 이동 구간과 저점 확인 표시">
    {rows.map(row=><g key={row.id} data-study-id={row.id}>
      {!!row.curve?.length&&<path className="shifted-trend-extension" d={row.curve.map((point,i)=>`${i?'L':'M'} ${point.x} ${point.y}`).join(' ')} fill="none" stroke={row.color} strokeWidth={row.width} strokeDasharray={`${row.width} ${row.width}`}><title>과거 볼린저 상단 계산값을 앞으로 이동한 구간 · 미래 시세 예측이 아닙니다.</title></path>}
      {row.signals.filter(s=>s.x>=0&&s.x<=width).map(s=><g key={s.confirmedTime} className="learning-low-signal" role="img" aria-label={`저점 ${s.price}, ${s.delay}봉 후 확인`}>
        <title>{`저점 위치 ${formatBarTime(s.pivotTime,CHART_TIME_ZONE)} · 가격 ${s.price}\n확인 시점 ${formatBarTime(s.confirmedTime,CHART_TIME_ZONE)} · ${s.delay}봉 후 확인. 이후 더 낮은 저점이 생길 수 있습니다.`}</title>
        {row.showPivotOrigin&&<><line x1={s.originX} y1={s.originY} x2={s.x} y2={s.y} stroke={row.color} strokeWidth={row.width} strokeDasharray="2 3"/><circle cx={s.originX} cy={s.originY} r={3} fill="#fff" stroke={row.color}/></>}
        <path d={`M ${s.x} ${s.y-5} l -5 9 h 10 Z`} fill={row.color}/><text x={s.x-22} y={s.y+18} fontSize="10" fill={row.color}>저점 확인</text>
      </g>)}
    </g>)}
  </svg>;
}
export function TrendLearningGuide({api,studies,onEdit}){
  useChartRevision(api);
  const visible=studies.filter(s=>['dottedTrend','pivotLows'].includes(s.type)&&s.visible);
  if(!visible.length)return null;
  return <div className="trend-learning-guides">{visible.map(study=>{
    const record=api?.learningStudies?.find(s=>s.study.id===study.id),model=record?.model,p=study.params,dotted=study.type==='dottedTrend';
    return <details className="trend-learning-guide" data-study-type={study.type} key={study.id}><summary>{dotted?`점선 추세선 · BB ${p.period} / ${p.deviation} · 앞으로 ${p.offset}봉 · 이미지 추정`:`저점 확인 · 피벗 · ${p.right}봉 후 확인`}</summary><div>
      {dotted?<><p>공유한 여러 종목의 표시값과 곡선을 대조한 추정 규칙입니다. 원본 코드가 공개된 것은 아니므로 완전히 같은 구현으로 확정하지는 않았습니다.</p>
      <p>확정봉 종가 {p.period}개로 볼린저 상단(표준편차 {p.deviation}배)을 계산하고 앞으로 {p.offset}봉 옮깁니다. 오른쪽 선도 이미 계산된 과거 값이며 미래 가격을 예측하지 않습니다. 선택 주기의 봉 수가 기준이고 자료가 없는 미래 날짜·캔들은 만들지 않습니다.</p>
      <code>U(t) = SMA(종가, {p.period}) + {p.deviation} × 모집단 표준편차(종가, {p.period}); 표시 위치 = t + {p.offset}봉</code></>:<>
      <p>후보 저가가 왼쪽 {p.left}개 봉의 저가보다 모두 낮고, 오른쪽 {p.right}개 확정 봉의 저가보다 낮거나 같으면 확인합니다. 표식은 확인된 봉에 표시하며 원본 저점 지표와 같은 규칙인지는 미확인입니다.{p.showPivotOrigin&&' 동그라미는 사후 확인한 과거 저점 위치입니다.'}</p>
      {!!model?.signals.length&&<div className="learning-signals-table"><table><caption>최근 확인된 저점 · 확인할 수 있었던 시점</caption><thead><tr><th>저점 봉</th><th>저점 가격</th><th>확인된 봉</th></tr></thead><tbody>{model.signals.slice(-3).map(s=><tr key={s.confirmedTime}><td>{formatBarTime(s.pivotTime,CHART_TIME_ZONE)}</td><td>{s.price.toLocaleString('ko-KR',{maximumFractionDigits:4})}</td><td>{formatBarTime(s.confirmedTime,CHART_TIME_ZONE)} · {s.delay}봉 후</td></tr>)}</tbody></table></div>}
      </>}
      {model&&<p className="learning-sample-status">확정 자료 {model.availableBars.toLocaleString('ko-KR')}봉 · {model.availableBars<model.requiredBars?`계산에 최소 ${model.requiredBars}봉 필요`:dotted?`점선 ${model.curve.length.toLocaleString('ko-KR')}개 계산값`:`확인된 저점 ${model.signals.length}개`}. 누락이 있으면 제공된 봉 수를 기준으로 계산합니다.</p>}
      <div className="learning-guide-actions">{dotted&&<button type="button" onClick={()=>{const scale=api?.chart.timeScale(),range=scale?.getVisibleLogicalRange();if(range)scale.setVisibleLogicalRange({from:range.from,to:Math.max(range.to,api.data.length-1+p.offset+2)});}}>이동 구간 보기</button>}<button type="button" onClick={()=>onEdit?.(study.id)}>{dotted?'점선 설정':'저점 설정'}</button>{!dotted&&<a href="https://www.tradingview.com/pine-script-docs/concepts/repainting/#plotting-in-the-past" target="_blank" rel="noreferrer">TradingView의 사후 피벗 표시 설명</a>}</div>
    </div></details>;
  })}</div>;
}
