import test from 'node:test';
import assert from 'node:assert/strict';
import {SHARED_WATCHLIST_GROUPS,SHARED_WATCHLIST_ID,sharedNativeRows,sharedWatchlistPlan} from '../src/shared-watchlist.js';
import {validMarketSymbol} from '../src/market-selection.js';
import {stockKey,normalizeWorkspace} from '../src/workspace-model.js';

test('shared list preserves 25 source identities, with spot products and yields kept separate from futures',()=>{
  const all=SHARED_WATCHLIST_GROUPS.flatMap(group=>group.rows);
  assert.equal(all.length,25);
  assert.equal(new Set(all.map(row=>row.source)).size,25);
  assert.deepEqual(all.filter(row=>!row.symbol).map(row=>row.source),['TVC:US10Y','TVC:USOIL','OANDA:XAUUSD']);
  assert.equal(all.some(row=>['CL=F','GC=F','^TNX'].includes(row.symbol)),false);
  assert.ok(sharedNativeRows().every(row=>validMarketSymbol(row.symbol,row.market)));
});

test('copying adds missing symbols across markets without replacing existing names, groups or notes',()=>{
  const existing=[{market:'etf',symbol:'SPY',name:'내 SPY',group_name:'장기 투자'}];
  const plan=sharedWatchlistPlan(existing,[]);
  assert.equal(plan.rows.length,21);
  assert.equal(plan.rows.some(row=>row.symbol==='SPY'),false);
  assert.equal(plan.keys.length,22);
  assert.equal(new Set(plan.keys).size,22);
  assert.ok(plan.keys.includes('indices:^KS11'));
  assert.ok(plan.keys.includes('etfkr:487240.KS'));
  assert.deepEqual(sharedWatchlistPlan(sharedNativeRows(),[]).rows,[]);
  const normalized=normalizeWorkspace({lists:[{id:SHARED_WATCHLIST_ID,name:'공유목록',keys:plan.keys}]});
  assert.deepEqual(normalized.lists[0].keys,sharedNativeRows().map(stockKey));
  assert.deepEqual(existing,[{market:'etf',symbol:'SPY',name:'내 SPY',group_name:'장기 투자'}]);
});

test('full list capacity reports an error before import but allows updating an existing copy',()=>{
  const lists=Array.from({length:20},(_,i)=>({id:'list-'+i,name:'목록',keys:[]}));
  assert.throws(()=>sharedWatchlistPlan([],lists),/20개/);
  lists[0].id=SHARED_WATCHLIST_ID;
  assert.equal(sharedWatchlistPlan([],lists).rows.length,22);
});
