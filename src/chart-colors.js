export const CHART_COLORS={up:'#e5484d',down:'#2878eb',neutral:'#9aa7ba'};
export function volumeDirection(current,previous){
  if(!Number.isFinite(current)||current<0||!Number.isFinite(previous)||previous<0)return 'neutral';
  return current>previous?'up':current<previous?'down':'neutral';
}
export function candleDirection(bar){return !Number.isFinite(bar?.open)||!Number.isFinite(bar?.close)?'neutral':bar.close>=bar.open?'up':'down';}
export const volumeColor=bar=>CHART_COLORS[candleDirection(bar)];
export function volumePoints(bars){return bars.flatMap(bar=>Number.isFinite(bar.volume)&&bar.volume>=0?[{time:bar.time,value:bar.volume,color:volumeColor(bar)}]:[]);}
