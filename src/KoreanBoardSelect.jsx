import React,{useId} from 'react';
export default function KoreanBoardSelect({value,onChange,disabled=false}){
  const id=useId();return <label className="korean-board-select" htmlFor={id}>한국 시장<select id={id} aria-label="한국 종목 시장 구분" value={value} disabled={disabled} onChange={e=>onChange(e.target.value)}><option value="all">코스피·코스닥 전체</option><option value="kospi">코스피</option><option value="kosdaq">코스닥</option></select></label>;
}
