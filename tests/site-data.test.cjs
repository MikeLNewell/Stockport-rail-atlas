const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'../site/data/stockport-boxes.json'),'utf8'));
test('Stockport is a true 20 mile radius centred on published station coordinates',()=>{
  assert.ok(Math.abs(data.study.radiusMetres - 20*1609.344)<.0001);
  assert.deepEqual(data.study.centre,[53.40545,-2.16304]);
});
test('five distinct signal boxes have cited locations',()=>{
  assert.equal(data.boxes.length,5);
  assert.equal(new Set(data.boxes.map(x=>x.id)).size,5);
  for(const box of data.boxes){assert.match(box.locationSource,/^https:\/\//);assert.equal(box.coordinates.length,2);assert.ok(box.coordinates[0]>53&&box.coordinates[0]<54);assert.ok(box.coordinates[1]>-3&&box.coordinates[1]<-1);}
});
test('published historic references never masquerade as verified current equipment',()=>{
  for(const box of data.boxes){assert.equal(box.verifiedBoundary,null);assert.deepEqual(box.currentPointsVerified,[]);assert.deepEqual(box.currentSignalsVerified,[]);assert.match(box.historicSource,/^https:\/\//);}
});
