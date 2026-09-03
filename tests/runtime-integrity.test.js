'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');

const EXPECTED_LOCAL_SCRIPTS=['finance-core.js','box1-2026.js','box1-2026-ui.js','logic-integrity-ui.js','box3-household.js','purchase-rules.js','app.js','purchase-costs.js','scenario-engine.js','next-euro.js','app-state.js','view-density.js','view-density-state.js','output-integrity.js'];

test('index.html declares the complete browser module order explicitly',()=>{
  const html=read('index.html');
  const scripts=[...html.matchAll(/<script\s+src="([^"]+)"/g)].map(m=>m[1]);
  const local=scripts.filter(src=>!/^https?:\/\//i.test(src)).map(src=>src.split('?')[0]);
  assert.deepEqual(local,EXPECTED_LOCAL_SCRIPTS);
});

test('every explicitly loaded local browser module exists in the repository',()=>{
  EXPECTED_LOCAL_SCRIPTS.forEach(file=>assert.equal(fs.existsSync(path.join(ROOT,file)),true,`${file} should exist`));
});

test('runtime modules do not inject dependency scripts or poll for them',()=>{
  const purchase=read('purchase-costs.js'),household=read('box3-household.js'),state=read('app-state.js'),density=read('view-density.js'),late=read('view-density-state.js');
  assert.doesNotMatch(purchase,/createElement\(['"]script['"]\)/i);
  assert.doesNotMatch(purchase,/\.src\s*=\s*['"](?:purchase-rules|box3-household)\.js['"]/i);
  assert.doesNotMatch(household,/createElement\(['"]script['"]\)/i);
  assert.doesNotMatch(household,/setTimeout\s*\(/);
  assert.doesNotMatch(state,/createElement\(['"]script['"]\)/i);
  assert.doesNotMatch(state,/setInterval\s*\(/);
  assert.doesNotMatch(density,/createElement\(['"]script['"]\)/i);
  assert.doesNotMatch(density,/MutationObserver/);
  assert.doesNotMatch(late,/createElement\(['"]script['"]\)/i);
});

test('browser modules fail fast when required dependencies are missing',()=>{
  const purchase=read('purchase-costs.js'),household=read('box3-household.js'),next=read('next-euro.js'),gate=read('logic-integrity-ui.js');
  assert.match(purchase,/PurchaseRules must load before purchase-costs\.js/);
  assert.match(household,/FinanceCore must load before box3-household\.js/);
  assert.match(next,/ScenarioCore is required by NextEuro/);
  assert.match(gate,/FinanceCore must load before logic-integrity-ui\.js/);
});

test('public page exposes R6.4, mixed-asset Box 3, and conservative static defaults',()=>{
  const html=read('index.html'),gate=read('logic-integrity-ui.js');
  assert.match(html,/id="modelVersion"/);
  assert.match(html,/Calculation build R6\.5/);
  assert.match(gate,/version:'R6\.5'/);
  assert.match(html,/2026 current rules, mixed-asset estimate/);
  assert.doesNotMatch(html,/2026 current rules, investment-only estimate/);
  assert.match(html,/id="annualReturn"[^>]*value="5"/);
  assert.match(html,/option value="current" selected/);
  assert.match(html,/option value="savings" selected>Savings \/ cash/);
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
  assert.doesNotMatch(household,/Calculation build R\d+/);
});

test('R5 loads Next Euro after ScenarioCore and exposes the break-even UI',()=>{
  const html=read('index.html'),next=read('next-euro.js');
  assert.ok(html.indexOf('scenario-engine.js')<html.indexOf('next-euro.js'));
  assert.match(next,/R5 · Next €/);
  assert.match(next,/Break-even investment return/);
  assert.match(next,/not a risk-adjusted/i);
});

test('R6 persistence and late density restoration load in deterministic order',()=>{
  const html=read('index.html'),state=read('app-state.js'),late=read('view-density-state.js');
  assert.ok(html.indexOf('next-euro.js')<html.indexOf('app-state.js'));
  assert.ok(html.indexOf('app-state.js')<html.indexOf('view-density.js'));
  assert.ok(html.indexOf('view-density.js')<html.indexOf('view-density-state.js'));
  assert.ok(html.indexOf('view-density-state.js')<html.indexOf('output-integrity.js'));
  assert.match(state,/Private browser save/);
  assert.match(state,/stored only in this browser/);
  assert.match(state,/Reset examples/);
  assert.match(state,/How to read the model/);
  assert.match(late,/LATE_CONTROL_IDS/);
  assert.match(late,/hillenOverrideEnabled/);
  assert.match(late,/scenarioBuyWozNew/);
});

test('R6.5 cache-busts every local browser asset',()=>{
  const html=read('index.html');
  const local=[...html.matchAll(/<script\s+src="((?!https?:\/\/)[^"]+)"/g)].map(m=>m[1]);
  assert.equal(local.length,EXPECTED_LOCAL_SCRIPTS.length);
  local.forEach(src=>assert.match(src,/\?v=R6\.5$/));
  assert.match(html,/styles\.css\?v=R6\.5/);
});
