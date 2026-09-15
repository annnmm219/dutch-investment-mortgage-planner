'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const SC=require('../scenario-engine.js');
const routes=require('../scripts/verify-stage9-input-routes.js');

const ROOT=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');

test('Stage 9 requires an explicit imported or fresh data route',()=>{
  assert.deepEqual(SC.INPUT_SOURCE_MODES,{IMPORTED:'imported',FRESH:'fresh'});
  assert.throws(()=>SC.resolveScenarioInputSource({scenarioConfig:{mode:'sell-rent'}}),/Choose imported or fresh/);
});

test('fresh and imported routes resolve only their selected source',()=>{
  const scenario={mode:'sell-rent',horizonYears:10,investmentReturnPct:5,sellRent:{homeValue:400000,monthlyRent:1600}};
  const planner={startPortfolio:100000,mortgage:{balance:250000,ratePct:4,years:25},tax:{enabled:false},box3:{savings:20000}};
  const fresh={startPortfolio:30000,mortgage:{balance:175000,ratePct:3.5,years:18},tax:{enabled:false},box3:{savings:5000}};
  const imported=SC.resolveScenarioInputSource({sourceMode:'imported',plannerData:planner,freshData:fresh,scenarioConfig:scenario});
  const independent=SC.resolveScenarioInputSource({sourceMode:'fresh',plannerData:planner,freshData:fresh,scenarioConfig:scenario});
  assert.equal(imported.startPortfolio,100000);assert.equal(imported.mortgage.balance,250000);assert.equal(imported.box3.savings,20000);
  assert.equal(independent.startPortfolio,30000);assert.equal(independent.mortgage.balance,175000);assert.equal(independent.box3.savings,5000);
});

test('purchase scenarios retain scenario-owned mortgage and tax inputs',()=>{
  const scenario={mode:'buy-rent',mortgage:{balance:0,ratePct:0,years:30},tax:{enabled:true,wozValue:350000},buyRent:{price:350000}};
  const planner={mortgage:{balance:999999,ratePct:19,years:1},tax:{enabled:false,wozValue:1}};
  const resolved=SC.resolveScenarioInputSource({sourceMode:'imported',plannerData:planner,scenarioConfig:scenario});
  assert.deepEqual(resolved.mortgage,scenario.mortgage);assert.deepEqual(resolved.tax,scenario.tax);
});

test('browser Scenarios exposes both entry paths and locks calculation until selection',()=>{
  const source=read('scenario-engine.js');
  assert.match(source,/Use my existing planner data/);assert.match(source,/Start a fresh comparison/);
  assert.match(source,/if\(!scenarioSourceMode\)/);assert.match(source,/Changes in other tabs will not alter it unless you refresh/);
  assert.doesNotMatch(source,/document\.querySelectorAll\('#tab-investment input,#tab-investment select,#tab-mortgage input,#tab-mortgage select'\)/);
});

test('owner costs are visible as a total with an inline optional breakdown',()=>{
  const source=read('scenario-engine.js');
  assert.match(source,/Owner costs excluding mortgage, per month/);assert.match(source,/Break down this amount/);
  assert.match(source,/Includes VvE\/service charges, maintenance, owner taxes, building insurance and ground lease/);
  assert.match(source,/ownerCostMode/);
});

test('comfortable housing cost is optional and checks the starting requirement only',()=>{
  const source=read('scenario-engine.js');
  assert.match(source,/Maximum comfortable housing cost today, optional/);
  assert.match(source,/gap=x\.firstRequirement-budget/);
  assert.doesNotMatch(source,/gap=x\.peakRequirement-budget/);
});

test('50 imported and 50 fresh calculations match pair by pair',()=>{
  const result=routes.run();
  assert.equal(result.summary.totalCalculations,100);
  assert.equal(result.summary.equalPairs,50);
  assert.equal(result.summary.mismatches,0);
});
