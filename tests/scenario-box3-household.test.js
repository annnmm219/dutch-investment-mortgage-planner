'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const SC=require('../scenario-engine.js');
const FC=require('../finance-core.js');

function approx(actual,expected,tolerance=1e-6,message=''){
  assert.ok(Number.isFinite(actual),`${message} actual value is not finite: ${actual}`);
  assert.ok(Math.abs(actual-expected)<=tolerance,`${message} expected ${expected}, got ${actual}`);
}

test('Scenario engine passes the explicit household Box 3 ledger through the shared core',()=>{
  const box3={
    mode:'current',
    taxPartners:1,
    paySource:'external',
    currentTaxRate:.36,
    currentAllowance:59357,
    currentNotional:.06,
    currentSavingsNotional:.0128,
    currentDebtNotional:.027,
    currentDebtThreshold:3800,
    savings:100000,
    debt:20000,
    savingsReturnPct:2,
    debtInterestPct:4,
    debtMonthlyRepayment:0,
    debtRepaymentSource:'external',
    firstJan1Portfolio:0,
    firstJan1Savings:null,
    firstJan1Debt:null,
    futureStart:2028,
    futureTaxRate:.36,
    futureExempt:1800,
    futureLossThreshold:500
  };

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
    box3,
    homeGrowthPct:0,
    rentGrowthPct:0,
    sellingCostPct:0,
    vveMonthly:0,
    maintenanceAnnual:0,
    ownerTaxesAnnual:0,
    insuranceAnnual:0,
    groundLeaseAnnual:0,
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
    currentNotional:.06,
    currentSavingsNotional:.0128,
    currentDebtNotional:.027,
    currentDebtThreshold:3800,
    box3Savings:100000,
    box3Debt:20000,
    savingsReturnPct:2,
    debtInterestPct:4
  });

  approx(scenario.A.box3,direct.totalTax,1e-9,'Strategy A tax');
  approx(scenario.B.box3,direct.totalTax,1e-9,'Strategy B tax');
  approx(scenario.A.savings,direct.savings,1e-9,'Strategy A savings');
  approx(scenario.A.box3Debt,direct.box3Debt,1e-9,'Strategy A Box 3 debt');
  assert.ok(scenario.A.box3>0,'household context should produce a positive modeled Box 3 charge');
});
