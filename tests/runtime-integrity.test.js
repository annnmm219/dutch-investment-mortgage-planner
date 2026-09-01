'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');

const EXPECTED_LOCAL_SCRIPTS=[
  'finance-core.js',
  'box3-household.js',
  'purchase-rules.js',
  'app.js',
  'purchase-costs.js',
  'scenario-engine.js'
];

test('index.html declares the complete browser module order explicitly',()=>{
  const html=read('index.html');
  const scripts=[...html.matchAll(/<script\s+src="([^"]+)"/g)].map(m=>m[1]);
  const local=scripts.filter(src=>!/^https?:\/\//i.test(src));
  assert.deepEqual(local,EXPECTED_LOCAL_SCRIPTS);
});

test('every explicitly loaded local browser module exists in the repository',()=>{
  EXPECTED_LOCAL_SCRIPTS.forEach(file=>{
    assert.equal(fs.existsSync(path.join(ROOT,file)),true,`${file} should exist`);
  });
});

test('runtime modules do not inject dependency scripts or poll for them',()=>{
  const purchase=read('purchase-costs.js');
  const household=read('box3-household.js');

  assert.doesNotMatch(purchase,/createElement\(['"]script['"]\)/i);
  assert.doesNotMatch(purchase,/\.src\s*=\s*['"](?:purchase-rules|box3-household)\.js['"]/i);
  assert.doesNotMatch(household,/createElement\(['"]script['"]\)/i);
  assert.doesNotMatch(household,/setTimeout\s*\(/);
});

test('browser modules fail fast when required dependencies are missing',()=>{
  const purchase=read('purchase-costs.js');
  const household=read('box3-household.js');

  assert.match(purchase,/PurchaseRules must load before purchase-costs\.js/);
  assert.match(household,/FinanceCore must load before box3-household\.js/);
});

test('public page exposes a calculation build marker and mixed-asset Box 3 copy',()=>{
  const html=read('index.html');
  assert.match(html,/id="modelVersion"/);
  assert.match(html,/Calculation build R1/);
  assert.match(html,/2026 current rules, mixed-asset estimate/);
  assert.doesNotMatch(html,/2026 current rules, investment-only estimate/);
});
