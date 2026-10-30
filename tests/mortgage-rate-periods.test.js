'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const FC=require('../finance-core.js');
const OI=require('../output-integrity.js');
const State=require('../app-state.js');
const near=(a,b,tolerance=.00001)=>assert.ok(Math.abs(a-b)<=tolerance,`Expected ${b}, got ${a}`);
const periods=[{months:120,annualRatePct:4},{months:240,annualRatePct:6}];
const base={balance:300000,annualRatePct:4,termYears:30,months:360,startYear:2027,tax:{enabled:false},ratePeriods:periods};

test('annuity 4% for ten years then 6% uses independently calculated opening debt and 20-year payment',()=>{
  const r=FC.mortgageSchedule({...base,type:'annuity'});
  near(r.rows[119].balance,236351.87763474364);
  near(r.rows[120].openingBalance,236351.87763474364);
  near(r.rows[120].gross,1693.298258671611);
  near(r.rows[120].interest,1181.7593881737182);
  assert.equal(r.rows[119].annualRatePct,4);
  assert.equal(r.rows[120].annualRatePct,6);
  near(r.balance,0);
  assert.equal(r.payoffMonthIndex,359);
});

test('linear rate reset carries €200,000 into the remaining twenty years, rather than restarting the loan',()=>{
  const r=FC.mortgageSchedule({...base,type:'linear'});
  near(r.rows[120].openingBalance,200000);
  near(r.rows[120].principal,833.3333333333334);
  near(r.rows[120].gross,1833.3333333333333);
  near(r.balance,0);
});

for(const type of ['linear','annuity'])test(`${type}: extra repayments reduce reset debt and standalone/combined schedules agree`,()=>{
  const extra=Array.from({length:360},(_,i)=>i<120?100:0);
  const r=FC.mortgageSchedule({...base,type,extraMonthly:extra});
  const combined=FC.simulatePlan({mortBalance:300000,mortRatePct:4,mortYears:30,mortType:type,mortRatePeriods:periods,startYear:2027,mortTaxEnabled:false,box3Mode:'none',phases:[{years:10,mortgageExtra:100},{years:20,mortgageExtra:0}]});
  near(r.rows[120].openingBalance,r.rows[119].balance);
  assert.ok(r.rows[120].openingBalance<=FC.mortgageSchedule({...base,type}).rows[120].openingBalance-12000+.00001);
  near(combined.grossInterest,r.totalInterest);
  near(combined.mort,r.balance);
  r.rows.forEach((row,i)=>{near(combined.schedule[i].gross,row.gross);near(combined.schedule[i].balance,row.balance);});
  near(r.initialBalance,r.balance+r.totalScheduledPrincipal+r.totalExtra);
});

test('zero interest after reset repays the actual balance over the remaining term',()=>{
  const r=FC.mortgageSchedule({...base,ratePeriods:[periods[0],{months:240,annualRatePct:0}]});
  near(r.rows[120].gross,236351.87763474364/240);
  near(r.rows[120].interest,0);
  near(r.balance,0);
});

test('zero-rate first year and an off-January start reset on the exact month',()=>{
  const r=FC.mortgageSchedule({balance:12000,annualRatePct:0,termYears:2,startYear:2027,startMonth:7,type:'annuity',tax:{enabled:false},ratePeriods:[{months:12,annualRatePct:0},{months:12,annualRatePct:12}]});
  near(r.rows[11].balance,6000);assert.equal(r.rows[12].year,2028);assert.equal(r.rows[12].month,7);
  near(r.rows[12].interest,60);near(r.balance,0);
});

test('payoff before the rate reset does not create a new debt or payment',()=>{
  const r=FC.mortgageSchedule({...base,extraMonthly:50000});
  near(r.rows[120].openingBalance,0);near(r.rows[120].gross,0);near(r.balance,0);
  near(r.initialBalance,r.totalExtra+r.totalScheduledPrincipal);
});

test('rate periods do not restart the remaining mortgage-interest deduction period',()=>{
  const r=FC.mortgageSchedule({...base,tax:{enabled:true,deductionRate:.3756,wozValue:400000,hraRemainingMonths:120}});
  assert.equal(r.rows[119].hraEligible,true);assert.equal(r.rows[120].hraEligible,false);
  near(r.rows[120].deductibleInterest,0);
});

test('disabled reset preserves the known standard annuity values',()=>{
  const r=FC.mortgageSchedule({...base,months:12,ratePeriods:[]});
  near(r.firstScheduled,1432.2458863963616);near(r.balance,294716.89070024405);near(r.totalInterest,11903.841337000376);
});

test('a reset outside the remaining term is omitted and a one-month reset is retained',()=>{
  assert.deepEqual(FC.twoPeriodMortgageRates({enabled:true,termYears:8,fixedYears:10,currentRatePct:4,laterRatePct:6}),[{months:96,annualRatePct:4}]);
  assert.deepEqual(FC.twoPeriodMortgageRates({enabled:true,termYears:30,fixedYears:1/12,currentRatePct:4,laterRatePct:6}),[{months:1,annualRatePct:4},{months:359,annualRatePct:6}]);
  assert.throws(()=>FC.mortgageSchedule({...base,ratePeriods:[{months:0,annualRatePct:4}]}),RangeError);
});

test('a synthetic four-phase investment plan totals 27 years and €702,800, matching a separate annual cash-flow calculation',()=>{
  const phases=[{years:3,monthlyInvest:1000,annualBonus:2000},{years:4,monthlyInvest:1500,annualBonus:4000},{years:8,monthlyInvest:1800,annualBonus:5000},{years:12,monthlyInvest:2000,annualBonus:6000}].map(p=>({...p,bonusDest:'invest',mortgageExtra:0}));
  const config={phases,startYear:2027,startMonth:1,annualReturnPct:7,bonusMonth:12,mortBalance:0,box3Mode:'none',mortTaxEnabled:false};
  const r=FC.simulatePlan(config);
  // Independent reference: monthly end-of-month contributions aggregated to a
  // yearly annuity factor, with the annual bonus paid in December.
  const monthly=Math.pow(1.07,1/12)-1,yearlyContribFactor=.07/monthly;
  let expected=0;for(const phase of phases)for(let y=0;y<phase.years;y++)expected=expected*1.07+phase.monthlyInvest*yearlyContribFactor+phase.annualBonus;
  near(r.portfolio,expected,.001);near(r.invested,702800);assert.equal(r.horizonMonths,324);
  const last=r.series.at(-1);assert.equal(last.year,2053);assert.equal(last.month,12);
  const canonical=OI.canonicalPlanResult(r,r,config);
  assert.equal(OI.outputModel(canonical).headlineValue,OI.formatMoney(expected));
});

test('mortgage reporting covers the remaining loan term independently of 27-year investments, and rate assumptions survive save/reload',()=>{
  assert.equal(State.mortgageReportingMonths({mode:'mortgage',investmentMonths:324,mortgageTermMonths:360}),360);
  const inputs=[{tagName:'INPUT',id:'mortRateResetEnabled',type:'checkbox',checked:true},{tagName:'INPUT',id:'mortRateFixedYears',type:'text',value:'10'},{tagName:'INPUT',id:'mortRateLaterPct',type:'text',value:'6'}];
  const saved=State.normalizePayload(JSON.stringify(State.captureControls(inputs)));
  assert.deepEqual(saved.controls['id:mortRateResetEnabled'],{kind:'checked',value:true});
  assert.equal(saved.controls['id:mortRateLaterPct'].value,'6');
});

test('the replayed rate-period build keeps the frozen R6.6 calculation identity',()=>{
  const id=require('../release-identity.js');
  assert.equal(id.release,'R6.6');
  assert.equal(id.calculationSourceSha,'a4377ce1050277b5ce13b97779c4af27ede94f65');
  assert.equal(id.buildId,'R6.6-stage10-a4377ce1');
  assert.equal(id.frozenAt,'2026-09-15T07:58:07.939Z');
  assert.equal(id.stage,'Stage 10 remediation');
});
