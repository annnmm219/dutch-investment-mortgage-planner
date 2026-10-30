'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Policy=require('../policy-2026.js');

const ui=fs.readFileSync(path.join(__dirname,'..','sale-break-even-ui.js'),'utf8');

test('sale panel uses the approved heading, notice and result wording',()=>{
  const noticeAt=ui.indexOf('id="salePanelDisclaimer"');
  const foldAt=ui.indexOf('<details');
  assert.ok(noticeAt>0&&noticeAt<foldAt);
  assert.match(ui,/Break-even selling price under these assumptions/);
  assert.match(ui,/Illustration under the assumptions you enter\. It does not predict prices or tell you whether to sell or rent\./);
  assert.match(ui,/Use my mortgage assumptions/);
  assert.match(ui,/Compare the full cost of owning your main home with renting over the same period\./);
  assert.match(ui,/Modelled difference vs renting/);
  assert.match(ui,/Modelled difference vs renting and investing/);
  assert.match(ui,/Under these assumptions, the owning path matches renting even at a €0 sale price\. Any remaining mortgage must still be repaid\./);
  assert.match(ui,/Gross sale price before selling costs\. At this price both paths end with the same modelled result\. Above it, the owning path ends higher in this model\./);
  assert.match(ui,/At an assumed selling price of \$\{money\(result\.salePrice\)\} after \$\{result\.months\} months, the sale would \$\{result\.netSaleProceeds>=0\?`leave \$\{money\(result\.netSaleProceeds\)\} in cash`:`need \$\{money\(-result\.netSaleProceeds\)\} of extra cash`\} after selling costs and mortgage repayment\. Under these assumptions, the owning path ends \$\{relation\} the \$\{path\} path\. This is a model result, not a forecast\./);
  assert.match(ui,/id="saleAdvantageSign">Positive: the owning path ends higher in this model\. Negative: the renting path ends higher\./);
  assert.match(ui,/Positive: the owning path ends higher in this model\. Negative: the renting and investing path ends higher\./);
  assert.match(ui,/Basic modelled difference vs renting \(€\)/);
  assert.match(ui,/Modelled difference vs renting and investing \(€\)/);
  assert.match(ui,/Modelled difference at assumed sale price/);
  assert.match(ui,/even if the owning path ends higher in this model\./);
  assert.doesNotMatch(ui,/Positive means owning finishes ahead/);
  assert.doesNotMatch(ui,/Basic advantage versus renting/);
  assert.doesNotMatch(ui,/Advantage including investments/);
  assert.doesNotMatch(ui,/Advantage at assumed sale price/);
  assert.doesNotMatch(ui,/lifetime comparison favours owning/);
  assert.match(ui,/<strong>level with<\/strong>/);
  assert.match(ui,/<strong>\$\{money\(advantage\)\} higher than<\/strong>/);
  assert.match(ui,/<strong>\$\{money\(-advantage\)\} lower than<\/strong>/);
  assert.match(ui,/the basic cash comparison shows the owning path/);
  assert.match(ui,/Basic modelled difference vs renting/);
  assert.doesNotMatch(ui,/What selling price would leave you ahead/);
  assert.doesNotMatch(ui,/Advantage versus renting/);
  assert.doesNotMatch(ui,/Basic financial advantage versus renting/);
  assert.doesNotMatch(ui,/leaves owning/);
  assert.doesNotMatch(ui,/ahead of/);
  assert.doesNotMatch(ui,/behind/);
});

test('sale Box 3 defaults are the policy registry values',()=>{
  const box3=Policy.VALUES.box3;
  assert.match(ui,/Policy2026 must load before sale-break-even-ui\.js/);
  assert.match(ui,/B3\.allowancePerPerson/);
  assert.match(ui,/policyPct\(B3\.taxRate\)/);
  assert.match(ui,/policyPct\(B3\.investmentDeemedRate\)/);
  assert.match(ui,/policyPct\(B3\.savingsDeemedRate\)/);
  assert.match(ui,/policyPct\(B3\.debtDeemedRate\)/);
  assert.match(ui,/B3\.debtThresholdPerPerson/);
  assert.match(ui,/2026 deemed return, savings % \(provisional\)/);
  assert.equal(box3.allowancePerPerson,59357);
  assert.equal(box3.taxRate,.36);
  assert.equal(box3.investmentDeemedRate,.06);
  assert.equal(String(box3.savingsDeemedRate*100),'1.28');
  assert.equal(String(box3.debtDeemedRate*100),'2.7');
  assert.equal(box3.debtThresholdPerPerson,3800);
  assert.equal(Policy.getItem('box3.savingsDeemedRate').status,'provisional');
  assert.doesNotMatch(ui,/value="\$\{59357\}"|Deemed savings return %|,59357,|,1\.28,|,3800,/);
});
