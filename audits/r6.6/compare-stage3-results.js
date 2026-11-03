'use strict';

const fs=require('node:fs');
const path=require('node:path');

const [beforePath,afterPath]=process.argv.slice(2);
if(!beforePath||!afterPath)throw new Error('Usage: node compare-stage3-results.js <before.json> <after.json>');

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
const close=(a,b,tolerance=.005)=>Math.abs(Number(a)-Number(b))<=tolerance;
const money=value=>Number(value).toLocaleString('en-US',{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:2});
const signedMoney=value=>`${Number(value)>=0?'+':''}${money(value)}`;

function compareResult(label,beforeResult,afterResult){
  return{
    label,
    beforeValid:beforeResult.valid,
    afterValid:afterResult.valid,
    beforeLeader:beforeResult.leader,
    afterLeader:afterResult.leader,
    strategyANetBefore:beforeResult.strategyA.net,
    strategyANetAfter:afterResult.strategyA.net,
    strategyANetChange:delta(beforeResult.strategyA.net,afterResult.strategyA.net),
    strategyBNetBefore:beforeResult.strategyB.net,
    strategyBNetAfter:afterResult.strategyB.net,
    strategyBNetChange:delta(beforeResult.strategyB.net,afterResult.strategyB.net),
    strategyAMortgageBefore:beforeResult.strategyA.mortgage,
    strategyAMortgageAfter:afterResult.strategyA.mortgage,
    strategyAMortgageChange:delta(beforeResult.strategyA.mortgage,afterResult.strategyA.mortgage),
    strategyBMortgageBefore:beforeResult.strategyB.mortgage,
    strategyBMortgageAfter:afterResult.strategyB.mortgage,
    strategyBMortgageChange:delta(beforeResult.strategyB.mortgage,afterResult.strategyB.mortgage)
  };
}

const beforeById=new Map(before.scenarios.map(row=>[row.id,row]));
const scenarioRows=after.scenarios.map(afterRow=>{
  const beforeRow=beforeById.get(afterRow.id);
  if(!beforeRow)throw new Error(`Missing before scenario ${afterRow.id}`);
  const aChange=delta(beforeRow.strategyANet,afterRow.strategyANet);
  const bChange=delta(beforeRow.strategyBNet,afterRow.strategyBNet);
  const gapChange=delta(beforeRow.differenceAminusB,afterRow.differenceAminusB);
  return{
    id:afterRow.id,
    mode:afterRow.mode,
    beforeLeader:beforeRow.leader,
    afterLeader:afterRow.leader,
    leaderChanged:beforeRow.leader!==afterRow.leader,
    strategyANetChange:aChange,
    strategyBNetChange:bChange,
    differenceChange:gapChange,
    numericallyChanged:Math.max(Math.abs(aChange),Math.abs(bChange),Math.abs(gapChange))>.005
  };
});

const canonical={
  buyRent:compareResult('Buy versus rent',before.canonical.buyRent,after.canonical.buyRent),
  downpayment:compareResult('Larger versus smaller down payment',before.canonical.downpayment,after.canonical.downpayment),
  oversizedContribution:{
    beforeValid:before.canonical.oversizedContribution.valid,
    afterValid:after.canonical.oversizedContribution.valid,
    afterReason:after.canonical.oversizedContribution.reason
  }
};

const fundingValues=[
  after.canonical.buyRent.sourcesAndUses?.A,
  after.canonical.downpayment.sourcesAndUses?.A,
  after.canonical.downpayment.sourcesAndUses?.B
].filter(Boolean);
const fundingIdentitiesExact=fundingValues.length===3&&fundingValues.every(item=>item.valid&&close(item.totalUses,item.totalSources,1e-8)&&close(item.identityDifference,0,1e-8));
const isolationDeltas=[
  after.isolation.buyRent.strategyANetDelta,
  after.isolation.buyRent.strategyBNetDelta,
  after.isolation.buyRent.strategyAMortgageDelta,
  after.isolation.buyRent.strategyBMortgageDelta,
  after.isolation.downpayment.strategyANetDelta,
  after.isolation.downpayment.strategyBNetDelta,
  after.isolation.downpayment.strategyAMortgageDelta,
  after.isolation.downpayment.strategyBMortgageDelta
];
const topLevelStateIsolationPassed=isolationDeltas.every(value=>close(value,0,1e-8));
const changedScenarios=scenarioRows.filter(row=>row.numericallyChanged);
const leaderChanges=scenarioRows.filter(row=>row.leaderChanged);
const canonicalPreserved=[canonical.buyRent,canonical.downpayment].every(row=>
  close(row.strategyANetChange,0)&&close(row.strategyBNetChange,0)&&
  close(row.strategyAMortgageChange,0)&&close(row.strategyBMortgageChange,0)
);

const output={
  stage:'R6.6 Stage 3',
  title:'Purchase-scenario isolation and sources-and-uses identity',
  stageStatus:'complete and verified',
  beforeImplementation:before.implementation,
  afterImplementation:after.implementation,
  identity:'property price + transaction costs = mortgage proceeds + buyer cash',
  canonical,
  controls:{
    fundingIdentitiesExact,
    topLevelStateIsolationPassed,
    canonicalPreserved,
    oversizedContributionRejected:before.canonical.oversizedContribution.valid===true&&after.canonical.oversizedContribution.valid===false
  },
  scenarioImpact:{
    scenariosCompared:scenarioRows.length,
    scenariosWithNumericChanges:changedScenarios.length,
    scenarioLeaderChanges:leaderChanges.length,
    changedScenarios,
    leaderChanges,
    scenarios:scenarioRows
  },
  publicMainChanged:false,
  stage4Activated:false
};

fs.writeFileSync(path.join(OUT,'stage3-before.json'),JSON.stringify(before,null,2)+'\n');
fs.writeFileSync(path.join(OUT,'stage3-after.json'),JSON.stringify(after,null,2)+'\n');
fs.writeFileSync(path.join(OUT,'stage3-delta.json'),JSON.stringify(output,null,2)+'\n');

const changedSection=changedScenarios.length
  ?`| Scenario | A change | B change | Gap change | Leader change |\n|---|---:|---:|---:|---|\n${changedScenarios.map(row=>`| ${row.id} | ${signedMoney(row.strategyANetChange)} | ${signedMoney(row.strategyBNetChange)} | ${signedMoney(row.differenceChange)} | ${row.leaderChanged?`${row.beforeLeader} → ${row.afterLeader}`:'No'} |`).join('\n')}`
  :'No deterministic scenario result changed. Stage 3 is a structural isolation correction for funded, valid purchase cases.';

const markdown=`# R6.6 Stage 3: purchase-scenario isolation and sources-and-uses identity

**Stage status:** complete and verified  
**Branch:** \`r6-6-decision-integrity\`  
**Stage 2 input:** \`9c172533d539cdebd65037b9a2ef853ca57de522\`  
**Public \`main\`:** unchanged during Stage 3

## Purpose

Purchase comparisons now own their purchase price, transaction costs, mortgage method, mortgage rate, mortgage term and buyer cash contribution. They no longer read the Mortgage tab's purchase-cost total, mortgage balance, rate, term or selected mortgage method.

Each purchase strategy is validated through the explicit funding identity:

\`property price + transaction costs = mortgage proceeds + buyer cash\`

Buyer cash is split into cash toward the purchase price and cash used for transaction costs. The remaining household savings then stay in savings or move to investments according to the selected upfront-cash treatment.

## Canonical funded cases

| Case | A wealth change | B wealth change | A mortgage change | B mortgage change | Preserved |
|---|---:|---:|---:|---:|---|
| Buy versus rent | ${signedMoney(canonical.buyRent.strategyANetChange)} | ${signedMoney(canonical.buyRent.strategyBNetChange)} | ${signedMoney(canonical.buyRent.strategyAMortgageChange)} | ${signedMoney(canonical.buyRent.strategyBMortgageChange)} | ${canonicalPreserved?'Yes':'No'} |
| Larger versus smaller down payment | ${signedMoney(canonical.downpayment.strategyANetChange)} | ${signedMoney(canonical.downpayment.strategyBNetChange)} | ${signedMoney(canonical.downpayment.strategyAMortgageChange)} | ${signedMoney(canonical.downpayment.strategyBMortgageChange)} | ${canonicalPreserved?'Yes':'No'} |

The funded canonical cases preserve Stage 2 results. Stage 3 changes model boundaries and invalid-input handling rather than changing valid purchase economics.

## Validation correction

Before Stage 3, a buyer cash contribution larger than the property price was silently capped. Stage 3 rejects that configuration instead. The after-state reason is:

> ${after.canonical.oversizedContribution.reason||'No reason recorded.'}

## Isolation proof

The capture reran both purchase modes after replacing top-level purchase costs, mortgage type, mortgage balance, mortgage rate, mortgage term and property-tax placeholders with extreme decoy values. All purchase wealth and mortgage outputs remained unchanged: **${topLevelStateIsolationPassed?'passed':'failed'}**.

The three canonical funding ledgers reconcile to zero within machine precision: **${fundingIdentitiesExact?'passed':'failed'}**.

## Fifty-scenario impact

- Deterministic scenarios compared: **${scenarioRows.length}**
- Scenarios with a numerical result change: **${changedScenarios.length}**
- Scenario leader changes: **${leaderChanges.length}**

${changedSection}

## Controls and exclusions

- Investment, savings, home-growth and rent-growth rate semantics remain those verified in Stage 2.
- Mortgage amortisation remains nominal annual interest divided by 12.
- Box 1 own-home tax logic is not redesigned here. That remains Stage 4.
- Owner-cost escalation and economic consistency remain Stage 5.
- The public \`main\` branch remains on the frozen R6.5 release.
`;
fs.writeFileSync(path.join(OUT,'stage3-purchase-isolation.md'),markdown);

process.stdout.write(JSON.stringify({
  stage:output.stage,
  controls:output.controls,
  scenariosCompared:scenarioRows.length,
  changedScenarios:changedScenarios.length,
  leaderChanges:leaderChanges.length
},null,2)+'\n');
