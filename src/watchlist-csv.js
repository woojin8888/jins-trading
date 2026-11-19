import {isMarket} from './instruments.js';
import {validMarketSymbol} from './market-selection.js';
export function parseCSV(text){
  if(text.length>500000)throw Error('CSV 파일은 500KB 이하로 선택하세요.');
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(quoted||!cell)quoted=!quoted;else throw Error('CSV 따옴표 형식을 확인하세요.');}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell='';}else cell+=c;}
  if(quoted)throw Error('CSV 따옴표가 닫히지 않았습니다.');row.push(cell);if(row.some(v=>v.trim()))rows.push(row);return rows;
}
export function importWatchCSV(text){
  const rows=parseCSV(text.replace(/^\uFEFF/,'')),header=rows.shift()?.map(s=>s.trim().toLowerCase());
  if(!header?.includes('market')||!header.includes('symbol'))throw Error('CSV 첫 행에 market,symbol,name 열이 필요합니다.');
  if(rows.length>200)throw Error('한 번에 200종목까지 가져올 수 있습니다.');
  const unique=new Map();for(const [index,cells] of rows.entries()){
    const r=Object.fromEntries(header.map((k,i)=>[k,(cells[i]||'').trim()]));if(!isMarket(r.market))throw Error(`${index+2}행 시장 코드를 확인하세요.`);
    let symbol=r.symbol.toUpperCase();
    if(!validMarketSymbol(symbol,r.market)||r.market==='kr'&&!/\.(KS|KQ)$/.test(symbol))throw Error(`${index+2}행 종목 코드를 확인하세요.`);
    unique.set(r.market+':'+symbol,{market:r.market,symbol,name:(r.name||symbol).slice(0,200),group_name:(r.group_name||'기본 그룹').slice(0,60)});
  }return [...unique.values()];
}
export function exportWatchCSV(rows){
  const cell=v=>'"'+String(v??'').replace(/^[=+\-@\t\r]/,"'$&").replaceAll('"','""')+'"';
  return '\uFEFF'+[['market','symbol','name','group_name'],...rows.map(r=>[r.market,r.symbol,r.name,r.group_name])].map(r=>r.map(cell).join(',')).join('\r\n');
}
