import {anchorAtLogical,timeStamp} from './drawing-model.js';
export function chartAnchor(api,x,y){
  if(!api?.data.length||!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>api.chart.timeScale().width()||y<0||y>api.chart.panes()[0].getHeight())return null;
  const logical=api.chart.timeScale().coordinateToLogical(x);if(!Number.isFinite(logical))return null;
  const position=logical>=0&&logical<=api.data.length-1?Math.round(logical):logical;
  const point=anchorAtLogical(position,api.candles.coordinateToPrice(y),api.data.map(b=>timeStamp(b.time)));
  return point?{...point,dateOnly:typeof api.data[0].time==='string',...(api.interval?{interval:api.interval}:{})}:null;
}
export function nearestAverage(api,point,tolerance=8){
  if(!point||!api?.data.length||point.y<0||point.y>api.chart.panes()[0].getHeight())return null;
  const logical=api.chart.timeScale().coordinateToLogical(point.x);if(logical==null)return null;
  const left=Math.floor(logical),fraction=logical-left;if(left<0||left>=api.data.length)return null;
  let nearest=null,distance=tolerance;
  for(const group of api.groups.filter(g=>g.pane===0&&g.id.startsWith('ma-'))){const member=group.members[0],byTime=new Map(member.data.map(p=>[p.time,p.value])),a=byTime.get(api.data[left]?.time),b=byTime.get(api.data[left+1]?.time)??a;
    if(!Number.isFinite(a)||!Number.isFinite(b))continue;const y=member.api.priceToCoordinate(a+(b-a)*fraction);if(y===null)continue;const d=Math.abs(y-point.y);if(d<=distance){distance=d;nearest=group.id;}}
  return nearest;
}
export function menuPosition(x,y,width,height){return {left:Math.max(4,Math.min(x,width-230)),top:Math.max(4,Math.min(y,height-250))};}
