'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const VDS=require('../view-density-state.js');

test('late-created Advanced controls have explicit restoration coverage',()=>{
  assert.deepEqual(VDS.LATE_CONTROL_IDS,[
    'hillenOverrideEnabled','hillenOverridePct',
    'scenarioBuyWozNew','scenarioDpWozNew','scenarioSellWozNew',
    'nextEuroHraTreatment','nextEuroBox3Treatment'
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

test('Next Euro tax treatment changes only the copied decision configuration',()=>{
  const original={tax:{enabled:false,deductionRate:.3756},box3:{mode:'future',taxPartners:1},mortgage:{balance:300000}};
  const withTax=VDS.applyNextEuroTaxTreatment(original,'on','current');
  assert.equal(withTax.tax.enabled,true);
  assert.equal(withTax.box3.mode,'current');
  assert.equal(original.tax.enabled,false);
  assert.equal(original.box3.mode,'future');
  assert.notEqual(withTax.tax,original.tax);
  assert.notEqual(withTax.box3,original.box3);

  const withoutTax=VDS.applyNextEuroTaxTreatment(original,'off','none');
  assert.equal(withoutTax.tax.enabled,false);
  assert.equal(withoutTax.box3.mode,'none');
});

test('Next Euro planner treatment preserves the underlying planner choices',()=>{
  const original={tax:{enabled:true},box3:{mode:'transition'}};
  const result=VDS.applyNextEuroTaxTreatment(original,'planner','planner');
  assert.equal(result.tax.enabled,true);
  assert.equal(result.box3.mode,'transition');
});

test('Box 3 audit method labels distinguish deemed, tegenbewijs, proposed and not-estimable years',()=>{
  assert.equal(VDS.box3MethodLabel({method:'deemed return'}),'Deemed return');
  assert.equal(VDS.box3MethodLabel({method:'deemed return · incomplete actual-return year'}),'Deemed return · incomplete year');
  assert.equal(VDS.box3MethodLabel({method:'actual-return rebuttal'}),'Tegenbewijs / actual return');
  assert.equal(VDS.box3MethodLabel({method:'proposed actual return'}),'Proposed actual return');
  assert.equal(VDS.box3MethodLabel({method:'proposed actual return',settled:false}),'Unsettled · Proposed actual return');
  assert.equal(VDS.box3MethodLabel({method:'not estimable from supplied partial-year data',estimable:false}),'Not estimable');
  assert.equal(VDS.box3MethodLabel({regime:'none'}),'No Box 3');
});

test('browser adapter contains the Advanced Next Euro controls and method column',()=>{
  const fs=require('node:fs');
  const path=require('node:path');
  const source=fs.readFileSync(path.resolve(__dirname,'..','view-density-state.js'),'utf8');
  assert.match(source,/nextEuroHraTreatment/);
  assert.match(source,/nextEuroBox3Treatment/);
  assert.match(source,/data-density-method-head/);
  assert.match(source,/Tegenbewijs \/ actual return/);
});