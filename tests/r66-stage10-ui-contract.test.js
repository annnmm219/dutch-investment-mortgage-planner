'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'..','stage10-remediation.js'),'utf8');

test('Stage 10 hides private-use WOZ unless non-main current-law private use is positive',()=>{
  assert.match(source,/scenarioPropertyPrivateUseWozField/);
  assert.match(source,/classList\.toggle\('hidden',!\(purchase&&nonMain&&box3==='current'&&days>0\)\)/);
  assert.match(source,/if\(days<=0\)priorWoz\.value='0'/);
});
