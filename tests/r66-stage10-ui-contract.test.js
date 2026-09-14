'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'..','stage10-remediation.js'),'utf8');

test('Stage 10 hides private-use WOZ unless non-main current-law private use is positive',()=>{
  assert.match(source,/scenarioPropertyPrivateUseWozField/);
  assert.match(source,/classList\.toggle\('hidden',!\(purchase&&nonMain&&box3==='current'&&days>0\)\)/);
  assert.match(source,/if\(days<=0\)priorWoz\.value='0'/);
});

test('Stage 10 persists late-created Scenario controls independently and migrates old snapshots',()=>{
  assert.match(source,/STAGE10_STATE_KEY='dimp\.stage10\.scenario-state\.v1'/);
  assert.match(source,/function captureStage10State\(\)/);
  assert.match(source,/function saveStage10State\(\)/);
  assert.match(source,/function restoreStage10State\(\)/);
  assert.match(source,/localStorage\.getItem\(STAGE10_STATE_KEY\)/);
  assert.match(source,/localStorage\.getItem\(S91\.SNAPSHOT_KEY\)/);
  for(const id of ['scenarioPropertyUseNew','scenarioDeductibleFinancingCostsNew','scenarioNhgNonEnergyCostStackNew','scenarioPropertyRentalIncomeNew','scenarioPropertyIncomeGrowthNew','scenarioPropertyPrivateUseDaysNew','scenarioPropertyPrivateUseWozNew']){
    assert.match(source,new RegExp(id));
  }
  assert.match(source,/trigger\.dispatchEvent\(new Event\('input'/);
  assert.match(source,/trigger\.dispatchEvent\(new Event\('change'/);
});

test('Stage 10 labels its Scenario-owned controls as entered here across save and reload',()=>{
  assert.match(source,/function stage10Provenance\(\)/);
  assert.match(source,/tag\.textContent='Entered here'/);
  assert.match(source,/sync\(\);stage10Provenance\(\)/);
});
