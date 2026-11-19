import React from 'react';
import {MARKETS} from './instruments.js';
export default function MarketSelect({value,onChange,label='차트 시장 선택'}){
 return <select className="chart-market-select global-market-select" aria-label={label} value={value} onChange={e=>onChange(e.target.value)}>{[['주요 시장',['us','kr']],['해외 주식',['jp','hk','cn','uk','de','fr','ca','au','in','tw','sg']],['글로벌 자산',['indices','fx','commodities','etf','etfkr']]].map(([name,keys])=><optgroup key={name} label={name}>{keys.map(key=><option key={key} value={key}>{MARKETS[key].label}</option>)}</optgroup>)}</select>;
}
