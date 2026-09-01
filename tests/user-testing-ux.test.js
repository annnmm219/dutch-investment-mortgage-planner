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

test('user-testing UX simplifies phase repayment labels without removing frequency choice',()=>{
  const js=read('app-state.js');
  assert.match(js,/Investment \/ month/);
  assert.match(js,/Extra mortgage repayment/);
  assert.match(js,/Repayment frequency/);
  assert.doesNotMatch(js,/mortgageFreq[^]*='monthly'[^]*user-testing/i);
});

test('Box 1 income guidance explicitly covers the expat 30 percent ruling',()=>{
  const js=read('app-state.js');
  assert.match(js,/Taxable annual Box 1 income/);
  assert.match(js,/expat \(30%\) ruling/);
  assert.match(js,/jaaropgaaf/);
});

test('automatic deduction mode freezes the displayed rate field',()=>{
  const js=read('app-state.js');
  assert.match(js,/manual\.disabled=auto/);
  assert.match(js,/Calculated deduction rate %/);
  assert.match(js,/Switch Deduction rate to Manual to edit it/);
});

test('mortgage summary explains the exact phase-based period',()=>{
  const js=read('app-state.js');
  assert.match(js,/Mortgage summary period:/);
  assert.match(js,/stop at the end of your Investment phases/);
  assert.match(js,/Mortgage status at/);
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

test('linear vs annuity result explains why a higher remaining mortgage can still win',()=>{
  const js=read('app-state.js');
  assert.match(js,/Net position excluding the home/);
  assert.match(js,/Why can Annuity win even with a larger mortgage balance\?/);
  assert.match(js,/larger investment portfolio can outweigh the extra mortgage debt/);
});
