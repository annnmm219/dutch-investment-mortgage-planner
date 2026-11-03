'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const Box1=require('../box1-2026.js');

function withDocument(values,callback){
  const previous=global.document;
  global.document={
    getElementById(id){
      if(!Object.prototype.hasOwnProperty.call(values,id))return null;
      const value=values[id];
      if(value&&typeof value==='object'&&('value'in value||'checked'in value))return value;
      return{value:String(value)};
    }
  };
  try{return callback();}
  finally{
    if(previous===undefined)delete global.document;
    else global.document=previous;
  }
}

test('browser automatic context carries taxable income, HRA duration, qualifying share and Hillen override',()=>{
  const context=withDocument({
    deductionMode:'auto',
    grossIncome:'73500',
    hraRemainingYears:'12',
    hraRemainingMonths:'5',
    qualifyingBox1DebtPct:'64',
    hillenOverrideEnabled:{checked:true},
    hillenOverridePct:'70'
  },()=>Box1.normalizeTaxConfig({}));

  assert.equal(context.calculationMode,'box1-2026');
  assert.equal(context.box1IncomeBeforeOwnHome,73500);
  assert.equal(context.box1Profile,Box1.PROFILE);
  assert.equal(context.hraRemainingMonths,149);
  assert.equal(context.qualifyingInterestFraction,.64);
  assert.equal(context.hillenRelief,.70);
});

test('browser manual mode still carries HRA duration and qualifying share without activating automatic Box 1',()=>{
  const context=withDocument({
    deductionMode:'manual',
    grossIncome:'90000',
    hraRemainingYears:'7',
    hraRemainingMonths:'11',
    qualifyingBox1DebtPct:'40',
    hillenOverrideEnabled:{checked:false}
  },()=>Box1.normalizeTaxConfig({deductionRate:.31}));

  assert.equal(context.calculationMode,'manual-rate');
  assert.equal(context.deductionRate,.31);
  assert.equal(context.hraRemainingMonths,95);
  assert.equal(context.qualifyingInterestFraction,.40);
  assert.equal(context.box1IncomeBeforeOwnHome,undefined);
});

test('Article 2.10 statutory ceiling caps the Hillen overlap adjustment at actual own-home deductions',()=>{
  const result=Box1.ownHomeBox1Tax2026({
    box1IncomeBeforeOwnHome:80000,
    ewfIncome:4000,
    deductibleOwnHomeCosts:3500,
    hillenRelief:.71867
  });

  assert.equal(result.supported,true);
  assert.equal(result.highIncomeAdjustmentBase,3500);
  assert.ok(result.taxableIncomeAfterOwnHome+result.deductibleOwnHomeCosts-78426>3500);
  assert.ok(Math.abs(result.highIncomeAdjustment-417.9)<1e-9);
  assert.ok(Math.abs(result.taxBenefit-(-487.529175))<1e-6);
});
