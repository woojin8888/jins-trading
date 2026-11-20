import test from 'node:test';
import assert from 'node:assert/strict';
import {auditHistory,compareNasdaqHistory} from '../server/data-audit.js';
const history=()=>({symbol:'NVDA',currency:'USD',timeZone:'America/New_York',quality:{sessionOpen:false},quote:{price:100,asOf:'2026-11-19T21:00:00Z'},bars:[{time:'2026-11-19',open:100,high:102,low:99,close:101,volume:1000}]});
test('audit distinguishes corrupt bars, missing intervals, unknown volume and merely different latest quote prices',()=>{
  const h=history();assert.equal(auditHistory(h).errors.length,0);h.quality={intraday:true,dataGap:true,missingSourceBars:1};h.bars=[{time:100,endTime:200,open:100,high:102,low:99,close:101,volume:null}];assert.equal(auditHistory(h).errors.length,0);assert.ok(auditHistory(h).warnings.includes('dataGap'));
  h.bars.push({...h.bars[0],high:1,volume:-1});assert.equal(auditHistory(h).errors.length,3);
});
test('Nasdaq comparison uses matching completed dates, correct symbols, and explicit separate price/volume tolerances',()=>{
  const h=history(),response={data:{symbol:'NVDA',tradesTable:{rows:[{date:'11/19/2026',open:'$100.005',high:'$102',low:'$99',close:'$101',volume:'1,002'},{date:'11/18/2026',open:'9999'}]}}};
  const found=compareNasdaqHistory(h,response);assert.equal(found.length,5);assert.equal(found.filter(x=>x.match).length,4);assert.equal(found.at(-1).field,'volume');assert.equal(found.at(-1).tolerance,1.002);
  assert.equal(compareNasdaqHistory({...h,quality:{sessionOpen:true}},response).length,0);
  assert.throws(()=>compareNasdaqHistory({...h,symbol:'MSFT'},response),/종목/);assert.throws(()=>compareNasdaqHistory(h,{data:{symbol:'NVDA'}}),/미제공/);
});
test('missing reference values cannot be parsed as zero or inflate the matching sample',()=>{
  const response={data:{symbol:'NVDA',tradesTable:{rows:[{date:'11/19/2026',open:'',high:'—',low:null,close:'$101',volume:'N/A'}]}}};
  const found=compareNasdaqHistory(history(),response);assert.equal(found.length,1);assert.equal(found[0].field,'close');
});
