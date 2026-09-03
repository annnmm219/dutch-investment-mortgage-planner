'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const FC=require('../finance-core.js');
const SC=require('../scenario-engine.js');
const BH=require('../box3-household.js');
const Policy=require('../policy-2026.js');

const ROOT=path.resolve(__dirname,'..');
const close=(actual,expected,tolerance=1e-8)=>assert.ok(Math.abs(actual-expected)<=tolerance,`expected ${expected}, got ${actual}`);

function noTaxBox3(savings=0){
  return{mode:'none',taxPartners:1,paySource:'external',savings,debt:0,savingsReturnPct:0,debtInterestPct:0,firstJan1Portfolio:0,firstJan1Savings:0,firstJan1Debt:0};
}

function buyRentBase(months=24){
  return{
    mode:'buy-rent',months,investmentReturnPct:0,startYear:2026,startMonth:1,startPortfolio:0,
    tax:{enabled:false,deductionRate:0,wozValue:1},box3:noTaxBox3(1),upfrontCashTreatment:'savings',
    homeGrowthPct:0,rentGrowthPct:0,sellingCostPct:0,ownerCostGrowthPct:2,
    vveMonthly:100,maintenanceAnnual:0,ownerTaxesAnnual:0,insuranceAnnual:0,groundLeaseAnnual:0,
    buyRent:{price:1,cash:1,purchaseCosts:0,downPayment:1,monthlyRent:0,mortgageRatePct:0,mortgageYears:1,mortgageType:'annuity'}
  };
}

test('owner costs use effective annual growth and preserve each component total',()=>{
  const result=SC.runScenario(buyRentBase());
  close(result.cashA[0],100);
  close(result.cashA[12],102);
  close(result.A.owner,result.A.vve+result.A.maintenance+result.A.ownerTaxes+result.A.insurance+result.A.groundLease);
});

test('zero owner-cost growth preserves the pre-Stage-5 fixed monthly convention',()=>{
  const config=buyRentBase(24);config.ownerCostGrowthPct=0;
  const result=SC.runScenario(config);
  close(result.A.owner,2400);
  assert.ok(result.cashA.every(value=>Math.abs(value-100)<1e-9));
});

test('dated external cash flows carry earlier payments for longer',()=>{
  const first=FC.terminalValueOfDatedCashFlows([100,0,0,0],12);
  const last=FC.terminalValueOfDatedCashFlows([0,0,0,100],12);
  assert.ok(first>last);
  close(last,100);
});

test('external debt principal remains a balance-sheet transfer at zero return',()=>{
  const result=FC.simulateInvestmentFlows({initialPortfolio:0,flows:Array(12).fill(0),annualReturnPct:0,startYear:2026,startMonth:1,box3Mode:'none',box3Debt:12000,debtInterestPct:0,box3DebtMonthlyRepayment:1000,debtRepaymentSource:'external'});
  close(result.box3Debt,0);
  close(result.externalDebtRepayment,12000);
  close(result.externalCashFlowFutureValue,12000);
  close(result.householdComparableWealth,-12000);
});

test('purchase principal becomes equity rather than an economic expense',()=>{
  const config=buyRentBase(12);config.vveMonthly=0;config.ownerCostGrowthPct=0;config.box3=noTaxBox3(120000);
  config.buyRent={price:120000,cash:120000,purchaseCosts:0,downPayment:120000,monthlyRent:0,mortgageRatePct:0,mortgageYears:30,mortgageType:'annuity'};
  const result=SC.runScenario(config);
  close(result.A.net,120000);
  close(result.B.net,120000);
});

test('actual household rates are independent from statutory deemed percentages',()=>{
  assert.equal(BH.ACTUAL_RATE_ASSUMPTIONS.savingsYieldPct,2);
  assert.equal(BH.ACTUAL_RATE_ASSUMPTIONS.debtInterestPct,4);
  assert.notEqual(BH.ACTUAL_RATE_ASSUMPTIONS.savingsYieldPct,Policy.VALUES.box3.savingsDeemedRate*100);
  assert.notEqual(BH.ACTUAL_RATE_ASSUMPTIONS.debtInterestPct,Policy.VALUES.box3.debtDeemedRate*100);
  const source=fs.readFileSync(path.join(ROOT,'box3-household.js'),'utf8');
  assert.match(source,/Editable household assumption, not the statutory Box 3 bank-deposit percentage/);
  assert.match(source,/editable contractual assumption, not the statutory Box 3 debt percentage/i);
});

test('browser scenario exposes owner-cost growth and the principal-equity rule',()=>{
  const source=fs.readFileSync(path.join(ROOT,'scenario-engine.js'),'utf8');
  assert.match(source,/scenarioOwnerCostGrowthNew/);
  assert.match(source,/Mortgage principal becomes home equity\. It is not treated as an economic expense/);
  assert.match(source,/Terminal value of dated external outflows/);
  assert.match(source,/Investment returns are uncertain and sequence-dependent/);
  assert.match(source,/does not assign liquidity a euro value/);
});
