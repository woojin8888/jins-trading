export const mean=values=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
export function sma(bars,period){let sum=0;return bars.map((bar,i)=>{sum+=bar.close;if(i>=period)sum-=bars[i-period].close;return i>=period-1?{time:bar.time,value:sum/period}:null;}).filter(Boolean);}
export function atr(bars,period=14){
  if(bars.length<period+1)return null;
  const tr=bars.slice(1).map((b,i)=>Math.max(b.high-b.low,Math.abs(b.high-bars[i].close),Math.abs(b.low-bars[i].close)));
  let value=mean(tr.slice(0,period));for(const range of tr.slice(period))value=(value*(period-1)+range)/period;
  return {value,percent:value/bars.at(-1).close*100};
}
export function minervini(bars,rsRating=null){
  const price=bars.at(-1)?.close,ma50=sma(bars,50).at(-1)?.value,ma150=sma(bars,150).at(-1)?.value,ma200=sma(bars,200).at(-1)?.value,prev200=sma(bars.slice(0,-22),200).at(-1)?.value;
  const recent=bars.slice(-252),enough=bars.length>=252,high=enough?Math.max(...recent.map(b=>b.high)):null,low=enough?Math.min(...recent.map(b=>b.low)):null;
  const checks=[
    {label:'종가 > 150일선 · 200일선',pass:ma200==null?null:price>ma150&&price>ma200},
    {label:'150일선 > 200일선',pass:ma200==null?null:ma150>ma200},
    {label:'200일선 상승 추세 (22거래일)',pass:prev200==null?null:ma200>prev200},
    {label:'50일선 > 150일선 · 200일선',pass:ma200==null?null:ma50>ma150&&ma50>ma200},
    {label:'종가 > 50일선',pass:ma50==null?null:price>ma50},
    {label:'52주 저가 대비 30% 이상 상승',pass:low==null?null:price>=low*1.3},
    {label:'52주 고가에서 25% 이내',pass:high==null?null:price>=high*.75},
    {label:'TOP100 RS 백분위 ≥ 70',pass:Number.isFinite(rsRating)?rsRating>=70:null},
  ];
  return {checks,score:checks.filter(c=>c.pass===true).length,known:checks.filter(c=>c.pass!==null).length,ma50,ma150,ma200,high,low};
}
export function rsLine(bars,benchmark){const map=new Map(benchmark.map(b=>[b.time,b.close]));const shared=bars.filter(b=>map.get(b.time)>0);if(!shared.length)return [];const base=shared[0].close/map.get(shared[0].time);return shared.map(b=>({time:b.time,value:b.close/map.get(b.time)/base*100}));}
export function aggregate(bars,interval){
  if(!['W','M'].includes(interval))return bars;
  const groups=new Map();for(const b of bars){const d=new Date(b.time+'T00:00:00Z');if(interval==='W')d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));else d.setUTCDate(1);const key=d.toISOString().slice(0,10);const current=groups.get(key);if(current){current.high=Math.max(current.high,b.high);current.low=Math.min(current.low,b.low);current.close=b.close;current.volume=current.volume===null||b.volume===null?null:current.volume+b.volume;}else groups.set(key,{...b,time:key});}return [...groups.values()];
}
export function volumeProfile(bars,count=32){
  if(!bars.length||!bars.some(b=>b.volume>0))return [];
  const low=Math.min(...bars.map(b=>b.low)),high=Math.max(...bars.map(b=>b.high)),step=(high-low||1)/count,bins=Array.from({length:count},(_,i)=>({low:low+i*step,high:low+(i+1)*step,volume:0}));
  for(const b of bars){if(!(b.volume>0))continue;if(b.high===b.low){bins[Math.min(count-1,Math.max(0,Math.floor((b.close-low)/step)))].volume+=b.volume;continue;}for(const bin of bins){const overlap=Math.max(0,Math.min(b.high,bin.high)-Math.max(b.low,bin.low));bin.volume+=b.volume*overlap/(b.high-b.low);}}
  return bins;
}
export function vcp(bars){
  if(bars.length<60)return null;
  const windows=[bars.slice(-60,-40),bars.slice(-40,-20),bars.slice(-20)],ranges=windows.map(w=>(Math.max(...w.map(b=>b.high))/Math.min(...w.map(b=>b.low))-1)*100);
  const volumes=windows.map(w=>w.every(b=>b.volume!==null)?mean(w.map(b=>b.volume)):null),contracting=ranges[0]>ranges[1]&&ranges[1]>ranges[2],drying=volumes.every(v=>v!==null)&&volumes[2]<volumes[1]&&volumes[1]<volumes[0];
  return {ranges,volumes,contracting,drying,candidate:contracting&&drying};
}
