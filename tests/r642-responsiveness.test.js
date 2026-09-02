'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.resolve(__dirname,'..','app-state.js'),'utf8');

test('UX mutation observer disconnects while refresh mutates observed result trees',()=>{
  assert.match(source,/uxObserver\.disconnect\(\)/);
  assert.match(source,/finally\{observeUxTargets\(\);\}/);
  assert.match(source,/new MutationObserver\(refreshUxFromMutation\)/);
  assert.doesNotMatch(source,/new MutationObserver\(\(\)=>refreshUx\(\)\)/);
});

test('UX refresh has a reentrancy guard for nested input events',()=>{
  assert.match(source,/let uxRefreshing=false/);
  assert.match(source,/if\(uxRefreshing\)return/);
  assert.match(source,/finally\{uxRefreshing=false;\}/);
});
