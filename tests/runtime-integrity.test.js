'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');

const EXPECTED_LOCAL_SCRIPTS=['model-contract.js','policy-2026.js','finance-core.js','box1-2026.js','logic-integrity-ui.js','box3-household.js','policy-ui.js','purchase-rules.js','output-integrity.js','input-integrity.js','app.js','purchase-costs.js','scenario-engine.js','box1-2026-ui.js','next-euro.js','app-state.js','view-density.js','view-density-state.js','stage9-1-remediation.js','stage9-1-quality.js'];

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
  const purchase=read('purchase-costs.js'),household=read('box3-household.js'),state=read('app-state.js'),density=read('view-density.js'),late=read('view-density-state.js'),stage91=read('stage9-1-remediation.js'),quality=read('stage9-1-quality.js');
  assert.doesNotMatch(purchase,/createElement\(['"]script['"]\)/i);
  assert.doesNotMatch(purchase,/\.src\s*=\s*['"](?:purchase-rules|box3-household)\.js['"]/i);
  assert.doesNotMatch(household,/createElement\(['"]script['"]\)/i);
  assert.doesNotMatch(household,/setTimeout\s*\(/);
  assert.doesNotMatch(state,/createElement\(['"]script['"]\)/i);
  assert.doesNotMatch(state,/setInterval\s*\(/);
  assert.doesNotMatch(density,/createElement\(['"]script['"]\)/i);
  assert.doesNotMatch(density,/MutationObserver/);
  assert.doesNotMatch(late,/createElement\(['"]script['"]\)/i);
  assert.doesNotMatch(stage91,/createElement\(['"]script['"]\)/i);
  assert.doesNotMatch(stage91,/setInterval\s*\(/);
  assert.doesNotMatch(quality,/createElement\(['"]script['"]\)/i);
  assert.doesNotMatch(quality,/setInterval\s*\(/);
});

test('browser modules fail fast when required dependencies are missing',()=>{
  const purchase=read('purchase-costs.js'),household=read('box3-household.js'),scenario=read('scenario-engine.js'),next=read('next-euro.js'),gate=read('logic-integrity-ui.js'),core=read('finance-core.js'),rules=read('purchase-rules.js'),policyUi=read('policy-ui.js'),box1=read('box1-2026.js'),box1Ui=read('box1-2026-ui.js'),stage91=read('stage9-1-remediation.js');
  assert.match(purchase,/PurchaseRules must load before purchase-costs\.js/);
  assert.match(household,/Policy2026 is required by Box3Household/);
  assert.match(household,/FinanceCore must load before box3-household\.js/);
  assert.match(next,/ScenarioCore is required by NextEuro/);
  assert.match(next,/OutputIntegrity is required by NextEuro/);
  assert.match(scenario,/OutputIntegrity is required by ScenarioCore/);
  assert.match(gate,/Policy2026 is required by LogicIntegrityUI/);
  assert.match(gate,/FinanceCore must load before logic-integrity-ui\.js/);
  assert.match(core,/Policy2026 is required by FinanceCore/);
  assert.match(core,/ModelContract is required by FinanceCore/);
  assert.match(rules,/Policy2026 is required by PurchaseRules/);
  assert.match(policyUi,/Policy2026 must load before policy-ui\.js/);
  assert.match(box1,/Policy2026 is required by Box1OwnHome2026/);
  assert.match(box1,/FinanceCore is required by Box1OwnHome2026/);
  assert.match(box1Ui,/ScenarioCore must load before box1-2026-ui\.js/);
  assert.match(stage91,/Stage 9\.1 requires FinanceCore, PurchaseRules and ScenarioCore/);
});

test('public page exposes R6.6, mixed-asset Box 3, and conservative static defaults',()=>{
  const html=read('index.html'),gate=read('logic-integrity-ui.js');
  assert.match(html,/id="modelVersion"/);
  assert.match(html,/Calculation build R6\.6/);
  assert.match(gate,/version:'R6\.6'/);
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

test('R5 loads Next Euro after ScenarioCore and the Box 1 scenario bridge',()=>{
  const html=read('index.html'),next=read('next-euro.js');
  assert.ok(html.indexOf('scenario-engine.js')<html.indexOf('box1-2026-ui.js'));
  assert.ok(html.indexOf('box1-2026-ui.js')<html.indexOf('next-euro.js'));
  assert.match(next,/R5 · Next €/);
  assert.match(next,/Break-even effective annual return/);
  assert.match(next,/not a risk-adjusted/i);
});

test('R6 persistence, density restoration and Stage 9.1 layers load in deterministic order',()=>{
  const html=read('index.html'),state=read('app-state.js'),late=read('view-density-state.js');
  assert.ok(html.indexOf('output-integrity.js')<html.indexOf('app.js'));
  assert.ok(html.indexOf('next-euro.js')<html.indexOf('app-state.js'));
  assert.ok(html.indexOf('app-state.js')<html.indexOf('view-density.js'));
  assert.ok(html.indexOf('view-density.js')<html.indexOf('view-density-state.js'));
  assert.ok(html.indexOf('view-density-state.js')<html.indexOf('stage9-1-remediation.js'));
  assert.ok(html.indexOf('stage9-1-remediation.js')<html.indexOf('stage9-1-quality.js'));
  assert.match(state,/Private browser save/);
  assert.match(state,/stored only in this browser/);
  assert.match(state,/Reset examples/);
  assert.match(state,/How to read the model/);
  assert.match(late,/LATE_CONTROL_IDS/);
  assert.match(late,/hillenOverrideEnabled/);
  assert.match(late,/scenarioBuyWozNew/);
});

test('R6.6 and Stage 9.1 cache-bust every local browser asset',()=>{
  const html=read('index.html');
  const local=[...html.matchAll(/<script\s+src="((?!https?:\/\/)[^"]+)"/g)].map(m=>m[1]);
  assert.equal(local.length,EXPECTED_LOCAL_SCRIPTS.length);
  local.forEach(src=>{
    if(src.startsWith('stage9-1-'))assert.match(src,/\?v=R6\.6-stage9\.1$/);
    else assert.match(src,/\?v=R6\.6-stage9$/);
  });
  assert.match(html,/styles\.css\?v=R6\.6-stage9\.1/);
});

test('third-party browser assets use explicit integrity controls and no remote font dependency',()=>{
  const html=read('index.html');
  assert.doesNotMatch(html,/fonts\.googleapis\.com|fonts\.gstatic\.com/i);
  assert.match(html,/Chart\.js\/4\.4\.1\/chart\.umd\.js"\s+integrity="sha512-[^"]+"\s+crossorigin="anonymous"\s+referrerpolicy="no-referrer"/i);
});

test('Stage 9.1 quality layer provides accessible chart table and spreadsheet-safe export hooks',()=>{
  const quality=read('stage9-1-quality.js');
  assert.match(quality,/spreadsheetSafe/);
  assert.match(quality,/stage91ChartTable/);
  assert.match(quality,/aria-describedby/);
  assert.match(quality,/exportAssumptionsCsv/);
});
