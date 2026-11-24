const marketDate=seconds=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(seconds*1000));
export function parseKoreanHistory(xml,code,now=Date.now()){
 if(!/^\d{6}$/.test(code)||typeof xml!=='string')return [];
 const chart=/<chartdata\b[^>]*\bsymbol\s*=\s*["'](\d{6})["'][^>]*>([\s\S]*?)<\/chartdata>/i.exec(xml);
 if(!chart||chart[1]!==code)return [];
 const today=marketDate(now/1000,'kr'),rows=new Map();
 for(const item of chart[2].matchAll(/<item\b[^>]*\bdata\s*=\s*["']([^"']+)["'][^>]*\/?\s*>/gi)){
  const [day,...raw]=item[1].split('|');if(!/^\d{8}$/.test(day)||raw.length!==5||raw.some(v=>!/^\d+(?:\.\d+)?$/.test(v)))continue;
  const date=day.slice(0,4)+'-'+day.slice(4,6)+'-'+day.slice(6),t=Date.parse(date+'T00:00:00Z')/1000;
  if(!Number.isFinite(t)||new Date(t*1000).toISOString().slice(0,10)!==date||date>today)continue;
  const [o,h,l,c,v]=raw.map(Number);if(![o,h,l,c].every(x=>Number.isFinite(x)&&x>0)||h<Math.max(o,c)||l>Math.min(o,c)||!Number.isSafeInteger(v)||v<0)continue;
  rows.set(date,{t,o,h,l,c,v});
 }
 return [...rows.values()].sort((a,b)=>a.t-b.t);
}
export async function loadKoreanHistory(code,now=Date.now()){
 if(!/^\d{6}$/.test(code))return null;
 try{
  const response=await fetch(`https://fchart.stock.naver.com/sise.nhn?symbol=${code}&timeframe=day&count=500&requestType=0`,{headers:{'User-Agent':'Mozilla/5.0',Referer:'https://finance.naver.com/'},signal:AbortSignal.timeout(5000),cache:'no-store'});
  if(!response.ok)return null;const xml=await response.text();if(xml.length>1000000)return null;
  const bars=parseKoreanHistory(xml,code,now);return bars.length?{bars,meta:{symbol:code},splits:{},provider:'naver'}:null;
 }catch{return null}
}

export async function koreanDailyFallback(symbol,name,now=Date.now()){
 if(!/^\d{6}\.(KS|KQ)$/.test(symbol))return null;
 const code=symbol.slice(0,6),basicPromise=fetch(`https://m.stock.naver.com/api/stock/${code}/basic`,{headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(3000)}).then(r=>r.ok?r.json():null).catch(()=>null),data=await loadKoreanHistory(code,now);if(!data)return null;
 const raw=await basicPromise,basic=raw?.itemCode===code?raw:null,board=basic?.stockExchangeType?.code;
 const canonical=['KS','KQ'].includes(board)?code+'.'+board:symbol,bars=data.bars.map(b=>({time:marketDate(b.t),open:b.o,high:b.h,low:b.l,close:b.c,volume:b.v}));
 const quotedAt=Date.parse(basic?.localTradedAt),timeText=basic?.localTradedAt?.slice(11,16),regularQuote=Number.isFinite(quotedAt)&&quotedAt<=now+300000&&timeText>='09:00'&&timeText<='15:30',price=regularQuote?Number(String(basic.closePrice||'').replaceAll(',','')):null,change=Number(String(basic?.fluctuationsRatio??'').replaceAll(',',''));
 const validPrice=Number.isFinite(price)&&price>0?price:null,quoteDate=regularQuote?marketDate(quotedAt/1000):null,previous=validPrice!==null&&basic?.fluctuationsRatio!=null&&Number.isFinite(change)&&change>-100?validPrice/(1+change/100):null;
 const last=bars.at(-1),today=marketDate(now/1000),end=Date.parse(last.time+'T15:30:00+09:00'),pending=last.time===today&&(!regularQuote||quotedAt<end);
 return {symbol:canonical,assetType:'stock',volumeUnit:'shares',unit:'',name:basic?.stockName||name||code,koreanName:basic?.stockName||name||null,currency:'KRW',bars,asOf:last.time,timeZone:'Asia/Seoul',fetchedAt:new Date(now).toISOString(),source:'네이버페이 증권 실제 일봉 · Yahoo 유효 일봉 없음으로 대체 · 최대 500봉',quote:{price:validPrice,previousClose:previous,previousCloseSource:previous===null?null:'Naver fluctuationsRatio',changePercent:previous===null?null:change,asOf:regularQuote?new Date(quotedAt).toISOString():null,sessionDate:quoteDate,currency:'KRW',precision:0,session:'regular',provider:'네이버페이 증권',providerSymbol:code,regularStart:quoteDate?new Date(quoteDate+'T09:00:00+09:00').toISOString():null,regularEnd:quoteDate?new Date(quoteDate+'T15:30:00+09:00').toISOString():null},quality:{latestBarDate:last.time,expectedSessionDate:quoteDate,missingLatestSession:!!quoteDate&&last.time<quoteDate,priceMismatch:!!quoteDate&&last.time===quoteDate&&validPrice!==null&&Math.abs(last.close-validPrice)>1,sessionOpen:pending,confirmationPending:pending,invalidBarCount:0,regularSessionOnly:true,volumeUnavailable:false}};
}
