'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const FC=require('../finance-core.js');
require('../box1-2026.js');
const PR=require('../purchase-rules.js');
const SC=require('../scenario-engine.js');
const S10=require('../stage10-remediation.js');
const State=require('../app-state.js');
const OI=require('../output-integrity.js');

function close(actual,expected,tolerance=1,message=''){
  assert.ok(Math.abs(actual-expected)<=tolerance,`${message} expected ${expected}, got ${actual}`);
}

test('B1 main-home joint buyers with undetermined erfpacht pay 2%',()=>{
  const tab=PR.mortgageTabTransfer({
    housePrice:500000,appraisedValue:500000,transferTaxMode:'main',buying:'one',acquisitionYear:2026,
    yearlyCanon:2000,groundRentPerpetual:'dont-know',
    buyers:[{share:50,age:30,mainHome:true,usedBefore:false},{share:50,age:32,mainHome:true,usedBefore:false}]
  });
  assert.equal(tab.automatic,true);
  assert.equal(Math.round(tab.amount),10000);
  assert.match(tab.line,/standard 2% transfer tax/);
});

test('P1 uses calculated own-use days and ignores a zero private-use field',()=>{
  const profile=S10.secondHomeProfile({
    propertyUsePattern:'own-holiday',privateUseDays:0,daysLet:122,buildingDays:0,
    grossRentalIncomeAnnual:9000,ownedAllCalendarYear:true
  },{startYear:2026,startMonth:1});
  assert.equal(profile.profile,'p1');
  assert.equal(profile.ownUseDays,243);
});

test('rent with 299 own-use days and no pattern is out of scope',()=>{
  const profile=S10.secondHomeProfile({
    grossRentalIncomeAnnual:20000,privateUseDays:299,daysLet:0
  },{startYear:2026,startMonth:1});
  assert.equal(profile.profile,'out-of-scope');
  assert.match(profile.message,/Choose how this second home is used|can't estimate Box 3 tax/);
});

test('the leegwaarderatio note is placed with the verdict, outside details',()=>{
  const src=fs.readFileSync(path.join(__dirname,'..','stage10-remediation.js'),'utf8');
  assert.match(src,/scenarioVerdictNew[\s\S]{0,250}scenarioLeegwaardeNote|scenarioLeegwaardeNote[\s\S]{0,250}afterend/);
  const noteAt=src.indexOf("note.id='scenarioLeegwaardeNote'");
  const foldAt=src.indexOf('scenarioNonMainReturnFields');
  assert.ok(noteAt>0,'leegwaarde note is not created beside the verdict');
  assert.ok(noteAt<foldAt||!src.slice(noteAt,noteAt+400).includes('scenarioNonMainReturnFields'));
});

test('2027 ruling year does not feed a stored taxable figure',()=>{
  const src=fs.readFileSync(path.join(__dirname,'..','app-state.js'),'utf8');
  assert.match(src,/rulingUnavailable==='1'/);
  assert.match(src,/if\(!use\.checked\)/);
  const gated=State.rulingResultGate({startYear:2027,use30Ruling:true,storedTaxable:70000,confirmed:false});
  assert.equal(gated.available,false);
  assert.equal(gated.taxable,null);
  assert.equal(gated.figure,'unavailable');
});

test('a release build with a null patch date fails the stamp check',()=>{
  assert.equal(typeof OI.releaseStampStatus,'function');
  assert.equal(OI.releaseStampStatus({patched:null,releaseBuild:true}).ok,false);
  assert.equal(OI.releaseStampStatus({patched:'2026-11-17',releaseBuild:true}).ok,true);
  assert.equal(OI.releaseStampStatus({patched:null,releaseBuild:false}).ok,true);
  const pkg=require('../package.json');
  assert.match(pkg.scripts['stamp-release']||'','stamp-release');
});

test('Mortgage-tab NHG uses the binding-offer date table',()=>{
  const result=PR.calculatePurchase2026({
    housePrice:485000,appraisedValue:485000,ownSavings:0,baseCosts:0,transferTaxMode:'main',
    nhgMode:'standard',bindingOfferDate:'2027-01-05'
  });
  assert.equal(result.nhg.offerYear,2027);
  assert.equal(result.nhg.limit,500000);
});

test('T2-4 Box 3 on a €400,000 property and a €300,000 debt',()=>{
  const deemed=FC.box3TaxForYear({
    regime:'current',jan1Portfolio:400000,jan1Savings:0,jan1Debt:300000,allowActualRebuttal:false,taxPartners:1
  });
  close(deemed.tax,2466.60,1,'T2-4');
});

test('T3-1 January main-home purchase keeps the pre-purchase savings on 1 January',()=>{
  const run=SC.runScenario({
    mode:'buy-rent',horizonYears:1,startYear:2026,startMonth:1,investmentReturnPct:0,startPortfolio:0,
    mortgage:{balance:0,ratePct:4,years:20},mortgageType:'annuity',
    tax:{enabled:false},
    box3:{mode:'current',taxPartners:1,paySource:'external',savings:150000,debt:0,savingsReturnPct:0,debtInterestPct:0,firstJan1Savings:150000,firstJan1Portfolio:0,firstJan1Debt:0},
    purchaseRules:{enabled:true,propertyUse:'main-residence',transferTaxMode:'main',appraisedValue:200000,nhgMode:'none',hraRemainingMonths:360,qualifyingInterestFraction:1},
    upfrontCashTreatment:'savings',homeGrowthPct:0,rentGrowthPct:0,sellingCostPct:0,ownerCostMode:'total',ownerCostTotalMonthly:0,
    buyRent:{price:200000,purchaseCosts:0,cash:150000,downPayment:110000,monthlyRent:1000,mortgageRatePct:4,mortgageYears:30,mortgageType:'annuity',wozValue:200000}
  });
  assert.equal(run.valid,true,run.reason||'');
  assert.equal(run.A.box3Years[2026].jan1Savings,150000);
  close(run.A.box3,417.68,1,'T3-1');
});

test('T3-2 January main-home sale does not put the proceeds in this year\'s Box 3',()=>{
  const run=SC.runScenario({
    mode:'sell-rent',horizonYears:1,startYear:2026,startMonth:1,investmentReturnPct:0,startPortfolio:0,
    mortgage:{balance:0,ratePct:4,years:20},mortgageType:'annuity',
    tax:{enabled:false},
    box3:{mode:'current',taxPartners:1,paySource:'external',savings:20000,debt:0,savingsReturnPct:0,debtInterestPct:0,firstJan1Savings:20000,firstJan1Portfolio:0,firstJan1Debt:0},
    upfrontCashTreatment:'invest',homeGrowthPct:0,rentGrowthPct:0,sellingCostPct:0,ownerCostMode:'total',ownerCostTotalMonthly:0,
    sellRent:{homeValue:200000,monthlyRent:1000,wozValue:200000}
  });
  assert.equal(run.valid,true,run.reason||'');
  assert.equal(run.B.box3Years[2026].jan1Portfolio,0);
  assert.equal(run.B.box3Years[2026].jan1Savings,20000);
  close(run.B.box3,0,1,'T3-2');
});

test('T3-3 January non-main purchase excludes the new property from this 1 January',()=>{
  const run=SC.runScenario({
    mode:'buy-rent',horizonYears:1,startYear:2026,startMonth:1,investmentReturnPct:0,startPortfolio:0,
    mortgage:{balance:0,ratePct:4,years:20},mortgageType:'annuity',
    tax:{enabled:false},
    box3:{mode:'current',taxPartners:1,paySource:'external',savings:120000,debt:0,savingsReturnPct:0,debtInterestPct:0,firstJan1Savings:120000,firstJan1Portfolio:0,firstJan1Debt:0},
    purchaseRules:{enabled:true,propertyUse:'non-main',propertyUsePattern:'long-term',transferTaxMode:'manual',manualTransferTax:8000,appraisedValue:300000,nhgMode:'none',grossRentalIncomeAnnual:0,privateUseDays:0,hraRemainingMonths:0},
    upfrontCashTreatment:'savings',homeGrowthPct:0,rentGrowthPct:0,sellingCostPct:0,ownerCostMode:'total',ownerCostTotalMonthly:0,
    buyRent:{price:300000,purchaseCosts:2000,cash:120000,downPayment:100000,monthlyRent:1000,mortgageRatePct:4,mortgageYears:30,mortgageType:'annuity',wozValue:300000}
  });
  assert.equal(run.A.box3Years?.[2026]?.jan1Savings,120000);
  close(run.A.box3,279.44,1,'T3-3');
});
