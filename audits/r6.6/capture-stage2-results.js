'use strict';

const fs=require('node:fs');
const path=require('node:path');
const FC=require('../../finance-core.js');
const LI=require('../../logic-integrity-ui.js');
LI.decorateFinanceCore(FC);
const SC=require('../../scenario-engine.js');
LI.decorateScenarioCore(SC);
const NE=require('../../next-euro.js');
const Contract=require('../../model-contract.js');
const {MODES,baseConfig}=require('../../scripts/verify-50-scenarios.js');

const ROOT=path.resolve(__dirname,'../..');
const round=(value,places=10)=>{
  const n=Number(value);
  if(!Number.isFinite(n))return null;
  const factor=10**places;
  return Math.round(n*factor)/factor;
};
const leader=result=>{
  const difference=result.A.net-result.B.net;
  return Math.abs(difference)<1?'Tie':difference>0?result.A.name:result.B.name;
};
const noTaxBox3=()=>({
  mode:'none',taxPartners:1,paySource:'external',currentTaxRate:.36,currentAllowance:59357,currentNotional:.06,
  currentSavingsNotional:.0128,currentDebtNotional:.027,currentDebtThreshold:3800,firstJan1Portfolio:0,
  firstJan1Savings:0,firstJan1Debt:0,savings:0,debt:0,savingsReturnPct:0,debtInterestPct:0,
  debtMonthlyRepayment:0,debtRepaymentSource:'external',debtFallbackDestination:'invest',
  futureStart:2028,futureTaxRate:.36,futureExempt:1800,futureLossThreshold:500
});

function captureInvestment(){
  const result=FC.simulateInvestmentFlows({
    initialPortfolio:100000,
    flows:Array(360).fill(0),
    annualReturnPct:7,
    startYear:2026,
    startMonth:1,
    box3Mode:'none'
  });
  return{
    input:{initialPortfolio:100000,effectiveAnnualReturnPct:7,months:360,monthlyContributions:0},
    endingPortfolio:round(result.portfolio),
    expectedEffectiveAnnualFormula:round(100000*Math.pow(1.07,30))
  };
}

function captureSavings(){
  const result=FC.simulateInvestmentFlows({
    initialPortfolio:0,
    flows:Array(12).fill(0),
    annualReturnPct:0,
    startYear:2026,
    startMonth:1,
    box3Mode:'none',
    box3Savings:100000,
    savingsReturnPct:2
  });
  return{
    input:{startingSavings:100000,effectiveAnnualSavingsYieldPct:2,months:12},
    endingSavings:round(result.savings),
    expectedEffectiveAnnualFormula:102000
  };
}

function captureMortgage(){
  const result=FC.mortgageSchedule({
    balance:350000,
    annualRatePct:4,
    termYears:30,
    type:'annuity',
    months:360,
    tax:{enabled:false}
  });
  return{
    input:{principal:350000,nominalAnnualRatePct:4,termYears:30,type:'annuity'},
    firstScheduledPayment:round(result.firstScheduled),
    totalInterest:round(result.totalInterest),
    endingBalance:round(result.balance)
  };
}

function baseScenario(mode,months){
  return{
    mode,
    months,
    investmentReturnPct:0,
    startYear:2026,
    startMonth:1,
    startPortfolio:0,
    purchaseCosts:0,
    mortgageType:'annuity',
    mortgage:{balance:0,ratePct:0,years:30},
    tax:{enabled:false,deductionRate:0,wozValue:0,hraRemainingMonths:0,qualifyingInterestFraction:0},
    box3:noTaxBox3(),
    upfrontCashTreatment:'invest',
    homeGrowthPct:0,
    rentGrowthPct:0,
    sellingCostPct:0,
    vveMonthly:0,
    maintenanceAnnual:0,
    ownerTaxesAnnual:0,
    insuranceAnnual:0,
    groundLeaseAnnual:0,
    buyRent:{price:0,cash:0,downPayment:0,monthlyRent:0,mortgageRatePct:0,mortgageYears:30,wozValue:0},
    downpayment:{price:0,cash:0,downA:0,downB:0,mortgageRatePct:0,mortgageYears:30,wozValue:0},
    mortgageInvest:{extraMonthly:0},
    sellRent:{homeValue:0,monthlyRent:0,wozValue:0}
  };
}

function captureHomeGrowth(){
  const config=baseScenario('sell-rent',360);
  config.homeGrowthPct=2;
  config.sellRent={homeValue:100000,monthlyRent:0,wozValue:100000};
  const result=SC.runScenario(config);
  if(result.valid===false)throw new Error(`Home-growth probe invalid: ${result.reason||'unknown reason'}`);
  return{
    input:{startingHomeValue:100000,effectiveAnnualGrowthPct:2,months:360},
    endingHomeValue:round(result.A.equity),
    expectedEffectiveAnnualFormula:round(100000*Math.pow(1.02,30))
  };
}

function captureRentGrowth(){
  const config=baseScenario('buy-rent',13);
  config.rentGrowthPct=3;
  config.buyRent={price:0,cash:0,downPayment:0,monthlyRent:1000,mortgageRatePct:0,mortgageYears:30,wozValue:0};
  const result=SC.runScenario(config);
  if(result.valid===false)throw new Error(`Rent-growth probe invalid: ${result.reason||'unknown reason'}`);
  return{
    input:{startingMonthlyRent:1000,effectiveAnnualGrowthPct:3,monthIndex:12},
    rentInMonth13:round(result.cashB[12]),
    expectedEffectiveAnnualFormula:1030
  };
}

function nextEuroBase(){
  return{
    mode:'mortgage-invest',horizonYears:10,investmentReturnPct:5,startYear:2026,startMonth:1,startPortfolio:0,
    mortgageType:'annuity',mortgage:{balance:300000,ratePct:4,years:30},
    tax:{enabled:false,deductionRate:0,wozValue:0,hraRemainingMonths:0,qualifyingInterestFraction:0},
    box3:noTaxBox3(),mortgageInvest:{extraMonthly:500},
    vveMonthly:0,maintenanceAnnual:0,ownerTaxesAnnual:0,insuranceAnnual:0,groundLeaseAnnual:0
  };
}

function captureNextEuro(){
  const result=NE.findBreakEven(nextEuroBase(),{
    extraMonthly:500,minReturnPct:0,maxReturnPct:10,wealthTolerance:.05
  });
  return{
    input:{mortgageNominalAnnualRatePct:4,extraMonthly:500,horizonYears:10},
    status:result.status,
    breakEvenInvestmentReturnPct:round(result.breakEvenReturnPct),
    mortgageEffectiveAnnualEquivalentPct:round((Math.pow(1+.04/12,12)-1)*100)
  };
}

function captureScenarios(){
  const rows=[];
  MODES.forEach(mode=>{
    for(let index=0;index<10;index++){
      const config=baseConfig(mode,index);
      const result=SC.runScenario(config);
      if(result.valid===false)throw new Error(`${mode}-${index+1} invalid: ${result.reason||'unknown reason'}`);
      rows.push({
        id:`${mode}-${index+1}`,
        mode,
        horizonYears:config.horizonYears,
        investmentReturnPct:config.investmentReturnPct,
        homeGrowthPct:config.homeGrowthPct,
        rentGrowthPct:config.rentGrowthPct,
        box3Mode:config.box3.mode,
        strategyA:result.A.name,
        strategyB:result.B.name,
        strategyANet:round(result.A.net),
        strategyBNet:round(result.B.net),
        differenceAminusB:round(result.A.net-result.B.net),
        leader:leader(result),
        strategyAInvestment:round(result.A.invest),
        strategyBInvestment:round(result.B.invest),
        strategyAEquity:round(result.A.equity),
        strategyBEquity:round(result.B.equity),
        strategyABox3:round(result.A.box3),
        strategyBBox3:round(result.B.box3)
      });
    }
  });
  return rows;
}

const financeSource=fs.readFileSync(path.join(ROOT,'finance-core.js'),'utf8');
const scenarioSource=fs.readFileSync(path.join(ROOT,'scenario-engine.js'),'utf8');
const effectiveActive=financeSource.includes('effectiveAnnualPctToMonthly(annualReturnPct)')
  &&scenarioSource.includes('effectiveAnnualPctToMonthly(S.rentGrowthPct)');

const output={
  stage:'R6.6 Stage 2',
  implementation:effectiveActive?'effective-annual':'legacy-divide-by-12',
  contract:{
    investmentReturn:Contract.RATE_CONVENTIONS.investmentReturn,
    savingsYield:Contract.RATE_CONVENTIONS.savingsYield,
    homeValueGrowth:Contract.RATE_CONVENTIONS.homeValueGrowth,
    rentGrowth:Contract.RATE_CONVENTIONS.rentGrowth,
    mortgageInterest:Contract.RATE_CONVENTIONS.mortgageInterest
  },
  canonical:{
    investment:captureInvestment(),
    savings:captureSavings(),
    homeGrowth:captureHomeGrowth(),
    rentGrowth:captureRentGrowth(),
    mortgageControl:captureMortgage(),
    nextEuro:captureNextEuro()
  },
  scenarios:captureScenarios()
};

process.stdout.write(JSON.stringify(output,null,2)+'\n');
