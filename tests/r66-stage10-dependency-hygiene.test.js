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

test('Final R6.6 release identity is a SHA-256 manifest of the calculation files',()=>{
  const crypto=require('node:crypto');
  const identity=require('../release-identity.js');
  const lines=identity.calculationManifestFiles.map(file=>{
    const bytes=fs.readFileSync(path.join(ROOT,file));
    return `${file} ${crypto.createHash('sha256').update(bytes).digest('hex')}`;
  });
  const digest=crypto.createHash('sha256').update(lines.join('\n')+'\n').digest('hex');
  assert.equal(identity.calculationManifestSha,digest);
  assert.equal(identity.calculationSourceSha,digest);
  assert.equal(identity.buildId,`R6.6-${digest.slice(0,12)}`);
  assert.equal(identity.frozenFromCommit,'43fa347d122beaf34500189a4e4316f3ed7e5569');
  assert.equal(identity.release,'R6.6');
  assert.equal(identity.frozenAt,'2026-11-10T09:29:50.000Z');
  assert.doesNotMatch(identity.calculationSourceSha,/^a4377ce/);
});
