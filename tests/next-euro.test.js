'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const NE=require('../next-euro.js');

function approx(actual,expected,tolerance=1e-3,message=''){
  assert.ok(Number.isFinite(actual),`${message} actual value is not finite: ${actual}`);
  assert.ok(Math.abs(actual-expected)<=tolerance,`${message} expected ${expected}, got ${actual}`);
}

function base(){
  return{
    mode:'mortgage-invest',
    horizonYears:10,
    investmentReturnPct:5,
    startYear:2026,
    startMonth:1,
    startPortfolio:0,
    mortgageType:'annuity',
    mortgage:{balance:300000,ratePct:4,years:30},
    tax:{enabled:false,deductionRate:0,wozValue:0},
    box3:{
      mode:'none',taxPartners:1,paySource:'external',currentTaxRate:.36,currentAllowance:59357,currentNotional:.06,
      currentSavingsNotional:.0128,currentDebtNotional:.027,currentDebtThreshold:3800,firstJan1Portfolio:0,
      savings:0,debt:0,savingsReturnPct:0,debtInterestPct:0,debtMonthlyRepayment:0,debtRepaymentSource:'external',
      futureStart:2028,futureTaxRate:.36,futureExempt:1800,futureLossThreshold:500
    },
    mortgageInvest:{extraMonthly:500},
    vveMonthly:0,maintenanceAnnual:0,ownerTaxesAnnual:0,insuranceAnnual:0,groundLeaseAnnual:0
  };
}

test('0% mortgage produces a 0% invest-vs-repay break-even',()=>{
  const c=base();c.mortgage.ratePct=0;
  const x=NE.findBreakEven(c,{extraMonthly:500,minReturnPct:-5,maxReturnPct:10,scanStepPct:.25});
  assert.equal(x.status,'found');
  approx(x.breakEvenReturnPct,0,.01,'zero-rate break-even');
});

test('4% nominal mortgage without HRA or Box 3 breaks even at its effective annual equivalent',()=>{
  const c=base();
  const x=NE.findBreakEven(c,{extraMonthly:500,minReturnPct:0,maxReturnPct:10,scanStepPct:.1,wealthTolerance:.05});
  assert.equal(x.status,'found');
  const effectiveMortgageRate=(Math.pow(1+.04/12,12)-1)*100;
  approx(x.breakEvenReturnPct,effectiveMortgageRate,.02,'nominal mortgage versus effective annual investment equivalence');
});

test('mortgage-interest tax relief lowers the investment return required to beat repayment',()=>{
  const noTax=base();
  const withTax=base();withTax.tax={enabled:true,deductionRate:.3756,wozValue:0};
  const a=NE.findBreakEven(noTax,{extraMonthly:500,minReturnPct:0,maxReturnPct:10,scanStepPct:.1});
  const b=NE.findBreakEven(withTax,{extraMonthly:500,minReturnPct:0,maxReturnPct:10,scanStepPct:.1});
  assert.equal(a.status,'found');assert.equal(b.status,'found');
  assert.ok(b.breakEvenReturnPct<a.breakEvenReturnPct,`HRA break-even ${b.breakEvenReturnPct} should be below no-HRA ${a.breakEvenReturnPct}`);
});

test('Box 3 on investments raises the effective annual investment break-even versus the untaxed case',()=>{
  const untaxed=base();untaxed.startPortfolio=200000;
  const taxed=base();taxed.startPortfolio=200000;taxed.box3={...taxed.box3,mode:'current',currentAllowance:0,firstJan1Portfolio:200000};
  const a=NE.findBreakEven(untaxed,{extraMonthly:500,minReturnPct:0,maxReturnPct:15,scanStepPct:.1});
  const b=NE.findBreakEven(taxed,{extraMonthly:500,minReturnPct:0,maxReturnPct:15,scanStepPct:.1});
  assert.equal(a.status,'found');assert.equal(b.status,'found');
  assert.ok(b.breakEvenReturnPct>a.breakEvenReturnPct,`Box 3 break-even ${b.breakEvenReturnPct} should exceed untaxed ${a.breakEvenReturnPct}`);
});

test('analysis returns the custom amount plus €250/€500/€1,000 quick comparisons',()=>{
  const c=base();
  const x=NE.analyze(c,{extraMonthly:750,selectedReturnPct:5,amounts:[250,500,1000]});
  assert.equal(x.extraMonthly,750);
  assert.equal(x.selectedReturnPct,5);
  assert.deepEqual(x.quick.map(r=>r.amount),[250,500,1000]);
  assert.ok(['invest','repay','tie'].includes(x.selected.leader));
  assert.ok(['found','none','invalid'].includes(x.breakEven.status));
});

test('optimizer reports an invalid comparison when there is no mortgage balance',()=>{
  const c=base();c.mortgage.balance=0;
  const x=NE.findBreakEven(c,{extraMonthly:500});
  assert.equal(x.status,'invalid');
  assert.equal(x.reason,'no-mortgage');
});
