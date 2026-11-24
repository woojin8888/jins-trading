import React from 'react';
import {TIMEFRAMES} from './timeframes.js';

const choices=['D','W','M','4h','1h','30m','15m'].map(value=>TIMEFRAMES.find(([key])=>key===value));

export default function TimeframeButtons({value,onChange}){
  return <div className="timeframe-bar"><span className="timeframe-caption">봉 주기</span><div className="timeframe-buttons" role="group" aria-label="봉 주기">{choices.map(([key,label])=><button type="button" key={key} aria-pressed={value===key} className={value===key?'active':''} onClick={()=>{if(value!==key)onChange(key);}}>{label}봉</button>)}</div></div>;
}
