export const WATERMARK_NAME='J TRADING';
export const watermarkTicker=symbol=>(symbol||'').replace(/\.(KS|KQ)$/,'');
// A native pane primitive is painted before the grid and every series. It is
// captured by takeScreenshot too, so PNG export needs no foreground text pass.
export function attachChartWatermark(pane,initial={}){
  let options={symbol:'',showTicker:true,...initial},requestUpdate=null,detached=false;
  const renderer={draw(target){
    target.useMediaCoordinateSpace(({context:ctx,mediaSize})=>{
      if(mediaSize.width<60||mediaSize.height<45)return;
      const ticker=options.showTicker?watermarkTicker(options.symbol):'',small=mediaSize.width<300;
      ctx.save();ctx.globalAlpha=1;ctx.textAlign='left';ctx.textBaseline='bottom';
      ctx.fillStyle='rgba(110,125,145,0.10)';ctx.font=`600 ${small?15:18}px sans-serif`;
      ctx.fillText(WATERMARK_NAME,12,mediaSize.height-(ticker?29:12),Math.max(1,mediaSize.width-24));
      if(ticker){ctx.fillStyle='rgba(110,125,145,0.08)';ctx.font=`500 ${small?10:12}px sans-serif`;ctx.fillText(ticker,12,mediaSize.height-12,Math.max(1,mediaSize.width-24));}
      ctx.restore();
    });
  }};
  const view={zOrder:()=> 'bottom',renderer:()=>renderer},views=[view];
  const primitive={paneViews:()=>views,attached:context=>{requestUpdate=context.requestUpdate;},detached:()=>{requestUpdate=null;}};
  pane.attachPrimitive(primitive);
  return {
    applyOptions(next){if(detached)return;options={...options,...next};requestUpdate?.();},
    detach(){if(detached)return;detached=true;pane.detachPrimitive(primitive);requestUpdate=null;},
  };
}
