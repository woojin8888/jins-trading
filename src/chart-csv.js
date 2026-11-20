const columns=['market','symbol','interval','time','time_utc','time_local','time_zone','open','high','low','close','volume','volume_unit','currency','confirmed','mode','session','source'];
const cell=value=>{
  if(value===null||value===undefined)return '""';
  if(typeof value==='number')return Number.isFinite(value)?'"'+String(value)+'"':'""';
  return '"'+String(value).replace(/^[=+\-@\t\r\n]/,"'$&").replaceAll('"','""')+'"';
};
export function exportChartCSV({bars,market,symbol,interval,timeZone='UTC',currency,volumeUnit='주',confirmedTimes=[],mode='chart',source='Yahoo Finance'}){
  const confirmed=new Set(confirmedTimes),local=new Intl.DateTimeFormat('sv-SE',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  const rows=bars.map(b=>{const intraday=typeof b.time==='number';return [market,symbol,interval,b.time,intraday?new Date(b.time*1000).toISOString():'',intraday?local.format(new Date(b.time*1000)):b.time,timeZone,b.open,b.high,b.low,b.close,b.volume,volumeUnit,currency,confirmed.has(b.time)?'true':'false',mode,'regular',source];});
  return '\uFEFF'+[columns,...rows].map(row=>row.map(cell).join(',')).join('\r\n');
}
export function chartCSVFilename(symbol,interval,mode){
  return 'jins-trading-'+String(symbol).replace(/[^A-Za-z0-9_-]/g,'_')+'-'+String(interval).replace(/[^A-Za-z0-9]/g,'')+'-'+(mode==='replay'?'replay':'regular')+'.csv';
}
