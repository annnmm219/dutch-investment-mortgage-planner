'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const State=require('../app-state.js');

const ROOT=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');

test('flexible numeric parser accepts dot and comma decimals',()=>{
  assert.equal(State.parseFlexibleNumber('37.56'),37.56);
  assert.equal(State.parseFlexibleNumber('37,56'),37.56);
  assert.equal(State.parseFlexibleNumber(' 1,28 '),1.28);
  assert.ok(Number.isNaN(State.parseFlexibleNumber('abc')));
});

test('flexible numeric clamp respects configured min and max',()=>{
  assert.equal(State.clampFlexibleValue('12,5',0,10),10);
  assert.equal(State.clampFlexibleValue('-2.5',0,10),0);
  assert.equal(State.clampFlexibleValue('4,25',0,10),4.25);
});

test('phase UI is monthly-only and yearly saved values preserve the same annual amount',()=>{
  const js=read('app-state.js');
  assert.match(js,/Monthly investment/);
  assert.match(js,/Monthly extra mortgage repayment/);
  assert.match(js,/ux-phase-frequency-hidden/);
  assert.equal(State.monthlyEquivalentExtra(3000,'yearly'),250);
  assert.equal(State.monthlyEquivalentExtra(300,'monthly'),300);
});

test('30 percent ruling checkbox estimates taxable income from gross employment income',()=>{
  assert.equal(State.estimateTaxableIncome2026({grossIncome:84000,use30Ruling:false}),84000);
  assert.equal(State.estimateTaxableIncome2026({grossIncome:84000,use30Ruling:true}),58800);
  assert.equal(State.estimateTaxableIncome2026({grossIncome:300000,use30Ruling:true}),221400);
  const taxableAt50000=State.estimateTaxableIncome2026({grossIncome:50000,use30Ruling:true});
  assert.equal(taxableAt50000,48014);
  assert.equal(50000-taxableAt50000,1986);
  assert.equal(State.estimateTaxableIncome2026({grossIncome:60000,use30Ruling:true}),48014);
  assert.equal(State.estimateTaxableIncome2026({grossIncome:50000,use30Ruling:true,under30WithMasters:true}),36498);
  const js=read('app-state.js');
  const policy=require('../policy-2026.js');
  assert.match(js,/Gross annual employment income/);
  assert.match(js,/I use the 30% ruling \/ expat scheme/);
  assert.match(js,/Under 30 with a Dutch or equivalent foreign master's/);
  assert.equal(policy.VALUES.thirtyPercentRuling.maxTaxFreeAllowance,78600);
  assert.equal(policy.VALUES.thirtyPercentRuling.taxableSalaryThreshold,48013);
  assert.equal(policy.VALUES.thirtyPercentRuling.taxableSalaryThresholdUnder30Masters,36497);
  assert.match(js,/Policy2026\.THIRTY_PERCENT_RULING_NOTICE/);
  assert.match(policy.THIRTY_PERCENT_RULING_NOTICE,/Your jaaropgaaf remains authoritative\./);
  assert.match(read('box1-2026-ui.js'),/Policy2026\.THIRTY_PERCENT_RULING_NOTICE/);
});

test('automatic deduction mode freezes the displayed rate field',()=>{
  const js=read('app-state.js');
  assert.match(js,/manual\.disabled=auto/);
  assert.match(js,/Calculated deduction rate %/);
  assert.match(js,/Switch Deduction rate to Manual to edit it/);
});

test('mortgage reporting horizon supports investment end, mortgage end and a specific year',()=>{
  assert.equal(State.mortgageReportingMonths({mode:'investment',investmentMonths:204,mortgageTermMonths:300}),204);
  assert.equal(State.mortgageReportingMonths({mode:'mortgage',investmentMonths:204,mortgageTermMonths:300}),300);
  assert.equal(State.mortgageReportingMonths({mode:'year',startYear:2026,startMonth:5,specificYear:2030,mortgageTermMonths:300}),56);
  assert.equal(State.mortgageReportingMonths({mode:'year',startYear:2026,startMonth:5,specificYear:2090,mortgageTermMonths:300}),300);
  const js=read('app-state.js');
  assert.match(js,/Mortgage totals: report until/);
  assert.match(js,/End of investment plan/);
  assert.match(js,/End of mortgage term/);
  assert.match(js,/A specific year/);
  assert.match(js,/Investment phases and Scenario comparison horizons stay independent/);
});

test('Next Euro is reframed as part of the repay-vs-invest decision',()=>{
  const js=read('app-state.js');
  assert.match(js,/Extra cash: invest or repay\?/);
  assert.match(js,/mode!=='mortgage-invest'/);
  assert.match(js,/Investment return needed to tie/);
});

test('scenario assumptions hide fields that are irrelevant to the selected decision',()=>{
  const js=read('app-state.js');
  assert.match(js,/scenarioRentGrowthNew[^]*\['buy-rent','sell-rent'\]/);
  assert.match(js,/scenarioUpfrontCashTreatmentNew[^]*\['buy-rent','downpayment'\]/);
  assert.doesNotMatch(js,/Only assumptions used by the selected comparison are shown/);
});

test('linear vs annuity result explains why a higher remaining mortgage can still show higher modeled wealth',()=>{
  const js=read('app-state.js');
  assert.match(js,/Net position excluding the home/);
  assert.match(js,/Why can Annuity show higher modeled wealth with a larger mortgage balance\?/);
  assert.match(js,/larger investment portfolio can outweigh the extra mortgage debt/);
});
