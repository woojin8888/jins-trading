export {rollingMean,emaValues} from './technical-math.js';
const period=(key='period',label='기간',value=14,max=500)=>({key,label,value,min:1,max,step:1});
export const INDICATORS=[
  {type:'sma',name:'SMA · 단순이동평균',short:'SMA',placement:'overlay',description:'종가의 단순 평균을 가격 차트에 표시합니다.',color:'#e8a02d',fields:[period('period','기간',20)]},
  {type:'ema',name:'EMA · 지수이동평균',short:'EMA',placement:'overlay',description:'최근 가격에 더 큰 가중치를 주는 이동평균입니다.',color:'#3878ed',fields:[period('period','기간',21)]},
  {type:'bollinger',name:'볼린저 밴드',short:'BB',placement:'overlay',description:'이동평균과 표준편차로 상단·하단 밴드를 표시합니다.',color:'#6489bd',fields:[period('period','기간',20),{key:'deviation',label:'표준편차 배수',value:2,min:.1,max:10,step:.1}]},
  {type:'vwap',name:'기간 누적 VWAP',short:'VWAP',placement:'overlay',description:'조회한 봉 전체의 거래량 가중 평균입니다. 장중 세션 VWAP과 계산 범위가 다릅니다.',color:'#c38a40',fields:[]},
  {type:'rsi',name:'RSI · 상대강도지수',short:'RSI',placement:'panel',description:'Wilder 방식으로 상승·하락 강도를 계산합니다. 기준선 30·70.',color:'#8a65d5',fields:[period()]},
  {type:'macd',name:'MACD',short:'MACD',placement:'panel',description:'빠른·느린 EMA의 차이, 시그널, 히스토그램을 함께 표시합니다.',color:'#367ceb',fields:[period('fast','빠른 EMA',12,499),period('slow','느린 EMA',26),period('signal','시그널 EMA',9,100)]},
  {type:'atr',name:'ATR · 평균 진폭',short:'ATR',placement:'panel',description:'갭을 포함한 True Range를 Wilder 방식으로 평활합니다.',color:'#df9b42',fields:[period()]},
  {type:'atrPercent',name:'ATR% · 평균 진폭 비율',short:'ATR%',placement:'panel',description:'각 봉의 ATR을 같은 봉의 종가로 나눈 백분율입니다.',color:'#bf9141',fields:[period()]},
  {type:'stochastic',name:'스토캐스틱',short:'Stoch',placement:'panel',description:'고저 범위에서 종가 위치를 계산한 %K·%D입니다. 기준선 20·80.',color:'#329a9d',fields:[period('period','고저 기간',14),period('smoothK','%K 평활',3,100),period('smoothD','%D 평활',3,100)]},
  {type:'obv',name:'OBV · 누적 거래량',short:'OBV',placement:'panel',description:'종가 상승일 거래량은 더하고 하락일은 뺍니다. 첫 봉은 0에서 시작합니다.',color:'#5d9c81',fields:[]},
  ...[['wma','WMA · 가중이동평균'],['rma','RMA · 평활이동평균'],['vwma','VWMA · 거래량가중평균'],['hma','HMA · Hull 이동평균']].map(([type,name])=>({type,name,short:type.toUpperCase(),placement:'overlay',description:'선택한 봉의 종가로 계산하는 이동평균입니다.',color:'#5677bd',fields:[period('period','기간',20)]})),
  {type:'donchian',name:'돈치안 채널',short:'DC',placement:'overlay',description:'기간 내 최고가·최저가와 두 값의 중간선을 표시합니다.',color:'#5e98ba',fields:[period('period','기간',20)]},
  {type:'keltner',name:'켈트너 채널',short:'KC',placement:'overlay',description:'EMA 중심선에 ATR 배수의 상단·하단을 표시합니다.',color:'#9b7eb4',fields:[period('period','EMA 기간',20),period('atrPeriod','ATR 기간',10),{key:'multiplier',label:'ATR 배수',value:2,min:.1,max:10,step:.1}]},
  {type:'dmi',name:'DMI · ADX / +DI / −DI',short:'DMI',placement:'panel',description:'Wilder 평활로 추세 강도와 방향을 함께 계산합니다.',color:'#8e73b9',fields:[period('period','DI 기간',14),period('smoothing','ADX 평활',14)]},
  {type:'cci',name:'CCI · 상품채널지수',short:'CCI',placement:'panel',description:'평균 가격에서 벗어난 정도를 평균 절대편차로 계산합니다.',color:'#b98352',fields:[period('period','기간',20)]},
  {type:'mfi',name:'MFI · 자금흐름지수',short:'MFI',placement:'panel',description:'가격과 거래량을 함께 사용한 상승·하락 자금 흐름입니다.',color:'#489c88',fields:[period()]},
  {type:'williams',name:'Williams %R',short:'%R',placement:'panel',description:'기간 고저 범위에서 종가의 상대 위치를 −100~0으로 표시합니다.',color:'#a97ba5',fields:[period()]},
  {type:'roc',name:'ROC · 가격변화율',short:'ROC',placement:'panel',description:'설정한 기간 전 종가 대비 변화율을 표시합니다.',color:'#558fb1',fields:[period('period','기간',12)]},
  {type:'cmf',name:'CMF · Chaikin 자금흐름',short:'CMF',placement:'panel',description:'고저 범위 안의 종가 위치와 거래량으로 자금 흐름을 계산합니다.',color:'#539980',fields:[period('period','기간',20)]},
  {type:'stochRsi',name:'Stochastic RSI',short:'Stoch RSI',placement:'panel',description:'RSI 범위 내 위치를 다시 계산해 %K·%D를 표시합니다.',color:'#6f83c9',fields:[period('rsiPeriod','RSI 기간',14),period('period','스토캐스틱 기간',14),period('smoothK','%K 평활',3,100),period('smoothD','%D 평활',3,100)]},
];
export const BUILTIN_INDICATORS=[{type:'volume',name:'거래량 · Volume',short:'VOL',placement:'panel',builtin:'showVolume',description:'거래량의 정확한 주수, 우측 수치·수평선과 평균 거래량을 표시합니다.'},{type:'volumeProfile',name:'매물대 · Volume Profile (추정)',short:'VP',placement:'overlay',builtin:'showProfile',description:'보이는 구간 또는 최근 N개 봉의 가격대별 추정 거래량입니다. POC·VAH·VAL을 설정할 수 있습니다.'},{type:'relativeStrength',name:'지수 대비 상대강도 · RS',short:'RS',placement:'panel',builtin:'showRS',description:'선택 지수 대비 주가 비율을 공통 첫 거래일 기준 100으로 표시합니다.'}];
export const MAX_STUDIES=12;
const catalog=new Map(INDICATORS.map(item=>[item.type,item]));
export const indicatorDefinition=type=>catalog.get(type);
export function createStudy(type){const definition=catalog.get(type);if(!definition)return null;return {id:crypto.randomUUID(),type,visible:true,color:definition.color,width:1,params:Object.fromEntries(definition.fields.map(f=>[f.key,f.value]))};}
export function normalizeStudy(raw){
  const definition=catalog.get(raw?.type);if(!definition||typeof raw.id!=='string'||['volume','rs','volumeProfile'].includes(raw.id)||!/^[\w-]{1,80}$/.test(raw.id))return null;
  const params=Object.fromEntries(definition.fields.map(f=>{const value=Number(raw.params?.[f.key]);return [f.key,Number.isFinite(value)&&value>=f.min&&value<=f.max&&(f.step!==1||Number.isInteger(value))?value:f.value];}));
  if(raw.type==='macd'&&params.fast>=params.slow){params.fast=12;params.slow=26;}
  return {id:raw.id,type:raw.type,visible:raw.visible!==false,width:[1,2,3,4].includes(raw.width)?raw.width:1,color:/^#[0-9a-f]{6}$/i.test(raw.color||'')?raw.color:definition.color,params};
}
export function studyLabel(study){const d=catalog.get(study.type);return `${d?.short||study.type}${d?.fields.length?' ('+d.fields.map(f=>study.params[f.key]).join(', ')+')':''}`;}
export {calculateStudy,rsiValues,atrValues} from './indicator-calculations.js';
export function nextLogicalRange(previous,{dataChanged=false,intervalChanged=false,rangeChanged=false,oldLength=0,newLength=0}={}){
  if(!previous||intervalChanged||rangeChanged)return null;
  const shift=dataChanged&&previous.to>=oldLength-1?newLength-oldLength:0;
  return {from:previous.from+shift,to:previous.to+shift};
}
