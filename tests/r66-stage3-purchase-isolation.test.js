
'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const SC=require('../scenario-engine.js');
const Contract=require('../model-contract.js');

const ROOT=path.resolve(__dirname,'..');
const clone=value=>JSON.parse(JSON.stringify(value));
function approx(actual,expected,tolerance=1e-8,message=''){
  assert.ok(Number.isFinite(actual),`${message} actual value is not finite: ${actual}`);
  assert.ok(Math.abs(actual-expected)<=tolerance,`${message} expected ${expected}, got ${actual}`);
}
function base(mode='buy-rent'){
  return{
    mode,horizonYears:1,investmentReturnPct:0,startYear:2026,startMonth:1,startPortfolio:0,purchaseCosts:999999,mortgageType:'linear',
    mortgage:{balance:999999,ratePct:19,years:1},tax:{enabled:false,deductionRate:0,wozValue:999999,hraRemainingMonths:0,qualifyingInterestFraction:0},
    box3:{mode:'none',taxPartners:1,paySource:'external',savings:120000,debt:0,savingsReturnPct:0,debtInterestPct:0},
    upfrontCashTreatment:'invest',homeGrowthPct:0,rentGrowthPct:0,sellingCostPct:0,vveMonthly:0,maintenanceAnnual:0,ownerTaxesAnnual:0,insuranceAnnual:0,groundLeaseAnnual:0,
    buyRent:{price:350000,cash:120000,purchaseCosts:15000,downPayment:70000,monthlyRent:1600,mortgageRatePct:4,mortgageYears:30,mortgageType:'annuity',wozValue:350000},
    downpayment:{price:350000,cash:120000,purchaseCosts:15000,downA:80000,downB:30000,mortgageRatePct:4,mortgageYears:30,mortgageType:'annuity',wozValue:350000},
    mortgageInvest:{extraMonthly:0},sellRent:{homeValue:0,monthlyRent:0}
  };
}

test('purchase funding identity separates uses, mortgage proceeds and buyer cash',()=>{
  const funding=SC.purchaseSourcesAndUses({propertyPrice:350000,transactionCosts:15000,buyerCashTowardPrice:70000,availableSavings:120000});
  assert.equal(funding.valid,true);
  approx(funding.totalUses,365000);
  approx(funding.mortgageProceeds,280000);
  approx(funding.buyerCashTowardPrice,70000);
  approx(funding.buyerCashForCosts,15000);
  approx(funding.totalBuyerCash,85000);
  approx(funding.totalSources,365000);
  approx(funding.identityDifference,0);
  approx(funding.remainingSavings,35000);
});

test('buy-versus-rent exposes a complete reconciled purchase ledger',()=>{
  const result=SC.runScenario(base('buy-rent'));
  assert.equal(result.valid,true);
  const funding=result.sourcesAndUses.A;
  assert.equal(result.sourcesAndUses.B,null);
  assert.equal(funding.valid,true);
  approx(funding.totalUses,funding.totalSources);
  approx(funding.mortgageProceeds,280000);
  approx(result.A.purchase,15000);
  approx(result.A.purchasePrice,350000);
  approx(result.A.buyerCash,85000);
  approx(result.A.mortgageProceeds,280000);
});

test('down-payment comparison reconciles each strategy independently',()=>{
  const result=SC.runScenario(base('downpayment'));
  assert.equal(result.valid,true);
  const A=result.sourcesAndUses.A,B=result.sourcesAndUses.B;
  approx(A.totalUses,A.totalSources);
  approx(B.totalUses,B.totalSources);
  approx(A.mortgageProceeds,270000);
  approx(B.mortgageProceeds,320000);
  approx(A.totalBuyerCash,95000);
  approx(B.totalBuyerCash,45000);
});

test('purchase modes ignore top-level Mortgage-tab decoys',()=>{
  for(const mode of ['buy-rent','downpayment']){
    const reference=SC.runScenario(base(mode));
    const decoy=clone(base(mode));
    decoy.purchaseCosts=1;
    decoy.mortgageType='linear';
    decoy.mortgage={balance:1,ratePct:0,years:40};
    decoy.tax={...decoy.tax,wozValue:1,hraRemainingMonths:1,qualifyingInterestFraction:.01};
    const changed=SC.runScenario(decoy);
    assert.equal(reference.valid,true);assert.equal(changed.valid,true);
    approx(changed.A.net,reference.A.net,1e-8,`${mode} A wealth isolation`);
    approx(changed.B.net,reference.B.net,1e-8,`${mode} B wealth isolation`);
    approx(changed.A.mortgage,reference.A.mortgage,1e-8,`${mode} A mortgage isolation`);
    approx(changed.B.mortgage,reference.B.mortgage,1e-8,`${mode} B mortgage isolation`);
  }
});

test('buyer cash toward price cannot silently exceed the property price',()=>{
  const config=base('buy-rent');
  config.buyRent={...config.buyRent,price:100000,cash:200000,purchaseCosts:5000,downPayment:120000,mortgageRatePct:0,mortgageYears:10};
  const result=SC.runScenario(config);
  assert.equal(result.valid,false);
  assert.match(result.reason,/exceeds the property price/i);
  assert.ok(result.sourcesAndUses.A.errors.some(error=>error.code==='buyer-cash-exceeds-price'));
});

test('purchase cash shortfall is explicit and includes transaction costs',()=>{
  const config=base('buy-rent');
  config.buyRent={...config.buyRent,cash:80000,downPayment:70000,purchaseCosts:15000};
  const result=SC.runScenario(config);
  assert.equal(result.valid,false);
  approx(result.sourcesAndUses.A.shortfall,5000);
  assert.match(result.reason,/starting savings/i);
});

test('model contract names the purchase funding boundary',()=>{
  const valid=Contract.validateNamedSchema('purchaseFunding',{propertyPrice:350000,transactionCosts:15000,availableSavings:120000,buyerCashTowardPrice:70000});
  assert.equal(valid.valid,true);
  const invalid=Contract.validateNamedSchema('purchaseFunding',{propertyPrice:350000,transactionCosts:'',availableSavings:120000,buyerCashTowardPrice:70000});
  assert.equal(invalid.valid,false);
  assert.ok(invalid.errors.some(error=>error.path==='purchaseFunding.transactionCosts'));
});

test('browser purchase controls are scenario-owned and expose the funding identity',()=>{
  const source=fs.readFileSync(path.join(ROOT,'scenario-engine.js'),'utf8');
  assert.match(source,/scenarioBuyCostsNew/);
  assert.match(source,/scenarioDpCostsNew/);
  assert.match(source,/scenarioBuyMortgageTypeNew/);
  assert.match(source,/scenarioDpMortgageTypeNew/);
  assert.match(source,/scenarioFundingDetailsNew/);
  assert.match(source,/property price \+ transaction costs/i);
  assert.doesNotMatch(source,/purchaseCosts:Math\.max\(0,num\('purchaseCosts'/);
});
