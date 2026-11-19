import React,{Suspense,lazy,useEffect,useMemo,useState} from 'react';
import {marketData} from './backend.js';
import {TIMEFRAMES,isIntraday,completedAnalysisBars,formatBarTime} from './timeframes.js';
import {createChartSync} from './workspace-model.js';
const Chart=lazy(()=>import('./Chart.jsx'));
const EMPTY=[];
export function LayoutControls({value,onChange,ready,sync}){
  return <div className="layout-controls"><span>차트 배치</span><div role="group" aria-label="차트 분할">{[1,2,4].map(n=><button key={n} className={value.layout===n?'active':''} aria-pressed={value.layout===n} disabled={!ready} onClick={()=>onChange(d=>({...d,layout:n}))}>{n===1?'단일':n+'분할'}</button>)}</div>{[['syncSymbol','종목'],['syncCrosshair','십자선'],['syncTime','시간축']].map(([key,label])=><label key={key}><input type="checkbox" disabled={!ready} checked={value[key]} onChange={e=>onChange(d=>({...d,[key]:e.target.checked}))}/>{label} 연동</label>)}<small>{sync}</small></div>;
}
function CompanionChart({index,config,workspace,onConfig,market,stock,preferences,account,onEdit,onRemove,onAlert,refreshTick,hub,benchmarkSymbol}){
  const [draft,setDraft]=useState(''),[retry,setRetry]=useState(0),[state,setState]=useState({key:'',data:null,busy:true,error:''});
  const symbol=workspace.syncSymbol?stock.symbol:config.symbol||stock.symbol,key=`${market}:${symbol}:${config.interval}`;
  useEffect(()=>{const controller=new AbortController();setState(s=>({key,data:s.key===key?s.data:null,busy:true,error:''}));marketData({action:'history',market,symbol,...(isIntraday(config.interval)?{interval:config.interval}:{range:'10y'})},controller.signal,refreshTick>0||retry>0).then(data=>{if(!controller.signal.aborted)setState({key,data,busy:false,error:''});}).catch(e=>{if(!controller.signal.aborted)setState(s=>({...s,busy:false,error:e.message}));});return()=>controller.abort();},[key,refreshTick,retry]);
  const [bench,setBench]=useState({key:'',data:null,error:''}),benchKey=`${market}:${benchmarkSymbol}:${config.interval}`;
  useEffect(()=>{if(!preferences.showRS||preferences.rsMode!=='benchmark')return;const controller=new AbortController();setBench({key:benchKey,data:null,error:''});marketData({action:'history',market,symbol:benchmarkSymbol,...(isIntraday(config.interval)?{interval:config.interval}:{range:'10y'})},controller.signal,refreshTick>0).then(data=>{if(!controller.signal.aborted)setBench({key:benchKey,data,error:''});}).catch(error=>{if(!controller.signal.aborted)setBench({key:benchKey,data:null,error:error.message});});return()=>controller.abort();},[benchKey,preferences.showRS,preferences.rsMode,refreshTick]);
  const data=state.key===key?state.data:null;
  const rsAsOf=useMemo(()=>completedAnalysisBars(data?.bars||EMPTY,config.interval,data?.quality?.sessionOpen).at(-1)?.time,[data,config.interval]);
  return <section className="companion-chart" aria-label={`${index+2}번 차트`}><div className="companion-toolbar"><strong>{symbol.replace(/\.(KS|KQ)$/,'')}</strong><span>{data?.name}</span><select aria-label={`${index+2}번 차트 봉 주기`} value={config.interval} onChange={e=>onConfig({...config,interval:e.target.value})}>{TIMEFRAMES.map(([v,l])=><option key={v} value={v}>{l}봉</option>)}</select></div>{!workspace.syncSymbol&&<form className="companion-search" onSubmit={e=>{e.preventDefault();if(draft.trim())onConfig({...config,symbol:draft.trim().toUpperCase()});}}><input aria-label={`${index+2}번 차트 종목`} placeholder={market==='kr'?'종목 코드 · 005930.KS':'티커 · AAPL'} value={draft} maxLength={20} onChange={e=>setDraft(e.target.value)}/><button>종목 변경</button></form>}
    {data?<><p className="companion-provenance">{data.source} · 기준 {formatBarTime(data.bars.at(-1)?.time,data.timeZone)} · 지연 가능{state.busy?' · 갱신 중':''}</p><Suspense fallback={<p>차트 준비 중…</p>}><Chart symbol={data.symbol} showTickerWatermark={preferences.showTickerWatermark} rsMode={preferences.rsMode} rsAsOf={rsAsOf} timeZone={data.timeZone} drawingKey={`${account.session?.user.id||'guest'}:${market}:${data.symbol}`} bars={data.bars} benchmark={bench.key===benchKey?bench.data?.bars||EMPTY:EMPTY} interval={config.interval} range={isIntraday(config.interval)?'5':'180'} showRS={preferences.showRS} showVolume={preferences.showVolume} showProfile={preferences.showProfile} movingAverages={preferences.movingAverages} volumeSettings={preferences.volume} profileSettings={preferences.profile} studies={preferences.studies} onRemoveStudy={onRemove} onEditStudies={onEdit} onAlert={price=>onAlert({market,symbol:data.symbol,name:data.name,price})} syncHub={hub} syncId={'pane-'+index} syncOptions={workspace}/></Suspense></>:state.busy?<p className="companion-empty">{symbol} 조회 중…</p>:null}
    {preferences.showRS&&preferences.rsMode==='benchmark'&&bench.error&&<p className="inline-error">RS 비교 시세: {bench.error}</p>}{state.error&&<p className="inline-error" role="alert">{state.error}<button onClick={()=>setRetry(n=>n+1)}>다시 시도</button></p>}
  </section>;
}
export function useChartSync(){return useMemo(()=>createChartSync(),[]);}
export default function MultiChart({workspace,setWorkspace,...props}){
  if(workspace.layout===1)return null;
  return workspace.panes.slice(0,workspace.layout-1).map((config,index)=><CompanionChart key={`${props.market}:${index}`} index={index} config={config} workspace={workspace} onConfig={next=>setWorkspace(d=>({...d,panes:d.panes.map((p,i)=>i===index?next:p)}))} {...props}/>);
}
