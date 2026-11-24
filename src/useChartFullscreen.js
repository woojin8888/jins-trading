import {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createChartFullscreen} from './fullscreen-controller.js';
const INITIAL={active:false,mode:'none',pending:false};
export function useChartFullscreen(panelRef,enabled){
  const controller=useRef(null),[state,setState]=useState(INITIAL);
  useEffect(()=>{
    if(!enabled||!panelRef.current){setState(INITIAL);return;}
    const next=createChartFullscreen(panelRef.current,setState,{deferRestore:true});controller.current=next;
    return()=>{next.dispose();if(controller.current===next)controller.current=null;};
  },[panelRef,enabled]);
  useLayoutEffect(()=>{if(!state.active&&!state.pending)controller.current?.restoreFocus();},[state.active,state.pending]);
  const toggle=useCallback(()=>controller.current?.toggle(),[]);
  return {...state,toggle};
}
