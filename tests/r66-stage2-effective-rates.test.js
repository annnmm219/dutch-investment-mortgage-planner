
'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const FC=require('../finance-core.js');
const SC=require('../scenario-engine.js');
const NE=require('../next-euro.js');
const Contract=require('../model-contract.js');

const ROOT=path.resolve(__dirname,'..');
function approx(actual,expected,tolerance=1e-9,message=''){
  assert.ok(Number.isFinite(actual),`${message} actual value is not finite: ${actual}`);
  assert.ok(Math.abs(actual-expected)<=tolerance,`${message} expected ${expected}, got ${actual}`);
}
function noTaxBox3(){
  return{mode:'none',taxPartners:1,paySource:'external',savings:0,debt:0,savingsReturnPct:0,debtInterestPct:0,firstJan1Portfolio:0,firstJan1Savings:0,firstJan1Debt:0};
}
function scenarioBase(mode,months){
  return{
    mode,months,investmentReturnPct:0,startYear:2026,startMonth:1,startPortfolio:0,purchaseCosts:0,mortgageType:'annuity',
    mortgage:{balance:0,ratePct:0,years:30},tax:{enabled:false,deductionRate:0,wozValue:0,hraRemainingMonths:0,qualifyingInterestFraction:0},
    box3:noTaxBox3(),upfrontCashTreatment:'invest',homeGrowthPct:0,rentGrowthPct:0,sellingCostPct:0,
    vveMonthly:0,maintenanceAnnual:0,ownerTaxesAnnual:0,insuranceAnnual:0,groundLeaseAnnual:0,
    buyRent:{purchaseCosts:0,mortgageType:'annuity',price:0,cash:0,downPayment:0,monthlyRent:0,mortgageRatePct:0,mortgageYears:30,wozValue:0},
    downpayment:{purchaseCosts:0,mortgageType:'annuity',price:0,cash:0,downA:0,downB:0,mortgageRatePct:0,mortgageYears:30,wozValue:0},
    mortgageInvest:{extraMonthly:0},sellRent:{homeValue:0,monthlyRent:0,wozValue:0}
  };
}
function nextEuroBase(){
  return{
    mode:'mortgage-invest',horizonYears:10,investmentReturnPct:5,startYear:2026,startMonth:1,startPortfolio:0,
    mortgageType:'annuity',mortgage:{balance:300000,ratePct:4,years:30},
    tax:{enabled:false,deductionRate:0,wozValue:0,hraRemainingMonths:0,qualifyingInterestFraction:0},
    box3:noTaxBox3(),mortgageInvest:{extraMonthly:500},
    vveMonthly:0,maintenanceAnnual:0,ownerTaxesAnnual:0,insuranceAnnual:0,groundLeaseAnnual:0
  };
}

test('7% effective annual investment return produces exactly 7% over each full year',()=>{
  const monthly=FC.effectiveAnnualPctToMonthly(7);
  approx(Math.pow(1+monthly,12)-1,.07,1e-14,'12-month rate identity');
  const result=FC.simulateInvestmentFlows({initialPortfolio:100000,flows:Array(360).fill(0),annualReturnPct:7,startYear:2026,startMonth:1,box3Mode:'none'});
  approx(result.portfolio,100000*Math.pow(1.07,30),.01,'30-year investment value');
  approx(result.portfolio,761225.5048,.01,'independent 7% proof case');
});

test('end-of-month contribution timing remains an ordinary annuity',()=>{
  const monthly=FC.effectiveAnnualPctToMonthly(12);
  const result=FC.simulateInvestmentFlows({initialPortfolio:0,flows:Array(12).fill(100),annualReturnPct:12,startYear:2026,startMonth:1,box3Mode:'none'});
  const expected=100*(Math.pow(1+monthly,12)-1)/monthly;
  approx(result.portfolio,expected,1e-8,'ordinary-annuity timing');
});

test('savings yield is effective annual while Box 3 debt interest remains nominal annual',()=>{
  const savings=FC.simulateInvestmentFlows({initialPortfolio:0,flows:Array(12).fill(0),annualReturnPct:0,startYear:2026,startMonth:1,box3Mode:'none',box3Savings:100000,savingsReturnPct:2});
  approx(savings.savings,102000,1e-8,'one-year savings yield');
  const debt=FC.simulateInvestmentFlows({initialPortfolio:0,flows:Array(12).fill(0),annualReturnPct:0,startYear:2026,startMonth:1,box3Mode:'none',box3Debt:100000,debtInterestPct:4});
  approx(debt.totalDebtInterest,4000,1e-8,'nominal debt interest');
  assert.equal(Contract.RATE_CONVENTIONS.box3DebtInterest.annualType,'nominal');
});

test('home-value growth compounds to the entered effective annual rate',()=>{
  const config=scenarioBase('sell-rent',360);
  config.homeGrowthPct=2;
  config.sellRent={homeValue:100000,monthlyRent:0,wozValue:100000};
  const result=SC.runScenario(config);
  assert.equal(result.valid,true);
  approx(result.A.equity,100000*Math.pow(1.02,30),.01,'30-year home value');
});

test('rent growth reproduces the entered annual increase after twelve monthly steps',()=>{
  const config=scenarioBase('buy-rent',13);
  config.rentGrowthPct=3;
  config.buyRent={purchaseCosts:0,mortgageType:'annuity',price:1,cash:1,downPayment:1,monthlyRent:1000,mortgageRatePct:0,mortgageYears:30,wozValue:1};
  const result=SC.runScenario(config);
  assert.equal(result.valid,true);
  approx(result.cashB[12],1030,1e-9,'month-13 rent');
});

test('mortgage amortisation remains on the nominal annual contractual convention',()=>{
  const mortgage=FC.mortgageSchedule({balance:350000,annualRatePct:4,termYears:30,type:'annuity',months:360,tax:{enabled:false}});
  approx(mortgage.firstScheduled,1670.9535341290882,1e-8,'first mortgage payment');
  approx(mortgage.totalInterest,251543.2722864718,.01,'mortgage total interest');
  approx(FC.nominalAnnualPctToMonthly(4),.04/12,1e-15,'nominal monthly rate');
});

test('Next Euro reports an effective annual investment hurdle against a nominal mortgage',()=>{
  const result=NE.findBreakEven(nextEuroBase(),{extraMonthly:500,minReturnPct:0,maxReturnPct:10,wealthTolerance:.05});
  assert.equal(result.status,'found');
  const effectiveMortgageRate=(Math.pow(1+.04/12,12)-1)*100;
  approx(result.breakEvenReturnPct,effectiveMortgageRate,.02,'effective annual break-even');
});

test('all executable Stage 2 conversion sites and visible labels use the declared semantics',()=>{
  const finance=fs.readFileSync(path.join(ROOT,'finance-core.js'),'utf8');
  const scenario=fs.readFileSync(path.join(ROOT,'scenario-engine.js'),'utf8');
  const index=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  const household=fs.readFileSync(path.join(ROOT,'box3-household.js'),'utf8');
  const nextEuro=fs.readFileSync(path.join(ROOT,'next-euro.js'),'utf8');
  assert.doesNotMatch(finance,/annualReturnPct\)\|\|0\)\/100\/12/);
  assert.doesNotMatch(finance,/savingsReturnPct\)\|\|0\)\/100\/12/);
  assert.doesNotMatch(scenario,/S\.rentGrowthPct\/100\/12/);
  assert.doesNotMatch(scenario,/S\.homeGrowthPct\/100\/12/);
  assert.match(index,/Expected effective annual return %/);
  assert.match(index,/Nominal annual interest rate %/);
  assert.match(scenario,/Effective annual home value growth %/);
  assert.match(scenario,/Effective annual rent growth %/);
  assert.match(household,/Effective annual savings yield %/);
  assert.match(household,/Nominal annual Box 3 debt interest %/);
  assert.match(nextEuro,/Break-even effective annual return/);
});
