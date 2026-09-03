'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const Contract=require('../model-contract.js');
const Policy=require('../policy-2026.js');
const PolicyUI=require('../policy-ui.js');
const FC=require('../finance-core.js');
const PR=require('../purchase-rules.js');

const close=(actual,expected,tolerance=1e-12)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} vs ${expected}`);

test('Stage 1 locks explicit annual-rate conventions without changing R6.5 calculations yet',()=>{
  assert.equal(Contract.RATE_CONVENTIONS.mortgageInterest.annualType,'nominal');
  assert.equal(Contract.RATE_CONVENTIONS.investmentReturn.annualType,'effective');
  assert.equal(Contract.RATE_CONVENTIONS.investmentReturn.activeFrom,'R6.6 Stage 2');
  assert.equal(Contract.RATE_CONVENTIONS.box3DeemedReturns.monthlyConversion,'none');
});

test('effective and nominal annual conversion helpers have distinct, reversible contracts',()=>{
  const effective=.07;
  const monthlyEffective=Contract.effectiveAnnualToMonthly(effective);
  close(Contract.monthlyToEffectiveAnnual(monthlyEffective),effective,1e-14);
  close(Contract.nominalAnnualToMonthly(.04),.04/12,1e-15);
  assert.notEqual(monthlyEffective,effective/12);
  assert.throws(()=>Contract.effectiveAnnualToMonthly(-1),/greater than -100%/);
});

test('transaction timing states the current end-of-month contribution convention',()=>{
  assert.match(Contract.TRANSACTION_TIMING.monthlyInvestment,/end of the month/i);
  assert.match(Contract.TRANSACTION_TIMING.portfolioGrowth,/opening monthly portfolio/i);
  assert.match(Contract.TRANSACTION_TIMING.extraMortgageRepayment,/after scheduled principal/i);
  assert.match(Contract.TRANSACTION_TIMING.purchaseCashEvent,/time zero/i);
});

test('strict validation distinguishes missing values, explicit zero and non-finite values',()=>{
  const spec={type:'number',required:true,min:0};
  const missing=Contract.validateField('',spec,'amount');
  const zero=Contract.validateField('0',spec,'amount');
  const nan=Contract.validateField('not-a-number',spec,'amount');
  const infinity=Contract.validateField(Infinity,spec,'amount');
  assert.equal(missing.valid,false);
  assert.equal(missing.errors[0].code,'required');
  assert.equal(zero.valid,true);
  assert.equal(zero.value,0);
  assert.equal(nan.valid,false);
  assert.equal(nan.errors[0].code,'not-finite');
  assert.equal(infinity.valid,false);
  assert.equal(infinity.errors[0].code,'not-finite');
});

test('named input schemas reject incomplete required financial inputs',()=>{
  const invalid=Contract.validateNamedSchema('purchaseScenario',{
    propertyPrice:'',
    availableSavings:50000,
    downPayment:40000,
    nominalAnnualMortgageRatePct:4,
    mortgageTermYears:30,
    mortgageType:'annuity'
  });
  assert.equal(invalid.valid,false);
  assert.ok(invalid.errors.some(error=>error.path==='purchaseScenario.propertyPrice'&&error.code==='required'));

  const valid=Contract.validateNamedSchema('box3Snapshot',{jan1Portfolio:0,jan1Savings:0,jan1Debt:0});
  assert.equal(valid.valid,true);
  assert.deepEqual(valid.value,{jan1Portfolio:0,jan1Savings:0,jan1Debt:0});
});

test('every dated policy item has tax year, status, official source and verification date',()=>{
  const validation=Policy.validateMetadata();
  assert.deepEqual(validation,{valid:true,errors:[]});
  assert.equal(Policy.TAX_YEAR,2026);
  assert.equal(Policy.EFFECTIVE_FROM,'2026-01-01');
  assert.equal(Policy.LAST_VERIFIED_AT,'2026-09-03');
  Policy.ITEMS.forEach(item=>{
    assert.equal(item.taxYear,2026);
    assert.match(item.sourceUrl,/^https:\/\//);
    assert.ok(item.sourceTitle.length>0);
    assert.ok(item.authority.length>0);
  });
});

test('2026 policy registry records final and provisional Box 3 statuses correctly',()=>{
  assert.equal(Policy.getItem('box3.investmentDeemedRate').status,'final');
  assert.equal(Policy.getItem('box3.savingsDeemedRate').status,'provisional');
  assert.equal(Policy.getItem('box3.debtDeemedRate').status,'provisional');
  assert.equal(Policy.getValue('box3.taxRate'),.36);
  assert.equal(Policy.getValue('box3.allowancePerPerson'),59357);
  assert.equal(Policy.getValue('box3.debtThresholdPerPerson'),3800);
});

test('purchase rules consume the same central 2026 values',()=>{
  const V=Policy.VALUES;
  assert.equal(PR.RULES_2026.starterValueLimit,V.transferTax.starterExemptionValueLimit);
  assert.equal(PR.RULES_2026.mainResidenceTransferTaxRate,V.transferTax.mainResidenceRate);
  assert.equal(PR.RULES_2026.otherResidenceTransferTaxRate,V.transferTax.otherResidenceRate);
  assert.equal(PR.RULES_2026.otherRealEstateTransferTaxRate,V.transferTax.otherRealEstateRate);
  assert.equal(PR.RULES_2026.nhgLimit,V.nhg.standardLimit);
  assert.equal(PR.RULES_2026.nhgEnergyLimit,V.nhg.energyLimit);
  assert.equal(PR.RULES_2026.nhgFeeRate,V.nhg.feeRate);
  assert.equal(PR.RULES_2026.standardLtvLimit,V.ltv.standardLimit);
});

test('FinanceCore 2026 boundaries remain aligned with central policy values',()=>{
  const V=Policy.VALUES;
  assert.equal(FC.deductionRate2026({grossIncome:V.box1.preAowBrackets[0].upper}),V.box1.preAowBrackets[0].rate);
  assert.equal(FC.deductionRate2026({grossIncome:V.box1.preAowBrackets[0].upper+1}),V.box1.ownHomeDeductionMaxRate);
  assert.equal(FC.ewf2026(400000),1400);
  assert.equal(FC.ewf2026(V.eigenwoningforfait.highValueThreshold),V.eigenwoningforfait.highValueBase);
  assert.equal(FC.ewf2026(V.eigenwoningforfait.highValueThreshold+100000),V.eigenwoningforfait.highValueBase+100000*V.eigenwoningforfait.highValueExcessRate);
  assert.equal(FC.hillenReliefForYear(2026),V.hillen.relief2026);
  assert.equal(FC.hillenReliefForYear(V.hillen.zeroFromYear),0);
});

test('policy UI applies central defaults without creating a second calculation engine',()=>{
  const nodes={};
  const ids=['currentTaxRate','currentAllowance','currentNotional','currentSavingsNotional','currentDebtNotional','currentDebtThreshold','manualDeduction'];
  ids.forEach(id=>{nodes[id]={id,value:'stale',dataset:{}};});
  const attributes={};
  const fakeDocument={
    getElementById:id=>nodes[id]||null,
    documentElement:{setAttribute:(name,value)=>{attributes[name]=value;}}
  };
  const result=PolicyUI.applyPolicyDefaults(fakeDocument);
  assert.deepEqual(result.missing,[]);
  assert.equal(nodes.currentTaxRate.value,'36');
  assert.equal(nodes.currentAllowance.value,'59357');
  assert.equal(nodes.currentNotional.value,'6');
  assert.equal(nodes.currentSavingsNotional.value,'1.28');
  assert.equal(nodes.currentDebtNotional.value,'2.7');
  assert.equal(nodes.currentDebtThreshold.value,'3800');
  assert.equal(nodes.manualDeduction.value,'37.56');
  assert.equal(attributes['data-policy-year'],'2026');
  assert.equal(attributes['data-policy-verified-at'],'2026-09-03');
});

test('Stage 1 documentation and policy modules are present on the staged branch',()=>{
  for(const file of ['model-contract.js','policy-2026.js','policy-ui.js','audits/r6.6/stage1-model-contract.md']){
    assert.equal(fs.existsSync(path.join(ROOT,file)),true,`${file} should exist`);
  }
});
