import React,{useEffect,useRef,useState} from 'react';
import {X} from 'lucide-react';
import {createChart,CandlestickSeries,LineSeries,HistogramSeries,ColorType,CrosshairMode} from 'lightweight-charts';
import {aggregate,rsLine,volumeProfile} from './analysis.js';
import {indicatorDefinition,nextLogicalRange,studyLabel} from './indicators.js';
import {calculateStudy} from './indicator-calculations.js';
import {movingAveragePoints,movingAverageValues,profileValueArea,formatVolume,resolveCandle} from './technical-math.js';
import {useDrawings,DrawingToolbar,DrawingLayer,paintDrawing} from './DrawingTools.jsx';
const timeKey=t=>typeof t==='string'?t:typeof t==='number'?new Date(t*1000).toISOString().slice(0,10):`${t.year}-${String(t.month).padStart(2,'0')}-${String(t.day).padStart(2,'0')}`;
const number=(value,format)=>!Number.isFinite(value)?'—':format==='shares'?formatVolume(value):format==='volume'?Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:2}).format(value):`${value.toLocaleString('ko-KR',{maximumFractionDigits:3})}${format==='percent'?'%':''}`;

export default function Chart({drawingKey,bars,benchmark,interval,range,showRS,showVolume,showProfile,movingAverages,volumeSettings,profileSettings,studies,onRemoveStudy,onEditStudies,onHover,onReady}){
  const drawing=useDrawings(drawingKey),[drawingApi,setDrawingApi]=useState(null);
  const host=useRef(null),runtime=useRef(null),profileOptions=useRef({...profileSettings,visible:showProfile}),callbacks=useRef({}),[profile,setProfile]=useState([]),[profileHeight,setProfileHeight]=useState(360),[readouts,setReadouts]=useState([]),[paneTops,setPaneTops]=useState({}),[axisWidth,setAxisWidth]=useState(70),[profileWidth,setProfileWidth]=useState(150),[profileSummary,setProfileSummary]=useState(null);
  callbacks.current={onHover,onReady,onRemoveStudy,onEditStudies};profileOptions.current={...profileSettings,visible:showProfile};
  const studyKey=JSON.stringify(studies),averageKey=JSON.stringify(movingAverages),volumeKey=JSON.stringify(volumeSettings),profileKey=JSON.stringify(profileSettings),panelCount=Number(showVolume)+Number(showRS&&benchmark.length>0)+studies.filter(s=>s.visible&&indicatorDefinition(s.type)?.placement==='panel').length;

  useEffect(()=>{
    const container=host.current;
    const chart=createChart(container,{autoSize:true,layout:{background:{type:ColorType.Solid,color:'#fff'},textColor:'#7b8495',fontFamily:'Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',fontSize:11,panes:{separatorColor:'#e0e6ef',separatorHoverColor:'#b8c9e8',enableResize:true}},grid:{vertLines:{color:'#f3f5f8'},horzLines:{color:'#f0f3f7'}},rightPriceScale:{borderColor:'#edf0f5',minimumWidth:70,scaleMargins:{top:.13,bottom:.08}},timeScale:{borderColor:'#e9edf3',rightOffset:6,timeVisible:false},crosshair:{mode:CrosshairMode.Normal,vertLine:{color:'#9ea8b9',labelBackgroundColor:'#68748a'},horzLine:{color:'#9ea8b9',labelBackgroundColor:'#68748a'}},localization:{locale:'ko-KR'}});
    const candles=chart.addSeries(CandlestickSeries,{upColor:'#0baf8c',downColor:'#ef5b68',borderVisible:false,wickUpColor:'#0baf8c',wickDownColor:'#ef5b68'});
    const state={chart,candles,series:[],groups:[],data:[],candleMap:new Map(),previous:null,profileLines:[],frame:0,profile:[],axisWidth:70,disposed:false,drawingListeners:new Set()};runtime.current=state;setDrawingApi(state);
    function readValues(event){
      const lastTime=state.data.at(-1)?.time;
      setReadouts(state.groups.map(group=>({...group,values:group.members.map(member=>{const last=member.data.at(-1),value=event?.time?event.seriesData.get(member.api)?.value:last?.time===lastTime?last.value:null;return {name:member.name,value:number(value,member.format),color:member.color};})})));
    }
    state.readValues=readValues;
    const update=()=>{
      if(state.disposed)return;cancelAnimationFrame(state.frame);state.frame=requestAnimationFrame(()=>{
        if(state.disposed||!state.data.length)return;
        const panes=chart.panes(),tops={};let top=0;
        for(let index=0;index<panes.length;index++){tops[index]=top;top+=panes[index].getHeight();}
        setPaneTops(previous=>JSON.stringify(previous)===JSON.stringify(tops)?previous:tops);setProfileHeight(panes[0].getHeight());
        for(const listener of state.drawingListeners)listener();
        state.axisWidth=chart.priceScale('right').width()||70;setAxisWidth(state.axisWidth);
        for(const priceLine of state.profileLines)candles.removePriceLine(priceLine);state.profileLines=[];
        const options=profileOptions.current;
        if(!options.visible){state.profile=[];setProfile(previous=>previous.length?[]:previous);setProfileSummary(null);return;}
        const visible=chart.timeScale().getVisibleRange(),subset=options.mode==='recent'?state.data.slice(-options.fixedBars):visible?state.data.filter(b=>b.time>=timeKey(visible.from)&&b.time<=timeKey(visible.to)):state.data,bins=volumeProfile(subset,options.rows),max=Math.max(1,...bins.map(b=>b.volume)),area=profileValueArea(bins,options.valueArea),width=Math.min(options.width,Math.max(40,container.clientWidth-state.axisWidth-12));
        setProfileWidth(width);setProfileSummary(area);
        state.profile=bins.map((b,i)=>({...b,poc:i===area?.poc,inValueArea:!!area&&i>=area.low&&i<=area.high,y1:candles.priceToCoordinate(b.high),y2:candles.priceToCoordinate(b.low),width:b.volume/max*(width-8)})).filter(b=>b.y1!==null&&b.y2!==null);setProfile(state.profile);
        if(area){
          if(options.showPOC)state.profileLines.push(candles.createPriceLine({price:area.pocPrice,color:options.pocColor,lineWidth:2,lineStyle:2,axisLabelVisible:true,title:'POC'}));
          if(options.showVA)for(const [title,price] of [['VAH',area.vah],['VAL',area.val]])state.profileLines.push(candles.createPriceLine({price,color:options.color,lineWidth:1,lineStyle:2,axisLabelVisible:true,title}));
        }
      });
    };
    state.schedule=update;
    const crosshair=event=>{const bar=event.seriesData.get(candles);callbacks.current.onHover?.(bar?.close?resolveCandle(state.candleMap,event.time):null);readValues(event);};
    const dragged=event=>{if(event.buttons)update();};
    chart.subscribeCrosshairMove(crosshair);chart.timeScale().subscribeVisibleLogicalRangeChange(update);
    const observer=new ResizeObserver(update);observer.observe(container);container.addEventListener('pointerup',update);container.addEventListener('pointermove',dragged);container.addEventListener('wheel',update,{passive:true});
    callbacks.current.onReady?.({reset:()=>chart.timeScale().fitContent(),screenshot:()=>{
      const canvas=chart.takeScreenshot(),ctx=canvas.getContext('2d'),ratio=canvas.width/container.clientWidth;ctx.save();ctx.scale(ratio,ratio);ctx.beginPath();ctx.rect(0,0,container.clientWidth-state.axisWidth,chart.panes()[0].getHeight());ctx.clip();
      for(const b of state.profile){ctx.fillStyle=b.poc?profileOptions.current.pocColor:profileOptions.current.color;ctx.globalAlpha=b.poc ? .5 : b.inValueArea ? .3 : .13;ctx.fillRect(container.clientWidth-state.axisWidth-b.width,b.y1,b.width,Math.max(1,b.y2-b.y1-1));}ctx.globalAlpha=1;for(const row of state.renderedDrawings||[])paintDrawing(ctx,row,chart.timeScale().width());ctx.restore();
      const a=document.createElement('a');a.download='jins-trading-chart.png';a.href=canvas.toDataURL('image/png');a.click();
    }});
    return()=>{state.disposed=true;state.drawingListeners.clear();cancelAnimationFrame(state.frame);observer.disconnect();container.removeEventListener('pointerup',update);container.removeEventListener('pointermove',dragged);container.removeEventListener('wheel',update);chart.unsubscribeCrosshairMove(crosshair);chart.timeScale().unsubscribeVisibleLogicalRangeChange(update);chart.remove();runtime.current=null;callbacks.current.onReady?.(null);};
  },[]);

  useEffect(()=>{
    const state=runtime.current;if(!state||!bars.length)return;
    const {chart,candles}=state,data=aggregate(bars,interval),previous=state.previous,visible=chart.timeScale().getVisibleLogicalRange();
    const preserve=nextLogicalRange(visible,{dataChanged:previous?.bars!==bars,intervalChanged:previous?.interval!==interval,rangeChanged:previous?.range!==range,oldLength:state.data.length,newLength:data.length});
    const paneHeights=new Map(state.groups.filter(group=>group.pane>0).map(group=>[group.id,group.members[0].api.getPane().getHeight()]));
    for(const series of state.series)chart.removeSeries(series);state.series=[];state.groups=[];state.data=data;state.candleMap=new Map(data.map(bar=>[bar.time,bar]));
    candles.applyOptions({priceFormat:{type:'price',precision:data.at(-1).close<10?3:2,minMove:data.at(-1).close<10?.001:.01}});candles.setData(data);
    let nextPane=1;
    function add(spec,pane,bounds){
      const options={color:spec.color,lineWidth:spec.width||1,priceLineVisible:spec.priceLine===true,lastValueVisible:pane>0,title:'',crosshairMarkerVisible:true};
      if(spec.format==='volume')options.priceFormat={type:'volume'};
      if(spec.format==='shares')options.priceFormat={type:'custom',minMove:1,formatter:value=>formatVolume(value)};
      if(spec.format==='percent')options.priceFormat={type:'custom',minMove:.001,formatter:value=>`${value.toFixed(2)}%`};
      if(bounds)options.autoscaleInfoProvider=()=>({priceRange:{minValue:bounds[0],maxValue:bounds[1]}});
      const api=chart.addSeries(spec.kind==='histogram'?HistogramSeries:LineSeries,options,pane);
      api.setData(spec.kind==='histogram'?spec.data.map(p=>({...p,color:p.color||(p.value>=0?'#77c7b2':'#ef9ca5')})):spec.data);state.series.push(api);return {...spec,api};
    }
    chart.applyOptions({rightPriceScale:{minimumWidth:showVolume&&volumeSettings.format==='shares'?106:70}});
    for(const ma of movingAverages){if(!ma.visible)continue;const label=ma.type.toUpperCase()+' '+ma.period,member=add({name:label,color:ma.color,width:ma.width,data:movingAveragePoints(ma,data)},0);state.groups.push({id:ma.id,label,pane:0,color:ma.color,members:[member]});}
    if(showVolume){
      const pane=nextPane++,format=volumeSettings.format==='shares'?'shares':'volume',members=[add({name:'거래량',color:'#439d88',kind:volumeSettings.mode==='line'?'line':'histogram',priceLine:true,width:2,format,data:data.filter(b=>Number.isFinite(b.volume)).map(b=>({time:b.time,value:b.volume,color:b.close>=b.open?'#a1ded1':'#f6bcc1'}))},pane)];
      if(volumeSettings.averageVisible){const values=movingAverageValues(volumeSettings.averageType,data.map(b=>b.volume),volumeSettings.averagePeriod);members.push(add({name:volumeSettings.averageType.toUpperCase()+' '+volumeSettings.averagePeriod,color:volumeSettings.averageColor,width:volumeSettings.averageWidth,format,data:values.flatMap((value,i)=>Number.isFinite(value)?[{time:data[i].time,value}]:[])},pane));}
      state.groups.push({id:'volume',label:'거래량',pane,color:'#439d88',members});
    }
    if(showRS&&benchmark.length){const pane=nextPane++,member=add({name:'RS',color:'#8765df',data:rsLine(data,aggregate(benchmark,interval))},pane);state.groups.push({id:'rs',label:'지수 대비 RS',pane,color:member.color,members:[member]});}
    for(const study of studies){
      if(!study.visible)continue;const definition=indicatorDefinition(study.type),calculation=calculateStudy(study,data),pane=definition.placement==='panel'?nextPane++:0;
      const specs=calculation.series.length?calculation.series:[{name:definition.short,color:study.color,data:[]}],members=specs.map(spec=>add({...spec,width:study.width||1},pane,calculation.bounds));
      for(const value of calculation.bands)members[0].api.createPriceLine({price:value,color:'#b2bdcf',lineWidth:1,lineStyle:2,axisLabelVisible:false});
      state.groups.push({id:study.id,label:studyLabel(study),pane,color:study.color,members});
    }
    let panelHeight=0;for(const group of state.groups.filter(group=>group.pane>0)){const height=paneHeights.get(group.id)||120;chart.panes()[group.pane].setHeight(height);panelHeight+=height;}
    chart.panes()[0].setHeight(Math.max(160,host.current.clientHeight-panelHeight-28));
    if(preserve)chart.timeScale().setVisibleLogicalRange(preserve);
    else if(range==='ALL')chart.timeScale().fitContent();
    else{const last=new Date(data.at(-1).time+'T00:00:00Z'),from=new Date(last.getTime()-Number(range)*86400000).toISOString().slice(0,10);chart.timeScale().setVisibleRange({from:from<data[0].time?data[0].time:from,to:data.at(-1).time});}
    state.previous={bars,interval,range};state.readValues();state.schedule();callbacks.current.onHover?.(null);
  },[bars,benchmark,interval,range,showRS,showVolume,averageKey,volumeKey,studyKey]);

  useEffect(()=>{runtime.current?.schedule();},[showProfile,profileKey]);
  const renderReadout=row=><div className="chart-study-readout" key={row.id}><button className="study-readout-name" style={{color:row.color}} onClick={()=>callbacks.current.onEditStudies?.(row.id)}>{row.label}</button><span>{row.values.map(value=><span key={value.name} style={{color:value.color}} title={value.name}>{row.values.length>1?`${value.name} `:''}<b>{value.value}</b></span>)}</span><button className="remove-chart-study" aria-label={`${row.label} 차트에서 제거`} onClick={()=>callbacks.current.onRemoveStudy?.(row.id)}><X size={11}/></button></div>;
  return <div className="chart-drawing-workspace"><DrawingToolbar drawing={drawing}/><div className="chart-canvas-wrap with-studies" style={{'--chart-axis-width':axisWidth+'px',height:`calc(var(--price-pane-height, 360px) + ${panelCount*120+28}px)`}}><div className="chart-watermark" style={{top:Math.max(90,profileHeight*.4)}} aria-hidden="true">Jin's Trading<span>진스트레이딩</span></div><div className="chart-canvas" ref={host}/><div className="chart-overlay-readouts">{readouts.filter(r=>r.pane===0).map(renderReadout)}{showProfile&&renderReadout({id:'volumeProfile',label:'매물대 (추정)',color:profileSettings.color,values:[['POC',profileSummary?.pocPrice],['VAH',profileSummary?.vah],['VAL',profileSummary?.val]].map(([name,value])=>({name,value:number(value),color:name==='POC'?profileSettings.pocColor:profileSettings.color}))})}</div>{readouts.filter(r=>r.pane>0).map(row=><div className="chart-pane-readout" key={row.id} style={{top:(paneTops[row.pane]||0)+6}}>{renderReadout(row)}</div>)}{showProfile&&<svg className="volume-profile" width={profileWidth} height={profileHeight} aria-label="표시 구간 거래량 프로파일 추정"><title>캔들 고저 범위에 거래량을 균등 배분한 추정치</title>{profile.map((b,i)=><rect key={i} x={profileWidth-b.width} y={b.y1} width={b.width} height={Math.max(1,b.y2-b.y1-1)} fill={b.poc?profileSettings.pocColor:profileSettings.color} opacity={b.poc ? .5 : b.inValueArea ? .3 : .13}/>)}</svg>}<DrawingLayer key={drawingKey} api={drawingApi} drawing={drawing}/></div></div>;
}
