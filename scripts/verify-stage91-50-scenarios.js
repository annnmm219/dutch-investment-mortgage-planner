'use strict';

const assert=require('node:assert/strict');
const OI=require('../output-integrity.js');
const SC=require('../scenario-engine.js');
const {MODES,baseConfig}=require('./verify-50-scenarios.js');

const copy=value=>JSON.parse(JSON.stringify(value));
const leader=result=>Math.abs(result.A.net-result.B.net)<1?'tie':result.A.net>result.B.net?'A':'B';
const changed=(a,b,tolerance=1e-7)=>Math.abs(Number(a)-Number(b))>tolerance;

function stage91Config(config){
  const next=copy(config);
  next.commonMonthlyInvestment=0;
  next.box3={...(next.box3||{}),debtFallbackDestination:['invest','savings','consume'].includes(next.box3?.debtFallbackDestination)?next.box3.debtFallbackDestination:'invest'};
  if(next.mode==='buy-rent'||next.mode==='downpayment'){
    next.purchaseRules={
      ...(next.purchaseRules||{}),
      hraRemainingMonths:next.tax?.hraRemainingMonths==null?Math.min(360,Math.round((next.mode==='buy-rent'?next.buyRent?.mortgageYears:next.downpayment?.mortgageYears||30)*12)):next.tax.hraRemainingMonths,
      qualifyingInterestFraction:next.tax?.qualifyingInterestFraction==null?1:next.tax.qualifyingInterestFraction,
      qualifyingEnergyExpenditure:0
    };
  }
  return next;
}

function expectedResultChange(config){
  if(config.tax?.enabled===false)return false;
  if(config.mode!=='buy-rent'&&config.mode!=='downpayment')return false;
  return Math.abs(Number(config.tax?.qualifyingInterestFraction??1)-1)>1e-12;
}

function run(){
  const cases=[];
  for(const mode of MODES)for(let index=0;index<10;index++){
    const config=baseConfig(mode,index);
    const before=SC.runScenario(copy(config));
    assert.equal(before.valid,true,`${mode}-${index+1} baseline invalid: ${before.reason||''}`);
    cases.push({id:`${mode}-${index+1}`,mode,index,config,before,beforeLeader:leader(before)});
  }

  require('../stage9-1-remediation.js');
  const rows=[];
  for(const item of cases){
    const config=stage91Config(item.config),after=SC.runScenario(config);
    assert.equal(after.valid,true,`${item.id} Stage 9.1 invalid: ${after.reason||''}`);
    const resultChanged=changed(item.before.A.net,after.A.net)||changed(item.before.B.net,after.B.net);
    const leaderAfter=leader(after),leaderChanged=item.beforeLeader!==leaderAfter;
    const expected=expectedResultChange(item.config);
    assert.equal(resultChanged,expected,`${item.id} ${resultChanged?'changed unexpectedly':'did not change despite corrected purchase-HRA eligibility'}`);
    assert.equal(leaderChanged,false,`${item.id} changed strategy leader from ${item.beforeLeader} to ${leaderAfter}`);
    const canonical=OI.canonicalComparisonResult(after,{mode:item.mode,years:config.horizonYears,returnPct:config.investmentReturnPct});
    assert.equal(canonical.valid,true,`${item.id} canonical result invalid`);
    rows.push({id:item.id,mode:item.mode,resultChanged,expectedChange:expected,leaderBefore:item.beforeLeader,leaderAfter,leaderChanged,aBefore:item.before.A.net,aAfter:after.A.net,bBefore:item.before.B.net,bAfter:after.B.net});
  }
  assert.equal(rows.length,50);
  const changedRows=rows.filter(row=>row.resultChanged),leaderRows=rows.filter(row=>row.leaderChanged);
  const summary={stage:'R6.6 Stage 9.1 deterministic matrix',scenarios:50,reconciled:50,numericalChanges:changedRows.length,changedIds:changedRows.map(row=>row.id),leaderChanges:leaderRows.length,leaderChangeIds:leaderRows.map(row=>row.id),unexplainedChanges:0,byMode:Object.fromEntries(MODES.map(mode=>[mode,rows.filter(row=>row.mode===mode).length]))};
  console.log(JSON.stringify(summary,null,2));
  console.log('Stage 9.1: 50/50 remediated deterministic scenarios reconciled with only expected purchase-HRA corrections.');
  return{summary,rows};
}

if(require.main===module)run();
module.exports={stage91Config,expectedResultChange,run};
