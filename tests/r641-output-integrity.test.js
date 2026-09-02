'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const OI=require('../output-integrity.js');

const ROOT=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');

function blocked(status='missing-jan1-snapshot'){
  return{
    portfolio:372375,
    box3Tax:null,
    totalTax:null,
    unsettledTaxEstimate:null,
    comparableWealth:null,
    householdComparableWealth:null,
    taxAdjustedComparableAvailable:false,
    taxStatus:status,
    taxBlockReason:status==='not-estimable'
      ?'The proposed actual-return regime cannot be estimated from incomplete calendar-year data.'
      :'Enter or explicitly confirm the complete 1 January Box 3 snapshot.'
  };
}

test('R6.4.2 is the single final output release identity',()=>{
  assert.equal(OI.RELEASE_META.version,'R6.4.2');
  assert.equal(OI.RELEASE_META.ruleYear,2026);
  assert.match(OI.releaseLabel(),/Calculation build R6\.4\.2/);
});

test('money formatting never converts null or undefined into €0',()=>{
  assert.throws(()=>OI.formatMoney(null),/finite number/);
  assert.throws(()=>OI.formatMoney(undefined),/finite number/);
  assert.equal(OI.formatOptionalMoney(null),'Unavailable');
  assert.equal(OI.formatOptionalMoney(0),'€0');
});

test('normal current-law output remains explicitly after Box 3',()=>{
  const model=OI.outputModel({
    portfolio:370867,
    box3Tax:40684,
    totalTax:40684,
    unsettledTaxEstimate:0,
    householdComparableWealth:616404,
    taxAdjustedComparableAvailable:true,
    taxStatus:'settled'
  },{box3Mode:'current'});
  assert.equal(model.available,true);
  assert.equal(model.headlineLabel,'Investment portfolio after Box 3');
  assert.equal(model.chartLabel,'Portfolio after Box 3');
  assert.equal(model.taxValue,'€40.684');
  assert.equal(model.blockYearTable,false);
});

test('missing January 1 snapshot relabels every retained projection as before Box 3',()=>{
  const model=OI.outputModel(blocked('missing-jan1-snapshot'),{box3Mode:'current'});
  const card=OI.scenarioCardModel({portfolio:339134,mortgage:21153,box3Tax:null},false,false);
  const combined=[model.headlineLabel,model.headlineSub,model.chartLabel,model.taxValue,model.afterTaxValue,model.scenarioTaxText,card.sub].join(' | ');
  assert.equal(model.available,false);
  assert.equal(model.headlineLabel,'Investment portfolio before Box 3');
  assert.equal(model.chartLabel,'Portfolio before Box 3');
  assert.equal(model.taxValue,'Not estimable');
  assert.equal(model.afterTaxValue,'Unavailable');
  assert.equal(model.blockYearTable,true);
  assert.match(card.sub,/Before Box 3 projection/);
  assert.doesNotMatch(combined,/€0 settled Box 3/);
  assert.doesNotMatch(combined,/after selected Box 3 treatment/i);
  assert.doesNotMatch(combined,/Portfolio after Box 3/);
});

test('incomplete proposed-regime output cannot expose a zero tax-adjusted result',()=>{
  const model=OI.outputModel(blocked('not-estimable'),{box3Mode:'future'});
  assert.equal(model.status,'not-estimable');
  assert.equal(model.available,false);
  assert.equal(model.taxValue,'Not estimable');
  assert.equal(model.afterTaxValue,'Unavailable');
  assert.match(model.reason,/incomplete calendar-year data/);
  assert.doesNotMatch(model.scenarioTaxText,/€0/);
});

test('Box 3 ignored is a legitimate zero-tax state, not an unavailable state',()=>{
  const model=OI.outputModel({
    portfolio:100000,
    box3Tax:0,
    totalTax:0,
    householdComparableWealth:100000,
    taxAdjustedComparableAvailable:true,
    taxStatus:'settled'
  },{box3Mode:'none'});
  assert.equal(model.available,true);
  assert.equal(model.ignored,true);
  assert.equal(model.headlineLabel,'Investment portfolio before Box 3');
  assert.equal(model.taxValue,'€0');
  assert.match(model.taxSub,/ignored/i);
});

test('blocked CSV carries status and blank tax fields rather than zero',()=>{
  const model=OI.outputModel(blocked(),{box3Mode:'current'});
  const csv=OI.outputCsv(model);
  assert.match(csv,/Box 3,Status,Not estimable/);
  assert.match(csv,/Results,Box 3 tax,\r?\n/);
  assert.doesNotMatch(csv,/Results,Box 3 tax,€0/);
  assert.match(csv,/Results,Portfolio before Box 3,€372\.375/);
  assert.match(csv,/Results,Portfolio after Box 3,\r?\n/);
});

test('browser renderer includes all release-blocking output surfaces',()=>{
  const source=read('output-integrity.js');
  assert.match(source,/sPortfolioSub/);
  assert.match(source,/scenarioCards/);
  assert.match(source,/Portfolio before Box 3/);
  assert.match(source,/box3YearBody/);
  assert.match(source,/householdSavingsEnd/);
  assert.match(source,/nextEuroBreakEven/);
  assert.match(source,/exportAssumptionsCsv/);
  assert.match(source,/Tax-adjusted comparison unavailable/);
});

test('R6.4.2 interpretation warnings remain visible without expanding the engine',()=>{
  const source=read('output-integrity.js');
  assert.match(source,/Modeled HRA sensitivity estimate/);
  assert.match(source,/constant-rules scenario/);
  assert.match(source,/Owner-cost assumption/);
  assert.match(source,/30% ruling and Box 3/);
  assert.match(source,/Actual savings interest/);
  assert.match(source,/Actual Box 3 debt interest/);
});
