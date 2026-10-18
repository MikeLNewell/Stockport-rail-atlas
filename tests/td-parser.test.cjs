const test = require('node:test');
const assert = require('node:assert/strict');
const {parseTD} = require('../worker/td-parser.cjs');
test('CA messages map to berth transitions without assuming coordinates',()=>{
  const input=JSON.stringify([{CA_MSG:{msg_type:'CA',area_id:'SK',from:'1234',to:'5678',descr:'1A23',time:'1792324200000'}}]);
  assert.deepEqual(parseTD(input,['SK']).map(({raw,...v})=>v),[{area_id:'SK',msg_type:'CA',from_berth:'1234',to_berth:'5678',berth:'5678',description:'1A23',event_time:new Date(1792324200000).toISOString()}]);
});
test('filters undesired TD areas and S-Class messages',()=>{
  const input=JSON.stringify([{CA_MSG:{msg_type:'CA',area_id:'ZZ',from:'1234',to:'5678',descr:'1A23',time:'1792324200000'}},{SF_MSG:{msg_type:'SF',area_id:'SK',address:'99',data:'01',time:'1792324200000'}}]);
  assert.equal(parseTD(input,['SK']).length,0);
});
test('supports berth cancellation and interposition',()=>{
  const input=JSON.stringify([{CB_MSG:{msg_type:'CB',area_id:'SK',from:'A1',descr:'1A23',time:1792324200000}},{CC_MSG:{msg_type:'CC',area_id:'SK',to:'B1',descr:'2C45',time:1792324200000}}]);
  assert.equal(parseTD(input,['SK']).length,2);
});
test('rejects malformed input and unsupported heartbeat frames',()=>{
  assert.deepEqual(parseTD('{bad'),[]);
  assert.deepEqual(parseTD(JSON.stringify([{CT_MSG:{msg_type:'CT',area_id:'SK',time:1792324200000}}])),[]);
});
