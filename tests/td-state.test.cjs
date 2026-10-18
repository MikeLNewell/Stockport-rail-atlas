'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {makeTDState}=require('../worker/td-state.cjs');
const base={area_id:'M6',description:'1A23',event_time:'2026-10-18T13:00:00Z'};
test('CA movement changes berth without claiming GPS',()=>{
 const s=makeTDState();
 assert.equal(s.apply({...base,msg_type:'CA',from_berth:'0010',to_berth:'0012'}),true);
 const snap=s.snapshot(Date.parse('2026-10-18T13:00:10Z'));
 assert.equal(snap.trains.length,1);
 assert.equal(snap.trains[0].berth,'0012');
 assert.equal(Object.hasOwn(snap.trains[0],'latitude'),false);
});
test('CB cancels berth association and does not count as active',()=>{
 const s=makeTDState();
 s.apply({...base,msg_type:'CC',to_berth:'0012'});
 s.apply({...base,msg_type:'CB',from_berth:'0012',to_berth:null,event_time:'2026-10-18T13:01:00Z'});
 assert.equal(s.snapshot().trains.length,0);
 assert.equal(s.snapshot().events[0].msg_type,'CB');
});
test('older messages must not rewind state',()=>{
 const s=makeTDState();
 s.apply({...base,msg_type:'CA',from_berth:'0010',to_berth:'0012',event_time:'2026-10-18T13:03:00Z'});
 assert.equal(s.apply({...base,msg_type:'CA',from_berth:'0008',to_berth:'0010'}),false);
 assert.equal(s.snapshot().trains[0].berth,'0012');
});
test('identical headcodes in two areas are not combined without boundary mapping',()=>{
 const s=makeTDState();
 s.apply({...base,msg_type:'CC',to_berth:'01'});
 s.apply({...base,area_id:'SK',msg_type:'CC',to_berth:'02'});
 assert.equal(s.snapshot().trains.length,2);
});
test('stale observations are identified',()=>{
 const s=makeTDState({staleAfterMs:60000});
 s.apply({...base,msg_type:'CC',to_berth:'01'});
 assert.equal(s.snapshot(Date.parse('2026-10-18T13:05:00Z')).trains[0].stale,true);
});