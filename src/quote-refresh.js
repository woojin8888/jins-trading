export function startQuoteRefresh(refresh,{window:win=globalThis.window,document:doc=globalThis.document,now=Date.now}={}){
  let last=now();
  const tick=()=>{if(doc.visibilityState==='visible'&&now()-last>=5000){last=now();refresh();}};
  const timer=win.setInterval(tick,60000);
  win.addEventListener('focus',tick);win.addEventListener('online',tick);doc.addEventListener('visibilitychange',tick);
  return ()=>{win.clearInterval(timer);win.removeEventListener('focus',tick);win.removeEventListener('online',tick);doc.removeEventListener('visibilitychange',tick);};
}
