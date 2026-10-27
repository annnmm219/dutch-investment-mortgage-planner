'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const NE=require('../next-euro.js');
const FC=require('../finance-core.js');
const SC=require('../scenario-engine.js');
const S91=require('../stage9-1-remediation.js');

const ROOT=path.resolve(__dirname,'..');

function approx(actual,expected,tolerance=1e-6,message=''){
  assert.ok(Number.isFinite(actual),`${message} actual value is not finite: ${actual}`);
  assert.ok(Math.abs(actual-expected)<=tolerance,`${message} expected ${expected}, got ${actual}`);
}

function flowArgs(extra={}){
  return{
    initialPortfolio:0,flows:Array(12).fill(0),annualReturnPct:0,startYear:2026,startMonth:1,box3Mode:'none',
    box3Savings:100000,box3Debt:50000,savingsReturnPct:12,debtInterestPct:4,
    ...extra
  };
}

function mortgageInvest(box3){
  return{
    mode:'mortgage-invest',horizonYears:1,investmentReturnPct:0,startYear:2026,startMonth:1,startPortfolio:0,
    mortgageType:'annuity',mortgage:{balance:100000,ratePct:0,years:10},
    tax:{enabled:false,deductionRate:0,wozValue:0},
    box3:{
      mode:'none',taxPartners:1,paySource:'external',currentTaxRate:.36,currentAllowance:59357,currentNotional:.06,
      currentSavingsNotional:.0128,currentDebtNotional:.027,currentDebtThreshold:3800,
      savings:100000,debt:50000,debtMonthlyRepayment:0,debtRepaymentSource:'external',
      futureStart:2028,futureTaxRate:.36,futureExempt:1800,futureLossThreshold:500,
      ...box3
    },
    mortgageInvest:{extraMonthly:0},
    vveMonthly:0,maintenanceAnnual:0,ownerTaxesAnnual:0,insuranceAnnual:0,groundLeaseAnnual:0
  };
}

test('missing Next Euro household rates use labelled 2.00% and 4.00% defaults',()=>{
  assert.equal(NE.HOUSEHOLD_RATE_DEFAULTS.savingsYieldPct,2);
  assert.equal(NE.HOUSEHOLD_RATE_DEFAULTS.debtInterestPct,4);
  assert.equal(NE.HOUSEHOLD_RATE_DEFAULTS.savingsLabel,'expected savings yield');
  assert.equal(NE.HOUSEHOLD_RATE_DEFAULTS.debtLabel,'contractual Box 3 debt interest');
  const missing=NE.householdRatesFromFields({});
  assert.equal(missing.savings.included,true);
  assert.equal(missing.savings.usedDefault,true);
  assert.equal(missing.savings.pct,2);
  assert.equal(missing.debt.included,true);
  assert.equal(missing.debt.usedDefault,true);
  assert.equal(missing.debt.pct,4);
  assert.equal(missing.omitSavingsYield,false);
  assert.equal(missing.omitDebtInterest,false);
  assert.equal(missing.savingsReturnPct,2);
  assert.equal(missing.debtInterestPct,4);
  assert.notEqual(missing.savingsReturnPct,1.28);
  assert.notEqual(missing.debtInterestPct,2.7);
  const source=fs.readFileSync(path.join(ROOT,'next-euro.js'),'utf8');
  assert.doesNotMatch(source,/box3SavingsReturn',\s*1\.28/);
  assert.doesNotMatch(source,/box3DebtInterest',\s*2\.7/);
  assert.match(source,/currentSavingsNotional',\s*1\.28/);
  assert.match(source,/currentDebtNotional',\s*2\.7/);
  assert.match(source,/toFixed\(2\)\}% \(\$\{label\}\)/);
  assert.match(source,/HOUSEHOLD_RATE_DEFAULTS\.savingsLabel/);
  assert.match(source,/HOUSEHOLD_RATE_DEFAULTS\.debtLabel/);
  assert.match(source,/scenarioSavingsReturnFresh/);
  assert.match(source,/scenarioDebtInterestFresh/);
});

test('an empty Next Euro rate is omitted instead of being treated as 0%',()=>{
  assert.equal(NE.MISSING_RATE_MESSAGE,'Enter a rate to include this in the estimate.');
  for(const raw of ['', '   ']){
    const savings=NE.readHouseholdRate(raw,2);
    const debt=NE.readHouseholdRate(raw,4);
    assert.deepEqual(savings,{included:false,pct:null,usedDefault:false});
    assert.deepEqual(debt,{included:false,pct:null,usedDefault:false});
  }
  const empty=NE.householdRatesFromFields({savingsRaw:'',debtRaw:''});
  assert.equal(empty.savingsReturnPct,null);
  assert.equal(empty.debtInterestPct,null);
  assert.equal(empty.omitSavingsYield,true);
  assert.equal(empty.omitDebtInterest,true);
  assert.equal(empty.savings.pct,null);
  assert.notEqual(empty.savingsReturnPct,0);
  assert.notEqual(empty.debtInterestPct,0);

  const omitted=FC.simulateInvestmentFlows(flowArgs({omitSavingsYield:true,omitDebtInterest:true,savingsReturnPct:12,debtInterestPct:4}));
  approx(omitted.savings,100000,1e-6,'omitted savings yield is left out');
  approx(omitted.totalDebtInterest,0,1e-6,'omitted debt interest is left out');

  const applied=FC.simulateInvestmentFlows(flowArgs({savingsReturnPct:12,debtInterestPct:4}));
  approx(applied.savings,112000,1e-6,'entered savings yield is included');
  approx(applied.totalDebtInterest,2000,1e-6,'entered debt interest is included');

  const explicitZero=NE.householdRatesFromFields({savingsRaw:'0',debtRaw:0});
  assert.equal(explicitZero.savings.included,true);
  assert.equal(explicitZero.savings.usedDefault,false);
  assert.equal(explicitZero.savings.pct,0);
  assert.equal(explicitZero.debt.included,true);
  assert.equal(explicitZero.debt.pct,0);
  assert.equal(explicitZero.omitSavingsYield,false);
  assert.equal(explicitZero.omitDebtInterest,false);
  const zero=FC.simulateInvestmentFlows(flowArgs({savingsReturnPct:0,debtInterestPct:0}));
  approx(zero.savings,100000,1e-6,'explicit 0% savings yield stays in the estimate');
  approx(zero.totalDebtInterest,0,1e-6,'explicit 0% debt interest stays in the estimate');
});

test('scenario and stage 9.1 paths leave an omitted household rate out of the estimate',()=>{
  const kept=SC.runScenario(mortgageInvest({savingsReturnPct:12,debtInterestPct:4}));
  const leftOut=SC.runScenario(mortgageInvest({savingsReturnPct:12,debtInterestPct:4,omitSavingsYield:true,omitDebtInterest:true}));
  const explicitZero=SC.runScenario(mortgageInvest({savingsReturnPct:0,debtInterestPct:0}));
  assert.equal(kept.valid,true);
  assert.equal(leftOut.valid,true);
  assert.equal(explicitZero.valid,true);
  approx(kept.A.savings,112000,1e-4,'scenario applies an entered yield');
  approx(kept.A.box3DebtInterest,2000,1e-4,'scenario applies entered debt interest');
  approx(leftOut.A.savings,100000,1e-4,'scenario omits an empty yield');
  approx(leftOut.A.box3DebtInterest,0,1e-4,'scenario omits empty debt interest');
  approx(explicitZero.A.savings,100000,1e-4,'scenario keeps an explicit zero yield');
  approx(explicitZero.A.box3DebtInterest,0,1e-4,'scenario keeps explicit zero debt interest');

  const stageKept=S91.simulateInvestmentFlowsStage91(flowArgs(),{});
  const stageOmitted=S91.simulateInvestmentFlowsStage91(flowArgs({omitSavingsYield:true,omitDebtInterest:true}),{});
  approx(stageKept.savings,112000,1e-6,'stage 9.1 applies an entered yield');
  approx(stageKept.totalDebtInterest,2000,1e-6,'stage 9.1 applies entered debt interest');
  approx(stageOmitted.savings,100000,1e-6,'stage 9.1 leaves an omitted yield out');
  approx(stageOmitted.totalDebtInterest,0,1e-6,'stage 9.1 leaves omitted debt interest out');
});
