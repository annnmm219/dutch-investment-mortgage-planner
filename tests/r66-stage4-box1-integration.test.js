'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const FC=require('../finance-core.js');
const Box1=require('../box1-2026.js');
const SC=require('../scenario-engine.js');

Box1.decorateScenarioCore(SC);
const NextEuro=require('../next-euro.js');

function approx(actual,expected,tolerance=1e-6,message=''){
  assert.ok(Number.isFinite(actual),`${message} actual value is not finite: ${actual}`);
  assert.ok(Math.abs(actual-expected)<=tolerance,`${message} expected ${expected}, got ${actual}`);
}

const automaticTax=()=>({
  enabled:true,
  calculationMode:'box1-2026',
  box1IncomeBeforeOwnHome:80000,
  box1Profile:Box1.PROFILE,
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

test('combined plan and mortgage schedule expose the same automatic annual Box 1 trace',()=>{
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
  assert.equal(plan.box1CalculationMode,Box1.METHOD);
  assert.equal(plan.yearBuckets[2026].box1Trace.method,Box1.METHOD);
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
  const next=NextEuro.evaluate(config,{extraMonthly:500,years:1,returnPct:0});
  assert.equal(next.scenario.valid,true);
  approx(next.repay.mortTax,scenario.A.mortTax,1e-9,'Next Euro repay result');
  approx(next.invest.mortTax,scenario.B.mortTax,1e-9,'Next Euro invest result');
  approx(next.difference,next.invest.net-next.repay.net,1e-9,'Next Euro wealth difference');
});

test('ScenarioCore rejects an unsupported automatic profile instead of reverting to a percentage',()=>{
  const config=mortgageInvestConfig();
  config.tax={...config.tax,box1Profile:'aow-or-complex-profile'};
  assert.throws(()=>SC.runScenario(config),/Box 1 estimate unavailable: Only the 2026 non-AOW ordinary-employment profile is supported/);
});

test('automatic scenario context is isolated and does not leak into a later manual scenario',()=>{
  const automatic=SC.runScenario(mortgageInvestConfig());
  const manualConfig=mortgageInvestConfig();
  manualConfig.tax={
    enabled:true,
    calculationMode:'manual-rate',
    deductionRate:.30,
    wozValue:400000,
    hraRemainingMonths:240,
    qualifyingInterestFraction:1
  };
  const manual=SC.runScenario(manualConfig);
  assert.equal(automatic.valid,true);
  assert.equal(manual.valid,true);
  assert.notEqual(automatic.A.mortTax,manual.A.mortTax);
  const direct=FC.mortgageSchedule({
    balance:120000,
    annualRatePct:4,
    termYears:20,
    type:'annuity',
    months:12,
    startYear:2026,
    startMonth:1,
    extraMonthly:500,
    tax:manualConfig.tax
  });
  approx(manual.A.mortTax,direct.totalTaxBenefit,1e-9,'manual context after automatic run');
});

test('Box 1 code consumes the policy registry instead of duplicating statutory constants',()=>{
  const source=fs.readFileSync(path.resolve(__dirname,'..','box1-2026.js'),'utf8');
  assert.match(source,/const POLICY=Policy2026\.VALUES/);
  assert.match(source,/POLICY\.box1\.preAowBrackets/);
  assert.match(source,/POLICY\.box1\.ownHomeHighIncomeAdjustmentRate/);
  assert.doesNotMatch(source,/38883|78426|\.1194|\.495|\.3756/);
});

test('browser order applies Box 1 before calculations and before Next Euro',()=>{
  const html=fs.readFileSync(path.resolve(__dirname,'..','index.html'),'utf8');
  const scripts=[...html.matchAll(/<script\s+src="([^"]+)"/g)]
    .map(match=>match[1].split('?')[0])
    .filter(source=>!/^https?:\/\//i.test(source));
  const finance=scripts.indexOf('finance-core.js');
  const box1=scripts.indexOf('box1-2026.js');
  const logic=scripts.indexOf('logic-integrity-ui.js');
  const scenario=scripts.indexOf('scenario-engine.js');
  const box1Ui=scripts.indexOf('box1-2026-ui.js');
  const next=scripts.indexOf('next-euro.js');
  assert.equal(box1,finance+1);
  assert.equal(logic,box1+1);
  assert.equal(box1Ui,scenario+1);
  assert.equal(next,box1Ui+1);
});

test('browser disclosure names the bounded profile and annual audit bridge',()=>{
  const source=fs.readFileSync(path.resolve(__dirname,'..','box1-2026-ui.js'),'utf8');
  assert.match(source,/Bounded automatic Box 1 scope/);
  assert.match(source,/Year-by-year Box 1 own-home tax bridge/);
  assert.match(source,/2026 non-AOW employment profile/);
  assert.match(source,/Projection years after 2026/);
  assert.match(source,/Tax credits, Box 1 losses/);
});
