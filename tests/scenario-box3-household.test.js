'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const FC=require('../finance-core.js');
const BH=require('../box3-household.js');

function approx(actual,expected,tolerance=1e-6,message=''){
  assert.ok(Number.isFinite(actual),`${message} actual value is not finite: ${actual}`);
  assert.ok(Math.abs(actual-expected)<=tolerance,`${message} expected ${expected}, got ${actual}`);
}

test('Scenario engine receives the same household Box 3 context through the shared core',()=>{
  const context={
    box3Savings:100000,
    box3Debt:20000,
    savingsReturnPct:2,
    debtInterestPct:4,
    currentSavingsNotional:.0128,
    currentDebtNotional:.027,
    currentDebtThreshold:3800
  };
  BH.decorateCore(FC,()=>context);
  delete require.cache[require.resolve('../scenario-engine.js')];
  const SC=require('../scenario-engine.js');

  const config={
    mode:'mortgage-invest',
    horizonYears:1,
    investmentReturnPct:10,
    startYear:2026,
    startMonth:1,
    startPortfolio:100000,
    purchaseCosts:0,
    mortgageType:'annuity',
    mortgage:{balance:0,ratePct:0,years:30},
    tax:{enabled:false,deductionRate:0,wozValue:0},
    box3:{
      mode:'current',
      taxPartners:1,
      paySource:'external',
      currentTaxRate:.36,
      currentAllowance:59357,
      currentNotional:.06,
      firstJan1Portfolio:0,
      futureStart:2028,
      futureTaxRate:.36,
      futureExempt:1800,
      futureLossThreshold:500
    },
    homeGrowthPct:0,
    rentGrowthPct:0,
    sellingCostPct:0,
    vveMonthly:0,
    maintenanceAnnual:0,
    mortgageInvest:{extraMonthly:0}
  };

  const scenario=SC.runScenario(config);
  const direct=FC.simulateInvestmentFlows({
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

  approx(scenario.A.box3,direct.totalTax,1e-9,'Strategy A tax');
  approx(scenario.B.box3,direct.totalTax,1e-9,'Strategy B tax');
  assert.ok(scenario.A.box3>0,'household context should produce a positive modeled Box 3 charge');
});
