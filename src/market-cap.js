export function formatMarketCapKRW(value){
 if(!Number.isFinite(value)||value<=0)return '—';
 const trillion=value/1e12;
 if(trillion<.0001)return '0.0001조 원 미만';
 return trillion.toLocaleString('ko-KR',{minimumFractionDigits:2,maximumFractionDigits:trillion<.01?4:2})+'조 원';
}
