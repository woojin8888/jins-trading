import {useCallback} from 'react';
import {useCloudDocument} from './cloud-document.js';
import {CHART_SETTINGS_KEY,defaultChartPreferences,normalizePreferences} from './chart-preferences.js';
function readPreferences(){try{return normalizePreferences(JSON.parse(localStorage.getItem(CHART_SETTINGS_KEY)||'null'));}catch{return defaultChartPreferences();}}
export function useChartPreferences(account={authReady:true}){
  const userId=account.session?.user.id;
  const cloud=useCloudDocument({userId,authReady:account.authReady,documentKey:'preferences',normalize:normalizePreferences,legacyKey:CHART_SETTINGS_KEY,initial:()=>{
    if(!account.authReady)return defaultChartPreferences();
    if(!userId)return readPreferences();
    try{const owner=localStorage.getItem(CHART_SETTINGS_KEY+':owner');if(owner&&owner!==userId)return defaultChartPreferences();localStorage.setItem(CHART_SETTINGS_KEY+':owner',userId);return readPreferences();}catch{return defaultChartPreferences();}
  }});
  const setField=useCallback((key,value)=>cloud.setValue(previous=>({...previous,[key]:typeof value==='function'?value(previous[key]):value})),[cloud.setValue]);
  return {preferences:cloud.value,setField,storageError:cloud.error,ready:cloud.ready,sync:cloud.status,retry:cloud.retry};
}
