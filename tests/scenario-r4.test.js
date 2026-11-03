'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const SC=require('../scenario-engine.js');

function approx(actual,expected,tolerance=1e-6,message=''){
  assert.ok(Number.isFinite(actual),`${message} actual value is not finite: ${actual}`);
  assert.ok(Math.abs(actual-expected)<=tolerance,`${message} expected ${expected}, got ${actual}`);
}

function base(mode){
  return{
    mode,
    horizonYears:1,
    investmentReturnPct:0,
    startYear:2026,
    startMonth:1,
    startPortfolio:0,
    purchaseCosts:0,
    mortgageType:'annuity',
    mortgage:{balance:0,ratePct:0,years:10},
    tax:{enabled:false,deductionRate:0,wozValue:0},
    box3:{
      mode:'none',
      taxPartners:1,
      paySource:'savings',
      currentTaxRate:.36,
      currentAllowance:59357,
      currentNotional:.06,
      currentSavingsNotional:.0128,
      currentDebtNotional:.027,
      currentDebtThreshold:3800,
      savings:0,
      debt:0,
      savingsReturnPct:0,
      debtInterestPct:0,
      debtMonthlyRepayment:0,
      debtRepaymentSource:'external',
      futureStart:2028,
      futureTaxRate:.36,
      futureExempt:1800,
      futureLossThreshold:500
    },
    upfrontCashTreatment:'invest',
    homeGrowthPct:0,
    rentGrowthPct:0,
    sellingCostPct:0,
    vveMonthly:0,
    maintenanceAnnual:0,
    ownerTaxesAnnual:0,
    insuranceAnnual:0,
    groundLeaseAnnual:0,
    buyRent:{purchaseCosts:0,mortgageType:'annuity',price:0,downPayment:0,monthlyRent:0,mortgageRatePct:0,mortgageYears:10},
    downpayment:{purchaseCosts:0,mortgageType:'annuity',price:0,downA:0,downB:0,mortgageRatePct:0,mortgageYears:10},
    mortgageInvest:{extraMonthly:0},
    sellRent:{homeValue:0,monthlyRent:0}
  };
}

test('Buy vs Rent spends household savings before Box 3, lowering the buyer tax base',()=>{
  const c=base('buy-rent');
  c.investmentReturnPct=10;
  c.box3={...c.box3,mode:'current',paySource:'external',savings:100000};
  c.buyRent={purchaseCosts:c.purchaseCosts||0,mortgageType:'annuity',price:60000,downPayment:60000,monthlyRent:0,mortgageRatePct:0,mortgageYears:10};
  const x=SC.runScenario(c);
  approx(x.A.box3,0,1e-9,'buyer Box 3');
  assert.ok(x.B.box3>0,'renter should have positive Box 3 on the larger retained financial balance');
  assert.ok(x.B.box3>x.A.box3,'spending savings on the home should reduce modeled Box 3');
});

test('Buy vs Rent can keep unused upfront cash in savings instead of investing it',()=>{
  const c=base('buy-rent');
  c.box3.savings=25000;
  c.purchaseCosts=5000;
  c.upfrontCashTreatment='savings';
  c.buyRent={purchaseCosts:c.purchaseCosts||0,mortgageType:'annuity',price:120000,downPayment:20000,monthlyRent:1000,mortgageRatePct:0,mortgageYears:10};
  const x=SC.runScenario(c);
  approx(x.A.savings,0,1e-9,'buyer ending savings');
  approx(x.B.savings,25000,1e-9,'renter ending savings');
  approx(x.A.invest,2000,1e-6,'buyer invested monthly advantage');
  approx(x.B.invest,0,1e-9,'renter portfolio');
});

test('Down-payment comparison falls back to the household starting-savings balance',()=>{
  const c=base('downpayment');
  c.box3.savings=45000;
  c.purchaseCosts=5000;
  c.downpayment={purchaseCosts:c.purchaseCosts||0,mortgageType:'annuity',price:120000,downA:40000,downB:20000,mortgageRatePct:0,mortgageYears:10};
  const x=SC.runScenario(c);
  approx(x.A.net,50000,1e-6,'larger down payment wealth');
  approx(x.B.net,50000,1e-6,'smaller down payment wealth');
  approx(x.A.invest,2000,1e-6,'larger-down-payment portfolio');
  approx(x.B.invest,20000,1e-6,'smaller-down-payment portfolio');
});

test('Owner-only costs feed Buy vs Rent cash-flow equalisation and affordability',()=>{
  const c=base('buy-rent');
  c.upfrontCashTreatment='savings';
  c.buyRent={...c.buyRent,price:1,cash:1,downPayment:1,wozValue:1};
  c.vveMonthly=100;
  c.maintenanceAnnual=1200;
  c.ownerTaxesAnnual=1200;
  c.insuranceAnnual=600;
  c.groundLeaseAnnual=1200;
  const x=SC.runScenario(c);
  approx(x.A.owner,5400,1e-9,'annual owner costs');
  approx(x.A.vve,1200,1e-9,'VVE');
  approx(x.A.maintenance,1200,1e-9,'maintenance');
  approx(x.A.ownerTaxes,1200,1e-9,'owner taxes');
  approx(x.A.insurance,600,1e-9,'insurance');
  approx(x.A.groundLease,1200,1e-9,'ground lease');
  approx(x.peakRequirement,450,1e-9,'peak monthly owner cost');
  approx(x.B.invest,5400,1e-9,'renter invests owner-cost advantage');
});

test('Mortgage-vs-invest carries common savings and Box 3 debt into comparable wealth',()=>{
  const c=base('mortgage-invest');
  c.box3.savings=10000;
  c.box3.debt=2000;
  c.mortgage={balance:120000,ratePct:0,years:10};
  c.mortgageInvest={extraMonthly:500};
  const x=SC.runScenario(c);
  approx(x.A.net,-94000,1e-6,'extra-repay comparable wealth');
  approx(x.B.net,-94000,1e-6,'invest comparable wealth');
  approx(x.A.savings,10000,1e-9);
  approx(x.B.savings,10000,1e-9);
  approx(x.A.box3Debt,2000,1e-9);
  approx(x.B.box3Debt,2000,1e-9);
});

test('Common owner costs are included in mortgage-strategy affordability without changing the fair gap',()=>{
  const c=base('mortgage-invest');
  c.mortgage={balance:120000,ratePct:0,years:10};
  c.mortgageInvest={extraMonthly:500};
  c.vveMonthly=100;
  c.maintenanceAnnual=1200;
  c.ownerTaxesAnnual=600;
  c.insuranceAnnual=600;
  c.groundLeaseAnnual=600;
  const x=SC.runScenario(c);
  approx(x.peakRequirement,1850,1e-6,'mortgage plus owner-cost peak requirement');
  approx(x.B.invest,6000,1e-6,'monthly strategy difference remains €500');
});
