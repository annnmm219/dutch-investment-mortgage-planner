'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
require('../box1-2026.js');
const SC=require('../scenario-engine.js');
require('../stage10-remediation.js');

const ROOT=path.resolve(__dirname,'..');
const register=JSON.parse(fs.readFileSync(path.join(ROOT,'audits','r6.6','persona-acceptance-fixtures.json'),'utf8'));
const fixture=id=>register.fixtures.find(x=>x.id===id);

function box3({portfolio=0,savings=0,partners=1}={}){
  return{
    mode:'current',taxPartners:partners,paySource:'savings',
    currentTaxRate:.36,currentAllowance:59357,currentNotional:.06,currentSavingsNotional:.0128,currentDebtNotional:.027,currentDebtThreshold:3800,
    firstJan1Portfolio:portfolio,firstJan1Savings:savings,firstJan1Debt:0,
    savings,debt:0,savingsReturnPct:1.5,debtInterestPct:0,debtMonthlyRepayment:0,debtRepaymentSource:'external',debtFallbackDestination:'invest',
    futureStart:2028,futureTaxRate:.36,futureExempt:1800,futureLossThreshold:500
  };
}
function automaticTax(income,woz,hra=360,qualifying=1){
  return{enabled:true,calculationMode:'box1-2026',box1IncomeBeforeOwnHome:income,wozValue:woz,hraRemainingMonths:hra,qualifyingInterestFraction:qualifying};
}
function manualTax(rate,woz,hra=360,qualifying=1){
  return{enabled:true,calculationMode:'manual-rate',deductionRate:rate,wozValue:woz,hraRemainingMonths:hra,qualifyingInterestFraction:qualifying};
}
function purchaseRules({age,price,nhgMode='none',nhgStack=null}={}){
  return{
    enabled:true,purchaseType:'existing-home',propertyUse:'main-residence',transferTaxMode:age<35?'starter':'main',manualTransferTax:0,
    appraisedValue:price,nhgMode,buyerAge:age,starterMainResidence:true,starterExemptionUnused:true,qualifyingEnergyExpenditure:0,
    hraRemainingMonths:360,qualifyingInterestFraction:1,deductibleFinancingCosts:0,nhgNonEnergyCostStack:nhgStack,
    grossRentalIncomeAnnual:0,privateUseDays:0,privateUseWozValue:0,propertyIncomeGrowthPct:0
  };
}
function buyRentConfig({age,income,price,cash,portfolio,baseCosts,downPayment,rent,rate,woz,nhgMode='none',nhgStack=null,manualRate=null,owner=300,horizon=10,investmentReturn=5}){
  return{
    mode:'buy-rent',horizonYears:horizon,startYear:2026,startMonth:1,investmentReturnPct:investmentReturn,startPortfolio:portfolio,commonMonthlyInvestment:0,
    tax:manualRate==null?automaticTax(income,woz):manualTax(manualRate,woz),
    box3:box3({portfolio,savings:cash}),purchaseRules:purchaseRules({age,price,nhgMode,nhgStack}),
    upfrontCashTreatment:'invest',homeGrowthPct:2,rentGrowthPct:2.5,sellingCostPct:2,ownerCostMode:'total',ownerCostTotalMonthly:owner,ownerCostGrowthPct:2,
    vveMonthly:0,maintenanceAnnual:0,ownerTaxesAnnual:0,insuranceAnnual:0,groundLeaseAnnual:0,
    buyRent:{price,cash,purchaseCosts:baseCosts,downPayment,monthlyRent:rent,mortgageRatePct:rate,mortgageYears:30,mortgageType:'annuity',wozValue:woz}
  };
}
function nonPurchaseBase({mode,income,woz,mortgageBalance,rate,years=25,portfolio=0,savings=0,horizon=10,investmentReturn=5,taxMode='auto',manualRate=.3756}={}){
  return{
    mode,horizonYears:horizon,startYear:2026,startMonth:1,investmentReturnPct:investmentReturn,startPortfolio:portfolio,commonMonthlyInvestment:0,
    mortgageType:'annuity',mortgage:{balance:mortgageBalance,ratePct:rate,years},
    tax:taxMode==='manual'?manualTax(manualRate,woz,years*12):automaticTax(income,woz,years*12),
    box3:box3({portfolio,savings}),
    homeGrowthPct:2,rentGrowthPct:2.5,sellingCostPct:2,ownerCostMode:'total',ownerCostTotalMonthly:300,ownerCostGrowthPct:2,
    vveMonthly:0,maintenanceAnnual:0,ownerTaxesAnnual:0,insuranceAnnual:0,groundLeaseAnnual:0
  };
}

test('persona register keeps source facts separate from test-only assumptions',()=>{
  assert.equal(register.fixtures.length,10);
  for(const f of register.fixtures){
    assert.ok(f.facts&&typeof f.facts==='object',`${f.id} missing facts`);
    assert.ok(f.assumptions&&typeof f.assumptions==='object',`${f.id} missing assumptions`);
    assert.ok(typeof f.expected==='string'&&f.expected.length>20,`${f.id} missing acceptance expectation`);
  }
  assert.equal(fixture('P17-priya-missing-spouse-income').executable,false);
  assert.deepEqual(fixture('P17-priya-missing-spouse-income').assumptions,{},'missing spouse income must not be silently invented');
});

test('Sanne starter Buy vs Rent is valid with exact existing-home NHG and starter transfer-tax route',()=>{
  const f=fixture('P01-sanne-buy-rent'),a=f.assumptions,p=f.facts;
  const c=buyRentConfig({age:p.age,income:p.grossMonthlyIncome*12,price:a.existingHomePrice,cash:a.startSavings,portfolio:a.startPortfolio,baseCosts:a.basePurchaseCosts,downPayment:a.downPayment,rent:p.housingCostMonthly,rate:a.mortgageRatePct,woz:a.wozValue,nhgMode:a.nhgMode,nhgStack:a.nhgNonEnergyCostStack,owner:a.ownerCostMonthly,horizon:a.horizonYears,investmentReturn:a.investmentReturnPct});
  const r=SC.runScenario(c);
  assert.equal(r.valid,true,r.reason||'Sanne fixture should calculate');
  assert.equal(r.sourcesAndUses.A.transferTax.amount,0);
  assert.equal(r.sourcesAndUses.A.nhg.eligible,true);
  assert.ok(Math.abs(r.sourcesAndUses.A.identityDifference)<.01);
  assert.ok(Number.isFinite(r.A.net)&&Number.isFinite(r.B.net));
});

test('Sarah Down Payment fixture compares two funded strategies without collapsing another household income into Box 1',()=>{
  const f=fixture('P14-sarah-downpayment'),a=f.assumptions,p=f.facts;
  const c={
    mode:'downpayment',horizonYears:a.horizonYears,startYear:2026,startMonth:1,investmentReturnPct:a.investmentReturnPct,startPortfolio:a.startPortfolio,commonMonthlyInvestment:0,
    tax:automaticTax(a.box1IncomeBeforeOwnHome,a.wozValue),box3:box3({portfolio:a.startPortfolio,savings:a.startSavings}),purchaseRules:purchaseRules({age:p.age,price:a.existingHomePrice}),
    upfrontCashTreatment:'invest',homeGrowthPct:a.homeGrowthPct,rentGrowthPct:0,sellingCostPct:2,ownerCostMode:'total',ownerCostTotalMonthly:a.ownerCostMonthly,ownerCostGrowthPct:2,
    vveMonthly:0,maintenanceAnnual:0,ownerTaxesAnnual:0,insuranceAnnual:0,groundLeaseAnnual:0,
    downpayment:{price:a.existingHomePrice,cash:a.startSavings,purchaseCosts:a.basePurchaseCosts,downA:a.downPaymentA,downB:a.downPaymentB,mortgageRatePct:a.mortgageRatePct,mortgageYears:a.mortgageYears,mortgageType:'annuity',wozValue:a.wozValue}
  };
  const r=SC.runScenario(c);
  assert.equal(r.valid,true,r.reason||'Sarah fixture should calculate');
  assert.equal(r.sourcesAndUses.A.transferTax.amount,0);
  assert.equal(r.sourcesAndUses.B.transferTax.amount,0);
  assert.ok(Math.abs(r.sourcesAndUses.A.identityDifference)<.01&&Math.abs(r.sourcesAndUses.B.identityDifference)<.01);
  assert.ok(Number.isFinite(r.A.net)&&Number.isFinite(r.B.net));
});

test('Mark high-income Mortgage vs Invest produces finite automatic Box 1 effects and conserves the decision trade-off',()=>{
  const f=fixture('P12-mark-mortgage-invest'),a=f.assumptions,p=f.facts;
  const c=nonPurchaseBase({mode:'mortgage-invest',income:p.grossMonthlyIncome*12,woz:a.wozValue,mortgageBalance:a.mortgageBalance,rate:a.mortgageRatePct,years:a.mortgageYears,portfolio:a.startPortfolio,savings:a.startSavings,horizon:a.horizonYears,investmentReturn:a.investmentReturnPct});
  c.mortgageInvest={extraMonthly:a.extraMonthly};
  const r=SC.runScenario(c);
  assert.equal(r.valid,true,r.reason||'Mark fixture should calculate');
  assert.ok(Number.isFinite(r.A.mortTax)&&Number.isFinite(r.B.mortTax));
  assert.ok(r.A.mortgage<r.B.mortgage,'extra repayment should reduce the mortgage faster');
  assert.ok(r.B.invest>r.A.invest,'invest strategy should retain more financial assets');
});

test('Daan individual-share Linear vs Annuity does not require invented partner income',()=>{
  const f=fixture('P02-daan-linear-annuity'),a=f.assumptions,p=f.facts;
  const c=nonPurchaseBase({mode:'linear-annuity',income:p.grossMonthlyIncome*12,woz:a.wozValue,mortgageBalance:a.mortgageBalance,rate:a.mortgageRatePct,years:a.mortgageYears,portfolio:a.startPortfolio,savings:a.startSavings,horizon:a.horizonYears,investmentReturn:a.investmentReturnPct});
  const r=SC.runScenario(c);
  assert.equal(r.valid,true,r.reason||'Daan method fixture should calculate');
  assert.ok(r.A.mortgage<r.B.mortgage,'linear should amortise faster than annuity at a positive rate');
  assert.ok(Number.isFinite(r.A.net)&&Number.isFinite(r.B.net));
});

test('Daan individual-share Keep vs Sell + Rent retains explicit sale and rent economics',()=>{
  const f=fixture('P02-daan-sell-rent'),a=f.assumptions,p=f.facts;
  const c=nonPurchaseBase({mode:'sell-rent',income:p.grossMonthlyIncome*12,woz:a.wozValue,mortgageBalance:a.mortgageBalance,rate:a.mortgageRatePct,years:a.mortgageYears,portfolio:a.startPortfolio,savings:a.startSavings,horizon:a.horizonYears,investmentReturn:a.investmentReturnPct});
  c.homeGrowthPct=a.homeGrowthPct;c.rentGrowthPct=a.rentGrowthPct;c.sellingCostPct=a.sellingCostPct;c.ownerCostTotalMonthly=a.ownerCostMonthly;
  c.sellRent={homeValue:a.homeValue,monthlyRent:a.alternativeRentMonthly,wozValue:a.wozValue};
  const r=SC.runScenario(c);
  assert.equal(r.valid,true,r.reason||'Daan sell/rent fixture should calculate');
  assert.ok(r.B.rent>0,'sell-and-rent path must actually pay rent');
  assert.ok(r.B.selling>0,'sell-and-rent path must include selling costs');
  assert.ok(Number.isFinite(r.A.net)&&Number.isFinite(r.B.net));
});

test('Lotte ZZP Buy vs Rent works only with an explicit manual tax-effect assumption in the fixture',()=>{
  const f=fixture('P10-lotte-buy-rent-manual-tax'),a=f.assumptions,p=f.facts;
  const c=buyRentConfig({age:p.age,income:p.grossMonthlyIncome*12,price:a.existingHomePrice,cash:a.startSavings,portfolio:a.startPortfolio,baseCosts:a.basePurchaseCosts,downPayment:a.downPayment,rent:p.housingCostMonthly,rate:a.mortgageRatePct,woz:a.wozValue,manualRate:a.manualTaxEffectRate,owner:a.ownerCostMonthly,horizon:a.horizonYears,investmentReturn:a.investmentReturnPct});
  const r=SC.runScenario(c);
  assert.equal(c.tax.calculationMode,'manual-rate');
  assert.equal(r.valid,true,r.reason||'Lotte manual-tax fixture should calculate');
  assert.ok(Number.isFinite(r.A.net)&&Number.isFinite(r.B.net));
});

test('AOW, fiscal-partner and incomplete-household personas remain explicit acceptance boundaries',()=>{
  const source=fs.readFileSync(path.join(ROOT,'box1-2026-ui.js'),'utf8');
  assert.match(source,/below AOW age/i,'AOW scope boundary must be visible');
  assert.match(source,/ordinary employment income/i,'employment-only automatic profile must be visible');
  assert.match(source,/complex fiscal-partner allocation/i,'fiscal-partner boundary must be visible');
  for(const id of ['P09-hendrik-aow-boundary','P04-willem-fiscal-partner-boundary','P17-priya-missing-spouse-income','P18-rebecca-household-normalization']){
    assert.equal(fixture(id).executable,false,`${id} must not be forced through an authoritative automatic calculation`);
  }
});

test('a persona asking for a new-build purchase is blocked instead of receiving existing-home NHG/tax rules',()=>{
  const f=fixture('P01-sanne-buy-rent'),a=f.assumptions,p=f.facts;
  const c=buyRentConfig({age:p.age,income:p.grossMonthlyIncome*12,price:a.existingHomePrice,cash:a.startSavings,portfolio:a.startPortfolio,baseCosts:a.basePurchaseCosts,downPayment:a.downPayment,rent:p.housingCostMonthly,rate:a.mortgageRatePct,woz:a.wozValue,nhgMode:a.nhgMode,nhgStack:a.nhgNonEnergyCostStack,owner:a.ownerCostMonthly,horizon:a.horizonYears,investmentReturn:a.investmentReturnPct});
  c.purchaseRules.purchaseType='new-build';
  const r=SC.runScenario(c);
  assert.equal(r.valid,false);
  assert.match(r.reason,/existing homes only|new-build/i);
});
