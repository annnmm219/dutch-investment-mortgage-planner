'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {run}=require('../scripts/verify-stage91-50-scenarios.js');

test('Stage 9.1 reconciles all 50 deterministic scenarios with only explained corrections',()=>{
  const {summary,rows}=run();
  assert.equal(summary.scenarios,50);
  assert.equal(summary.reconciled,50);
  assert.equal(summary.unexplainedChanges,0);
  assert.equal(summary.leaderChanges,0);
  assert.equal(rows.length,50);
});
