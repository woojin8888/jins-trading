import React,{useEffect,useRef} from 'react';
import {menuPosition} from './chart-interactions.js';
export default function ChartContextMenu({menu,onClose,onLine,onAlert,onEdit,onReset,onScreenshot,drawingReady}){
  const ref=useRef(null);
  useEffect(()=>{ref.current?.querySelector('button')?.focus();const close=e=>{if(!ref.current?.contains(e.target))onClose();};document.addEventListener('pointerdown',close);window.addEventListener('resize',onClose);return()=>{document.removeEventListener('pointerdown',close);window.removeEventListener('resize',onClose);};},[onClose]);
  function choose(action){action();onClose();}
  return <div ref={ref} className="chart-context-menu" role="menu" aria-label="차트 우클릭 메뉴" style={menuPosition(menu.x,menu.y,menu.width,menu.height)} onContextMenu={e=>e.preventDefault()} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();onClose();}if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const buttons=[...ref.current.querySelectorAll('button:not(:disabled)')],i=buttons.indexOf(document.activeElement);buttons[(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();}}}>
    <small>{menu.anchor?menu.anchor.price.toLocaleString('ko-KR',{maximumFractionDigits:3}):'차트 메뉴'}</small>
    <button role="menuitem" disabled={!menu.anchor||!drawingReady} onClick={()=>choose(onLine)}>이 가격에 지지·저항 수평선 추가</button>
    <button role="menuitem" disabled={!menu.anchor} onClick={()=>choose(onAlert)}>이 가격으로 알림 만들기</button>
    <button role="menuitem" onClick={()=>choose(onEdit)}>{menu.average?'선택한 이동평균선 설정':'이동평균선 설정'}</button>
    <button role="menuitem" onClick={()=>choose(onReset)}>전체 구간 보기</button>
    <button role="menuitem" onClick={()=>choose(onScreenshot)}>차트 PNG 저장</button>
    <button role="menuitem" onClick={onClose}>닫기</button>
  </div>;
}
