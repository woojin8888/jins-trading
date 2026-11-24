import React from 'react';
import {Minimize2,Settings2,Info} from 'lucide-react';
export default function ChartFocusBar({symbol,name,price,currency,timeframe,asOf,replay,warning,loading,toolsVisible,pending,onTools,onData,onClose}){
  return <div className="chart-focus-bar" role="toolbar" aria-label="차트 크게 보기 도구">
    <div className="chart-focus-identity"><strong title={name}>{symbol} <small>{timeframe}봉</small></strong><span>{price} <small>{currency}</small></span><small className="chart-focus-time">{replay?'과거 재생':'가격 기준'} {asOf}</small></div>
    <div className="chart-focus-actions"><button className={warning?'focus-data-warning':''} aria-label={loading?'시세 조회 중':warning?'시세 확인 필요':'시세 기준'} onClick={onData} disabled={loading||replay} title={`가격 기준 ${asOf}`}><Info size={15}/><span>{loading?'조회 중':warning?'시세 확인 필요':'시세 기준'}</span></button><button onClick={onTools} aria-pressed={toolsVisible}><Settings2 size={15}/><span>도구 {toolsVisible?'숨기기':'보기'}</span></button><button className="chart-focus-close" aria-label="전체화면 닫기" title="크게 보기 닫기 · Esc" disabled={pending} onClick={onClose}><Minimize2 size={17}/><span>닫기</span></button></div>
  </div>;
}
