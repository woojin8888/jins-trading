import test from 'node:test';
import assert from 'node:assert/strict';
import {hasVolume,reportedVolume,volumeUnit,isIndexAggregateVolume} from '../src/instruments.js';
import {parseDailyHistory} from '../server/history-data.js';
import {aggregate} from '../src/analysis.js';
import {volumeComparison} from '../src/quote-info.js';

test('only the explicitly supported index feeds expose provider-reported aggregate volume',()=>{
 for(const symbol of ['^GSPC','^NDX','^RUT']){assert.equal(isIndexAggregateVolume(symbol),true);assert.equal(hasVolume(symbol),true);assert.equal(reportedVolume(symbol,3323599000),3323599000);assert.equal(volumeUnit(symbol),'');for(const value of [0,-1,null,NaN])assert.equal(reportedVolume(symbol,value),null);}
 for(const symbol of ['^N225','KRW=X','DX-Y.NYB']){assert.equal(hasVolume(symbol),false);assert.equal(reportedVolume(symbol,123),null);}
 assert.equal(reportedVolume('NVDA',0),0);assert.equal(reportedVolume('GC=F',0),0);
});
test('index prices remain unchanged; zero-volume uncertainty propagates into week/month aggregates',()=>{
 const symbol='^RUT',timestamp=['2026-11-23','2026-11-24'].map(date=>Date.parse(date+'T14:30:00Z')/1000),history=parseDailyHistory({meta:{symbol,currency:'USD',exchangeTimezoneName:'America/New_York'},timestamp,indicators:{quote:[{open:[2000,2010],high:[2020,2030],low:[1990,2000],close:[2010,2020],volume:[5608530000,0]}]}},symbol);
 assert.deepEqual(history.bars.map(b=>b.close),[2010,2020]);assert.equal(history.bars[0].volume,5608530000);assert.equal(history.bars[1].volume,null);assert.equal(history.bars[1].rawVolume,0);assert.equal(aggregate(history.bars,'W')[0].volume,null);
 assert.equal(history.volumeBasis.kind,'provider-aggregate');assert.equal(history.volumeBasis.constituentVolumeVerified,false);assert.equal(volumeComparison({...history,symbol},{}),null);
});
