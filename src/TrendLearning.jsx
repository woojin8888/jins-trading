import React,{useEffect,useState} from 'react';
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
  return <svg className="trend-learning-layer" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-label="점선 추세선의 이동 구간">
    {rows.map(row=><g key={row.id} data-study-id={row.id}>{!!row.curve?.length&&<path className="shifted-trend-extension" d={row.curve.map((point,i)=>`${i?'L':'M'} ${point.x} ${point.y}`).join(' ')} fill="none" stroke={row.color} strokeWidth={row.width} strokeDasharray={`${row.width} ${row.width}`}><title>과거 볼린저 상단 계산값을 앞으로 이동한 구간 · 미래 시세 예측이 아닙니다.</title></path>}</g>)}
  </svg>;
}
export function TrendLearningGuide({api,studies,onEdit}){
  useChartRevision(api);
  const visible=studies.filter(s=>s.type==='dottedTrend'&&s.visible);
  if(!visible.length)return null;
  return <div className="trend-learning-guides">{visible.map(study=>{
    const model=api?.learningStudies?.find(s=>s.study.id===study.id)?.model,p=study.params;
    return <details className="trend-learning-guide" data-study-type={study.type} key={study.id}><summary>{`점선 추세선 · BB ${p.period} / ${p.deviation} · 앞으로 ${p.offset}봉 · 이미지 추정`}</summary><div>
      <p>공유한 여러 종목의 표시값과 곡선을 대조한 추정 규칙입니다. 원본 코드가 공개된 것은 아니므로 완전히 같은 구현으로 확정하지는 않았습니다.</p>
      <p>확정봉 종가 {p.period}개로 볼린저 상단(표준편차 {p.deviation}배)을 계산하고 앞으로 {p.offset}봉 옮깁니다. 오른쪽 선도 이미 계산된 과거 값이며 미래 가격을 예측하지 않습니다. 선택 주기의 봉 수가 기준이고 자료가 없는 미래 날짜·캔들은 만들지 않습니다.</p>
      <code>U(t) = SMA(종가, {p.period}) + {p.deviation} × 모집단 표준편차(종가, {p.period}); 표시 위치 = t + {p.offset}봉</code>
      {model&&<p className="learning-sample-status">확정 자료 {model.availableBars.toLocaleString('ko-KR')}봉 · {model.availableBars<model.requiredBars?`계산에 최소 ${model.requiredBars}봉 필요`:`점선 ${model.curve.length.toLocaleString('ko-KR')}개 계산값`}. 누락이 있으면 제공된 봉 수를 기준으로 계산합니다.</p>}
      <div className="learning-guide-actions"><button type="button" onClick={()=>{const scale=api?.chart.timeScale(),range=scale?.getVisibleLogicalRange();if(range)scale.setVisibleLogicalRange({from:range.from,to:Math.max(range.to,api.data.length-1+p.offset+2)});}}>이동 구간 보기</button><button type="button" onClick={()=>onEdit?.(study.id)}>점선 설정</button></div>
    </div></details>;
  })}</div>;
}
