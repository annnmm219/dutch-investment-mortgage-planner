'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');

test('R6 CI uses Node 24 and current GitHub actions',()=>{
  const yml=read('.github/workflows/finance-tests.yml');
  const pkg=JSON.parse(read('package.json'));
  assert.match(yml,/actions\/checkout@v5/);
  assert.match(yml,/actions\/setup-node@v5/);
  assert.match(yml,/node-version:\s*24/);
  assert.equal(pkg.engines.node,'>=24');
});

test('R6 static defaults no longer depend on JavaScript correction',()=>{
  const html=read('index.html');
  assert.match(html,/id="annualReturn"[^>]*value="5"/);
  assert.match(html,/option value="current" selected>2026 rules for the whole plan/);
  assert.match(html,/option value="savings" selected>Savings \/ cash/);
  assert.doesNotMatch(html,/option value="transition" selected/);
});

test('R6 browser state module saves locally, restores, and provides a reset path',()=>{
  const js=read('app-state.js');
  assert.match(js,/localStorage/);
  assert.match(js,/captureControls/);
  assert.match(js,/restore\(\)/);
  assert.match(js,/plannerReset/);
  assert.match(js,/safeRemove\(\)/);
  assert.match(js,/window\.location\.reload\(\)/);
});

test('R6 methodology keeps underwriting and tax-filing boundaries visible',()=>{
  const js=read('app-state.js');
  assert.match(js,/scenario comparisons, not underwriting or a tax return/i);
  assert.match(js,/official Nibud\/LTI borrowing capacity is not calculated/i);
  assert.match(js,/proposed future regime is a legislative scenario/i);
});
