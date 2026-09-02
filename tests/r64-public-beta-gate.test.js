'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const Gate=require('../logic-integrity-ui.js');

function fresh(){
  delete require.cache[require.resolve('../finance-core.js')];
  delete require.cache[require.resolve('../scenario-engine.js')];
  const FC=require('../finance-core.js');
  Gate.decorateFinanceCore(FC);
  const SC=require('../scenario-engine.js');
  Gate.decorateScenarioCore(SC);
  return{FC,SC};
}

function approx(actual,expected,tolerance=.02,message=''){
  assert.ok(Number.isFinite(actual),`${message} actual is not finite: ${actual}`);
  assert.ok(Math.abs(actual-expected)<=tolerance,`${message} expected ${expected}, got ${actual}`);
}

function currentBox3(overrides={}){
  return{
    mode:'current',taxPartners:1,paySource:'external',currentTaxRate:.36,currentAllowance:59357,currentNotional:.06,
    currentSavingsNotional:.0128,currentDebtNotional:.027,currentDebtThreshold:3800,savings:0,debt:0,
    savingsReturnPct:0,debtInterestPct:0,futureStart:2028,futureTaxRate:.36,futureExempt:1800,futureLossThreshold:500,
    ...overrides
  };
}

function baseScenario(overrides={}){
  return{
    mode:'mortgage-invest',months:6,horizonYears:.5,investmentReturnPct:0,startYear:2026,startMonth:7,startPortfolio:0,
    purchaseCosts:0,mortgageType:'annuity',mortgage:{balance:100000,ratePct:0,years:30},
    tax:{enabled:false,deductionRate:0,wozValue:0},
    box3:currentBox3({firstJan1Portfolio:0,firstJan1Savings:0,firstJan1Debt:0}),
    homeGrowthPct:0,rentGrowthPct:0,sellingCostPct:0,vveMonthly:0,maintenanceAnnual:0,ownerTaxesAnnual:0,
    insuranceAnnual:0,groundLeaseAnnual:0,mortgageInvest:{extraMonthly:0},...overrides
  };
}

test('R6.4 uses one public model identity and state schema',()=>{
  assert.equal(Gate.MODEL_META.version,'R6.4.1');
  assert.equal(Gate.MODEL_META.ruleYear,2026);
  assert.equal(Gate.MODEL_META.stateSchema,4);
});

test('mid-year Box 3 distinguishes missing values from explicit zero',()=>{
  const missing=Gate.resolveJan1Snapshot({startYear:2026,startMonth:7,box3Mode:'current',firstJan1Portfolio:null,firstJan1Savings:null,firstJan1Debt:null});
  assert.equal(missing.required,true);
  assert.equal(missing.valid,false);
  assert.deepEqual(missing.missing,['portfolio','savings','debt']);
  const zero=Gate.resolveJan1Snapshot({startYear:2026,startMonth:7,box3Mode:'current',firstJan1Portfolio:0,firstJan1Savings:0,firstJan1Debt:0});
  assert.equal(zero.valid,true);
  assert.deepEqual(zero.snapshot,{portfolio:0,savings:0,debt:0});
});

test('plan-start balances are used only after explicit confirmation',()=>{
  const resolution=Gate.resolveJan1Snapshot({startYear:2026,startMonth:7,box3Mode:'current',assumePlanStartAsJan1:true,startPortfolio:120000,box3Savings:30000,box3Debt:10000});
  assert.equal(resolution.valid,true);
  assert.equal(resolution.source,'plan-start-assumption');
  assert.deepEqual(resolution.snapshot,{portfolio:120000,savings:30000,debt:10000});
});

test('missing mid-year Jan 1 snapshot blocks a tax-adjusted FinanceCore result',()=>{
  const {FC}=fresh();
  const result=FC.simulateInvestmentFlows({initialPortfolio:120000,flows:Array(6).fill(0),annualReturnPct:0,startYear:2026,startMonth:7,
    box3Mode:'current',paySource:'external',currentTaxRate:.36,currentAllowance:59357,currentNotional:.06,
    firstJan1Portfolio:null,firstJan1Savings:null,firstJan1Debt:null});
  assert.equal(result.taxStatus,'missing-jan1-snapshot');
  assert.equal(result.totalTax,null);
  assert.equal(result.householdComparableWealth,null);
  assert.equal(result.taxAdjustedComparableAvailable,false);
});

test('explicit mid-year Jan 1 portfolio produces the deemed 2026 estimate',()=>{
  const {FC}=fresh();
  const result=FC.simulateInvestmentFlows({initialPortfolio:120000,flows:Array(6).fill(0),annualReturnPct:0,startYear:2026,startMonth:7,
    box3Mode:'current',paySource:'external',currentTaxRate:.36,currentAllowance:59357,currentNotional:.06,
    currentSavingsNotional:.0128,currentDebtNotional:.027,currentDebtThreshold:3800,
    firstJan1Portfolio:120000,firstJan1Savings:0,firstJan1Debt:0});
  approx(result.totalTax,1309.8888,.02,'Box 3 deemed tax');
  assert.equal(result.taxAdjustedComparableAvailable,true);
});

test('a mid-year purchase uses one common historical Jan 1 snapshot for buyer and renter',()=>{
  const {SC}=fresh();
  const scenario=SC.runScenario(baseScenario({mode:'buy-rent',startPortfolio:0,mortgage:{balance:0,ratePct:0,years:30},
    box3:currentBox3({savings:150000,firstJan1Portfolio:0,firstJan1Savings:150000,firstJan1Debt:0}),
    buyRent:{price:100000,downPayment:100000,monthlyRent:0,mortgageRatePct:0,mortgageYears:30,wozValue:100000}}));
  assert.equal(scenario.valid,true);
  approx(scenario.A.box3,417.68,.02,'buyer first-year Box 3');
  approx(scenario.B.box3,417.68,.02,'renter first-year Box 3');
});

test('proposed actual-return tax is not presented as zero for a partial year',()=>{
  const {FC,SC}=fresh();
  const flow=FC.simulateInvestmentFlows({initialPortfolio:120000,flows:Array(6).fill(0),annualReturnPct:0,startYear:2026,startMonth:7,
    box3Mode:'future',firstJan1Portfolio:100000,firstJan1Savings:0,firstJan1Debt:0});
  assert.equal(flow.taxStatus,'not-estimable');
  assert.equal(flow.totalTax,null);
  assert.equal(flow.unsettledTaxEstimate,null);
  assert.equal(flow.householdComparableWealth,null);
  const scenario=SC.runScenario(baseScenario({box3:{...currentBox3(),mode:'future',firstJan1Portfolio:0,firstJan1Savings:0,firstJan1Debt:0}}));
  assert.equal(scenario.valid,false);
  assert.equal(scenario.status,'box3-not-estimable');
  assert.match(scenario.reason,/cannot be estimated|unavailable/i);
});

test('new purchase mortgage over 30 years cannot receive default HRA',()=>{
  const {SC}=fresh();
  const blocked=SC.runScenario(baseScenario({mode:'buy-rent',startMonth:1,months:12,horizonYears:1,box3:{...currentBox3(),mode:'none'},
    tax:{enabled:true,deductionRate:.3756,wozValue:350000},
    buyRent:{price:350000,downPayment:350000,monthlyRent:0,mortgageRatePct:4,mortgageYears:40,wozValue:350000}}));
  assert.equal(blocked.valid,false);
  assert.equal(blocked.status,'purchase-hra-term-blocked');
  const grossOnly=SC.runScenario(baseScenario({mode:'buy-rent',startMonth:1,months:12,horizonYears:1,
    box3:{...currentBox3({savings:350000}),mode:'none'},tax:{enabled:false,deductionRate:0,wozValue:350000},
    buyRent:{price:350000,downPayment:350000,monthlyRent:0,mortgageRatePct:4,mortgageYears:40,wozValue:350000}}));
  assert.equal(grossOnly.valid,true);
});

test('existing long-term mortgage may still use explicitly entered remaining HRA eligibility',()=>{
  const {SC}=fresh();
  const scenario=SC.runScenario(baseScenario({mode:'mortgage-invest',startMonth:1,months:12,horizonYears:1,
    box3:{...currentBox3(),mode:'none'},mortgage:{balance:200000,ratePct:4,years:40},
    tax:{enabled:true,deductionRate:.3756,wozValue:250000,hraRemainingMonths:120,qualifyingInterestFraction:1},mortgageInvest:{extraMonthly:100}}));
  assert.equal(scenario.valid,true);
  assert.ok(scenario.A.mortTax>0);
  assert.ok(scenario.B.mortTax>0);
});
