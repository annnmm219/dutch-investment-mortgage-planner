'use strict';

const assert=require('node:assert/strict');
const B1=require('../box1-2026.js');
const {MODES,baseConfig}=require('./verify-50-scenarios.js');
const SC=require('../scenario-engine.js');
B1.decorateScenarioCore(SC);
require('../stage9-1-remediation.js');
const OI=require('../output-integrity.js');

const copy=value=>JSON.parse(JSON.stringify(value));
const leader=result=>Math.abs(result.A.net-result.B.net)<1?'tie':result.A.net>result.B.net?'A':'B';
const changed=(a,b,tolerance=1e-7)=>Math.abs(Number(a)-Number(b))>tolerance;

function stage10Config(raw,index){
  const next=copy(raw);
  next.commonMonthlyInvestment=0;
  next.ownerCostMode=next.ownerCostMode||(next.ownerCostTotalMonthly==null?'itemized':'total');
  next.tax={
    ...(next.tax||{}),
    calculationMode:'box1-2026',
    box1IncomeBeforeOwnHome:58000+index*4500,
    box1Profile:'non-aow-employment-2026'
  };
  next.box3={...(next.box3||{}),debtFallbackDestination:['invest','savings','consume'].includes(next.box3?.debtFallbackDestination)?next.box3.debtFallbackDestination:'invest'};
  if(next.mode==='buy-rent'||next.mode==='downpayment'){
    const term=next.mode==='buy-rent'?next.buyRent?.mortgageYears:next.downpayment?.mortgageYears;
    next.purchaseRules={
      ...(next.purchaseRules||{}),
      propertyUse:'main-residence',
      starterMainResidence:true,
      hraRemainingMonths:next.tax?.hraRemainingMonths==null?Math.min(360,Math.round((term||30)*12)):next.tax.hraRemainingMonths,
      qualifyingInterestFraction:next.tax?.qualifyingInterestFraction==null?1:next.tax.qualifyingInterestFraction,
      qualifyingEnergyExpenditure:0,
      nhgNonEnergyCostStack:null,
      deductibleFinancingCosts:index%2===0?1000:0,
      grossRentalIncomeAnnual:0,
      privateUseDays:0,
      privateUseWozValue:0,
      propertyIncomeGrowthPct:0
    };
  }
  return next;
}
function expectedLegalChange(config){
  if(config.tax?.enabled===false)return false;
  const groundLease=config.ownerCostMode==='itemized'&&Number(config.groundLeaseAnnual||0)>0;
  const purchase=(config.mode==='buy-rent'||config.mode==='downpayment')&&Number(config.purchaseRules?.deductibleFinancingCosts||0)>0;
  return groundLease||purchase;
}

function run(){
  const cases=[];
  for(const mode of MODES)for(let index=0;index<10;index++){
    const config=stage10Config(baseConfig(mode,index),index);
    const before=SC.runScenario(copy(config));
    assert.equal(before.valid,true,`${mode}-${index+1} Stage 9.1 baseline invalid: ${before.reason||''}`);
    cases.push({id:`${mode}-${index+1}`,mode,index,config,before,beforeLeader:leader(before)});
  }

  require('../stage10-remediation.js');
  const rows=[];
  for(const item of cases){
    const after=SC.runScenario(copy(item.config));
    assert.equal(after.valid,true,`${item.id} Stage 10 invalid: ${after.reason||''}`);
    const resultChanged=changed(item.before.A.net,after.A.net)||changed(item.before.B.net,after.B.net);
    const expected=expectedLegalChange(item.config),leaderAfter=leader(after),leaderChanged=item.beforeLeader!==leaderAfter;
    assert.equal(resultChanged,expected,`${item.id} ${resultChanged?'changed without an expected deductible-cost correction':'did not change despite an expected deductible-cost correction'}`);
    const canonical=OI.canonicalComparisonResult(after,{mode:item.mode,years:item.config.horizonYears,returnPct:item.config.investmentReturnPct});
    assert.equal(canonical.valid,true,`${item.id} canonical result invalid`);
    rows.push({id:item.id,mode:item.mode,resultChanged,expectedChange:expected,leaderBefore:item.beforeLeader,leaderAfter,leaderChanged,aBefore:item.before.A.net,aAfter:after.A.net,bBefore:item.before.B.net,bAfter:after.B.net});
  }
  const unexplained=rows.filter(row=>row.resultChanged!==row.expectedChange),leaderRows=rows.filter(row=>row.leaderChanged),changedRows=rows.filter(row=>row.resultChanged);
  const summary={
    stage:'R6.6 Stage 10 deterministic matrix',scenarios:rows.length,reconciled:rows.length,
    numericalChanges:changedRows.length,changedIds:changedRows.map(row=>row.id),
    leaderChanges:leaderRows.length,leaderChangeIds:leaderRows.map(row=>row.id),
    unexplainedChanges:unexplained.length,
    byMode:Object.fromEntries(MODES.map(mode=>[mode,rows.filter(row=>row.mode===mode).length]))
  };
  assert.equal(rows.length,50);
  assert.equal(summary.unexplainedChanges,0);
  console.log(JSON.stringify(summary,null,2));
  console.log(`Stage 10: 50/50 deterministic scenarios reconciled; ${summary.numericalChanges} explained legal corrections; ${summary.leaderChanges} leader changes surfaced for review.`);
  return{summary,rows};
}

if(require.main===module)run();
module.exports={stage10Config,expectedLegalChange,run};
