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
    box3:{mode:'none',taxPartners:1,paySource:'portfolio'},
    homeGrowthPct:0,
    rentGrowthPct:0,
    sellingCostPct:0,
    vveMonthly:0,
    maintenanceAnnual:0,
    buyRent:{purchaseCosts:0,mortgageType:'annuity',price:0,cash:0,downPayment:0,monthlyRent:0,mortgageRatePct:0,mortgageYears:10},
    downpayment:{purchaseCosts:0,mortgageType:'annuity',price:0,cash:0,downA:0,downB:0,mortgageRatePct:0,mortgageYears:10},
    mortgageInvest:{extraMonthly:0},
    sellRent:{homeValue:0,monthlyRent:0}
  };
}

test('Buy vs Rent reconciles starting cash, principal equity and monthly cost difference',()=>{
  const c=base('buy-rent');
  c.purchaseCosts=5000;
  c.buyRent={purchaseCosts:c.purchaseCosts||0,mortgageType:'annuity',price:120000,cash:25000,downPayment:20000,monthlyRent:1000,mortgageRatePct:0,mortgageYears:10};
  const x=SC.runScenario(c);
  approx(x.A.net,32000,1e-6,'buyer final wealth');
  approx(x.B.net,25000,1e-6,'renter final wealth');
  approx(x.A.equity,30000,1e-6,'buyer home equity');
  approx(x.A.invest,2000,1e-6,'buyer invested payment advantage');
  approx(x.B.rent,12000,1e-6,'rent paid');
  approx(x.peakRequirement,1000,1e-6,'monthly comparison budget');
});

test('Larger vs smaller down payment ties at zero interest and zero investment return',()=>{
  const c=base('downpayment');
  c.purchaseCosts=5000;
  c.downpayment={purchaseCosts:c.purchaseCosts||0,mortgageType:'annuity',price:120000,cash:45000,downA:40000,downB:20000,mortgageRatePct:0,mortgageYears:10};
  const x=SC.runScenario(c);
  approx(x.A.net,50000,1e-6,'larger down payment wealth');
  approx(x.B.net,50000,1e-6,'smaller down payment wealth');
  approx(x.A.equity,48000,1e-6,'strategy A equity');
  approx(x.A.invest,2000,1e-6,'strategy A invested payment difference');
  approx(x.B.equity,30000,1e-6,'strategy B equity');
  approx(x.B.invest,20000,1e-6,'strategy B retained upfront cash');
});

test('Extra mortgage repayment vs invest ties when mortgage and investments both return 0%',()=>{
  const c=base('mortgage-invest');
  c.mortgage={balance:120000,ratePct:0,years:10};
  c.mortgageInvest={extraMonthly:500};
  const x=SC.runScenario(c);
  approx(x.A.mortgage,102000,1e-6,'extra-repay balance');
  approx(x.B.mortgage,108000,1e-6,'normal balance');
  approx(x.B.invest,6000,1e-6,'invested alternative');
  approx(x.A.net,-102000,1e-6,'extra repay comparable wealth');
  approx(x.B.net,-102000,1e-6,'invest comparable wealth');
  approx(x.peakRequirement,1500,1e-6,'required monthly capacity');
});

test('Linear vs annuity is identical at 0% interest',()=>{
  const c=base('linear-annuity');
  c.mortgage={balance:120000,ratePct:0,years:10};
  const x=SC.runScenario(c);
  approx(x.A.mortgage,108000,1e-6,'linear balance');
  approx(x.B.mortgage,108000,1e-6,'annuity balance');
  approx(x.A.net,-108000,1e-6,'linear comparable wealth');
  approx(x.B.net,-108000,1e-6,'annuity comparable wealth');
  approx(x.A.invest,0,1e-9);
  approx(x.B.invest,0,1e-9);
});

test('Keep vs Sell + Rent reconciles sale proceeds, retained equity and monthly rent difference',()=>{
  const c=base('sell-rent');
  c.mortgage={balance:60000,ratePct:0,years:10};
  c.sellRent={homeValue:120000,monthlyRent:1000};
  const x=SC.runScenario(c);
  approx(x.A.mortgage,54000,1e-6,'keep-home mortgage');
  approx(x.A.equity,66000,1e-6,'keep-home equity');
  approx(x.A.invest,6000,1e-6,'keeper invested monthly advantage');
  approx(x.A.net,72000,1e-6,'keep-home wealth');
  approx(x.B.invest,60000,1e-6,'sale proceeds invested');
  approx(x.B.net,60000,1e-6,'sell-and-rent wealth');
  approx(x.B.rent,12000,1e-6,'rent paid');
});

test('Buy vs Rent charges purchase and selling costs exactly once',()=>{
  const c=base('buy-rent');
  c.purchaseCosts=5000;
  c.sellingCostPct=2;
  c.buyRent={purchaseCosts:c.purchaseCosts||0,mortgageType:'annuity',price:120000,cash:25000,downPayment:20000,monthlyRent:1000,mortgageRatePct:0,mortgageYears:10};
  const x=SC.runScenario(c);
  approx(x.A.purchase,5000,1e-9,'purchase cost record');
  approx(x.A.selling,2400,1e-9,'selling cost record');
  approx(x.A.equity,27600,1e-6,'equity after one sale cost');
  approx(x.A.net,29600,1e-6,'final wealth after costs');
});
