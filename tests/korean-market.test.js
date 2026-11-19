import test from 'node:test';
import assert from 'node:assert/strict';
import {searchKoreanStocks,koreanCodes} from '../server/korean-directory.js';
import {scanRequest,SCAN_COLUMNS} from '../server/rankings.js';
import {normalizeSymbol,routeMarket} from '../server/market.js';
import {marketFromSearch,paneSymbols,paneSymbol} from '../src/market-selection.js';
import {normalizeWorkspace} from '../src/workspace-model.js';
import {validateAlert} from '../src/alert-engine.js';
test('Korean search matches names and codes across the catalog, preserving native exchange and preferred-share codes',()=>{
  assert.equal(searchKoreanStocks('삼성전자').rows[0].symbol,'005930.KS');
  assert.equal(searchKoreanStocks('에코프로비엠').rows[0].symbol,'247540.KQ');
  assert.equal(searchKoreanStocks('247540.KQ').rows[0].name,'에코프로비엠');
  assert.equal(searchKoreanStocks('００５９３０').rows[0].symbol,'005930.KS');
  assert.equal(searchKoreanStocks('00680K').rows[0].symbol,'00680K.KS');
  assert.equal(searchKoreanStocks('SK 하이닉스').rows[0].symbol,'000660.KS');
});
test('search applies board scope, bounds broad results and never substitutes an unknown name',()=>{
  assert.equal(searchKoreanStocks('005930','kosdaq').total,0);
  assert.equal(searchKoreanStocks('247540','kospi').total,0);
  assert.equal(searchKoreanStocks('없는종목_123').total,0);
  assert.equal(searchKoreanStocks('   ').rows.length,0);
  assert.ok(searchKoreanStocks('0').rows.length<=20);
  assert.throws(()=>searchKoreanStocks('삼성','__proto__'));
  assert.throws(()=>searchKoreanStocks('가'.repeat(61)));
});
test('board ranking requests filter upstream before sorting or pagination',()=>{
  for(const board of ['kospi','kosdaq']){const request=scanRequest('kr','marketCap',100,board),codes=request.filter.find(f=>f.left==='name').right;
    assert.deepEqual(codes,koreanCodes(board));assert.equal(codes.includes('005930'),board==='kospi');assert.equal(codes.includes('247540'),board==='kosdaq');assert.deepEqual(request.range,[100,200]);assert.equal(request.sort.sortBy,'market_cap_basic');}
  assert.throws(()=>scanRequest('us','value',0,'kosdaq'));
});
test('Korean search route works without an external data call and rejects invalid query scope',async t=>{
  const original=global.fetch;t.after(()=>{global.fetch=original;});global.fetch=()=>{throw Error('search must use the catalog');};
  const response=await routeMarket(new URL('https://test/api/market?action=search&market=kr&q='+encodeURIComponent('에코프로비엠')));assert.equal(response.status,200);assert.equal((await response.json()).rows[0].symbol,'247540.KQ');
  for(const query of ['action=search&market=us&q=NVDA','action=rankings&market=kr&board=bad','action=search&market=kr&q='+encodeURIComponent('가'.repeat(61))])assert.equal((await routeMarket(new URL('https://test/api/market?'+query))).status,400);
});
test('rankings API forwards the selected Korean board rather than filtering the first global page in the browser',async t=>{
  const original=global.fetch;t.after(()=>{global.fetch=original;});let scanned;
  global.fetch=async(url,options)=>{scanned=JSON.parse(options.body);return Response.json({totalCount:1,data:[{d:SCAN_COLUMNS.map(k=>({name:'247540',description:'ECOPRO BM',exchange:'KRX',close:200000}[k]??null))}]});};
  const response=await routeMarket(new URL('https://test/api/market?action=rankings&market=kr&board=kosdaq&sort=value'));
  const data=await response.json();assert.equal(response.status,200);assert.equal(data.board,'kosdaq');assert.equal(data.rows[0].symbol,'247540.KQ');assert.ok(!scanned.filter.find(f=>f.left==='name').right.includes('005930'));
});
test('switching markets in independent split charts restores each market symbol and migrates existing layouts',()=>{
  const oldUS={interval:'15m',symbol:'AAPL'},oldKR={interval:'W',symbol:'247540.KQ'};
  assert.equal(paneSymbol(oldUS,'kr','005930.KS'),'005930.KS');assert.equal(paneSymbol(oldKR,'us','NVDA'),'NVDA');
  const config={symbols:{us:'AAPL',kr:'247540.KQ'}};assert.equal(paneSymbol(config,'kr','005930.KS'),'247540.KQ');assert.equal(paneSymbol(config,'us','NVDA'),'AAPL');
  const workspace=normalizeWorkspace({board:'kosdaq',panes:[oldUS,oldKR]});assert.equal(workspace.board,'kosdaq');assert.deepEqual(workspace.panes[0].symbols,{us:'AAPL',kr:''});assert.deepEqual(workspace.panes[1].symbols,{us:'',kr:'247540.KQ'});assert.deepEqual(normalizeWorkspace(workspace),workspace);assert.doesNotThrow(()=>paneSymbols(null));
});
test('Korean deep links select the requested market while unrelated parameters cannot override it',()=>{
  assert.equal(marketFromSearch('?market=kr'),'kr');assert.equal(marketFromSearch('?market=us'),'us');assert.equal(marketFromSearch('?market=invalid'),null);assert.equal(marketFromSearch(''),null);
});
test('search results resolve to canonical Korean chart and alert symbols for both exchanges',()=>{
  for(const name of ['삼성전자','에코프로비엠']){const stock=searchKoreanStocks(name).rows[0];assert.equal(normalizeSymbol(stock.symbol,'kr'),stock.symbol);assert.equal(validateAlert({...stock,kind:'price_above',threshold:100000,period:20}).symbol,stock.symbol);}
});
