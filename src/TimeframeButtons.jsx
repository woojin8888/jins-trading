import React from 'react';
import PriceScaleToggle from './PriceScaleToggle.jsx';
import {TIMEFRAMES} from './timeframes.js';
import {CHART_TIME_ZONE_LABEL} from './chart-timezone.js';

const choices=['D','W','M','4h','1h','30m','15m'].map(value=>TIMEFRAMES.find(([key])=>key===value));

export default function TimeframeButtons({value,onChange,logScale=false,onLogScaleChange}){
  return <div className="timeframe-bar"><span className="timeframe-caption">봉 주기</span><div className="timeframe-buttons" role="group" aria-label="봉 주기">{choices.map(([key,label])=><button type="button" key={key} aria-pressed={value===key} className={value===key?'active':''} onClick={()=>{if(value!==key)onChange(key);}}>{label}봉</button>)}</div>{onLogScaleChange&&<PriceScaleToggle checked={logScale} onChange={onLogScaleChange}/>}<span className="chart-timezone" aria-label={CHART_TIME_ZONE_LABEL} title={CHART_TIME_ZONE_LABEL+' · 분봉은 봉 시작 시각, 일·주·월봉 날짜는 거래소 거래일 기준'}><span>한국시간 · </span>KST</span></div>;
}
