'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const OI=require('../output-integrity.js');
const FC=require('../finance-core.js');

const ROOT=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');

function result(overrides={}){
  return{
    portfolio:80000,
    savings:48000,
    box3Debt:5000,
    netFinancialAssets:123000,
    householdComparableWealth:121500,
    mort:210000,
    invested:70000,
    box3Tax:10000,
    unsettledTaxEstimate:500,
    externalTax:0,
    taxPaidFromPortfolio:10000,
    taxPaidFromSavings:0,
    externalCashFlowFutureValue:1000,
    lossCarry:0,
    taxAdjustedComparableAvailable:true,
    taxStatus:'unsettled-estimate',
    series:[{year:2026,month:12,portfolio:80000,mort:210000,invested:70000}],
    yearBuckets:{2026:{year:2026,regime:'current',settled:true,endBeforeTax:90000,box3Tax:10000,endAfterTax:80000}},
    ...overrides
  };
}

function before(overrides={}){
  return result({
    portfolio:100000,
    savings:50000,
    netFinancialAssets:145000,
    householdComparableWealth:144000,
    box3Tax:0,
    unsettledTaxEstimate:0,
    externalTax:0,
    taxPaidFromPortfolio:0,
    externalCashFlowFutureValue:1000,
    taxStatus:'settled',
    series:[{year:2026,month:12,portfolio:100000,mort:210000,invested:70000}],
    yearBuckets:{2026:{year:2026,regime:'none',settled:true,endBeforeTax:100000,box3Tax:0,endAfterTax:100000}},
    ...overrides
  });
}

function productionConfig(box3Mode,box3PaySource){
  return{
    phases:[{years:3,monthlyInvest:500,mortgageExtra:0,mortgageFreq:'monthly',annualBonus:0,bonusDest:'invest'}],
    startYear:2026,startMonth:1,startPortfolio:200000,annualReturnPct:5,bonusMonth:12,
    mortBalance:0,mortRatePct:0,mortYears:30,mortType:'annuity',mortTaxEnabled:false,
    box3Mode,box3PaySource,taxPartners:1,currentTaxRate:.36,currentAllowance:0,currentNotional:.06,
    currentSavingsNotional:.0128,currentDebtNotional:.027,currentDebtThreshold:3800,firstJan1Portfolio:200000,
    box3Savings:50000,box3Debt:0,savingsReturnPct:2,debtInterestPct:4
  };
}

function productionPlan(box3Mode,box3PaySource){return FC.simulatePlan(productionConfig(box3Mode,box3PaySource));}

test('canonical plan result keeps before-Box-3 and after-Box-3 balances distinct',()=>{
  const canonical=OI.canonicalPlanResult(result(),before(),{box3Mode:'current',box3PaySource:'portfolio',annualReturnPct:5});
  assert.equal(canonical.kind,OI.CANONICAL_KINDS.plan);
  assert.equal(canonical.results.portfolioBeforeBox3,100000);
  assert.equal(canonical.results.portfolioAfterBox3,80000);
  assert.equal(canonical.results.savingsBeforeBox3,50000);
  assert.equal(canonical.results.savingsAfterBox3,48000);
  assert.equal(canonical.results.comparableWealthBeforeBox3,144000);
  assert.equal(canonical.results.comparableWealthAfterBox3,121500);
  assert.notEqual(canonical.results.portfolioBeforeBox3,canonical.results.portfolioAfterBox3);
});

test('equal before and after portfolio values remain legitimate when Box 3 is paid externally',()=>{
  const selected=result({portfolio:100000,savings:50000,netFinancialAssets:145000,householdComparableWealth:132000,externalTax:10000,taxPaidFromPortfolio:0,externalCashFlowFutureValue:12500});
  const canonical=OI.canonicalPlanResult(selected,before(),{box3Mode:'current',box3PaySource:'external',annualReturnPct:5});
  assert.equal(canonical.results.portfolioBeforeBox3,canonical.results.portfolioAfterBox3);
  assert.equal(canonical.results.externalBox3Tax,10000);
  assert.equal(canonical.results.externalCashFlowFutureValue,12500);
  assert.equal(canonical.results.comparableWealthAfterBox3,132000);
});

test('production payment sources map to the correct canonical balance',()=>{
  const untaxed=productionPlan('none','external');
  const portfolio=OI.canonicalPlanResult(productionPlan('current','portfolio'),untaxed,{box3Mode:'current',box3PaySource:'portfolio',annualReturnPct:5});
  const savings=OI.canonicalPlanResult(productionPlan('current','savings'),untaxed,{box3Mode:'current',box3PaySource:'savings',annualReturnPct:5});
  const external=OI.canonicalPlanResult(productionPlan('current','external'),untaxed,{box3Mode:'current',box3PaySource:'external',annualReturnPct:5});
  assert.ok(portfolio.results.portfolioAfterBox3<portfolio.results.portfolioBeforeBox3);
  assert.equal(savings.results.portfolioAfterBox3,savings.results.portfolioBeforeBox3);
  assert.ok(savings.results.savingsAfterBox3<savings.results.savingsBeforeBox3);
  assert.equal(external.results.portfolioAfterBox3,external.results.portfolioBeforeBox3);
  assert.equal(external.results.savingsAfterBox3,external.results.savingsBeforeBox3);
  assert.ok(external.results.externalCashFlowFutureValue>external.results.externalBox3Tax);
});

test('canonical FinanceCore decoration preserves every selected-plan economic output',()=>{
  delete require.cache[require.resolve('../finance-core.js')];
  const core=require('../finance-core.js');
  const config=productionConfig('current','portfolio');
  const baseline=core.simulatePlan(config);
  OI.decorateFinanceCore(core);
  const enriched=core.simulatePlan({...config,canonicalOutput:true});
  for(const key of ['portfolio','savings','box3Debt','netFinancialAssets','householdComparableWealth','mort','invested','box3Tax','unsettledTaxEstimate','externalTax','externalCashFlowFutureValue']){
    assert.equal(enriched[key],baseline[key],`${key} changed while attaching canonical output`);
  }
  assert.equal(enriched.canonicalResult.kind,OI.CANONICAL_KINDS.plan);
  assert.equal(enriched.canonicalResult.results.portfolioAfterBox3,baseline.portfolio);
});

test('canonical output and CSV consume the same explicit fields',()=>{
  const canonical=OI.canonicalPlanResult(result(),before(),{box3Mode:'current',box3PaySource:'portfolio',annualReturnPct:5});
  const model=OI.outputModel(canonical);
  assert.equal(model.beforeTaxValue,'€100.000');
  assert.equal(model.afterTaxValue,'€80.000');
  assert.equal(model.headlineValue,model.afterTaxValue);
  const csv=OI.outputCsv(model);
  assert.match(csv,/Results,Portfolio before Box 3 \(EUR\),100000\.00/);
  assert.match(csv,/Results,Portfolio after settled Box 3 \(EUR\),80000\.00/);
  assert.match(csv,/Results,Box 3 tax paid from portfolio \(EUR\),10000\.00/);
  assert.doesNotMatch(csv,/Portfolio before Box 3 \(EUR\),80000\.00/);
});

test('unavailable tax result exposes only the canonical before-Box-3 projection',()=>{
  const blocked=result({
    portfolio:100000,
    savings:50000,
    netFinancialAssets:145000,
    householdComparableWealth:null,
    box3Tax:null,
    unsettledTaxEstimate:null,
    taxAdjustedComparableAvailable:false,
    taxStatus:'missing-jan1-snapshot',
    taxBlockReason:'Enter the complete 1 January snapshot.'
  });
  const canonical=OI.canonicalPlanResult(blocked,before(),{box3Mode:'current',box3PaySource:'savings'});
  const model=OI.outputModel(canonical);
  assert.equal(canonical.results.portfolioBeforeBox3,100000);
  assert.equal(canonical.results.portfolioAfterBox3,null);
  assert.equal(model.headlineValue,'€100.000');
  assert.equal(model.afterTaxValue,'Unavailable');
  assert.match(OI.outputCsv(model),/Results,Portfolio after settled Box 3 \(EUR\),\r?\n/);
});

test('scenario conclusion puts assumption dependence before the outcome',()=>{
  const canonical=OI.canonicalComparisonResult({valid:true,A:{name:'Buy home',net:610000},B:{name:'Rent + invest',net:590000},sourcesAndUses:{A:{totalUses:500000,totalSources:500000},B:null}},{mode:'buy-rent',years:15,returnPct:5,budgetGap:0});
  const model=OI.comparisonOutputModel(canonical);
  assert.match(model.title,/^Under the entered assumptions,/);
  assert.match(model.title,/Buy home has €20\.000 more modeled wealth after 15 years\./);
  assert.doesNotMatch(model.title,/wins?|leads?|clearly ahead/i);
  assert.deepEqual(model.exportRows.find(row=>row[1]==='Comparison type'),['Decision comparison','Comparison type','buy-rent']);
  assert.equal(canonical.sourcesAndUses.A.totalUses,canonical.sourcesAndUses.A.totalSources);
});

test('Next Euro output labels the higher modeled result without calling it a winner',()=>{
  const canonical=OI.canonicalNextEuroResult({
    main:{valid:true,breakEven:4.25},
    amount:500,
    years:10,
    assumedReturnPct:5,
    difference:12500,
    selected:{leader:'invest'},
    quick:[{amount:250,valid:true,breakEven:4.1,difference:6000,current:{leader:'invest'}}]
  });
  const model=OI.nextEuroOutputModel(canonical);
  assert.equal(model.choiceValue,'Invest');
  assert.match(model.choiceSub,/Under the entered 5/);
  assert.doesNotMatch(`${model.choiceValue} ${model.choiceSub}`,/winner/i);
  assert.deepEqual(model.exportRows.find(row=>row[1]==='Break-even status'),['Next Euro','Break-even status','found']);
  assert.deepEqual(canonical.quick[0],{
    amount:250,valid:true,breakEvenReturnPct:4.1,breakEvenStatus:'found',difference:6000,absoluteDifference:6000,outcome:'invest'
  });
});

test('browser routes result surfaces through the Stage 6 canonical contract',()=>{
  const app=read('app.js');
  const scenario=read('scenario-engine.js');
  const next=read('next-euro.js');
  const state=read('app-state.js');
  const density=read('view-density.js');
  const output=read('output-integrity.js');
  assert.match(app,/canonicalOutput:Boolean\(canonicalScope\)/);
  assert.doesNotMatch(app,/const noTax=simulate/);
  assert.match(scenario,/canonicalComparisonResult/);
  assert.match(scenario,/rows\.push\(\{r,canonical:x\}\)/);
  assert.match(next,/canonicalNextEuroResult/);
  assert.match(density,/canonicalExportRows/);
  assert.doesNotMatch(scenario,/leads by|clearly ahead/i);
  assert.doesNotMatch(state,/Why can Annuity win|The winner is based/i);
  assert.doesNotMatch(output,/stay flat in nominal euros/i);
});
