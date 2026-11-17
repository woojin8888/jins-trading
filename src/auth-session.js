// Supabase owns the persisted tokens and refresh rotation. This controller only
// restores UI state and retries reads; it never copies tokens or forces refreshes.
export const AUTH_STORAGE_KEY='jins-trading-auth-v1';
export const persistentAuthOptions={storageKey:AUTH_STORAGE_KEY,persistSession:true,autoRefreshToken:true,detectSessionInUrl:true};
export function observeAuthSession(auth,onChange,{window:win=globalThis.window,document:doc=globalThis.document,setTimer=globalThis.setTimeout,clearTimer=globalThis.clearTimeout}={}){
  let active=true,generation=0,confirmedEvent=false,inFlight=null,retryTimer=null,failures=0;
  let state={session:null,status:auth?'restoring':'guest',error:''};
  const emit=next=>{if(active){state=next;onChange(state);}};
  const cancelRetry=()=>{if(retryTimer!==null){clearTimer(retryTimer);retryTimer=null;}};
  function retry(error){
    if(!active)return;
    emit({...state,error:'로그인 연결을 다시 확인하고 있습니다. 연결이 복구되면 자동으로 이어집니다.'});
    cancelRetry();retryTimer=setTimer(()=>{retryTimer=null;recover();},Math.min(30000,1000*3**Math.min(failures++,4)));
  }
  function recover(){
    if(!active||!auth||doc?.visibilityState==='hidden')return Promise.resolve();
    if(inFlight)return inFlight;
    cancelRetry();const expected=generation;
    const request=Promise.resolve().then(()=>auth.getSession()).then(result=>{
      if(!active||generation!==expected)return;
      if(result.error){retry(result.error);return;}
      failures=0;cancelRetry();const session=result.data?.session||null;
      emit({session,status:session?'authenticated':'guest',error:''});
    }).catch(error=>{if(active&&generation===expected)retry(error);}).finally(()=>{if(inFlight===request)inFlight=null;});
    inFlight=request;return request;
  }
  function changed(event,session){
    if(!active)return;
    // INITIAL_SESSION can arrive after a more recent sign-in/out. An empty
    // initial event can also mean a retryable refresh error, not a logout.
    if(event==='INITIAL_SESSION'){
      if(confirmedEvent)return;
      if(!session)return;
    }else if(event==='SIGNED_OUT'){
      generation++;confirmedEvent=true;cancelRetry();failures=0;
      emit({session:null,status:'guest',error:''});return;
    }else if(!session)return;
    generation++;if(event!=='INITIAL_SESSION')confirmedEvent=true;
    cancelRetry();failures=0;emit({session,status:'authenticated',error:''});
    // Keep this callback synchronous: no Supabase calls under its auth lock.
  }
  emit(state);
  if(!auth)return {recover,dispose:()=>{active=false;}};
  const {data:{subscription}}=auth.onAuthStateChange(changed);
  const wake=()=>{if(doc?.visibilityState!=='hidden')recover();};
  win?.addEventListener('online',wake);win?.addEventListener('pageshow',wake);win?.addEventListener('focus',wake);doc?.addEventListener('visibilitychange',wake);
  recover();
  return {recover,dispose:()=>{active=false;cancelRetry();subscription.unsubscribe();win?.removeEventListener('online',wake);win?.removeEventListener('pageshow',wake);win?.removeEventListener('focus',wake);doc?.removeEventListener('visibilitychange',wake);}};
}
export function persistentStorageAvailable(storage){
  const probe=AUTH_STORAGE_KEY+':probe';
  try{if(!storage)return false;storage.setItem(probe,'1');const saved=storage.getItem(probe)==='1';storage.removeItem(probe);return saved;}catch{return false;}
}
