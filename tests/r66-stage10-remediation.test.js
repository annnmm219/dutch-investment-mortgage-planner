'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const FC=require('../finance-core.js');
require('../box1-2026.js');
const SC=require('../scenario-engine.js');
const S10=require('../stage10-remediation.js');

function purchaseConfig(overrides={}){
  const base={
    mode:'buy-rent',horizonYears:1,startYear:2026,startMonth:1,investmentReturnPct:0,startPortfolio:25000,commonMonthlyInvestment:0,
    tax:{enabled:true,calculationMode:'box1-2026',box1IncomeBeforeOwnHome:70000,wozValue:400000,hraRemainingMonths:360,qualifyingInterestFraction:1},
    box3:{mode:'current',taxPartners:1,paySource:'savings',currentTaxRate:.36,currentAllowance:59357,currentNotional:.06,currentSavingsNotional:.0128,currentDebtNotional:.027,currentDebtThreshold:3800,firstJan1Portfolio:25000,firstJan1Savings:180000,firstJan1Debt:0,savings:180000,debt:0,savingsReturnPct:0,debtInterestPct:0,debtMonthlyRepayment:0,debtRepaymentSource:'external',debtFallbackDestination:'invest',futureStart:2028,futureTaxRate:.36,futureExempt:1800,futureLossThreshold:500},
    purchaseRules:{enabled:true,propertyUse:'main-residence',transferTaxMode:'main',manualTransferTax:0,appraisedValue:400000,nhgMode:'none',buyerAge:35,starterMainResidence:true,starterExemptionUnused:true,qualifyingEnergyExpenditure:0,hraRemainingMonths:360,qualifyingInterestFraction:1,deductibleFinancingCosts:0,nhgNonEnergyCostStack:null,grossRentalIncomeAnnual:0,privateUseDays:0,privateUseWozValue:0,propertyIncomeGrowthPct:0},
    upfrontCashTreatment:'invest',homeGrowthPct:0,rentGrowthPct:0,sellingCostPct:2,ownerCostMode:'itemized',ownerCostTotalMonthly:0,vveMonthly:0,maintenanceAnnual:0,ownerTaxesAnnual:0,insuranceAnnual:0,groundLeaseAnnual:0,ownerCostGrowthPct:0,
    buyRent:{price:400000,purchaseCosts:8000,cash:180000,downPayment:100000,monthlyRent:1600,mortgageRatePct:4,mortgageYears:30,mortgageType:'annuity',wozValue:400000}
  };
  const merged={...base,...overrides};
  if(overrides.tax)merged.tax={...base.tax,...overrides.tax};
  if(overrides.box3)merged.box3={...base.box3,...overrides.box3};
  if(overrides.purchaseRules)merged.purchaseRules={...base.purchaseRules,...overrides.purchaseRules};
  if(overrides.buyRent)merged.buyRent={...base.buyRent,...overrides.buyRent};
  return merged;
}

test('F-03 exact NHG rejects energy route when non-energy a-g cost stack exceeds €470,000',()=>{
  const x=S10.nhg2026Exact({purchasePrice:465000,appraisedValue:465000,mortgageAmount:450000,mode:'energy',qualifyingEnergyExpenditure:20000,nonEnergyCostStack:470001});
  assert.equal(x.eligible,false);
  assert.equal(x.eligibleByNonEnergyCost,false);
  assert.match(x.warning,/non-energy cost stack/i);
});

test('F-03 exact NHG accepts only when both a-g and a-h caps plus loan caps pass',()=>{
  const x=S10.nhg2026Exact({purchasePrice:460000,appraisedValue:460000,mortgageAmount:380000,mode:'energy',qualifyingEnergyExpenditure:20000,nonEnergyCostStack:460000});
  assert.equal(x.eligible,true);
  assert.equal(x.totalCostStack,480000);
  assert.equal(x.nonEnergyLoan,360000);
  assert.equal(x.fee,380000*.004);
});

test('F-03 Scenario engine receives Stage 10 energy and a-g inputs end to end',()=>{
  const c=purchaseConfig({
    buyRent:{price:460000,purchaseCosts:8000,cash:220000,downPayment:100000,wozValue:460000},
    box3:{savings:220000,firstJan1Savings:220000},
    purchaseRules:{appraisedValue:460000,nhgMode:'energy',qualifyingEnergyExpenditure:20000,nhgNonEnergyCostStack:460000}
  });
  const r=SC.runScenario(c);
  assert.equal(r.valid,true,r.reason||'energy purchase should be valid');
  assert.equal(r.sourcesAndUses.A.nhg.eligible,true);
  assert.equal(r.sourcesAndUses.A.qualifyingEnergyExpenditure,20000);
  assert.equal(r.sourcesAndUses.A.nhg.nonEnergyCostStack,460000);
});

test('F-04 manual transfer tax is independent from property income-tax classification',()=>{
  assert.equal(S10.inferredPropertyUse({transferTaxMode:'manual'}),null);
  assert.equal(S10.propertyTransferTaxAlignment('non-main','manual').valid,true);
  assert.equal(S10.propertyTransferTaxAlignment('main-residence','manual').valid,true);
  const c=purchaseConfig({
    box3:{mode:'none'},
    purchaseRules:{propertyUse:'non-main',transferTaxMode:'manual',manualTransferTax:20000,starterMainResidence:false,grossRentalIncomeAnnual:0,privateUseDays:0}
  });
  const r=SC.runScenario(c);
  assert.equal(r.valid,true,r.reason||'manual non-main purchase should remain valid when Box 3 is disabled');
  assert.equal(r.A.mortTax,0,'manual transfer tax must not imply Box 1 own-home treatment');
});

test('F-01 current Box 3 actual return includes gross rent and 2026 5.06% private-use addition',()=>{
  const zero=purchaseConfig({
    purchaseRules:{propertyUse:'non-main',transferTaxMode:'other-home',starterMainResidence:false,grossRentalIncomeAnnual:0,privateUseDays:0,privateUseWozValue:400000},
    buyRent:{downPayment:140000},
    box3:{mode:'current',savings:180000,firstJan1Savings:180000}
  });
  const direct=purchaseConfig({
    purchaseRules:{propertyUse:'non-main',transferTaxMode:'other-home',starterMainResidence:false,grossRentalIncomeAnnual:12000,privateUseDays:365,privateUseWozValue:400000,propertyIncomeGrowthPct:0},
    buyRent:{downPayment:140000},
    box3:{mode:'current',savings:180000,firstJan1Savings:180000}
  });
  const a=SC.runScenario(zero),b=SC.runScenario(direct);
  assert.equal(a.valid,true,a.reason||'baseline non-main scenario invalid');
  assert.equal(b.valid,true,b.reason||'direct-return non-main scenario invalid');
  const ay=a.stage91Ledgers[0].yearBuckets[2026],by=b.stage91Ledgers[0].yearBuckets[2026];
  const baseActual=ay.marketGain+ay.propertyGain+ay.savingsIncome-ay.debtInterest-ay.propertyDebtInterest;
  const directReturn=12000+400000*.0506;
  const expectedZeroTax=Math.max(0,baseActual)*.36;
  const expectedDirectTax=Math.max(0,baseActual+directReturn)*.36;
  assert.ok(Math.abs(ay.actualTax-expectedZeroTax)<.01,`baseline actual tax mismatch: ${ay.actualTax} vs ${expectedZeroTax}`);
  assert.ok(Math.abs(by.actualTax-expectedDirectTax)<.01,`actual tax must include full rent + own-use addition before zero floor: ${by.actualTax} vs ${expectedDirectTax}`);
  assert.ok(b.A.invest>a.A.invest,'received rent should remain a real cash inflow, not tax-only income');
});

test('F-02 proposed or transition Box 3 is blocked for non-main property until real-estate branch is implemented',()=>{
  for(const mode of ['future','transition']){
    const c=purchaseConfig({box3:{mode},purchaseRules:{propertyUse:'non-main',transferTaxMode:'other-home',starterMainResidence:false,grossRentalIncomeAnnual:0,privateUseDays:0}});
    const r=SC.runScenario(c);
    assert.equal(r.valid,false);
    assert.match(r.reason,/real-estate-specific|non-main-property.*unavailable|proposed\/transition/i);
  }
});

test('F-05 itemized periodic erfpacht and explicit financing costs increase main-home Box 1 relief',()=>{
  const plain=purchaseConfig({box3:{mode:'none'},groundLeaseAnnual:0,purchaseRules:{deductibleFinancingCosts:0}});
  const deductible=purchaseConfig({box3:{mode:'none'},groundLeaseAnnual:1200,purchaseRules:{deductibleFinancingCosts:2000}});
  const a=SC.runScenario(plain),b=SC.runScenario(deductible);
  assert.equal(a.valid,true,a.reason||'plain main-home scenario invalid');
  assert.equal(b.valid,true,b.reason||'deductible-cost scenario invalid');
  assert.ok(b.A.mortTax>a.A.mortTax,`expected larger Box 1 benefit: ${b.A.mortTax} vs ${a.A.mortTax}`);
  const yearly=S10.additionalDeductibleCostsByYear(deductible,12,0);
  assert.ok(Math.abs(yearly[2026]-3200)<.01,`2026 additional deductible costs should be €3,200, got ${yearly[2026]}`);
});

test('F-05 hidden/non-itemized ground-lease value is not silently deducted',()=>{
  const c=purchaseConfig({ownerCostMode:'total',ownerCostTotalMonthly:500,groundLeaseAnnual:1200,box3:{mode:'none'}});
  const yearly=S10.additionalDeductibleCostsByYear(c,12,0);
  assert.equal(Number(yearly[2026]||0),0);
});

test('F-06 release evidence carries immutable calculation source commit and build id',()=>{
  const sha='a'.repeat(40),id={calculationSourceSha:sha,buildId:'R6.6-stage10-aaaaaaaa'};
  assert.deepEqual(S10.releaseIdentity(id),{valid:true,calculationSourceSha:sha,buildId:'R6.6-stage10-aaaaaaaa',status:'frozen'});
  const rows=S10.releaseIdentityRows(id);
  assert.deepEqual(rows,[['Model','Calculation source commit',sha],['Model','Build identity','R6.6-stage10-aaaaaaaa']]);
});

test('F-06 unfrozen evidence is explicit rather than impersonating a release candidate',()=>{
  const rows=S10.releaseIdentityRows({});
  assert.equal(rows[0][2],'UNFROZEN');
  assert.equal(rows[1][2],'UNFROZEN');
});
