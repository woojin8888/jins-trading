import {TREASURIES,treasuryRate} from '../src/treasury-rates.js';
const cache=new Map(),pending=new Map();
const dateAt=now=>new Date(now).toLocaleDateString('sv-SE',{timeZone:'America/New_York'});
const validDate=date=>/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date))&&new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date;
export function parseTreasuryXml(xml,year,now=Date.now()){
 if(typeof xml!=='string'||xml.length>4000000||/<!DOCTYPE|<!ENTITY/i.test(xml)||!xml.includes('http://www.w3.org/2005/Atom')||!xml.includes('DailyTreasuryYieldCurveRateData'))throw Error('재무부 공시 응답 형식이 다릅니다.');
 const today=dateAt(now),rows=new Map();
 for(const entry of xml.matchAll(/<m:properties\b[^>]*>([\s\S]*?)<\/m:properties>/g)){
  const body=entry[1],raw=/<d:NEW_DATE\b[^>]*>([^<]+)<\/d:NEW_DATE>/.exec(body)?.[1],date=raw?.slice(0,10);
  if(!date||!validDate(date)||Number(date.slice(0,4))!==year||date>today)continue;
  const values={};for(const item of TREASURIES){const tag=new RegExp('<d:'+item.field+'\\b([^>]*)>([^<]*)<\\/d:'+item.field+'>').exec(body),text=tag?.[2]?.trim();if(!tag||/null\s*=\s*["']true["']/.test(tag[1])||!text||!/^[-+]?\d+(?:\.\d+)?$/.test(text))continue;const value=Number(text);if(Number.isFinite(value))values[item.id]=value;}
  rows.set(date,{date,values});
 }
 if(!rows.size)throw Error('해당 연도의 유효한 재무부 공시가 없습니다.');
 return [...rows.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
async function yearRows(year,now,fresh){
 const prior=cache.get(year),current=Number(dateAt(now).slice(0,4)),ttl=year===current?900000:86400000;
 if(prior&&now-prior.at<ttl&&(!fresh||year!==current||now-prior.at<30000))return prior.rows;
 if(pending.has(year))return pending.get(year);
 const task=(async()=>{const url='https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?'+new URLSearchParams({data:'daily_treasury_yield_curve',field_tdr_date_value:String(year)}),response=await fetch(url,{signal:AbortSignal.timeout(10000),headers:{'User-Agent':'JinsTrading/1.0'},cache:'no-store'});if(!response.ok)throw Error('미국 재무부 공시 조회 실패');const rows=parseTreasuryXml(await response.text(),year,now);cache.set(year,{at:now,rows});while(cache.size>36)cache.delete(cache.keys().next().value);return rows;})();
 pending.set(year,task);try{return await task;}finally{pending.delete(year);}
}
export async function treasuryHistory(symbol,range='2y',{now=Date.now(),fresh=false}={}){
 const item=treasuryRate(symbol),years=Number(range.replace('y',''));if(!item)throw Object.assign(Error('지원하지 않는 재무부 금리 코드입니다.'),{status:400});if(!['1y','2y','5y','10y'].includes(range))throw Object.assign(Error('지원하지 않는 공시 기간입니다.'),{status:400});
 const today=dateAt(now),cutoff=new Date(today+'T00:00:00Z');cutoff.setUTCFullYear(cutoff.getUTCFullYear()-years);const first=cutoff.toISOString().slice(0,10),requested=Array.from({length:Number(today.slice(0,4))-cutoff.getUTCFullYear()+1},(_,i)=>cutoff.getUTCFullYear()+i),results=new Map();let next=0;
 async function worker(){while(next<requested.length){const year=requested[next++];try{results.set(year,{rows:await yearRows(year,now,fresh)});}catch(error){results.set(year,{error:error.message});}}}
 await Promise.all(Array.from({length:Math.min(3,requested.length)},worker));
 const observations=[...new Map(requested.flatMap(year=>(results.get(year)?.rows||[]).filter(row=>row.date>=first&&Number.isFinite(row.values[symbol])).map(row=>[row.date,{time:row.date,close:row.values[symbol],volume:null}]))).values()].sort((a,b)=>a.time.localeCompare(b.time));
 if(!observations.length)throw Error('유효한 재무부 공시금리를 조회하지 못했습니다.');
 const last=observations.at(-1),previous=observations.at(-2),missingYears=requested.filter(year=>results.get(year)?.error||!(results.get(year)?.rows||[]).some(row=>Number.isFinite(row.values[symbol]))),omittedValueDates=requested.flatMap(year=>(results.get(year)?.rows||[]).filter(row=>row.date>=first&&!Number.isFinite(row.values[symbol])).map(row=>row.date));
 return {symbol,name:item.name,years:item.years,unit:'%',observations,asOfDate:last.time,previousDate:previous?.time||null,changePoints:previous?last.close-previous.close:null,changeBasisPoints:previous?(last.close-previous.close)*100:null,timeZone:'America/New_York',fetchedAt:new Date(now).toISOString(),range,source:'U.S. Treasury · Daily Treasury Par Yield Curve Rates',sourceUrl:'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve',basis:'재무부 일별 파수익률(고정만기) 공시 · TVC 장중 금리와 산출 기준이 다릅니다.',quality:{dailyReference:true,partial:missingYears.length>0,missingYears,omittedValueDates,ohlcAvailable:false,volumeAvailable:false}};
}
