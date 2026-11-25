import React from 'react';
import {MARKETS} from './instruments.js';
export default function MarketSelect({value,onChange,label='차트 시장 선택'}){
 return <select className="chart-market-select global-market-select" aria-label={label} value={value} onChange={e=>{if(e.target.value==='treasuries')window.location.assign('/?market=treasuries&symbol=UST10Y&view=fullscreen');else onChange(e.target.value);}}>{[['주요 시장',['us','kr']],['해외 주식',['jp','hk','cn','uk','de','fr','ca','au','in','tw','sg']],['글로벌 자산',['indices','fx','commodities','etf','etfkr']]].map(([name,keys])=><optgroup key={name} label={name}>{keys.map(key=><option key={key} value={key}>{MARKETS[key].label}</option>)}</optgroup>)}<optgroup label="국채 · 별도 기준"><option value="treasuries">미 재무부 일별 금리 · TVC와 기준 다름</option></optgroup></select>;
}
