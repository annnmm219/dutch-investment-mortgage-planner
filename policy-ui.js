(function(root,factory){
  const Policy2026=typeof module==='object'&&module.exports?require('./policy-2026.js'):root.Policy2026;
  const api=factory(Policy2026);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PolicyUI=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Policy2026){
'use strict';
if(!Policy2026)throw new Error('Policy2026 must load before policy-ui.js');

const VALUES=Policy2026.VALUES;

function setDefault(documentRef,id,value){
  const element=documentRef.getElementById(id);
  if(!element)return false;
  element.dataset.policyYear=String(Policy2026.TAX_YEAR);
  element.dataset.policyDefault=String(value);
  element.value=String(value);
  return true;
}

function applyPolicyDefaults(documentRef){
  if(!documentRef)return{applied:[],missing:[]};
  const definitions=[
    ['currentTaxRate',VALUES.box3.taxRate*100],
    ['currentAllowance',VALUES.box3.allowancePerPerson],
    ['currentNotional',VALUES.box3.investmentDeemedRate*100],
    ['currentSavingsNotional',VALUES.box3.savingsDeemedRate*100],
    ['currentDebtNotional',VALUES.box3.debtDeemedRate*100],
    ['currentDebtThreshold',VALUES.box3.debtThresholdPerPerson],
    ['manualDeduction',VALUES.box1.ownHomeDeductionMaxRate*100]
  ];
  const applied=[],missing=[];
  definitions.forEach(([id,value])=>{
    if(setDefault(documentRef,id,value))applied.push(id);else missing.push(id);
  });
  documentRef.documentElement?.setAttribute('data-policy-year',String(Policy2026.TAX_YEAR));
  documentRef.documentElement?.setAttribute('data-policy-verified-at',Policy2026.LAST_VERIFIED_AT);
  return{applied,missing};
}

function bootBrowser(){
  if(typeof document==='undefined')return;
  applyPolicyDefaults(document);
}

return{applyPolicyDefaults,bootBrowser};
});

if(typeof window!=='undefined')window.PolicyUI.bootBrowser();
