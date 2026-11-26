export function learningGeometry(api){
  const scale=api.chart.timeScale();
  return (api.learningStudies||[]).filter(({study})=>study.type==='dottedTrend').map(({study,model})=>{
    const curve=model.curve.filter(point=>point.index>=model.nativeEndIndex).map(point=>({x:scale.logicalToCoordinate(point.index),y:api.candles.priceToCoordinate(point.value)})).filter(point=>Number.isFinite(point.x)&&Number.isFinite(point.y));
    return {id:study.id,color:study.color,width:study.width,curve,signals:[]};
  });
}
export function paintLearning(ctx,rows){
  ctx.save();
  for(const row of rows){
    ctx.strokeStyle=row.color;ctx.lineWidth=row.width;
    if(row.curve?.length){ctx.setLineDash([row.width,row.width]);ctx.beginPath();row.curve.forEach((point,i)=>i?ctx.lineTo(point.x,point.y):ctx.moveTo(point.x,point.y));ctx.stroke();ctx.setLineDash([]);}
  }
  ctx.restore();
}
