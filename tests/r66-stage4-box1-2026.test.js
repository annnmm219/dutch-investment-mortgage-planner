'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const Policy2026=require('../policy-2026.js');
const FC=require('../finance-core.js');
const Box1=require('../box1-2026.js');

function approx(actual,expected,tolerance=1e-6,message=''){
  assert.ok(Number.isFinite(actual),`${message} actual value is not finite: ${actual}`);
  assert.ok(Math.abs(actual-expected)<=tolerance,`${message} expected ${expected}, got ${actual}`);
}

test('Stage 4 policy registry contains the dated 2026 own-home rate adjustment',()=>{
  const policy=Policy2026.VALUES.box1;
  approx(policy.ownHomeHighIncomeAdjustmentRate,.1194,1e-12);
  approx(policy.preAowBrackets.at(-1).rate-policy.ownHomeDeductionMaxRate,policy.ownHomeHighIncomeAdjustmentRate,1e-12);
  const item=Policy2026.getItem('box1.ownHomeHighIncomeAdjustmentRate');
  assert.equal(item.taxYear,2026);
  assert.equal(item.status,'final');
  assert.equal(item.authority,'Belastingdienst');
  assert.equal(item.lastVerifiedAt,'2026-09-03');
  assert.match(item.sourceUrl,/tariefsaanpassing-eigen-woning/);
});

test('2026 non-AOW Box 1 tax applies all three progressive brackets from policy',()=>{
  const brackets=Policy2026.VALUES.box1.preAowBrackets;
  const first=brackets[0],second=brackets[1],top=brackets[2];
  approx(Box1.progressiveBox1Tax2026(first.upper),first.upper*first.rate,1e-9,'first threshold');
  approx(
    Box1.progressiveBox1Tax2026(second.upper),
    first.upper*first.rate+(second.upper-second.lower)*second.rate,
    1e-9,
    'second threshold'
  );
  approx(
    Box1.progressiveBox1Tax2026(100000),
    first.upper*first.rate+(second.upper-second.lower)*second.rate+(100000-top.lower)*top.rate,
    1e-9,
    'top bracket'
  );
});

test('high-income EWF and deduction case changes the old false benefit into €115.05 tax cost',()=>{
  const x=Box1.ownHomeBox1Tax2026({
    box1IncomeBeforeOwnHome:80000,
    ewfIncome:1750,
    deductibleOwnHomeCosts:2000
  });
  assert.equal(x.supported,true);
  approx(x.highIncomeAdjustmentBase,2000,1e-9,'adjustment base');
  approx(x.highIncomeAdjustment,238.8,1e-9,'11.94% adjustment');
  approx(x.taxBenefit,-115.05,1e-9,'net own-home effect');
  assert.ok(x.taxBenefit<0,'the own-home result must be a modeled tax cost, not a benefit');
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

test('statutory high-income adjustment is capped at qualifying own-home deductions',()=>{
  const x=Box1.ownHomeBox1Tax2026({
    box1IncomeBeforeOwnHome:80000,
    ewfIncome:4000,
    deductibleOwnHomeCosts:3500
  });
  assert.equal(x.supported,true);
  assert.ok(x.taxableIncomeAfterOwnHome+x.deductibleOwnHomeCosts-Policy2026.VALUES.box1.preAowBrackets.at(-1).lower>x.deductibleOwnHomeCosts);
  approx(x.highIncomeAdjustmentBase,3500,1e-9,'statutory adjustment ceiling');
  approx(x.highIncomeAdjustment,417.9,1e-9,'capped adjustment');
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
  assert.equal(bucket.box1Trace.method,Box1.METHOD);
});

test('mortgage schedule retains HRA duration and qualifying share while EWF continues for ownership months',()=>{
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

test('unsupported automatic profiles are rejected instead of silently generalized',()=>{
  const direct=Box1.ownHomeBox1Tax2026({
    profile:'aow-or-complex-profile',
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
      box1Profile:'aow-or-complex-profile',
      wozValue:400000
    }
  }),/Box 1 estimate unavailable/);
});

test('negative Box 1 income requiring loss treatment is explicitly unsupported',()=>{
  const x=Box1.ownHomeBox1Tax2026({
    box1IncomeBeforeOwnHome:1000,
    ewfIncome:0,
    deductibleOwnHomeCosts:5000
  });
  assert.equal(x.supported,false);
  assert.match(x.unsupportedReasons.join(' '),/loss treatment/i);
});

test('manual mode remains backward compatible with the explicitly selected one-rate bridge',()=>{
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
