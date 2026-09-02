(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.NibudRules=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';

const nonNegative=v=>Math.max(0,Number(v)||0);
const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));

// ---------------------------------------------------------------------------
// Indicative 2026 "woonquote" (financieringslastpercentage) table.
//
// This is a compact reconstruction assembled from public secondary reporting
// on the Nibud "Advies hypotheeknormen 2026" and the resulting Tijdelijke
// Regeling Hypothecair Krediet percentage tables (single-income basis; a
// second income is added at SECOND_INCOME_WEIGHT_2026 before the lookup,
// matching the household-income basis lenders actually use).
//
// It is NOT a copy of the official Staatscourant regeling table, which is
// published at finer income/rate granularity than reproduced here. Values
// are rounded to the same 0.1-point precision the 2026 regeling itself
// adopted. Treat this as a planning approximation only -- verify the real
// maximum mortgage with a licensed Dutch mortgage adviser or lender before
// relying on it for a purchase decision.
// ---------------------------------------------------------------------------
const INCOME_BREAKPOINTS_2026=[25000,30000,35000,40000,45000,50000,55000,60000,70000,80000,90000,100000];
const RATE_BREAKPOINTS_2026=[3.5,4.0,4.5,5.0];
const WOONQUOTE_TABLE_2026=[
  [22.0,22.5,23.0,23.0],
  [25.5,26.0,26.5,27.0],
  [28.0,28.5,29.0,29.5],
  [29.5,30.0,30.5,31.0],
  [30.5,31.0,31.5,32.0],
  [31.5,32.0,32.5,33.0],
  [32.0,32.5,33.0,33.5],
  [32.5,33.0,33.5,34.0],
  [33.5,34.0,34.5,35.0],
  [34.0,34.5,35.0,35.5],
  [34.5,35.0,35.5,36.0],
  [35.0,35.5,36.0,36.5]
];

const SECOND_INCOME_WEIGHT_2026=1;
const TEST_RATE_FLOOR_PCT_2026=5;
const SHORT_FIXATION_YEARS=10;
const DEFAULT_LTI_TERM_YEARS=30;

function interp1(x,xs,ys){
  const n=xs.length;
  if(n===0)return 0;
  if(n===1||x<=xs[0])return ys[0];
  if(x>=xs[n-1])return ys[n-1];
  for(let i=0;i<n-1;i++){
    if(x>=xs[i]&&x<=xs[i+1]){
      const span=xs[i+1]-xs[i];
      const t=span>0?(x-xs[i])/span:0;
      return ys[i]+(ys[i+1]-ys[i])*t;
    }
  }
  return ys[n-1];
}

function woonquotePct({income=0,testRatePct=4}={}){
  const inc=nonNegative(income);
  const rate=clamp(Number(testRatePct)||0,RATE_BREAKPOINTS_2026[0],RATE_BREAKPOINTS_2026[RATE_BREAKPOINTS_2026.length-1]);
  const rowValues=WOONQUOTE_TABLE_2026.map(row=>interp1(rate,RATE_BREAKPOINTS_2026,row));
  return interp1(inc,INCOME_BREAKPOINTS_2026,rowValues);
}

function testRateForFixation({mortgageRatePct=4,fixedYears=SHORT_FIXATION_YEARS,floorPct=TEST_RATE_FLOOR_PCT_2026,shortFixationYears=SHORT_FIXATION_YEARS,overridePct=null}={}){
  if(overridePct!=null&&Number.isFinite(Number(overridePct)))return{testRatePct:nonNegative(overridePct),usedFloor:false,reason:'manual test-rate override'};
  const rate=nonNegative(mortgageRatePct);
  const years=nonNegative(fixedYears);
  if(years<shortFixationYears){
    const floored=Math.max(rate,floorPct);
    return{testRatePct:floored,usedFloor:floored>rate,reason:`rate fixed under ${shortFixationYears} years is tested at the higher of the contract rate and the ${floorPct}% floor`};
  }
  return{testRatePct:rate,usedFloor:false,reason:`rate fixed ${shortFixationYears}+ years is tested at the contract rate`};
}

function maxLoanFromAnnualHousingCost({annualHousingCost=0,testRatePct=4,termYears=DEFAULT_LTI_TERM_YEARS}={}){
  const monthlyBudget=nonNegative(annualHousingCost)/12;
  if(monthlyBudget<=0)return 0;
  const r=nonNegative(testRatePct)/100/12;
  const n=Math.max(1,Math.round(nonNegative(termYears)*12));
  if(r<=0)return monthlyBudget*n;
  return monthlyBudget*(1-Math.pow(1+r,-n))/r;
}

function affordability({income1=0,income2=0,secondIncomeWeightPct=SECOND_INCOME_WEIGHT_2026*100,mortgageRatePct=4,fixedYears=SHORT_FIXATION_YEARS,termYears=DEFAULT_LTI_TERM_YEARS,testRateOverridePct=null,requestedLoan=0}={}){
  const inc1=nonNegative(income1);
  const inc2=nonNegative(income2);
  const weight=clamp(Number(secondIncomeWeightPct)||0,0,100)/100;
  const combinedIncome=inc1+inc2*weight;
  const testRate=testRateForFixation({mortgageRatePct,fixedYears,overridePct:testRateOverridePct});
  const pct=woonquotePct({income:combinedIncome,testRatePct:testRate.testRatePct});
  const maxAnnualHousingCost=combinedIncome*pct/100;
  const maxLoan=maxLoanFromAnnualHousingCost({annualHousingCost:maxAnnualHousingCost,testRatePct:testRate.testRatePct,termYears});
  const loan=nonNegative(requestedLoan);
  const withinBudget=loan<=maxLoan+1e-6;
  return{
    income1:inc1,income2:inc2,secondIncomeWeightPct:weight*100,combinedIncome,
    testRatePct:testRate.testRatePct,testRateReason:testRate.reason,usedTestRateFloor:testRate.usedFloor,
    woonquotePct:pct,maxAnnualHousingCost,maxMonthlyHousingCost:maxAnnualHousingCost/12,termYears:nonNegative(termYears),maxLoan,
    requestedLoan:loan,withinBudget,marginEuro:maxLoan-loan,marginPct:maxLoan>0?(maxLoan-loan)/maxLoan*100:0,
    notModeled:[
      'Existing debts (personal loans, revolving credit, BKR registrations)',
      'Student-loan (studieschuld) repayment obligations',
      'Paid or received alimony',
      'Energy-label borrowing-room adjustment (can add several percent of room for an A-label-or-better home)',
      'Self-employed / variable-income averaging rules',
      'Lender-specific acceptance policy on top of the regulatory minimum'
    ]
  };
}

return{
  INCOME_BREAKPOINTS_2026,RATE_BREAKPOINTS_2026,WOONQUOTE_TABLE_2026,
  SECOND_INCOME_WEIGHT_2026,TEST_RATE_FLOOR_PCT_2026,SHORT_FIXATION_YEARS,DEFAULT_LTI_TERM_YEARS,
  woonquotePct,testRateForFixation,maxLoanFromAnnualHousingCost,affordability
};
});
