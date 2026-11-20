export const TIMEFRAMES=[['15m','15분'],['30m','30분'],['1h','1시간'],['4h','4시간'],['D','일'],['W','주'],['M','월']];
export const timeframeLabel=value=>TIMEFRAMES.find(([key])=>key===value)?.[1]||value;
export const isIntraday=value=>['15m','30m','1h','4h'].includes(value);
export const timestampKey=time=>typeof time==='number'?time:typeof time==='string'?time:time?`${time.year}-${String(time.month).padStart(2,'0')}-${String(time.day).padStart(2,'0')}`:'';
export function formatBarTime(time,timeZone='Asia/Seoul'){
  if(typeof time!=='number')return timestampKey(time)||'조회 중';
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone,month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(time*1000)).map(part=>[part.type,part.value]));
  return `${p.month}-${p.day} ${p.hour}:${p.minute}`;
}
export function tickTime(time,kind,timeZone){
  const date=new Date(typeof time==='number'?time*1000:Date.parse(timestampKey(time)+'T00:00:00Z'));
  if(kind===0)return date.toLocaleDateString('en-GB',{timeZone,year:'numeric'});
  if(kind===1)return date.toLocaleDateString('sv-SE',{timeZone,year:'numeric',month:'2-digit'});
  return kind>=3?date.toLocaleTimeString('en-GB',{timeZone,hour:'2-digit',minute:'2-digit'}):date.toLocaleDateString('en-GB',{timeZone,month:'2-digit',day:'2-digit'});
}
export function completedAnalysisBars(bars,interval,sessionOpen,{timeZone='UTC',now=Date.now(),assetType='stock'}={}){
  if(!bars.length)return bars;
  if(interval==='W'||interval==='M'){
    const today=new Date(now).toLocaleDateString('sv-SE',{timeZone}),date=new Date(today+'T00:00:00Z'),day=date.getUTCDay();
    const latest=bars.at(-1).time;
    if(interval==='M')return latest<today.slice(0,7)+'-01'?bars:bars.slice(0,-1);
    date.setUTCDate(date.getUTCDate()-((day+6)%7));const monday=date.toISOString().slice(0,10);
    // With no exchange holiday calendar, do not infer a week is over simply
    // because today's daily session closed. Equities can finish at the weekend;
    // overnight FX/futures wait for the next calendar week.
    const weekend=(day===0||day===6)&&!['fx','future'].includes(assetType)&&!sessionOpen;
    return latest<monday||latest===monday&&weekend?bars:bars.slice(0,-1);
  }
  return (isIntraday(interval)?bars.at(-1).complete===false:sessionOpen)?bars.slice(0,-1):bars;
}
