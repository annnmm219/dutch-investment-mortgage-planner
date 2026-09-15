'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {run}=require('../scripts/verify-stage10-50-scenarios.js');

test('Stage 10 reconciles all 50 deterministic scenarios with only explained legal corrections',()=>{
  const {summary,rows}=run();
  assert.equal(summary.scenarios,50);
  assert.equal(summary.reconciled,50);
  assert.equal(summary.unexplainedChanges,0);
  assert.equal(rows.length,50);
});
