'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const FC=require('../finance-core.js');
const SC=require('../scenario-engine.js');

function approx(actual,expected,tolerance=1e-6,message=''){
  assert.ok(Number.isFinite(actual),`${message} actual value is not finite: ${actual}`);
  assert.ok(Math.abs(actual-expected)<=tolerance,`${message} expected ${expected}, got ${actual}`);
}

function scenarioBase(mode='buy-rent'){
  return{
    mode,horizonYears:1,investmentReturnPct:0,startYear:2026,startMonth:1,startPortfolio:0,purchaseCosts:0,mortgageType:'annuity',
    mortgage:{balance:0,ratePct:0,years:10},tax:{enabled:false,deductionRate:0,wozValue:400000,hraRemainingMonths:120,qualifyingInterestFraction:1},
    box3:{mode:'none',taxPartners:1,paySource:'savings',savings:0,debt:0,savingsReturnPct:0,debtInterestPct:0},
    homeGrowthPct:0,rentGrowthPct:0,sellingCostPct:0,vveMonthly:0,maintenanceAnnual:0,ownerTaxesAnnual:0,insuranceAnnual:0,groundLeaseAnnual:0,
    buyRent:{price:0,downPayment:0,monthlyRent:0,mortgageRatePct:0,mortgageYears:10},downpayment:{price:0,downA:0,downB:0,mortgageRatePct:0,mortgageYears:10},mortgageInvest:{extraMonthly:0},sellRent:{homeValue:0,monthlyRent:0}
  };
}

test('Hillen relief declines by year and is zero from 2041',()=>{
  approx(FC.hillenReliefForYear(2026),.71867,1e-12,'2026');
  approx(FC.hillenReliefForYear(2027),.67067,1e-12,'2027');
  approx(FC.hillenReliefForYear(2040),.04667,1e-12,'2040');
  approx(FC.hillenReliefForYear(2041),0,1e-12,'2041');
});

test('EWF and Hillen continue for the full ownership year after a January mortgage payoff',()=>{
  const m=FC.mortgageSchedule({balance:1000,annualRatePct:0,termYears:30,type:'annuity',months:12,extraMonthly:1000,startYear:2026,startMonth:1,tax:{enabled:true,deductionRate:.3756,wozValue:400000,hraRemainingMonths:360}});
  assert.equal(m.payoffMonthIndex,0);
  const expected=FC.mortgageTaxBenefit({interest:0,ownershipMonths:12,deductionRate:.3756,wozValue:400000,enabled:true,year:2026});
  approx(m.totalTaxBenefit,expected,1e-9,'full-year post-payoff EWF/Hillen');
  assert.ok(m.totalTaxBenefit<-140,'full-year residual owner-home tax cost should remain after payoff');
});

test('HRA expires while gross mortgage interest and owner-home taxation continue',()=>{
  const m=FC.mortgageSchedule({balance:300000,annualRatePct:4,termYears:30,type:'annuity',months:24,startYear:2026,startMonth:1,tax:{enabled:true,deductionRate:.3756,wozValue:400000,hraRemainingMonths:12}});
  const y2027=m.annualTaxBuckets[2027];
  assert.ok(y2027.grossInterest>0,'gross mortgage interest continues');
  approx(y2027.deductibleInterest,0,1e-12,'deductible interest after expiry');
  assert.ok(y2027.taxBenefit<0,'EWF/Hillen owner-home result remains after HRA expiry');
});

test('mid-year current Box 3 does not use incomplete actual-return rebuttal',()=>{
  const x=FC.simulateInvestmentFlows({initialPortfolio:120000,flows:Array(6).fill(0),annualReturnPct:0,startYear:2026,startMonth:7,box3Mode:'current',paySource:'external',firstJan1Portfolio:100000,currentTaxRate:.36,currentAllowance:59357,currentNotional:.06});
  approx(x.totalTax,877.8888,1e-6,'deemed tax');
  assert.match(x.yearBuckets[2026].method,/deemed return/);
  assert.doesNotMatch(x.yearBuckets[2026].method,/actual-return rebuttal/);
});

test('partial final Box 3 year stays unsettled instead of being charged as complete',()=>{
  const x=FC.simulateInvestmentFlows({initialPortfolio:100000,flows:Array(6).fill(0),annualReturnPct:0,startYear:2026,startMonth:1,box3Mode:'current',paySource:'portfolio',currentTaxRate:.36,currentAllowance:59357,currentNotional:.06});
  approx(x.totalTax,0,1e-12,'settled tax');
  approx(x.unsettledTaxEstimate,877.8888,1e-6,'unsettled estimate');
  assert.equal(x.yearBuckets[2026].settled,false);
  approx(x.portfolio,100000,1e-9,'unsettled tax is not withdrawn from portfolio');
});

test('future Box 3 exemption is applied before loss carryforward',()=>{
  const below=FC.box3TaxForYear({regime:'future',marketGain:1000,lossCarry:10000,taxPartners:1,futureTaxRate:.36,futureExempt:1800,futureLossThreshold:500});
  approx(below.tax,0,1e-12);approx(below.lossCarry,10000,1e-9,'loss preserved below exemption');
  const above=FC.box3TaxForYear({regime:'future',marketGain:2000,lossCarry:2000,taxPartners:1,futureTaxRate:.36,futureExempt:1800,futureLossThreshold:500});
  approx(above.tax,0,1e-12);approx(above.lossCarry,1800,1e-9,'only post-exemption result consumes loss');
});

test('mortgage-directed bonus larger than remaining mortgage is conserved via fallback',()=>{
  const x=FC.simulatePlan({phases:[{years:1,monthlyInvest:0,mortgageExtra:0,mortgageFreq:'monthly',annualBonus:10000,bonusDest:'mortgage'}],startPortfolio:0,annualReturnPct:0,startYear:2026,startMonth:1,bonusMonth:1,mortBalance:5000,mortRatePct:0,mortYears:30,mortType:'annuity',mortTaxEnabled:false,unusedMortgageDestination:'invest',box3Mode:'none'});
  approx(x.plannedMortgageExtra,10000,1e-9);
  approx(x.extraPaid+x.fallbackInvested,10000,1e-9,'all directed cash accounted for');
  approx(x.cashConservationDifference,0,1e-9,'cash invariant');
  assert.ok(x.fallbackInvested>5000,'unused mortgage allocation is redirected rather than disappearing');
});

test('repay-vs-invest conserves the monthly amount after early mortgage payoff',()=>{
  const c=scenarioBase('mortgage-invest');c.mortgage={balance:1000,ratePct:0,years:10};c.mortgageInvest={extraMonthly:1000};
  const x=SC.runScenario(c);
  assert.equal(x.valid,true);
  approx(x.A.net,x.B.net,1e-6,'zero-rate strategies still tie after early payoff');
});

test('purchase comparison is invalid when starting savings cannot fund required upfront cash',()=>{
  const c=scenarioBase('buy-rent');c.purchaseCosts=5000;c.box3.savings=10000;c.buyRent={price:120000,downPayment:20000,monthlyRent:1000,mortgageRatePct:0,mortgageYears:10};
  const x=SC.runScenario(c);
  assert.equal(x.valid,false);
  assert.match(x.reason,/starting savings/i);
});

test('buy scenario mortgage tax defaults WOZ to the scenario home instead of the main-tab property',()=>{
  const c=scenarioBase('buy-rent');c.tax={enabled:true,deductionRate:.3756,wozValue:400000,hraRemainingMonths:360,qualifyingInterestFraction:1};c.box3.savings=120000;c.buyRent={price:120000,downPayment:20000,monthlyRent:1000,mortgageRatePct:4,mortgageYears:30};
  const x=SC.runScenario(c);
  assert.equal(x.valid,true);
  const direct=FC.mortgageSchedule({balance:100000,annualRatePct:4,termYears:30,type:'annuity',months:12,startYear:2026,startMonth:1,tax:{enabled:true,deductionRate:.3756,wozValue:120000,hraRemainingMonths:360}});
  approx(x.A.mortTax,direct.totalTaxBenefit,1e-9,'scenario-specific WOZ');
});
