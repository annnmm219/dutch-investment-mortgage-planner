'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');

const EXPECTED_LOCAL_SCRIPTS=['finance-core.js','box3-household.js','purchase-rules.js','app.js','purchase-costs.js','scenario-engine.js','next-euro.js'];

test('index.html declares the complete browser module order explicitly',()=>{
  const html=read('index.html');
  const scripts=[...html.matchAll(/<script\s+src="([^"]+)"/g)].map(m=>m[1]);
  const local=scripts.filter(src=>!/^https?:\/\//i.test(src));
  assert.deepEqual(local,EXPECTED_LOCAL_SCRIPTS);
});

test('every explicitly loaded local browser module exists in the repository',()=>{
  EXPECTED_LOCAL_SCRIPTS.forEach(file=>assert.equal(fs.existsSync(path.join(ROOT,file)),true,`${file} should exist`));
});

test('runtime modules do not inject dependency scripts or poll for them',()=>{
  const purchase=read('purchase-costs.js'),household=read('box3-household.js');
  assert.doesNotMatch(purchase,/createElement\(['"]script['"]\)/i);
  assert.doesNotMatch(purchase,/\.src\s*=\s*['"](?:purchase-rules|box3-household)\.js['"]/i);
  assert.doesNotMatch(household,/createElement\(['"]script['"]\)/i);
  assert.doesNotMatch(household,/setTimeout\s*\(/);
});

test('browser modules fail fast when required dependencies are missing',()=>{
  const purchase=read('purchase-costs.js'),household=read('box3-household.js'),next=read('next-euro.js');
  assert.match(purchase,/PurchaseRules must load before purchase-costs\.js/);
  assert.match(household,/FinanceCore must load before box3-household\.js/);
  assert.match(next,/ScenarioCore is required by NextEuro/);
});

test('public page exposes a calculation build marker and mixed-asset Box 3 copy',()=>{
  const html=read('index.html');
  assert.match(html,/id="modelVersion"/);
  assert.match(html,/Calculation build R\d+/);
  assert.match(html,/2026 current rules, mixed-asset estimate/);
  assert.doesNotMatch(html,/2026 current rules, investment-only estimate/);
});

test('R2 labels monthly mortgage tax values as allocations from the annual calculation',()=>{
  const html=read('index.html');
  assert.match(html,/annual HRA\/EWF\/Hillen estimate is authoritative/i);
  assert.match(html,/Allocated tax benefit/);
});

test('household balance UI exposes dynamic balances and defaults browser tax payment to savings',()=>{
  const household=read('box3-household.js');
  assert.match(household,/Starting savings \/ bank deposits/);
  assert.match(household,/Monthly Box 3 debt repayment/);
  assert.match(household,/Ending savings \/ cash/);
  assert.match(household,/Net financial assets/);
  assert.match(household,/select\.value='savings'/);
  assert.match(household,/Calculation build R\d+/);
});

test('R5 loads Next Euro after ScenarioCore and exposes the break-even UI',()=>{
  const html=read('index.html'),next=read('next-euro.js');
  assert.ok(html.indexOf('scenario-engine.js')<html.indexOf('next-euro.js'));
  assert.match(next,/R5 · Next €/);
  assert.match(next,/Break-even investment return/);
  assert.match(next,/Quick amounts: €250 \/ €500 \/ €1,000 per month/);
});
