'use strict';

const assert=require('node:assert/strict');
const FC=require('../finance-core.js');
const LI=require('../logic-integrity-ui.js');
LI.decorateFinanceCore(FC);
const SC=require('../scenario-engine.js');
LI.decorateScenarioCore(SC);
const OI=require('../output-integrity.js');
const {MODES,baseConfig}=require('./verify-50-scenarios.js');

function copy(value){return JSON.parse(JSON.stringify(value))}

function sourceData(config){
  return{
    startYear:config.startYear,
    startMonth:config.startMonth,
    investmentReturnPct:config.investmentReturnPct,
    startPortfolio:config.startPortfolio,
    mortgageType:config.mortgageType,
    mortgage:copy(config.mortgage),
    tax:copy(config.tax),
    box3:copy(config.box3)
  };
}

function scenarioOwned(config){
  const owned=copy(config);
  for(const key of ['startYear','startMonth','startPortfolio','mortgageType','mortgage','box3'])delete owned[key];
  if(!SC.isPurchaseMode(config.mode))delete owned.tax;
  return owned;
}

function comparableResult(result,config){
  return OI.canonicalComparisonResult(result,{mode:config.mode,years:config.horizonYears,returnPct:config.investmentReturnPct});
}

function run(){
  const pairs=[];
  for(const mode of MODES){
    for(let index=0;index<10;index++){
      const baseline=baseConfig(mode,index);
      const planner=sourceData(baseline);
      const fresh=copy(planner);
      const scenario=scenarioOwned(baseline);
      const imported=SC.resolveScenarioInputSource({sourceMode:SC.INPUT_SOURCE_MODES.IMPORTED,plannerData:planner,freshData:{},scenarioConfig:scenario});
      const independent=SC.resolveScenarioInputSource({sourceMode:SC.INPUT_SOURCE_MODES.FRESH,plannerData:{},freshData:fresh,scenarioConfig:scenario});
      assert.equal(imported.inputSource,'imported');
      assert.equal(independent.inputSource,'fresh');
      const importedResult=SC.runScenario(imported);
      const independentResult=SC.runScenario(independent);
      assert.equal(importedResult.valid,true,`${mode}-${index+1} imported route is invalid: ${importedResult.reason||''}`);
      assert.equal(independentResult.valid,true,`${mode}-${index+1} fresh route is invalid: ${independentResult.reason||''}`);
      assert.deepEqual(comparableResult(importedResult,imported),comparableResult(independentResult,independent),`${mode}-${index+1} routes differ`);
      pairs.push({id:`${mode}-${index+1}`,mode,imported:true,fresh:true,equal:true});
    }
  }
  assert.equal(pairs.length,50);
  const summary={stage:'R6.6 Stage 9',matchedDatasets:50,importedCalculations:50,freshCalculations:50,totalCalculations:100,equalPairs:50,mismatches:0,byMode:Object.fromEntries(MODES.map(mode=>[mode,pairs.filter(row=>row.mode===mode).length]))};
  console.log(JSON.stringify(summary,null,2));
  console.log('Stage 9: 50 imported and 50 fresh scenario calculations match pair by pair.');
  return{summary,pairs};
}

if(require.main===module)run();
module.exports={sourceData,scenarioOwned,comparableResult,run};
