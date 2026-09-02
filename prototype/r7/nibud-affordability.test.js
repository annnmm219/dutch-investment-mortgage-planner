'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const NR=require('./nibud-affordability.js');

function approx(actual,expected,tolerance=1e-6,message=''){
  assert.ok(Number.isFinite(actual),`${message} actual value is not finite: ${actual}`);
  assert.ok(Math.abs(actual-expected)<=tolerance,`${message} expected ${expected}, got ${actual}`);
}

test('woonquote lookup matches the prototype table at breakpoint values',()=>{
  approx(NR.woonquotePct({income:45000,testRatePct:4.0}),31.0,1e-9);
  approx(NR.woonquotePct({income:80000,testRatePct:4.0}),34.5,1e-9);
});

test('woonquote lookup interpolates between income breakpoints',()=>{
  approx(NR.woonquotePct({income:42500,testRatePct:4.0}),30.5,1e-9);
});

test('woonquote lookup interpolates between rate breakpoints',()=>{
  approx(NR.woonquotePct({income:50000,testRatePct:4.0}),32.0,1e-9);
  approx(NR.woonquotePct({income:50000,testRatePct:4.25}),32.25,1e-9);
});

test('woonquote lookup clamps outside the prototype range',()=>{
  approx(NR.woonquotePct({income:10000,testRatePct:4.0}),NR.woonquotePct({income:25000,testRatePct:4.0}),1e-9);
  approx(NR.woonquotePct({income:150000,testRatePct:4.0}),NR.woonquotePct({income:100000,testRatePct:4.0}),1e-9);
});

test('a rate fixed 10+ years is tested at the contract rate',()=>{
  const x=NR.testRateForFixation({mortgageRatePct:4.0,fixedYears:10});
  approx(x.testRatePct,4.0,1e-9);
  assert.equal(x.usedFloor,false);
});

test('a rate fixed under 10 years is floored at the prototype test rate',()=>{
  const low=NR.testRateForFixation({mortgageRatePct:3.0,fixedYears:5});
  approx(low.testRatePct,5.0,1e-9);
  assert.equal(low.usedFloor,true);
});

test('max-loan conversion is internally consistent with the prototype housing budget',()=>{
  const x=NR.affordability({income1:80000,income2:0,mortgageRatePct:4.0,fixedYears:10,termYears:30});
  const r=x.testRatePct/100/12,n=30*12;
  const impliedMonthlyPayment=x.maxLoan*r/(1-Math.pow(1+r,-n));
  approx(impliedMonthlyPayment,x.maxMonthlyHousingCost,1e-6);
});

test('zero income produces zero housing budget and zero max loan',()=>{
  const x=NR.affordability({income1:0,income2:0,mortgageRatePct:4.0,fixedYears:10,requestedLoan:100000});
  approx(x.maxAnnualHousingCost,0,1e-9);
  approx(x.maxLoan,0,1e-9);
  assert.equal(x.withinBudget,false);
});

// These tests intentionally preserve the prototype's own internal assumptions.
// They are not official-table golden tests and must not be used to validate a
// future public affordability feature.
