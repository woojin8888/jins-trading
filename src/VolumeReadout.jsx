import React,{useMemo} from 'react';
import {BarChart3,Settings2,ArrowUpRight,ArrowDownRight} from 'lucide-react';
import {formatVolume,movingAverageValues} from './technical-math.js';
import {volumeDirection} from './chart-colors.js';
import {chartTimeKey} from './technical-math.js';
import {formatBarTime} from './timeframes.js';
export default function VolumeReadout({bars,hover,settings,onSettings,timeZone='Asia/Seoul'}){
  const averages=useMemo(()=>movingAverageValues(settings.averageType,bars.map(b=>b.volume),settings.averagePeriod),[bars,settings.averageType,settings.averagePeriod]);
  const index=hover?bars.findIndex(b=>b.time===chartTimeKey(hover.time)):bars.length-1,bar=bars[index],previous=bars[index-1],direction=volumeDirection(bar?.volume,previous?.volume),change=Number.isFinite(bar?.volume)&&previous?.volume>0?(bar.volume/previous.volume-1)*100:bar?.volume===0&&previous?.volume===0?0:null;
  return <div className="volume-quote-strip"><div className="volume-quote-name"><BarChart3 size={16}/><div><b>거래량</b><span>{hover?'선택한 봉':'최근 봉'} · {formatBarTime(bar?.time,timeZone)}</span></div></div><strong className={'volume-'+direction} title={formatVolume(bar?.volume)}>{formatVolume(bar?.volume,settings.format)}</strong><span className={'volume-'+direction}>{Number.isFinite(change)?<>{change>0?<ArrowUpRight size={14}/>:change<0?<ArrowDownRight size={14}/>:null}{change>0?'+':''}{change.toFixed(2)}% <small>전봉 대비</small></>:previous?.volume===0&&Number.isFinite(bar?.volume)?'전봉 0주':'이전 거래량 미확인'}</span>{settings.averageVisible&&<div className="volume-average-quote"><i style={{background:settings.averageColor,height:settings.averageWidth}}/><span>{settings.averageType.toUpperCase()} {settings.averagePeriod}</span><b>{formatVolume(averages[index],settings.format)}</b></div>}<button className="icon-button" aria-label="거래량 숫자와 평균선 설정" title="거래량 설정" onClick={onSettings}><Settings2 size={15}/></button></div>;
}
