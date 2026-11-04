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

const EXAMPLE_NOTE='Three example yearly returns you can change, to see how much the result depends on the return. They are not forecasts, and none is more likely than the others. Real returns vary and can be lower than all three, including negative.';

test('example returns use Femke\'s label, note and field labels',()=>{
  const html=read('index.html');
  assert.match(html,/id="exampleReturns" tabindex="-1">Example returns</);
  assert.ok(html.includes(EXAMPLE_NOTE));
  assert.match(html,/for="scenarioRate1">Low example return %<\/label><input id="scenarioRate1" type="number" min="-30" max="30" step="0.5" value="4">/);
  assert.match(html,/for="scenarioRate2">Middle example return %<\/label><input id="scenarioRate2" type="number" min="-30" max="30" step="0.5" value="7">/);
  assert.match(html,/for="scenarioRate3">High example return %<\/label><input id="scenarioRate3" type="number" min="-30" max="30" step="0.5" value="10">/);
  assert.doesNotMatch(html,/id="scenarioRate[123]"[^>]*placeholder=/);
  const app=read('app.js');
  assert.match(app,/\$\{names\[i\]\} · \$\{rate\}/);
  assert.match(app,/aria-label',`\$\{names\[i\]\} return, \$\{rate\}`/);
  assert.match(app,/<p class="lab">\$\{names\[i\]\}<\/p><p class="val">Unavailable<\/p><p class="sub">Complete the required inputs\.<\/p>/);
});

test('the example-return card does not add banned planning words outside the approved note',()=>{
  const html=read('index.html');
  const start=html.indexOf('id="exampleReturns"');
  const end=html.indexOf('id="scenarioCards"');
  assert.ok(start>0&&end>start);
  const card=html.slice(start,end).replace(EXAMPLE_NOTE,'');
  const titles=read('app.js').slice(read('app.js').indexOf('function updateScenarios'),read('app.js').indexOf('function updateSchedule'));
  const banned=[/\bexpected\b/i,/\blikely\b/i,/\btarget\b/i,/\bforecasts?\b/i,/\brealistic\b/i,/\bconservative\b/i,/base case/i,/\boptimistic\b/i,/historical average/i,/\brecommended\b/i,/typical market return/i];
  for(const pattern of banned){
    assert.doesNotMatch(card,pattern,`card contains ${pattern}`);
    assert.doesNotMatch(titles,pattern,`titles contain ${pattern}`);
  }
});

test('the example-return link focuses the card label on the Scenarios tab',()=>{
  const html=read('index.html');
  const ui=read('view-density.js');
  assert.match(html,/href="#exampleReturns"[^>]*>Compare with example returns \(Scenarios tab\)<\/a>/);
  assert.match(html,/for="annualReturn">Your yearly return assumption %<\/label>/);
  assert.match(html,/Effective annual return before Box 3 tax\./);
  assert.match(ui,/exampleReturnsLink/);
  assert.match(ui,/data-tab="scenarios"/);
  assert.match(ui,/getElementById\('exampleReturns'\)\?\.focus\(\)/);
  assert.doesNotMatch(ui,/scenarioRate1'\)\?\.focus/);
  const engine=read('scenario-engine.js');
  assert.match(engine,/if\(x\.querySelector\('#exampleReturns'\)\)return;/);
  assert.match(engine,/scenario-legacy-hidden/);
  assert.match(read('scripts/browser-responsiveness-smoke.mjs'),/assertExampleReturnsLink\('click'/);
  assert.match(read('scripts/browser-responsiveness-smoke.mjs'),/assertExampleReturnsLink\('Enter'/);
  assert.match(read('scripts/browser-responsiveness-smoke.mjs'),/state\.active!=='exampleReturns'/);
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
