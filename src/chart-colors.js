export const CHART_COLORS={up:'#e5484d',down:'#2878eb',neutral:'#9aa7ba'};
export function volumeDirection(current,previous){
  if(!Number.isFinite(current)||current<0||!Number.isFinite(previous)||previous<0)return 'neutral';
  return current>previous?'up':current<previous?'down':'neutral';
}
export const volumeColor=(current,previous)=>CHART_COLORS[volumeDirection(current,previous)];
export function volumePoints(bars){return bars.flatMap((bar,index)=>Number.isFinite(bar.volume)&&bar.volume>=0?[{time:bar.time,value:bar.volume,color:volumeColor(bar.volume,bars[index-1]?.volume)}]:[]);}
