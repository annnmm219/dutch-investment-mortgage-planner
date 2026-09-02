'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const VD=require('../view-density.js');
const PS=require('../app-state.js');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');

test('Standard is the default and Advanced is only restored explicitly',()=>{
  assert.equal(VD.DEFAULT_VIEW,'standard');
  assert.equal(VD.normalizeView(undefined),'standard');
  assert.equal(VD.normalizeView('standard'),'standard');
  assert.equal(VD.normalizeView('advanced'),'advanced');
  assert.equal(VD.normalizeView('anything-else'),'standard');
});

test('safe hidden defaults create no Advanced-state warning chips',()=>{
  const defaults={
    phaseCount:3,bonusMonth:12,box3Mode:'current',box3PaySource:'savings',box3Debt:0,box3DebtMonthlyRepayment:0,
    currentTaxRate:36,currentAllowance:59357,currentNotional:6,currentSavingsNotional:1.28,currentDebtNotional:2.70,currentDebtThreshold:3800,
    jan1Assumption:false,jan1SnapshotEntered:false,deductionMode:'auto',hraRemainingMonths:300,defaultHraMonths:300,qualifyingShare:100,
    unusedMortgageDestination:'invest',mortgageReportHorizon:'investment',transferTaxMode:'main',appraisedValue:350000,housePrice:350000,nhgMode:'none',
    upfrontCashTreatment:'invest',scenarioMortgageMethod:'selected',scenarioMode:'buy-rent',sensitivityLow:2,sensitivityHigh:10,sensitivityStep:2,
    vveMonthly:250,maintenanceAnnual:1500,ownerTaxesAnnual:0,insuranceAnnual:0,groundLeaseAnnual:0
  };
  assert.deepEqual(VD.collectAdvancedState(defaults),[]);
});

test('non-default hidden values are surfaced in the Standard summary',()=>{
  const items=VD.collectAdvancedState({
    phaseCount:5,bonusMonth:6,box3Mode:'future',box3PaySource:'portfolio',box3Debt:20000,box3DebtMonthlyRepayment:250,
    currentTaxRate:36,currentAllowance:59357,currentNotional:6,currentSavingsNotional:1.28,currentDebtNotional:2.70,currentDebtThreshold:3800,
    jan1Assumption:true,deductionMode:'manual',hraRemainingMonths:96,defaultHraMonths:300,qualifyingShare:80,
    unusedMortgageDestination:'savings',mortgageReportHorizon:'mortgage',transferTaxMode:'other-home',appraisedValue:380000,housePrice:350000,nhgMode:'energy',
    upfrontCashTreatment:'savings',scenarioMortgageMethod:'linear',scenarioMode:'sell-rent',sensitivityLow:1,sensitivityHigh:14,sensitivityStep:1,
    vveMonthly:300,maintenanceAnnual:2400,ownerTaxesAnnual:600,insuranceAnnual:240,groundLeaseAnnual:1200
  });
  const keys=new Set(items.map(x=>x.key));
  ['phase-count','bonus-month','box3-mode','box3-source','box3-debt','box3-debt-payment','jan1','deduction-mode','hra-remaining','qualifying-share','unused-mortgage','mortgage-horizon','transfer-tax','appraisal','nhg','upfront-cash','scenario-mortgage-method','scenario','sensitivity','owner-costs'].forEach(key=>assert.ok(keys.has(key),`missing ${key}`));
});

test('combined Standard owner cost equals the Advanced monthly-equivalent split',()=>{
  assert.equal(VD.monthlyOwnerCost({vveMonthly:250,maintenanceAnnual:1500,ownerTaxesAnnual:600,insuranceAnnual:240,groundLeaseAnnual:1200}),545);
});

test('the density switch is persisted by the existing R6 snapshot machinery',()=>{
  const controls=[
    {id:'viewStandard',tagName:'INPUT',type:'radio',checked:false,disabled:false,dataset:{}},
    {id:'viewAdvanced',tagName:'INPUT',type:'radio',checked:true,disabled:false,dataset:{}}
  ];
  const snapshot=PS.captureControls(controls,{});
  assert.deepEqual(snapshot.controls['id:viewStandard'],{kind:'checked',value:false});
  assert.deepEqual(snapshot.controls['id:viewAdvanced'],{kind:'checked',value:true});
});

test('view changes alter visibility only, not underlying financial values',()=>{
  const source=read('view-density.js');
  const match=source.match(/function applyView\(\)\{([\s\S]*?)\n  \}\n\n  function refresh/);
  assert.ok(match,'applyView function should be discoverable');
  assert.doesNotMatch(match[1],/\.value\s*=/);
  assert.match(source,/density-advanced-only/);
  assert.match(source,/Advanced settings are affecting this plan/);
  assert.match(source,/Open Advanced/);
});

test('Standard exposes only normal decisions and up to three selectable phases without deleting active Advanced choices',()=>{
  const source=read('view-density.js');
  assert.equal(VD.STANDARD_PHASE_LIMIT,3);
  assert.deepEqual([...VD.ADVANCED_SCENARIOS].sort(),['downpayment','sell-rent']);
  assert.match(source,/option\.value!==phase\.value/);
  assert.match(source,/option\.value!==comparison\.value/);
});

test('the same page owns both densities and no second Advanced product is introduced',()=>{
  const html=read('index.html');
  assert.match(html,/view-density\.js/);
  assert.equal(fs.existsSync(path.join(ROOT,'index-advanced.html')),false);
  assert.match(read('view-density.js'),/View:/);
  assert.match(read('view-density.js'),/>Standard</);
  assert.match(read('view-density.js'),/>Advanced</);
});

test('Standard retains the required model-boundary callouts',()=>{
  const source=read('view-density.js');
  assert.match(source,/EWF after payoff/);
  assert.match(source,/last Box 3 year remains unsettled/i);
  assert.match(source,/Cash at closing/);
  assert.match(read('next-euro.js'),/not a risk-adjusted/i);
});