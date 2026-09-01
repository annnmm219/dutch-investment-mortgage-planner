'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const FC=require('../finance-core.js');
const BH=require('../box3-household.js');

function approx(actual,expected,tolerance=1e-6,message=''){
  assert.ok(Number.isFinite(actual),`${message} actual value is not finite: ${actual}`);
  assert.ok(Math.abs(actual-expected)<=tolerance,`${message} expected ${expected}, got ${actual}`);
}

test('2026 mixed-asset deemed Box 3 follows savings, investments and debt structure',()=>{
  const x=FC.box3TaxForYear({
    regime:'current',
    jan1Savings:150000,
    jan1Portfolio:275000,
    jan1Debt:100000,
    marketGain:30000,
    savingsIncome:2000,
    debtInterest:1500,
    taxPartners:1,
    currentAllowance:59357,
    currentSavingsNotional:.0128,
    currentNotional:.06,
    currentDebtNotional:.027,
    currentDebtThreshold:3800,
    currentTaxRate:.36
  });
  approx(x.deductibleDebt,96200,1e-9);
  approx(x.rendementsgrondslag,328800,1e-9);
  approx(x.taxableBase,269443,1e-9);
  approx(x.deemedReturn,15822.6,1e-9);
  approx(x.notionalTax,4667.834465474452,1e-6);
  assert.equal(x.method,'deemed return');
});

test('2026 mixed-asset actual-return rebuttal includes savings interest and debt interest',()=>{
  const x=FC.box3TaxForYear({
    regime:'current',
    jan1Savings:150000,
    jan1Portfolio:275000,
    jan1Debt:100000,
    marketGain:1000,
    savingsIncome:2000,
    debtInterest:1500,
    taxPartners:1,
    currentAllowance:59357,
    currentSavingsNotional:.0128,
    currentNotional:.06,
    currentDebtNotional:.027,
    currentDebtThreshold:3800,
    currentTaxRate:.36
  });
  approx(x.actualReturn,1500,1e-9);
  approx(x.actualTax,540,1e-9);
  approx(x.tax,540,1e-9);
  assert.equal(x.method,'actual-return rebuttal');
});

test('2026 deemed method applies debt threshold per taxpayer',()=>{
  const one=FC.box3TaxForYear({
    regime:'current',jan1Portfolio:200000,jan1Debt:5000,marketGain:50000,
    taxPartners:1,currentDebtThreshold:3800,currentAllowance:59357,currentNotional:.06,currentDebtNotional:.027,currentTaxRate:.36
  });
  const two=FC.box3TaxForYear({
    regime:'current',jan1Portfolio:200000,jan1Debt:5000,marketGain:50000,
    taxPartners:2,currentDebtThreshold:3800,currentAllowance:59357,currentNotional:.06,currentDebtNotional:.027,currentTaxRate:.36
  });
  approx(one.deductibleDebt,1200,1e-9);
  approx(two.deductibleDebt,0,1e-9);
});

test('proposed actual-return model combines investment gain, savings interest and debt interest',()=>{
  const x=FC.box3TaxForYear({
    regime:'future',
    marketGain:5000,
    savingsIncome:1000,
    debtInterest:1500,
    taxPartners:1,
    futureTaxRate:.36,
    futureExempt:1800,
    futureLossThreshold:500
  });
  approx(x.actualReturn,4500,1e-9);
  approx(x.tax,972,1e-9);
});

test('household adapter injects the same Box 3 context into investment-flow calculations',()=>{
  const wrapped=BH.decorateCore({...FC},()=>({
    box3Savings:100000,
    box3Debt:20000,
    savingsReturnPct:2,
    debtInterestPct:4,
    currentSavingsNotional:.0128,
    currentDebtNotional:.027,
    currentDebtThreshold:3800
  }));
  const x=wrapped.simulateInvestmentFlows({
    initialPortfolio:100000,
    flows:Array(12).fill(0),
    annualReturnPct:10,
    startYear:2026,
    startMonth:1,
    box3Mode:'current',
    taxPartners:1,
    paySource:'external',
    currentTaxRate:.36,
    currentAllowance:59357,
    currentNotional:.06
  });
  approx(x.yearBuckets[2026].jan1Savings,100000,1e-9);
  approx(x.yearBuckets[2026].jan1Debt,20000,1e-9);
  approx(x.yearBuckets[2026].savingsIncome,2000,1e-9);
  approx(x.yearBuckets[2026].debtInterest,800,1e-9);
});
