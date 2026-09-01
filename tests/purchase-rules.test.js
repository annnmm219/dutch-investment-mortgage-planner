'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const PR=require('../purchase-rules.js');
const FC=require('../finance-core.js');

function approx(actual,expected,tolerance=1e-6,message=''){
  assert.ok(Number.isFinite(actual),`${message} actual value is not finite: ${actual}`);
  assert.ok(Math.abs(actual-expected)<=tolerance,`${message} expected ${expected}, got ${actual}`);
}

test('2026 main-residence transfer tax is 2%',()=>{
  const x=PR.transferTax2026({propertyValue:350000,mode:'main'});
  approx(x.amount,7000,1e-9);
  approx(x.rate,.02,1e-12);
});

test('2026 starter exemption is 0% up to €555,000 and falls back to 2% above the value cap',()=>{
  const eligible=PR.transferTax2026({propertyValue:555000,mode:'starter'});
  approx(eligible.amount,0,1e-12);
  assert.equal(eligible.starterEligible,true);

  const tooHigh=PR.transferTax2026({propertyValue:560000,mode:'starter'});
  approx(tooHigh.amount,11200,1e-9);
  assert.equal(tooHigh.starterEligible,false);
});

test('automatic transfer-tax base uses economic value and is never below purchase price',()=>{
  const higherMarket=PR.calculatePurchase2026({housePrice:550000,ownSavings:100000,baseCosts:0,transferTaxMode:'starter',appraisedValue:560000,nhgMode:'none'});
  approx(higherMarket.transferTaxBase,560000,1e-9);
  assert.equal(higherMarket.transferTax.starterEligible,false);
  approx(higherMarket.transferTax.amount,11200,1e-9);

  const lowerMarket=PR.calculatePurchase2026({housePrice:560000,ownSavings:100000,baseCosts:0,transferTaxMode:'main',appraisedValue:550000,nhgMode:'none'});
  approx(lowerMarket.transferTaxBase,560000,1e-9);
  approx(lowerMarket.transferTax.amount,11200,1e-9);
});

test('2026 non-main-residence residential transfer tax is 8%',()=>{
  const x=PR.transferTax2026({propertyValue:350000,mode:'other-home'});
  approx(x.amount,28000,1e-9);
  approx(x.rate,.08,1e-12);
});

test('2026 NHG standard limit and 0.4% fee are applied',()=>{
  const x=PR.nhg2026({purchasePrice:450000,appraisedValue:455000,mortgageAmount:400000,mode:'standard'});
  assert.equal(x.eligible,true);
  approx(x.limit,470000,1e-9);
  approx(x.fee,1600,1e-9);
});

test('2026 NHG standard check rejects a mortgage above €470,000',()=>{
  const x=PR.nhg2026({purchasePrice:470000,appraisedValue:470000,mortgageAmount:471000,mode:'standard'});
  assert.equal(x.eligible,false);
  approx(x.fee,0,1e-12);
});

test('2026 NHG energy planning limit is €498,200',()=>{
  const x=PR.nhg2026({purchasePrice:490000,appraisedValue:495000,mortgageAmount:490000,mode:'energy'});
  assert.equal(x.eligible,true);
  approx(x.limit,498200,1e-9);
  approx(x.fee,1960,1e-9);
  assert.match(x.warning,/above €470,000/i);
});

test('standard Dutch LTV planning guardrail flags loans above 100% of market value',()=>{
  const ok=PR.ltv2026({mortgageAmount:350000,appraisedValue:350000});
  assert.equal(ok.overStandardLimit,false);
  approx(ok.percentage,100,1e-9);

  const high=PR.ltv2026({mortgageAmount:360000,appraisedValue:350000});
  assert.equal(high.overStandardLimit,true);
  assert.ok(high.percentage>100);
});

test('purchase calculator keeps the default €350k case at €15k total costs before NHG',()=>{
  const x=PR.calculatePurchase2026({housePrice:350000,ownSavings:40000,baseCosts:8000,transferTaxMode:'main',appraisedValue:350000,nhgMode:'none'});
  approx(x.transferTax.amount,7000,1e-9);
  approx(x.totalCosts,15000,1e-9);
  approx(x.savingsAfterCosts,25000,1e-9);
  approx(x.requiredLoan,325000,1e-9);
  approx(x.ltv.percentage,92.85714285714286,1e-9);
});

test('NHG fee is solved consistently with the mortgage amount it helps create',()=>{
  const x=PR.calculatePurchase2026({housePrice:350000,ownSavings:40000,baseCosts:8000,transferTaxMode:'main',appraisedValue:350000,nhgMode:'standard'});
  assert.equal(x.nhg.eligible,true);
  approx(x.nhgFee,x.requiredLoan*.004,.02,'NHG circular fee');
  approx(x.totalCosts,8000+7000+x.nhgFee,.02,'total costs');
});

test('mortgagecalc.nl displayed 2026 mortgage example matches our gross and net amortisation within rounding',()=>{
  const ann=FC.mortgageSchedule({balance:320000,annualRatePct:4.37,termYears:30,type:'annuity',months:360,tax:{enabled:false}});
  const lin=FC.mortgageSchedule({balance:320000,annualRatePct:4.37,termYears:30,type:'linear',months:360,tax:{enabled:false}});
  approx(ann.firstScheduled,1596.77,.01,'mortgagecalc annuity month 1');
  approx(lin.firstScheduled,2054.22,.01,'mortgagecalc linear month 1');
  approx(ann.totalInterest,254837,2,'mortgagecalc annuity total interest');
  assert.ok(Math.abs(lin.totalInterest-210000)<1500,'mortgagecalc linear total interest should round to about €210k');

  const firstYear=FC.mortgageSchedule({balance:320000,annualRatePct:4.37,termYears:30,type:'annuity',months:12,tax:{enabled:true,deductionRate:.3756,wozValue:400000}});
  const averageNetMonth=(firstYear.firstScheduled*12-firstYear.totalTaxBenefit)/12;
  approx(averageNetMonth,1206.18,.05,'mortgagecalc first-year net monthly cost');
});

test('WhatTheMortgage-style schedule identities reconcile every row',()=>{
  const m=FC.mortgageSchedule({balance:300000,annualRatePct:4.6,termYears:30,type:'annuity',months:24,tax:{enabled:true,deductionRate:.3693,wozValue:0}});
  m.rows.forEach(row=>{
    approx(row.gross,row.principal+row.interest,1e-9,'gross = principal + interest');
    approx(row.net,row.gross-row.taxReturn,1e-9,'net = gross - tax return');
  });
});
