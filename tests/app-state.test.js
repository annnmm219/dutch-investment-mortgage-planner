'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const State=require('../app-state.js');

function control({tagName='INPUT',id='',type='number',value='',checked=false,disabled=false,dataset={}}={}){
  return{tagName,id,type,value,checked,disabled,dataset};
}

test('R6 state snapshot captures ID controls, checkboxes and phase controls but skips hidden/disabled fields',()=>{
  const controls=[
    control({id:'annualReturn',value:'5'}),
    control({id:'mortTaxEnabled',type:'checkbox',checked:true}),
    control({id:'hiddenOutput',type:'hidden',value:'123'}),
    control({id:'disabledAuto',value:'456',disabled:true}),
    control({id:'',value:'750',dataset:{i:'1',field:'monthlyInvest'}})
  ];
  const x=State.captureControls(controls,{activeTab:'scenarios',mortgageType:'linear'});
  assert.equal(x.schema,State.SCHEMA_VERSION);
  assert.deepEqual(x.controls['id:annualReturn'],{kind:'value',value:'5'});
  assert.deepEqual(x.controls['id:mortTaxEnabled'],{kind:'checked',value:true});
  assert.deepEqual(x.controls['phase:1:monthlyInvest'],{kind:'value',value:'750'});
  assert.equal(x.controls['id:hiddenOutput'],undefined);
  assert.equal(x.controls['id:disabledAuto'],undefined);
  assert.equal(x.meta.activeTab,'scenarios');
  assert.equal(x.meta.mortgageType,'linear');
});

test('R6 payload normalization rejects invalid JSON and the wrong schema',()=>{
  assert.equal(State.normalizePayload('{bad json'),null);
  assert.equal(State.normalizePayload(JSON.stringify({schema:99,controls:{}})),null);
  assert.equal(State.normalizePayload(null),null);
});

test('R6 payload normalization keeps only supported metadata shapes',()=>{
  const x=State.normalizePayload({schema:1,savedAt:'2026-09-01T00:00:00.000Z',controls:{'id:x':{kind:'value',value:'1'}},meta:{activeTab:'mortgage',mortgageType:'annuity'}});
  assert.equal(x.meta.activeTab,'mortgage');
  assert.equal(x.meta.mortgageType,'annuity');
  assert.equal(x.savedAt,'2026-09-01T00:00:00.000Z');
});

test('R6 applyEntry restores ordinary values and checkbox state',()=>{
  const amount=control({id:'amount',value:'0'}),check=control({id:'check',type:'checkbox',checked:false});
  assert.equal(State.applyEntry(amount,{kind:'value',value:'500'}),true);
  assert.equal(amount.value,'500');
  assert.equal(State.applyEntry(check,{kind:'checked',value:true}),true);
  assert.equal(check.checked,true);
  assert.equal(State.applyEntry(amount,{kind:'unknown',value:'x'}),false);
});

test('R6 phase controls receive stable storage keys without needing HTML ids',()=>{
  const el=control({id:'',dataset:{i:'2',field:'bonusDest'},value:'split',tagName:'SELECT'});
  assert.equal(State.controlKey(el),'phase:2:bonusDest');
  assert.equal(State.isPersistable(el),true);
});
