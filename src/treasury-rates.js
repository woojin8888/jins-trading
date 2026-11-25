export const TREASURIES=[
 {id:'UST2Y',years:2,field:'BC_2YEAR',name:'미 재무부 2년 일별 금리',tv:'TVC:US02Y'},
 {id:'UST10Y',years:10,field:'BC_10YEAR',name:'미 재무부 10년 일별 금리',tv:'TVC:US10Y'},
 {id:'UST30Y',years:30,field:'BC_30YEAR',name:'미 재무부 30년 일별 금리',tv:'TVC:US30Y'},
];
export const treasuryRate=id=>TREASURIES.find(row=>row.id===id)||null;
export function aggregateTreasury(points,interval){
 if(!['D','W','M'].includes(interval))throw Error('공시 자료는 일·주·월별만 지원합니다.');
 if(interval==='D')return points;
 const groups=new Map();for(const point of points){const d=new Date(point.time+'T00:00:00Z');if(interval==='W')d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));else d.setUTCDate(1);groups.set(d.toISOString().slice(0,10),point);}return [...groups.values()];
}
