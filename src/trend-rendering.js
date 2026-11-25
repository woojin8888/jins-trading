export function learningGeometry(api){
  const scale=api.chart.timeScale(),indices=new Map(api.data.map((b,i)=>[b.time,i])),visible=scale.getVisibleLogicalRange();
  return (api.learningStudies||[]).map(({study,model})=>{
    if(study.type==='dottedTrend'){
      const curve=model.curve.filter(point=>point.index>=model.nativeEndIndex).map(point=>({x:scale.logicalToCoordinate(point.index),y:api.candles.priceToCoordinate(point.value)})).filter(point=>Number.isFinite(point.x)&&Number.isFinite(point.y));
      return {id:study.id,color:study.color,width:study.width,curve,signals:[]};
    }
    const x=logical=>scale.logicalToCoordinate(logical),y=price=>api.candles.priceToCoordinate(price);
    const signals=model.signals.filter(signal=>{const index=indices.get(signal.confirmedTime);return !visible||index>=visible.from-1&&index<=visible.to+1;}).flatMap(signal=>{
      const confirmed=indices.get(signal.confirmedTime),pivot=indices.get(signal.pivotTime),px=x(confirmed),py=y(signal.confirmationLow),originX=x(pivot),originY=y(signal.price);
      return [px,py,originX,originY].every(Number.isFinite)?[{...signal,x:px,y:py+14,originX,originY}]:[];
    });
    return {id:study.id,color:study.color,width:study.width,signals,showPivotOrigin:study.params.showPivotOrigin};
  });
}
export function paintLearning(ctx,rows,width){
  ctx.save();ctx.font='11px sans-serif';
  for(const row of rows){
    ctx.strokeStyle=row.color;ctx.fillStyle=row.color;ctx.lineWidth=row.width;
    if(row.curve?.length){ctx.setLineDash([row.width,row.width]);ctx.beginPath();row.curve.forEach((point,i)=>i?ctx.lineTo(point.x,point.y):ctx.moveTo(point.x,point.y));ctx.stroke();ctx.setLineDash([]);}
    for(const signal of row.signals){
      if(signal.x<0||signal.x>width)continue;
      ctx.beginPath();ctx.moveTo(signal.x,signal.y-5);ctx.lineTo(signal.x-5,signal.y+4);ctx.lineTo(signal.x+5,signal.y+4);ctx.closePath();ctx.fill();ctx.fillText('저점 확인',signal.x-22,signal.y+18);
      if(row.showPivotOrigin){ctx.setLineDash([2,3]);ctx.beginPath();ctx.moveTo(signal.originX,signal.originY);ctx.lineTo(signal.x,signal.y);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.arc(signal.originX,signal.originY,3,0,Math.PI*2);ctx.stroke();}
    }
  }
  ctx.restore();
}
