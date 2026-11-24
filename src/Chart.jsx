import React,{useCallback,useEffect,useRef,useState} from 'react';
import {X} from 'lucide-react';
import {createChart,CandlestickSeries,LineSeries,HistogramSeries,ColorType,CrosshairMode,LineStyle} from 'lightweight-charts';
import {aggregate,rsLine,volumeProfile} from './analysis.js';
import {indicatorDefinition,nextLogicalRange,studyLabel} from './indicators.js';
import {calculateStudy} from './indicator-calculations.js';
import {movingAveragePoints,movingAverageValues,profileValueArea,formatVolume,resolveCandle,chartTimeKey} from './technical-math.js';
import {CHART_COLORS,volumePoints} from './chart-colors.js';
import {useDrawings,DrawingToolbar,DrawingLayer,paintDrawing} from './DrawingTools.jsx';
import {attachChartWatermark} from './chart-watermark.js';
import {uploadedRS} from './pine-minervini.js';
import {isIntraday,formatBarTime,tickTime} from './timeframes.js';
import {chartAnchor,nearestAverage} from './chart-interactions.js';
import ChartContextMenu from './ChartContextMenu.jsx';
import {nearestTimeBar} from './workspace-model.js';
import {TrendLearningLayer,TrendLearningGuide,paintLearning} from './TrendLearning.jsx';
const timeKey=chartTimeKey;
const number=(value,format,unit='주',precision=3)=>!Number.isFinite(value)?'—':format==='koVolume'?formatVolume(value,'korean',unit):format==='shares'?formatVolume(value,'shares',unit):format==='volume'?Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:2}).format(value):`${value.toLocaleString('ko-KR',{maximumFractionDigits:Math.max(3,precision)})}${format==='percent'?'%':''}`;

export default function Chart({symbol,showTickerWatermark,rsMode,rsAsOf,timeZone,drawingKey,bars,benchmark,interval,range,showRS,showVolume,showProfile,movingAverages,volumeSettings,profileSettings,studies,onRemoveStudy,onEditStudies,onHover,onReady,onAlert,volumeUnit='주',pricePrecision,syncHub,syncId='main',syncOptions,replay=false}){
  const [menu,setMenu]=useState(null),closeMenu=useCallback(()=>setMenu(null),[]);
  const drawing=useDrawings(drawingKey,{temporary:replay}),[drawingApi,setDrawingApi]=useState(null);
  const host=useRef(null),runtime=useRef(null),profileOptions=useRef({...profileSettings,visible:showProfile}),callbacks=useRef({}),[profile,setProfile]=useState([]),[profileHeight,setProfileHeight]=useState(360),[readouts,setReadouts]=useState([]),[paneTops,setPaneTops]=useState({}),[axisWidth,setAxisWidth]=useState(70),[profileWidth,setProfileWidth]=useState(150),[profileSummary,setProfileSummary]=useState(null);
  callbacks.current={onHover,onReady,onRemoveStudy,onEditStudies,onAlert,symbol,showTickerWatermark,volumeUnit,pricePrecision,syncHub,syncId,syncOptions,replay};profileOptions.current={...profileSettings,visible:showProfile};
  const studyKey=JSON.stringify(studies),averageKey=JSON.stringify(movingAverages),volumeKey=JSON.stringify(volumeSettings),profileKey=JSON.stringify(profileSettings),panelCount=Number(showVolume)+Number(showRS&&(rsMode==='uploaded'||benchmark.length>0))+studies.filter(s=>s.visible&&indicatorDefinition(s.type)?.placement==='panel').length;

  useEffect(()=>{
    const container=host.current;
    const chart=createChart(container,{autoSize:true,layout:{background:{type:ColorType.Solid,color:'#fff'},textColor:'#7b8495',fontFamily:'Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',fontSize:11,panes:{separatorColor:'#e0e6ef',separatorHoverColor:'#b8c9e8',enableResize:true}},grid:{vertLines:{color:'#f3f5f8'},horzLines:{color:'#f0f3f7'}},rightPriceScale:{borderColor:'#edf0f5',minimumWidth:70,scaleMargins:{top:.13,bottom:.08}},timeScale:{borderColor:'#e9edf3',rightOffset:6,timeVisible:false},crosshair:{mode:CrosshairMode.Normal,vertLine:{color:'#9ea8b9',labelBackgroundColor:'#68748a'},horzLine:{color:'#9ea8b9',labelBackgroundColor:'#68748a'}},localization:{locale:'ko-KR'}});
    const candles=chart.addSeries(CandlestickSeries,{upColor:CHART_COLORS.up,downColor:CHART_COLORS.down,borderVisible:false,wickUpColor:CHART_COLORS.up,wickDownColor:CHART_COLORS.down});
    const watermark=attachChartWatermark(chart.panes()[0],{symbol:callbacks.current.symbol,showTicker:callbacks.current.showTickerWatermark});
    const state={chart,candles,watermark,series:[],groups:[],data:[],candleMap:new Map(),previous:null,profileLines:[],frame:0,profile:[],axisWidth:70,disposed:false,drawingListeners:new Set()};runtime.current=state;setDrawingApi(state);
    candles.applyOptions({autoscaleInfoProvider:original=>{const info=original(),bounds=state.learningScaleBounds;return !info||!bounds?info:{...info,priceRange:{minValue:Math.min(info.priceRange.minValue,bounds[0]),maxValue:Math.max(info.priceRange.maxValue,bounds[1])}};}});
    function readValues(event){
      const lastTime=state.data.at(-1)?.time;
      setReadouts(state.groups.map(group=>({...group,values:group.members.map(member=>{const last=member.data.at(-1),value=event?.time?event.seriesData.get(member.api)?.value:last&&(last.time===lastTime||member.confirmed)?last.value:null,point=member.pointColors?.get(event?.time?timeKey(event.time):lastTime);return {name:member.name,value:number(value,member.format,callbacks.current.volumeUnit,callbacks.current.pricePrecision??3),color:point||member.color};})})));
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
    const crosshair=event=>{const bar=event.seriesData.get(candles);callbacks.current.onHover?.(bar?.close?resolveCandle(state.candleMap,event.time):null);readValues(event);if(callbacks.current.syncOptions?.syncCrosshair)callbacks.current.syncHub?.publish(callbacks.current.syncId,{type:'crosshair',time:event.time??null});};
    const dragged=event=>{if(event.buttons)update();};
    const doubleClick=event=>{const id=nearestAverage(state,event.point);if(id)callbacks.current.onEditStudies?.(id);};
    chart.subscribeDblClick(doubleClick);chart.subscribeCrosshairMove(crosshair);chart.timeScale().subscribeVisibleLogicalRangeChange(update);
    const observer=new ResizeObserver(update);observer.observe(container);container.addEventListener('pointerup',update);container.addEventListener('pointermove',dragged);container.addEventListener('wheel',update,{passive:true});
    const readyApi={reset:()=>chart.timeScale().fitContent(),latest:()=>chart.timeScale().scrollToRealTime(),screenshot:()=>{
      const canvas=chart.takeScreenshot(),ctx=canvas.getContext('2d'),ratio=canvas.width/container.clientWidth;ctx.save();ctx.scale(ratio,ratio);ctx.beginPath();ctx.rect(0,0,container.clientWidth-state.axisWidth,chart.panes()[0].getHeight());ctx.clip();
      for(const b of state.profile){ctx.fillStyle=b.poc?profileOptions.current.pocColor:profileOptions.current.color;ctx.globalAlpha=b.poc ? .5 : b.inValueArea ? .3 : .13;ctx.fillRect(container.clientWidth-state.axisWidth-b.width,b.y1,b.width,Math.max(1,b.y2-b.y1-1));}ctx.globalAlpha=1;paintLearning(ctx,state.learningRendered||[],chart.timeScale().width(),chart.panes()[0].getHeight());for(const row of state.renderedDrawings||[])paintDrawing(ctx,row,chart.timeScale().width());ctx.restore();
      if(callbacks.current.replay){ctx.save();ctx.font='14px sans-serif';ctx.fillStyle='#555';ctx.fillText('과거 봉 리플레이 · '+callbacks.current.symbol,12,canvas.height-12);ctx.restore();}const a=document.createElement('a');a.download=callbacks.current.replay?'jins-trading-replay.png':'jins-trading-chart.png';a.href=canvas.toDataURL('image/png');a.click();
    }};state.publicApi=readyApi;callbacks.current.onReady?.(readyApi);
    return()=>{state.disposed=true;state.drawingListeners.clear();cancelAnimationFrame(state.frame);observer.disconnect();container.removeEventListener('pointerup',update);container.removeEventListener('pointermove',dragged);container.removeEventListener('wheel',update);chart.unsubscribeDblClick(doubleClick);chart.unsubscribeCrosshairMove(crosshair);chart.timeScale().unsubscribeVisibleLogicalRangeChange(update);watermark.detach();chart.remove();runtime.current=null;callbacks.current.onReady?.(null);};
  },[]);

  useEffect(()=>{
    const state=runtime.current;if(!state||!bars.length)return;
    state.timeZone=timeZone;state.chart.applyOptions({localization:{timeFormatter:time=>formatBarTime(time,timeZone)},timeScale:{timeVisible:isIntraday(interval),secondsVisible:false,tickMarkFormatter:isIntraday(interval)?(time,kind)=>tickTime(time,kind,timeZone):undefined}});
    const {chart,candles}=state,data=aggregate(bars,interval),previous=state.previous,visible=chart.timeScale().getVisibleLogicalRange();
    const preserve=nextLogicalRange(visible,{dataChanged:previous?.bars!==bars,intervalChanged:previous?.interval!==interval,rangeChanged:previous?.range!==range,oldLength:state.data.length,newLength:data.length});
    const paneHeights=new Map(state.groups.filter(group=>group.pane>0).map(group=>[group.id,group.members[0].api.getPane().getHeight()]));
    for(const series of state.series)chart.removeSeries(series);state.series=[];state.groups=[];state.data=data;state.candleMap=new Map(data.map(bar=>[bar.time,bar]));
    candles.applyOptions({priceFormat:{type:'price',precision:pricePrecision??(data.at(-1).close<10?3:2),minMove:10**-(pricePrecision??(data.at(-1).close<10?3:2))}});candles.setData(data);
    host.current.dataset.lastBar=String(data.at(-1).time);host.current.dataset.symbol=symbol;
    let nextPane=1;
    function add(spec,pane,bounds){
      const options={color:spec.color,lineWidth:spec.width||1,lineStyle:spec.lineStyle==='dotted'?LineStyle.Dotted:LineStyle.Solid,priceLineVisible:spec.priceLine===true,lastValueVisible:pane>0,title:'',crosshairMarkerVisible:true};
      if(spec.format==='volume')options.priceFormat={type:'volume'};
      if(spec.format==='koVolume')options.priceFormat={type:'custom',minMove:1,formatter:value=>formatVolume(value,'korean',volumeUnit)};
      if(spec.format==='shares')options.priceFormat={type:'custom',minMove:1,formatter:value=>formatVolume(value,'shares',volumeUnit)};
      if(spec.format==='percent')options.priceFormat={type:'custom',minMove:.001,formatter:value=>`${value.toFixed(2)}%`};
      if(bounds)options.autoscaleInfoProvider=()=>({priceRange:{minValue:bounds[0],maxValue:bounds[1]}});
      const api=chart.addSeries(spec.kind==='histogram'?HistogramSeries:LineSeries,options,pane);
      api.setData(spec.kind==='histogram'?spec.data.map(p=>({...p,color:p.color||(p.value>=0?'#77c7b2':'#ef9ca5')})):spec.data);state.series.push(api);return {...spec,api,pointColors:spec.name==='거래량'?new Map(spec.data.map(point=>[point.time,point.color])):null};
    }
    chart.applyOptions({rightPriceScale:{minimumWidth:showVolume&&volumeSettings.format==='shares'?106:70}});
    for(const ma of movingAverages){if(!ma.visible)continue;const label=ma.type.toUpperCase()+' '+ma.period,member=add({name:label,color:ma.color,width:ma.width,data:movingAveragePoints(ma,data)},0);state.groups.push({id:ma.id,label,pane:0,color:ma.color,members:[member]});}
    if(showVolume){
      const pane=nextPane++,format=volumeSettings.format==='korean'?'koVolume':volumeSettings.format==='shares'?'shares':'volume',members=[add({name:'거래량',color:CHART_COLORS.up,kind:volumeSettings.mode==='line'?'line':'histogram',priceLine:true,width:2,format,data:volumePoints(data)},pane)];
      if(volumeSettings.averageVisible){const values=movingAverageValues(volumeSettings.averageType,data.map(b=>b.volume),volumeSettings.averagePeriod);members.push(add({name:volumeSettings.averageType.toUpperCase()+' '+volumeSettings.averagePeriod,color:volumeSettings.averageColor,width:volumeSettings.averageWidth,format,data:values.flatMap((value,i)=>Number.isFinite(value)?[{time:data[i].time,value}]:[])},pane));}
      state.groups.push({id:'volume',label:'거래량',pane,color:CHART_COLORS.up,members});
    }
    if(showRS&&(rsMode==='uploaded'||benchmark.length)){const pane=nextPane++,member=add({name:'RS',color:'#8765df',confirmed:rsMode==='uploaded',data:rsMode==='uploaded'?uploadedRS(data).filter(point=>rsAsOf!==undefined&&point.time<=rsAsOf):rsLine(data,aggregate(benchmark,interval))},pane);if(rsMode==='uploaded')member.api.createPriceLine({price:70,color:'#b3a6cd',lineWidth:1,lineStyle:2,axisLabelVisible:true,title:'70'});state.groups.push({id:'rs',label:rsMode==='uploaded'?'업로드 RS · 확정봉':'지수 대비 RS · 시작 100',pane,color:member.color,members:[member]});}
    state.learningStudies=[];state.learningScaleBounds=null;
    for(const study of studies){
      if(!study.visible)continue;const definition=indicatorDefinition(study.type),input=study.type==='trendLearning'?data.filter(b=>rsAsOf!==undefined&&b.time<=rsAsOf):data,calculation=calculateStudy(study,input),pane=definition.placement==='panel'?nextPane++:0;
      if(calculation.learning)state.learningStudies.push({study,model:calculation.learning});
      const specs=calculation.series.length?calculation.series:[{name:definition.short,color:study.color,data:[]}],members=specs.map(spec=>add({...spec,width:study.width||1},pane,calculation.bounds));
      for(const value of calculation.bands)members[0].api.createPriceLine({price:value,color:'#b2bdcf',lineWidth:1,lineStyle:2,axisLabelVisible:false});
      state.groups.push({id:study.id,label:studyLabel(study),pane,color:study.color,members});
    }
    // Set all pane weights together. Repeated setHeight calls redistribute
    // earlier panes and progressively squash volume/RS on study add/remove.
    let panelHeight=0;for(const group of state.groups.filter(group=>group.pane>0)){const height=paneHeights.get(group.id)||120;chart.panes()[group.pane].setStretchFactor(height);panelHeight+=height;}
    chart.panes()[0].setStretchFactor(Math.max(160,host.current.clientHeight-panelHeight-28));
    if(preserve)chart.timeScale().setVisibleLogicalRange(preserve);
    else if(data.length===1)chart.timeScale().setVisibleLogicalRange({from:-1,to:5});
    else if(range==='ALL')chart.timeScale().fitContent();
    else if(typeof data.at(-1).time==='number'){chart.timeScale().setVisibleRange({from:Math.max(data[0].time,data.at(-1).time-Number(range)*86400),to:data.at(-1).time});}else{const last=new Date(data.at(-1).time+'T00:00:00Z'),from=new Date(last.getTime()-Number(range)*86400000).toISOString().slice(0,10);chart.timeScale().setVisibleRange({from:from<data[0].time?data[0].time:from,to:data.at(-1).time});}
    state.previous={bars,interval,range};state.readValues();state.schedule();callbacks.current.onHover?.(null);
  },[bars,benchmark,interval,range,showRS,showVolume,rsMode,rsAsOf,timeZone,pricePrecision,volumeUnit,averageKey,volumeKey,studyKey]);

  useEffect(()=>{runtime.current?.schedule();},[showProfile,profileKey]);
  useEffect(()=>{runtime.current?.watermark.applyOptions({symbol,showTicker:showTickerWatermark});},[symbol,showTickerWatermark]);
  useEffect(()=>{setMenu(null);},[drawingKey,interval]);
  useEffect(()=>{
    const api=runtime.current;if(!api||!syncHub)return;
    let applying=false;
    const unregister=syncHub.register(syncId,event=>{
      if(api.disposed)return;applying=true;
      try{if(event.type==='crosshair'&&callbacks.current.syncOptions?.syncCrosshair){const bar=nearestTimeBar(api.data,event.time,{timeZone:api.timeZone});if(bar)api.chart.setCrosshairPosition(bar.close,bar.time,api.candles);else api.chart.clearCrosshairPosition();}
      if(event.type==='range'&&callbacks.current.syncOptions?.syncTime&&event.range&&api.data.length){const from=nearestTimeBar(api.data,event.range.from,{clamp:true,timeZone:api.timeZone}),to=nearestTimeBar(api.data,event.range.to,{clamp:true,endOfDay:true,timeZone:api.timeZone});if(from&&to&&from.time<to.time)api.chart.timeScale().setVisibleRange({from:from.time,to:to.time});}}finally{applying=false;}
    });
    const rangeChanged=value=>{if(!applying&&callbacks.current.syncOptions?.syncTime&&value)syncHub.publish(syncId,{type:'range',range:value});};
    api.chart.timeScale().subscribeVisibleTimeRangeChange(rangeChanged);return()=>{unregister();api.chart.timeScale().unsubscribeVisibleTimeRangeChange(rangeChanged);};
  },[syncHub,syncId]);
  function openContext(event){
    if(event.target.closest('button,input,select'))return;const api=runtime.current;if(!api)return;event.preventDefault();const rect=event.currentTarget.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
    setMenu({x,y,width:rect.width,height:rect.height,anchor:chartAnchor(api,x,y),average:nearestAverage(api,{x,y})});
  }
  function mobileMenu(){const api=runtime.current;if(!api?.data.length)return;const width=host.current.clientWidth,height=host.current.clientHeight,last=api.data.at(-1);setMenu({x:8,y:8,width,height,anchor:{time:typeof last.time==='number'?last.time*1000:Date.parse(last.time+'T00:00:00Z'),price:last.close,dateOnly:typeof last.time==='string'}});}
  const renderReadout=row=><div className="chart-study-readout" key={row.id}><button className="study-readout-name" style={{color:row.color}} onClick={()=>callbacks.current.onEditStudies?.(row.id)}>{row.label}</button><span>{row.values.map(value=><span key={value.name} style={{color:value.color}} title={value.name}>{row.values.length>1?`${value.name} `:''}<b>{value.value}</b></span>)}</span><button className="remove-chart-study" aria-label={`${row.label} 차트에서 제거`} onClick={()=>callbacks.current.onRemoveStudy?.(row.id)}><X size={11}/></button></div>;
  return <div className="chart-drawing-workspace" onPointerEnter={()=>syncHub?.activate(syncId)} onPointerDownCapture={()=>syncHub?.activate(syncId)}><div className="chart-tools-row"><DrawingToolbar drawing={drawing}/><button className="mobile-chart-menu" onClick={mobileMenu}>차트 메뉴</button></div><div className="chart-canvas-wrap with-studies" onContextMenu={openContext} style={{'--chart-axis-width':axisWidth+'px',height:`calc(var(--price-pane-height, 360px) + ${panelCount*120+28}px)`}}><div className="chart-canvas" ref={host}/><div className="chart-overlay-readouts">{readouts.filter(r=>r.pane===0).map(renderReadout)}{showProfile&&renderReadout({id:'volumeProfile',label:'매물대 (추정)',color:profileSettings.color,values:[['POC',profileSummary?.pocPrice],['VAH',profileSummary?.vah],['VAL',profileSummary?.val]].map(([name,value])=>({name,value:number(value),color:name==='POC'?profileSettings.pocColor:profileSettings.color}))})}</div>{readouts.filter(r=>r.pane>0).map(row=><div className="chart-pane-readout" key={row.id} style={{top:(paneTops[row.pane]||0)+6}}>{renderReadout(row)}</div>)}{showProfile&&<svg className="volume-profile" width={profileWidth} height={profileHeight} aria-label="표시 구간 거래량 프로파일 추정"><title>캔들 고저 범위에 거래량을 균등 배분한 추정치</title>{profile.map((b,i)=><rect key={i} x={profileWidth-b.width} y={b.y1} width={b.width} height={Math.max(1,b.y2-b.y1-1)} fill={b.poc?profileSettings.pocColor:profileSettings.color} opacity={b.poc ? .5 : b.inValueArea ? .3 : .13}/>)}</svg>}{menu&&<ChartContextMenu menu={menu} onClose={closeMenu} drawingReady={drawing.ready&&drawing.doc.items.length<200} onLine={()=>{const row={id:crypto.randomUUID(),type:'horizontal',points:[menu.anchor],color:drawing.color,width:drawing.width,text:'',visible:true};drawing.commit(doc=>({...doc,items:[...doc.items,row]}));drawing.setSelectedId(row.id);drawing.setTool('select');}} onAlert={onAlert?()=>callbacks.current.onAlert?.(menu.anchor.price):null} onEdit={()=>callbacks.current.onEditStudies?.(menu.average||'averages')} onReset={()=>runtime.current?.publicApi.reset()} onScreenshot={()=>runtime.current?.publicApi.screenshot()}/>}<TrendLearningLayer api={drawingApi}/><DrawingLayer key={drawingKey} api={drawingApi} drawing={drawing}/></div><TrendLearningGuide api={drawingApi} studies={studies} onEdit={onEditStudies}/></div>;
}
