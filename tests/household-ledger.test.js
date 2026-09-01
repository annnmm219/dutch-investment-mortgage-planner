'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const FC=require('../finance-core.js');

function approx(actual,expected,tolerance=1e-6,message=''){
  assert.ok(Number.isFinite(actual),`${message} actual value is not finite: ${actual}`);
  assert.ok(Math.abs(actual-expected)<=tolerance,`${message} expected ${expected}, got ${actual}`);
}

test('savings is a real compounding balance rather than a frozen tax input',()=>{
  const x=FC.simulateInvestmentFlows({initialPortfolio:0,flows:Array(12).fill(0),annualReturnPct:0,startYear:2026,startMonth:1,box3Mode:'none',box3Savings:12000,savingsReturnPct:12});
  approx(x.savings,12000*Math.pow(1.01,12),1e-8,'ending savings');
  approx(x.netFinancialAssets,x.savings,1e-9,'net financial assets');
});

test('Box 3 tax paid from savings reduces cash and is not also removed from investments',()=>{
  const x=FC.simulateInvestmentFlows({initialPortfolio:100000,flows:Array(12).fill(0),annualReturnPct:10,startYear:2026,startMonth:1,box3Mode:'current',taxPartners:1,paySource:'savings',box3Savings:100000,savingsReturnPct:0,currentTaxRate:.36,currentAllowance:59357,currentNotional:.06,currentSavingsNotional:.0128});
  assert.ok(x.totalTax>0);
  approx(x.taxPaidFromSavings,x.totalTax,1e-9,'savings tax payment');
  approx(x.taxPaidFromPortfolio,0,1e-12,'portfolio tax payment');
  approx(x.externalTax,0,1e-12,'external tax');
  approx(x.savings,100000-x.totalTax,1e-6,'cash after tax');
  assert.ok(x.portfolio>100000,'portfolio should retain its investment growth');
});

test('savings-funded Box 3 debt repayment reduces savings and debt together',()=>{
  const x=FC.simulateInvestmentFlows({initialPortfolio:0,flows:Array(12).fill(0),annualReturnPct:0,startYear:2026,startMonth:1,box3Mode:'none',box3Savings:12000,box3Debt:12000,box3DebtMonthlyRepayment:1000,debtRepaymentSource:'savings'});
  approx(x.savings,0,1e-9);approx(x.box3Debt,0,1e-9);approx(x.totalDebtRepaid,12000,1e-9);approx(x.externalDebtRepayment,0,1e-9);approx(x.netFinancialAssets,0,1e-9);
});

test('next calendar year uses the evolved savings and debt balances as Jan 1 Box 3 values',()=>{
  const x=FC.simulateInvestmentFlows({initialPortfolio:0,flows:Array(24).fill(0),annualReturnPct:0,startYear:2026,startMonth:1,box3Mode:'current',taxPartners:1,paySource:'external',box3Savings:100000,box3Debt:24000,savingsReturnPct:12,debtInterestPct:0,box3DebtMonthlyRepayment:500,debtRepaymentSource:'external',currentTaxRate:.36,currentAllowance:59357,currentNotional:.06,currentSavingsNotional:.0128,currentDebtNotional:.027,currentDebtThreshold:3800});
  approx(x.yearBuckets[2027].jan1Savings,x.yearBuckets[2026].endSavings,1e-9,'2027 Jan 1 savings');
  approx(x.yearBuckets[2027].jan1Debt,18000,1e-9,'2027 Jan 1 debt');
  assert.ok(x.yearBuckets[2027].jan1Savings>100000,'savings should have grown during 2026');
});

test('tax source shortfall becomes external cash flow instead of disappearing',()=>{
  const paid=FC.payTaxFromSource({tax:1000,paySource:'portfolio',portfolio:250,savings:5000});
  approx(paid.portfolio,0,1e-12);approx(paid.fromPortfolio,250,1e-12);approx(paid.external,750,1e-12);approx(paid.savings,5000,1e-12);
});

test('mid-year first-Jan-1 overrides apply separately to portfolio, savings and Box 3 debt',()=>{
  const x=FC.simulateInvestmentFlows({initialPortfolio:100000,flows:Array(6).fill(0),annualReturnPct:0,startYear:2026,startMonth:7,box3Mode:'current',paySource:'external',box3Savings:80000,box3Debt:20000,firstJan1Portfolio:70000,firstJan1Savings:60000,firstJan1Debt:15000,currentTaxRate:.36,currentAllowance:59357,currentNotional:.06,currentSavingsNotional:.0128,currentDebtNotional:.027,currentDebtThreshold:3800});
  approx(x.yearBuckets[2026].jan1Portfolio,70000,1e-9);approx(x.yearBuckets[2026].jan1Savings,60000,1e-9);approx(x.yearBuckets[2026].jan1Debt,15000,1e-9);
});

test('main plan carries dynamic savings, Box 3 debt and tax-payment balances',()=>{
  const x=FC.simulatePlan({phases:[{years:1,monthlyInvest:0,mortgageExtra:0,mortgageFreq:'monthly',annualBonus:0,bonusDest:'invest'}],startPortfolio:0,annualReturnPct:0,startYear:2026,startMonth:1,bonusMonth:12,mortBalance:0,mortRatePct:0,mortYears:30,mortType:'annuity',mortTaxEnabled:false,deductRate:0,wozValue:0,box3Mode:'none',box3Savings:12000,box3Debt:6000,savingsReturnPct:0,debtInterestPct:0,box3DebtMonthlyRepayment:500,debtRepaymentSource:'savings'});
  approx(x.savings,6000,1e-9);approx(x.box3Debt,0,1e-9);approx(x.netFinancialAssets,6000,1e-9);approx(x.totalDebtRepaid,6000,1e-9);
});
