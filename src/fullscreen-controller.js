// Keep the chart in its existing DOM node, so zoom, indicators and drawings survive.
export function createChartFullscreen(target,onChange,{document:doc=globalThis.document,window:win=globalThis.window}={}){
  let state={active:false,mode:'none',pending:false},disposed=false,wanted=false,operation=0,saved=null;
  const owner=()=>doc.fullscreenElement||doc.webkitFullscreenElement;
  const emit=value=>{state=value;if(!disposed)onChange(state);};
  function lockPage(){
    if(saved)return;
    const inert=[];let node=target;
    while(node?.parentElement){for(const sibling of node.parentElement.children){if(sibling!==node){inert.push([sibling,sibling.inert]);sibling.inert=true;}}node=node.parentElement;if(node===doc.body)break;}
    saved={focus:doc.activeElement,x:win?.scrollX||0,y:win?.scrollY||0,bodyOverflow:doc.body.style.overflow,rootOverflow:doc.documentElement.style.overflow,inert};
    doc.body.style.overflow='hidden';doc.documentElement.style.overflow='hidden';
  }
  function unlockPage(restoreFocus=true){
    if(!saved)return;const previous=saved;saved=null;
    doc.body.style.overflow=previous.bodyOverflow;doc.documentElement.style.overflow=previous.rootOverflow;
    for(const [element,inert] of previous.inert)element.inert=inert;
    if(restoreFocus){
      // React must first clear pending/disabled on the entry button. Focusing
      // during fullscreenchange otherwise silently fails in real browsers.
      const restore=()=>{if(disposed||state.active)return;if(previous.focus?.isConnected!==false)previous.focus?.focus?.({preventScroll:true});win?.scrollTo?.(previous.x,previous.y);};
      if(win?.requestAnimationFrame)win.requestAnimationFrame(restore);
      else {if(previous.focus?.isConnected!==false)previous.focus?.focus?.({preventScroll:true});win?.scrollTo?.(previous.x,previous.y);}
    }
  }
  function reset(restoreFocus=true){unlockPage(restoreFocus);emit({active:false,mode:'none',pending:false});}
  function exitNative(){const exit=doc.exitFullscreen||doc.webkitExitFullscreen;try{return exit?Promise.resolve(exit.call(doc)):Promise.resolve();}catch(error){return Promise.reject(error);}}
  function changed(){
    if(disposed)return;
    if(owner()===target){
      if(!wanted){exitNative().catch(()=>{});return;}
      emit({active:true,mode:'native',pending:false});
    }else if(state.mode==='native'){wanted=false;operation++;reset();}
  }
  function enter(){
    if(disposed||state.active||state.pending)return Promise.resolve();
    const current=++operation;wanted=true;lockPage();emit({active:true,mode:'viewport',pending:false});
    const request=target.requestFullscreen||target.webkitRequestFullscreen,enabled=target.requestFullscreen?doc.fullscreenEnabled:doc.webkitFullscreenEnabled;
    if(!request||enabled===false||owner()&&owner()!==target)return Promise.resolve();
    emit({active:true,mode:'viewport',pending:true});
    let result;
    // Invoke synchronously while the click/key event still has user activation.
    try{result=request.call(target);}catch{emit({active:true,mode:'viewport',pending:false});return Promise.resolve();}
    return Promise.resolve(result).then(()=>{
      if(disposed||operation!==current||!wanted){if(owner()===target)return exitNative().catch(()=>{});return;}
      emit({active:true,mode:owner()===target?'native':'viewport',pending:false});
    },()=>{if(!disposed&&operation===current&&wanted)emit({active:true,mode:'viewport',pending:false});});
  }
  function exit(){
    if(disposed)return Promise.resolve();wanted=false;const current=++operation;
    if(owner()!==target){reset();return Promise.resolve();}
    emit({...state,pending:true});
    let result;try{result=exitNative();}catch{result=Promise.reject(Error('fullscreen exit'));}
    return result.then(()=>{if(!disposed&&operation===current)reset();},()=>{
      if(disposed||operation!==current)return;
      if(owner()===target){wanted=true;emit({active:true,mode:'native',pending:false});}else reset();
    });
  }
  const toggle=()=>state.pending?Promise.resolve():state.active?exit():enter();
  function keydown(event){
    if(doc.querySelector?.('dialog[open]'))return;
    if(event.key==='Escape'&&state.active){if(state.mode==='viewport'){event.preventDefault();exit();}return;}
    if(event.key==='Enter'&&event.altKey&&(state.active||target.contains(doc.activeElement))){event.preventDefault();toggle();}
  }
  doc.addEventListener('fullscreenchange',changed);doc.addEventListener('webkitfullscreenchange',changed);doc.addEventListener('keydown',keydown);
  return {enter,exit,toggle,getState:()=>state,dispose:()=>{
    if(disposed)return;disposed=true;wanted=false;operation++;
    doc.removeEventListener('fullscreenchange',changed);doc.removeEventListener('webkitfullscreenchange',changed);doc.removeEventListener('keydown',keydown);
    unlockPage(false);if(owner()===target){try{exitNative().catch(()=>{});}catch{}}
  }};
}
