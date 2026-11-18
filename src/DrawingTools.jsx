import React,{useEffect,useId,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {ArrowUpRight,ChevronDown,Circle,Eye,EyeOff,Minus,MousePointer2,Redo2,Square,Trash2,TrendingUp,Type,Undo2,X} from 'lucide-react';
import {anchorAtLogical,DRAWING_LABELS,drawingStorageKey,logicalAtTime,normalizeDrawings,projectDrawing,timeStamp,translateDrawing,drawingTimeMap,chartAnchorTime} from './drawing-model.js';
const EMPTY={version:1,items:[]},ICONS={horizontal:Minus,trend:TrendingUp,rectangle:Square,ellipse:Circle,arrow:ArrowUpRight,text:Type};
function readDocument(key){try{return {key,doc:normalizeDrawings(JSON.parse(localStorage.getItem(drawingStorageKey(key))||'null')),past:[],future:[]};}catch{return {key,doc:EMPTY,past:[],future:[]};}}
export function useDrawings(key){
  const [state,setState]=useState(()=>readDocument(key)),[tool,setTool]=useState('select'),[selectedId,setSelectedId]=useState(null),[color,setColor]=useState('#2463eb'),[width,setWidth]=useState(2),[text,setText]=useState('메모'),[hidden,setHidden]=useState(false),[error,setError]=useState('');
  useLayoutEffect(()=>{setState(readDocument(key));setTool('select');setSelectedId(null);setError('');},[key]);
  useEffect(()=>{if(state.key!==key)return;try{localStorage.setItem(drawingStorageKey(key),JSON.stringify(state.doc));setError('');}catch{setError('그리기를 브라우저에 저장하지 못했습니다. 저장 공간을 확인해 주세요.');}},[state.doc,state.key,key]);
  const doc=state.key===key?state.doc:EMPTY,selected=doc.items.find(row=>row.id===selectedId);
  function commit(update){setState(previous=>{if(previous.key!==key)return previous;const next=normalizeDrawings(typeof update==='function'?update(previous.doc):update);return {...previous,doc:next,past:[...previous.past,previous.doc].slice(-40),future:[]};});}
  function patch(id,values){commit(previous=>({...previous,items:previous.items.map(row=>row.id===id?{...row,...values}:row)}));}
  function remove(){if(selectedId){commit(previous=>({...previous,items:previous.items.filter(row=>row.id!==selectedId)}));setSelectedId(null);}}
  function undo(){setState(previous=>{if(!previous.past.length)return previous;return {...previous,doc:previous.past.at(-1),past:previous.past.slice(0,-1),future:[previous.doc,...previous.future].slice(0,40)};});setSelectedId(null);}
  function redo(){setState(previous=>{if(!previous.future.length)return previous;return {...previous,doc:previous.future[0],past:[...previous.past,previous.doc].slice(-40),future:previous.future.slice(1)};});setSelectedId(null);}
  return {doc,tool,setTool,selectedId,setSelectedId,selected,color,width,text,setText,hidden,setHidden,error,commit,patch,remove,undo,redo,canUndo:!!state.past.length,canRedo:!!state.future.length,
    setColor:value=>{setColor(value);if(selected)patch(selected.id,{color:value});},setWidth:value=>{setWidth(value);if(selected)patch(selected.id,{width:value});}};
}
export function DrawingToolbar({drawing}){
  const d=drawing,[expanded,setExpanded]=useState(false);
  return <div className="drawing-toolbar"><div className="drawing-tool-buttons" role="toolbar" aria-label="차트 그리기 도구"><button className={d.tool==='select'?'active':''} aria-label="도형 선택·차트 이동" title="도형 선택·차트 이동" aria-pressed={d.tool==='select'} onClick={()=>d.setTool('select')}><MousePointer2 size={15}/><span>선택</span></button>{Object.entries(ICONS).map(([type,Icon])=><button key={type} className={d.tool===type?'active':''} aria-label={DRAWING_LABELS[type]} title={DRAWING_LABELS[type]} aria-pressed={d.tool===type} disabled={d.doc.items.length>=200||d.hidden} onClick={()=>{d.setTool(type);d.setSelectedId(null);}}><Icon size={15}/><span>{type==='horizontal'?'수평선':DRAWING_LABELS[type]}</span></button>)}</div>
    <div className="drawing-style-controls"><label className="drawing-color">색<input type="color" value={d.selected?.color||d.color} aria-label="그리기 색상" onChange={e=>d.setColor(e.target.value)}/></label><label>두께<select aria-label="그리기 두께" value={d.selected?.width||d.width} onChange={e=>d.setWidth(Number(e.target.value))}>{[1,2,3,4].map(n=><option key={n} value={n}>{n}px</option>)}</select></label><button className="icon-button" disabled={!d.canUndo} aria-label="그리기 실행 취소" title="실행 취소 Ctrl+Z" onClick={d.undo}><Undo2 size={15}/></button><button className="icon-button" disabled={!d.canRedo} aria-label="그리기 다시 실행" title="다시 실행 Ctrl+Shift+Z" onClick={d.redo}><Redo2 size={15}/></button><button className="icon-button" aria-label={d.hidden?'그리기 모두 표시':'그리기 모두 숨김'} title={d.hidden?'모두 표시':'모두 숨김'} onClick={()=>{d.setHidden(!d.hidden);d.setTool('select');}}>{d.hidden?<EyeOff size={15}/>:<Eye size={15}/>}</button><button className="icon-button" disabled={!d.selected} aria-label="선택한 그리기 삭제" title="선택한 그리기 삭제 · Delete" onClick={d.remove}><Trash2 size={15}/></button><button className="drawing-list-toggle" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>도형 {d.doc.items.length}<ChevronDown size={13}/></button></div>
    {(d.tool==='text'||d.selected?.type==='text')&&<label className="drawing-text-input">텍스트<input aria-label="차트 텍스트 내용" value={d.selected?.type==='text'?d.selected.text:d.text} maxLength={200} onChange={e=>d.selected?.type==='text'?d.patch(d.selected.id,{text:e.target.value}):d.setText(e.target.value)} placeholder="차트에 넣을 메모"/></label>}
    {expanded&&<div className="drawing-object-list"><p>이 종목의 그리기 · 이 브라우저에 저장</p>{!d.doc.items.length?<span>도구를 선택해 차트에 그려보세요.</span>:<><button className="clear-drawings" onClick={()=>{d.commit(EMPTY);d.setSelectedId(null);}}>이 종목 전체 삭제 (실행 취소 가능)</button>{d.doc.items.map((row,index)=><div key={row.id}><button className={d.selectedId===row.id?'active':''} onClick={()=>{d.setTool('select');d.setSelectedId(row.id);}}><i style={{background:row.color}}/>{DRAWING_LABELS[row.type]} {index+1}{row.type==='text'&&` · ${row.text.slice(0,24)}`}</button><button className="icon-button" aria-label={`${index+1}번 도형 ${row.visible?'숨김':'표시'}`} onClick={()=>d.patch(row.id,{visible:!row.visible})}>{row.visible?<Eye size={13}/>:<EyeOff size={13}/>}</button><button className="icon-button" aria-label={`${index+1}번 도형 삭제`} onClick={()=>{d.commit(previous=>({...previous,items:previous.items.filter(item=>item.id!==row.id)}));if(d.selectedId===row.id)d.setSelectedId(null);}}><X size={13}/></button></div>)}</>}</div>}
    <div className="drawing-hint" role="status">{d.hidden?'그리기 숨김 상태':d.tool==='select'?'도형을 선택해 끝점을 끌거나 전체를 이동하세요. Delete 삭제 · Ctrl+Z 실행 취소':d.tool==='horizontal'?'차트의 가격 위치를 클릭해 지지·저항선을 놓으세요.':d.tool==='text'?'내용을 입력한 뒤 차트에서 표시할 위치를 클릭하세요.':'시작점 클릭 → 끝점 클릭으로 완성합니다. Esc 취소'}{d.error&&<span className="error-text">{d.error}</span>}{d.doc.items.length>=200&&<span>종목당 최대 200개입니다.</span>}</div>
  </div>;
}
function Shape({row,plotWidth,markerId,hit=false}){
  const a=row.points[0],b=row.points[1]||a,props={fill:'none',stroke:hit?'transparent':row.color,strokeWidth:hit?Math.max(14,row.width):row.width,vectorEffect:'non-scaling-stroke',pointerEvents:hit?'stroke':'none'};
  if(row.type==='horizontal')return <g><line {...props} x1={0} y1={a.y} x2={plotWidth} y2={a.y}/>{!hit&&<text x={plotWidth-6} y={a.y-5} textAnchor="end" fontSize={11} fill={row.color} stroke="#fff" strokeWidth={3} paintOrder="stroke" pointerEvents="none">{row.priceLabel||row.points[0].priceLabel}</text>}</g>;
  if(row.type==='trend'||row.type==='arrow')return <line {...props} x1={a.x} y1={a.y} x2={b.x} y2={b.y} markerEnd={!hit&&row.type==='arrow'?`url(#${markerId})`:undefined}/>;
  if(row.type==='rectangle')return <rect {...props} x={Math.min(a.x,b.x)} y={Math.min(a.y,b.y)} width={Math.max(1,Math.abs(a.x-b.x))} height={Math.max(1,Math.abs(a.y-b.y))} fill={hit?'transparent':row.color} fillOpacity={hit?1:.07} pointerEvents={hit?'all':'none'}/>;
  if(row.type==='ellipse')return <ellipse {...props} cx={(a.x+b.x)/2} cy={(a.y+b.y)/2} rx={Math.max(1,Math.abs(a.x-b.x)/2)} ry={Math.max(1,Math.abs(a.y-b.y)/2)} fill={hit?'transparent':row.color} fillOpacity={hit?1:.07} pointerEvents={hit?'all':'none'}/>;
  return hit?<rect x={a.x-3} y={a.y-18} width={Math.max(30,[...row.text].length*13)} height={24} fill="transparent" pointerEvents="all"/>:<text x={a.x} y={a.y} fill={row.color} fontSize={14} fontWeight="550" pointerEvents="none" paintOrder="stroke" stroke="#fff" strokeWidth={3}>{row.text}</text>;
}
export function paintDrawing(ctx,row,plotWidth){
  const a=row.points[0],b=row.points[1]||a;ctx.save();ctx.strokeStyle=row.color;ctx.fillStyle=row.color;ctx.lineWidth=row.width;ctx.beginPath();
  if(row.type==='horizontal'){ctx.moveTo(0,a.y);ctx.lineTo(plotWidth,a.y);if(row.priceLabel){ctx.font='11px sans-serif';ctx.textAlign='right';ctx.fillText(row.priceLabel,plotWidth-6,a.y-5);}}
  else if(row.type==='trend'||row.type==='arrow'){ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);if(row.type==='arrow'){const angle=Math.atan2(b.y-a.y,b.x-a.x),size=10+row.width;ctx.moveTo(b.x-size*Math.cos(angle-.45),b.y-size*Math.sin(angle-.45));ctx.lineTo(b.x,b.y);ctx.lineTo(b.x-size*Math.cos(angle+.45),b.y-size*Math.sin(angle+.45));}}
  else if(row.type==='rectangle')ctx.rect(Math.min(a.x,b.x),Math.min(a.y,b.y),Math.abs(a.x-b.x),Math.abs(a.y-b.y));
  else if(row.type==='ellipse')ctx.ellipse((a.x+b.x)/2,(a.y+b.y)/2,Math.abs(a.x-b.x)/2,Math.abs(a.y-b.y)/2,0,0,Math.PI*2);
  else {ctx.font='550 14px sans-serif';ctx.fillText(row.text,a.x,a.y);}
  ctx.stroke();if(row.type==='rectangle'||row.type==='ellipse'){ctx.globalAlpha=.07;ctx.fill();}ctx.restore();
}
export function DrawingLayer({api,drawing}){
  const d=drawing,svg=useRef(null),dRef=useRef(d),gesture=useRef(null),[draft,setDraft]=useState(null),[hover,setHover]=useState(null),[moving,setMoving]=useState(null),[revision,setRevision]=useState(0),id=useId().replace(/:/g,'');dRef.current=d;
  useEffect(()=>{setDraft(null);setHover(null);},[d.tool]);
  useEffect(()=>{if(!api)return;const listener=()=>setRevision(n=>n+1);api.drawingListeners.add(listener);listener();return()=>api.drawingListeners.delete(listener);},[api]);
  useEffect(()=>{
    function keydown(e){if(!svg.current?.closest('.chart-drawing-workspace')?.contains(document.activeElement)||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.target.isContentEditable)return;const value=dRef.current;if(e.key==='Escape'){setDraft(null);setMoving(null);gesture.current=null;value.setTool('select');value.setSelectedId(null);}else if(e.key==='Delete'||e.key==='Backspace'){if(value.selectedId){e.preventDefault();value.remove();}}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)value.redo();else value.undo();}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();value.redo();}}
    document.addEventListener('keydown',keydown);return()=>document.removeEventListener('keydown',keydown);
  },[]);
  const times=useMemo(()=>api?.data.map(bar=>timeStamp(bar.time))||[],[api,api?.data]);
  const timeMap=useMemo(()=>drawingTimeMap(api?.data||[],api?.timeZone||'UTC'),[api,api?.data,api?.timeZone]);
  if(!api||api.disposed||!api.data.length)return null;
  const plotWidth=Math.max(0,api.chart.timeScale().width()),height=api.chart.panes()[0].getHeight();
  function project(point){const logical=logicalAtTime(chartAnchorTime(point,timeMap),times),x=api.chart.timeScale().logicalToCoordinate(logical),y=api.candles.priceToCoordinate(point.price);return x===null||y===null?null:{x,y};}
  function anchor(event){const rect=svg.current.getBoundingClientRect(),x=Math.max(0,Math.min(plotWidth,event.clientX-rect.left)),y=Math.max(0,Math.min(height,event.clientY-rect.top)),logical=api.chart.timeScale().coordinateToLogical(x),price=api.candles.coordinateToPrice(y);const point=anchorAtLogical(logical,price,times);return point?{...point,dateOnly:typeof api.data[0].time==='string'}:null;}
  function create(event){
    if(d.tool==='select'){d.setSelectedId(null);return;}event.preventDefault();event.stopPropagation();svg.current.focus();const point=anchor(event);if(!point)return;
    if(d.tool==='text'&&!d.text.trim())return;
    if(d.tool==='horizontal'||d.tool==='text'||draft){const row={id:crypto.randomUUID(),type:d.tool,points:draft?[draft,point]:[point],color:d.color,width:d.width,text:d.text.trim(),visible:true};d.commit(previous=>({...previous,items:[...previous.items,row]}));d.setSelectedId(row.id);d.setTool('select');setDraft(null);setHover(null);}else {setDraft(point);setHover(point);}
  }
  function startMove(event,row,index){if(d.tool!=='select')return;event.preventDefault();event.stopPropagation();svg.current.focus();d.setSelectedId(row.id);const start=anchor(event);if(!start)return;gesture.current={row,start,index,pointer:event.pointerId};svg.current.setPointerCapture(event.pointerId);}
  function move(event){
    const point=anchor(event);if(!point)return;
    if(gesture.current){const {row,start,index}=gesture.current;setMoving(index===null?translateDrawing(row,point.time-start.time,point.price-start.price):{...row,points:row.points.map((p,i)=>i===index?point:p)});}else if(d.tool!=='select')setHover(point);
  }
  function endMove(event,cancel=false){if(!gesture.current)return;const {row:original,start,index}=gesture.current,point=anchor(event);gesture.current=null;if(!cancel&&point){const next=index===null?translateDrawing(original,point.time-start.time,point.price-start.price):{...original,points:original.points.map((p,i)=>i===index?point:p)};if(JSON.stringify(next.points)!==JSON.stringify(original.points))d.patch(original.id,{points:next.points});}setMoving(null);if(svg.current.hasPointerCapture(event.pointerId))svg.current.releasePointerCapture(event.pointerId);}
  const rows=d.hidden?[]:d.doc.items.filter(row=>row.visible).map(row=>projectDrawing({...((moving?.id===row.id)?moving:row),priceLabel:(moving?.id===row.id?moving:row).points[0].price.toLocaleString('ko-KR',{maximumFractionDigits:2})},project)).filter(Boolean),preview=d.tool!=='select'&&hover?projectDrawing({id:'preview',type:d.tool,points:draft?[draft,hover]:d.tool==='horizontal'||d.tool==='text'?[hover]:[hover,hover],color:d.color,width:d.width,text:d.text},project):null;
  // Reproject all anchors after each chart viewport notification, including price-axis drags.
  void revision;
  api.projectDrawing=point=>project(point);api.renderedDrawings=rows;
  return <svg ref={svg} className={`chart-drawing-layer ${d.tool!=='select'?'is-drawing':''}`} width={plotWidth} height={height} viewBox={`0 0 ${plotWidth} ${height}`} tabIndex={-1} role="group" aria-label="차트 그리기 영역" onPointerDown={create} onPointerMove={move} onPointerUp={e=>endMove(e)} onPointerCancel={e=>endMove(e,true)} onLostPointerCapture={()=>{gesture.current=null;setMoving(null);}} onPointerLeave={()=>{if(!draft&&!gesture.current)setHover(null);}}>
    {rows.map(row=><g key={row.id}><defs><marker id={`${id}-${row.id}`} markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto-start-reverse"><path d="M 0 0 L 9 4.5 L 0 9 Z" fill={row.color}/></marker></defs><Shape row={row} plotWidth={plotWidth} markerId={`${id}-${row.id}`}/><g className="drawing-hit" onPointerDown={e=>startMove(e,d.doc.items.find(item=>item.id===row.id),null)}><Shape row={row} plotWidth={plotWidth} markerId={`${id}-${row.id}`} hit/></g>{d.selectedId===row.id&&row.points.map((p,index)=><circle key={index} cx={p.x} cy={p.y} r={5} fill="#fff" stroke={row.color} strokeWidth={2} pointerEvents="all" className="drawing-anchor" onPointerDown={e=>startMove(e,d.doc.items.find(item=>item.id===row.id),index)}/>)}</g>)}
    {preview&&<g opacity=".65" pointerEvents="none"><Shape row={preview} plotWidth={plotWidth} markerId={`${id}-preview`}/><circle cx={preview.points[0].x} cy={preview.points[0].y} r={4} fill="#fff" stroke={d.color}/></g>}
    {draft&&<text x={12} y={height-14} fontSize={12} fill="#52637c" pointerEvents="none">끝점을 클릭하세요 · Esc 취소</text>}
  </svg>;
}
