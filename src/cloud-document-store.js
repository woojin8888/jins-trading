// A document never changes owners. Reads finish before edits, writes serialize,
// and an unsuccessful write stays dirty for an explicit retry.
export function createDocumentStore({initial,normalize,read,write,persist=()=>{},delay=800}){
  let state={value:normalize(initial),ready:!read,status:read?'불러오는 중':'브라우저 저장',error:''},revision=0,saved=0,timer=null,loading=null,writing=null;
  const listeners=new Set(),emit=patch=>{state={...state,...patch};for(const listener of listeners)listener();};
  async function load(){
    if(state.ready||loading)return loading;
    loading=(async()=>{try{const value=await read();emit({value:value==null?state.value:normalize(value),ready:true,status:'계정 저장',error:''});try{persist(state.value);}catch(error){emit({error:error.message});}if(value==null&&write){revision++;timer=setTimeout(flush,delay);}}catch(error){emit({error:error.message,status:'불러오기 실패'});}finally{loading=null;}})();return loading;
  }
  async function flush(){
    clearTimeout(timer);if(!state.ready||revision===saved||!write)return;
    if(writing){await writing;return revision!==saved&&!state.error?flush():undefined;}
    const version=revision,value=state.value;emit({status:'저장 중',error:''});
    writing=(async()=>{try{await write(value);saved=version;emit({status:revision===saved?'계정 저장':'저장 대기',error:''});}catch(error){emit({status:'저장 실패',error:error.message});}finally{writing=null;}})();
    await writing;if(revision!==saved&&!state.error)return flush();
  }
  return {subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener);},snapshot:()=>state,load,flush,
    retry:()=>state.ready?flush():load(),
    update(update){if(!state.ready)return false;const value=normalize(typeof update==='function'?update(state.value):update);if(JSON.stringify(value)===JSON.stringify(state.value))return true;revision++;emit({value,error:'',status:write?'저장 대기':'브라우저 저장'});try{persist(value);}catch(error){emit({error:error.message});}if(write){clearTimeout(timer);timer=setTimeout(flush,delay);}return true;},
  };
}
