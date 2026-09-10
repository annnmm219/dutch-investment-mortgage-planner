'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Policy=require('../policy-2026.js');
const FC=require('../finance-core.js');
const Box1=require('../box1-2026.js');
const OI=require('../output-integrity.js');
const Gate=require('../logic-integrity-ui.js');

const ROOT=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const close=(actual,expected,tolerance=.005)=>assert.ok(Math.abs(actual-expected)<=tolerance,`expected ${expected}, got ${actual}`);

test('Stage 8 publishes one synchronized R6.6 release identity',()=>{
  assert.equal(OI.RELEASE_META.version,'R6.6');
  assert.equal(Gate.MODEL_META.version,'R6.6');
  assert.equal(OI.RELEASE_META.releaseName,'Decision Integrity');
  assert.equal(Gate.MODEL_META.releaseName,'Decision Integrity');
  assert.equal(OI.RELEASE_META.updated,Policy.LAST_VERIFIED_AT);
  assert.equal(Gate.MODEL_META.updated,Policy.LAST_VERIFIED_AT);
  assert.match(read('index.html'),/Calculation build R6\.6 · 2026 rules · updated 3 Sep 2026/);
});

test('Stage 8 retains the verified final and provisional 2026 policy classifications',()=>{
  assert.deepEqual(Policy.VALUES.box1.preAowBrackets,[
    {lower:0,upper:38883,rate:.3575},
    {lower:38883,upper:78426,rate:.3756},
    {lower:78426,upper:null,rate:.495}
  ]);
  assert.equal(Policy.VALUES.box1.ownHomeHighIncomeAdjustmentRate,.1194);
  assert.equal(Policy.VALUES.box3.taxRate,.36);
  assert.equal(Policy.VALUES.box3.allowancePerPerson,59357);
  assert.equal(Policy.VALUES.box3.investmentDeemedRate,.06);
  assert.equal(Policy.getItem('box3.savingsDeemedRate').status,'provisional');
  assert.equal(Policy.getItem('box3.debtDeemedRate').status,'provisional');
  assert.equal(Policy.getItem('box3.investmentDeemedRate').status,'final');
});

test('Stage 8 current-law Box 3 probe reproduces the official savings example before display rounding',()=>{
  const result=FC.box3TaxForYear({
    regime:'current',jan1Savings:150000,jan1Portfolio:0,jan1Debt:0,
    savingsIncome:0,marketGain:10000,debtInterest:0,allowActualRebuttal:false,
    currentTaxRate:.36,currentAllowance:59357,currentSavingsNotional:.0128,
    currentNotional:.06,currentDebtNotional:.027,currentDebtThreshold:3800,taxPartners:1
  });
  close(result.deemedReturn,1920);
  close(result.taxableBase,90643);
  close(result.notionalTax,1920*(90643/150000)*.36);
  assert.equal(result.method,'deemed return · incomplete actual-return year');
});

test('Stage 8 keeps the corrected high-income Box 1 sign',()=>{
  const result=Box1.ownHomeBox1Tax2026({
    box1IncomeBeforeOwnHome:80000,
    ewfIncome:1750,
    deductibleOwnHomeCosts:2000
  });
  close(result.tableTaxAfterOwnHome-result.taxBeforeOwnHome,-123.75);
  close(result.highIncomeAdjustment,238.80);
  close(result.taxEffect,115.05);
  close(result.taxBenefit,-115.05);
});

test('Stage 8 adjudicates the Hillen example using the statutory qualifying-cost ceiling',()=>{
  const result=Box1.ownHomeBox1Tax2026({
    box1IncomeBeforeOwnHome:80000,
    ewfIncome:4000,
    deductibleOwnHomeCosts:3500
  });
  close(result.highIncomeAdjustmentBase,3500);
  close(result.highIncomeAdjustment,417.90);
  assert.ok(result.highIncomeAdjustmentBase<=result.deductibleOwnHomeCosts);
  assert.match(Policy.SOURCES.ownHomeAdjustmentLegislation.sourceUrl,/officielebekendmakingen\.nl/);
  assert.match(read('audits/r6.6/stage8-final-audit.md'),/Belastingdienst example remains inconsistent/i);
});

test('Stage 8 keeps future Box 3 explicitly proposed and aligned with the passed Tweede Kamer text',()=>{
  const gain=FC.box3TaxForYear({regime:'future',marketGain:10000,futureTaxRate:.36,futureExempt:1800,futureLossThreshold:500});
  const loss=FC.box3TaxForYear({regime:'future',marketGain:-1000,futureTaxRate:.36,futureExempt:1800,futureLossThreshold:500});
  close(gain.tax,2952);
  close(loss.lossCarry,500);
  assert.match(Policy.SOURCES.futureBox3ProposalStatus.sourceUrl,/eerstekamer\.nl/);
  assert.match(read('app.js'),/not enacted law as of 3 September 2026/);
});

test('Stage 8 release evidence retains all five deterministic comparison modes',()=>{
  const source=read('scripts/verify-50-scenarios.js');
  for(const mode of ['buy-rent','downpayment','mortgage-invest','linear-annuity','sell-rent'])assert.match(source,new RegExp(`['"]${mode}['"]`));
  assert.match(source,/release:'R6\.6'/);
  assert.doesNotMatch(source,/R6\.6 Stage 6: 50\/50/);
});

test('Stage 8 release documentation preserves decision-grade boundaries',()=>{
  const readme=read('README.md');
  assert.match(readme,/not mortgage underwriting, a tax return, or personal financial advice/i);
  assert.match(readme,/does not calculate official Nibud\/LTI borrowing capacity/i);
  assert.match(readme,/proposed future regime is a legislative scenario, not enacted law/i);
});
