'use strict';

const FC=require('../../finance-core.js');
const LI=require('../../logic-integrity-ui.js');
LI.decorateFinanceCore(FC);
const SC=require('../../scenario-engine.js');
const PR=require('../../purchase-rules.js');
LI.decorateScenarioCore(SC);
const {MODES,baseConfig}=require('../../scripts/verify-50-scenarios.js');

const round=(value,places=10)=>{
  const n=Number(value);
  if(!Number.isFinite(n))return null;
  const factor=10**places;
  return Math.round(n*factor)/factor;
};
const clone=value=>JSON.parse(JSON.stringify(value));
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

function purchaseBase(mode){
  return{
    mode,
    horizonYears:10,
    investmentReturnPct:5,
    startYear:2026,
    startMonth:1,
    startPortfolio:25000,
    purchaseCosts:15000,
    purchaseRules:{enabled:true,transferTaxMode:'main',manualTransferTax:0,appraisedValue:350000,nhgMode:'none',buyerAge:35,starterMainResidence:true,starterExemptionUnused:true},
    mortgageType:'annuity',
    mortgage:{balance:999999,ratePct:19,years:1},
    tax:{enabled:false,deductionRate:0,wozValue:999999,hraRemainingMonths:0,qualifyingInterestFraction:0},
    box3:{...noTaxBox3(),savings:120000},
    upfrontCashTreatment:'invest',
    homeGrowthPct:2,
    rentGrowthPct:2.5,
    sellingCostPct:2,
    vveMonthly:250,
    maintenanceAnnual:1500,
    ownerTaxesAnnual:500,
    insuranceAnnual:250,
    groundLeaseAnnual:0,
    buyRent:{
      price:350000,cash:120000,purchaseCosts:8000,downPayment:70000,monthlyRent:1600,
      mortgageRatePct:4,mortgageYears:30,mortgageType:'annuity',wozValue:350000
    },
    downpayment:{
      price:350000,cash:120000,purchaseCosts:8000,downA:80000,downB:30000,
      mortgageRatePct:4,mortgageYears:30,mortgageType:'annuity',wozValue:350000
    },
    mortgageInvest:{extraMonthly:500},
    sellRent:{homeValue:400000,monthlyRent:1600,wozValue:400000}
  };
}

function summarizeFunding(value){
  if(!value)return null;
  return{
    valid:Boolean(value.valid),
    propertyPrice:round(value.propertyPrice),
    transactionCosts:round(value.transactionCosts),
    totalUses:round(value.totalUses),
    mortgageProceeds:round(value.mortgageProceeds),
    buyerCashTowardPrice:round(value.buyerCashTowardPrice),
    buyerCashForCosts:round(value.buyerCashForCosts),
    totalBuyerCash:round(value.totalBuyerCash),
    totalSources:round(value.totalSources),
    identityDifference:round(value.identityDifference),
    availableSavings:round(value.availableSavings),
    remainingSavings:round(value.remainingSavings),
    shortfall:round(value.shortfall),
    source:value.source||null,
    baseCosts:round(value.baseCosts),
    transferTax:round(value.transferTax?.amount),
    nhgFee:round(value.nhgFee),
    warnings:Array.isArray(value.warnings)?value.warnings:[],
    errors:Array.isArray(value.errors)?value.errors.map(error=>({code:error.code,message:error.message})):[]
  };
}

function summarizeResult(result){
  return{
    valid:result.valid!==false,
    reason:result.reason||'',
    leader:result.valid===false?'Unavailable':leader(result),
    strategyA:{name:result.A.name,net:round(result.A.net),investment:round(result.A.invest),savings:round(result.A.savings),mortgage:round(result.A.mortgage),equity:round(result.A.equity)},
    strategyB:{name:result.B.name,net:round(result.B.net),investment:round(result.B.invest),savings:round(result.B.savings),mortgage:round(result.B.mortgage),equity:round(result.B.equity)},
    sourcesAndUses:result.sourcesAndUses?{
      A:summarizeFunding(result.sourcesAndUses.A),
      B:summarizeFunding(result.sourcesAndUses.B)
    }:null
  };
}

function augmentPurchaseConfig(config){
  const c=clone(config);
  if(c.mode==='buy-rent'){
    c.purchaseRules={enabled:true,transferTaxMode:'main',manualTransferTax:0,appraisedValue:null,nhgMode:'none',buyerAge:35,starterMainResidence:true,starterExemptionUnused:true};
    c.buyRent={...c.buyRent,cash:c.buyRent.cash??c.box3.savings,purchaseCosts:Math.max(0,c.purchaseCosts-c.buyRent.price*.02),mortgageType:c.mortgageType};
  }
  if(c.mode==='downpayment'){
    c.purchaseRules={enabled:true,transferTaxMode:'main',manualTransferTax:0,appraisedValue:null,nhgMode:'none',buyerAge:35,starterMainResidence:true,starterExemptionUnused:true};
    c.downpayment={...c.downpayment,cash:c.downpayment.cash??c.box3.savings,purchaseCosts:Math.max(0,c.purchaseCosts-c.downpayment.price*.02),mortgageType:c.mortgageType};
  }
  return c;
}

function captureScenarios(){
  const rows=[];
  MODES.forEach(mode=>{
    for(let index=0;index<10;index++){
      const config=augmentPurchaseConfig(baseConfig(mode,index));
      const result=SC.runScenario(config);
      if(result.valid===false)throw new Error(`${mode}-${index+1} invalid: ${result.reason||'unknown reason'}`);
      rows.push({
        id:`${mode}-${index+1}`,
        mode,
        strategyANet:round(result.A.net),
        strategyBNet:round(result.B.net),
        differenceAminusB:round(result.A.net-result.B.net),
        leader:leader(result),
        strategyAMortgage:round(result.A.mortgage),
        strategyBMortgage:round(result.B.mortgage),
        strategyAPurchaseCosts:round(result.A.purchase),
        strategyBPurchaseCosts:round(result.B.purchase)
      });
    }
  });
  return rows;
}

function captureIsolation(mode){
  const base=purchaseBase(mode);
  const reference=SC.runScenario(base);
  const decoy=clone(base);
  decoy.purchaseCosts=987654;
  decoy.mortgageType='linear';
  decoy.mortgage={balance:1,ratePct:0,years:40};
  decoy.tax={...decoy.tax,wozValue:1,hraRemainingMonths:1,qualifyingInterestFraction:.01};
  const changed=SC.runScenario(decoy);
  return{
    reference:summarizeResult(reference),
    withTopLevelMortgageTabDecoys:summarizeResult(changed),
    strategyANetDelta:round(changed.A.net-reference.A.net),
    strategyBNetDelta:round(changed.B.net-reference.B.net),
    strategyAMortgageDelta:round(changed.A.mortgage-reference.A.mortgage),
    strategyBMortgageDelta:round(changed.B.mortgage-reference.B.mortgage)
  };
}

function captureOversizedContribution(){
  const config=purchaseBase('buy-rent');
  config.buyRent={...config.buyRent,price:100000,cash:200000,purchaseCosts:5000,downPayment:120000,mortgageRatePct:0,mortgageYears:10};
  config.purchaseCosts=5000;
  return summarizeResult(SC.runScenario(config));
}

const output={
  stage:'R6.6 Stage 3',
  implementation:typeof PR.calculateScenarioPurchase2026==='function'?'scenario-local-purchase-rules':typeof SC.purchaseSourcesAndUses==='function'?'isolated-sources-and-uses':'legacy-shared-purchase-state',
  canonical:{
    buyRent:summarizeResult(SC.runScenario(purchaseBase('buy-rent'))),
    downpayment:summarizeResult(SC.runScenario(purchaseBase('downpayment'))),
    oversizedContribution:captureOversizedContribution()
  },
  isolation:{
    buyRent:captureIsolation('buy-rent'),
    downpayment:captureIsolation('downpayment')
  },
  scenarios:captureScenarios()
};

process.stdout.write(JSON.stringify(output,null,2)+'\n');
