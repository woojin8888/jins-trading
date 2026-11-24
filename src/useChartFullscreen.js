import {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createChartFullscreen} from './fullscreen-controller.js';
const INITIAL={active:false,mode:'none',pending:false};
export function useChartFullscreen(panelRef,enabled,autoExpand=false){
  const controller=useRef(null),autoRequested=useRef(autoExpand),[state,setState]=useState(INITIAL);
  useEffect(()=>{
    if(!enabled||!panelRef.current){autoRequested.current=false;setState(INITIAL);return;}
    const next=createChartFullscreen(panelRef.current,value=>{if(!value.active)autoRequested.current=false;setState(value);},{deferRestore:true});controller.current=next;
    if(autoRequested.current)next.enter({native:false});
    return()=>{next.dispose();if(controller.current===next)controller.current=null;};
  },[panelRef,enabled]);
  useLayoutEffect(()=>{if(!state.active&&!state.pending)controller.current?.restoreFocus();},[state.active,state.pending]);
  const toggle=useCallback(()=>controller.current?.toggle(),[]);
  return {...state,toggle};
}
