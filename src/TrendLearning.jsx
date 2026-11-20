import React,{useEffect,useState} from 'react';
import {formatBarTime} from './timeframes.js';

function useChartRevision(api){
  const [,setRevision]=useState(0);
  useEffect(()=>{if(!api)return;const update=()=>setRevision(n=>n+1);api.drawingListeners.add(update);update();return()=>api.drawingListeners.delete(update);},[api]);
}
export function learningGeometry(api){
  const scale=api.chart.timeScale(),indices=new Map(api.data.map((b,i)=>[b.time,i])),visible=scale.getVisibleLogicalRange();
  return (api.learningStudies||[]).map(({study,model})=>{
    const index=indices.get(model.last?.time),x=logical=>scale.logicalToCoordinate(logical),y=price=>api.candles.priceToCoordinate(price);
    const future=index===undefined?[]:[{x:x(index),y:y(model.last.value)},...model.projection.map(p=>({x:x(index+p.step),y:y(p.value)}))].filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
    const signals=model.signals.filter(signal=>{const index=indices.get(signal.confirmedTime);return !visible||index>=visible.from-1&&index<=visible.to+1;}).flatMap(signal=>{
      const confirmed=indices.get(signal.confirmedTime),pivot=indices.get(signal.pivotTime),px=x(confirmed),py=y(signal.confirmationLow),originX=x(pivot),originY=y(signal.price);
      return [px,py,originX,originY].every(Number.isFinite)?[{...signal,x:px,y:py+14,originX,originY}]:[];
    });
    return {id:study.id,color:study.color,width:study.width,future:model.projection.length?future:[],signals,showPivotOrigin:study.params.showPivotOrigin};
  });
}
export function paintLearning(ctx,rows,width,height){
  ctx.save();ctx.font='11px sans-serif';
  if(rows.length){ctx.fillStyle='#555';ctx.fillText('점선·저점 학습 · 원본 미확인',12,16);}
  for(const row of rows){
    if(row.future.length>1&&row.future[0].x<width&&row.future.at(-1).x>=0){
      const start=row.future[0].x;ctx.fillStyle='#f3f4f6';ctx.globalAlpha=.5;ctx.fillRect(start,0,Math.max(0,width-start),height);ctx.globalAlpha=1;
      ctx.strokeStyle=row.color;ctx.lineWidth=row.width;ctx.lineCap='round';ctx.setLineDash([1,6]);ctx.beginPath();row.future.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#555';ctx.fillText('가정 경로 · 원본 미확인',Math.max(8,Math.min(start+8,width-170)),26);
    }
    ctx.strokeStyle='#12846c';ctx.fillStyle='#12846c';ctx.lineWidth=1;
    for(const signal of row.signals){
      if(signal.x<0||signal.x>width)continue;
      ctx.beginPath();ctx.moveTo(signal.x,signal.y-5);ctx.lineTo(signal.x-5,signal.y+4);ctx.lineTo(signal.x+5,signal.y+4);ctx.closePath();ctx.fill();ctx.fillText('저점 확인',signal.x-22,signal.y+18);
      if(row.showPivotOrigin){ctx.setLineDash([2,3]);ctx.beginPath();ctx.moveTo(signal.originX,signal.originY);ctx.lineTo(signal.x,signal.y);ctx.stroke();ctx.setLineDash([]);}
    }
  }
  ctx.restore();
}
export function TrendLearningLayer({api}){
  useChartRevision(api);
  if(!api||api.disposed||!api.data.length)return null;
  const width=api.chart.timeScale().width(),height=api.chart.panes()[0].getHeight(),rows=learningGeometry(api);api.learningRendered=rows;
  if(!rows.length)return null;
  return <svg className="trend-learning-layer" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-label="점선 가정 경로와 확인 시점 저점 표시">
    {rows.map(row=><g key={row.id}>
      {row.future.length>1&&row.future[0].x<width&&row.future.at(-1).x>=0&&<><rect x={row.future[0].x} y={0} width={Math.max(0,width-row.future[0].x)} height={height} fill="#f3f4f6" opacity=".5"/><polyline className="learning-projection" points={row.future.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke={row.color} strokeWidth={row.width} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 6"/><text x={Math.max(8,Math.min(row.future[0].x+8,width-170))} y={26} fill="#555" fontSize="11">가정 경로 · 원본 미확인</text></>}
      {row.signals.filter(s=>s.x>=0&&s.x<=width).map(s=><g key={s.confirmedTime} className="learning-low-signal" role="img" aria-label={`저점 ${s.price}, ${s.delay}봉 후 확인`}>
        <title>{`저점 위치 ${formatBarTime(s.pivotTime,api.timeZone)} · 가격 ${s.price}\n확인 시점 ${formatBarTime(s.confirmedTime,api.timeZone)} · ${s.delay}봉 후 확인. 이후 더 낮은 저점이 생길 수 있습니다.`}</title>
        {row.showPivotOrigin&&<><line x1={s.originX} y1={s.originY} x2={s.x} y2={s.y} stroke="#12846c" strokeDasharray="2 3"/><circle cx={s.originX} cy={s.originY} r={3} fill="#fff" stroke="#12846c"/></>}
        <path d={`M ${s.x} ${s.y-5} l -5 9 h 10 Z`} fill="#12846c"/><text x={s.x-22} y={s.y+18} fontSize="10" fill="#12846c">저점 확인</text>
      </g>)}
    </g>)}
  </svg>;
}
export function TrendLearningGuide({api,studies,onEdit}){
  useChartRevision(api);
  const visible=studies.filter(s=>s.type==='trendLearning'&&s.visible);
  if(!visible.length)return null;
  return <div className="trend-learning-guides">{visible.map(study=>{
    const record=api?.learningStudies?.find(s=>s.study.id===study.id),model=record?.model,p=study.params;
    function reveal(){if(!model?.last||!api)return;const index=api.data.findIndex(b=>b.time===model.last.time),values=[model.last.value,...model.projection.map(p=>p.value)];api.learningScaleBounds=[Math.min(...values),Math.max(...values)];api.chart.priceScale('right').applyOptions({autoScale:true});api.chart.timeScale().setVisibleLogicalRange({from:Math.max(-1,index-100),to:index+model.projectionLength+4});}
    return <details className="trend-learning-guide" key={study.id}><summary>점선·저점 학습 · 원본 미확인 · 저점 {p.right}봉 후 확인</summary><div>
      <p>공유 이미지의 보호된 계산식은 확인할 수 없어, 원리를 배우는 공개 예제로 구현했습니다. 검은 과거 점선과 미래 가정 경로의 규칙은 서로 다릅니다.</p>
      <p><b>1. 과거 점선:</b> 최근 종가에 큰 가중치를 주는 단방향 가우시안 커널 평활입니다. 평활 강도 {p.bandwidth}, 최근 {Math.ceil(3*p.bandwidth)}개 봉을 사용합니다. 강도가 크면 부드럽고 반응은 느려집니다.</p>
      <code>S(t) = Σ w(j)·종가(t−j) / Σ w(j), w(j) = exp(−j² / (2·평활강도²))</code>
      <p><b>2. 미래 점선:</b> 과거 {p.pattern}봉의 평활 파동을 현재 수준으로 옮겨 그립니다. 같은 파동이 반복된다는 가정이며 예측력은 검증하지 않았습니다. 표시 범위는 최대 {Math.min(p.pattern,p.horizon)}봉입니다. 실제 미래 날짜·체결가·캔들은 만들지 않습니다. 새 확정 봉이 추가되면 가정 경로도 다시 계산됩니다.</p>
      <code>가정값(t+h) = S(t) + S(t−파동길이+h) − S(t−파동길이)</code>
      <p><b>3. 저점 확인:</b> 후보 저가가 왼쪽 {p.left}개 봉의 저가보다 모두 낮고, 오른쪽 {p.right}개 확정 봉의 저가보다 높지 않으면 확인합니다. 표식은 후보 봉이 아닌 확인된 봉에 표시합니다. 더 낮은 저점이 뒤에 생길 수 있어 바닥 예측·매수 신호로 해석하지 않습니다.{p.showPivotOrigin&&' 동그라미로 표시한 과거 저점 위치는 사후 확인한 위치입니다.'}</p>
      {!!model?.signals.length&&<div className="learning-signals-table"><table><caption>최근 확인된 저점 · 당시 알 수 있었던 시점</caption><thead><tr><th>저점 봉</th><th>저점 가격</th><th>확인된 봉</th></tr></thead><tbody>{model.signals.slice(-3).map(s=><tr key={s.confirmedTime}><td>{formatBarTime(s.pivotTime,api.timeZone)}</td><td>{s.price.toLocaleString('ko-KR',{maximumFractionDigits:4})}</td><td>{formatBarTime(s.confirmedTime,api.timeZone)} · {s.delay}봉 후</td></tr>)}</tbody></table></div>}
      {model&&<p className="learning-sample-status">확정 자료 {model.availableBars.toLocaleString('ko-KR')}봉 · {model.projectionLength?`가정 경로 ${model.projectionLength}봉`:p.showProjection?`경로 계산에 최소 ${model.requiredBars}봉 필요`:'가정 경로 숨김'} · 확인된 저점 {model.signals.length}개. 누락이 있으면 제공된 봉 수를 기준으로 계산합니다.</p>}
      <div className="learning-guide-actions"><button type="button" disabled={!model?.projectionLength} onClick={reveal}>가정 경로 보기</button><button type="button" onClick={()=>onEdit?.(study.id)}>학습 지표 설정</button><a href="https://www.tradingview.com/pine-script-docs/concepts/repainting/#plotting-in-the-past" target="_blank" rel="noreferrer">TradingView의 사후 피벗 표시 설명</a></div>
    </div></details>;
  })}</div>;
}
