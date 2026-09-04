(function(root,factory){
  const FC=typeof module==='object'&&module.exports?require('./finance-core.js'):root.FinanceCore;
  const PR=typeof module==='object'&&module.exports?require('./purchase-rules.js'):root.PurchaseRules;
  const OI=typeof module==='object'&&module.exports?require('./output-integrity.js'):root.OutputIntegrity;
  const api=factory(FC,PR,OI);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.ScenarioCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(FC,PR,OI){
'use strict';
if(!FC)throw new Error('FinanceCore is required by ScenarioCore');
if(!PR)throw new Error('PurchaseRules is required by ScenarioCore');
if(!OI)throw new Error('OutputIntegrity is required by ScenarioCore');

const nonNegative=v=>Math.max(0,Number(v)||0);
const optionalNonNegative=v=>v==null||v===''?null:nonNegative(v);
const sum=a=>a.reduce((s,x)=>s+(Number(x)||0),0);
const FUNDING_TOLERANCE=.005;
const INPUT_SOURCE_MODES=Object.freeze({IMPORTED:'imported',FRESH:'fresh'});

function isPurchaseMode(mode){return mode==='buy-rent'||mode==='downpayment'}

function scenarioInputData(raw={}){
  return{
    startYear:Number(raw.startYear)||2026,
    startMonth:FC.clamp(Number(raw.startMonth)||1,1,12),
    investmentReturnPct:Number(raw.investmentReturnPct)||0,
    startPortfolio:nonNegative(raw.startPortfolio),
    mortgageType:raw.mortgageType==='linear'?'linear':'annuity',
    mortgage:{
      balance:nonNegative(raw.mortgage?.balance),
      ratePct:Math.max(0,Number(raw.mortgage?.ratePct)||0),
      years:Math.max(1,Number(raw.mortgage?.years)||30)
    },
    tax:{...(raw.tax||{})},
    box3:{...(raw.box3||{})}
  };
}

function resolveScenarioInputSource({sourceMode,plannerData={},freshData={},scenarioConfig={}}={}){
  if(!Object.values(INPUT_SOURCE_MODES).includes(sourceMode))throw new RangeError('Choose imported or fresh scenario data before calculating.');
  const source=scenarioInputData(sourceMode===INPUT_SOURCE_MODES.IMPORTED?plannerData:freshData);
  const purchase=isPurchaseMode(scenarioConfig.mode);
  return{
    ...scenarioConfig,
    startYear:source.startYear,
    startMonth:source.startMonth,
    investmentReturnPct:scenarioConfig.investmentReturnPct==null?source.investmentReturnPct:scenarioConfig.investmentReturnPct,
    startPortfolio:source.startPortfolio,
    mortgageType:purchase?scenarioConfig.mortgageType:source.mortgageType,
    mortgage:purchase?(scenarioConfig.mortgage||{balance:0,ratePct:0,years:30}):source.mortgage,
    tax:purchase?(scenarioConfig.tax||{}):source.tax,
    box3:source.box3,
    inputSource:sourceMode
  };
}

function purchaseSourcesAndUses({propertyPrice=0,transactionCosts=0,buyerCashTowardPrice=0,availableSavings=0}={}){
  const price=nonNegative(propertyPrice);
  const costs=nonNegative(transactionCosts);
  const cashTowardPrice=nonNegative(buyerCashTowardPrice);
  const savings=nonNegative(availableSavings);
  const mortgageProceeds=Math.max(0,price-cashTowardPrice);
  const buyerCashForCosts=costs;
  const totalBuyerCash=cashTowardPrice+buyerCashForCosts;
  const totalUses=price+costs;
  const totalSources=mortgageProceeds+totalBuyerCash;
  const identityDifference=totalSources-totalUses;
  const shortfall=Math.max(0,totalBuyerCash-savings);
  const remainingSavings=Math.max(0,savings-totalBuyerCash);
  const errors=[];
  if(price<=0)errors.push({code:'property-price-required',message:'Enter a property price greater than zero.'});
  if(cashTowardPrice>price+FUNDING_TOLERANCE)errors.push({code:'buyer-cash-exceeds-price',message:`Buyer cash toward the purchase price exceeds the property price by ${(cashTowardPrice-price).toFixed(2)}.`});
  if(shortfall>FUNDING_TOLERANCE)errors.push({code:'purchase-cash-shortfall',message:`Starting savings are ${shortfall.toFixed(2)} below the buyer cash required for the purchase price contribution and transaction costs.`});
  if(Math.abs(identityDifference)>FUNDING_TOLERANCE)errors.push({code:'sources-uses-mismatch',message:`Purchase sources and uses differ by ${Math.abs(identityDifference).toFixed(2)}.`});
  return{
    valid:errors.length===0,
    propertyPrice:price,
    transactionCosts:costs,
    totalUses,
    mortgageProceeds,
    buyerCashTowardPrice:cashTowardPrice,
    buyerCashForCosts,
    totalBuyerCash,
    totalSources,
    identityDifference,
    availableSavings:savings,
    remainingSavings,
    shortfall,
    errors
  };
}


function scenarioPurchaseFunding(S,d,buyerCashTowardPrice){
  if(!S.purchaseRules.enabled){
    const legacy=purchaseSourcesAndUses({propertyPrice:d.price,transactionCosts:d.purchaseCosts,buyerCashTowardPrice,availableSavings:d.cash});
    return{
      ...legacy,
      source:'legacy-explicit-total',
      appraisedValue:d.wozValue||d.price,
      baseCosts:d.purchaseCosts,
      transferTax:{amount:0,rate:null,mode:'legacy-total',requestedMode:'legacy-total',effectiveMode:'legacy-total',warning:''},
      transferTaxBase:d.price,
      nhg:{enabled:false,eligible:false,fee:0,warning:''},
      nhgFee:0,
      totalCosts:d.purchaseCosts,
      fundingShortfall:legacy.shortfall,
      funded:legacy.shortfall<=FUNDING_TOLERANCE,
      warnings:[]
    };
  }
  return PR.calculateScenarioPurchase2026({
    housePrice:d.price,
    downPayment:buyerCashTowardPrice,
    availableSavings:d.cash,
    baseCosts:d.purchaseCosts,
    transferTaxMode:S.purchaseRules.transferTaxMode,
    manualTransferTax:S.purchaseRules.manualTransferTax,
    appraisedValue:S.purchaseRules.appraisedValue,
    nhgMode:S.purchaseRules.nhgMode,
    buyerAge:S.purchaseRules.buyerAge,
    starterMainResidence:S.purchaseRules.starterMainResidence,
    starterExemptionUnused:S.purchaseRules.starterExemptionUnused
  });
}

function purchaseFundingReason(funding,label='Purchase'){
  const error=funding?.errors?.[0];
  return `Comparison unavailable: ${label} funding is invalid. ${error?.message||'Review the property price, transaction costs, buyer cash and starting savings.'}`;
}

function allocateRemainingCash(S,amount){
  const remaining=nonNegative(amount);
  return S.upfrontCashTreatment==='savings'
    ?{portfolioAdd:0,startingSavings:remaining}
    :{portfolioAdd:remaining,startingSavings:0};
}

function result(name,v={}){
  return{
    name,
    net:Number(v.net)||0,
    invest:Number(v.invest)||0,
    savings:Number(v.savings)||0,
    box3Debt:Number(v.box3Debt)||0,
    financial:Number(v.financial)||0,
    equity:v.equity,
    mortgage:Number(v.mortgage)||0,
    interest:Number(v.interest)||0,
    mortTax:Number(v.mortTax)||0,
    rent:Number(v.rent)||0,
    owner:Number(v.owner)||0,
    vve:Number(v.vve)||0,
    maintenance:Number(v.maintenance)||0,
    ownerTaxes:Number(v.ownerTaxes)||0,
    insurance:Number(v.insurance)||0,
    groundLease:Number(v.groundLease)||0,
    externalCashFlowFutureValue:Number(v.externalCashFlowFutureValue)||0,
    purchase:Number(v.purchase)||0,
    purchasePrice:Number(v.purchasePrice)||0,
    buyerCash:Number(v.buyerCash)||0,
    mortgageProceeds:Number(v.mortgageProceeds)||0,
    fundingDifference:Number(v.fundingDifference)||0,
    selling:Number(v.selling)||0,
    box3:Number(v.box3)||0,
    unsettledBox3:Number(v.unsettledBox3)||0,
    externalTax:Number(v.externalTax)||0,
    externalDebtRepayment:Number(v.externalDebtRepayment)||0,
    box3DebtInterest:Number(v.box3DebtInterest)||0,
    short:Number(v.short)||0,
    label:v.label||'Final comparable wealth'
  };
}

function normalize(config={}){
  const months=Math.max(1,Math.round(Number(config.months)||((Number(config.horizonYears)||10)*12)));
  const rawBox3=config.box3||{};
  const box3={
    mode:rawBox3.mode||'none',
    taxPartners:FC.clamp(Number(rawBox3.taxPartners)||1,1,2),
    paySource:['savings','portfolio','external'].includes(rawBox3.paySource)?rawBox3.paySource:'savings',
    currentTaxRate:Number(rawBox3.currentTaxRate??0.36),
    currentAllowance:nonNegative(rawBox3.currentAllowance??59357),
    currentNotional:Number(rawBox3.currentNotional??0.06),
    currentSavingsNotional:Number(rawBox3.currentSavingsNotional??0.0128),
    currentDebtNotional:Number(rawBox3.currentDebtNotional??0.027),
    currentDebtThreshold:nonNegative(rawBox3.currentDebtThreshold??3800),
    firstJan1Portfolio:nonNegative(rawBox3.firstJan1Portfolio),
    firstJan1Savings:optionalNonNegative(rawBox3.firstJan1Savings),
    firstJan1Debt:optionalNonNegative(rawBox3.firstJan1Debt),
    savings:nonNegative(rawBox3.savings??rawBox3.box3Savings),
    debt:nonNegative(rawBox3.debt??rawBox3.box3Debt),
    savingsReturnPct:Number(rawBox3.savingsReturnPct)||0,
    debtInterestPct:Number(rawBox3.debtInterestPct)||0,
    debtMonthlyRepayment:nonNegative(rawBox3.debtMonthlyRepayment??rawBox3.box3DebtMonthlyRepayment),
    debtRepaymentSource:rawBox3.debtRepaymentSource==='savings'?'savings':'external',
    debtFallbackDestination:['invest','savings','consume'].includes(rawBox3.debtFallbackDestination??rawBox3.box3DebtFallbackDestination)?(rawBox3.debtFallbackDestination??rawBox3.box3DebtFallbackDestination):'invest',
    futureStart:Number(rawBox3.futureStart)||2028,
    futureTaxRate:Number(rawBox3.futureTaxRate??0.36),
    futureExempt:nonNegative(rawBox3.futureExempt??1800),
    futureLossThreshold:nonNegative(rawBox3.futureLossThreshold??500)
  };
  const rawTax=config.tax||{};
  const tax={
    enabled:rawTax.enabled!==false,
    calculationMode:rawTax.calculationMode||undefined,
    deductionRate:Math.max(0,Number(rawTax.deductionRate)||0),
    wozValue:nonNegative(rawTax.wozValue),
    box1IncomeBeforeOwnHome:rawTax.box1IncomeBeforeOwnHome==null?undefined:nonNegative(rawTax.box1IncomeBeforeOwnHome),
    box1Profile:rawTax.box1Profile,
    hraRemainingMonths:rawTax.hraRemainingMonths==null?null:Math.max(0,Math.round(Number(rawTax.hraRemainingMonths)||0)),
    qualifyingInterestFraction:FC.clamp(Number(rawTax.qualifyingInterestFraction??1)||0,0,1)
  };
  const rawPurchaseRules=config.purchaseRules||{};
  const purchaseRules={
    enabled:rawPurchaseRules.enabled===true,
    transferTaxMode:['main','starter','other-home','other-real-estate','manual'].includes(rawPurchaseRules.transferTaxMode)?rawPurchaseRules.transferTaxMode:'main',
    manualTransferTax:nonNegative(rawPurchaseRules.manualTransferTax),
    appraisedValue:optionalNonNegative(rawPurchaseRules.appraisedValue),
    nhgMode:['none','standard','energy'].includes(rawPurchaseRules.nhgMode)?rawPurchaseRules.nhgMode:'none',
    buyerAge:Number.isFinite(Number(rawPurchaseRules.buyerAge))?Number(rawPurchaseRules.buyerAge):35,
    starterMainResidence:rawPurchaseRules.starterMainResidence!==false,
    starterExemptionUnused:rawPurchaseRules.starterExemptionUnused!==false
  };
  return{
    mode:config.mode||'buy-rent',
    months,
    investmentReturnPct:Number(config.investmentReturnPct)||0,
    startYear:Number(config.startYear)||2026,
    startMonth:FC.clamp(Number(config.startMonth)||1,1,12),
    startPortfolio:nonNegative(config.startPortfolio),
    purchaseCosts:nonNegative(config.purchaseCosts),
    mortgageType:config.mortgageType==='linear'?'linear':'annuity',
    mortgage:{
      balance:nonNegative(config.mortgage?.balance),
      ratePct:Math.max(0,Number(config.mortgage?.ratePct)||0),
      years:Math.max(1,Number(config.mortgage?.years)||30)
    },
    tax,
    purchaseRules,
    box3,
    upfrontCashTreatment:config.upfrontCashTreatment==='savings'?'savings':'invest',
    homeGrowthPct:Number(config.homeGrowthPct)||0,
    rentGrowthPct:Number(config.rentGrowthPct)||0,
    sellingCostPct:Math.max(0,Number(config.sellingCostPct)||0),
    vveMonthly:nonNegative(config.vveMonthly),
    maintenanceAnnual:nonNegative(config.maintenanceAnnual),
    ownerTaxesAnnual:nonNegative(config.ownerTaxesAnnual),
    insuranceAnnual:nonNegative(config.insuranceAnnual),
    groundLeaseAnnual:nonNegative(config.groundLeaseAnnual),
    ownerCostMode:config.ownerCostMode?config.ownerCostMode==='itemized'?'itemized':'total':config.ownerCostTotalMonthly==null?'itemized':'total',
    ownerCostTotalMonthly:nonNegative(config.ownerCostTotalMonthly),
    ownerCostGrowthPct:Number(config.ownerCostGrowthPct)||0,
    buyRent:{
      price:nonNegative(config.buyRent?.price),
      cash:config.buyRent?.cash==null?box3.savings:nonNegative(config.buyRent.cash),
      purchaseCosts:nonNegative(config.buyRent?.purchaseCosts),
      downPayment:nonNegative(config.buyRent?.downPayment),
      monthlyRent:nonNegative(config.buyRent?.monthlyRent),
      mortgageRatePct:Math.max(0,Number(config.buyRent?.mortgageRatePct)||0),
      mortgageYears:Math.max(1,Number(config.buyRent?.mortgageYears)||30),
      mortgageType:config.buyRent?.mortgageType==='linear'?'linear':'annuity',
      wozValue:config.buyRent?.wozValue==null?nonNegative(config.buyRent?.price):nonNegative(config.buyRent.wozValue)
    },
    downpayment:{
      price:nonNegative(config.downpayment?.price),
      cash:config.downpayment?.cash==null?box3.savings:nonNegative(config.downpayment.cash),
      purchaseCosts:nonNegative(config.downpayment?.purchaseCosts),
      downA:nonNegative(config.downpayment?.downA),
      downB:nonNegative(config.downpayment?.downB),
      mortgageRatePct:Math.max(0,Number(config.downpayment?.mortgageRatePct)||0),
      mortgageYears:Math.max(1,Number(config.downpayment?.mortgageYears)||30),
      mortgageType:config.downpayment?.mortgageType==='linear'?'linear':'annuity',
      wozValue:config.downpayment?.wozValue==null?nonNegative(config.downpayment?.price):nonNegative(config.downpayment.wozValue)
    },
    mortgageInvest:{extraMonthly:nonNegative(config.mortgageInvest?.extraMonthly)},
    sellRent:{
      homeValue:nonNegative(config.sellRent?.homeValue),
      monthlyRent:nonNegative(config.sellRent?.monthlyRent),
      wozValue:config.sellRent?.wozValue==null?(tax.wozValue||nonNegative(config.sellRent?.homeValue)):nonNegative(config.sellRent.wozValue)
    }
  };
}

function mortgage(S,balance,ratePct,years,type,extraMonthly=0,taxOverride={}){
  const tax={...S.tax,...taxOverride};
  return FC.mortgageSchedule({
    balance,
    annualRatePct:ratePct,
    termYears:years,
    type,
    months:S.months,
    extraMonthly,
    startYear:S.startYear,
    startMonth:S.startMonth,
    tax
  });
}

function investment(S,{initialPortfolio=S.startPortfolio,flows=[],startingSavings=S.box3.savings,startingDebt=S.box3.debt,firstJan1Savings=S.box3.firstJan1Savings,firstJan1Debt=S.box3.firstJan1Debt}={}){
  const x=FC.simulateInvestmentFlows({
    initialPortfolio:nonNegative(initialPortfolio),
    flows,
    annualReturnPct:S.investmentReturnPct,
    startYear:S.startYear,
    startMonth:S.startMonth,
    box3Mode:S.box3.mode,
    taxPartners:S.box3.taxPartners,
    paySource:S.box3.paySource,
    currentTaxRate:S.box3.currentTaxRate,
    currentAllowance:S.box3.currentAllowance,
    currentNotional:S.box3.currentNotional,
    currentSavingsNotional:S.box3.currentSavingsNotional,
    currentDebtNotional:S.box3.currentDebtNotional,
    currentDebtThreshold:S.box3.currentDebtThreshold,
    firstJan1Portfolio:S.box3.firstJan1Portfolio,
    box3Savings:nonNegative(startingSavings),
    box3Debt:nonNegative(startingDebt),
    firstJan1Savings,
    firstJan1Debt,
    savingsReturnPct:S.box3.savingsReturnPct,
    debtInterestPct:S.box3.debtInterestPct,
    box3DebtMonthlyRepayment:S.box3.debtMonthlyRepayment,
    debtRepaymentSource:S.box3.debtRepaymentSource,
    box3DebtFallbackDestination:S.box3.debtFallbackDestination,
    futureStart:S.box3.futureStart,
    futureTaxRate:S.box3.futureTaxRate,
    futureExempt:S.box3.futureExempt,
    futureLossThreshold:S.box3.futureLossThreshold
  });
  return{
    wealth:x.householdComparableWealth,
    portfolio:x.portfolio,
    savings:x.savings,
    debt:x.box3Debt,
    netFinancialAssets:x.netFinancialAssets,
    tax:x.totalTax,
    unsettledTax:x.unsettledTaxEstimate,
    externalTax:x.externalTax,
    externalDebtRepayment:x.externalDebtRepayment,
    debtInterest:x.totalDebtInterest
  };
}

function upfrontAllocation(S,cash,spend){
  const starting=nonNegative(cash),needed=nonNegative(spend);
  const used=Math.min(starting,needed),remaining=Math.max(0,starting-used),short=Math.max(0,needed-starting);
  const allocation=S.upfrontCashTreatment==='savings'
    ?{portfolioAdd:0,startingSavings:remaining}
    :{portfolioAdd:remaining,startingSavings:0};
  return{...allocation,starting,needed,used,remaining,short,valid:short<=.005};
}

function ownerCosts(S){
  const monthlyGrowth=FC.effectiveAnnualPctToMonthly(S.ownerCostGrowthPct);
  const itemized={vve:S.vveMonthly,maintenance:S.maintenanceAnnual/12,ownerTaxes:S.ownerTaxesAnnual/12,insurance:S.insuranceAnnual/12,groundLease:S.groundLeaseAnnual/12};
  const base=S.ownerCostMode==='itemized'?{...itemized,unallocated:0}:{vve:0,maintenance:0,ownerTaxes:0,insurance:0,groundLease:0,unallocated:S.ownerCostTotalMonthly};
  const series=Array.from({length:S.months},(_,monthIndex)=>{
    const factor=Math.pow(1+monthlyGrowth,monthIndex);
    const row=Object.fromEntries(Object.entries(base).map(([key,value])=>[key,value*factor]));
    return{...row,total:Object.values(row).reduce((total,value)=>total+value,0)};
  });
  const totals=series.reduce((all,row)=>{
    for(const key of ['vve','maintenance','ownerTaxes','insurance','groundLease','unallocated','total'])all[key]+=row[key];
    return all;
  },{vve:0,maintenance:0,ownerTaxes:0,insurance:0,groundLease:0,unallocated:0,total:0});
  return{...totals,monthly:series.map(row=>row.total),series};
}

function rentSeries(S,start){
  const monthlyGrowth=FC.effectiveAnnualPctToMonthly(S.rentGrowthPct);
  return Array.from({length:S.months},(_,m)=>nonNegative(start)*Math.pow(1+monthlyGrowth,m));
}
function futureHomeValue(S,price){return nonNegative(price)*Math.pow(1+FC.effectiveAnnualPctToMonthly(S.homeGrowthPct),S.months)}
function finalize(A,B,note,cashA,cashB,meta={}){
  const eq=FC.equalizeCashFlows(cashA,cashB);
  return{valid:true,A,B,note:note||'',cashA,cashB,budgetSeries:eq.budget,peakRequirement:Math.max(0,...eq.budget),firstRequirement:eq.budget[0]||0,...meta};
}
function invalidComparison(reason,names=['Strategy A','Strategy B'],cashA=[],cashB=[],meta={}){
  const eq=FC.equalizeCashFlows(cashA,cashB);
  return{valid:false,reason,A:result(names[0]),B:result(names[1]),note:reason,cashA,cashB,budgetSeries:eq.budget,peakRequirement:Math.max(0,...eq.budget),firstRequirement:eq.budget[0]||0,...meta};
}

function financialResult(ledger){
  return{
    invest:ledger.portfolio,
    savings:ledger.savings,
    box3Debt:ledger.debt,
    financial:ledger.wealth,
    box3:ledger.tax,
    unsettledBox3:ledger.unsettledTax,
    externalTax:ledger.externalTax,
    externalDebtRepayment:ledger.externalDebtRepayment,
    box3DebtInterest:ledger.debtInterest,
    externalCashFlowFutureValue:ledger.externalCashFlowFutureValue
  };
}

function addFlows(a=[],b=[]){
  const length=Math.max(a.length,b.length);
  return Array.from({length},(_,i)=>(Number(a[i])||0)+(Number(b[i])||0));
}

function runScenario(config={}){
  const S=normalize(config),owner=ownerCosts(S);
  let A,B,note='',cashA=[],cashB=[],sourcesAndUses=null;

  if(S.mode==='buy-rent'){
    const d=S.buyRent,price=d.price;
    const funding=scenarioPurchaseFunding(S,d,d.downPayment);
    sourcesAndUses={A:funding,B:null};
    if(!funding.valid)return invalidComparison(purchaseFundingReason(funding,'Buy-home strategy'),['Buy home','Rent + invest'],[],[],{sourcesAndUses});
    const purchaseTax={wozValue:d.wozValue||price,hraRemainingMonths:Math.min(Math.round(d.mortgageYears*12),360),qualifyingInterestFraction:1};
    const m=mortgage(S,funding.mortgageProceeds,d.mortgageRatePct,d.mortgageYears,d.mortgageType,0,purchaseTax);
    cashA=m.rows.map((r,i)=>r.cash+owner.monthly[i]);
    cashB=rentSeries(S,d.monthlyRent);
    const buyerCash=allocateRemainingCash(S,funding.remainingSavings),renterCash=allocateRemainingCash(S,d.cash);
    const eq=FC.equalizeCashFlows(cashA,cashB);
    const ia=investment(S,{initialPortfolio:S.startPortfolio+buyerCash.portfolioAdd,startingSavings:buyerCash.startingSavings,flows:eq.a});
    const ib=investment(S,{initialPortfolio:S.startPortfolio+renterCash.portfolioAdd,startingSavings:renterCash.startingSavings,flows:eq.b});
    const home=futureHomeValue(S,price),selling=home*S.sellingCostPct/100,equity=home-m.balance-selling;
    A=result('Buy home',{net:ia.wealth+equity,...financialResult(ia),equity,mortgage:m.balance,interest:m.totalInterest,mortTax:m.totalTaxBenefit,owner:owner.total,
      vve:owner.vve,maintenance:owner.maintenance,ownerTaxes:owner.ownerTaxes,insurance:owner.insurance,groundLease:owner.groundLease,purchase:funding.transactionCosts,purchasePrice:price,buyerCash:funding.totalBuyerCash,mortgageProceeds:funding.mortgageProceeds,fundingDifference:funding.identityDifference,selling});
    B=result('Rent + invest',{net:ib.wealth,...financialResult(ib),equity:0,rent:sum(cashB)});
    note='The buy strategy calculates transfer tax, NHG fee and other purchase costs from its own 2026 scenario assumptions. Property price plus purchase costs exactly equals mortgage proceeds plus buyer cash.';
  }else if(S.mode==='downpayment'){
    const d=S.downpayment,price=d.price;
    const fundingA=scenarioPurchaseFunding(S,d,d.downA);
    const fundingB=scenarioPurchaseFunding(S,d,d.downB);
    sourcesAndUses={A:fundingA,B:fundingB};
    if(!fundingA.valid||!fundingB.valid){
      const failed=!fundingA.valid?fundingA:fundingB;
      const label=!fundingA.valid?'Larger-down-payment strategy':'Smaller-down-payment strategy';
      return invalidComparison(purchaseFundingReason(failed,label),['Larger down payment','Smaller down payment'],[],[],{sourcesAndUses});
    }
    const purchaseTax={wozValue:d.wozValue||price,hraRemainingMonths:Math.min(Math.round(d.mortgageYears*12),360),qualifyingInterestFraction:1};
    const ma=mortgage(S,fundingA.mortgageProceeds,d.mortgageRatePct,d.mortgageYears,d.mortgageType,0,purchaseTax),mb=mortgage(S,fundingB.mortgageProceeds,d.mortgageRatePct,d.mortgageYears,d.mortgageType,0,purchaseTax);
    cashA=ma.rows.map((r,i)=>r.cash+owner.monthly[i]);cashB=mb.rows.map((r,i)=>r.cash+owner.monthly[i]);
    const remainingA=allocateRemainingCash(S,fundingA.remainingSavings),remainingB=allocateRemainingCash(S,fundingB.remainingSavings);
    const eq=FC.equalizeCashFlows(cashA,cashB);
    const ia=investment(S,{initialPortfolio:S.startPortfolio+remainingA.portfolioAdd,startingSavings:remainingA.startingSavings,flows:eq.a});
    const ib=investment(S,{initialPortfolio:S.startPortfolio+remainingB.portfolioAdd,startingSavings:remainingB.startingSavings,flows:eq.b});
    const home=futureHomeValue(S,price),selling=home*S.sellingCostPct/100,equityA=home-ma.balance-selling,equityB=home-mb.balance-selling;
    A=result('Larger down payment',{net:ia.wealth+equityA,...financialResult(ia),equity:equityA,mortgage:ma.balance,interest:ma.totalInterest,mortTax:ma.totalTaxBenefit,owner:owner.total,
      vve:owner.vve,maintenance:owner.maintenance,ownerTaxes:owner.ownerTaxes,insurance:owner.insurance,groundLease:owner.groundLease,purchase:fundingA.transactionCosts,purchasePrice:price,buyerCash:fundingA.totalBuyerCash,mortgageProceeds:fundingA.mortgageProceeds,fundingDifference:fundingA.identityDifference,selling});
    B=result('Smaller down payment',{net:ib.wealth+equityB,...financialResult(ib),equity:equityB,mortgage:mb.balance,interest:mb.totalInterest,mortTax:mb.totalTaxBenefit,owner:owner.total,
      vve:owner.vve,maintenance:owner.maintenance,ownerTaxes:owner.ownerTaxes,insurance:owner.insurance,groundLease:owner.groundLease,purchase:fundingB.transactionCosts,purchasePrice:price,buyerCash:fundingB.totalBuyerCash,mortgageProceeds:fundingB.mortgageProceeds,fundingDifference:fundingB.identityDifference,selling});
    note='Each down-payment strategy recalculates its complete purchase ledger. NHG fees can differ because the mortgage amount differs, while transfer-tax and other property assumptions remain common.';
  }else if(S.mode==='mortgage-invest'){
    const extra=S.mortgageInvest.extraMonthly,m=S.mortgage;
    const ma=mortgage(S,m.balance,m.ratePct,m.years,S.mortgageType,extra),mb=mortgage(S,m.balance,m.ratePct,m.years,S.mortgageType,0);
    cashA=ma.rows.map((r,i)=>r.net+r.requestedExtra+owner.monthly[i]);cashB=mb.rows.map((r,i)=>r.net+owner.monthly[i]);
    const eq=FC.equalizeCashFlows(cashA,cashB);
    const unused=ma.rows.map(r=>r.unusedExtra||0);
    const ia=investment(S,{flows:addFlows(eq.a,unused)}),ib=investment(S,{flows:eq.b});
    A=result('Repay mortgage',{net:ia.wealth-ma.balance,...financialResult(ia),mortgage:ma.balance,interest:ma.totalInterest,mortTax:ma.totalTaxBenefit,owner:owner.total,
      vve:owner.vve,maintenance:owner.maintenance,ownerTaxes:owner.ownerTaxes,insurance:owner.insurance,groundLease:owner.groundLease,label:'Comparable wealth*'});
    B=result('Invest instead',{net:ib.wealth-mb.balance,...financialResult(ib),mortgage:mb.balance,interest:mb.totalInterest,mortTax:mb.totalTaxBenefit,owner:owner.total,
      vve:owner.vve,maintenance:owner.maintenance,ownerTaxes:owner.ownerTaxes,insurance:owner.insurance,groundLease:owner.groundLease,label:'Comparable wealth*'});
    note='*The home value is identical in both strategies, so it is excluded. Any planned repayment left after the mortgage is cleared is invested rather than discarded.';
  }else if(S.mode==='linear-annuity'){
    const m=S.mortgage,ma=mortgage(S,m.balance,m.ratePct,m.years,'linear'),mb=mortgage(S,m.balance,m.ratePct,m.years,'annuity');
    cashA=ma.rows.map((r,i)=>r.cash+owner.monthly[i]);cashB=mb.rows.map((r,i)=>r.cash+owner.monthly[i]);
    const eq=FC.equalizeCashFlows(cashA,cashB);
    const ia=investment(S,{flows:eq.a}),ib=investment(S,{flows:eq.b});
    A=result('Linear mortgage',{net:ia.wealth-ma.balance,...financialResult(ia),mortgage:ma.balance,interest:ma.totalInterest,mortTax:ma.totalTaxBenefit,owner:owner.total,
      vve:owner.vve,maintenance:owner.maintenance,ownerTaxes:owner.ownerTaxes,insurance:owner.insurance,groundLease:owner.groundLease,label:'Comparable wealth*'});
    B=result('Annuity mortgage',{net:ib.wealth-mb.balance,...financialResult(ib),mortgage:mb.balance,interest:mb.totalInterest,mortTax:mb.totalTaxBenefit,owner:owner.total,
      vve:owner.vve,maintenance:owner.maintenance,ownerTaxes:owner.ownerTaxes,insurance:owner.insurance,groundLease:owner.groundLease,label:'Comparable wealth*'});
    note='*The same home is owned under both strategies, so its value is excluded. Monthly payment differences are invested; common household savings and Box 3 debt remain in both strategies.';
  }else{
    const d=S.sellRent,m=S.mortgage,keep=mortgage(S,m.balance,m.ratePct,m.years,S.mortgageType,0,{wozValue:d.wozValue||S.tax.wozValue||d.homeValue});
    cashA=keep.rows.map((r,i)=>r.cash+owner.monthly[i]);cashB=rentSeries(S,d.monthlyRent);
    const sellingNow=d.homeValue*S.sellingCostPct/100,proceeds=d.homeValue-m.balance-sellingNow;
    if(proceeds<-.005)return invalidComparison(`Comparison unavailable: selling proceeds are ${Math.abs(proceeds).toFixed(2)} below the mortgage plus selling costs. Add a funded source for that shortfall before comparing.`,['Keep home','Sell now + rent/invest'],cashA,cashB);
    const eq=FC.equalizeCashFlows(cashA,cashB);
    const ia=investment(S,{flows:eq.a}),ib=investment(S,{initialPortfolio:S.startPortfolio+Math.max(0,proceeds),flows:eq.b});
    const futureHome=futureHomeValue(S,d.homeValue),sellingFuture=futureHome*S.sellingCostPct/100,equity=futureHome-keep.balance-sellingFuture;
    A=result('Keep home',{net:ia.wealth+equity,...financialResult(ia),equity,mortgage:keep.balance,interest:keep.totalInterest,mortTax:keep.totalTaxBenefit,owner:owner.total,
      vve:owner.vve,maintenance:owner.maintenance,ownerTaxes:owner.ownerTaxes,insurance:owner.insurance,groundLease:owner.groundLease,selling:sellingFuture});
    B=result('Sell now + rent/invest',{net:ib.wealth,...financialResult(ib),equity:0,rent:sum(cashB),selling:sellingNow});
    note='Net sale proceeds are invested at the start of Strategy B; the household savings and Box 3 debt ledgers continue alongside the investment portfolio.';
  }
  return finalize(A,B,note,cashA,cashB,{sourcesAndUses});
}

return{runScenario,normalize,upfrontAllocation,purchaseSourcesAndUses,scenarioPurchaseFunding,INPUT_SOURCE_MODES,isPurchaseMode,scenarioInputData,resolveScenarioInputSource};
});

if(typeof window!=='undefined'&&window.document){(()=>{
'use strict';
const FC=window.FinanceCore,SC=window.ScenarioCore,PR=window.PurchaseRules,OI=window.OutputIntegrity,II=window.InputIntegrity;
if(!FC||!SC||!PR||!OI||!II)throw new Error('FinanceCore, PurchaseRules, OutputIntegrity, InputIntegrity and ScenarioCore must load before scenario UI');
const $=id=>document.getElementById(id);
const clamp=FC.clamp;
const num=(id,d=0)=>{const el=$(id);if(!el)return d;const v=Number(el.value);return Number.isFinite(v)?v:d};
const optional=id=>{const el=$(id);if(!el||el.value==='')return null;const v=Number(el.value);return Number.isFinite(v)?Math.max(0,v):null};
const fmt=v=>'€'+Math.round(Number(v)||0).toLocaleString('nl-NL');
const pct=v=>(Number(v)||0).toLocaleString('nl-NL',{maximumFractionDigits:2})+'%';

const panel=$('tab-scenarios');
if(!panel||panel.dataset.decisionEngine==='1')return;
panel.dataset.decisionEngine='1';
[...panel.querySelectorAll(':scope > .card')].forEach(x=>x.classList.add('scenario-legacy-hidden'));
const firstDetails=panel.querySelector(':scope > details.fold');
if(firstDetails){const s=firstDetails.querySelector('summary');if(s)s.textContent='Final main-plan results'}
const divider=panel.querySelector(':scope > .section-divider');
if(divider){divider.querySelector('h2').textContent='Scenarios';divider.querySelector('p').textContent='Compare two financial strategies using the same household balances and the same monthly cash-flow capacity.'}

const engine=document.createElement('div');
engine.id='decisionEngine';
engine.innerHTML=`
<div class="card scenario-builder"><div class="section-head"><div><p class="section-label">1 · Choose the decision</p><p class="section-note">Purchase decisions draw directly from household starting savings, so spending cash changes future Box 3.</p></div></div><div class="grid3"><div class="field"><label for="comparisonType">What do you want to compare?</label><select id="comparisonType"><option value="buy-rent" selected>Buy a home vs Rent + invest</option><option value="downpayment">Larger down payment vs Smaller down payment</option><option value="mortgage-invest">Extra mortgage repayment vs Invest</option><option value="linear-annuity">Linear vs Annuity + invest cash-flow difference</option><option value="sell-rent">Keep home vs Sell now + rent/invest</option></select></div><div class="field"><label for="scenarioHorizonNew">Comparison horizon, years</label><input id="scenarioHorizonNew" type="number" min="1" max="40" step="1" value="10"></div><div class="field"><label for="scenarioReturnNew">Expected effective annual investment return %</label><input id="scenarioReturnNew" type="number" min="-30" max="30" step="0.5" value="5"><p class="inline">5% is an effective annual planning starting point, not a forecast.</p></div></div><div id="scenarioQuestionNoteNew" class="callout"></div><div id="scenarioCashSourceNoteNew" class="callout"></div>
<div class="scenario-specific-new" data-scenario="buy-rent"><div class="grid3 scenario-specific-grid-new"><div class="field"><label for="scenarioBuyPriceNew">House price</label><input id="scenarioBuyPriceNew" type="number" min="0" step="1000" value="350000"></div><div class="field"><label for="scenarioBuyCostsNew">Other purchase and financing costs</label><input id="scenarioBuyCostsNew" type="number" min="0" step="500" value="8000"><p class="inline">Scenario-specific amount excluding transfer tax and the calculated NHG fee.</p></div><div class="field"><label for="scenarioDownPaymentNew">Buyer cash toward purchase price</label><input id="scenarioDownPaymentNew" type="number" min="0" step="1000" value="35000"></div><div class="field"><label for="scenarioRentNew">Monthly rent at scenario start</label><input id="scenarioRentNew" type="number" min="0" step="25" value="1600"><p class="inline">Use current rent or realistic comparable rent at the scenario start.</p></div><div class="field"><label for="scenarioBuyRateNew">Nominal annual mortgage interest rate %</label><input id="scenarioBuyRateNew" type="number" min="0" max="20" step="0.01" value="4.00"></div><div class="field"><label for="scenarioBuyYearsNew">Mortgage term, years</label><input id="scenarioBuyYearsNew" type="number" min="1" max="40" step="1" value="30"></div><div class="field"><label for="scenarioBuyMortgageTypeNew">Mortgage method</label><select id="scenarioBuyMortgageTypeNew"><option value="annuity" selected>Annuity</option><option value="linear">Linear</option></select><p class="inline">Owned by this purchase comparison, not inherited from the Mortgage tab.</p></div></div></div>
<div class="scenario-specific-new hidden" data-scenario="downpayment"><div class="grid3 scenario-specific-grid-new"><div class="field"><label for="scenarioDpPriceNew">House price</label><input id="scenarioDpPriceNew" type="number" min="0" step="1000" value="350000"></div><div class="field"><label for="scenarioDpCostsNew">Other purchase and financing costs</label><input id="scenarioDpCostsNew" type="number" min="0" step="500" value="8000"><p class="inline">Shared amount excluding transfer tax and the strategy-specific calculated NHG fee.</p></div><div class="field"><label for="scenarioDownANew">Strategy A cash toward purchase price</label><input id="scenarioDownANew" type="number" min="0" step="1000" value="35000"></div><div class="field"><label for="scenarioDownBNew">Strategy B cash toward purchase price</label><input id="scenarioDownBNew" type="number" min="0" step="1000" value="15000"></div><div class="field"><label for="scenarioDpRateNew">Nominal annual mortgage interest rate %</label><input id="scenarioDpRateNew" type="number" min="0" max="20" step="0.01" value="4.00"></div><div class="field"><label for="scenarioDpYearsNew">Mortgage term, years</label><input id="scenarioDpYearsNew" type="number" min="1" max="40" step="1" value="30"></div><div class="field"><label for="scenarioDpMortgageTypeNew">Mortgage method</label><select id="scenarioDpMortgageTypeNew"><option value="annuity" selected>Annuity</option><option value="linear">Linear</option></select><p class="inline">Shared by the two down-payment strategies, but isolated from the Mortgage tab.</p></div></div></div>

<div class="scenario-purchase-rules">
  <details class="inner-fold" id="scenarioPurchaseRulesNew">
    <summary>Scenario purchase rules and tax assumptions</summary>
    <div class="inner-fold-body">
      <p class="subsection-copy">These inputs belong to the active purchase comparison. They do not read the Mortgage tab's purchase price, costs, transfer-tax choice, NHG choice, WOZ or mortgage structure.</p>
      <div class="grid3 advanced-grid">
        <div class="field"><label for="scenarioPurchaseAppraisedValueNew">Estimated market / appraised value</label><input id="scenarioPurchaseAppraisedValueNew" type="number" min="0" step="1000" placeholder="Defaults to scenario price"><p class="inline">Used for transfer tax, LTV and the simplified NHG rule check. Leave blank to use the scenario price.</p></div>
        <div class="field"><label for="scenarioTransferTaxModeNew">Transfer-tax treatment</label><select id="scenarioTransferTaxModeNew"><option value="main" selected>Main residence · 2%</option><option value="starter">Starter exemption · verify all conditions</option><option value="other-home">Residential property, not main residence · 8%</option><option value="other-real-estate">Other real estate · 10.4%</option><option value="manual">Manual amount</option></select></div>
        <div class="field hidden" id="scenarioManualTransferTaxFieldNew"><label for="scenarioManualTransferTaxNew">Manual transfer-tax amount</label><input id="scenarioManualTransferTaxNew" type="number" min="0" step="100" value="0"></div>
        <div class="field"><label for="scenarioPurchaseNhgModeNew">NHG treatment</label><select id="scenarioPurchaseNhgModeNew"><option value="none" selected>No NHG</option><option value="standard">Standard NHG</option><option value="energy">NHG with qualifying energy measures</option></select><p class="inline">The simplified rule check uses this scenario's price, appraisal and mortgage amount.</p></div>
        <div class="field hidden" id="scenarioBuyerAgeFieldNew"><label for="scenarioBuyerAgeNew">Buyer age at acquisition</label><input id="scenarioBuyerAgeNew" type="number" min="0" max="120" step="1" value="35"></div>
      </div>
      <div id="scenarioStarterConditionsNew" class="grid2 hidden">
        <div class="toggle"><input id="scenarioStarterMainResidenceNew" type="checkbox" checked><label for="scenarioStarterMainResidenceNew">I will use the property as my main residence</label></div>
        <div class="toggle"><input id="scenarioStarterUnusedNew" type="checkbox" checked><label for="scenarioStarterUnusedNew">I have not used the starter exemption before</label></div>
      </div>
      <div class="grid2 advanced-grid" style="margin-top:12px">
        <div class="toggle"><input id="scenarioPurchaseHraEnabledNew" type="checkbox" checked><label for="scenarioPurchaseHraEnabledNew">Include modeled mortgage-interest relief for this purchase</label></div>
        <div class="field"><label for="scenarioPurchaseDeductionRateNew">Modeled deduction rate %</label><input id="scenarioPurchaseDeductionRateNew" type="number" min="0" max="60" step="0.01" value="37.56"><p class="inline">Local purchase-scenario assumption. Stage 4 replaces the compressed Box 1 bridge.</p></div>
      </div>
      <div id="scenarioPurchaseRuleStatusNew" class="callout"></div>
    </div>
  </details>
</div>
<div class="scenario-specific-new hidden" data-scenario="mortgage-invest"><div class="grid2 scenario-specific-grid-new"><div class="field"><label for="scenarioExtraMonthlyNew">Extra amount available each month</label><input id="scenarioExtraMonthlyNew" type="number" min="0" step="50" value="500"></div><div class="callout"><strong>Uses the reviewed scenario snapshot.</strong><br><span>Balance, rate, term, repayment method and mortgage-interest tax treatment are shown in Scenarios.</span></div></div></div>
<div class="scenario-specific-new hidden" data-scenario="linear-annuity"><div class="callout"><strong>Uses the reviewed scenario snapshot.</strong> Both structures use the same visible balance, rate and term. The cheaper monthly strategy invests the difference.</div></div>
<div class="scenario-specific-new hidden" data-scenario="sell-rent"><div class="grid2 scenario-specific-grid-new"><div class="field"><label for="scenarioHomeValueNew">Current home value</label><input id="scenarioHomeValueNew" type="number" min="0" step="1000" value="400000"></div><div class="field"><label for="scenarioSellRentNew">Monthly rent at scenario start</label><input id="scenarioSellRentNew" type="number" min="0" step="25" value="1600"><p class="inline">Expected rent immediately after selling.</p></div></div></div></div>
<div class="card"><div class="section-head"><div><p class="section-label">2 · Shared assumptions</p><p class="section-note">Both strategies use the same economic assumptions. Owner-only costs are included in affordability and comparison cash flows.</p></div></div><div class="grid3"><div class="field scenario-budget-field"><label for="scenarioMonthlyBudgetNew">Monthly housing + investing budget</label><input id="scenarioMonthlyBudgetNew" type="number" min="0" step="50" value="2500"><p class="inline">Affordability check only. Common surplus is excluded from the comparison.</p></div><div class="field scenario-existing-mortgage-method-field"><label for="scenarioMortgageMethodNew">Existing-mortgage method where relevant</label><select id="scenarioMortgageMethodNew"><option value="selected" selected>Use selected method from Mortgage</option><option value="linear">Linear</option><option value="annuity">Annuity</option></select></div><div class="field scenario-upfront-field"><label for="scenarioUpfrontCashTreatmentNew">Unused upfront cash</label><select id="scenarioUpfrontCashTreatmentNew"><option value="invest" selected>Invest it</option><option value="savings">Keep it in savings</option></select><p class="inline">Applies to Buy/Rent and Down Payment only.</p></div><div class="field"><label for="scenarioHomeGrowthNew">Effective annual home value growth %</label><input id="scenarioHomeGrowthNew" type="number" min="-20" max="20" step="0.25" value="2"></div><div class="field"><label for="scenarioRentGrowthNew">Effective annual rent growth %</label><input id="scenarioRentGrowthNew" type="number" min="-10" max="20" step="0.25" value="2.5"></div><div class="field"><label for="scenarioSellingCostNew">Selling costs % of home value</label><input id="scenarioSellingCostNew" type="number" min="0" max="15" step="0.25" value="2"></div><div class="field"><label for="scenarioOwnerCostGrowthNew">Effective annual owner-cost growth %</label><input id="scenarioOwnerCostGrowthNew" type="number" min="-10" max="20" step="0.25" value="2"><p class="inline">Escalates VVE, maintenance, owner taxes, insurance and ground lease from their starting amounts.</p></div><div class="field"><label for="scenarioVveNew">VVE / service charges per month</label><input id="scenarioVveNew" type="number" min="0" step="25" value="250"></div><div class="field"><label for="scenarioMaintenanceNew">Other owner maintenance per year</label><input id="scenarioMaintenanceNew" type="number" min="0" step="100" value="1500"></div><div class="field"><label for="scenarioOwnerTaxesNew">OZB / owner municipal taxes per year</label><input id="scenarioOwnerTaxesNew" type="number" min="0" step="50" value="0"><p class="inline">Optional owner-only planning input.</p></div><div class="field"><label for="scenarioInsuranceNew">Homeowner building insurance per year</label><input id="scenarioInsuranceNew" type="number" min="0" step="50" value="0"><p class="inline">Optional owner-only planning input.</p></div><div class="field"><label for="scenarioGroundLeaseNew">Ground lease / erfpacht per year</label><input id="scenarioGroundLeaseNew" type="number" min="0" step="50" value="0"><p class="inline">Optional. Use 0 if not applicable.</p></div></div><div class="callout scenario-principle"><strong>Fair-cash-flow rule:</strong> both strategies receive the same starting capital and monthly cash capacity. Mortgage principal becomes home equity. It is not treated as an economic expense. The cheaper strategy invests the dated difference.</div><div class="callout"><strong>Assumption discipline:</strong> the normal sensitivity range defaults to 2–10%. If you enter 12–14%, treat those as optimistic stress cases rather than a base plan.</div><div id="scenarioBudgetStatusNew" class="callout scenario-budget-status"></div><div id="scenarioTaxNoteNew" class="foot"></div></div>
<div class="card"><div class="section-head"><div><p class="section-label">3 · Result</p><p class="section-note">Final comparable wealth includes the household financial ledger and home equity / mortgage differences relevant to the selected decision.</p></div></div><div id="scenarioVerdictNew" class="scenario-verdict-new"></div><div class="compare-grid scenario-result-grid-new"><div class="strategy-result-new" id="strategyAResultNew"></div><div class="strategy-result-new" id="strategyBResultNew"></div></div><details class="inner-fold"><summary>Why the result looks this way</summary><div class="inner-fold-body"><div class="table-wrap scenario-table-wrap-new"><table class="scenario-table-new"><thead><tr><th>Driver</th><th id="strategyAHeadNew">Strategy A</th><th id="strategyBHeadNew">Strategy B</th></tr></thead><tbody id="scenarioBreakdownBodyNew"></tbody></table></div></div></details><details class="inner-fold hidden" id="scenarioFundingDetailsNew"><summary>Purchase funding identity</summary><div class="inner-fold-body"><p class="subsection-copy">Each funded purchase must satisfy property price + transaction costs = mortgage proceeds + buyer cash.</p><div class="table-wrap scenario-table-wrap-new"><table class="scenario-table-new"><thead><tr><th>Funding line</th><th id="fundingAHeadNew">Strategy A</th><th id="fundingBHeadNew">Strategy B</th></tr></thead><tbody id="scenarioFundingBodyNew"></tbody></table></div><div class="callout" id="scenarioFundingStatusNew"></div></div></details></div>
<details class="fold"><summary>Return sensitivity and crossover</summary><div class="fold-body"><p class="subsection-copy">Normal planning range defaults to 2–10%. You can enter higher returns manually as explicit upside stress tests.</p><div class="grid3 advanced-grid"><div class="field"><label for="sensitivityLowNew">Lowest effective annual return %</label><input id="sensitivityLowNew" type="number" min="-30" max="30" step="0.5" value="2"></div><div class="field"><label for="sensitivityHighNew">Highest effective annual return %</label><input id="sensitivityHighNew" type="number" min="-30" max="30" step="0.5" value="10"></div><div class="field"><label for="sensitivityStepNew">Step, percentage points</label><input id="sensitivityStepNew" type="number" min="0.5" max="10" step="0.5" value="2"></div></div><div id="sensitivitySummaryNew" class="callout"></div><div class="table-wrap sensitivity-wrap-new"><table class="scenario-table-new"><thead><tr><th>Effective annual investment return</th><th>Strategy A</th><th>Strategy B</th><th>Leader</th></tr></thead><tbody id="sensitivityBodyNew"></tbody></table></div></div></details>`;

const sourceCard=document.createElement('div');
sourceCard.className='card scenario-source-card';
sourceCard.id='scenarioSourceCard';
sourceCard.innerHTML=`<div class="section-head"><div><p class="section-label">1 · Choose your starting data</p><p class="section-note">Scenarios never read another tab silently. Import a visible snapshot or enter an independent comparison.</p></div></div><div class="scenario-source-grid"><label class="scenario-source-option"><input id="scenarioSourceImported" type="radio" name="scenarioDataSource" value="imported"><span><strong>Use my existing planner data</strong><small>Copy relevant values from Investing and Mortgage for review.</small></span></label><label class="scenario-source-option"><input id="scenarioSourceFresh" type="radio" name="scenarioDataSource" value="fresh"><span><strong>Start a fresh comparison</strong><small>Use only values entered inside Scenarios.</small></span></label></div><div id="scenarioSourceStatus" class="callout"><strong>Choose a starting-data option.</strong> Results stay locked until you choose and review the required inputs.</div><button type="button" id="scenarioRefreshImport" class="secondary hidden">Refresh snapshot from planner</button>`;
engine.prepend(sourceCard);

const startingCard=document.createElement('div');
startingCard.className='card hidden';
startingCard.id='scenarioStartingDataCard';
startingCard.innerHTML=`<div class="section-head"><div><p class="section-label">3 · Starting position</p><p class="section-note">These are the balances, mortgage facts and tax choices used by this comparison.</p></div></div><div id="scenarioInputProvenance" class="callout"></div><div class="grid3">
  <div class="field"><label for="scenarioStartMonthFresh">Plan start month <span class="scenario-source-tag" data-source-for="scenarioStartMonthFresh"></span></label><select id="scenarioStartMonthFresh">${Array.from({length:12},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join('')}</select></div>
  <div class="field"><label for="scenarioStartYearFresh">Plan start year <span class="scenario-source-tag" data-source-for="scenarioStartYearFresh"></span></label><input id="scenarioStartYearFresh" type="number" min="2020" max="2100" step="1" value="2026"></div>
  <div class="field"><label for="scenarioStartPortfolioFresh">Current investment portfolio <span class="scenario-source-tag" data-source-for="scenarioStartPortfolioFresh"></span></label><input id="scenarioStartPortfolioFresh" type="number" min="0" step="100" placeholder="Enter 0 if none"></div>
  <div class="field"><label for="scenarioStartSavingsFresh">Savings and cash <span class="scenario-source-tag" data-source-for="scenarioStartSavingsFresh"></span></label><input id="scenarioStartSavingsFresh" type="number" min="0" step="100" placeholder="Enter 0 if none"></div>
  <div class="field"><label for="scenarioStartDebtFresh">Box 3 debt <span class="scenario-source-tag" data-source-for="scenarioStartDebtFresh"></span></label><input id="scenarioStartDebtFresh" type="number" min="0" step="100" placeholder="Enter 0 if none"></div>
  <div class="field"><label for="scenarioBox3ModeFresh">Box 3 treatment <span class="scenario-source-tag" data-source-for="scenarioBox3ModeFresh"></span></label><select id="scenarioBox3ModeFresh"><option value="none">Ignore Box 3 tax</option><option value="current" selected>2026 rules throughout</option><option value="transition">2026 to proposed 2028 regime</option><option value="future">Proposed 2028 regime throughout</option></select></div>
  <div class="field"><label for="scenarioTaxPartnersFresh">Taxpayers / fiscal partners <span class="scenario-source-tag" data-source-for="scenarioTaxPartnersFresh"></span></label><select id="scenarioTaxPartnersFresh"><option value="1" selected>1 person</option><option value="2">2 fiscal partners</option></select></div>
  <div class="field"><label for="scenarioBox3PaySourceFresh">Pay Box 3 tax from <span class="scenario-source-tag" data-source-for="scenarioBox3PaySourceFresh"></span></label><select id="scenarioBox3PaySourceFresh"><option value="savings" selected>Savings / cash</option><option value="portfolio">Investment portfolio</option><option value="external">External cash flow</option></select></div>
  <div class="field"><label for="scenarioSavingsReturnFresh">Expected effective annual savings yield % <span class="scenario-source-tag" data-source-for="scenarioSavingsReturnFresh"></span></label><input id="scenarioSavingsReturnFresh" type="number" min="-10" max="30" step="0.1" value="2"></div>
  <div class="field"><label for="scenarioDebtInterestFresh">Contractual annual Box 3 debt interest % <span class="scenario-source-tag" data-source-for="scenarioDebtInterestFresh"></span></label><input id="scenarioDebtInterestFresh" type="number" min="0" max="30" step="0.1" value="4"></div>
</div>
<div class="scenario-existing-finance" id="scenarioExistingMortgageFresh"><p class="subsection-title">Mortgage used by this comparison</p><div class="grid3">
  <div class="field"><label for="scenarioMortgageBalanceFresh">Current mortgage balance <span class="scenario-source-tag" data-source-for="scenarioMortgageBalanceFresh"></span></label><input id="scenarioMortgageBalanceFresh" type="number" min="0" step="100" placeholder="Required"></div>
  <div class="field"><label for="scenarioMortgageRateFresh">Nominal annual mortgage rate % <span class="scenario-source-tag" data-source-for="scenarioMortgageRateFresh"></span></label><input id="scenarioMortgageRateFresh" type="number" min="0" max="20" step="0.01" placeholder="Required"></div>
  <div class="field"><label for="scenarioMortgageYearsFresh">Remaining mortgage term, years <span class="scenario-source-tag" data-source-for="scenarioMortgageYearsFresh"></span></label><input id="scenarioMortgageYearsFresh" type="number" min="1" max="40" step="1" placeholder="Required"></div>
  <div class="field"><label for="scenarioMortgageMethodFresh">Mortgage method <span class="scenario-source-tag" data-source-for="scenarioMortgageMethodFresh"></span></label><select id="scenarioMortgageMethodFresh"><option value="annuity">Annuity</option><option value="linear">Linear</option></select></div>
</div></div>
<p class="subsection-title">Mortgage-interest tax treatment</p><div class="grid3">
  <div class="field"><label for="scenarioTaxTreatmentFresh">Tax calculation</label><select id="scenarioTaxTreatmentFresh"><option value="auto" selected>Automatic 2026 Box 1 calculation</option><option value="manual">Use my estimated deduction rate</option><option value="none">Exclude mortgage tax</option></select></div>
  <div class="field scenario-tax-auto"><label for="scenarioIncomeFresh">Gross annual Box 1 income <span class="scenario-source-tag" data-source-for="scenarioIncomeFresh"></span></label><input id="scenarioIncomeFresh" type="number" min="0" step="1000" placeholder="Required for automatic tax"></div>
  <div class="field scenario-tax-enabled"><label for="scenarioWozFresh">WOZ value <span class="scenario-source-tag" data-source-for="scenarioWozFresh"></span></label><input id="scenarioWozFresh" type="number" min="0" step="1000" placeholder="Required when mortgage tax is included"></div>
  <div class="field scenario-tax-manual hidden"><label for="scenarioManualDeductionFresh">Estimated deduction rate % <span class="scenario-source-tag" data-source-for="scenarioManualDeductionFresh"></span></label><input id="scenarioManualDeductionFresh" type="number" min="0" max="60" step="0.01" value="37.56"></div>
  <div class="field scenario-tax-eligibility"><label for="scenarioHraYearsFresh">Mortgage-interest deduction remaining, years <span class="scenario-source-tag" data-source-for="scenarioHraYearsFresh"></span></label><input id="scenarioHraYearsFresh" type="number" min="0" max="30" step="1" placeholder="Required"></div>
  <div class="field scenario-tax-eligibility"><label for="scenarioQualifyingDebtFresh">Mortgage qualifying as Box 1 debt % <span class="scenario-source-tag" data-source-for="scenarioQualifyingDebtFresh"></span></label><input id="scenarioQualifyingDebtFresh" type="number" min="0" max="100" step="1" placeholder="Required"></div>
</div>
<details class="inner-fold"><summary>Advanced Box 3 settings</summary><div class="inner-fold-body"><p class="subsection-copy">Statutory 2026 values are labelled calculator rules. Imported custom values remain editable.</p><div class="grid4 advanced-grid">
  <div class="field"><label for="scenarioCurrentTaxRateFresh">2026 Box 3 tax rate %</label><input id="scenarioCurrentTaxRateFresh" type="number" min="0" max="100" step="0.1" value="36"></div>
  <div class="field"><label for="scenarioCurrentAllowanceFresh">2026 allowance per person</label><input id="scenarioCurrentAllowanceFresh" type="number" min="0" step="100" value="59357"></div>
  <div class="field"><label for="scenarioInvestmentNotionalFresh">2026 deemed return, investments %</label><input id="scenarioInvestmentNotionalFresh" type="number" min="0" max="30" step="0.01" value="6"></div>
  <div class="field"><label for="scenarioSavingsNotionalFresh">2026 deemed return, savings %</label><input id="scenarioSavingsNotionalFresh" type="number" min="0" max="30" step="0.01" value="1.28"></div>
  <div class="field"><label for="scenarioDebtNotionalFresh">2026 deemed return, debt %</label><input id="scenarioDebtNotionalFresh" type="number" min="0" max="30" step="0.01" value="2.70"></div>
  <div class="field"><label for="scenarioDebtThresholdFresh">2026 debt threshold</label><input id="scenarioDebtThresholdFresh" type="number" min="0" step="100" value="3800"></div>
  <div class="field"><label for="scenarioFirstJan1PortfolioFresh">First-year 1 January portfolio</label><input id="scenarioFirstJan1PortfolioFresh" type="number" min="0" step="100" data-optional="true" placeholder="Needed for a mid-year start"></div>
  <div class="field"><label for="scenarioFirstJan1SavingsFresh">First-year 1 January savings</label><input id="scenarioFirstJan1SavingsFresh" type="number" min="0" step="100" data-optional="true" placeholder="Needed for a mid-year start"></div>
  <div class="field"><label for="scenarioFirstJan1DebtFresh">First-year 1 January Box 3 debt</label><input id="scenarioFirstJan1DebtFresh" type="number" min="0" step="100" data-optional="true" placeholder="Needed for a mid-year start"></div>
  <div class="field"><label for="scenarioDebtRepaymentFresh">Monthly Box 3 debt repayment</label><input id="scenarioDebtRepaymentFresh" type="number" min="0" step="50" value="0"></div>
  <div class="field"><label for="scenarioDebtRepaymentSourceFresh">Debt repayment source</label><select id="scenarioDebtRepaymentSourceFresh"><option value="external" selected>External cash flow</option><option value="savings">Savings</option></select></div>
  <div class="field"><label for="scenarioFutureStartFresh">Proposed regime start year</label><input id="scenarioFutureStartFresh" type="number" min="2027" max="2100" step="1" value="2028"></div>
  <div class="field"><label for="scenarioFutureTaxRateFresh">Proposed tax rate %</label><input id="scenarioFutureTaxRateFresh" type="number" min="0" max="100" step="0.1" value="36"></div>
  <div class="field"><label for="scenarioFutureExemptFresh">Proposed exempt result</label><input id="scenarioFutureExemptFresh" type="number" min="0" step="100" value="1800"></div>
  <div class="field"><label for="scenarioFutureLossFresh">Proposed loss threshold</label><input id="scenarioFutureLossFresh" type="number" min="0" step="100" value="500"></div>
</div></div></details>`;
engine.querySelector('.scenario-builder').insertAdjacentElement('afterend',startingCard);

const sharedCard=engine.querySelector('#scenarioMonthlyBudgetNew')?.closest('.card');
if(sharedCard){
  const label=sharedCard.querySelector('.section-label');if(label)label.textContent='4 · Shared assumptions';
  const budgetLabel=sharedCard.querySelector('label[for="scenarioMonthlyBudgetNew"]');if(budgetLabel)budgetLabel.textContent='Maximum comfortable housing cost today, optional';
  const budget=engine.querySelector('#scenarioMonthlyBudgetNew');if(budget){budget.value='';budget.dataset.optional='true';budget.placeholder='Optional';}
  const budgetHelp=budget?.closest('.field')?.querySelector('.inline');if(budgetHelp)budgetHelp.textContent='Feasibility check only. It does not change the wealth comparison.';
  const ownerFields=['scenarioVveNew','scenarioMaintenanceNew','scenarioOwnerTaxesNew','scenarioInsuranceNew','scenarioGroundLeaseNew'].map(id=>engine.querySelector(`#${id}`)?.closest('.field')).filter(Boolean);
  const firstOwner=ownerFields[0];
  if(firstOwner){
    const ownerWrap=document.createElement('div');ownerWrap.className='scenario-owner-block';
    ownerWrap.innerHTML=`<div class="field"><label for="scenarioOwnerTotalNew">Owner costs excluding mortgage, per month</label><input id="scenarioOwnerTotalNew" type="number" min="0" step="25" placeholder="Enter total monthly amount"><p class="inline">Includes VvE/service charges, maintenance, owner taxes, building insurance and ground lease.</p></div><label class="scenario-owner-toggle"><input id="scenarioOwnerItemizedNew" type="checkbox"> Break down this amount</label><div id="scenarioOwnerBreakdownFields" class="grid3 hidden"></div>`;
    firstOwner.parentElement.insertBefore(ownerWrap,firstOwner);
    const detailGrid=ownerWrap.querySelector('#scenarioOwnerBreakdownFields');ownerFields.forEach(field=>detailGrid.appendChild(field));
  }
}
const resultCard=engine.querySelector('#scenarioVerdictNew')?.closest('.card');if(resultCard){const label=resultCard.querySelector('.section-label');if(label)label.textContent='5 · Review and result';const review=document.createElement('details');review.id='scenarioReviewPanel';review.className='inner-fold';review.open=true;review.innerHTML='<summary>Inputs used in this result</summary><div class="inner-fold-body"><div id="scenarioReviewSummary" class="scenario-review-list"></div></div>';resultCard.insertBefore(review,engine.querySelector('#scenarioVerdictNew'));}
const builderLabel=engine.querySelector('.scenario-builder .section-label');if(builderLabel)builderLabel.textContent='2 · Choose the decision';
if(divider)divider.insertAdjacentElement('afterend',engine);else panel.prepend(engine);
engine.querySelector('#scenarioPurchaseHraEnabledNew')?.closest('.grid2')?.classList.add('hidden');

const style=document.createElement('style');
style.textContent=`.scenario-legacy-hidden{display:none!important}.scenario-builder .scenario-specific-new{margin-top:14px;padding-top:14px;border-top:.5px solid var(--border)}.scenario-principle{margin-top:4px}.scenario-budget-status{margin-top:10px}.scenario-budget-status.warn{background:var(--amberbg);color:var(--amber)}.scenario-budget-warning{color:var(--amber)!important;font-weight:600}.scenario-verdict-new{background:var(--accentbg);border-radius:var(--small);padding:15px 17px;margin-bottom:12px;color:var(--secondary);font-size:13px;line-height:1.55}.scenario-verdict-new.invalid{background:var(--amberbg);color:var(--amber)}.scenario-verdict-new strong{display:block;color:var(--text);font-size:15px;margin-bottom:3px}.scenario-verdict-new small{display:block;color:var(--muted);margin-top:7px;font-size:11px}.scenario-result-grid-new{margin-top:4px}.strategy-result-new{border:1px solid var(--border);border-radius:var(--radius);padding:17px;background:var(--alt);min-width:0}.strategy-result-new.leader{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}.strategy-name-new{font-size:14px;font-weight:600}.strategy-label-new{font-size:11px;color:var(--muted);margin-top:3px}.strategy-value-new{font-size:24px;font-weight:600;letter-spacing:-.02em;margin:5px 0 12px}.strategy-mini-new{display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-top:.5px solid var(--border);font-size:11px}.strategy-mini-new span{color:var(--muted)}.strategy-mini-new strong{text-align:right}.scenario-table-wrap-new,.sensitivity-wrap-new{margin-top:10px;max-height:430px}.scenario-table-new{min-width:620px}.scenario-table-new th:first-child,.scenario-table-new td:first-child{text-align:left}.scenario-purchase-rules{margin-top:14px}.scenario-purchase-rules.hidden{display:none!important}.scenario-funding-difference-ok{color:var(--green);font-weight:600}.scenario-funding-difference-bad{color:var(--amber);font-weight:600}@media(max-width:800px){.scenario-specific-grid-new{grid-template-columns:1fr}}`;
style.textContent+=`.scenario-source-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.scenario-source-option{display:flex;gap:10px;align-items:flex-start;border:1px solid var(--border);border-radius:var(--radius);padding:15px;cursor:pointer;background:var(--alt)}.scenario-source-option:has(input:checked){border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}.scenario-source-option input{margin-top:3px}.scenario-source-option span{display:grid;gap:4px}.scenario-source-option small{color:var(--muted);font-weight:400;line-height:1.4}.scenario-source-tag{display:inline-block;color:var(--accent);font-size:9px;font-weight:600;margin-left:4px}.scenario-owner-block{grid-column:1/-1;border-top:.5px solid var(--border);padding-top:12px}.scenario-owner-block>.field{max-width:420px}.scenario-owner-toggle{display:inline-flex;gap:7px;align-items:center;margin:8px 0 12px;cursor:pointer}.scenario-existing-finance{margin-top:16px}.scenario-review-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px 16px;margin-top:8px}.scenario-review-list span{font-size:11px;color:var(--secondary)}@media(max-width:800px){.scenario-source-grid,.scenario-review-list{grid-template-columns:1fr}}`;
document.head.appendChild(style);
const economicDisclosure=document.createElement('div');
economicDisclosure.className='callout';
economicDisclosure.innerHTML='<strong>Risk and liquidity:</strong> results are nominal euros, not inflation-adjusted purchasing power. Investment returns are uncertain and sequence-dependent. Mortgage repayment is less liquid than cash or investments, and this model does not assign liquidity a euro value.';
$('scenarioBudgetStatusNew')?.insertAdjacentElement('beforebegin',economicDisclosure);

function selectedMortType(){const v=$('scenarioMortgageMethodNew').value;if(v==='linear'||v==='annuity')return v;return document.querySelector('.compare-card.active[data-mort-type]')?.dataset.mortType||'annuity'}
function mainMortgage(){if($('mortgageMode')?.value==='purchase'){const price=Math.max(0,num('housePrice',0)),savings=Math.max(0,num('ownSavings',0)),cost=Math.max(0,num('purchaseCosts',0));return{balance:Math.max(0,price-Math.max(0,savings-cost)),ratePct:clamp(num('purchaseRate',4),0,20),years:clamp(num('purchaseYears',30),1,40)}}return{balance:Math.max(0,num('mortBalance',0)),ratePct:clamp(num('mortRate',4),0,20),years:clamp(num('mortYears',25),1,40)}}
function hraContext(){return window.LogicIntegrityUI?.mortgageTaxContext?.()||{hraRemainingMonths:360,qualifyingInterestFraction:1}}
function plannerBox3(){
  return{
    mode:$('box3Mode')?.value||'none',taxPartners:clamp(num('taxPartners',1),1,2),paySource:$('box3PaySource')?.value||'savings',
    currentTaxRate:clamp(num('currentTaxRate',36),0,100)/100,currentAllowance:Math.max(0,num('currentAllowance',59357)),currentNotional:clamp(num('currentNotional',6),0,30)/100,
    currentSavingsNotional:clamp(num('currentSavingsNotional',1.28),0,30)/100,currentDebtNotional:clamp(num('currentDebtNotional',2.70),0,30)/100,currentDebtThreshold:Math.max(0,num('currentDebtThreshold',3800)),
    firstJan1Portfolio:Math.max(0,num('firstJan1Portfolio',0)),firstJan1Savings:optional('firstJan1Savings'),firstJan1Debt:optional('firstJan1Debt'),
    savings:Math.max(0,num('box3Savings',0)),debt:Math.max(0,num('box3Debt',0)),savingsReturnPct:clamp(num('box3SavingsReturn',2),-10,30),debtInterestPct:clamp(num('box3DebtInterest',4),0,30),
    debtMonthlyRepayment:Math.max(0,num('box3DebtMonthlyRepayment',0)),debtRepaymentSource:$('box3DebtRepaymentSource')?.value==='savings'?'savings':'external',
    futureStart:clamp(num('futureStart',2028),2027,2100),futureTaxRate:clamp(num('futureTaxRate',36),0,100)/100,futureExempt:Math.max(0,num('futureExempt',1800)),futureLossThreshold:Math.max(0,num('futureLossThreshold',500))
  };
}

function scenarioBox3(){
  return{
    mode:$('scenarioBox3ModeFresh')?.value||'none',taxPartners:clamp(num('scenarioTaxPartnersFresh',1),1,2),paySource:$('scenarioBox3PaySourceFresh')?.value||'savings',
    currentTaxRate:clamp(num('scenarioCurrentTaxRateFresh',36),0,100)/100,currentAllowance:Math.max(0,num('scenarioCurrentAllowanceFresh',59357)),currentNotional:clamp(num('scenarioInvestmentNotionalFresh',6),0,30)/100,
    currentSavingsNotional:clamp(num('scenarioSavingsNotionalFresh',1.28),0,30)/100,currentDebtNotional:clamp(num('scenarioDebtNotionalFresh',2.70),0,30)/100,currentDebtThreshold:Math.max(0,num('scenarioDebtThresholdFresh',3800)),
    firstJan1Portfolio:Math.max(0,num('scenarioFirstJan1PortfolioFresh',0)),firstJan1Savings:optional('scenarioFirstJan1SavingsFresh'),firstJan1Debt:optional('scenarioFirstJan1DebtFresh'),
    savings:Math.max(0,num('scenarioStartSavingsFresh',0)),debt:Math.max(0,num('scenarioStartDebtFresh',0)),savingsReturnPct:clamp(num('scenarioSavingsReturnFresh',2),-10,30),debtInterestPct:clamp(num('scenarioDebtInterestFresh',4),0,30),
    debtMonthlyRepayment:Math.max(0,num('scenarioDebtRepaymentFresh',0)),debtRepaymentSource:$('scenarioDebtRepaymentSourceFresh')?.value==='savings'?'savings':'external',
    futureStart:clamp(num('scenarioFutureStartFresh',2028),2027,2100),futureTaxRate:clamp(num('scenarioFutureTaxRateFresh',36),0,100)/100,futureExempt:Math.max(0,num('scenarioFutureExemptFresh',1800)),futureLossThreshold:Math.max(0,num('scenarioFutureLossFresh',500))
  };
}

function plannerTaxConfig(){
  const hra=hraContext(),mode=$('deductionMode')?.value||'auto',income=Math.max(0,num('grossIncome',0));
  return{enabled:$('mortTaxEnabled')?.checked!==false,calculationMode:mode==='manual'?'manual-rate':'box1-2026',deductionRate:FC.deductionRate2026({mode,manualRatePct:num('manualDeduction',37.56),grossIncome:income}),box1IncomeBeforeOwnHome:income,wozValue:Math.max(0,num('wozValue',0)),hraRemainingMonths:hra.hraRemainingMonths,qualifyingInterestFraction:hra.qualifyingInterestFraction};
}

function plannerSnapshot(){return{startYear:clamp(num('startYear',2026),2020,2100),startMonth:clamp(num('startMonth',1),1,12),investmentReturnPct:clamp(num('annualReturn',5),-30,30),startPortfolio:Math.max(0,num('startPortfolio',0)),mortgageType:document.querySelector('.compare-card.active[data-mort-type]')?.dataset.mortType||'annuity',mortgage:mainMortgage(),tax:plannerTaxConfig(),box3:plannerBox3()}}

function scenarioTaxConfig(mode){
  const purchaseMode=SC.isPurchaseMode(mode),treatment=$('scenarioTaxTreatmentFresh')?.value||'auto',income=Math.max(0,num('scenarioIncomeFresh',0));
  const purchaseTerm=mode==='downpayment'?clamp(num('scenarioDpYearsNew',30),1,40):clamp(num('scenarioBuyYearsNew',30),1,40);
  const hraMonths=purchaseMode?Math.min(360,Math.round(purchaseTerm*12)):Math.min(360,Math.round(Math.max(0,num('scenarioHraYearsFresh',0))*12));
  const qualifying=purchaseMode?1:clamp(num('scenarioQualifyingDebtFresh',0),0,100)/100;
  const manual=treatment==='manual',enabled=treatment!=='none';
  return{enabled,calculationMode:manual||!enabled?'manual-rate':'box1-2026',deductionRate:enabled?FC.deductionRate2026({mode:manual?'manual':'auto',manualRatePct:num('scenarioManualDeductionFresh',37.56),grossIncome:income}):0,box1IncomeBeforeOwnHome:income,wozValue:Math.max(0,num('scenarioWozFresh',0)),hraRemainingMonths:hraMonths,qualifyingInterestFraction:qualifying};
}

function scenarioStartingData(mode){return{startYear:clamp(num('scenarioStartYearFresh',2026),2020,2100),startMonth:clamp(num('scenarioStartMonthFresh',1),1,12),investmentReturnPct:clamp(num('scenarioReturnNew',5),-30,30),startPortfolio:Math.max(0,num('scenarioStartPortfolioFresh',0)),mortgageType:$('scenarioMortgageMethodFresh')?.value==='linear'?'linear':'annuity',mortgage:{balance:Math.max(0,num('scenarioMortgageBalanceFresh',0)),ratePct:clamp(num('scenarioMortgageRateFresh',0),0,20),years:clamp(num('scenarioMortgageYearsFresh',30),1,40)},tax:scenarioTaxConfig(mode),box3:scenarioBox3()}}

let scenarioSourceMode=null;
const sourceFieldIds=['scenarioStartMonthFresh','scenarioStartYearFresh','scenarioStartPortfolioFresh','scenarioStartSavingsFresh','scenarioStartDebtFresh','scenarioBox3ModeFresh','scenarioTaxPartnersFresh','scenarioBox3PaySourceFresh','scenarioSavingsReturnFresh','scenarioDebtInterestFresh','scenarioMortgageBalanceFresh','scenarioMortgageRateFresh','scenarioMortgageYearsFresh','scenarioMortgageMethodFresh','scenarioIncomeFresh','scenarioWozFresh','scenarioManualDeductionFresh','scenarioHraYearsFresh','scenarioQualifyingDebtFresh'];
function setScenarioValue(id,value){const el=$(id);if(el&&value!==null&&value!==undefined)el.value=String(value)}
function setSourceTags(label){document.querySelectorAll('.scenario-source-tag').forEach(tag=>{tag.textContent=label});}
function applyPlannerSnapshot(){
  const x=plannerSnapshot(),b=x.box3,t=x.tax;
  setScenarioValue('scenarioStartMonthFresh',x.startMonth);setScenarioValue('scenarioStartYearFresh',x.startYear);setScenarioValue('scenarioReturnNew',x.investmentReturnPct);setScenarioValue('scenarioStartPortfolioFresh',x.startPortfolio);setScenarioValue('scenarioStartSavingsFresh',b.savings);setScenarioValue('scenarioStartDebtFresh',b.debt);setScenarioValue('scenarioBox3ModeFresh',b.mode);setScenarioValue('scenarioTaxPartnersFresh',b.taxPartners);setScenarioValue('scenarioBox3PaySourceFresh',b.paySource);setScenarioValue('scenarioSavingsReturnFresh',b.savingsReturnPct);setScenarioValue('scenarioDebtInterestFresh',b.debtInterestPct);
  setScenarioValue('scenarioCurrentTaxRateFresh',b.currentTaxRate*100);setScenarioValue('scenarioCurrentAllowanceFresh',b.currentAllowance);setScenarioValue('scenarioInvestmentNotionalFresh',b.currentNotional*100);setScenarioValue('scenarioSavingsNotionalFresh',b.currentSavingsNotional*100);setScenarioValue('scenarioDebtNotionalFresh',b.currentDebtNotional*100);setScenarioValue('scenarioDebtThresholdFresh',b.currentDebtThreshold);setScenarioValue('scenarioDebtRepaymentFresh',b.debtMonthlyRepayment);setScenarioValue('scenarioDebtRepaymentSourceFresh',b.debtRepaymentSource);setScenarioValue('scenarioFutureStartFresh',b.futureStart);setScenarioValue('scenarioFutureTaxRateFresh',b.futureTaxRate*100);setScenarioValue('scenarioFutureExemptFresh',b.futureExempt);setScenarioValue('scenarioFutureLossFresh',b.futureLossThreshold);setScenarioValue('scenarioFirstJan1PortfolioFresh',b.firstJan1Portfolio);if(b.firstJan1Savings!=null)setScenarioValue('scenarioFirstJan1SavingsFresh',b.firstJan1Savings);if(b.firstJan1Debt!=null)setScenarioValue('scenarioFirstJan1DebtFresh',b.firstJan1Debt);
  setScenarioValue('scenarioMortgageBalanceFresh',x.mortgage.balance);setScenarioValue('scenarioMortgageRateFresh',x.mortgage.ratePct);setScenarioValue('scenarioMortgageYearsFresh',x.mortgage.years);setScenarioValue('scenarioMortgageMethodFresh',x.mortgageType);setScenarioValue('scenarioTaxTreatmentFresh',t.enabled===false?'none':t.calculationMode==='manual-rate'?'manual':'auto');setScenarioValue('scenarioIncomeFresh',t.box1IncomeBeforeOwnHome);setScenarioValue('scenarioWozFresh',t.wozValue);setScenarioValue('scenarioManualDeductionFresh',t.deductionRate*100);setScenarioValue('scenarioHraYearsFresh',t.hraRemainingMonths/12);setScenarioValue('scenarioQualifyingDebtFresh',t.qualifyingInterestFraction*100);
  setSourceTags('Imported snapshot');
}

function clearPersonalScenarioFields(){
  ['scenarioStartPortfolioFresh','scenarioStartSavingsFresh','scenarioStartDebtFresh','scenarioMortgageBalanceFresh','scenarioMortgageRateFresh','scenarioMortgageYearsFresh','scenarioIncomeFresh','scenarioWozFresh','scenarioHraYearsFresh','scenarioQualifyingDebtFresh','scenarioOwnerTotalNew','scenarioVveNew','scenarioMaintenanceNew','scenarioOwnerTaxesNew','scenarioInsuranceNew','scenarioGroundLeaseNew','scenarioBuyPriceNew','scenarioBuyCostsNew','scenarioDownPaymentNew','scenarioRentNew','scenarioBuyRateNew','scenarioBuyYearsNew','scenarioBuyWozNew','scenarioDpPriceNew','scenarioDpCostsNew','scenarioDownANew','scenarioDownBNew','scenarioDpRateNew','scenarioDpYearsNew','scenarioDpWozNew','scenarioHomeValueNew','scenarioSellRentNew','scenarioSellWozNew','scenarioExtraMonthlyNew'].forEach(id=>{const el=$(id);if(el)el.value='';});
}

function startFreshScenario(){
  clearPersonalScenarioFields();['scenarioFirstJan1PortfolioFresh','scenarioFirstJan1SavingsFresh','scenarioFirstJan1DebtFresh'].forEach(id=>{const el=$(id);if(el)el.value='';});
  const defaults={scenarioStartMonthFresh:1,scenarioStartYearFresh:2026,scenarioHorizonNew:10,scenarioReturnNew:5,scenarioBox3ModeFresh:'current',scenarioTaxPartnersFresh:1,scenarioBox3PaySourceFresh:'savings',scenarioSavingsReturnFresh:2,scenarioDebtInterestFresh:4,scenarioMortgageMethodFresh:'annuity',scenarioTaxTreatmentFresh:'auto',scenarioManualDeductionFresh:37.56,scenarioCurrentTaxRateFresh:36,scenarioCurrentAllowanceFresh:59357,scenarioInvestmentNotionalFresh:6,scenarioSavingsNotionalFresh:1.28,scenarioDebtNotionalFresh:2.70,scenarioDebtThresholdFresh:3800,scenarioDebtRepaymentFresh:0,scenarioDebtRepaymentSourceFresh:'external',scenarioFutureStartFresh:2028,scenarioFutureTaxRateFresh:36,scenarioFutureExemptFresh:1800,scenarioFutureLossFresh:500,scenarioHomeGrowthNew:2,scenarioRentGrowthNew:2.5,scenarioSellingCostNew:2,scenarioOwnerCostGrowthNew:2};
  Object.entries(defaults).forEach(([id,value])=>setScenarioValue(id,value));if($('scenarioOwnerItemizedNew'))$('scenarioOwnerItemizedNew').checked=false;setSourceTags('Entered here');
  ['scenarioStartMonthFresh','scenarioStartYearFresh','scenarioSavingsReturnFresh','scenarioDebtInterestFresh'].forEach(id=>{const tag=document.querySelector(`[data-source-for="${id}"]`);if(tag)tag.textContent='Calculator assumption';});
}

function purchaseRuleConfig(){
  return{
    enabled:true,
    transferTaxMode:$('scenarioTransferTaxModeNew')?.value||'main',
    manualTransferTax:Math.max(0,num('scenarioManualTransferTaxNew',0)),
    appraisedValue:optional('scenarioPurchaseAppraisedValueNew'),
    nhgMode:$('scenarioPurchaseNhgModeNew')?.value||'none',
    buyerAge:clamp(num('scenarioBuyerAgeNew',35),0,120),
    starterMainResidence:$('scenarioStarterMainResidenceNew')?.checked!==false,
    starterExemptionUnused:$('scenarioStarterUnusedNew')?.checked!==false
  };
}
function config(retOverride){
  const mode=$('comparisonType').value,purchaseMode=SC.isPurchaseMode(mode),source=scenarioStartingData(mode);
  const scenarioConfig={
    mode,horizonYears:clamp(num('scenarioHorizonNew',10),1,40),investmentReturnPct:retOverride??clamp(num('scenarioReturnNew',5),-30,30),
    purchaseCosts:0,purchaseRules:purchaseRuleConfig(),mortgageType:purchaseMode?'annuity':source.mortgageType,mortgage:purchaseMode?{balance:0,ratePct:0,years:30}:source.mortgage,tax:scenarioTaxConfig(mode),box3:source.box3,upfrontCashTreatment:$('scenarioUpfrontCashTreatmentNew')?.value==='savings'?'savings':'invest',homeGrowthPct:clamp(num('scenarioHomeGrowthNew',2),-20,20),rentGrowthPct:clamp(num('scenarioRentGrowthNew',2.5),-10,20),sellingCostPct:clamp(num('scenarioSellingCostNew',2),0,15),
    ownerCostMode:$('scenarioOwnerItemizedNew')?.checked?'itemized':'total',ownerCostTotalMonthly:Math.max(0,num('scenarioOwnerTotalNew',0)),vveMonthly:Math.max(0,num('scenarioVveNew',0)),maintenanceAnnual:Math.max(0,num('scenarioMaintenanceNew',0)),ownerTaxesAnnual:Math.max(0,num('scenarioOwnerTaxesNew',0)),insuranceAnnual:Math.max(0,num('scenarioInsuranceNew',0)),groundLeaseAnnual:Math.max(0,num('scenarioGroundLeaseNew',0)),ownerCostGrowthPct:clamp(num('scenarioOwnerCostGrowthNew',2),-10,20),
    buyRent:{price:Math.max(0,num('scenarioBuyPriceNew',350000)),purchaseCosts:Math.max(0,num('scenarioBuyCostsNew',8000)),downPayment:Math.max(0,num('scenarioDownPaymentNew',35000)),monthlyRent:Math.max(0,num('scenarioRentNew',1600)),mortgageRatePct:clamp(num('scenarioBuyRateNew',4),0,20),mortgageYears:clamp(num('scenarioBuyYearsNew',30),1,40),mortgageType:$('scenarioBuyMortgageTypeNew')?.value==='linear'?'linear':'annuity',wozValue:Math.max(0,num('scenarioWozFresh',num('scenarioBuyPriceNew',350000)))},
    downpayment:{price:Math.max(0,num('scenarioDpPriceNew',350000)),purchaseCosts:Math.max(0,num('scenarioDpCostsNew',8000)),downA:Math.max(0,num('scenarioDownANew',35000)),downB:Math.max(0,num('scenarioDownBNew',15000)),mortgageRatePct:clamp(num('scenarioDpRateNew',4),0,20),mortgageYears:clamp(num('scenarioDpYearsNew',30),1,40),mortgageType:$('scenarioDpMortgageTypeNew')?.value==='linear'?'linear':'annuity',wozValue:Math.max(0,num('scenarioWozFresh',num('scenarioDpPriceNew',350000)))},
    mortgageInvest:{extraMonthly:Math.max(0,num('scenarioExtraMonthlyNew',500))},sellRent:{homeValue:Math.max(0,num('scenarioHomeValueNew',400000)),monthlyRent:Math.max(0,num('scenarioSellRentNew',1600))}
  };
  return SC.resolveScenarioInputSource({sourceMode:scenarioSourceMode,plannerData:source,freshData:source,scenarioConfig});
}
function question(mode){
  if(mode==='buy-rent')return'This purchase is self-contained: price + transaction costs must equal mortgage proceeds + buyer cash. The Mortgage tab purchase setup is not reused.';
  if(mode==='downpayment')return'Each strategy has a complete funding ledger using the same property, costs, rate, term and method. Only buyer cash toward the price differs.';
  if(mode==='mortgage-invest')return'Compares directing the same extra monthly amount to mortgage principal or investments. Money left after mortgage payoff is invested, not discarded.';
  if(mode==='linear-annuity')return'Compares total wealth, including mortgage tax relief, household balances and investing payment differences.';
  return'Compares keeping the current home with selling now, investing net proceeds and renting. A sale shortfall must be funded before comparison.';
}
function visibility(){
  const mode=$('comparisonType').value,purchaseMode=mode==='buy-rent'||mode==='downpayment',transferMode=$('scenarioTransferTaxModeNew')?.value||'main';
  document.querySelectorAll('.scenario-specific-new').forEach(el=>el.classList.toggle('hidden',el.dataset.scenario!==mode));
  document.querySelectorAll('.scenario-upfront-field').forEach(el=>el.classList.toggle('hidden',!purchaseMode));
  document.querySelectorAll('.scenario-existing-mortgage-method-field').forEach(el=>el.classList.add('hidden'));
  document.querySelectorAll('.scenario-purchase-rules').forEach(el=>el.classList.toggle('hidden',!purchaseMode));
  $('scenarioManualTransferTaxFieldNew')?.classList.toggle('hidden',transferMode!=='manual');
  $('scenarioBuyerAgeFieldNew')?.classList.toggle('hidden',transferMode!=='starter');
  $('scenarioStarterConditionsNew')?.classList.toggle('hidden',transferMode!=='starter');
  $('scenarioStartingDataCard')?.classList.toggle('hidden',!scenarioSourceMode);
  $('scenarioExistingMortgageFresh')?.classList.toggle('hidden',purchaseMode);
  document.querySelectorAll('.scenario-tax-eligibility').forEach(el=>el.classList.toggle('hidden',purchaseMode||$('scenarioTaxTreatmentFresh')?.value==='none'));
  const taxTreatment=$('scenarioTaxTreatmentFresh')?.value||'auto';
  document.querySelectorAll('.scenario-tax-auto').forEach(el=>el.classList.toggle('hidden',taxTreatment!=='auto'));
  document.querySelectorAll('.scenario-tax-manual').forEach(el=>el.classList.toggle('hidden',taxTreatment!=='manual'));
  document.querySelectorAll('.scenario-tax-enabled').forEach(el=>el.classList.toggle('hidden',taxTreatment==='none'));
  $('scenarioQuestionNoteNew').textContent=question(mode);
  const note=$('scenarioCashSourceNoteNew');if(note){note.classList.toggle('hidden',!purchaseMode);if(purchaseMode)note.innerHTML=`<strong>Starting savings used by this comparison: ${fmt(Math.max(0,num('scenarioStartSavingsFresh',0)))}</strong><br><span>Transfer tax, NHG and purchase costs are calculated from this scenario. Mortgage-tab purchase inputs are not read after the snapshot is created.</span>`;}
}
function card(el,r,lead,valid=true){
  el.className='strategy-result-new'+(lead?' leader':'');
  if(!valid){el.innerHTML=`<p class="strategy-name-new">${r.name}</p><p class="strategy-label-new">Comparison unavailable</p><p class="strategy-value-new">—</p>`;return;}
  el.innerHTML=`<p class="strategy-name-new">${r.name}</p><p class="strategy-label-new">${r.label}</p><p class="strategy-value-new">${fmt(r.net)}</p><div class="strategy-mini-new"><span>Investment portfolio</span><strong>${fmt(r.invest)}</strong></div><div class="strategy-mini-new"><span>Savings / cash</span><strong>${fmt(r.savings)}</strong></div><div class="strategy-mini-new"><span>Box 3 debt</span><strong>${fmt(r.box3Debt)}</strong></div><div class="strategy-mini-new"><span>Mortgage remaining</span><strong>${fmt(r.mortgage)}</strong></div>${r.equity!==undefined&&r.equity!==null?`<div class="strategy-mini-new"><span>Home equity after sale costs</span><strong>${fmt(r.equity)}</strong></div>`:''}`;
}
function breakdown(A,B){
  $('strategyAHeadNew').textContent=A.name;$('strategyBHeadNew').textContent=B.name;
  const rows=[['Final comparable wealth',A.net,B.net],['Investment portfolio',A.invest,B.invest],['Savings / cash',A.savings,B.savings],['Box 3 debt',A.box3Debt,B.box3Debt],['Household financial wealth',A.financial,B.financial],['Home equity after selling costs',A.equity,B.equity],['Mortgage remaining',A.mortgage,B.mortgage],['Gross mortgage interest',A.interest,B.interest],['Mortgage tax benefit',A.mortTax,B.mortTax],['Rent paid',A.rent,B.rent],['Owner costs excluding mortgage',A.owner,B.owner],['VVE / service charges',A.vve,B.vve],['Other maintenance',A.maintenance,B.maintenance],['OZB / owner taxes',A.ownerTaxes,B.ownerTaxes],['Homeowner insurance',A.insurance,B.insurance],['Ground lease / erfpacht',A.groundLease,B.groundLease],['Purchase price',A.purchasePrice,B.purchasePrice],['Purchase costs',A.purchase,B.purchase],['Buyer cash at purchase',A.buyerCash,B.buyerCash],['Mortgage proceeds at purchase',A.mortgageProceeds,B.mortgageProceeds],['Funding identity difference',A.fundingDifference,B.fundingDifference],['Selling costs used in comparison',A.selling,B.selling],['Settled Box 3 tax',A.box3,B.box3],['Unsettled final-year Box 3 estimate',A.unsettledBox3,B.unsettledBox3],['Box 3 tax paid externally',A.externalTax,B.externalTax],['External Box 3 debt repayment',A.externalDebtRepayment,B.externalDebtRepayment],['Box 3 debt interest',A.box3DebtInterest,B.box3DebtInterest],['Terminal value of dated external outflows',A.externalCashFlowFutureValue,B.externalCashFlowFutureValue]];
  const body=$('scenarioBreakdownBodyNew');body.innerHTML='';
  rows.forEach(([l,a,b])=>{if((a===undefined||a===null)&&(b===undefined||b===null))return;const tr=document.createElement('tr');tr.innerHTML=`<td>${l}</td><td>${a===undefined||a===null?'—':fmt(a)}</td><td>${b===undefined||b===null?'—':fmt(b)}</td>`;body.appendChild(tr)});
}
function renderFunding(x){
  const details=$('scenarioFundingDetailsNew'),body=$('scenarioFundingBodyNew'),status=$('scenarioFundingStatusNew');
  if(!details||!body||!status)return;
  const funding=x?.sourcesAndUses;
  details.classList.toggle('hidden',!funding);
  if(!funding){body.innerHTML='';status.textContent='';return;}
  const A=funding.A,B=funding.B;
  $('fundingAHeadNew').textContent=x.strategies?.A?.name||x.A?.name||'Strategy A';
  $('fundingBHeadNew').textContent=B?(x.strategies?.B?.name||x.B?.name||'Strategy B'):'Not applicable';
  const rows=[
    ['Property price','propertyPrice'],
    ['Other purchase and financing costs','baseCosts'],
    ['Transfer tax','transferTaxAmount'],
    ['NHG fee','nhgFee'],
    ['Total purchase costs','transactionCosts'],
    ['Total uses','totalUses'],
    ['Mortgage proceeds','mortgageProceeds'],
    ['Buyer cash toward price','buyerCashTowardPrice'],
    ['Buyer cash for costs','buyerCashForCosts'],
    ['Total buyer cash','totalBuyerCash'],
    ['Total sources','totalSources'],
    ['Sources minus uses','identityDifference'],
    ['Starting savings','availableSavings'],
    ['Savings remaining after purchase','remainingSavings'],
    ['Cash shortfall','shortfall']
  ];
  body.innerHTML='';
  rows.forEach(([label,key])=>{
    const tr=document.createElement('tr');
    const value=(item,key)=>key==='transferTaxAmount'?item?.transferTax?.amount:item?.[key];
    const a=A?fmt(value(A,key)):'—',b=B?fmt(value(B,key)):'—';
    const cls=key==='identityDifference'?((Math.abs(Number(A?.[key])||0)<=.005&&Math.abs(Number(B?.[key])||0)<=.005)?'scenario-funding-difference-ok':'scenario-funding-difference-bad'):'';
    tr.innerHTML=`<td>${label}</td><td class="${cls}">${a}</td><td class="${cls}">${b}</td>`;
    body.appendChild(tr);
  });
  const ledgers=[A,B].filter(Boolean),valid=ledgers.every(item=>item.valid&&Math.abs(item.identityDifference)<=.005);
  status.classList.toggle('warn',!valid);
  const warnings=ledgers.flatMap(item=>item.warnings||[]);
  status.innerHTML=valid
    ?`<strong>Sources and uses reconcile.</strong><br><span>Each purchase ledger balances to zero within one cent.${warnings.length?' '+warnings.join(' '):''}</span>`
    :`<strong>Purchase funding is invalid.</strong><br><span>${ledgers.flatMap(item=>item.errors||[]).map(error=>error.message).join(' ')}</span>`;
  const rule=$('scenarioPurchaseRuleStatusNew');if(rule){rule.classList.toggle('warn',!valid||warnings.length>0);const first=ledgers[0];rule.innerHTML=first?`<strong>Scenario-local 2026 purchase calculation</strong><br>Transfer tax: ${fmt(first.transferTax?.amount||0)} · NHG fee: ${fmt(first.nhgFee||0)} · total purchase costs: ${fmt(first.transactionCosts||0)}.${warnings.length?`<br>${warnings.join('<br>')}`:''}`:'';}
}
function budgetStatus(x){
  const input=$('scenarioMonthlyBudgetNew'),el=$('scenarioBudgetStatusNew');
  if(!input||String(input.value).trim()===''){el.classList.remove('warn');el.innerHTML='<strong>Comfortable housing cost not entered.</strong> This optional feasibility check does not affect the wealth comparison.';return 0;}
  const budget=Math.max(0,num('scenarioMonthlyBudgetNew',0)),gap=x.firstRequirement-budget;
  el.classList.toggle('warn',gap>.01);
  el.innerHTML=gap<=.01?`<strong>Starting housing-cost check passed.</strong> The higher starting requirement is ${fmt(x.firstRequirement)} against your ${fmt(budget)} comfortable limit.`:`<strong>Starting housing-cost warning.</strong> The higher starting requirement is ${fmt(x.firstRequirement)}/mo, ${fmt(gap)}/mo above your comfortable limit.`;
  return gap;
}
function sensitivity(){
  let low=clamp(num('sensitivityLowNew',2),-30,30),high=clamp(num('sensitivityHighNew',10),-30,30),step=clamp(num('sensitivityStepNew',2),.5,10);if(high<low)[low,high]=[high,low];
  const rows=[];let prev=null,cross=null;
  const mode=$('comparisonType').value,years=clamp(num('scenarioHorizonNew',10),1,40);
  for(let r=low;r<=high+1e-9&&rows.length<61;r+=step){const x=OI.canonicalComparisonResult(SC.runScenario(config(r)),{mode,years,returnPct:r});if(!x.valid){$('sensitivityBodyNew').innerHTML='';$('sensitivitySummaryNew').innerHTML='<strong>Sensitivity unavailable.</strong> Fund the upfront cash requirement first.';return;}const d=x.difference;if(prev&&Math.sign(prev.d)!==Math.sign(d)&&prev.d!==0&&d!==0)cross=prev.r+(r-prev.r)*(Math.abs(prev.d)/(Math.abs(prev.d)+Math.abs(d)));else if(d===0)cross=r;rows.push({r,canonical:x});prev={r,d};}
  const body=$('sensitivityBodyNew');body.innerHTML='';rows.forEach(x=>{const tr=document.createElement('tr'),canonical=x.canonical;tr.innerHTML=`<td>${pct(x.r)}</td><td>${fmt(canonical.strategies.A.net)}</td><td>${fmt(canonical.strategies.B.net)}</td><td>${canonical.outcome==='tie'?'Tie':canonical.outcome}</td>`;body.appendChild(tr)});
  $('sensitivitySummaryNew').innerHTML=cross===null?'<strong>No crossover found in this return range.</strong> Under these tested assumptions, one strategy has higher modeled wealth throughout the range.':`<strong>Approximate crossover: ${pct(cross)} effective annual investment return.</strong> Around this point, the strategy with higher modeled wealth changes.`;
}
function scenarioInputReport(mode){
  const controls=[...engine.querySelectorAll('input')].filter(el=>!String(el.id).startsWith('sensitivity'));
  return II.validateControls(controls);
}
function ownerMonthlyTotal(){return num('scenarioVveNew',0)+(num('scenarioMaintenanceNew',0)+num('scenarioOwnerTaxesNew',0)+num('scenarioInsuranceNew',0)+num('scenarioGroundLeaseNew',0))/12}
function syncOwnerMode(){
  const itemized=Boolean($('scenarioOwnerItemizedNew')?.checked),detail=$('scenarioOwnerBreakdownFields'),total=$('scenarioOwnerTotalNew');
  detail?.classList.toggle('hidden',!itemized);if(total)total.disabled=itemized;
  ['scenarioVveNew','scenarioMaintenanceNew','scenarioOwnerTaxesNew','scenarioInsuranceNew','scenarioGroundLeaseNew'].forEach(id=>{const el=$(id);if(el)el.disabled=!itemized;});
  if(itemized&&total)total.value=String(Math.round(ownerMonthlyTotal()*100)/100);
}
function renderReview(mode){
  const target=$('scenarioReviewSummary');if(!target)return;
  const source=scenarioSourceMode===SC.INPUT_SOURCE_MODES.IMPORTED?'Existing planner snapshot':'Fresh scenario';
  const items=[['Data source',source],['Compare after',`${num('scenarioHorizonNew',0)} years`],['Investment return',`${num('scenarioReturnNew',0)}%`],['Starting portfolio',fmt(num('scenarioStartPortfolioFresh',0))],['Savings and cash',fmt(num('scenarioStartSavingsFresh',0))],['Box 3 debt',fmt(num('scenarioStartDebtFresh',0))],['Owner costs at start',fmt($('scenarioOwnerItemizedNew')?.checked?ownerMonthlyTotal():num('scenarioOwnerTotalNew',0))+'/mo'],['Mortgage tax',$('scenarioTaxTreatmentFresh')?.selectedOptions?.[0]?.textContent||'Not set']];
  if(!SC.isPurchaseMode(mode))items.push(['Mortgage balance',fmt(num('scenarioMortgageBalanceFresh',0))],['Mortgage rate',`${num('scenarioMortgageRateFresh',0)}%`],['Remaining term',`${num('scenarioMortgageYearsFresh',0)} years`]);
  if(mode==='sell-rent')items.push(['Current home value',fmt(num('scenarioHomeValueNew',0))],['Starting rent',fmt(num('scenarioSellRentNew',0))+'/mo']);
  if(mode==='buy-rent')items.push(['Purchase price',fmt(num('scenarioBuyPriceNew',0))],['Starting rent',fmt(num('scenarioRentNew',0))+'/mo']);
  target.replaceChildren(...items.map(([label,value])=>{const span=document.createElement('span');span.textContent=`${label}: ${value}`;return span;}));
}
function renderInvalidInputs(mode,report){
  const reason=II.summary(report),canonical=OI.canonicalComparisonResult({valid:false,status:'invalid-input',reason},{mode}),model=OI.comparisonOutputModel(canonical),A=canonical.strategies.A,B=canonical.strategies.B,verdict=$('scenarioVerdictNew');
  window.__DIMP_CANONICAL_COMPARISON=canonical;
  window.__DIMP_ACTIVE_SCENARIO_CONFIG=null;
  card($('strategyAResultNew'),A,false,false);card($('strategyBResultNew'),B,false,false);
  verdict.classList.add('invalid');verdict.innerHTML=`<strong>${model.title}</strong><span> ${model.detail}</span>`;
  $('scenarioBreakdownBodyNew').innerHTML='';$('sensitivityBodyNew').innerHTML='';$('sensitivitySummaryNew').innerHTML='<strong>Sensitivity unavailable.</strong> Complete the required inputs.';
  renderFunding(canonical);
}
function updateEngine(){
  visibility();const mode=$('comparisonType').value;renderReview(mode);if(!scenarioSourceMode){renderInvalidInputs(mode,{valid:false,errors:[{message:'Choose whether to use existing planner data or start fresh.'}]});return;}const report=scenarioInputReport(mode);if(!report.valid){renderInvalidInputs(mode,report);return;}const activeConfig=config();window.__DIMP_ACTIVE_SCENARIO_CONFIG=activeConfig;const x=SC.runScenario(activeConfig),gap=budgetStatus(x),verdict=$('scenarioVerdictNew'),years=clamp(num('scenarioHorizonNew',10),1,40),returnPct=clamp(num('scenarioReturnNew',5),-30,30),canonical=OI.canonicalComparisonResult(x,{mode,years,returnPct,budgetGap:gap}),model=OI.comparisonOutputModel(canonical),A=canonical.strategies.A,B=canonical.strategies.B;renderFunding(canonical);
  window.__DIMP_CANONICAL_COMPARISON=canonical;
  if(!canonical.valid){card($('strategyAResultNew'),A,false,false);card($('strategyBResultNew'),B,false,false);verdict.classList.add('invalid');verdict.innerHTML=`<strong>${model.title}</strong><span> ${model.detail}</span>`;$('scenarioBreakdownBodyNew').innerHTML='';$('sensitivityBodyNew').innerHTML='';$('sensitivitySummaryNew').innerHTML='<strong>Sensitivity unavailable.</strong> Resolve the comparison inputs first.';return;}
  verdict.classList.remove('invalid');card($('strategyAResultNew'),A,canonical.outcome==='A',true);card($('strategyBResultNew'),B,canonical.outcome==='B',true);
  verdict.innerHTML=`<strong>${model.title}</strong><span> ${model.detail}</span>${canonical.note?`<small>${canonical.note}</small>`:''}${gap>.01?`<small class="scenario-budget-warning">Starting housing-cost warning: the higher strategy exceeds your comfortable limit by ${fmt(gap)}.</small>`:''}`;
  const startMonth=clamp(num('scenarioStartMonthFresh',1),1,12),midYear=startMonth>1,endMonth=((startMonth-1+years*12-1)%12)+1;
  $('scenarioTaxNoteNew').textContent=`Box 3: ${$('scenarioBox3ModeFresh')?.selectedOptions?.[0]?.textContent||'not set'}. Mortgage-interest tax: ${$('scenarioTaxTreatmentFresh')?.selectedOptions?.[0]?.textContent||'not set'}.${midYear?' A first-year 1 January snapshot is required for a mid-year start.':''}${endMonth!==12?' Final partial-year Box 3 remains an unsettled estimate.':''}`;
  breakdown(A,B);sensitivity();
}
document.querySelectorAll('input[name="scenarioDataSource"]').forEach(input=>input.addEventListener('change',()=>{scenarioSourceMode=input.value;if(scenarioSourceMode===SC.INPUT_SOURCE_MODES.IMPORTED){clearPersonalScenarioFields();applyPlannerSnapshot();$('scenarioRefreshImport')?.classList.remove('hidden');$('scenarioSourceStatus').innerHTML='<strong>Existing data copied.</strong> Review the imported snapshot below. Changes in other tabs will not alter it unless you refresh.';}else{startFreshScenario();$('scenarioRefreshImport')?.classList.add('hidden');$('scenarioSourceStatus').innerHTML='<strong>Fresh comparison started.</strong> Only values entered in Scenarios will be used.';}syncOwnerMode();updateEngine();}));
$('scenarioRefreshImport')?.addEventListener('click',()=>{if(scenarioSourceMode!==SC.INPUT_SOURCE_MODES.IMPORTED)return;applyPlannerSnapshot();$('scenarioSourceStatus').innerHTML='<strong>Snapshot refreshed.</strong> Current relevant values were copied from Investing and Mortgage.';updateEngine();});
$('scenarioOwnerItemizedNew')?.addEventListener('change',()=>{syncOwnerMode();updateEngine();});
startingCard.addEventListener('input',event=>{if(scenarioSourceMode===SC.INPUT_SOURCE_MODES.IMPORTED&&sourceFieldIds.includes(event.target.id)){const tag=document.querySelector(`[data-source-for="${event.target.id}"]`);if(tag)tag.textContent='Edited here';}});
startingCard.addEventListener('change',event=>{if(scenarioSourceMode===SC.INPUT_SOURCE_MODES.IMPORTED&&sourceFieldIds.includes(event.target.id)){const tag=document.querySelector(`[data-source-for="${event.target.id}"]`);if(tag)tag.textContent='Edited here';}});
engine.addEventListener('input',event=>{if(event.target.closest('#scenarioOwnerBreakdownFields')&&$('scenarioOwnerItemizedNew')?.checked){$('scenarioOwnerTotalNew').value=String(Math.round(ownerMonthlyTotal()*100)/100);}updateEngine();});engine.addEventListener('change',updateEngine);
syncOwnerMode();
updateEngine();
})();}
