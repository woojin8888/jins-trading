import test from 'node:test';
import assert from 'node:assert/strict';
import {createChartFullscreen} from '../src/fullscreen-controller.js';
function setup({native=true,reject=false,pending=false}={}){
  const doc=new EventTarget(),states=[],scrolls=[];let requested=0,exited=0,focused=0,finish;
  const sibling={inert:false},alreadyInert={inert:true};
  const target={isConnected:true,children:[]},button={isConnected:true,focus:()=>{focused++;doc.activeElement=button;}};
  target.contains=element=>element===button||element===target;
  const parent={children:[target,sibling]},body={style:{overflow:'auto'},children:[parent,alreadyInert]};target.parentElement=parent;parent.parentElement=body;
  Object.assign(doc,{body,documentElement:{style:{overflow:'scroll'}},activeElement:button,fullscreenElement:null,fullscreenEnabled:native,querySelector:()=>null});
  const complete=()=>{doc.fullscreenElement=target;doc.dispatchEvent(new Event('fullscreenchange'));};
  if(native)target.requestFullscreen=()=>{requested++;if(reject)return Promise.reject(Error('unsupported'));if(pending)return new Promise(resolve=>{finish=()=>{complete();resolve();};});complete();return Promise.resolve();};
  doc.exitFullscreen=()=>{exited++;doc.fullscreenElement=null;doc.dispatchEvent(new Event('fullscreenchange'));return Promise.resolve();};
  const win={scrollX:12,scrollY:450,scrollTo:(...args)=>scrolls.push(args)};
  const controller=createChartFullscreen(target,value=>states.push(value),{document:doc,window:win});
  return {controller,doc,states,target,button,sibling,alreadyInert,scrolls,requested:()=>requested,exited:()=>exited,focused:()=>focused,finish:()=>finish()};
}
function key(doc,key,altKey=false){const event=new Event('keydown',{cancelable:true});Object.assign(event,{key,altKey});doc.dispatchEvent(event);return event;}
test('native fullscreen enters the existing chart node and restores focus, scroll and prior page styles on exit',async()=>{
  const h=setup();const node=h.target;await h.controller.enter();assert.equal(h.requested(),1);assert.equal(h.doc.fullscreenElement,node);assert.equal(h.controller.getState().mode,'native');assert.equal(h.doc.body.style.overflow,'hidden');assert.equal(h.sibling.inert,true);
  await h.controller.exit();assert.equal(h.controller.getState().active,false);assert.equal(h.doc.body.style.overflow,'auto');assert.equal(h.doc.documentElement.style.overflow,'scroll');assert.equal(h.sibling.inert,false);assert.equal(h.alreadyInert.inert,true);assert.equal(h.focused(),1);assert.deepEqual(h.scrolls,[[12,450]]);h.controller.dispose();
});
test('the browser Escape/fullscreen-change path restores the normal chart layout',async()=>{
  const h=setup();await h.controller.enter();h.doc.fullscreenElement=null;h.doc.dispatchEvent(new Event('fullscreenchange'));assert.equal(h.controller.getState().active,false);assert.equal(h.doc.body.style.overflow,'auto');assert.equal(h.sibling.inert,false);h.controller.dispose();
});
test('mobile browsers without a native API still fill the viewport and close on Escape',async()=>{
  const h=setup({native:false});await h.controller.enter();assert.deepEqual(h.controller.getState(),{active:true,mode:'viewport',pending:false});assert.equal(h.requested(),0);const event=key(h.doc,'Escape');assert.equal(event.defaultPrevented,true);assert.equal(h.controller.getState().active,false);h.controller.dispose();
});
test('a rejected fullscreen request falls back to the viewport and can be closed with the same button',async()=>{
  const h=setup({reject:true});await h.controller.toggle();assert.equal(h.requested(),1);assert.deepEqual(h.controller.getState(),{active:true,mode:'viewport',pending:false});await h.controller.toggle();assert.equal(h.controller.getState().active,false);assert.equal(h.exited(),0);h.controller.dispose();
});
test('Escape closes the settings dialog first instead of dismissing a viewport chart behind it',async()=>{
  const h=setup({native:false});await h.controller.enter();h.doc.querySelector=()=>({open:true});key(h.doc,'Escape');assert.equal(h.controller.getState().active,true);h.doc.querySelector=()=>null;key(h.doc,'Escape');assert.equal(h.controller.getState().active,false);h.controller.dispose();
});
test('canceling while a native request is pending cannot reopen fullscreen later',async()=>{
  const h=setup({pending:true}),request=h.controller.enter();assert.equal(h.controller.getState().pending,true);await h.controller.exit();h.finish();await request;assert.equal(h.doc.fullscreenElement,null);assert.equal(h.controller.getState().active,false);assert.equal(h.doc.body.style.overflow,'auto');h.controller.dispose();
});
test('unmounting releases the fullscreen element and page locks, and late events do not update state',async()=>{
  const h=setup();await h.controller.enter();const count=h.states.length;h.controller.dispose();assert.equal(h.doc.fullscreenElement,null);assert.equal(h.sibling.inert,false);assert.equal(h.doc.body.style.overflow,'auto');h.doc.dispatchEvent(new Event('fullscreenchange'));key(h.doc,'Enter',true);assert.equal(h.states.length,count);
});
test('Alt+Enter toggles a focused chart while leaving unrelated keyboard actions alone',async()=>{
  const h=setup({native:false});h.doc.activeElement={};assert.equal(key(h.doc,'Enter',true).defaultPrevented,false);assert.equal(h.controller.getState().active,false);h.doc.activeElement=h.button;assert.equal(key(h.doc,'Enter',true).defaultPrevented,true);assert.equal(h.controller.getState().active,true);key(h.doc,'Enter',true);assert.equal(h.controller.getState().active,false);h.controller.dispose();
});
test('unsupported synchronous API errors preserve a working viewport chart',async()=>{
  const h=setup();h.target.requestFullscreen=()=>{throw Error('not supported');};await h.controller.enter();assert.equal(h.controller.getState().mode,'viewport');assert.equal(h.controller.getState().pending,false);await h.controller.exit();assert.equal(h.doc.body.style.overflow,'auto');h.controller.dispose();
});
test('a rejected native exit keeps a usable close button instead of leaving a pending state',async()=>{
  const h=setup();await h.controller.enter();const original=h.doc.exitFullscreen;h.doc.exitFullscreen=()=>{throw Error('temporarily unavailable');};await h.controller.exit();assert.deepEqual(h.controller.getState(),{active:true,mode:'native',pending:false});h.doc.exitFullscreen=original;await h.controller.exit();assert.equal(h.controller.getState().active,false);h.controller.dispose();
});
test('WebKit-prefixed fullscreen events and methods use the same cleanup and return path',async()=>{
  const h=setup({native:false});h.doc.webkitFullscreenEnabled=true;h.target.webkitRequestFullscreen=()=>{h.doc.webkitFullscreenElement=h.target;h.doc.dispatchEvent(new Event('webkitfullscreenchange'));};delete h.doc.exitFullscreen;h.doc.webkitExitFullscreen=()=>{h.doc.webkitFullscreenElement=null;h.doc.dispatchEvent(new Event('webkitfullscreenchange'));};
  await h.controller.enter();assert.equal(h.controller.getState().mode,'native');await h.controller.exit();assert.equal(h.controller.getState().active,false);assert.equal(h.doc.body.style.overflow,'auto');h.controller.dispose();
});
