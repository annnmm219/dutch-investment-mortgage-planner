'use strict';

const childProcess=require('node:child_process');
const path=require('node:path');

const baselineRoot=process.argv[2]?path.resolve(process.argv[2]):null;
const candidateRoot=path.resolve(process.argv[3]||path.join(__dirname,'../..'));
if(!baselineRoot)throw new Error('Usage: node audits/r6.6/capture-stage6-results.js <stage5-root> [stage6-root]');

const captureScript=path.join(candidateRoot,'audits/r6.6/capture-stage5-results.js');
const capture=(root,label)=>JSON.parse(childProcess.execFileSync(process.execPath,[captureScript,root,label],{encoding:'utf8'}));
const baseline=capture(baselineRoot,'stage5');
const candidate=capture(candidateRoot,'stage6');

const scenarioFields=['differenceAminusB'];
const strategyFields=[
  'net','invest','savings','box3Debt','equity','mortgage','owner','interest','mortTax','purchase','selling',
  'externalTax','externalDebtRepayment','box3DebtInterest','externalCashFlowFutureValue'
];
const changedScenarioIds=[];
const changedFields=new Set();
let leaderChanges=0;

baseline.scenarios.forEach((before,index)=>{
  const after=candidate.scenarios[index];
  if(!after||before.id!==after.id)throw new Error(`Scenario matrix mismatch at row ${index+1}`);
  let changed=false;
  scenarioFields.forEach(field=>{
    if(before[field]!==after[field]){changed=true;changedFields.add(field);}
  });
  ['strategyA','strategyB'].forEach(side=>strategyFields.forEach(field=>{
    if(before[side][field]!==after[side][field]){changed=true;changedFields.add(`${side}.${field}`);}
  }));
  if(changed)changedScenarioIds.push(before.id);
  if(before.leader!==after.leader)leaderChanges++;
});

const OI=require(path.join(candidateRoot,'output-integrity.js'));
const FC=require(path.join(candidateRoot,'finance-core.js'));

const productionConfig={
  phases:[{years:3,monthlyInvest:500,mortgageExtra:0,mortgageFreq:'monthly',annualBonus:0,bonusDest:'invest'}],
  startYear:2026,startMonth:1,startPortfolio:200000,annualReturnPct:5,bonusMonth:12,
  mortBalance:0,mortRatePct:0,mortYears:30,mortType:'annuity',mortTaxEnabled:false,
  box3Mode:'current',box3PaySource:'portfolio',taxPartners:1,currentTaxRate:.36,currentAllowance:0,currentNotional:.06,
  currentSavingsNotional:.0128,currentDebtNotional:.027,currentDebtThreshold:3800,firstJan1Portfolio:200000,
  box3Savings:50000,box3Debt:0,savingsReturnPct:2,debtInterestPct:4
};
const selectedBeforeDecoration=FC.simulatePlan(productionConfig);
OI.decorateFinanceCore(FC);
const portfolio=FC.simulatePlan({...productionConfig,canonicalOutput:true});
const savings=FC.simulatePlan({...productionConfig,box3PaySource:'savings',canonicalOutput:true});
const external=FC.simulatePlan({...productionConfig,box3PaySource:'external',canonicalOutput:true});

const selectedFields=[
  'portfolio','savings','box3Debt','netFinancialAssets','householdComparableWealth','mort','invested','box3Tax',
  'unsettledTaxEstimate','externalTax','externalCashFlowFutureValue','grossInterest','mortTax','netInterest'
];
const selectedFieldChanges=selectedFields.filter(field=>selectedBeforeDecoration[field]!==portfolio[field]);
const p=portfolio.canonicalResult.results,s=savings.canonicalResult.results,e=external.canonicalResult.results;
const exportRows=new Map(OI.planExportRows(portfolio.canonicalResult).map(row=>[row[1],row[2]]));

const comparison=OI.canonicalComparisonResult({
  valid:true,A:{name:'Buy home',net:610000},B:{name:'Rent + invest',net:590000}
},{mode:'buy-rent',years:15,returnPct:5});
const comparisonOutput=OI.comparisonOutputModel(comparison);
const nextEuro=OI.canonicalNextEuroResult({
  main:{valid:true,breakEven:4.25},amount:500,years:10,assumedReturnPct:5,difference:12500,
  selected:{leader:'invest'},quick:[]
});
const nextEuroOutput=OI.nextEuroOutputModel(nextEuro);

const checks={
  matrixOrderComplete:baseline.scenarios.length===50&&candidate.scenarios.length===50,
  allCandidateScenariosValid:candidate.scenarios.every(row=>row.valid),
  noEconomicOutputChanges:changedScenarioIds.length===0,
  noLeaderChanges:leaderChanges===0,
  selectedPlanPreserved:selectedFieldChanges.length===0,
  portfolioSourceReducesPortfolio:p.portfolioAfterBox3<p.portfolioBeforeBox3,
  savingsSourcePreservesPortfolio:s.portfolioAfterBox3===s.portfolioBeforeBox3,
  savingsSourceReducesSavings:s.savingsAfterBox3<s.savingsBeforeBox3,
  externalSourcePreservesPortfolio:e.portfolioAfterBox3===e.portfolioBeforeBox3,
  externalSourcePreservesSavings:e.savingsAfterBox3===e.savingsBeforeBox3,
  externalSourceRecordsOpportunityCost:e.externalCashFlowFutureValue>e.externalBox3Tax,
  exportBeforeMatchesCanonical:exportRows.get('Portfolio before Box 3 (EUR)')===OI.formatExportNumber(p.portfolioBeforeBox3),
  exportAfterMatchesCanonical:exportRows.get('Portfolio after settled Box 3 (EUR)')===OI.formatExportNumber(p.portfolioAfterBox3),
  exportBeforeAfterDistinct:exportRows.get('Portfolio before Box 3 (EUR)')!==exportRows.get('Portfolio after settled Box 3 (EUR)'),
  comparisonLanguageAssumptionFirst:comparisonOutput.title.startsWith('Under the entered assumptions,'),
  comparisonLanguageAvoidsWinnerClaims:!/(wins?|leads?|clearly ahead)/i.test(`${comparisonOutput.title} ${comparisonOutput.detail}`),
  nextEuroLanguageAvoidsWinnerClaims:!/winner/i.test(`${nextEuroOutput.choiceValue} ${nextEuroOutput.choiceSub}`)
};
const passed=Object.values(checks).every(Boolean);

process.stdout.write(JSON.stringify({
  stage:'R6.6 Stage 6',
  baseline:{root:baselineRoot,implementation:baseline.implementation},
  candidate:{root:candidateRoot,implementation:candidate.implementation},
  matrix:{
    scenarios:candidate.scenarios.length,
    numericalChanges:changedScenarioIds.length,
    leaderChanges,
    changedScenarioIds,
    changedFields:[...changedFields]
  },
  canonicalProbes:{
    selectedFieldChanges,
    portfolioPayment:{before:p.portfolioBeforeBox3,after:p.portfolioAfterBox3,taxPaidFromPortfolio:p.taxPaidFromPortfolio},
    savingsPayment:{portfolioBefore:s.portfolioBeforeBox3,portfolioAfter:s.portfolioAfterBox3,savingsBefore:s.savingsBeforeBox3,savingsAfter:s.savingsAfterBox3,taxPaidFromSavings:s.taxPaidFromSavings},
    externalPayment:{portfolioBefore:e.portfolioBeforeBox3,portfolioAfter:e.portfolioAfterBox3,savingsBefore:e.savingsBeforeBox3,savingsAfter:e.savingsAfterBox3,externalTax:e.externalBox3Tax,externalCashFlowFutureValue:e.externalCashFlowFutureValue},
    export:{before:exportRows.get('Portfolio before Box 3 (EUR)'),after:exportRows.get('Portfolio after settled Box 3 (EUR)')},
    comparison:{title:comparisonOutput.title,detail:comparisonOutput.detail},
    nextEuro:{choice:nextEuroOutput.choiceValue,detail:nextEuroOutput.choiceSub}
  },
  checks,
  passed
},null,2)+'\n');

if(!passed)process.exitCode=1;
