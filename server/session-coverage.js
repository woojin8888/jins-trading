// An expected intraday slot without OHLC is unavailable, not a zero-volume bar.
// Inspect only sessions touched by this response and only up to the quote cutoff:
// weekends, future slots, and time before a truncated range are not missing data.
export function sessionCoverage(bars,sessions,seconds,quoteTime,firstTimestamp){
  const available=new Set(bars.map(b=>b.time)),unique=new Map(sessions.map(s=>[s.start,s]));
  let missingSourceBars=0,missingSourceSeconds=0,affectedSessions=0;
  const sourceGaps=[];
  for(const {start,end} of [...unique.values()].sort((a,b)=>a.start-b.start)){
    const cutoff=Math.min(end,quoteTime);
    if(!Number.isFinite(cutoff)||cutoff<=start)continue;
    let count=0,gap=null;
    for(let time=start;time<cutoff;time+=seconds){
      if(time<firstTimestamp)continue;
      if(available.has(time)){gap=null;continue;}
      const gapEnd=Math.min(time+seconds,end,cutoff);
      count++;missingSourceBars++;missingSourceSeconds+=gapEnd-time;
      if(gap)gap.end=gapEnd;
      else{gap={start:time,end:gapEnd};if(sourceGaps.length<12)sourceGaps.push(gap);}
    }
    if(count)affectedSessions++;
  }
  return {missingSourceBars,missingSourceSeconds,affectedSessions,sourceGaps,sourceCoverageChecked:true};
}
