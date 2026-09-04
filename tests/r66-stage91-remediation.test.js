const test=require('node:test');
const assert=require('node:assert/strict');
const S91=require('../stage9-1-remediation.js');
const SC=require('../scenario-engine.js');

function basePurchase(overrides={}){
  return{
    mode:'buy-rent',horizonYears:2,startYear:2026,startMonth:1,investmentReturnPct:5,startPortfolio:25000,commonMonthlyInvestment:400,
    tax:{enabled:true,deductionRate:.3756,wozValue:400000,hraRemainingMonths:360,qualifyingInterestFraction:1},
    box3:{mode:'current',taxPartners:1,paySource:'savings',currentTaxRate:.36,currentAllowance:59357,currentNotional:.06,currentSavingsNotional:.0128,currentDebtNotional:.027,currentDebtThreshold:3800,firstJan1Portfolio:0,firstJan1Savings:null,firstJan1Debt:null,savings:150000,debt:0,savingsReturnPct:2,debtInterestPct:4,debtMonthlyRepayment:0,debtRepaymentSource:'external',debtFallbackDestination:'invest',futureStart:2028,futureTaxRate:.36,futureExempt:1800,futureLossThreshold:500},
    purchaseRules:{enabled:true,transferTaxMode:'main',manualTransferTax:0,appraisedValue:400000,nhgMode:'none',buyerAge:35,starterMainResidence:true,starterExemptionUnused:true,qualifyingEnergyExpenditure:0,hraRemainingMonths:360,qualifyingInterestFraction:1},
    upfrontCashTreatment:'invest',homeGrowthPct:2,rentGrowthPct:2.5,sellingCostPct:2,ownerCostMode:'total',ownerCostTotalMonthly:450,vveMonthly:0,maintenanceAnnual:0,ownerTaxesAnnual:0,insuranceAnnual:0,groundLeaseAnnual:0,ownerCostGrowthPct:2,
    buyRent:{price:400000,purchaseCosts:8000,downPayment:80000,monthlyRent:1600,mortgageRatePct:4,mortgageYears:30,mortgageType:'annuity',wozValue:400000},
    ...overrides
  };
}

test('NHG enhanced limit requires sufficient qualifying energy spend',()=>{
  const bad=S91.nhg2026({purchasePrice:480000,appraisedValue:480000,mortgageAmount:480000,mode:'energy',qualifyingEnergyExpenditure:5000});
  const good=S91.nhg2026({purchasePrice:480000,appraisedValue:480000,mortgageAmount:480000,mode:'energy',qualifyingEnergyExpenditure:10000});
  assert.equal(bad.eligible,false);
  assert.equal(bad.requiredEnergyExpenditure,10000);
  assert.equal(good.eligible,true);
});

test('purchase appraisal gap must be explicitly funded',()=>{
  const result=S91.calculateScenarioPurchase2026({housePrice:400000,appraisedValue:380000,downPayment:10000,availableSavings:100000,baseCosts:0,transferTaxMode:'main',nhgMode:'none'});
  assert.equal(result.valid,false);
  assert.ok(result.errors.some(x=>x.code==='appraisal-gap-unfunded'));
});

test('purchase HRA uses qualifying debt percentage instead of assuming 100%',()=>{
  const full=SC.runScenario(basePurchase());
  const half=SC.runScenario(basePurchase({purchaseRules:{...basePurchase().purchaseRules,qualifyingInterestFraction:.5}}));
  assert.equal(full.valid,true);
  assert.equal(half.valid,true);
  assert.ok(full.A.mortTax>half.A.mortTax);
});

test('purchase HRA respects remaining deduction years',()=>{
  const long=SC.runScenario(basePurchase());
  const short=SC.runScenario(basePurchase({purchaseRules:{...basePurchase().purchaseRules,hraRemainingMonths:12}}));
  assert.equal(long.valid,true);
  assert.equal(short.valid,true);
  assert.ok(long.A.mortTax>short.A.mortTax);
});

test('non-main residence purchase receives no Box 1 mortgage relief',()=>{
  const c=basePurchase();
  c.purchaseRules={...c.purchaseRules,transferTaxMode:'other-home',hraRemainingMonths:null,qualifyingInterestFraction:null};
  c.buyRent={...c.buyRent,downPayment:110000};
  const result=SC.runScenario(c);
  assert.equal(result.valid,true);
  assert.equal(result.A.mortTax,0);
});

test('non-main residence property and mortgage debt are represented in Box 3 tax ledger',()=>{
  const args={initialPortfolio:100000,flows:Array(12).fill(0),annualReturnPct:0,startYear:2026,startMonth:1,box3Mode:'current',taxPartners:1,paySource:'savings',currentTaxRate:.36,currentAllowance:59357,currentNotional:.06,currentSavingsNotional:.0128,currentDebtNotional:.027,currentDebtThreshold:3800,firstJan1Portfolio:100000,box3Savings:100000,box3Debt:0,firstJan1Savings:100000,firstJan1Debt:0,savingsReturnPct:0,debtInterestPct:0,box3DebtMonthlyRepayment:0,debtRepaymentSource:'external',box3DebtFallbackDestination:'invest',futureStart:2028,futureTaxRate:.36,futureExempt:1800,futureLossThreshold:500};
  const noProperty=S91.simulateInvestmentFlowsStage91(args,{});
  const property=S91.simulateInvestmentFlowsStage91(args,{startValue:300000,growthPct:0,startDebt:200000,debtRows:Array(12).fill(0).map(()=>({interest:600,balance:200000}))});
  assert.equal(property.nonMainPropertyBox3,true);
  assert.equal(property.yearBuckets[2026].box3OtherPropertyValue,300000);
  assert.equal(property.yearBuckets[2026].box3PropertyDebt,200000);
  assert.notEqual(property.totalTax,noProperty.totalTax);
});

test('common monthly investing changes scenario wealth under the same decision inputs',()=>{
  const zero=SC.runScenario(basePurchase({commonMonthlyInvestment:0}));
  const monthly=SC.runScenario(basePurchase({commonMonthlyInvestment:500}));
  assert.equal(zero.valid,true);assert.equal(monthly.valid,true);
  assert.ok(monthly.A.financial>zero.A.financial);
  assert.ok(monthly.B.financial>zero.B.financial);
});

test('Box 3 debt fallback destination is honored',()=>{
  const base={initialPortfolio:0,flows:Array(6).fill(0),annualReturnPct:0,startYear:2026,startMonth:1,box3Mode:'none',taxPartners:1,paySource:'savings',box3Savings:0,box3Debt:500,savingsReturnPct:0,debtInterestPct:0,box3DebtMonthlyRepayment:500,debtRepaymentSource:'external'};
  const invest=S91.simulateInvestmentFlowsStage91({...base,box3DebtFallbackDestination:'invest'},{});
  const save=S91.simulateInvestmentFlowsStage91({...base,box3DebtFallbackDestination:'savings'},{});
  const consume=S91.simulateInvestmentFlowsStage91({...base,box3DebtFallbackDestination:'consume'},{});
  assert.ok(invest.portfolio>0);assert.equal(invest.savings,0);
  assert.ok(save.savings>0);assert.equal(save.portfolio,0);
  assert.equal(consume.portfolio,0);assert.equal(consume.savings,0);
});

test('Next Euro scans all crossings, not only endpoint sign',()=>{
  const report=S91.findAllBreakEvenReturns({mortgage:{balance:100000},mortgageInvest:{extraMonthly:500}},{amount:500,minRate:0,maxRate:7,scanStep:.25,wealthTolerance:.000001,evaluate:r=>({difference:(r-1)*(r-5),leader:'tie'})});
  assert.equal(report.valid,true);
  assert.equal(report.crossings.length,2);
  assert.ok(Math.abs(report.crossings[0].rate-1)<.001);
  assert.ok(Math.abs(report.crossings[1].rate-5)<.001);
  assert.equal(report.leaderRanges.length,3);
});
