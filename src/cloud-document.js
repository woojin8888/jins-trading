import {useEffect,useMemo,useSyncExternalStore} from 'react';
import {supabase} from './backend.js';
import {createDocumentStore} from './cloud-document-store.js';
const stores=new Map();
export function useCloudDocument({userId,authReady=true,documentKey,initial,normalize,legacyKey}){
  const owner=authReady?(userId||'guest'):'restoring',key=`jins-trading:cloud:v1:${owner}:${documentKey}`;
  const store=useMemo(()=>{
    if(stores.has(key))return stores.get(key);
    let value=typeof initial==='function'?initial():initial;
    try{const saved=localStorage.getItem(key)||(!userId&&legacyKey?localStorage.getItem(legacyKey):null);if(saved)value=JSON.parse(saved);}catch{}
    const remote=!!userId&&authReady;
    const next=createDocumentStore({initial:value,normalize,
      read:owner==='restoring'?async()=>{throw Error('로그인 확인 중입니다.');}:remote?async()=>{const {data,error}=await supabase.from('trading_documents').select('payload').eq('user_id',userId).eq('document_key',documentKey).maybeSingle();if(error)throw error;return data?.payload;}:null,
      write:remote?async payload=>{const {error}=await supabase.from('trading_documents').upsert({user_id:userId,document_key:documentKey,payload,updated_at:new Date().toISOString()},{onConflict:'user_id,document_key'});if(error)throw error;}:null,
      persist:payload=>{try{localStorage.setItem(key,JSON.stringify(payload));}catch{throw Error('브라우저 백업 저장에 실패했습니다.');}},
    });stores.set(key,next);return next;
  },[key]);
  const state=useSyncExternalStore(store.subscribe,store.snapshot,store.snapshot);
  useEffect(()=>{if(authReady)store.load();const flush=()=>{if(document.visibilityState==='hidden')store.flush();};const retry=()=>store.retry();document.addEventListener('visibilitychange',flush);window.addEventListener('online',retry);return()=>{document.removeEventListener('visibilitychange',flush);window.removeEventListener('online',retry);store.flush();};},[store,authReady]);
  return {...state,setValue:store.update,retry:store.retry};
}
