import {useCallback,useEffect,useRef,useState} from 'react';
import {createChartFullscreen} from './fullscreen-controller.js';
const INITIAL={active:false,mode:'none',pending:false};
export function useChartFullscreen(panelRef,enabled){
  const controller=useRef(null),[state,setState]=useState(INITIAL);
  useEffect(()=>{
    if(!enabled||!panelRef.current){setState(INITIAL);return;}
    const next=createChartFullscreen(panelRef.current,setState);controller.current=next;
    return()=>{next.dispose();if(controller.current===next)controller.current=null;};
  },[panelRef,enabled]);
  const toggle=useCallback(()=>controller.current?.toggle(),[]);
  return {...state,toggle};
}
