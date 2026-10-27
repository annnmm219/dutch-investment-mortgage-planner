'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.join(__dirname,'..');

test('F-07 Playwright is upgraded and lockfile contains no environment-specific extraneous path',()=>{
  const pkg=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8'));
  const lock=JSON.parse(fs.readFileSync(path.join(ROOT,'package-lock.json'),'utf8'));
  assert.equal(pkg.devDependencies.playwright,'1.63.0');
  assert.equal(lock.packages['node_modules/playwright'].version,'1.63.0');
  assert.equal(lock.packages['node_modules/playwright-core'].version,'1.63.0');
  const bad=Object.keys(lock.packages||{}).filter(k=>k.includes('/opt/codex')||k.startsWith('../../')||lock.packages[k]?.extraneous===true);
  assert.deepEqual(bad,[]);
});

test('F-07 browser CI enforces high-severity npm audit gate',()=>{
  const workflow=fs.readFileSync(path.join(ROOT,'.github','workflows','browser-responsiveness.yml'),'utf8');
  assert.match(workflow,/npm audit --audit-level=high/);
});

test('Final R6.6 release identity points to the audited hardened calculation source',()=>{
  const identity=require('../release-identity.js');
  assert.equal(identity.calculationSourceSha,'a4377ce1050277b5ce13b97779c4af27ede94f65');
  assert.equal(identity.buildId,'R6.6-stage10-a4377ce1');
  assert.ok(identity.frozenAt);
});
