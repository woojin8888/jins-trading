import {createClient} from '@supabase/supabase-js';
import {useCallback,useEffect,useRef,useState} from 'react';
import publicConfig from './public-config.json';
const url=import.meta.env.VITE_SUPABASE_URL||publicConfig.supabaseUrl,key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||publicConfig.supabasePublishableKey;
export const supabase=url&&key?createClient(url,key,{auth:{storageKey:'jins-trading-auth-v1',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
const empty=()=>({watchlist:[],notes:[]});
const storageKey=id=>`jins-trading:data:v1:${id||'guest'}`;
function readLocal(id){try{const data=JSON.parse(localStorage.getItem(storageKey(id))||'null');return Array.isArray(data?.watchlist)&&Array.isArray(data?.notes)?data:empty();}catch{return empty();}}
export function useAccount(){
  const [session,setSession]=useState(null),[document,setDocument]=useState(()=>readLocal(null)),[ready,setReady]=useState(false),[sync,setSync]=useState('브라우저 저장'),[error,setError]=useState('');
  const docRef=useRef(document),userRef=useRef(null),queue=useRef(Promise.resolve());
  useEffect(()=>{if(!supabase){setReady(true);return;}let active=true;supabase.auth.getSession().then(({data,error})=>{if(!active)return;if(error)setError(error.message);setSession(data.session);setReady(true);});const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,value)=>{if(active){setSession(value);setReady(true);}});return()=>{active=false;subscription.unsubscribe();};},[]);
  const id=session?.user?.id;
  const [loadedId,setLoadedId]=useState(undefined);
  useEffect(()=>{
    if(!ready)return;let active=true;userRef.current=id||null;setLoadedId(undefined);setError('');
    if(!id){const data=readLocal(null);docRef.current=data;setDocument(data);setSync('브라우저 저장');setLoadedId(null);return;}
    docRef.current=empty();setDocument(empty());setSync('동기화 중…');
    Promise.all([supabase.from('trading_watchlist').select('*').eq('user_id',id).order('created_at'),supabase.from('trading_notes').select('*').eq('user_id',id)]).then(results=>{if(!active)return;const failure=results.find(r=>r.error);if(failure)throw failure.error;const data={watchlist:results[0].data,notes:results[1].data};docRef.current=data;setDocument(data);setSync('동기화 완료');setLoadedId(id);}).catch(e=>{if(active){setError(e.message);setSync('동기화 실패');}});
    return()=>{active=false;};
  },[id,ready]);
  const mutate=useCallback((update,remote)=>{
    const expected=id||null;
    const task=queue.current.catch(()=>{}).then(async()=>{
      if(userRef.current!==expected||loadedId!==expected)throw Error('동기화가 끝난 뒤 다시 시도해 주세요.');
      setError('');setSync(expected?'저장 중…':'브라우저 저장');
      if(expected){const {error}=await remote(expected);if(error)throw error;}
      if(userRef.current!==expected)return;
      const next=update(docRef.current);docRef.current=next;setDocument(next);
      try{localStorage.setItem(storageKey(expected),JSON.stringify(next));}catch{if(!expected)throw Error('브라우저 저장 공간을 사용할 수 없습니다.');}
      setSync(expected?'동기화 완료':'브라우저 저장');
    }).catch(e=>{if(userRef.current===expected){setError(e.message);setSync('저장 실패');}throw e;});
    queue.current=task;return task;
  },[id,loadedId]);
  const toggleWatch=useCallback(stock=>{
    const exists=docRef.current.watchlist.some(r=>r.market===stock.market&&r.symbol===stock.symbol),row={market:stock.market,symbol:stock.symbol,name:stock.name||stock.symbol,group_name:'기본 그룹'};
    return mutate(doc=>({...doc,watchlist:exists?doc.watchlist.filter(r=>r.market!==row.market||r.symbol!==row.symbol):[...doc.watchlist,row]}),uid=>exists?supabase.from('trading_watchlist').delete().eq('user_id',uid).eq('market',row.market).eq('symbol',row.symbol):supabase.from('trading_watchlist').upsert({...row,user_id:uid},{onConflict:'user_id,market,symbol'}));
  },[mutate]);
  const changeGroup=useCallback((stock,group)=>mutate(doc=>({...doc,watchlist:doc.watchlist.map(r=>r.market===stock.market&&r.symbol===stock.symbol?{...r,group_name:group}:r)}),uid=>supabase.from('trading_watchlist').update({group_name:group}).eq('user_id',uid).eq('market',stock.market).eq('symbol',stock.symbol)),[mutate]);
  const saveNote=useCallback((market,symbol,content)=>{const row={market,symbol,content,updated_at:new Date().toISOString()};return mutate(doc=>({...doc,notes:[...doc.notes.filter(r=>r.market!==market||r.symbol!==symbol),row]}),uid=>supabase.from('trading_notes').upsert({...row,user_id:uid},{onConflict:'user_id,market,symbol'}));},[mutate]);
  return {session,...document,sync,error,ready:ready&&loadedId===(id||null),toggleWatch,changeGroup,saveNote};
}
const cache=new Map();
export async function marketData(params,signal,refresh=false){
  const query=new URLSearchParams(params).toString(),cached=cache.get(query);
  if(!refresh&&cached&&Date.now()-cached.time<120000)return cached.data;
  const response=await fetch('/api/market?'+query,{signal,cache:refresh?'reload':'default'}),data=await response.json();
  if(!response.ok||data.error)throw Error(data.error||'데이터를 불러오지 못했습니다.');
  cache.set(query,{time:Date.now(),data});while(cache.size>25)cache.delete(cache.keys().next().value);return data;
}
