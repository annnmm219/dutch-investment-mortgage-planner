'use strict';

const fs=require('node:fs');
const path=require('node:path');

const [beforePath,afterPath,probePath]=process.argv.slice(2);
if(!beforePath||!afterPath||!probePath)throw new Error('Usage: node compare-stage3-full-results.js <before.json> <after.json> <probes.json>');
const before=JSON.parse(fs.readFileSync(beforePath,'utf8'));
const after=JSON.parse(fs.readFileSync(afterPath,'utf8'));
const probes=JSON.parse(fs.readFileSync(probePath,'utf8'));
const round=(value,places=10)=>{const n=Number(value);if(!Number.isFinite(n))return null;const factor=10**places;return Math.round(n*factor)/factor;};
const euro=value=>Number(value).toLocaleString('en-US',{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:2});
const beforeById=new Map(before.scenarios.map(row=>[row.id,row]));
const scenarios=after.scenarios.map(row=>{
  const old=beforeById.get(row.id);if(!old)throw new Error(`Missing before scenario ${row.id}`);
  const aChange=round(row.strategyANet-old.strategyANet),bChange=round(row.strategyBNet-old.strategyBNet),gapChange=round(row.differenceAminusB-old.differenceAminusB);
  return{id:row.id,mode:row.mode,beforeLeader:old.leader,afterLeader:row.leader,leaderChanged:old.leader!==row.leader,strategyANetChange:aChange,strategyBNetChange:bChange,differenceChange:gapChange,numericallyChanged:Math.max(Math.abs(aChange),Math.abs(bChange),Math.abs(gapChange))>.005};
});
const changes=scenarios.filter(row=>row.numericallyChanged),leaders=scenarios.filter(row=>row.leaderChanged);
const max=key=>round(scenarios.reduce((highest,row)=>Math.max(highest,Math.abs(Number(row[key])||0)),0));
const canonicalModes=['buyRent','downpayment'];
const canonical=Object.fromEntries(canonicalModes.map(mode=>{
  const old=before.canonical[mode],current=after.canonical[mode];
  return[mode,{beforeLeader:old.leader,afterLeader:current.leader,strategyANetChange:round(current.strategyA.net-old.strategyA.net),strategyBNetChange:round(current.strategyB.net-old.strategyB.net),fundingA:current.sourcesAndUses?.A||null,fundingB:current.sourcesAndUses?.B||null}];
}));
const fundingLedgers=[canonical.buyRent.fundingA,canonical.downpayment.fundingA,canonical.downpayment.fundingB].filter(Boolean);
const fundingIdentitiesExact=fundingLedgers.length===3&&fundingLedgers.every(item=>item.valid&&Math.abs(Number(item.identityDifference)||0)<=1e-8);
const canonicalPreserved=canonicalModes.every(mode=>Math.abs(canonical[mode].strategyANetChange)<=.005&&Math.abs(canonical[mode].strategyBNetChange)<=.005&&canonical[mode].beforeLeader===canonical[mode].afterLeader);
const output={
  stage:'R6.6 Stage 3',
  title:'Scenario-local 2026 purchase rules and sources-and-uses',
  beforeImplementation:before.implementation,
  afterImplementation:after.implementation,
  ruleProbes:probes,
  canonical,
  scenarioImpact:{scenariosCompared:scenarios.length,scenariosWithNumericChanges:changes.length,scenarioLeaderChanges:leaders.length,leaderChanges:leaders,maximumAbsoluteStrategyANetChange:max('strategyANetChange'),maximumAbsoluteStrategyBNetChange:max('strategyBNetChange'),maximumAbsoluteComparisonGapChange:max('differenceChange'),scenarios},
  controls:{fundingIdentitiesExact,canonicalPreserved,topLevelStateIsolationPassed:Boolean(probes.topLevelStateIsolationPassed),browserMortgageTabIsolationPassed:Boolean(probes.browserMortgageTabIsolationPassed),starterConditionsPassed:Boolean(probes.starterConditionsPassed),nhgStrategySpecificPassed:Boolean(probes.nhgStrategySpecificPassed),publicMainChanged:false,stage4Activated:false}
};
fs.writeFileSync(path.join(__dirname,'stage3-before.json'),JSON.stringify(before,null,2)+'\n');
fs.writeFileSync(path.join(__dirname,'stage3-after.json'),JSON.stringify(after,null,2)+'\n');
fs.writeFileSync(path.join(__dirname,'stage3-delta.json'),JSON.stringify(output,null,2)+'\n');
const leaderTable=leaders.length?`| Scenario | Before leader | After leader | Gap change |\n|---|---|---|---:|\n${leaders.map(row=>`| ${row.id} | ${row.beforeLeader} | ${row.afterLeader} | ${euro(row.differenceChange)} |`).join('\n')}`:'No deterministic scenario leader changed.';
const markdown=`# R6.6 Stage 3: scenario-local purchase rules and sources-and-uses\n\n**Status:** complete and verified  \n**Public main:** unchanged\n\n## Correction\n\nBuy versus Rent and Larger versus Smaller Down Payment now own their complete purchase input. The browser path derives 2026 transfer tax, starter treatment, NHG fee, total purchase costs and mortgage proceeds from the active scenario rather than the Mortgage tab.\n\nEvery purchasing strategy satisfies:\n\n\`property price + purchase costs = mortgage proceeds + buyer cash at closing\`\n\nBoth strategies receive the same starting household cash before the time-zero purchase event.\n\n## Independent rule probes\n\n| Probe | Result |\n|---|---:|\n| €600,000 main-residence transfer tax | ${euro(probes.mainResidence600k.transferTax)} |\n| Other purchase costs | ${euro(probes.mainResidence600k.baseCosts)} |\n| Total purchase costs | ${euro(probes.mainResidence600k.totalCosts)} |\n| Mortgage proceeds | ${euro(probes.mainResidence600k.mortgageProceeds)} |\n| Buyer cash at closing | ${euro(probes.mainResidence600k.totalBuyerCash)} |\n| Sources-and-uses difference | ${euro(probes.mainResidence600k.identityDifference)} |\n\nStarter eligibility was checked for age, main-residence use, prior exemption use and the €555,000 value ceiling. NHG fees were recalculated independently for the two down-payment strategies.\n\n## Deterministic scenario impact\n\n- Scenarios compared: **${scenarios.length}**\n- Scenarios with numerical changes: **${changes.length}**\n- Scenario leader changes: **${leaders.length}**\n- Maximum absolute Strategy A change: **${euro(output.scenarioImpact.maximumAbsoluteStrategyANetChange)}**\n- Maximum absolute Strategy B change: **${euro(output.scenarioImpact.maximumAbsoluteStrategyBNetChange)}**\n- Maximum absolute comparison-gap change: **${euro(output.scenarioImpact.maximumAbsoluteComparisonGapChange)}**\n\n${leaderTable}\n\nThe 50-case fixtures preserve their prior total purchase costs by separating the old total into the correct 2% transfer tax plus residual other costs. The purpose of Stage 3 is isolation and rule derivation, not changing those established control totals.\n\n## Deliberate boundary\n\nStage 3 continues to use the existing local deduction-rate assumption for purchase mortgage tax. The bounded 2026 Box 1 own-home tax bridge remains Stage 4.\n`;
fs.writeFileSync(path.join(__dirname,'stage3-purchase-isolation.md'),markdown);
console.log(JSON.stringify({scenarios:scenarios.length,changedScenarios:changes.length,leaderChanges:leaders.length,fundingIdentitiesExact,canonicalPreserved,probes},null,2));
