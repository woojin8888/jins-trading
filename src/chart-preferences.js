import {useCallback,useEffect,useState} from 'react';
import {MAX_STUDIES,normalizeStudy} from './indicators.js';
export const CHART_SETTINGS_KEY='jins-trading:chart-preferences:v1';
export function defaultChartPreferences(){return {version:1,averages:[20,50,150,200],showRS:true,showVolume:true,showProfile:false,autoRefresh:false,studies:[]};}
export function normalizePreferences(raw){
  const defaults=defaultChartPreferences();if(raw?.version!==1)return defaults;
  const seen=new Set(),studies=[];
  for(const candidate of (Array.isArray(raw.studies)?raw.studies:[])){const study=normalizeStudy(candidate);if(!study||seen.has(study.id))continue;seen.add(study.id);studies.push(study);if(studies.length===MAX_STUDIES)break;}
  return {...defaults,...Object.fromEntries(['showRS','showVolume','showProfile','autoRefresh'].map(key=>[key,typeof raw[key]==='boolean'?raw[key]:defaults[key]])),averages:Array.isArray(raw.averages)?[...new Set(raw.averages.filter(n=>[20,50,150,200].includes(n)))]:defaults.averages,studies};
}
function readPreferences(){try{return normalizePreferences(JSON.parse(localStorage.getItem(CHART_SETTINGS_KEY)||'null'));}catch{return defaultChartPreferences();}}
export function useChartPreferences(){
  const [preferences,setPreferences]=useState(readPreferences),[storageError,setStorageError]=useState('');
  useEffect(()=>{try{localStorage.setItem(CHART_SETTINGS_KEY,JSON.stringify(preferences));setStorageError('');}catch{setStorageError('차트 설정을 브라우저에 저장하지 못했습니다. 현재 화면에는 계속 적용됩니다.');}},[preferences]);
  const setField=useCallback((key,value)=>setPreferences(previous=>({...previous,[key]:typeof value==='function'?value(previous[key]):value})),[]);
  return {preferences,setField,storageError};
}
