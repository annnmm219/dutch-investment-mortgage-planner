'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const OI=require('../output-integrity.js');

const ROOT=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');

test('the static footer matches the JavaScript release label',()=>{
  const label=OI.releaseLabel();
  assert.equal(label,'Calculation build R6.6 · released 3 Nov 2026 · 2026 rules, verified 27 Oct 2026');
  assert.ok(read('index.html').includes(label));
  assert.equal(read('index.html').includes('<actual merge/deploy date>'),false);
});

test('example returns use Low, Middle and High with defaults 4, 7 and 10',()=>{
  const html=read('index.html');
  assert.match(html,/id="exampleReturnsLabel">Example returns</);
  assert.match(html,/id="exampleReturnsNote">These three returns are examples for this plan\. They are not a forecast\./);
  assert.match(html,/id="exampleReturnsFields"[^>]*role="group"[^>]*aria-labelledby="exampleReturnsLabel"/);
  assert.match(html,/for="scenarioRate1">Low</);
  assert.match(html,/id="scenarioRate1"[^>]*value="4"[^>]*aria-label="Low example return, percent"/);
  assert.match(html,/for="scenarioRate2">Middle</);
  assert.match(html,/id="scenarioRate2"[^>]*value="7"[^>]*aria-label="Middle example return, percent"/);
  assert.match(html,/for="scenarioRate3">High</);
  assert.match(html,/id="scenarioRate3"[^>]*value="10"[^>]*aria-label="High example return, percent"/);
  assert.match(html,/id="scenarioCards"[^>]*role="group"[^>]*aria-label="Example return results"/);
});

test('the investment return link opens Scenarios and focuses the low example',()=>{
  const html=read('index.html');
  const ui=read('view-density.js');
  assert.match(html,/id="exampleReturnsLink">Example returns</);
  assert.match(html,/aria-label="More about the expected yearly return"/);
  assert.match(html,/Effective annual return before Box 3 tax\./);
  assert.match(ui,/exampleReturnsLink/);
  assert.match(ui,/data-tab="scenarios"/);
  assert.match(ui,/getElementById\('scenarioRate1'\)\?\.focus\(\)/);
});

test('approved short notices keep their full text behind named info buttons',()=>{
  const html=read('index.html');
  assert.match(html,/This planner doesn't check what a lender would let you borrow\. Ask a lender or an AFM-licensed adviser\./);
  assert.match(html,/aria-label="More about borrowing limits"/);
  assert.match(html,/aria-label="More about the proposed Box 3 law"/);
  assert.match(read('scenario-engine.js'),/Start blank\./);
  assert.match(read('scenario-engine.js'),/Enter new values here\./);
  assert.match(read('box1-2026-ui.js'),/Include own-home tax effect/);
  assert.match(read('box1-2026-ui.js'),/aria-label="More about the own-home tax effect"/);
  assert.match(read('box1-2026-ui.js'),/Tax estimate: employees below AOW age, simple cases only\./);
  assert.match(read('box1-2026-ui.js'),/aria-label="More about the Box 1 tax scope"/);
  assert.match(read('next-euro.js'),/Ends higher in this model at your return/);
  assert.match(read('next-euro.js'),/Returns can fall short of this rate; an extra repayment is more certain\./);
  assert.doesNotMatch(read('next-euro.js'),/This reruns the production Repay mortgage vs Invest comparison/);
});
