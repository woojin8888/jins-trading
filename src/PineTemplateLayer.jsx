import React,{useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {formatBarTime} from './timeframes.js';
import {CHART_TIME_ZONE} from './chart-timezone.js';
import './pine-template.css';
const EN=['Stock price is above MA 150 and 200','MA 150 is above MA 200','MA 200 is trending at least 1 month (22 bars)','MA 50 is above both MA 150 and MA 200','The current stock price is trading above MA 50','Current stock price is 25% above 52 weeks low','Current price is within 25% of 52 week high','RS rating more than 70'];
function tableRows(model,language){
 if(!model.table)return [];
 const en=language==='en',rows=model.table.checks.map((row,i)=>({label:en?EN[i]:row.label,pass:row.pass,value:(row.pass===null?(en?'unknown':'미확인'):row.pass?(en?'yes':'충족'):(en?'no':'미충족'))+(i===7&&Number.isFinite(model.table.rs)?' ('+model.table.rs.toFixed(2)+')':'')}));
 const pass=model.table.known<8?null:model.table.score===8;
 rows.push({label:en?'Meet Minervini criteria':'전체 조건 충족',pass,value:(pass===null?(en?'unknown':'미확인'):pass?(en?'yes':'충족'):(en?'no':'미충족'))+' ('+model.table.score+'/8)'});return rows;
}
function panelStyle(position){const [vertical,horizontal]=position.split('-'),style={};const transforms=[];if(vertical==='middle'){style.top='50%';transforms.push('translateY(-50%)');}else style[vertical]=8;if(horizontal==='center'){style.left='50%';transforms.push('translateX(-50%)');}else style[horizontal]=8;style.transform=transforms.join(' ');return style;}
export function pineTemplateGeometry(api,collapsed={}){
 const scale=api.chart.timeScale(),y=value=>api.candles.priceToCoordinate(value),width=scale.width(),height=api.chart.panes()[0].getHeight();
 return (api.templateStudies||[]).map(({study,model})=>{
  const profile=model.profile,origin=profile?scale.logicalToCoordinate(profile.originIndex):null;
  const bins=profile?.bins.flatMap(bin=>{
   const mid=scale.logicalToCoordinate(profile.originIndex+bin.upWidth),end=scale.logicalToCoordinate(profile.originIndex+bin.upWidth+bin.downWidth),top=y(bin.high-(profile.gap||0)),bottom=y(bin.low+(profile.gap||0));
   return [origin,mid,end,top,bottom].every(Number.isFinite)?[{x:origin,mid,end,y:top,height:Math.max(0,bottom-top),inValueArea:bin.inValueArea}]:[];
  })||[];
  return {study,model,bins,width,height,origin,pocY:study.params.showPOC!==false&&Number.isFinite(profile?.pocPrice)?y(profile.pocPrice):null,rows:tableRows(model,study.params.language),collapsed:!!collapsed[study.id]};
 });
}
export function paintPineTemplates(ctx,rows,width,height){
 ctx.save();ctx.font='10px sans-serif';
 for(const row of rows){const p=row.study.params;
  for(const b of row.bins){ctx.globalAlpha=p.opacity/100*(b.inValueArea?1:.4);ctx.fillStyle=p.upColor;ctx.fillRect(b.x,b.y,b.mid-b.x,b.height);ctx.fillStyle=p.downColor;ctx.fillRect(b.mid,b.y,b.end-b.mid,b.height);}ctx.globalAlpha=1;
  if(Number.isFinite(row.pocY)){ctx.strokeStyle=row.study.color;ctx.lineWidth=row.study.width;ctx.beginPath();ctx.moveTo(Math.max(0,row.origin||0),row.pocY);ctx.lineTo(width,row.pocY);ctx.stroke();}
  if(!p.showTable||row.hideTable)continue;
  const tableWidth=Math.min(360,width-16),rowHeight=32,tableHeight=row.collapsed?30:42+row.rows.length*rowHeight+30,[v,h]=p.tablePosition.split('-'),x=h==='left'?8:h==='center'?(width-tableWidth)/2:width-tableWidth-8,y=v==='top'?8:v==='middle'?(height-tableHeight)/2:height-tableHeight-8;
  ctx.fillStyle='#fff';ctx.fillRect(x,y,tableWidth,tableHeight);ctx.strokeStyle='#9aa6b4';ctx.lineWidth=1;ctx.strokeRect(x,y,tableWidth,tableHeight);ctx.fillStyle='#00bcd4';ctx.fillRect(x,y,tableWidth,30);ctx.fillStyle='#122a37';ctx.fillText('미너비니 8조건 · '+formatBarTime(row.model.table.asOf,CHART_TIME_ZONE),x+7,y+19);
  if(row.collapsed)continue;
  row.rows.forEach((r,i)=>{const top=y+34+i*rowHeight;ctx.fillStyle=r.pass===null?'#e5e7eb':r.pass?'#9de4e8':'#ffd7d7';ctx.fillRect(x+tableWidth-86,top,86,rowHeight);ctx.fillStyle='#263b4b';const words=r.label.split(' ');let line='',lineY=top+12;for(const word of words){if(ctx.measureText(line+word).width>tableWidth-104){ctx.fillText(line,x+6,lineY);line=word+' ';lineY+=12;}else line+=word+' ';}ctx.fillText(line,x+6,lineY);ctx.fillText(r.value,x+tableWidth-80,top+18);ctx.strokeStyle='#b8c3ce';ctx.strokeRect(x,top,tableWidth,rowHeight);});
 }
 ctx.restore();
}
function PineTemplateDetails({row}){
 return <><table><thead><tr><th>{row.study.params.language==='en'?'Criteria':'조건'}</th><th>{row.study.params.language==='en'?'Status':'결과'}</th></tr></thead><tbody>{row.rows.map((r,i)=><tr key={i}><td>{r.label}</td><td className={r.pass===null?'unknown':r.pass?'pass':'fail'}>{r.value}</td></tr>)}</tbody></table><p className="pine-template-date">확정 {formatBarTime(row.model.table.asOf,CHART_TIME_ZONE)} · {row.model.table.known}/8조건 확인 · 선택 주기의 봉 수 기준</p><details><summary>계산 기준</summary><p>RS는 첨부 코드의 13·26·39·52봉 가중 비율이며 백분위가 아닙니다. 조건표는 확정봉 기준이며 자료 부족 조건은 미확인으로 표시합니다. 매물대는 별도 지표입니다.</p><a href="/source/pine-template.js" target="_blank" rel="noreferrer">계산 소스 · MPL-2.0</a></details></>;
}
function MobileTemplateControl({row,onEdit,onRemove}){
 const [open,setOpen]=useState(false),dialog=useRef(null),id='pine-mobile-'+useId();
 useEffect(()=>{if(!open)return;const element=dialog.current;element.showModal();return()=>element.close();},[open]);
 const close=()=>setOpen(false),table=row.model.table;
 return <><button type="button" className="pine-template-mobile-trigger" aria-label={`미너비니 8조건 상세 보기 · ${table.score}/8 충족${table.known<8?' · 일부 미확인':''}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(true)}>미너비니 {table.score}/8{table.known<8?' · 미확인':''}</button>
  {open&&<dialog ref={dialog} id={id} className="pine-template-mobile-dialog" aria-labelledby={id+'-title'} onCancel={close} onClick={event=>{if(event.target===event.currentTarget)close();}}><section className="pine-template-panel pine-template-mobile-panel" data-study-id={row.study.id} data-score={table.score} data-known={table.known} data-as-of={table.asOf}>
   <header><strong id={id+'-title'}>미너비니 8조건</strong><button type="button" aria-label="미너비니 상세 닫기" autoFocus onClick={close}>닫기</button></header>
   <div className="pine-template-mobile-body"><PineTemplateDetails row={row}/></div>
   <footer><button type="button" onClick={()=>{close();onEdit?.(row.study.id);}}>지표 설정</button><button type="button" onClick={()=>{close();onRemove?.(row.study.id);}}>지표 삭제</button></footer>
  </section></dialog>}
 </>;
}
export default function PineTemplateLayer({api,onEdit,onRemove,mobileControls}){
 const [,revision]=useState(0),[collapsed,setCollapsed]=useState({}),[mobile,setMobile]=useState(()=>window.matchMedia('(max-width:700px)').matches);
 useEffect(()=>{const query=window.matchMedia('(max-width:700px)'),update=()=>setMobile(query.matches);update();query.addEventListener('change',update);return()=>query.removeEventListener('change',update);},[]);
 useEffect(()=>{if(!api)return;const update=()=>revision(n=>n+1);api.drawingListeners.add(update);update();return()=>api.drawingListeners.delete(update);},[api]);
 if(!api||api.disposed)return null;
 const rows=pineTemplateGeometry(api,collapsed);api.templateRendered=mobile?rows.map(row=>({...row,hideTable:true})):rows;
 if(!rows.length)return null;const width=rows[0].width,height=rows[0].height;
 return <>{mobile&&mobileControls&&createPortal(rows.filter(row=>row.model.table&&row.study.params.showTable).map(row=><MobileTemplateControl key={row.study.id} row={row} onEdit={onEdit} onRemove={onRemove}/>),mobileControls)}<div className="pine-template-layer" style={{width,height}}>
  {rows.some(row=>row.bins.length>0)&&<svg className="pine-profile-layer" width={width} height={height} aria-label="첨부 Pine 고정범위 매물대 추정"><defs><clipPath id={'pine-clip-'+api.instanceId}><rect width={width} height={height}/></clipPath></defs><g clipPath={'url(#pine-clip-'+api.instanceId+')'}>{rows.map(row=><g key={row.study.id} className="pine-profile-study" data-study-id={row.study.id}>{row.bins.map((b,i)=><g key={i} opacity={row.study.params.opacity/100*(b.inValueArea?1:.4)}><rect x={b.x} y={b.y} width={Math.max(0,b.mid-b.x)} height={b.height} fill={row.study.params.upColor}/><rect x={b.mid} y={b.y} width={Math.max(0,b.end-b.mid)} height={b.height} fill={row.study.params.downColor}/></g>)}{Number.isFinite(row.pocY)&&<line className="pine-poc-line" x1={Math.max(0,row.origin||0)} x2={width} y1={row.pocY} y2={row.pocY} stroke={row.study.color} strokeWidth={row.study.width}/>}</g>)}</g></svg>}
  {!mobile&&rows.filter(row=>row.model.table&&row.study.params.showTable).map(row=><section key={row.study.id} className="pine-template-panel" style={panelStyle(row.study.params.tablePosition)} aria-label="미너비니 8조건 표" data-study-id={row.study.id} data-score={row.model.table.score} data-known={row.model.table.known} data-as-of={row.model.table.asOf}>
   <header><strong>미너비니 8조건</strong><button aria-label={'미너비니 표 '+(row.collapsed?'펼치기':'접기')} aria-expanded={!row.collapsed} onClick={()=>setCollapsed(values=>({...values,[row.study.id]:!row.collapsed}))}>{row.collapsed?'펼치기':'접기'}</button><button aria-label="미너비니 표 설정" onClick={()=>onEdit?.(row.study.id)}>설정</button><button aria-label="미너비니 표 지표 삭제" onClick={()=>onRemove?.(row.study.id)}>×</button></header>
   {!row.collapsed&&<PineTemplateDetails row={row}/>}
  </section>)}
 </div></>;
}
