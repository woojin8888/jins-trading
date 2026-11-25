import React,{useEffect,useState} from 'react';
import {formatBarTime} from './timeframes.js';
import {CHART_TIME_ZONE} from './chart-timezone.js';
import './pine-template.css';
const EMPTY=[];
const EN=['Stock price is above MA 150 and 200','MA 150 is above MA 200','MA 200 is trending at least 1 month (22 bars)','MA 50 is above both MA 150 and MA 200','The current stock price is trading above MA 50','Current stock price is 25% above 52 weeks low','Current price is within 25% of 52 week high','RS rating more than 70'];
function tableRows(model,language){
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
  return {study,model,bins,width,height,origin,highY:Number.isFinite(model.high)?y(model.high):null,lowY:Number.isFinite(model.low)?y(model.low):null,pocY:Number.isFinite(profile?.pocPrice)?y(profile.pocPrice):null,rows:tableRows(model,study.params.language),collapsed:!!collapsed[study.id]};
 });
}
export function paintPineTemplates(ctx,rows,width,height){
 ctx.save();ctx.font='10px sans-serif';
 for(const row of rows){const p=row.study.params;
  for(const b of row.bins){ctx.globalAlpha=p.opacity/100*(b.inValueArea?1:.4);ctx.fillStyle=p.upColor;ctx.fillRect(b.x,b.y,b.mid-b.x,b.height);ctx.fillStyle=p.downColor;ctx.fillRect(b.mid,b.y,b.end-b.mid,b.height);}ctx.globalAlpha=1;
  if(p.showHighLow){ctx.strokeStyle='#f59e0b';ctx.lineWidth=1;ctx.setLineDash([4,3]);for(const y of [row.highY,row.lowY])if(Number.isFinite(y)){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke();}ctx.setLineDash([]);}
  if(Number.isFinite(row.pocY)){ctx.strokeStyle=row.study.color;ctx.lineWidth=row.study.width;ctx.beginPath();ctx.moveTo(Math.max(0,row.origin||0),row.pocY);ctx.lineTo(width,row.pocY);ctx.stroke();}
  if(!p.showTable)continue;
  const tableWidth=Math.min(360,width-16),rowHeight=32,tableHeight=row.collapsed?30:42+row.rows.length*rowHeight+30,[v,h]=p.tablePosition.split('-'),x=h==='left'?8:h==='center'?(width-tableWidth)/2:width-tableWidth-8,y=v==='top'?8:v==='middle'?(height-tableHeight)/2:height-tableHeight-8;
  ctx.fillStyle='#fff';ctx.fillRect(x,y,tableWidth,tableHeight);ctx.strokeStyle='#9aa6b4';ctx.lineWidth=1;ctx.strokeRect(x,y,tableWidth,tableHeight);ctx.fillStyle='#00bcd4';ctx.fillRect(x,y,tableWidth,30);ctx.fillStyle='#122a37';ctx.fillText('미너비니 8조건 · '+formatBarTime(row.model.table.asOf,CHART_TIME_ZONE),x+7,y+19);
  if(row.collapsed)continue;
  row.rows.forEach((r,i)=>{const top=y+34+i*rowHeight;ctx.fillStyle=r.pass===null?'#e5e7eb':r.pass?'#9de4e8':'#ffd7d7';ctx.fillRect(x+tableWidth-86,top,86,rowHeight);ctx.fillStyle='#263b4b';const words=r.label.split(' ');let line='',lineY=top+12;for(const word of words){if(ctx.measureText(line+word).width>tableWidth-104){ctx.fillText(line,x+6,lineY);line=word+' ';lineY+=12;}else line+=word+' ';}ctx.fillText(line,x+6,lineY);ctx.fillText(r.value,x+tableWidth-80,top+18);ctx.strokeStyle='#b8c3ce';ctx.strokeRect(x,top,tableWidth,rowHeight);});
 }
 ctx.restore();
}
export default function PineTemplateLayer({api,onEdit,onRemove}){
 const [,revision]=useState(0),[collapsed,setCollapsed]=useState({}),records=api?.templateStudies||EMPTY;
 useEffect(()=>{if(!api)return;const update=()=>revision(n=>n+1);api.drawingListeners.add(update);update();return()=>api.drawingListeners.delete(update);},[api]);
 useEffect(()=>{
  if(!api||api.disposed)return;const lines=[];
  for(const {study,model} of records){
   if(study.params.showHighLow)for(const [title,price] of [[study.params.highLookback+'H',model.high],[study.params.lowLookback+'L',model.low]])if(Number.isFinite(price))lines.push(api.candles.createPriceLine({price,color:'#f59e0b',lineVisible:false,axisLabelVisible:true,title,lineWidth:1}));
   if(study.params.showPocLabel&&Number.isFinite(model.profile?.pocPrice))lines.push(api.candles.createPriceLine({price:model.profile.pocPrice,color:study.color,lineVisible:false,axisLabelVisible:true,title:'Pine POC',lineWidth:1}));
  }
  return()=>{if(!api.disposed)for(const line of lines)api.candles.removePriceLine(line);};
 },[api,records]);
 if(!api||api.disposed)return null;
 const rows=pineTemplateGeometry(api,collapsed);api.templateRendered=rows;
 if(!rows.length)return null;const width=rows[0].width,height=rows[0].height;
 return <div className="pine-template-layer" style={{width,height}}>
  <svg className="pine-profile-layer" width={width} height={height} aria-label="첨부 Pine 고정범위 매물대 추정"><defs><clipPath id={'pine-clip-'+api.instanceId}><rect width={width} height={height}/></clipPath></defs><g clipPath={'url(#pine-clip-'+api.instanceId+')'}>{rows.map(row=><g key={row.study.id}>{row.bins.map((b,i)=><g key={i} opacity={row.study.params.opacity/100*(b.inValueArea?1:.4)}><rect x={b.x} y={b.y} width={Math.max(0,b.mid-b.x)} height={b.height} fill={row.study.params.upColor}/><rect x={b.mid} y={b.y} width={Math.max(0,b.end-b.mid)} height={b.height} fill={row.study.params.downColor}/></g>)}{row.study.params.showHighLow&&[row.highY,row.lowY].map((y,i)=>Number.isFinite(y)&&<line key={i} x1={0} x2={width} y1={y} y2={y} stroke="#f59e0b" strokeDasharray="4 3"/>)}{Number.isFinite(row.pocY)&&<line className="pine-poc-line" x1={Math.max(0,row.origin||0)} x2={width} y1={row.pocY} y2={row.pocY} stroke={row.study.color} strokeWidth={row.study.width}/>}</g>)}</g></svg>
  {rows.filter(row=>row.study.params.showTable).map(row=><section key={row.study.id} className="pine-template-panel" style={panelStyle(row.study.params.tablePosition)} aria-label="미너비니 8조건 표" data-study-id={row.study.id} data-score={row.model.table.score} data-known={row.model.table.known} data-as-of={row.model.table.asOf}>
   <header><strong>미너비니 8조건</strong><button aria-label={'미너비니 표 '+(row.collapsed?'펼치기':'접기')} aria-expanded={!row.collapsed} onClick={()=>setCollapsed(values=>({...values,[row.study.id]:!row.collapsed}))}>{row.collapsed?'펼치기':'접기'}</button><button aria-label="미너비니 표 설정" onClick={()=>onEdit?.(row.study.id)}>설정</button><button aria-label="미너비니 표 지표 삭제" onClick={()=>onRemove?.(row.study.id)}>×</button></header>
   {!row.collapsed&&<><table><thead><tr><th>{row.study.params.language==='en'?'Criteria':'조건'}</th><th>{row.study.params.language==='en'?'Status':'결과'}</th></tr></thead><tbody>{row.rows.map((r,i)=><tr key={i}><td>{r.label}</td><td className={r.pass===null?'unknown':r.pass?'pass':'fail'}>{r.value}</td></tr>)}</tbody></table><p className="pine-template-date">확정 {formatBarTime(row.model.table.asOf,CHART_TIME_ZONE)} · {row.model.table.known}/8조건 확인 · 선택 주기의 봉 수 기준</p><details><summary>계산 기준·매물대 상태</summary><p>RS는 첨부 코드의 13·26·39·52봉 가중 비율이며 백분위가 아닙니다. 표는 확정봉, 고저가선·매물대는 최신봉 포함 기준입니다. 자료 부족 조건은 미확인으로 표시합니다.</p>{row.study.params.showFixedProfile&&<p>{!row.model.profileAllowed?'해당 자산의 가격별 거래량이 확인되지 않아 매물대를 표시하지 않습니다.':row.model.profile?.pocPrice===null?'매물대 계산에 필요한 거래량·가격 범위가 없습니다.':`Pine 고정범위 ${row.model.profile?.usedBars}/${row.study.params.profileBars}봉 · POC ${row.model.profile?.pocPrice?.toLocaleString('ko-KR',{maximumFractionDigits:4})} · 미제공 거래량 ${row.model.profile?.missingVolumeBars}봉. 단일가격봉은 원본의 0분모 규칙에 따라 배분되지 않습니다.`}</p>}<a href="/source/pine-template.js" target="_blank" rel="noreferrer">계산 소스 · MPL-2.0</a></details></>}
  </section>)}
 </div>;
}
