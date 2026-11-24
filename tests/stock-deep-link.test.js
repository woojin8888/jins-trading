import test from 'node:test';import assert from 'node:assert/strict';import {stockFromSearch,linkedWorkspaceView,fullscreenFromSearch} from '../src/stock-deep-link.js';import {defaultWorkspace} from '../src/workspace-model.js';
test('external chart links validate the market and symbol, including Korean boards and ETFs',()=>{
 assert.equal(stockFromSearch('?market=kr&symbol=471800&exchange=KOSDAQ&name=%EC%97%90%EC%9D%B4%EC%97%98%EB%A1%9C%EB%B4%87').symbol,'471800.KQ');assert.equal(stockFromSearch('?market=kr&symbol=005930&exchange=KOSPI').symbol,'005930.KS');assert.equal(stockFromSearch('?market=us&symbol=BRK.B').symbol,'BRK-B');assert.equal(stockFromSearch('?market=etfkr&symbol=069500').symbol,'069500.KS');
 for(const query of ['?market=us&symbol=javascript:foo','?market=kr&symbol=NVDA','?market=bad&symbol=NVDA','?market=us','?symbol=NVDA'])assert.equal(stockFromSearch(query),null);
});
test('linked stock wins over a restored workspace while unrelated saved preferences are retained',()=>{
 const saved={...defaultWorkspace().main,market:'us',interval:'W',range:'365'},before=JSON.stringify(saved),target=stockFromSearch('?market=kr&symbol=471800&exchange=KOSDAQ');const linked=linkedWorkspaceView(saved,'kr',target);assert.equal(linked.market,'kr');assert.equal(linked.symbols.kr.symbol,'471800.KQ');assert.equal(linked.interval,'D');assert.equal(linked.range,'365');assert.equal(linked.benchmarkSymbol,'^KS11');assert.equal(linked.symbols.us,saved.symbols.us);assert.equal(JSON.stringify(saved),before);
 const ordinary=linkedWorkspaceView(saved,null,null);assert.deepEqual(ordinary,saved);assert.equal(linkedWorkspaceView(saved,'kr',null).symbols.kr.symbol,saved.symbols.kr.symbol);
});

test('fullscreen startup is explicit and requires a valid chart target',()=>{assert(fullscreenFromSearch('?market=kr&symbol=471800&view=fullscreen'));assert(!fullscreenFromSearch('?market=kr&symbol=471800'));assert(!fullscreenFromSearch('?view=fullscreen'));assert(!fullscreenFromSearch('?market=kr&symbol=BAD&view=fullscreen'));});
