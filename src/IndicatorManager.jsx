import React,{useEffect,useState} from 'react';
import {Activity,Eye,EyeOff,Plus,Search,Trash2,Check} from 'lucide-react';
import {INDICATORS,MAX_STUDIES,createStudy,indicatorDefinition,studyLabel} from './indicators.js';

function ParameterInput({field,study,onChange}){
  const value=study.params[field.key],[draft,setDraft]=useState(String(value)),[error,setError]=useState('');
  useEffect(()=>{setDraft(String(value));setError('');},[value]);
  function commit(){
    const n=Number(draft),params={...study.params,[field.key]:n};
    if(!draft.trim()||!Number.isFinite(n)||n<field.min||n>field.max||field.step===1&&!Number.isInteger(n)){setError(`${field.min}~${field.max}${field.step===1?'의 정수':''}를 입력하세요.`);return;}
    if(study.type==='macd'&&params.fast>=params.slow){setError('빠른 EMA 기간은 느린 EMA보다 작아야 합니다.');return;}
    setError('');if(n!==value)onChange(n);
  }
  return <label className="study-parameter">{field.label}<input type="number" value={draft} min={field.min} max={field.max} step={field.step} aria-invalid={!!error} onChange={e=>setDraft(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur();}}}/>{error&&<small role="alert">{error}</small>}</label>;
}
export default function IndicatorManager({preferences,setField,storageError,onDone}){
  const [query,setQuery]=useState(''),[category,setCategory]=useState('all'),[selected,setSelected]=useState(null),[message,setMessage]=useState('');
  const {studies,averages}=preferences;
  const visible=INDICATORS.filter(d=>(category==='all'||d.placement===category)&&`${d.name} ${d.description}`.toLowerCase().includes(query.toLowerCase()));
  function add(type){if(studies.length>=MAX_STUDIES){setMessage(`사용자 지표는 최대 ${MAX_STUDIES}개까지 추가할 수 있습니다.`);return;}const study=createStudy(type);setField('studies',previous=>previous.length<MAX_STUDIES?[...previous,study]:previous);setSelected(study.id);setMessage(`${indicatorDefinition(type).name}를 차트에 추가했습니다.`);}
  function patch(id,update){setField('studies',previous=>previous.map(study=>study.id===id?{...study,...update}:study));}
  return <div className="indicator-manager"><p className="indicator-intro">현재 종목의 실제 캔들로 계산합니다. 지표는 선택한 <b>일·주·월봉</b>을 따르며, 차트를 확대·이동하면 같은 시간축으로 움직입니다.</p>
    <div className="indicator-search"><Search size={16}/><input aria-label="보조지표 검색" placeholder="RSI, MACD, 볼린저 밴드…" value={query} onChange={e=>setQuery(e.target.value)}/></div>
    <div className="indicator-categories" role="group" aria-label="지표 분류">{[['all','전체'],['overlay','차트 위 지표'],['panel','아래 패널 지표']].map(([id,label])=><button key={id} className={category===id?'active':''} aria-pressed={category===id} onClick={()=>setCategory(id)}>{label}</button>)}</div>
    <div className="indicator-catalog">{visible.map(item=><article key={item.type}><div><h3>{item.name}<span>{item.placement==='overlay'?'차트 위':'아래 패널'}</span></h3><p>{item.description}</p></div><button type="button" aria-label={`${item.name} 추가`} disabled={studies.length>=MAX_STUDIES} onClick={()=>add(item.type)}><Plus size={15}/>추가</button></article>)}{!visible.length&&<p className="indicator-no-results">검색한 지표가 없습니다.</p>}</div>
    <div className="active-studies-heading"><h3><Activity size={16}/> 추가한 지표 <span>{studies.length} / {MAX_STUDIES}</span></h3><span>입력 후 Enter 또는 포커스 이동으로 적용</span></div>
    {message&&<p className="indicator-message" role="status">{message}</p>}
    <div className="active-studies">{studies.map(study=>{const definition=indicatorDefinition(study.type);return <details key={study.id} open={selected===study.id} ><summary onClick={e=>{e.preventDefault();setSelected(previous=>previous===study.id?null:study.id);}}><i style={{background:study.color}}/><b>{studyLabel(study)}</b><span>{study.visible?'표시 중':'숨김'}</span></summary><div className="active-study-editor"><div className="study-parameters">{definition.fields.map(field=><ParameterInput key={field.key} field={field} study={study} onChange={n=>patch(study.id,{params:{...study.params,[field.key]:n}})}/>)}<label className="study-parameter">색상<input aria-label={`${studyLabel(study)} 색상`} type="color" value={study.color} onChange={e=>patch(study.id,{color:e.target.value})}/></label></div><div className="study-editor-actions"><small>{definition.placement==='overlay'?'가격 차트에 겹쳐 표시':'가격 차트 아래의 독립 패널'}</small><button type="button" aria-pressed={study.visible} onClick={()=>patch(study.id,{visible:!study.visible})}>{study.visible?<Eye size={14}/>:<EyeOff size={14}/>} {study.visible?'숨기기':'표시하기'}</button><button type="button" className="remove-study" onClick={()=>{setField('studies',previous=>previous.filter(s=>s.id!==study.id));setMessage(`${definition.name}를 삭제했습니다.`);}}><Trash2 size={14}/>삭제</button></div></div></details>;})}{!studies.length&&<p className="indicator-empty">위 목록에서 지표를 추가하세요. 같은 지표를 서로 다른 기간으로 여러 개 추가할 수 있습니다.</p>}</div>
    <details className="base-chart-settings"><summary>기본 이동평균 · 거래량 · RS · 갱신 설정</summary><div className="settings-list">{[20,50,150,200].map(period=><label key={period}><span>MA {period}</span><input type="checkbox" checked={averages.includes(period)} onChange={()=>setField('averages',previous=>previous.includes(period)?previous.filter(n=>n!==period):[...previous,period].sort((a,b)=>a-b))}/></label>)}{[['거래량','showVolume'],['지수 대비 RS','showRS'],['거래량 프로파일 (추정)','showProfile'],['1분마다 가격 데이터 갱신','autoRefresh']].map(([label,key])=><label key={key}><span>{label}</span><input type="checkbox" checked={preferences[key]} onChange={e=>setField(key,e.target.checked)}/></label>)}</div><p>자동 갱신은 데이터 제공처의 지연을 해소하지 않습니다. 분석 카드와 미너비니 조건은 계속 일봉 기준입니다.</p></details>
    {storageError&&<p className="error-text" role="alert">{storageError}</p>}<div className="indicator-dialog-footer"><span>설정은 현재 브라우저에 저장됩니다.</span><button className="primary" onClick={onDone}><Check size={16}/>차트로 돌아가기</button></div>
  </div>;
}
