'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');

test('R4 scenario UI uses household savings instead of a duplicate upfront-cash field',()=>{
  const js=read('scenario-engine.js');
  assert.doesNotMatch(js,/scenarioCashUpfrontNew/);
  assert.doesNotMatch(js,/scenarioDpCashNew/);
  assert.match(js,/Starting savings used by this comparison/);
  assert.match(js,/box3Savings/);
});

test('R4 adds owner-only cost inputs and a conservative scenario return range',()=>{
  const js=read('scenario-engine.js');
  assert.match(js,/scenarioOwnerTaxesNew/);
  assert.match(js,/scenarioInsuranceNew/);
  assert.match(js,/scenarioGroundLeaseNew/);
  assert.match(js,/scenarioReturnNew[^]*value="5"/);
  assert.match(js,/sensitivityHighNew[^]*value="10"/);
  assert.match(js,/12–14%/);
});

test('R4 conservative defaults remain present in later calculation builds',()=>{
  const household=read('box3-household.js');
  const gate=read('logic-integrity-ui.js');
  assert.match(household,/annualReturn\.value==='7'/);
  assert.match(household,/annualReturn\.value='5'/);
  assert.match(household,/mode\.value==='transition'/);
  assert.match(household,/mode\.value='current'/);
  assert.match(gate,/version:'R6\.4'/);
  assert.match(gate,/MODEL_META/);
  assert.doesNotMatch(household,/Calculation build R\d+/);
});