import React,{useEffect,useId,useRef,useState} from 'react';
import {Search,ChevronRight} from 'lucide-react';
import {marketData} from './backend.js';
import {MARKETS,assetSearch,marketLabel} from './instruments.js';
import {canonicalMarketSymbol,validMarketSymbol} from './market-selection.js';
const EMPTY=[];
export default function SymbolSearch({market,onSelect,suggestions=EMPTY,label='종목 검색'}){
  const [query,setQuery]=useState(''),[open,setOpen]=useState(false),[active,setActive]=useState(-1),[state,setState]=useState({key:'',rows:[],busy:false,error:''}),[error,setError]=useState('');
  const id=useId(),input=useRef(null),request=useRef(null),owner=useRef(market);owner.current=market;
  const text=query.trim(),key=market+':'+text,rows=state.key===key?state.rows:EMPTY,expanded=open&&!!text;
  useEffect(()=>{setQuery('');setOpen(false);setError('');setActive(-1);return()=>request.current?.abort();},[market]);
  useEffect(()=>{
    if(!text){setState({key,rows:[],busy:false,error:''});return;}
    const abort=new AbortController();request.current?.abort();request.current=abort;setActive(-1);setState({key,rows:[],busy:true,error:''});
    const timer=setTimeout(()=>{
      marketData({action:'search',market,q:text},abort.signal).then(data=>{if(!abort.signal.aborted)setState({key,rows:data.rows,busy:false,error:''});}).catch(e=>{if(!abort.signal.aborted)setState({key,rows:[],busy:false,error:e.message});});
    },200);return()=>{clearTimeout(timer);abort.abort();};
  },[market,text,suggestions]);
  function choose(stock){onSelect({...stock,market});setQuery('');setOpen(false);setActive(-1);setError('');input.current?.focus();}
  async function submit(e){
    e.preventDefault();setError('');if(!text)return;if(active>=0&&rows[active]){choose(rows[active]);return;}
    const expected=market,abort=new AbortController();request.current?.abort();request.current=abort;
    try{const data=await marketData({action:'search',market,q:text},abort.signal),available=[...new Map([...data.rows,...suggestions,...assetSearch(text,market)].map(r=>[r.symbol,r])).values()];if(abort.signal.aborted||owner.current!==expected)return;
      setState({key,rows:available.slice(0,20),busy:false,error:''});const normalized=text.normalize('NFKC').replace(/\s/g,'').toUpperCase(),exact=available.find(r=>[r.symbol,r.ticker,r.name].some(v=>v?.replace(/\s/g,'').toUpperCase()===normalized));if(exact){choose(exact);return;}
      try{const symbol=canonicalMarketSymbol(text,market);choose({symbol,name:symbol});return;}catch{}
      setError(market==='kr'?'검색 결과에서 종목을 선택하거나 6자리 종목 코드를 입력하세요.':'시장에 맞는 전체 코드를 입력하거나 검색 결과에서 선택하세요.');
    }catch(e){if(!abort.signal.aborted&&owner.current===expected){try{const symbol=canonicalMarketSymbol(text,market);choose({symbol,name:symbol});return;}catch{}setError(e.message);setState(s=>({...s,busy:false}));}}
  }
  return <div className="symbol-search-container" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOpen(false);}}><form className="symbol-search" onSubmit={submit}><Search size={16}/><input ref={input} aria-label={label} role="combobox" aria-autocomplete="list" aria-expanded={expanded} aria-controls={id} aria-activedescendant={expanded&&active>=0?`${id}-${active}`:undefined} autoComplete="off" placeholder={market==='kr'?'한국 종목명·코드 검색':marketLabel(market)+' 이름·코드 검색'} value={query} maxLength={60} onFocus={()=>setOpen(true)} onChange={e=>{setQuery(e.target.value);setActive(-1);setOpen(true);setError('');}} onKeyDown={e=>{if(e.nativeEvent.isComposing||e.keyCode===229){if(e.key==='Enter')e.preventDefault();return;}if(e.key==='Escape'){e.stopPropagation();setOpen(false);setActive(-1);}if((e.key==='ArrowDown'||e.key==='ArrowUp')&&rows.length){e.preventDefault();setOpen(true);setActive(i=>(i+(e.key==='ArrowDown'?1:-1)+rows.length)%rows.length);}}}/><button type="submit" aria-label={`${label} 실행`}><ChevronRight size={15}/></button></form>
    {expanded&&<div className="symbol-results"><div id={id} role="listbox" aria-label="종목 검색 결과">{rows.map((row,index)=><button type="button" key={row.symbol} id={`${id}-${index}`} role="option" tabIndex={-1} aria-selected={active===index} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(row)}><span><b>{row.name||row.ticker||row.symbol}</b><small>{row.ticker||row.symbol}</small></span><em>{row.exchange==='KOSPI'?'코스피':row.exchange==='KOSDAQ'?'코스닥':row.exchange||marketLabel(market)}</em></button>)}</div>{state.busy?<p role="status">종목 검색 중…</p>:state.error?<p className="error-text" role="alert">{state.error}</p>:!rows.length?<p>검색 결과가 없습니다.{market==='kr'?' 한글 이름이나 종목 코드를 확인하세요.':' 티커를 입력해 검색할 수 있습니다.'}</p>:null}</div>}{error&&<p className="symbol-search-error" role="alert">{error}</p>}
  </div>;
}
