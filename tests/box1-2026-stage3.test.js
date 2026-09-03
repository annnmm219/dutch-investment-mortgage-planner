'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const FC=require('../finance-core.js');
const Box1=require('../box1-2026.js');

function approx(actual,expected,tolerance=1e-6,message=''){
  assert.ok(Number.isFinite(actual),`${message} actual value is not finite: ${actual}`);
  assert.ok(Math.abs(actual-expected)<=tolerance,`${message} expected ${expected}, got ${actual}`);
}

test('2026 non-AOW Box 1 tax applies all three progressive rates',()=>{
  const R=Box1.BOX1_2026_RULES;
  approx(Box1.progressiveBox1Tax2026(R.firstThreshold),R.firstThreshold*R.firstRate,1e-9,'first threshold');
  approx(
    Box1.progressiveBox1Tax2026(R.topThreshold),
    R.firstThreshold*R.firstRate+(R.topThreshold-R.firstThreshold)*R.secondRate,
    1e-9,
    'top threshold'
  );
  approx(
    Box1.progressiveBox1Tax2026(100000),
    R.firstThreshold*R.firstRate+(R.topThreshold-R.firstThreshold)*R.secondRate+(100000-R.topThreshold)*R.topRate,
    1e-9,
    'top bracket'
  );
});

test('high-income EWF and deduction case crosses from false benefit to €115.05 tax cost',()=>{
  const x=Box1.ownHomeBox1Tax2026({
    box1IncomeBeforeOwnHome:80000,
    ewfIncome:1750,
    deductibleOwnHomeCosts:2000
  });
  assert.equal(x.supported,true);
  approx(x.highIncomeAdjustmentBase,2000,1e-9,'adjustment base');
  approx(x.highIncomeAdjustment,238.8,1e-9,'11.94% adjustment');
  approx(x.taxBenefit,-115.05,1e-9,'net own-home effect');
  assert.ok(x.taxBenefit<0,'the result must be a tax cost, not a benefit');
});

test('the same €250 net deduction receives the first-bracket rate below the threshold',()=>{
  const x=Box1.ownHomeBox1Tax2026({
    box1IncomeBeforeOwnHome:30000,
    ewfIncome:1750,
    deductibleOwnHomeCosts:2000
  });
  approx(x.highIncomeAdjustment,0,1e-12);
  approx(x.taxBenefit,89.375,1e-9);
});

test('2026 Hillen relief leaves the correct taxable positive own-home balance',()=>{
  const x=Box1.ownHomeBox1Tax2026({
    box1IncomeBeforeOwnHome:60000,
    ewfIncome:1400,
    deductibleOwnHomeCosts:500
  });
  approx(x.grossOwnHomeBalance,900,1e-12);
  approx(x.hillenDeduction,646.803,1e-9);
  approx(x.netOwnHomeIncome,253.197,1e-9);
  approx(x.taxBenefit,-95.1007932,1e-7);
});

test('automatic annual allocation exposes a complete auditable Box 1 trace',()=>{
  const rows=Array.from({length:12},(_,index)=>({
    year:2026,
    month:index+1,
    gross:500,
    interest:2000/12,
    deductibleInterest:2000/12,
    principal:500-2000/12,
    extra:0,
    requestedExtra:0,
    homeOwned:true,
    hraEligible:true
  }));
  const x=Box1.allocateExactTax(rows,{
    enabled:true,
    calculationMode:'box1-2026',
    box1IncomeBeforeOwnHome:80000,
    wozValue:500000
  },FC);
  const bucket=x.annualBuckets[2026];
  approx(bucket.ewfIncome,1750,1e-9);
  approx(bucket.deductibleOwnHomeCosts,2000,1e-9);
  approx(bucket.highIncomeAdjustment,238.8,1e-9);
  approx(bucket.taxBenefit,-115.05,1e-9);
  approx(x.rows.reduce((sum,row)=>sum+row.taxReturn,0),x.totalTaxBenefit,1e-9,'monthly reconciliation');
  assert.equal(bucket.box1Trace.method,'bounded-2026-box1-before-after');
});

test('mortgage schedule retains HRA duration and qualifying debt share while EWF continues',()=>{
  const m=FC.mortgageSchedule({
    balance:120000,
    annualRatePct:4,
    termYears:20,
    type:'annuity',
    months:12,
    startYear:2026,
    startMonth:1,
    tax:{
      enabled:true,
      calculationMode:'box1-2026',
      box1IncomeBeforeOwnHome:60000,
      wozValue:400000,
      hraRemainingMonths:6,
      qualifyingInterestFraction:.5
    }
  });
  const bucket=m.annualTaxBuckets[2026];
  const expectedDeductible=m.rows.slice(0,6).reduce((sum,row)=>sum+row.interest*.5,0);
  approx(bucket.deductibleInterest,expectedDeductible,1e-9,'eligible qualifying interest');
  approx(bucket.ewfIncome,1400,1e-9,'full-year EWF');
  assert.equal(bucket.ownershipMonths,12);
  assert.equal(bucket.eligibleMonths,6);
  approx(m.rows.reduce((sum,row)=>sum+row.taxReturn,0),m.totalTaxBenefit,1e-9,'schedule reconciliation');
});

test('unsupported Box 1 profiles are rejected instead of silently using the ordinary profile',()=>{
  const direct=Box1.ownHomeBox1Tax2026({
    profile:'aow-or-other-profile',
    box1IncomeBeforeOwnHome:60000,
    ewfIncome:1400,
    deductibleOwnHomeCosts:10000
  });
  assert.equal(direct.supported,false);
  assert.match(direct.unsupportedReasons.join(' '),/non-AOW ordinary-employment/i);

  assert.throws(()=>FC.mortgageSchedule({
    balance:100000,
    annualRatePct:4,
    termYears:20,
    months:12,
    tax:{
      enabled:true,
      calculationMode:'box1-2026',
      box1IncomeBeforeOwnHome:60000,
      box1Profile:'aow-or-other-profile',
      wozValue:400000
    }
  }),/Box 1 estimate unavailable/);
});

test('manual mode remains backward compatible with the legacy percentage bridge',()=>{
  const legacy=FC.mortgageTaxBenefit({
    calculationMode:'manual-rate',
    interest:10000,
    months:12,
    deductionRate:.3756,
    wozValue:400000,
    enabled:true
  });
  approx(legacy,3230.16,1e-6);
});

test('browser loads the Box 1 decorator immediately after FinanceCore and before every caller',()=>{
  const fs=require('node:fs');
  const path=require('node:path');
  const html=fs.readFileSync(path.resolve(__dirname,'..','index.html'),'utf8');
  const scripts=[...html.matchAll(/<script\s+src="([^"]+)"/g)]
    .map(match=>match[1].split('?')[0])
    .filter(source=>!/^https?:\/\//i.test(source));
  const finance=scripts.indexOf('finance-core.js');
  const box1=scripts.indexOf('box1-2026.js');
  const box1Ui=scripts.indexOf('box1-2026-ui.js');
  const logic=scripts.indexOf('logic-integrity-ui.js');
  assert.ok(finance>=0&&box1===finance+1&&box1Ui===box1+1&&logic===box1Ui+1,`unexpected script order: ${scripts.join(', ')}`);
});

test('browser module discloses bounded scope and exposes a year-by-year audit bridge',()=>{
  const fs=require('node:fs');
  const path=require('node:path');
  const source=fs.readFileSync(path.resolve(__dirname,'..','box1-2026-ui.js'),'utf8');
  assert.match(source,/Bounded automatic Box 1 scope/);
  assert.match(source,/Year-by-year Box 1 own-home tax bridge/);
  assert.match(source,/2026 non-AOW employment profile/);
  assert.match(source,/In projection years after 2026/);
});
