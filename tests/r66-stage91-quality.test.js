'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const Q=require('../stage9-1-quality.js');

test('spreadsheet export neutralizes formula-like text values',()=>{
  assert.equal(Q.spreadsheetSafe('=1+1'),"'=1+1");
  assert.equal(Q.spreadsheetSafe('+SUM(A1:A2)'),"'+SUM(A1:A2)");
  assert.equal(Q.spreadsheetSafe('-2+3'),"'-2+3");
  assert.equal(Q.spreadsheetSafe('@IMPORTXML("x","y")'),"'@IMPORTXML(\"x\",\"y\")");
  assert.equal(Q.spreadsheetSafe('  =cmd'),"'  =cmd");
  assert.equal(Q.spreadsheetSafe('normal text'),'normal text');
  assert.equal(Q.spreadsheetSafe(123.45),'123.45');
});

test('CSV escaping preserves commas, quotes and line breaks after formula neutralization',()=>{
  assert.equal(Q.csvEscape('hello,world'),'"hello,world"');
  assert.equal(Q.csvEscape('a"b'),'"a""b"');
  assert.equal(Q.csvEscape('line1\nline2'),'"line1\nline2"');
  assert.equal(Q.csvEscape('=2+2'),"'=2+2");
});

test('rowsToCsv applies the safe escape to every cell',()=>{
  const csv=Q.rowsToCsv([['Section','Value'],['User','=1+1'],['Comma','a,b']]);
  assert.equal(csv,"Section,Value\r\nUser,'=1+1\r\nComma,\"a,b\"");
});

test('stable main mortgage method accepts only supported methods',()=>{
  assert.equal(Q.normalizeMortgageType('linear'),'linear');
  assert.equal(Q.normalizeMortgageType('annuity'),'annuity');
  assert.equal(Q.normalizeMortgageType(''),null);
  assert.equal(Q.normalizeMortgageType('interest-only'),null);
});
