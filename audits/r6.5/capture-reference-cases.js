'use strict';

const FC=require('../../finance-core.js');
const LI=require('../../logic-integrity-ui.js');
LI.decorateFinanceCore(FC);
const SC=require('../../scenario-engine.js');
LI.decorateScenarioCore(SC);
const {baseConfig}=require('../../scripts/verify-50-scenarios.js');

const BASELINE_COMMIT='ac8f029788ff8d1fc2baf09fbc89b848a28f7803';
const round=(value,places=8)=>{
  const number=Number(value);
  if(!Number.isFinite(number))return null;
  const scale=10**places;
  return Math.round(number*scale)/scale;
};

function baseInvestmentConfig(box3Mode){
  return{
    startYear:2026,
    startMonth:1,
    bonusMonth:12,
    startPortfolio:100000,
    phases:[{
      years:10,
      monthlyInvest:500,
      mortgageExtra:0,
      mortgageFreq:'monthly',
      annualBonus:0,
      bonusDest:'invest'
    }],
    annualReturnPct:7,
    mortBalance:0,
    mortRatePct:4,
    mortYears:30,
    mortType:'annuity',
    mortTaxEnabled:false,
    deductRate:0,
    wozValue:0,
    hraRemainingMonths:0,
    qualifyingInterestFraction:0,
    homeOwnershipMonths:0,
    box3Mode,
    taxPartners:1,
    box3PaySource:'savings',
    box3Savings:20000,
    box3Debt:0,
    savingsReturnPct:2,
    debtInterestPct:0,
    box3DebtMonthlyRepayment:0,
    debtRepaymentSource:'external',
    box3DebtFallbackDestination:'invest',
    currentTaxRate:.36,
    currentAllowance:59357,
    currentNotional:.06,
    currentSavingsNotional:.0128,
    currentDebtNotional:.027,
    currentDebtThreshold:3800,
    futureStart:2028,
    futureTaxRate:.36,
    futureExempt:1800,
    futureLossThreshold:500,
    unusedMortgageDestination:'invest'
  };
}

function summarizePlan(result){
  return{
    portfolio:round(result.portfolio),
    savings:round(result.savings),
    box3Debt:round(result.box3Debt),
    netFinancialAssets:round(result.netFinancialAssets),
    householdComparableWealth:round(result.householdComparableWealth),
    totalContributedAndStartingCapital:round(result.invested),
    settledBox3Tax:round(result.box3Tax),
    currentBox3Tax:round(result.currentTax),
    futureBox3Tax:round(result.futureTax),
    unsettledBox3Estimate:round(result.unsettledTaxEstimate),
    taxPaidFromSavings:round(result.taxPaidFromSavings),
    taxPaidFromPortfolio:round(result.taxPaidFromPortfolio),
    taxPaidExternally:round(result.externalTax),
    finalYear:Number(Object.keys(result.yearBuckets||{}).sort().at(-1))||null
  };
}

function summarizeStrategy(strategy){
  return{
    name:strategy.name,
    modeledComparableWealth:round(strategy.net),
    investmentPortfolio:round(strategy.invest),
    savings:round(strategy.savings),
    box3Debt:round(strategy.box3Debt),
    householdFinancialWealth:round(strategy.financial),
    homeEquityAfterSellingCosts:round(strategy.equity),
    mortgageRemaining:round(strategy.mortgage),
    grossMortgageInterest:round(strategy.interest),
    modeledMortgageTaxEffect:round(strategy.mortTax),
    rentPaid:round(strategy.rent),
    ownerCosts:round(strategy.owner),
    purchaseCosts:round(strategy.purchase),
    sellingCosts:round(strategy.selling),
    settledBox3Tax:round(strategy.box3),
    unsettledBox3Estimate:round(strategy.unsettledBox3),
    externalTax:round(strategy.externalTax),
    externalDebtRepayment:round(strategy.externalDebtRepayment)
  };
}

function summarizeScenario(mode,index=2){
  const config=baseConfig(mode,index);
  const result=SC.runScenario(config);
  if(!result.valid)throw new Error(`${mode} baseline unexpectedly invalid: ${result.reason||'unknown reason'}`);
  const difference=result.A.net-result.B.net;
  return{
    inputs:{
      horizonYears:config.horizonYears,
      investmentReturnPct:config.investmentReturnPct,
      box3Mode:config.box3.mode,
      box3TaxPaymentSource:config.box3.paySource,
      mortgageType:config.mortgageType,
      mortgage:config.mortgage,
      purchaseCosts:config.purchaseCosts,
      homeGrowthPct:config.homeGrowthPct,
      rentGrowthPct:config.rentGrowthPct,
      ownerCostInputs:{
        vveMonthly:config.vveMonthly,
        maintenanceAnnual:config.maintenanceAnnual,
        ownerTaxesAnnual:config.ownerTaxesAnnual,
        insuranceAnnual:config.insuranceAnnual,
        groundLeaseAnnual:config.groundLeaseAnnual
      },
      modeSpecific:mode==='buy-rent'?config.buyRent:mode==='mortgage-invest'?config.mortgageInvest:config.mortgage
    },
    result:{
      valid:result.valid,
      strategyA:summarizeStrategy(result.A),
      strategyB:summarizeStrategy(result.B),
      differenceAminusB:round(difference),
      higherModeledOutcome:Math.abs(difference)<1?'Tie':difference>0?result.A.name:result.B.name,
      peakMonthlyRequirement:round(result.peakRequirement),
      firstMonthlyRequirement:round(result.firstRequirement),
      note:result.note||''
    }
  };
}

const noTaxConfig=baseInvestmentConfig('none');
const currentConfig=baseInvestmentConfig('current');
const noTax=FC.simulatePlan(noTaxConfig);
const current=FC.simulatePlan(currentConfig);

const output={
  release:'R6.5',
  baselineCommit:BASELINE_COMMIT,
  purpose:'Pre-R6.6 comparison evidence. These are not R6.6 golden values.',
  r65RateConvention:'Expected investment, savings, rent and home-growth percentages are divided by 12 and compounded monthly in R6.5.',
  transactionConvention:'Monthly investment contributions are added after that month\'s portfolio growth in the current engine.',
  cases:{
    investmentNoBox3:{
      inputs:{startPortfolio:100000,monthlyInvestment:500,horizonYears:10,annualReturnPct:7,startingSavings:20000,savingsReturnPct:2,box3Mode:'none'},
      result:summarizePlan(noTax)
    },
    investmentCurrentBox3:{
      inputs:{startPortfolio:100000,monthlyInvestment:500,horizonYears:10,annualReturnPct:7,startingSavings:20000,savingsReturnPct:2,box3Mode:'current',taxPartners:1,taxPaymentSource:'savings'},
      noTaxCounterfactual:summarizePlan(noTax),
      result:summarizePlan(current)
    },
    buyVersusRent:summarizeScenario('buy-rent'),
    extraRepaymentVersusInvest:summarizeScenario('mortgage-invest'),
    linearVersusAnnuity:summarizeScenario('linear-annuity')
  }
};

process.stdout.write(JSON.stringify(output,null,2)+'\n');
