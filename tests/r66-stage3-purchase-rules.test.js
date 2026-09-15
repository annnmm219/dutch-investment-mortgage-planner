
'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const PR=require('../purchase-rules.js');
const FC=require('../finance-core.js');
const LI=require('../logic-integrity-ui.js');
LI.decorateFinanceCore(FC);
const SC=require('../scenario-engine.js');
LI.decorateScenarioCore(SC);
const Contract=require('../model-contract.js');

function approx(actual,expected,tolerance=1e-8,message=''){
  assert.ok(Number.isFinite(Number(actual)),`${message} is not finite: ${actual}`);
  assert.ok(Math.abs(Number(actual)-Number(expected))<=tolerance,`${message}: expected ${expected}, got ${actual}`);
}
function purchaseRules(overrides={}){return{enabled:true,transferTaxMode:'main',manualTransferTax:0,appraisedValue:600000,nhgMode:'none',buyerAge:35,starterMainResidence:true,starterExemptionUnused:true,...overrides};}
function base(mode='buy-rent'){
  return{
    mode,horizonYears:10,investmentReturnPct:5,startYear:2026,startMonth:1,startPortfolio:0,purchaseCosts:999999,purchaseRules:purchaseRules(),mortgageType:'linear',
    mortgage:{balance:999999,ratePct:19,years:1},tax:{enabled:true,deductionRate:.3756,wozValue:600000,hraRemainingMonths:360,qualifyingInterestFraction:1},
    box3:{mode:'none',taxPartners:1,paySource:'external',savings:180000,debt:0,savingsReturnPct:0,debtInterestPct:0,firstJan1Portfolio:0,firstJan1Savings:0,firstJan1Debt:0},
    upfrontCashTreatment:'invest',homeGrowthPct:2,rentGrowthPct:2.5,sellingCostPct:2,vveMonthly:0,maintenanceAnnual:0,ownerTaxesAnnual:0,insuranceAnnual:0,groundLeaseAnnual:0,
    buyRent:{price:600000,cash:180000,purchaseCosts:8000,downPayment:60000,monthlyRent:2200,mortgageRatePct:4,mortgageYears:30,mortgageType:'annuity',wozValue:600000},
    downpayment:{price:600000,cash:180000,purchaseCosts:8000,downA:120000,downB:60000,mortgageRatePct:4,mortgageYears:30,mortgageType:'annuity',wozValue:600000},
    mortgageInvest:{extraMonthly:500},sellRent:{homeValue:600000,monthlyRent:2200,wozValue:600000}
  };
}

test('€600,000 main-residence scenario calculates €12,000 transfer tax and €20,000 total costs',()=>{
  const x=PR.calculateScenarioPurchase2026({housePrice:600000,downPayment:60000,availableSavings:100000,baseCosts:8000,transferTaxMode:'main',appraisedValue:600000,nhgMode:'none'});
  assert.equal(x.valid,true);
  approx(x.transferTax.amount,12000,1e-9,'transfer tax');
  approx(x.transactionCosts,20000,1e-9,'total purchase costs');
  approx(x.mortgageProceeds,540000,1e-9,'mortgage proceeds');
  approx(x.totalBuyerCash,80000,1e-9,'buyer cash');
  approx(x.totalUses,620000,1e-9,'uses');
  approx(x.totalSources,620000,1e-9,'sources');
  approx(x.identityDifference,0,1e-9,'identity difference');
});

test('starter exemption requires age, main residence, unused exemption and the 2026 value ceiling',()=>{
  const ok=PR.calculateScenarioPurchase2026({housePrice:555000,downPayment:55000,availableSavings:100000,baseCosts:8000,transferTaxMode:'starter',buyerAge:34,starterMainResidence:true,starterExemptionUnused:true});
  approx(ok.transferTax.amount,0,1e-9,'eligible starter tax');assert.equal(ok.transferTax.starterEligibility.eligible,true);
  const age=PR.calculateScenarioPurchase2026({housePrice:555000,downPayment:55000,availableSavings:100000,baseCosts:8000,transferTaxMode:'starter',buyerAge:35,starterMainResidence:true,starterExemptionUnused:true});
  approx(age.transferTax.amount,11100,1e-9,'age fallback');assert.equal(age.transferTax.effectiveMode,'main');
  const used=PR.calculateScenarioPurchase2026({housePrice:555000,downPayment:55000,availableSavings:100000,baseCosts:8000,transferTaxMode:'starter',buyerAge:34,starterMainResidence:true,starterExemptionUnused:false});
  approx(used.transferTax.amount,11100,1e-9,'used-exemption fallback');
  const notHome=PR.calculateScenarioPurchase2026({housePrice:555000,downPayment:55000,availableSavings:100000,baseCosts:8000,transferTaxMode:'starter',buyerAge:34,starterMainResidence:false,starterExemptionUnused:true});
  approx(notHome.transferTax.amount,44400,1e-9,'non-main-residence fallback');assert.equal(notHome.transferTax.effectiveMode,'other-home');
  const cap=PR.calculateScenarioPurchase2026({housePrice:555001,downPayment:55000,availableSavings:100000,baseCosts:8000,transferTaxMode:'starter',buyerAge:34,starterMainResidence:true,starterExemptionUnused:true});
  approx(cap.transferTax.amount,11100.02,1e-6,'value fallback');
});

test('Buy versus Rent uses the full local 2026 purchase calculation and equal starting cash',()=>{
  const x=SC.runScenario(base('buy-rent'));
  assert.equal(x.valid,true,x.reason||'scenario should be valid');
  const funding=x.sourcesAndUses.A;
  assert.equal(funding.source,'scenario-local-2026-rules');
  approx(funding.transferTax.amount,12000,1e-8,'scenario transfer tax');
  approx(funding.transactionCosts,20000,1e-8,'scenario total costs');
  approx(funding.identityDifference,0,1e-8,'scenario funding identity');
  approx(x.A.purchase,20000,1e-8,'reported purchase costs');
  approx(funding.availableSavings,180000,1e-8,'buyer starting cash');
  approx(x.sourcesAndUses.A.availableSavings,180000,1e-8,'common starting cash recorded before purchase');
});

test('Down Payment recalculates NHG fees for each mortgage amount',()=>{
  const c=base('downpayment');
  c.purchaseRules=purchaseRules({appraisedValue:470000,nhgMode:'standard'});
  c.downpayment={...c.downpayment,price:470000,cash:180000,purchaseCosts:5000,downA:70000,downB:30000,wozValue:470000};
  const x=SC.runScenario(c);
  assert.equal(x.valid,true,x.reason||'scenario should be valid');
  const A=x.sourcesAndUses.A,B=x.sourcesAndUses.B;
  approx(A.identityDifference,0,1e-8,'A identity');approx(B.identityDifference,0,1e-8,'B identity');
  assert.ok(B.nhgFee>A.nhgFee,'smaller down payment should have larger NHG fee');
  approx(A.nhgFee,A.mortgageProceeds*.004,1e-8,'A fee');approx(B.nhgFee,B.mortgageProceeds*.004,1e-8,'B fee');
});

test('an explicitly selected but ineligible NHG route blocks the purchase comparison',()=>{
  const c=base('buy-rent');c.purchaseRules=purchaseRules({appraisedValue:600000,nhgMode:'standard'});
  const x=SC.runScenario(c);
  assert.equal(x.valid,false);
  assert.ok(x.sourcesAndUses.A.errors.some(error=>error.code==='nhg-ineligible'));
});

test('legacy total-cost fixtures remain supported while the public path uses rule-derived costs',()=>{
  const c=base('buy-rent');delete c.purchaseRules;c.buyRent.purchaseCosts=15000;
  const x=SC.runScenario(c);assert.equal(x.valid,true);assert.equal(x.sourcesAndUses.A.source,'legacy-explicit-total');approx(x.A.purchase,15000,1e-8);
});

test('purchase-rule schema accepts the complete local rule object',()=>{
  const x=Contract.validateNamedSchema('purchaseRules',{transferTaxMode:'main',manualTransferTax:0,appraisedValue:600000,nhgMode:'none',buyerAge:35,starterMainResidence:true,starterExemptionUnused:true});
  assert.equal(x.valid,true);
});

test('browser purchase configuration stays scenario-owned after an explicit source snapshot',()=>{
  const source=fs.readFileSync(path.resolve(__dirname,'../scenario-engine.js'),'utf8');
  const config=/function config\(retOverride\)\{([\s\S]*?)\n\}\nfunction question/.exec(source)?.[1]||'';
  assert.ok(config);
  assert.match(config,/purchaseRules:purchaseRuleConfig\(\)/);
  assert.match(config,/tax:scenarioTaxConfig\(mode\)/);
  assert.match(config,/mortgage:purchaseMode\?\{balance:0,ratePct:0,years:30\}:source\.mortgage/);
  assert.match(config,/resolveScenarioInputSource/);
  assert.doesNotMatch(config,/num\('purchaseCosts'/);
  assert.match(source,/scenarioTransferTaxModeNew/);
  assert.match(source,/scenarioPurchaseNhgModeNew/);
  assert.match(source,/scenarioBuyerAgeNew/);
  assert.match(source,/Scenario-local 2026 purchase calculation/);
});
