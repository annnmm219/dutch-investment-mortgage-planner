'use strict';

const path=require('node:path');
const root=path.resolve(process.argv[2]||path.join(__dirname,'../..'));
const implementation=process.argv[3]||'working-tree';
const FC=require(path.join(root,'finance-core.js'));
const LI=require(path.join(root,'logic-integrity-ui.js'));
LI.decorateFinanceCore(FC);
const SC=require(path.join(root,'scenario-engine.js'));
LI.decorateScenarioCore(SC);
const {MODES,baseConfig}=require(path.join(__dirname,'../../scripts/verify-50-scenarios.js'));

const round=value=>Math.round(Number(value)*1e8)/1e8;
const leader=result=>Math.abs(result.A.net-result.B.net)<1?'Tie':result.A.net>result.B.net?result.A.name:result.B.name;
const strategy=value=>({
  net:round(value.net),invest:round(value.invest),savings:round(value.savings),box3Debt:round(value.box3Debt),equity:round(value.equity||0),mortgage:round(value.mortgage),
  owner:round(value.owner),interest:round(value.interest),mortTax:round(value.mortTax),purchase:round(value.purchase),selling:round(value.selling),externalTax:round(value.externalTax),
  externalDebtRepayment:round(value.externalDebtRepayment),box3DebtInterest:round(value.box3DebtInterest),externalCashFlowFutureValue:round(value.externalCashFlowFutureValue)
});

const scenarios=[];
for(const mode of MODES){
  for(let index=0;index<10;index++){
    const config=baseConfig(mode,index);
    config.ownerCostGrowthPct=2;
    const result=SC.runScenario(config);
    scenarios.push({id:`${mode}-${index+1}`,mode,valid:result.valid,leader:leader(result),differenceAminusB:round(result.A.net-result.B.net),strategyA:strategy(result.A),strategyB:strategy(result.B)});
  }
}

const ownerProbe=SC.runScenario({
  mode:'buy-rent',months:24,investmentReturnPct:0,startYear:2026,startMonth:1,startPortfolio:0,
  tax:{enabled:false,deductionRate:0,wozValue:1},box3:{mode:'none',taxPartners:1,paySource:'external',savings:1,debt:0,savingsReturnPct:0,debtInterestPct:0},
  upfrontCashTreatment:'savings',homeGrowthPct:0,rentGrowthPct:0,sellingCostPct:0,ownerCostGrowthPct:2,
  vveMonthly:100,maintenanceAnnual:0,ownerTaxesAnnual:0,insuranceAnnual:0,groundLeaseAnnual:0,
  buyRent:{price:1,cash:1,purchaseCosts:0,downPayment:1,monthlyRent:0,mortgageRatePct:0,mortgageYears:1,mortgageType:'annuity'}
});
const externalProbe=FC.simulateInvestmentFlows({initialPortfolio:200000,flows:Array(120).fill(0),annualReturnPct:7,startYear:2026,startMonth:1,box3Mode:'current',taxPartners:1,paySource:'external',currentTaxRate:.36,currentAllowance:0,currentNotional:.06,currentSavingsNotional:.0128,currentDebtNotional:.027,currentDebtThreshold:3800,firstJan1Portfolio:200000,box3Savings:0,box3Debt:0,savingsReturnPct:2,debtInterestPct:4});

process.stdout.write(JSON.stringify({implementation,scenarios,probes:{owner:{month1:round(ownerProbe.cashA[0]),month13:round(ownerProbe.cashA[12]),total:round(ownerProbe.A.owner)},external:{nominalExternalTax:round(externalProbe.externalTax),terminalValue:round(externalProbe.externalCashFlowFutureValue),comparableWealth:round(externalProbe.householdComparableWealth)}}},null,2)+'\n');
