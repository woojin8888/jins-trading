import {isMarket,hasVolume} from './instruments.js';
import {validMarketSymbol} from './market-selection.js';
import {sma,mean} from './analysis.js';
import {uploadedRS} from './pine-minervini.js';
import {completedAnalysisBars} from './timeframes.js';
export const ALERT_TYPES={price_above:'가격 이상 도달',price_below:'가격 이하 도달',ma_cross:'종가가 SMA 상향 돌파',volume_above:'거래량 / 직전 20일 평균',rs_above:'업로드 RS 기준 이상'};
export function validateAlert(input){
  if(!Object.hasOwn(ALERT_TYPES,input.kind))throw Error('지원하지 않는 알림 조건입니다.');
  if(!isMarket(input.market)||!validMarketSymbol(input.symbol,input.market))throw Error('종목 코드를 확인하세요.');
  if(input.kind==='volume_above'&&!hasVolume(input.symbol))throw Error('이 자산은 신뢰할 수 있는 거래량을 제공하지 않습니다.');
  const threshold=Number(input.threshold),period=Number(input.period??20);
  if(!Number.isFinite(threshold)||threshold<=0||threshold>1e12)throw Error('알림 기준은 0보다 큰 숫자로 입력하세요.');
  if(!Number.isInteger(period)||period<1||period>500)throw Error('이동평균 기간은 1~500봉으로 입력하세요.');
  return {market:input.market,symbol:input.symbol,name:String(input.name||input.symbol).slice(0,200),kind:input.kind,threshold,period};
}
export function evaluateAlert(rule,history,now=Date.now()){
  if(history.symbol!==rule.symbol)throw Error('알림 종목과 시세 종목이 다릅니다.');
  const sourceAt=history.quote?.asOf;if(!sourceAt||!Number.isFinite(Date.parse(sourceAt))||Date.parse(sourceAt)>now+60000)throw Error('시세 기준 시각을 확인할 수 없습니다.');
  const confirmed=completedAnalysisBars(history.bars||[],'D',history.quality?.sessionOpen),last=confirmed.at(-1);let value=null,condition=false;
  if(rule.kind.startsWith('price_')){
    value=history.quote?.price;
    condition=rule.kind==='price_above'?value>=rule.threshold:value<=rule.threshold;
  }else if(rule.kind==='ma_cross'){
    const points=sma(confirmed,rule.period),ma=points.at(-1),previousMA=points.at(-2),previous=confirmed.at(-2);
    if(!ma||!previousMA||!previous)throw Error('이동평균 돌파 계산에 필요한 일봉이 부족합니다.');
    value=last.close;condition=last.close>ma.value&&previous.close<=previousMA.value;
  }else if(rule.kind==='rs_above'){value=uploadedRS(confirmed).at(-1)?.value;condition=value>=rule.threshold;
  }else if(rule.kind==='volume_above'){
    const prior=confirmed.slice(-21,-1);if(Number.isFinite(last?.volume)&&prior.length===20&&prior.every(b=>Number.isFinite(b.volume))&&mean(prior.map(b=>b.volume))>0)value=last.volume/mean(prior.map(b=>b.volume));condition=value>=rule.threshold;
  }
  if(!Number.isFinite(value))throw Error('알림 계산에 필요한 자료가 부족합니다.');
  // Never notify from quotes that predate rule creation. Indicator rules first
  // establish a baseline so an old crossover is not announced as a new event.
  const newQuote=Date.parse(sourceAt)>=Date.parse(rule.created_at),trigger=rule.kind.startsWith('price_')?condition&&newQuote:rule.last_condition===false&&condition&&newQuote;
  return {condition,value,trigger,sourceAt,barAt:last?.time??null};
}
