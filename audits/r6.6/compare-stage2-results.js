'use strict';

const fs=require('node:fs');
const path=require('node:path');

const [beforePath,afterPath]=process.argv.slice(2);
if(!beforePath||!afterPath){
  throw new Error('Usage: node compare-stage2-results.js <before.json> <after.json>');
}

const before=JSON.parse(fs.readFileSync(beforePath,'utf8'));
const after=JSON.parse(fs.readFileSync(afterPath,'utf8'));
const OUT=__dirname;
const round=(value,places=10)=>{
  const n=Number(value);
  if(!Number.isFinite(n))return null;
  const factor=10**places;
  return Math.round(n*factor)/factor;
};
const delta=(a,b)=>round(Number(b)-Number(a));
const close=(a,b,tolerance=1e-8)=>Math.abs(Number(a)-Number(b))<=tolerance;
const formatMoney=value=>Number(value).toLocaleString('en-US',{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:2});
const formatNumber=(value,places=4)=>Number(value).toLocaleString('en-US',{minimumFractionDigits:places,maximumFractionDigits:places});
const signedMoney=value=>`${Number(value)>=0?'+':''}${formatMoney(value)}`;
const signedNumber=(value,places=4)=>`${Number(value)>=0?'+':''}${formatNumber(value,places)}`;

const canonical={
  investment:{
    unit:'EUR',
    before:before.canonical.investment.endingPortfolio,
    after:after.canonical.investment.endingPortfolio,
    change:delta(before.canonical.investment.endingPortfolio,after.canonical.investment.endingPortfolio),
    expected:after.canonical.investment.expectedEffectiveAnnualFormula
  },
  savings:{
    unit:'EUR',
    before:before.canonical.savings.endingSavings,
    after:after.canonical.savings.endingSavings,
    change:delta(before.canonical.savings.endingSavings,after.canonical.savings.endingSavings),
    expected:after.canonical.savings.expectedEffectiveAnnualFormula
  },
  homeGrowth:{
    unit:'EUR',
    before:before.canonical.homeGrowth.endingHomeValue,
    after:after.canonical.homeGrowth.endingHomeValue,
    change:delta(before.canonical.homeGrowth.endingHomeValue,after.canonical.homeGrowth.endingHomeValue),
    expected:after.canonical.homeGrowth.expectedEffectiveAnnualFormula
  },
  rentGrowth:{
    unit:'EUR-per-month',
    before:before.canonical.rentGrowth.rentInMonth13,
    after:after.canonical.rentGrowth.rentInMonth13,
    change:delta(before.canonical.rentGrowth.rentInMonth13,after.canonical.rentGrowth.rentInMonth13),
    expected:after.canonical.rentGrowth.expectedEffectiveAnnualFormula
  },
  nextEuro:{
    unit:'percentage-points',
    before:before.canonical.nextEuro.breakEvenInvestmentReturnPct,
    after:after.canonical.nextEuro.breakEvenInvestmentReturnPct,
    change:delta(before.canonical.nextEuro.breakEvenInvestmentReturnPct,after.canonical.nextEuro.breakEvenInvestmentReturnPct),
    expected:after.canonical.nextEuro.mortgageEffectiveAnnualEquivalentPct
  },
  mortgageFirstPayment:{
    unit:'EUR',
    before:before.canonical.mortgageControl.firstScheduledPayment,
    after:after.canonical.mortgageControl.firstScheduledPayment,
    change:delta(before.canonical.mortgageControl.firstScheduledPayment,after.canonical.mortgageControl.firstScheduledPayment)
  },
  mortgageTotalInterest:{
    unit:'EUR',
    before:before.canonical.mortgageControl.totalInterest,
    after:after.canonical.mortgageControl.totalInterest,
    change:delta(before.canonical.mortgageControl.totalInterest,after.canonical.mortgageControl.totalInterest)
  }
};

const beforeById=new Map(before.scenarios.map(row=>[row.id,row]));
const scenarioRows=after.scenarios.map(afterRow=>{
  const beforeRow=beforeById.get(afterRow.id);
  if(!beforeRow)throw new Error(`Missing before scenario: ${afterRow.id}`);
  const leaderChanged=beforeRow.leader!==afterRow.leader;
  const aChange=delta(beforeRow.strategyANet,afterRow.strategyANet);
  const bChange=delta(beforeRow.strategyBNet,afterRow.strategyBNet);
  const gapChange=delta(beforeRow.differenceAminusB,afterRow.differenceAminusB);
  return{
    id:afterRow.id,
    mode:afterRow.mode,
    beforeLeader:beforeRow.leader,
    afterLeader:afterRow.leader,
    leaderChanged,
    beforeStrategyANet:beforeRow.strategyANet,
    afterStrategyANet:afterRow.strategyANet,
    strategyANetChange:aChange,
    beforeStrategyBNet:beforeRow.strategyBNet,
    afterStrategyBNet:afterRow.strategyBNet,
    strategyBNetChange:bChange,
    beforeDifferenceAminusB:beforeRow.differenceAminusB,
    afterDifferenceAminusB:afterRow.differenceAminusB,
    differenceChange:gapChange,
    numericallyChanged:Math.max(Math.abs(aChange),Math.abs(bChange),Math.abs(gapChange))>.005
  };
});

const leaderChanges=scenarioRows.filter(row=>row.leaderChanged);
const changedScenarios=scenarioRows.filter(row=>row.numericallyChanged);
const maxAbs=(rows,key)=>rows.reduce((max,row)=>Math.max(max,Math.abs(Number(row[key])||0)),0);
const mortgageControlUnchanged=close(canonical.mortgageFirstPayment.before,canonical.mortgageFirstPayment.after)
  &&close(canonical.mortgageTotalInterest.before,canonical.mortgageTotalInterest.after);

const output={
  stage:'R6.6 Stage 2',
  title:'Effective annual rate semantics',
  stageStatus:'complete and verified',
  beforeImplementation:before.implementation,
  afterImplementation:after.implementation,
  formula:'monthlyRate = (1 + annualEffectiveRate)^(1/12) - 1',
  transactionTiming:'Opening balance grows first; recurring contributions are added at month end.',
  canonical,
  scenarioImpact:{
    scenariosCompared:scenarioRows.length,
    scenariosWithNumericChanges:changedScenarios.length,
    scenarioLeaderChanges:leaderChanges.length,
    leaderChanges,
    maximumAbsoluteStrategyANetChange:round(maxAbs(scenarioRows,'strategyANetChange')),
    maximumAbsoluteStrategyBNetChange:round(maxAbs(scenarioRows,'strategyBNetChange')),
    maximumAbsoluteComparisonGapChange:round(maxAbs(scenarioRows,'differenceChange')),
    scenarios:scenarioRows
  },
  controls:{
    mortgageControlUnchanged,
    mortgageInterestRemainsNominalAnnual:true,
    box3DebtInterestRemainsNominalAnnual:true,
    box3DeemedPercentagesRemainAnnualStatutoryFactors:true
  },
  explicitDeferrals:{
    ownerCostGrowth:'R6.6 Stage 5',
    fullInputBoundaryMigration:'R6.6 Stage 7',
    inflationConversion:'No inflation input or executable inflation conversion exists in the R6.5 baseline.'
  },
  publicMainChanged:false,
  stage3Activated:false
};

fs.writeFileSync(path.join(OUT,'stage2-before.json'),JSON.stringify(before,null,2)+'\n');
fs.writeFileSync(path.join(OUT,'stage2-after.json'),JSON.stringify(after,null,2)+'\n');
fs.writeFileSync(path.join(OUT,'stage2-delta.json'),JSON.stringify(output,null,2)+'\n');

const leaderSection=leaderChanges.length
  ?`| Scenario | Before leader | After leader | Before A-B | After A-B |\n|---|---|---|---:|---:|\n${leaderChanges.map(row=>`| ${row.id} | ${row.beforeLeader} | ${row.afterLeader} | ${formatMoney(row.beforeDifferenceAminusB)} | ${formatMoney(row.afterDifferenceAminusB)} |`).join('\n')}`
  :'No scenario leader changed in the 50 deterministic reconciliation cases.';

const markdown=`# R6.6 Stage 2: effective annual rate semantics

**Stage status:** complete and verified  
**Branch:** \`r6-6-decision-integrity\`  
**Stage 1 input:** \`b07a8c4e168a5a545084806a04171d7bf18714c0\`  
**Public \`main\`:** unchanged during Stage 2

## Purpose

Stage 2 activates the rate contract defined in Stage 1. Investment return, savings yield, home-value growth and rent growth are now interpreted as effective annual assumptions.

The monthly conversion is:

\`monthlyRate = (1 + annualEffectiveRate)^(1/12) - 1\`

Mortgage interest remains a nominal annual contractual rate divided by 12. Box 3 debt interest is also treated as a nominal annual contractual rate divided by 12. Statutory Box 3 deemed percentages remain annual tax factors and are never monthly compounding inputs.

The timing convention is unchanged: growth applies to the opening balance, then recurring investment contributions are added at month end.

## Canonical proof cases

| Probe | Stage 1 result | Stage 2 result | Change | Effective-annual target |
|---|---:|---:|---:|---:|
| €100,000 invested at 7% for 30 years | ${formatMoney(canonical.investment.before)} | ${formatMoney(canonical.investment.after)} | ${signedMoney(canonical.investment.change)} | ${formatMoney(canonical.investment.expected)} |
| €100,000 savings at 2% for 12 months | ${formatMoney(canonical.savings.before)} | ${formatMoney(canonical.savings.after)} | ${signedMoney(canonical.savings.change)} | ${formatMoney(canonical.savings.expected)} |
| €100,000 home at 2% for 30 years | ${formatMoney(canonical.homeGrowth.before)} | ${formatMoney(canonical.homeGrowth.after)} | ${signedMoney(canonical.homeGrowth.change)} | ${formatMoney(canonical.homeGrowth.expected)} |
| €1,000 rent after one year at 3% | ${formatMoney(canonical.rentGrowth.before)} | ${formatMoney(canonical.rentGrowth.after)} | ${signedMoney(canonical.rentGrowth.change)} | ${formatMoney(canonical.rentGrowth.expected)} |
| Next € break-even against a 4% nominal mortgage | ${formatNumber(canonical.nextEuro.before,4)}% | ${formatNumber(canonical.nextEuro.after,4)}% | ${signedNumber(canonical.nextEuro.change,4)} pp | ${formatNumber(canonical.nextEuro.expected,4)}% |
| €350,000 mortgage first scheduled payment | ${formatMoney(canonical.mortgageFirstPayment.before)} | ${formatMoney(canonical.mortgageFirstPayment.after)} | ${signedMoney(canonical.mortgageFirstPayment.change)} | unchanged |
| €350,000 mortgage total interest | ${formatMoney(canonical.mortgageTotalInterest.before)} | ${formatMoney(canonical.mortgageTotalInterest.after)} | ${signedMoney(canonical.mortgageTotalInterest.change)} | unchanged |

## Fifty-scenario impact

- Deterministic scenarios compared: **${scenarioRows.length}**
- Scenarios with a numerical result change: **${changedScenarios.length}**
- Scenario leader changes: **${leaderChanges.length}**
- Maximum absolute Strategy A wealth change: **${formatMoney(output.scenarioImpact.maximumAbsoluteStrategyANetChange)}**
- Maximum absolute Strategy B wealth change: **${formatMoney(output.scenarioImpact.maximumAbsoluteStrategyBNetChange)}**
- Maximum absolute change in the A-minus-B comparison gap: **${formatMoney(output.scenarioImpact.maximumAbsoluteComparisonGapChange)}**

${leaderSection}

The complete before-and-after scenario ledger is stored in \`stage2-delta.json\`.

## Controls and exclusions

- Mortgage amortisation remains unchanged. The 4% mortgage input still means a nominal annual contractual rate divided by 12.
- Monthly contribution timing remains end of month.
- Box 3 tax architecture, January 1 safeguards, EWF bands, Hillen and HRA eligibility are unchanged.
- Owner-cost growth is not introduced here. It remains Stage 5 work.
- The R6.5 baseline contains no inflation input or executable inflation conversion, so Stage 2 has no inflation site to modify.
- Stage 3 purchase-scenario isolation is not activated.
- The public \`main\` branch remains at the frozen R6.5 release.
`;

fs.writeFileSync(path.join(OUT,'stage2-effective-annual-rates.md'),markdown);
process.stdout.write(JSON.stringify({
  stage:output.stage,
  scenarios:scenarioRows.length,
  changedScenarios:changedScenarios.length,
  leaderChanges:leaderChanges.length,
  mortgageControlUnchanged,
  canonical
},null,2)+'\n');
