'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(ROOT,'stage10-remediation.js'),'utf8');

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
  for(const id of ['scenarioPurchaseTypeNew','scenarioPropertyUseNew','scenarioDeductibleFinancingCostsNew','scenarioNhgNonEnergyCostStackNew','scenarioPropertyRentalIncomeNew','scenarioPropertyIncomeGrowthNew','scenarioPropertyPrivateUseDaysNew','scenarioPropertyPrivateUseWozNew']){
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

test('Stage 10 browser parity reads property direct-return evidence from annual ledger buckets',()=>{
  const browser=fs.readFileSync(path.join(ROOT,'scripts','stage10-browser-parity.mjs'),'utf8');
  assert.match(browser,/propertyBuckets=Object\.values\(propertyLedger\?\.yearBuckets\|\|\{\}\)/);
  assert.match(browser,/propertyRentalIncome/);
  assert.match(browser,/propertyOwnUseAddition/);
});

test('Stage 10 normalizes inactive purchase-only rules for non-purchase modes across reload',()=>{
  assert.match(source,/if\(!isPurchase\(resolved\.mode\)\)/);
  assert.match(source,/rules\.grossRentalIncomeAnnual=0/);
  assert.match(source,/rules\.privateUseDays=0/);
  assert.match(source,/rules\.privateUseWozValue=0/);
  assert.match(source,/rules\.nhgNonEnergyCostStack=null/);
});


test('F-10 UI defines Box 3 rental income as basic rent excluding service charges',()=>{
  assert.match(source,/Annual basic rent \(kale huur\) \/ pacht received/);
  assert.match(source,/Exclude service charges/);
  assert.doesNotMatch(source,/Gross annual rent \/ pacht income/);
});

test('F-11 UI explicitly scopes R6.6 purchase rules to existing homes and blocks new-build',()=>{
  assert.match(source,/scenarioPurchaseTypeNew/);
  assert.match(source,/Existing home \(supported\)/);
  assert.match(source,/New build \(not supported in R6\.6\)/);
  assert.match(source,/scenarioNewBuildWarning/);
  assert.match(source,/purchaseType==='new-build'/);
  assert.match(source,/decision-grade NHG checks are scoped to existing-home purchases/);
});

test('Standalone NHG cannot bypass the Scenario-only exact eligibility engine through hidden inputs',()=>{
  assert.doesNotMatch(source,/finiteOrNull\(input\.nhgNonEnergyCostStack\)[^\n]*return prior\(input\)/);
  assert.match(source,/Standalone Mortgage-tab NHG is intentionally unavailable in R6\.6/);
});
