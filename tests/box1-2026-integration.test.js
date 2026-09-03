'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const FC=require('../finance-core.js');
const Box1=require('../box1-2026.js');
const SC=require('../scenario-engine.js');

Box1.decorateScenarioCore(SC);
const NE=require('../next-euro.js');

function approx(actual,expected,tolerance=1e-6,message=''){
  assert.ok(Number.isFinite(actual),`${message} actual value is not finite: ${actual}`);
  assert.ok(Math.abs(actual-expected)<=tolerance,`${message} expected ${expected}, got ${actual}`);
}

const automaticTax=()=>({
  enabled:true,
  calculationMode:'box1-2026',
  box1IncomeBeforeOwnHome:80000,
  box1Profile:Box1.BOX1_2026_RULES.profile,
  deductionRate:.3756,
  wozValue:400000,
  hraRemainingMonths:240,
  qualifyingInterestFraction:1
});

const mortgageInvestConfig=()=>({
  mode:'mortgage-invest',
  horizonYears:1,
  investmentReturnPct:0,
  startYear:2026,
  startMonth:1,
  startPortfolio:0,
  mortgageType:'annuity',
  mortgage:{balance:120000,ratePct:4,years:20},
  mortgageInvest:{extraMonthly:500},
  tax:automaticTax(),
  box3:{mode:'none',savings:0,debt:0},
  vveMonthly:0,
  maintenanceAnnual:0,
  ownerTaxesAnnual:0,
  insuranceAnnual:0,
  groundLeaseAnnual:0
});

test('2026 Box 1 rule metadata is dated, source-linked and internally coherent',()=>{
  const rules=Box1.BOX1_2026_RULES;
  assert.equal(rules.taxYear,2026);
  assert.equal(rules.verifiedAt,'2026-09-03');
  assert.equal(rules.status,'final-2026-rules');
  approx(rules.topRate-rules.maximumOwnHomeDeductionRate,rules.highIncomeAdjustmentRate,1e-12);
  assert.ok(Array.isArray(rules.sources));
  assert.ok(rules.sources.length>=3);
  rules.sources.forEach(source=>{
    assert.match(source.title,/Belastingdienst/);
    assert.match(source.url,/^https:\/\/www\.belastingdienst\.nl\//);
  });
});

test('statutory high-income adjustment is capped at qualifying deductible own-home costs',()=>{
  const x=Box1.ownHomeBox1Tax2026({
    box1IncomeBeforeOwnHome:80000,
    ewfIncome:4000,
    deductibleOwnHomeCosts:3500
  });
  assert.equal(x.supported,true);
  approx(x.grossOwnHomeBalance,500,1e-12);
  approx(x.hillenDeduction,359.335,1e-9);
  assert.ok(x.taxableIncomeAfterOwnHome+x.deductibleOwnHomeCosts-Box1.BOX1_2026_RULES.topThreshold>x.deductibleOwnHomeCosts);
  approx(x.highIncomeAdjustmentBase,3500,1e-9,'statutory adjustment ceiling');
  approx(x.highIncomeAdjustment,417.9,1e-9,'capped adjustment');
});

test('combined plan exposes the same automatic annual Box 1 trace as the mortgage schedule',()=>{
  const tax=automaticTax();
  const plan=FC.simulatePlan({
    phases:[{years:1,monthlyInvest:0,mortgageExtra:0,mortgageFreq:'monthly',annualBonus:0,bonusDest:'invest'}],
    startPortfolio:0,
    annualReturnPct:0,
    startYear:2026,
    startMonth:1,
    bonusMonth:12,
    mortBalance:120000,
    mortRatePct:4,
    mortYears:20,
    mortType:'annuity',
    mortTaxEnabled:true,
    box1CalculationMode:'box1-2026',
    box1IncomeBeforeOwnHome:tax.box1IncomeBeforeOwnHome,
    box1Profile:tax.box1Profile,
    deductRate:tax.deductionRate,
    wozValue:tax.wozValue,
    hraRemainingMonths:tax.hraRemainingMonths,
    qualifyingInterestFraction:tax.qualifyingInterestFraction,
    box3Mode:'none'
  });
  const direct=FC.mortgageSchedule({
    balance:120000,
    annualRatePct:4,
    termYears:20,
    type:'annuity',
    months:12,
    startYear:2026,
    startMonth:1,
    tax
  });
  approx(plan.mortTax,direct.totalTaxBenefit,1e-9,'combined plan vs mortgage schedule');
  approx(plan.schedule.reduce((sum,row)=>sum+row.taxReturn,0),plan.mortTax,1e-9,'monthly allocation');
  assert.equal(plan.box1CalculationMode,'bounded-2026-box1-before-after');
  assert.equal(plan.yearBuckets[2026].box1Trace.method,'bounded-2026-box1-before-after');
});

test('ScenarioCore carries the explicit automatic Box 1 profile into both strategies',()=>{
  const config=mortgageInvestConfig();
  const scenario=SC.runScenario(config);
  assert.equal(scenario.valid,true);

  const common={
    balance:config.mortgage.balance,
    annualRatePct:config.mortgage.ratePct,
    termYears:config.mortgage.years,
    type:config.mortgageType,
    months:12,
    startYear:config.startYear,
    startMonth:config.startMonth,
    tax:config.tax
  };
  const repay=FC.mortgageSchedule({...common,extraMonthly:500});
  const invest=FC.mortgageSchedule({...common,extraMonthly:0});
  approx(scenario.A.mortTax,repay.totalTaxBenefit,1e-9,'repay strategy');
  approx(scenario.B.mortTax,invest.totalTaxBenefit,1e-9,'invest strategy');
  assert.notEqual(scenario.A.mortTax,scenario.B.mortTax,'different interest paths should produce different Box 1 effects');
});

test('Next Euro consumes the same automatic Box 1 scenario results',()=>{
  const config=mortgageInvestConfig();
  const scenario=SC.runScenario(config);
  const next=NE.evaluate(config,{extraMonthly:500,years:1,returnPct:0});
  assert.equal(next.scenario.valid,true);
  approx(next.repay.mortTax,scenario.A.mortTax,1e-9,'Next Euro repay result');
  approx(next.invest.mortTax,scenario.B.mortTax,1e-9,'Next Euro invest result');
  approx(next.difference,next.invest.net-next.repay.net,1e-9,'Next Euro wealth difference');
});

test('ScenarioCore rejects an unsupported automatic Box 1 profile rather than falling back silently',()=>{
  const config=mortgageInvestConfig();
  config.tax={...config.tax,box1Profile:'aow-or-complex-profile'};
  assert.throws(()=>SC.runScenario(config),/Box 1 estimate unavailable: Only the 2026 non-AOW ordinary-employment profile is supported/);
});

test('browser adapter decorates ScenarioCore after it is created',()=>{
  const source=fs.readFileSync(path.resolve(__dirname,'..','box1-2026-ui.js'),'utf8');
  assert.match(source,/Box1\.decorateScenarioCore\(root\.ScenarioCore\)/);
  assert.match(source,/setTimeout\(\(\)=>\{decorateScenarioCore\(\);scheduleRender\(\);\},0\)/);
});
