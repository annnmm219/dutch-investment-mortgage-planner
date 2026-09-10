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
  const js=read('app-state.js');
  assert.match(js,/Gross annual employment income/);
  assert.match(js,/I use the 30% ruling \/ expat scheme/);
  assert.match(js,/€78,600 in 2026/);
  assert.match(js,/jaaropgaaf remains authoritative/);
  assert.match(js,/HRA income estimate only, not Box 3 residency treatment/);
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
  assert.match(js,/Only assumptions used by the selected comparison are shown/);
});

test('linear vs annuity result explains why a higher remaining mortgage can still show higher modeled wealth',()=>{
  const js=read('app-state.js');
  assert.match(js,/Net position excluding the home/);
  assert.match(js,/Why can Annuity show higher modeled wealth with a larger mortgage balance\?/);
  assert.match(js,/larger investment portfolio can outweigh the extra mortgage debt/);
});
