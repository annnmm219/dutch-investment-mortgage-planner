'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const PR=require('../purchase-rules.js');
require('../stage10-remediation.js');

test('F-03 standalone Mortgage purchase surface cannot return an NHG pass without exact a-g inputs',()=>{
  const result=PR.calculatePurchase2026({
    housePrice:460000,
    ownSavings:120000,
    baseCosts:8000,
    transferTaxMode:'main',
    appraisedValue:460000,
    nhgMode:'energy'
  });
  assert.equal(result.nhg.enabled,true);
  assert.equal(result.nhg.eligible,false);
  assert.equal(result.nhgFee,0);
  assert.match(result.nhg.warning,/Exact NHG eligibility requires the official non-energy cost stack/i);
});
