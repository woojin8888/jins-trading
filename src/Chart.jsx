import React,{useEffect,useRef,useState} from 'react';
import {X} from 'lucide-react';
import {createChart,CandlestickSeries,LineSeries,HistogramSeries,ColorType,CrosshairMode} from 'lightweight-charts';
import {aggregate,sma,rsLine,volumeProfile} from './analysis.js';
import {calculateStudy,indicatorDefinition,nextLogicalRange,studyLabel} from './indicators.js';
const palette={20:'#eaa23b',50:'#3478ef',150:'#9c6cda',200:'#ec6d9d'};
const timeKey=t=>typeof t==='string'?t:typeof t==='number'?new Date(t*1000).toISOString().slice(0,10):`${t.year}-${String(t.month).padStart(2,'0')}-${String(t.day).padStart(2,'0')}`;
const number=(value,format)=>!Number.isFinite(value)?'—':format==='volume'?Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:2}).format(value):`${value.toLocaleString('ko-KR',{maximumFractionDigits:3})}${format==='percent'?'%':''}`;

export default function Chart({bars,benchmark,interval,range,showRS,showVolume,showProfile,averages,studies,onRemoveStudy,onEditStudies,onHover,onReady}){
  const host=useRef(null),runtime=useRef(null),profileEnabled=useRef(showProfile),callbacks=useRef({}),[profile,setProfile]=useState([]),[profileHeight,setProfileHeight]=useState(360),[readouts,setReadouts]=useState([]),[paneTops,setPaneTops]=useState({});
  callbacks.current={onHover,onReady,onRemoveStudy,onEditStudies};profileEnabled.current=showProfile;
  const studyKey=JSON.stringify(studies),averageKey=averages.join(','),panelCount=Number(showVolume)+Number(showRS&&benchmark.length>0)+studies.filter(s=>s.visible&&indicatorDefinition(s.type)?.placement==='panel').length;

  useEffect(()=>{
    const container=host.current;
    const chart=createChart(container,{autoSize:true,layout:{background:{type:ColorType.Solid,color:'#fff'},textColor:'#7b8495',fontFamily:'Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',fontSize:11,panes:{separatorColor:'#e0e6ef',separatorHoverColor:'#b8c9e8',enableResize:true}},grid:{vertLines:{color:'#f3f5f8'},horzLines:{color:'#f0f3f7'}},rightPriceScale:{borderColor:'#edf0f5',minimumWidth:70,scaleMargins:{top:.13,bottom:.08}},timeScale:{borderColor:'#e9edf3',rightOffset:6,timeVisible:false},crosshair:{mode:CrosshairMode.Normal,vertLine:{color:'#9ea8b9',labelBackgroundColor:'#68748a'},horzLine:{color:'#9ea8b9',labelBackgroundColor:'#68748a'}},localization:{locale:'ko-KR'}});
    const candles=chart.addSeries(CandlestickSeries,{upColor:'#0baf8c',downColor:'#ef5b68',borderVisible:false,wickUpColor:'#0baf8c',wickDownColor:'#ef5b68'});
    const state={chart,candles,series:[],groups:[],data:[],previous:null,poc:null,frame:0,profile:[],disposed:false};runtime.current=state;
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
        if(state.poc){candles.removePriceLine(state.poc);state.poc=null;}
        if(!profileEnabled.current){state.profile=[];setProfile(previous=>previous.length?[]:previous);return;}
        const visible=chart.timeScale().getVisibleRange(),subset=visible?state.data.filter(b=>b.time>=timeKey(visible.from)&&b.time<=timeKey(visible.to)):state.data,bins=volumeProfile(subset),max=Math.max(1,...bins.map(b=>b.volume));
        state.profile=bins.map(b=>({...b,y1:candles.priceToCoordinate(b.high),y2:candles.priceToCoordinate(b.low),width:b.volume/max*130})).filter(b=>b.y1!==null&&b.y2!==null);setProfile(state.profile);
        if(bins.length){const peak=bins.reduce((a,b)=>a.volume>b.volume?a:b);state.poc=candles.createPriceLine({price:(peak.high+peak.low)/2,color:'#e4aa50',lineWidth:1,lineStyle:2,axisLabelVisible:true,title:'POC'});}
      });
    };
    state.schedule=update;
    const crosshair=event=>{const bar=event.seriesData.get(candles);callbacks.current.onHover?.(bar?.close?bar:null);readValues(event);};
    const dragged=event=>{if(event.buttons)update();};
    chart.subscribeCrosshairMove(crosshair);chart.timeScale().subscribeVisibleTimeRangeChange(update);
    const observer=new ResizeObserver(update);observer.observe(container);container.addEventListener('pointerup',update);container.addEventListener('pointermove',dragged);container.addEventListener('wheel',update,{passive:true});
    callbacks.current.onReady?.({reset:()=>chart.timeScale().fitContent(),screenshot:()=>{
      const canvas=chart.takeScreenshot(),ctx=canvas.getContext('2d'),ratio=canvas.width/container.clientWidth;ctx.save();ctx.scale(ratio,ratio);ctx.beginPath();ctx.rect(0,0,container.clientWidth-70,chart.panes()[0].getHeight());ctx.clip();
      for(const b of state.profile){ctx.fillStyle=b.width>129?'rgba(219,161,65,.35)':'rgba(109,164,237,.18)';ctx.fillRect(container.clientWidth-70-b.width,b.y1,b.width,Math.max(1,b.y2-b.y1-1));}ctx.restore();
      const a=document.createElement('a');a.download='jins-trading-chart.png';a.href=canvas.toDataURL('image/png');a.click();
    }});
    return()=>{state.disposed=true;cancelAnimationFrame(state.frame);observer.disconnect();container.removeEventListener('pointerup',update);container.removeEventListener('pointermove',dragged);container.removeEventListener('wheel',update);chart.unsubscribeCrosshairMove(crosshair);chart.timeScale().unsubscribeVisibleTimeRangeChange(update);chart.remove();runtime.current=null;callbacks.current.onReady?.(null);};
  },[]);

  useEffect(()=>{
    const state=runtime.current;if(!state||!bars.length)return;
    const {chart,candles}=state,data=aggregate(bars,interval),previous=state.previous,visible=chart.timeScale().getVisibleLogicalRange();
    const preserve=nextLogicalRange(visible,{dataChanged:previous?.bars!==bars,intervalChanged:previous?.interval!==interval,rangeChanged:previous?.range!==range,oldLength:state.data.length,newLength:data.length});
    const paneHeights=new Map(state.groups.filter(group=>group.pane>0).map(group=>[group.id,group.members[0].api.getPane().getHeight()]));
    for(const series of state.series)chart.removeSeries(series);state.series=[];state.groups=[];state.data=data;
    candles.applyOptions({priceFormat:{type:'price',precision:data.at(-1).close<10?3:2,minMove:data.at(-1).close<10?.001:.01}});candles.setData(data);
    let nextPane=1;
    function add(spec,pane,bounds){
      const options={color:spec.color,lineWidth:1,priceLineVisible:false,lastValueVisible:pane>0,title:'',crosshairMarkerVisible:true};
      if(spec.format==='volume')options.priceFormat={type:'volume'};
      if(spec.format==='percent')options.priceFormat={type:'custom',minMove:.001,formatter:value=>`${value.toFixed(2)}%`};
      if(bounds)options.autoscaleInfoProvider=()=>({priceRange:{minValue:bounds[0],maxValue:bounds[1]}});
      const api=chart.addSeries(spec.kind==='histogram'?HistogramSeries:LineSeries,options,pane);
      api.setData(spec.kind==='histogram'?spec.data.map(p=>({...p,color:p.color||(p.value>=0?'#77c7b2':'#ef9ca5')})):spec.data);state.series.push(api);return {...spec,api};
    }
    for(const period of averages)add({name:`MA ${period}`,color:palette[period],data:sma(data,period)},0);
    if(showVolume){const pane=nextPane++,member=add({name:'거래량',color:'#64aa97',kind:'histogram',format:'volume',data:data.filter(b=>Number.isFinite(b.volume)).map(b=>({time:b.time,value:b.volume,color:b.close>=b.open?'#a1ded1':'#f6bcc1'}))},pane);state.groups.push({id:'volume',label:'거래량',pane,color:member.color,members:[member]});}
    if(showRS&&benchmark.length){const pane=nextPane++,member=add({name:'RS',color:'#8765df',data:rsLine(data,aggregate(benchmark,interval))},pane);state.groups.push({id:'rs',label:'지수 대비 RS',pane,color:member.color,members:[member]});}
    for(const study of studies){
      if(!study.visible)continue;const definition=indicatorDefinition(study.type),calculation=calculateStudy(study,data),pane=definition.placement==='panel'?nextPane++:0;
      const specs=calculation.series.length?calculation.series:[{name:definition.short,color:study.color,data:[]}],members=specs.map(spec=>add(spec,pane,calculation.bounds));
      for(const value of calculation.bands)members[0].api.createPriceLine({price:value,color:'#b2bdcf',lineWidth:1,lineStyle:2,axisLabelVisible:false});
      state.groups.push({id:study.id,label:studyLabel(study),pane,color:study.color,members});
    }
    let panelHeight=0;for(const group of state.groups.filter(group=>group.pane>0)){const height=paneHeights.get(group.id)||120;chart.panes()[group.pane].setHeight(height);panelHeight+=height;}
    chart.panes()[0].setHeight(Math.max(160,host.current.clientHeight-panelHeight-28));
    if(preserve)chart.timeScale().setVisibleLogicalRange(preserve);
    else if(range==='ALL')chart.timeScale().fitContent();
    else{const last=new Date(data.at(-1).time+'T00:00:00Z'),from=new Date(last.getTime()-Number(range)*86400000).toISOString().slice(0,10);chart.timeScale().setVisibleRange({from:from<data[0].time?data[0].time:from,to:data.at(-1).time});}
    state.previous={bars,interval,range};state.readValues();state.schedule();callbacks.current.onHover?.(null);
  },[bars,benchmark,interval,range,showRS,showVolume,averageKey,studyKey]);

  useEffect(()=>{runtime.current?.schedule();},[showProfile]);
  const renderReadout=row=><div className="chart-study-readout" key={row.id}><button className="study-readout-name" style={{color:row.color}} onClick={()=>callbacks.current.onEditStudies?.()}>{row.label}</button><span>{row.values.map(value=><span key={value.name} style={{color:value.color}} title={value.name}>{row.values.length>1?`${value.name} `:''}<b>{value.value}</b></span>)}</span><button className="remove-chart-study" aria-label={`${row.label} 차트에서 제거`} onClick={()=>callbacks.current.onRemoveStudy?.(row.id)}><X size={11}/></button></div>;
  return <div className="chart-canvas-wrap with-studies" style={{height:`calc(var(--price-pane-height, 360px) + ${panelCount*120+28}px)`}}><div className="chart-watermark" style={{top:Math.max(90,profileHeight*.4)}} aria-hidden="true">Jin's Trading<span>진스트레이딩</span></div><div className="chart-canvas" ref={host}/><div className="chart-overlay-readouts">{readouts.filter(r=>r.pane===0).map(renderReadout)}</div>{readouts.filter(r=>r.pane>0).map(row=><div className="chart-pane-readout" key={row.id} style={{top:(paneTops[row.pane]||0)+6}}>{renderReadout(row)}</div>)}{showProfile&&<svg className="volume-profile" width="140" height={profileHeight} aria-label="표시 구간 거래량 프로파일 추정"><title>캔들 고저 범위에 거래량을 균등 배분한 추정치</title>{profile.map((b,i)=><rect key={i} x={140-b.width} y={b.y1} width={b.width} height={Math.max(1,b.y2-b.y1-1)} fill={b.width>129?'#dba141':'#6da4ed'} opacity={b.width>129?.35:.18}/>)}</svg>}</div>;
}
