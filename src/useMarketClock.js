import {useEffect,useState} from 'react';
export function useMarketClock(){
  const [now,setNow]=useState(Date.now);
  useEffect(()=>{const update=()=>setNow(Date.now()),timer=window.setInterval(update,30000);window.addEventListener('focus',update);document.addEventListener('visibilitychange',update);return()=>{window.clearInterval(timer);window.removeEventListener('focus',update);document.removeEventListener('visibilitychange',update);};},[]);
  return now;
}
