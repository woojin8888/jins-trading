import React from 'react';
export const WATERMARK_NAME='J TRADING';
export const watermarkTicker=symbol=>(symbol||'').replace(/\.(KS|KQ)$/,'');
export default function ChartWatermark({symbol,showTicker=true,top=120}){
  return <div className="chart-watermark" style={{top}} aria-hidden="true">{WATERMARK_NAME}{showTicker&&<span className="watermark-ticker">{watermarkTicker(symbol)}</span>}</div>;
}
