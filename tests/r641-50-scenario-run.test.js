'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const matrix=require('../scripts/verify-50-scenarios.js');

test('R6.4.2 reconciles exactly 50 deterministic scenarios',()=>{
  const rows=matrix.run();
  assert.equal(rows.length,50);
  assert.equal(rows.filter(row=>row.reconciled).length,50);
});
