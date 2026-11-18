import {useCallback,useEffect,useState} from 'react';
import {MAX_STUDIES,normalizeStudy} from './indicators.js';
import {MA_TYPES,MA_SOURCES} from './technical-math.js';
export const CHART_SETTINGS_KEY='jins-trading:chart-preferences:v1';
export const MAX_MOVING_AVERAGES=8;
const color=(value,fallback)=>/^#[0-9a-f]{6}$/i.test(value||'')?value:fallback;
const integer=(value,min,max,fallback)=>Number.isInteger(value)&&value>=min&&value<=max?value:fallback;
export function defaultMovingAverages(){return [20,50,150,200].map((period,index)=>({id:'ma-'+period,type:'sma',source:'close',period,color:['#111111','#3478ef','#9c6cda','#ec6d9d'][index],width:period===20?3:1,visible:true}));}
export function defaultChartPreferences(){return {version:3,rsMode:'uploaded',showTickerWatermark:true,movingAverages:defaultMovingAverages(),showRS:true,showVolume:true,showProfile:false,autoRefresh:false,volume:{format:'korean',mode:'bars',averageVisible:true,averagePeriod:20,averageType:'sma',averageColor:'#5c6678',averageWidth:1},profile:{mode:'visible',rows:32,width:150,valueArea:70,fixedBars:150,color:'#6da4ed',pocColor:'#dba141',showPOC:true,showVA:true},studies:[]};}
export function normalizeMovingAverage(raw){
  if(typeof raw?.id!=='string'||!/^ma-[\w-]{1,76}$/.test(raw.id))return null;
  return {id:raw.id,type:MA_TYPES.some(([type])=>type===raw.type)?raw.type:'sma',source:MA_SOURCES.some(([source])=>source===raw.source)?raw.source:'close',period:integer(raw.period,1,500,20),color:color(raw.color,'#111111'),width:integer(raw.width,1,4,raw.period===20?3:1),visible:raw.visible!==false};
}
export function normalizePreferences(raw){
  const defaults=defaultChartPreferences();if(![1,2,3].includes(raw?.version))return defaults;
  const seen=new Set(),studies=[];
  for(const candidate of (Array.isArray(raw.studies)?raw.studies:[]).slice(0,100)){const study=normalizeStudy(candidate);if(!study||seen.has(study.id)||study.id.startsWith('ma-'))continue;seen.add(study.id);studies.push(study);if(studies.length===MAX_STUDIES)break;}
  let movingAverages;
  if(raw.version===1)movingAverages=defaultMovingAverages().map(ma=>({...ma,visible:Array.isArray(raw.averages)?raw.averages.includes(ma.period):true}));
  else if(!Array.isArray(raw.movingAverages))movingAverages=defaults.movingAverages;
  else{const ids=new Set();movingAverages=raw.movingAverages.slice(0,50).map(normalizeMovingAverage).filter(ma=>{if(!ma||ids.has(ma.id))return false;ids.add(ma.id);return true;}).slice(0,MAX_MOVING_AVERAGES);}
  const v=raw.volume||{},p=raw.profile||{};
  return {...defaults,...Object.fromEntries(['showRS','showVolume','showProfile','autoRefresh','showTickerWatermark'].map(key=>[key,typeof raw[key]==='boolean'?raw[key]:defaults[key]])),movingAverages,studies,rsMode:raw.rsMode==='benchmark'?'benchmark':'uploaded',
    volume:{format:raw.version<3?'korean':['shares','compact','korean'].includes(v.format)?v.format:'korean',mode:v.mode==='line'?'line':'bars',averageVisible:v.averageVisible!==false,averagePeriod:integer(v.averagePeriod,1,500,20),averageType:['sma','ema'].includes(v.averageType)?v.averageType:'sma',averageColor:color(v.averageColor,defaults.volume.averageColor),averageWidth:integer(v.averageWidth,1,4,1)},
    profile:{mode:p.mode==='recent'?'recent':'visible',rows:integer(p.rows,8,120,32),width:integer(p.width,60,260,150),valueArea:integer(p.valueArea,1,100,70),fixedBars:integer(p.fixedBars,10,2000,150),color:color(p.color,defaults.profile.color),pocColor:color(p.pocColor,defaults.profile.pocColor),showPOC:p.showPOC!==false,showVA:p.showVA!==false}};
}
function readPreferences(){try{return normalizePreferences(JSON.parse(localStorage.getItem(CHART_SETTINGS_KEY)||'null'));}catch{return defaultChartPreferences();}}
export function useChartPreferences(){
  const [preferences,setPreferences]=useState(readPreferences),[storageError,setStorageError]=useState('');
  useEffect(()=>{try{localStorage.setItem(CHART_SETTINGS_KEY,JSON.stringify(preferences));setStorageError('');}catch{setStorageError('차트 설정을 브라우저에 저장하지 못했습니다. 현재 화면에는 계속 적용됩니다.');}},[preferences]);
  const setField=useCallback((key,value)=>setPreferences(previous=>({...previous,[key]:typeof value==='function'?value(previous[key]):value})),[]);
  return {preferences,setField,storageError};
}
