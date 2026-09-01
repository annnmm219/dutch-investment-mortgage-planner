'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const FC=require('../finance-core.js');

function approx(actual,expected,tolerance=1e-6,message=''){
  assert.ok(Number.isFinite(actual),`${message} actual value is not finite: ${actual}`);
  assert.ok(Math.abs(actual-expected)<=tolerance,`${message} expected ${expected}, got ${actual}`);
}

test('2026 deduction rate switches at the configured income threshold',()=>{
  approx(FC.deductionRate2026({grossIncome:38883}),0.3575,1e-12,'first bracket');
  approx(FC.deductionRate2026({grossIncome:38884}),0.3756,1e-12,'second bracket');
  approx(FC.deductionRate2026({mode:'manual',manualRatePct:34.5,grossIncome:999999}),0.345,1e-12,'manual rate');
});

test('2026 eigenwoningforfait gives €1,400 on €400,000 WOZ',()=>{
  approx(FC.ewf2026(400000),1400,1e-9);
});

test('mortgage-interest benefit offsets EWF before applying deduction rate',()=>{
  const benefit=FC.mortgageTaxBenefit({interest:10000,months:12,deductionRate:0.3756,wozValue:400000,enabled:true});
  approx(benefit,3230.16,1e-6);
});

test('Hillen approximation produces a small negative benefit when EWF exceeds interest',()=>{
  const benefit=FC.mortgageTaxBenefit({interest:500,months:12,deductionRate:0.3756,wozValue:400000,enabled:true});
  approx(benefit,-95.1007932,1e-7);
});

test('30-year 4% annuity mortgage matches known first-year values',()=>{
  const m=FC.mortgageSchedule({balance:300000,annualRatePct:4,termYears:30,type:'annuity',months:12,tax:{enabled:false}});
  approx(m.firstScheduled,1432.2458863963616,1e-9,'first payment');
  approx(m.balance,294716.89070024405,1e-6,'balance after 12 months');
  approx(m.totalInterest,11903.841337000376,1e-6,'first-year interest');
  approx(m.totalScheduledPrincipal,5283.109299755964,1e-6,'first-year principal');
});

test('30-year 4% linear mortgage repays €10,000 principal in year one',()=>{
  const m=FC.mortgageSchedule({balance:300000,annualRatePct:4,termYears:30,type:'linear',months:12,tax:{enabled:false}});
  approx(m.firstScheduled,1833.3333333333335,1e-9,'first payment');
  approx(m.balance,290000,1e-6,'balance after 12 months');
  approx(m.totalInterest,11816.666666666672,1e-6,'first-year interest');
  approx(m.totalScheduledPrincipal,10000,1e-6,'first-year principal');
});

test('annuity mortgage with €500 monthly extra repayment reduces balance by the expected amount',()=>{
  const m=FC.mortgageSchedule({balance:300000,annualRatePct:4,termYears:30,type:'annuity',months:12,extraMonthly:500,tax:{enabled:false}});
  approx(m.totalExtra,6000,1e-9,'extra principal');
  approx(m.balance,288605.65926227556,1e-6,'balance after 12 months');
  approx(m.totalInterest,11792.60989903193,1e-6,'interest after extra repayments');
});

test('current Box 3 returns zero below the allowance',()=>{
  const x=FC.box3TaxForYear({regime:'current',jan1Portfolio:50000,marketGain:5000,taxPartners:1,currentAllowance:59357,currentNotional:0.06,currentTaxRate:0.36});
  approx(x.tax,0,1e-12);
});

test('current Box 3 uses actual-return rebuttal when it is lower',()=>{
  const x=FC.box3TaxForYear({regime:'current',jan1Portfolio:100000,marketGain:1000,taxPartners:1,currentAllowance:59357,currentNotional:0.06,currentTaxRate:0.36});
  approx(x.notionalTax,877.8888,1e-6,'notional tax');
  approx(x.actualTax,360,1e-9,'actual-return tax');
  approx(x.tax,360,1e-9,'selected tax');
  assert.equal(x.method,'actual-return rebuttal');
});

test('current Box 3 uses deemed return when actual gain is higher',()=>{
  const x=FC.box3TaxForYear({regime:'current',jan1Portfolio:100000,marketGain:10000,taxPartners:1,currentAllowance:59357,currentNotional:0.06,currentTaxRate:0.36});
  approx(x.tax,877.8888,1e-6);
  assert.equal(x.method,'deemed return');
});

test('proposed Box 3 applies exemption and loss carryforward',()=>{
  const lossYear=FC.box3TaxForYear({regime:'future',marketGain:-10000,lossCarry:0,taxPartners:1,futureTaxRate:0.36,futureExempt:1800,futureLossThreshold:500});
  approx(lossYear.tax,0,1e-12);
  approx(lossYear.lossCarry,9500,1e-9);

  const gainYear=FC.box3TaxForYear({regime:'future',marketGain:12000,lossCarry:lossYear.lossCarry,taxPartners:1,futureTaxRate:0.36,futureExempt:1800,futureLossThreshold:500});
  approx(gainYear.lossCarry,0,1e-9);
  approx(gainYear.tax,252,1e-9);
});

test('mid-year current Box 3 honors firstJan1Portfolio override',()=>{
  const x=FC.simulateInvestmentFlows({
    initialPortfolio:100000,
    flows:Array(6).fill(0),
    annualReturnPct:12,
    startYear:2026,
    startMonth:7,
    box3Mode:'current',
    taxPartners:1,
    paySource:'portfolio',
    currentTaxRate:0.36,
    currentAllowance:59357,
    currentNotional:0.06,
    firstJan1Portfolio:70000
  });
  approx(x.totalTax,229.8888,1e-6,'first-year tax');
  approx(x.portfolio,105922.1262601,1e-6,'after-tax portfolio');
  approx(x.yearBuckets[2026].jan1Portfolio,70000,1e-9,'Jan 1 base');
});

test('main-plan and investment-flow engines reconcile on the same mid-year investment case',()=>{
  const flows=FC.simulateInvestmentFlows({
    initialPortfolio:100000,
    flows:Array(6).fill(0),
    annualReturnPct:12,
    startYear:2026,
    startMonth:7,
    box3Mode:'current',
    taxPartners:1,
    paySource:'portfolio',
    currentTaxRate:0.36,
    currentAllowance:59357,
    currentNotional:0.06,
    firstJan1Portfolio:70000
  });

  const plan=FC.simulatePlan({
    phases:[{years:0.5,monthlyInvest:0,mortgageExtra:0,mortgageFreq:'monthly',annualBonus:0,bonusDest:'invest'}],
    startPortfolio:100000,
    annualReturnPct:12,
    startYear:2026,
    startMonth:7,
    bonusMonth:12,
    mortBalance:0,
    mortRatePct:0,
    mortYears:30,
    mortType:'annuity',
    mortTaxEnabled:false,
    deductRate:0,
    wozValue:0,
    box3Mode:'current',
    taxPartners:1,
    box3PaySource:'portfolio',
    currentTaxRate:0.36,
    currentAllowance:59357,
    currentNotional:0.06,
    firstJan1Portfolio:70000,
    futureStart:2028,
    futureTaxRate:0.36,
    futureExempt:1800,
    futureLossThreshold:500
  });

  approx(plan.box3Tax,flows.totalTax,1e-9,'Box 3 tax parity');
  approx(plan.portfolio,flows.portfolio,1e-9,'portfolio parity');
});

test('cash-flow equalization invests only each strategy\'s monthly cost advantage',()=>{
  const x=FC.equalizeCashFlows([2000,1800],[1500,2100]);
  assert.deepEqual(x.budget,[2000,2100]);
  assert.deepEqual(x.a,[0,300]);
  assert.deepEqual(x.b,[500,0]);
});
