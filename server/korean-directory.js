import catalog from './korean-stocks.json' with {type:'json'};
export const KOREAN_BOARDS={all:'코스피·코스닥',kospi:'코스피',kosdaq:'코스닥'};
export function validateBoard(market,board='all'){
  if(!Object.hasOwn(KOREAN_BOARDS,board)||market!=='kr'&&board!=='all')throw Error('올바른 한국 시장 구분을 선택해 주세요.');
  return board;
}
export function koreanCodes(board='all'){
  validateBoard('kr',board);return Object.keys(catalog.stocks).filter(code=>board==='all'||catalog.stocks[code].exchange===board.toUpperCase());
}
const searchText=value=>String(value).normalize('NFKC').replace(/\s/g,'').toUpperCase();
export function searchKoreanStocks(query,board='all'){
  validateBoard('kr',board);if(typeof query!=='string'||query.length>60)throw Error('검색어는 60자 이하로 입력해 주세요.');
  const text=searchText(query);if(!text)return {rows:[],total:0,asOf:catalog.asOf};
  const codeText=text.replace(/\.(KS|KQ)$/,'');
  const rows=koreanCodes(board).flatMap(code=>{const stock=catalog.stocks[code],name=searchText(stock.name);if(!name.includes(text)&&!(codeText&&code.includes(codeText)))return [];return [{market:'kr',ticker:code,symbol:code+(stock.exchange==='KOSDAQ'?'.KQ':'.KS'),name:stock.name,exchange:stock.exchange,rank:code===codeText||name===text?0:code.startsWith(codeText)||name.startsWith(text)?1:2}];}).sort((a,b)=>a.rank-b.rank||a.name.localeCompare(b.name,'ko')||a.ticker.localeCompare(b.ticker));
  return {rows:rows.slice(0,20).map(({rank,...stock})=>stock),total:rows.length,asOf:catalog.asOf,source:catalog.source};
}
