import {assetKind} from '../src/instruments.js';

export function auditHistory(history){
  const errors=[],warnings=[],bars=history?.bars||[],numeric=history?.quality?.intraday===true;
  if(!history?.symbol||!history.currency||!history.timeZone||!bars.length)errors.push('응답 종목·통화·시간대·봉 자료 누락');
  let previous=null;
  for(const bar of bars){
    const validTime=numeric?Number.isFinite(bar.time):typeof bar.time==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(bar.time)&&Number.isFinite(Date.parse(bar.time));
    if(!validTime||previous!==null&&bar.time<=previous)errors.push('봉 시각이 유효하지 않거나 중복·역순');
    previous=bar.time;
    if(![bar.open,bar.high,bar.low,bar.close].every(n=>Number.isFinite(n)&&(assetKind(history.symbol)==='future'||n>0))||bar.high<Math.max(bar.open,bar.close)||bar.low>Math.min(bar.open,bar.close))errors.push('유효하지 않은 OHLC');
    if(bar.volume!==null&&(!Number.isFinite(bar.volume)||bar.volume<0))errors.push('유효하지 않은 거래량');
    if(numeric&&(!Number.isFinite(bar.endTime)||bar.endTime<=bar.time))errors.push('유효하지 않은 봉 종료 시각');
  }
  if(!Number.isFinite(history.quote?.price)||!Number.isFinite(Date.parse(history.quote?.asOf)))errors.push('최신 가격·기준 시각 누락');
  const q=history?.quality||{};
  for(const key of ['missingLatestSession','priceMismatch','dataGap','providerSessionDiffers'])if(q[key])warnings.push(key);
  for(const key of ['missingSourceBars','incompleteGroups'])if(q[key]>0)warnings.push(`${key}: ${q[key]}`);
  if(numeric&&!q.sourceCoverageChecked)warnings.push('원본 전체 구간 완전성 미확인');
  return {errors:[...new Set(errors)],warnings,bars:bars.length,first:bars[0]?.time,last:bars.at(-1)?.time};
}
const number=value=>{
  if(typeof value==='number')return Number.isFinite(value)?value:null;
  if(typeof value!=='string'||!/^\s*\$?-?[\d,]+(?:\.\d+)?\s*$/.test(value))return null;
  const parsed=Number(value.replace(/[$,\s]/g,''));return Number.isFinite(parsed)?parsed:null;
};
export function compareNasdaqHistory(history,response){
  const data=response?.data;
  if(data?.symbol?.toUpperCase()!==history.symbol?.toUpperCase())throw Error('Nasdaq 응답 종목 불일치');
  const rows=data.tradesTable?.rows;
  if(!Array.isArray(rows))throw Error('Nasdaq 과거 일봉 미제공');
  // Never compare the current unfinished trading day with a historical close.
  const source=history.quality?.sessionOpen?history.bars.slice(0,-1):history.bars;
  const byDate=new Map(source.slice(-14).map(b=>[b.time,b])),comparisons=[];
  for(const row of rows){
    const match=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(row.date||'');if(!match)continue;
    const date=`${match[3]}-${match[1]}-${match[2]}`,bar=byDate.get(date);if(!bar)continue;
    for(const field of ['open','high','low','close','volume']){
      const reference=number(row[field]),actual=bar[field];
      if(!Number.isFinite(reference)||!Number.isFinite(actual))continue;
      const tolerance=field==='volume'?Math.abs(reference)*.001:.01,difference=Math.abs(actual-reference);
      comparisons.push({symbol:history.symbol,date,field,actual,reference,difference,tolerance,match:difference<=tolerance+1e-8});
    }
  }
  return comparisons;
}
