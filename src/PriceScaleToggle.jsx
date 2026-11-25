import React from 'react';
export default function PriceScaleToggle({checked,onChange}){
 return <label className="price-scale-toggle" title="체크: 같은 비율의 변화를 같은 간격으로 표시 · 해제: 같은 가격 차이를 같은 간격으로 표시"><input type="checkbox" aria-label="로그 눈금" checked={checked} onChange={event=>onChange(event.target.checked)}/>로그 눈금</label>;
}
