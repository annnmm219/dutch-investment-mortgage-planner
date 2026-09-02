'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const VDS=require('../view-density-state.js');

test('late-created Advanced controls have explicit restoration coverage',()=>{
  assert.deepEqual(VDS.LATE_CONTROL_IDS,[
    'hillenOverrideEnabled','hillenOverridePct','scenarioBuyWozNew','scenarioDpWozNew','scenarioSellWozNew'
  ]);
});

test('late control restoration preserves checkbox and value entries',()=>{
  const checkbox={checked:false};
  const input={value:''};
  assert.equal(VDS.restoreEntry(checkbox,{kind:'checked',value:true}),true);
  assert.equal(checkbox.checked,true);
  assert.equal(VDS.restoreEntry(input,{kind:'value',value:'390000'}),true);
  assert.equal(input.value,'390000');
});

test('late-state payload reader rejects missing and malformed local snapshots',()=>{
  assert.equal(VDS.readPayload({getItem:()=>null},'x'),null);
  assert.equal(VDS.readPayload({getItem:()=>'{bad'},'x'),null);
  assert.equal(VDS.readPayload({getItem:()=>JSON.stringify({schema:1})},'x'),null);
  assert.deepEqual(VDS.readPayload({getItem:()=>JSON.stringify({schema:1,controls:{'id:x':{kind:'value',value:'1'}}})},'x').controls['id:x'],{kind:'value',value:'1'});
});