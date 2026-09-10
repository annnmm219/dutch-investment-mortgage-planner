(function(root,factory){
  const Policy2026=typeof module==='object'&&module.exports?require('./policy-2026.js'):root.Policy2026;
  const ModelContract=typeof module==='object'&&module.exports?require('./model-contract.js'):root.ModelContract;
  const api=factory(Policy2026,ModelContract);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.FinanceCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Policy2026,ModelContract){
'use strict';
if(!Policy2026)throw new Error('Policy2026 is required by FinanceCore');
if(!ModelContract)throw new Error('ModelContract is required by FinanceCore');
const POLICY=Policy2026.VALUES;

const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const nonNegative=v=>Math.max(0,Number(v)||0);
const number=v=>Number.isFinite(Number(v))?Number(v):0;

function effectiveAnnualPctToMonthly(value){
  return ModelContract.effectiveAnnualToMonthly((Number(value)||0)/100);
}
function nominalAnnualPctToMonthly(value){
  return ModelContract.nominalAnnualToMonthly((Number(value)||0)/100);
}

function deductionRate2026({mode='auto',manualRatePct=POLICY.box1.ownHomeDeductionMaxRate*100,grossIncome=0}={}){
  if(mode==='manual')return clamp(Number(manualRatePct)||0,0,60)/100;
  const income=Number(grossIncome)||0;
  return income<=POLICY.box1.preAowBrackets[0].upper
    ?POLICY.box1.preAowBrackets[0].rate
    :POLICY.box1.ownHomeDeductionMaxRate;
}

function ewf2026(woz){
  const value=nonNegative(woz);
  for(const band of POLICY.eigenwoningforfait.rateBands){
    if(value<=band.upper)return value*band.rate;
  }
  return POLICY.eigenwoningforfait.highValueBase
    +(value-POLICY.eigenwoningforfait.highValueThreshold)*POLICY.eigenwoningforfait.highValueExcessRate;
}

function hillenReliefForYear(year=POLICY.taxYear,override){
  if(Number.isFinite(Number(override)))return clamp(Number(override),0,1);
  const y=Math.round(Number(year)||POLICY.taxYear);
  if(y<POLICY.hillen.phaseOutStartYear)return 1;
  if(y<=2025)return clamp(1-(y-2018)/POLICY.hillen.legacyPhaseOutYears,0,1);
  if(y>=POLICY.hillen.zeroFromYear)return 0;
  return clamp(POLICY.hillen.relief2026-(y-POLICY.taxYear)*POLICY.hillen.planningAnnualReductionAfter2026,0,1);
}

function mortgageTaxBenefit({interest=0,months=1,ownershipMonths,deductionRate=0,wozValue=0,enabled=true,hillenRelief,year=2026}={}){
  const ownedMonths=ownershipMonths==null?Number(months)||0:Number(ownershipMonths)||0;
  if(!enabled||ownedMonths<=0)return 0;
  const deductibleInterest=nonNegative(interest);
  const rate=clamp(Number(deductionRate)||0,0,1);
  const ewf=ewf2026(wozValue)*ownedMonths/12;
  if(deductibleInterest>=ewf)return (deductibleInterest-ewf)*rate;
  const relief=hillenReliefForYear(year,hillenRelief);
  return -(ewf-deductibleInterest)*(1-relief)*rate;
}

function allocateAnnualMortgageTax(rows=[],tax={}){
  const resultRows=(Array.isArray(rows)?rows:[]).map(r=>({
    ...r,
    taxReturn:0,
    net:Number(r.gross)||0,
    cash:(Number(r.gross)||0)+nonNegative(r.extra)
  }));
  const annualBuckets={};

  resultRows.forEach((row,index)=>{
    if(row.homeOwned===false)return;
    const year=Number(row.year);
    if(!Number.isFinite(year))return;
    if(!annualBuckets[year])annualBuckets[year]={year,indexes:[],grossInterest:0,deductibleInterest:0,interest:0,ownershipMonths:0,months:0,eligibleMonths:0,taxBenefit:0,hillenRelief:0};
    const bucket=annualBuckets[year];
    const deductible=row.deductibleInterest!=null?nonNegative(row.deductibleInterest):(row.hraEligible===false?0:nonNegative(row.interest));
    bucket.indexes.push(index);
    bucket.grossInterest+=nonNegative(row.interest);
    bucket.deductibleInterest+=deductible;
    bucket.interest=bucket.deductibleInterest;
    bucket.ownershipMonths++;
    bucket.months=bucket.ownershipMonths;
    if(deductible>0)bucket.eligibleMonths++;
  });

  let totalTaxBenefit=0;
  Object.values(annualBuckets).forEach(bucket=>{
    const relief=hillenReliefForYear(bucket.year,typeof tax.hillenRelief==='function'?tax.hillenRelief(bucket.year):tax.hillenRelief);
    const annualBenefit=mortgageTaxBenefit({
      interest:bucket.deductibleInterest,
      ownershipMonths:bucket.ownershipMonths,
      deductionRate:tax.deductionRate,
      wozValue:tax.wozValue,
      enabled:tax.enabled!==false,
      hillenRelief:relief,
      year:bucket.year
    });
    bucket.hillenRelief=relief;
    bucket.taxBenefit=annualBenefit;
    totalTaxBenefit+=annualBenefit;

    const indexes=bucket.indexes;
    if(!indexes.length)return;
    const positiveByInterest=annualBenefit>=0&&bucket.deductibleInterest>0;
    let allocated=0;
    const allocationIndexes=positiveByInterest
      ?indexes.filter(i=>nonNegative(resultRows[i].deductibleInterest)>0)
      :indexes;
    allocationIndexes.forEach((rowIndex,pos)=>{
      const row=resultRows[rowIndex];
      let share;
      if(pos===allocationIndexes.length-1)share=annualBenefit-allocated;
      else if(positiveByInterest)share=annualBenefit*(nonNegative(row.deductibleInterest)/bucket.deductibleInterest);
      else share=annualBenefit/allocationIndexes.length;
      allocated+=share;
      row.taxReturn=share;
    });
    indexes.forEach(rowIndex=>{
      const row=resultRows[rowIndex];
      row.net=(Number(row.gross)||0)-(Number(row.taxReturn)||0);
      row.cash=row.net+nonNegative(row.extra);
      row.cashWithRequestedExtra=row.net+nonNegative(row.requestedExtra??row.extra);
    });
  });

  return{rows:resultRows,annualBuckets,totalTaxBenefit};
}

function regimeForYear({mode='none',year,futureStart=2028}={}){
  if(mode==='none')return'none';
  if(mode==='current')return'current';
  if(mode==='future')return'future';
  return Number(year)>=Number(futureStart||2028)?'future':'current';
}

function box3TaxForYear({
  regime='none',jan1Portfolio=0,jan1Savings=0,jan1Debt=0,marketGain=0,savingsIncome=0,debtInterest=0,lossCarry=0,allowActualRebuttal=true,
  taxPartners=1,currentTaxRate=POLICY.box3.taxRate,currentAllowance=POLICY.box3.allowancePerPerson,currentNotional=POLICY.box3.investmentDeemedRate,currentSavingsNotional=POLICY.box3.savingsDeemedRate,currentDebtNotional=POLICY.box3.debtDeemedRate,currentDebtThreshold=POLICY.box3.debtThresholdPerPerson,
  futureTaxRate=.36,futureExempt=1800,futureLossThreshold=500
}={}){
  let tax=0;
  let nextLossCarry=nonNegative(lossCarry);
  let method='none';
  const partners=clamp(Number(taxPartners)||1,1,2);
  const investmentValue=nonNegative(jan1Portfolio),savingsValue=nonNegative(jan1Savings),debtValue=nonNegative(jan1Debt);
  const actualReturn=(Number(marketGain)||0)+(Number(savingsIncome)||0)-nonNegative(debtInterest);

  if(regime==='current'){
    const allowance=nonNegative(currentAllowance)*partners;
    const debtThreshold=nonNegative(currentDebtThreshold)*partners;
    const deductibleDebt=Math.max(0,debtValue-debtThreshold);
    const assets=savingsValue+investmentValue;
    const rendementsgrondslag=Math.max(0,assets-deductibleDebt);
    const taxableBase=Math.max(0,rendementsgrondslag-allowance);
    const share=rendementsgrondslag>0?clamp(taxableBase/rendementsgrondslag,0,1):0;
    const savingsDeemed=savingsValue*clamp(Number(currentSavingsNotional)||0,0,1);
    const investmentDeemed=investmentValue*clamp(Number(currentNotional)||0,0,1);
    const debtDeemed=deductibleDebt*clamp(Number(currentDebtNotional)||0,0,1);
    const deemedReturn=savingsDeemed+investmentDeemed-debtDeemed;
    const deemedIncome=Math.max(0,deemedReturn*share);
    const notionalTax=deemedIncome*clamp(Number(currentTaxRate)||0,0,1);
    const actualTax=Math.max(0,actualReturn)*clamp(Number(currentTaxRate)||0,0,1);
    if(allowActualRebuttal){
      tax=Math.min(notionalTax,actualTax);
      method=actualTax<=notionalTax?'actual-return rebuttal':'deemed return';
    }else{
      tax=notionalTax;
      method='deemed return · incomplete actual-return year';
    }
    return{tax,lossCarry:nextLossCarry,method,notionalTax,actualTax,deemedIncome,deemedReturn,actualReturn,deductibleDebt,rendementsgrondslag,taxableBase,share,allowActualRebuttal,
      components:{savingsDeemed,investmentDeemed,debtDeemed,savingsIncome:Number(savingsIncome)||0,marketGain:Number(marketGain)||0,debtInterest:nonNegative(debtInterest)}};
  }

  if(regime==='future'){
    const result=actualReturn;
    if(result<0){
      nextLossCarry+=Math.max(0,-result-nonNegative(futureLossThreshold));
      method='proposed actual return · loss';
    }else{
      const afterExemption=Math.max(0,result-nonNegative(futureExempt)*partners);
      const usedLoss=Math.min(nextLossCarry,afterExemption);
      const taxable=Math.max(0,afterExemption-usedLoss);
      nextLossCarry-=usedLoss;
      tax=taxable*clamp(Number(futureTaxRate)||0,0,1);
      method='proposed actual return';
    }
    return{tax,lossCarry:nextLossCarry,method,actualReturn:result};
  }
  return{tax,lossCarry:nextLossCarry,method,actualReturn};
}

function payTaxFromSource({tax=0,paySource='portfolio',portfolio=0,savings=0}={}){
  const charge=nonNegative(tax);
  let p=nonNegative(portfolio),s=nonNegative(savings),remaining=charge;
  let fromPortfolio=0,fromSavings=0,external=0;
  if(paySource==='savings'){
    fromSavings=Math.min(s,remaining);s-=fromSavings;remaining-=fromSavings;
    external=remaining;
  }else if(paySource==='portfolio'){
    fromPortfolio=Math.min(p,remaining);p-=fromPortfolio;remaining-=fromPortfolio;
    external=remaining;
  }else external=remaining;
  return{portfolio:p,savings:s,fromPortfolio,fromSavings,external};
}

function mortgageSchedule({balance=0,annualRatePct=0,termYears=30,type='annuity',months,extraMonthly=0,startYear=2026,startMonth=1,tax={}}={}){
  const initialBalance=nonNegative(balance);
  const annualRate=clamp(Number(annualRatePct)||0,0,100)/100,monthlyRate=ModelContract.nominalAnnualToMonthly(annualRate);
  const termMonths=Math.max(1,Math.round(clamp(Number(termYears)||1,1,100)*12));
  const horizonMonths=Math.max(0,Math.round(months==null?termMonths:months));
  const mortgageType=type==='linear'?'linear':'annuity';
  const linearPrincipal=initialBalance/termMonths;
  const annuityPayment=monthlyRate===0?initialBalance/termMonths:initialBalance*monthlyRate/(1-Math.pow(1+monthlyRate,-termMonths));
  const taxEnabled=tax.enabled!==false,deductionRate=clamp(Number(tax.deductionRate)||0,0,1),wozValue=nonNegative(tax.wozValue);
  const hraRemainingMonths=tax.hraRemainingMonths==null?Math.min(termMonths,POLICY.ownHome.maximumQualifyingMortgageMonths):Math.max(0,Math.round(Number(tax.hraRemainingMonths)||0));
  const qualifyingInterestFraction=clamp(Number(tax.qualifyingInterestFraction??1)||0,0,1);
  const homeOwnershipMonths=tax.homeOwnershipMonths==null?horizonMonths:Math.max(0,Math.round(Number(tax.homeOwnershipMonths)||0));
  let outstanding=initialBalance,totalInterest=0,totalScheduledPrincipal=0,totalExtra=0,totalRequestedExtra=0,totalUnusedExtra=0,payoffMonthIndex=null;
  const rawRows=[];
  let year=Number(startYear)||2026,month=clamp(Number(startMonth)||1,1,12);

  for(let i=0;i<horizonMonths;i++){
    const homeOwned=i<homeOwnershipMonths;
    const balanceAtStart=outstanding;
    const requestedExtra=Array.isArray(extraMonthly)?nonNegative(extraMonthly[i]):typeof extraMonthly==='function'?nonNegative(extraMonthly(i,{year,month,balance:outstanding})):nonNegative(extraMonthly);
    totalRequestedExtra+=requestedExtra;
    let interest=0,principal=0,gross=0,extra=0;
    if(outstanding>0){
      interest=outstanding*monthlyRate;
      principal=mortgageType==='linear'?Math.min(outstanding,linearPrincipal):Math.min(outstanding,Math.max(0,annuityPayment-interest));
      gross=interest+principal;outstanding-=principal;
      extra=Math.min(outstanding,requestedExtra);outstanding-=extra;
      if(outstanding<=.005){outstanding=0;if(payoffMonthIndex===null)payoffMonthIndex=i;}
    }
    const unusedExtra=Math.max(0,requestedExtra-extra);
    totalInterest+=interest;totalScheduledPrincipal+=principal;totalExtra+=extra;totalUnusedExtra+=unusedExtra;
    const hraEligible=taxEnabled&&homeOwned&&i<hraRemainingMonths&&balanceAtStart>0&&qualifyingInterestFraction>0;
    const deductibleInterest=hraEligible?interest*qualifyingInterestFraction:0;
    rawRows.push({monthIndex:i,year,month,balance:outstanding,gross,principal,interest,deductibleInterest,taxReturn:0,net:gross,extra,requestedExtra,unusedExtra,cash:gross+extra,cashWithRequestedExtra:gross+requestedExtra,homeOwned,hraEligible});
    month++;if(month===13){month=1;year++;}
  }
  const allocation=allocateAnnualMortgageTax(rawRows,{enabled:taxEnabled,deductionRate,wozValue,hillenRelief:tax.hillenRelief});
  return{rows:allocation.rows,annualTaxBuckets:allocation.annualBuckets,initialBalance,balance:outstanding,totalInterest,totalTaxBenefit:allocation.totalTaxBenefit,
    totalScheduledPrincipal,totalExtra,totalRequestedExtra,totalUnusedExtra,totalScheduledPaid:totalInterest+totalScheduledPrincipal,firstScheduled:allocation.rows.length?allocation.rows[0].gross:0,payoffMonthIndex,type:mortgageType,
    hraRemainingMonths,qualifyingInterestFraction,homeOwnershipMonths};
}

function provisionalBox3({regime,jan1Portfolio,jan1Savings,jan1Debt,marketGain,savingsIncome,debtInterest,lossCarry,taxPartners,currentTaxRate,currentAllowance,currentNotional,currentSavingsNotional,currentDebtNotional,currentDebtThreshold,futureTaxRate,futureExempt,futureLossThreshold}){
  return box3TaxForYear({regime,jan1Portfolio,jan1Savings,jan1Debt,marketGain,savingsIncome,debtInterest,lossCarry,taxPartners,currentTaxRate,currentAllowance,currentNotional,currentSavingsNotional,currentDebtNotional,currentDebtThreshold,futureTaxRate,futureExempt,futureLossThreshold,allowActualRebuttal:false});
}

function simulateInvestmentFlows({
  initialPortfolio=0,flows=[],annualReturnPct=0,startYear=2026,startMonth=1,box3Mode='none',taxPartners=1,paySource='portfolio',
  currentTaxRate=POLICY.box3.taxRate,currentAllowance=POLICY.box3.allowancePerPerson,currentNotional=POLICY.box3.investmentDeemedRate,currentSavingsNotional=POLICY.box3.savingsDeemedRate,currentDebtNotional=POLICY.box3.debtDeemedRate,currentDebtThreshold=POLICY.box3.debtThresholdPerPerson,
  firstJan1Portfolio=0,box3Savings=0,box3Debt=0,firstJan1Savings=null,firstJan1Debt=null,savingsReturnPct=0,debtInterestPct=0,
  savingsFlows=[],box3DebtMonthlyRepayment=0,debtRepayments=[],debtRepaymentSource='external',box3DebtFallbackDestination='invest',futureStart=2028,futureTaxRate=.36,futureExempt=1800,futureLossThreshold=500
}={}){
  const monthlyReturn=effectiveAnnualPctToMonthly(annualReturnPct),
    monthlySavingsRate=effectiveAnnualPctToMonthly(savingsReturnPct),
    monthlyDebtRate=nominalAnnualPctToMonthly(debtInterestPct);
  let portfolio=nonNegative(initialPortfolio),savings=nonNegative(box3Savings),debt=nonNegative(box3Debt);
  let totalTax=0,currentTax=0,futureTax=0,unsettledTaxEstimate=0,externalTax=0,taxPaidFromSavings=0,taxPaidFromPortfolio=0,lossCarry=0;
  let externalDebtRepayment=0,totalDebtRepaid=0,totalDebtInterest=0,cashShortfall=0;
  let plannedBox3DebtRepayment=0,unusedBox3DebtRepayment=0,box3DebtFallbackInvested=0,box3DebtFallbackSaved=0,box3DebtFallbackConsumed=0,box3DebtRepaymentShortfall=0,externalBox3DebtFallback=0;
  let year=Number(startYear)||2026,month=clamp(Number(startMonth)||1,1,12);
  let yearStartPortfolio=portfolio,yearStartSavings=savings,yearStartDebt=debt;
  let marketGain=0,savingsIncome=0,debtInterest=0;
  const yearBuckets={},series=[],monthlyFlows=Array.isArray(flows)?flows:[],monthlySavingsFlows=Array.isArray(savingsFlows)?savingsFlows:[],monthlyDebtRepayments=Array.isArray(debtRepayments)?debtRepayments:[];
  const externalCashFlows=Array.from({length:monthlyFlows.length},()=>0);

  for(let i=0;i<monthlyFlows.length;i++){
    const growth=portfolio*monthlyReturn;portfolio+=growth;marketGain+=growth;portfolio+=nonNegative(monthlyFlows[i]);
    const saveInterest=savings*monthlySavingsRate;savings+=saveInterest;savingsIncome+=saveInterest;
    const interestOnDebt=debt*monthlyDebtRate;debtInterest+=interestOnDebt;totalDebtInterest+=interestOnDebt;externalCashFlows[i]+=interestOnDebt;

    const savingFlow=number(monthlySavingsFlows[i]);
    if(savingFlow>=0)savings+=savingFlow;
    else{const requested=-savingFlow,used=Math.min(savings,requested),shortfall=requested-used;savings-=used;cashShortfall+=shortfall;externalCashFlows[i]+=shortfall;}

    const requestedDebtRepay=monthlyDebtRepayments.length?nonNegative(monthlyDebtRepayments[i]):nonNegative(box3DebtMonthlyRepayment);
    plannedBox3DebtRepayment+=requestedDebtRepay;
    const availableDebtBudget=debtRepaymentSource==='savings'?Math.min(requestedDebtRepay,savings):requestedDebtRepay;
    const repay=Math.min(debt,availableDebtBudget);
    if(repay>0){
      if(debtRepaymentSource==='savings')savings-=repay;
      else{externalDebtRepayment+=repay;externalCashFlows[i]+=repay;}
      debt-=repay;totalDebtRepaid+=repay;
    }
    const debtBudgetShortfall=Math.max(0,requestedDebtRepay-availableDebtBudget);
    const unusedDebtBudget=Math.max(0,availableDebtBudget-repay);
    box3DebtRepaymentShortfall+=debtBudgetShortfall;
    unusedBox3DebtRepayment+=unusedDebtBudget;
    if(unusedDebtBudget>0){
      if(box3DebtFallbackDestination==='savings'){
        if(debtRepaymentSource!=='savings'){savings+=unusedDebtBudget;externalBox3DebtFallback+=unusedDebtBudget;externalCashFlows[i]+=unusedDebtBudget;}
        box3DebtFallbackSaved+=unusedDebtBudget;
      }else if(box3DebtFallbackDestination==='consume'){
        if(debtRepaymentSource==='savings')savings-=unusedDebtBudget;
        box3DebtFallbackConsumed+=unusedDebtBudget;
      }else{
        if(debtRepaymentSource==='savings')savings-=unusedDebtBudget;
        else{externalBox3DebtFallback+=unusedDebtBudget;externalCashFlows[i]+=unusedDebtBudget;}
        portfolio+=unusedDebtBudget;box3DebtFallbackInvested+=unusedDebtBudget;
      }
    }

    const nextMonth=month===12?1:month+1,nextYear=month===12?year+1:year,endOfCalendarYear=nextYear!==year,finalMonth=i===monthlyFlows.length-1;
    if(endOfCalendarYear||finalMonth){
      const regime=regimeForYear({mode:box3Mode,year,futureStart});
      const firstYear=year===Number(startYear),firstPartial=firstYear&&Number(startMonth)>1;
      const jan1Portfolio=firstPartial?nonNegative(firstJan1Portfolio):nonNegative(yearStartPortfolio);
      const jan1Savings=firstPartial&&firstJan1Savings!=null?nonNegative(firstJan1Savings):nonNegative(yearStartSavings);
      const jan1Debt=firstPartial&&firstJan1Debt!=null?nonNegative(firstJan1Debt):nonNegative(yearStartDebt);
      const common={regime,jan1Portfolio,jan1Savings,jan1Debt,marketGain,savingsIncome,debtInterest,lossCarry,taxPartners,currentTaxRate,currentAllowance,currentNotional,currentSavingsNotional,currentDebtNotional,currentDebtThreshold,futureTaxRate,futureExempt,futureLossThreshold};
      const canSettle=endOfCalendarYear&&!(firstPartial&&regime==='future');
      const taxResult=canSettle
        ?box3TaxForYear({...common,allowActualRebuttal:!(firstPartial&&regime==='current')})
        :provisionalBox3(common);
      const beforePortfolio=portfolio,beforeSavings=savings,beforeDebt=debt;
      let paid={portfolio,savings,fromPortfolio:0,fromSavings:0,external:0};
      if(canSettle){
        lossCarry=taxResult.lossCarry;totalTax+=taxResult.tax;if(regime==='current')currentTax+=taxResult.tax;if(regime==='future')futureTax+=taxResult.tax;
        paid=payTaxFromSource({tax:taxResult.tax,paySource,portfolio,savings});
        portfolio=paid.portfolio;savings=paid.savings;externalTax+=paid.external;externalCashFlows[i]+=paid.external;taxPaidFromSavings+=paid.fromSavings;taxPaidFromPortfolio+=paid.fromPortfolio;
      }else unsettledTaxEstimate+=taxResult.tax;
      yearBuckets[year]={year,regime,settled:canSettle,jan1Portfolio,jan1Savings,jan1Debt,marketGain,savingsIncome,debtInterest,endPortfolioBeforeTax:beforePortfolio,endSavingsBeforeTax:beforeSavings,endDebt:beforeDebt,
        endBeforeTax:beforePortfolio,box3Tax:canSettle?taxResult.tax:0,unsettledTax:canSettle?0:taxResult.tax,endAfterTax:portfolio,endPortfolio:portfolio,endSavings:savings,method:canSettle?taxResult.method:`unsettled estimate · ${taxResult.method}`,notionalTax:taxResult.notionalTax,actualTax:taxResult.actualTax,
        taxPaidFromSavings:paid.fromSavings,taxPaidFromPortfolio:paid.fromPortfolio,externalTax:paid.external};
      series.push({year,month,portfolio,savings,box3Debt:debt,netFinancialAssets:portfolio+savings-debt,box3Tax:totalTax,unsettledTaxEstimate});
      yearStartPortfolio=portfolio;yearStartSavings=savings;yearStartDebt=debt;marketGain=0;savingsIncome=0;debtInterest=0;
    }
    year=nextYear;month=nextMonth;
  }

  const netFinancialAssets=portfolio+savings-debt;
  const box3DebtCashConservationDifference=plannedBox3DebtRepayment-totalDebtRepaid-box3DebtFallbackInvested-box3DebtFallbackSaved-box3DebtFallbackConsumed-box3DebtRepaymentShortfall;
  const externalCashFlowFutureValue=terminalValueOfDatedCashFlows(externalCashFlows,annualReturnPct);
  const householdComparableWealth=netFinancialAssets-externalCashFlowFutureValue-unsettledTaxEstimate;
  return{portfolio,savings,box3Debt:debt,netFinancialAssets,totalTax,currentTax,futureTax,unsettledTaxEstimate,externalTax,taxPaidFromSavings,taxPaidFromPortfolio,
    comparableWealth:householdComparableWealth,householdComparableWealth,
    externalDebtRepayment,totalDebtRepaid,totalDebtInterest,cashShortfall,externalCashFlows,externalCashFlowFutureValue,lossCarry,yearBuckets,series,
    plannedBox3DebtRepayment,unusedBox3DebtRepayment,box3DebtFallbackInvested,box3DebtFallbackSaved,box3DebtFallbackConsumed,box3DebtRepaymentShortfall,externalBox3DebtFallback,box3DebtCashConservationDifference,box3DebtFallbackDestination};
}

function equalizeCashFlows(a=[],b=[]){
  const length=Math.max(a.length,b.length),flowA=[],flowB=[],budget=[];
  for(let i=0;i<length;i++){
    const av=nonNegative(a[i]),bv=nonNegative(b[i]),monthlyBudget=Math.max(av,bv);
    budget.push(monthlyBudget);flowA.push(Math.max(0,monthlyBudget-av));flowB.push(Math.max(0,monthlyBudget-bv));
  }
  return{a:flowA,b:flowB,budget};
}

function terminalValueOfDatedCashFlows(flows=[],annualReturnPct=0){
  const monthlyReturn=effectiveAnnualPctToMonthly(annualReturnPct);
  const values=Array.isArray(flows)?flows:[];
  return values.reduce((total,value,index)=>total+number(value)*Math.pow(1+monthlyReturn,Math.max(0,values.length-index-1)),0);
}

function simulatePlan(config={}){
  const phases=Array.isArray(config.phases)?config.phases:[];
  const startYear=Number(config.startYear)||2026,startMonth=clamp(Number(config.startMonth)||1,1,12),bonusMonth=clamp(Number(config.bonusMonth)||12,1,12);
  const annualReturnPct=Number(config.annualReturnPct)||0,monthlyReturn=effectiveAnnualPctToMonthly(annualReturnPct);
  const mortRatePct=clamp(Number(config.mortRatePct)||0,0,100),monthlyMortRate=nominalAnnualPctToMonthly(mortRatePct);
  const mortTermMonths=Math.max(1,Math.round(clamp(Number(config.mortYears)||1,1,100)*12));
  const initialMort=nonNegative(config.mortBalance),mortType=config.mortType==='linear'?'linear':'annuity',linearPrincipal=initialMort/mortTermMonths;
  const annuityPayment=monthlyMortRate===0?initialMort/mortTermMonths:initialMort*monthlyMortRate/(1-Math.pow(1+monthlyMortRate,-mortTermMonths));
  const totalMonths=phases.reduce((sum,p)=>sum+Math.max(0,Math.round((Number(p.years)||0)*12)),0);
  const monthlySavingsRate=effectiveAnnualPctToMonthly(config.savingsReturnPct),monthlyDebtRate=nominalAnnualPctToMonthly(config.debtInterestPct);
  const hraRemainingMonths=config.hraRemainingMonths==null?Math.min(mortTermMonths,POLICY.ownHome.maximumQualifyingMortgageMonths):Math.max(0,Math.round(Number(config.hraRemainingMonths)||0));
  const qualifyingInterestFraction=clamp(Number(config.qualifyingInterestFraction??1)||0,0,1);
  const homeOwnershipMonths=config.homeOwnershipMonths==null?totalMonths:Math.max(0,Math.round(Number(config.homeOwnershipMonths)||0));
  const unusedMortgageDestination=['invest','savings','consume'].includes(config.unusedMortgageDestination)?config.unusedMortgageDestination:'invest';
  const box3DebtFallbackDestination=['invest','savings','consume'].includes(config.box3DebtFallbackDestination)?config.box3DebtFallbackDestination:'invest';

  let portfolio=nonNegative(config.startPortfolio),savings=nonNegative(config.box3Savings),box3Debt=nonNegative(config.box3Debt),invested=portfolio,mort=initialMort;
  let grossInterest=0,extraPaid=0,plannedMortgageExtra=0,unusedMortgageCash=0,fallbackInvested=0,fallbackSaved=0,fallbackConsumed=0,scheduledPrincipal=0,box3Tax=0,currentTax=0,futureTax=0,unsettledTaxEstimate=0,lossCarry=0,externalTax=0,taxPaidFromSavings=0,taxPaidFromPortfolio=0;
  let totalDebtInterest=0,totalDebtRepaid=0,externalDebtRepayment=0,payoffDate=null;
  let plannedBox3DebtRepayment=0,unusedBox3DebtRepayment=0,box3DebtFallbackInvested=0,box3DebtFallbackSaved=0,box3DebtFallbackConsumed=0,box3DebtRepaymentShortfall=0,externalBox3DebtFallback=0;
  const rawSchedule=[],series=[],yearBuckets={},externalCashFlows=Array.from({length:totalMonths},()=>0);
  let year=startYear,month=startMonth,global=0;

  function bucket(y){
    if(!yearBuckets[y])yearBuckets[y]={year:y,startPortfolio:null,startSavings:null,startDebt:null,endBeforeTax:0,endAfterTax:0,marketGain:0,savingsIncome:0,debtInterest:0,
      jan1Savings:0,jan1Debt:0,contrib:0,mortInterest:0,mortMonths:0,mortTax:0,box3Tax:0,unsettledTax:0,settled:true,regime:'none',method:'none'};
    return yearBuckets[y];
  }

  for(const phase of phases){
    const phaseMonths=Math.max(0,Math.round((Number(phase.years)||0)*12));
    for(let pm=0;pm<phaseMonths;pm++){
      const monthIndex=global;global++;const b=bucket(year);
      if(b.startPortfolio===null){b.startPortfolio=portfolio;b.startSavings=savings;b.startDebt=box3Debt;}
      const growth=portfolio*monthlyReturn;portfolio+=growth;b.marketGain+=growth;
      const saveInterest=savings*monthlySavingsRate;savings+=saveInterest;b.savingsIncome+=saveInterest;
      const debtInterest=box3Debt*monthlyDebtRate;b.debtInterest+=debtInterest;totalDebtInterest+=debtInterest;externalCashFlows[monthIndex]+=debtInterest;

      const debtRepayRequested=nonNegative(config.box3DebtMonthlyRepayment);
      plannedBox3DebtRepayment+=debtRepayRequested;
      const availableDebtBudget=config.debtRepaymentSource==='savings'?Math.min(debtRepayRequested,savings):debtRepayRequested;
      const debtRepaidThisMonth=Math.min(box3Debt,availableDebtBudget);
      if(debtRepaidThisMonth>0){
        if(config.debtRepaymentSource==='savings')savings-=debtRepaidThisMonth;
        else{externalDebtRepayment+=debtRepaidThisMonth;externalCashFlows[monthIndex]+=debtRepaidThisMonth;}
        box3Debt-=debtRepaidThisMonth;totalDebtRepaid+=debtRepaidThisMonth;
      }
      const debtBudgetShortfall=Math.max(0,debtRepayRequested-availableDebtBudget);
      const unusedDebtBudget=Math.max(0,availableDebtBudget-debtRepaidThisMonth);
      box3DebtRepaymentShortfall+=debtBudgetShortfall;
      unusedBox3DebtRepayment+=unusedDebtBudget;
      if(unusedDebtBudget>0){
        if(box3DebtFallbackDestination==='savings'){
          if(config.debtRepaymentSource!=='savings'){savings+=unusedDebtBudget;externalBox3DebtFallback+=unusedDebtBudget;externalCashFlows[monthIndex]+=unusedDebtBudget;}
          box3DebtFallbackSaved+=unusedDebtBudget;
        }else if(box3DebtFallbackDestination==='consume'){
          if(config.debtRepaymentSource==='savings')savings-=unusedDebtBudget;
          box3DebtFallbackConsumed+=unusedDebtBudget;
        }else{
          if(config.debtRepaymentSource==='savings')savings-=unusedDebtBudget;
          else{externalBox3DebtFallback+=unusedDebtBudget;externalCashFlows[monthIndex]+=unusedDebtBudget;}
          portfolio+=unusedDebtBudget;invested+=unusedDebtBudget;b.contrib+=unusedDebtBudget;box3DebtFallbackInvested+=unusedDebtBudget;
        }
      }

      let investContrib=nonNegative(phase.monthlyInvest),bonusInvest=0,bonusMort=0;
      if(month===bonusMonth&&nonNegative(phase.annualBonus)>0){
        if(phase.bonusDest==='mortgage')bonusMort=nonNegative(phase.annualBonus);
        else if(phase.bonusDest==='split'){bonusInvest=nonNegative(phase.annualBonus)/2;bonusMort=nonNegative(phase.annualBonus)/2;}
        else bonusInvest=nonNegative(phase.annualBonus);
      }
      investContrib+=bonusInvest;portfolio+=investContrib;invested+=investContrib;b.contrib+=investContrib;

      const homeOwned=monthIndex<homeOwnershipMonths;
      const balanceAtStart=mort;
      let interest=0,principal=0,extra=0,grossScheduled=0;
      if(mort>0){
        interest=mort*monthlyMortRate;grossInterest+=interest;
        principal=mortType==='linear'?Math.min(mort,linearPrincipal):Math.min(mort,Math.max(0,annuityPayment-interest));
        grossScheduled=interest+principal;mort-=principal;scheduledPrincipal+=principal;
      }
      let requestedExtra=0;
      if(phase.mortgageFreq==='yearly'){if(month===bonusMonth)requestedExtra+=nonNegative(phase.mortgageExtra);}
      else requestedExtra+=nonNegative(phase.mortgageExtra);
      requestedExtra+=bonusMort;
      plannedMortgageExtra+=requestedExtra;
      if(mort>0){extra=Math.min(mort,requestedExtra);mort-=extra;extraPaid+=extra;}
      const unusedExtra=Math.max(0,requestedExtra-extra);unusedMortgageCash+=unusedExtra;
      if(unusedExtra>0){
        if(unusedMortgageDestination==='savings'){savings+=unusedExtra;fallbackSaved+=unusedExtra;}
        else if(unusedMortgageDestination==='consume')fallbackConsumed+=unusedExtra;
        else{portfolio+=unusedExtra;invested+=unusedExtra;b.contrib+=unusedExtra;fallbackInvested+=unusedExtra;}
      }
      if(balanceAtStart>0&&mort<=.005){mort=0;if(!payoffDate)payoffDate={year,month};}
      const hraEligible=config.mortTaxEnabled!==false&&homeOwned&&monthIndex<hraRemainingMonths&&balanceAtStart>0&&qualifyingInterestFraction>0;
      const deductibleInterest=hraEligible?interest*qualifyingInterestFraction:0;
      rawSchedule.push({year,month,balance:mort,gross:grossScheduled,principal,interest,deductibleInterest,taxReturn:0,net:grossScheduled,extra,requestedExtra,unusedExtra,cash:grossScheduled+extra,cashWithRequestedExtra:grossScheduled+requestedExtra,homeOwned,hraEligible});
      b.endBeforeTax=portfolio;

      const nextMonth=month===12?1:month+1,nextYear=month===12?year+1:year,endOfCalendarYear=nextYear!==year,finalMonth=global===totalMonths;
      if(endOfCalendarYear||finalMonth){
        const regime=regimeForYear({mode:config.box3Mode,year,futureStart:config.futureStart});b.regime=regime;
        const firstYear=year===startYear,firstPartial=firstYear&&startMonth>1;
        const jan1Portfolio=firstPartial?nonNegative(config.firstJan1Portfolio):Math.max(0,b.startPortfolio||0);
        const jan1Savings=firstPartial&&config.firstJan1Savings!=null?nonNegative(config.firstJan1Savings):Math.max(0,b.startSavings||0);
        const jan1Debt=firstPartial&&config.firstJan1Debt!=null?nonNegative(config.firstJan1Debt):Math.max(0,b.startDebt||0);
        const common={regime,jan1Portfolio,jan1Savings,jan1Debt,marketGain:b.marketGain,savingsIncome:b.savingsIncome,debtInterest:b.debtInterest,lossCarry,
          taxPartners:config.taxPartners,currentTaxRate:config.currentTaxRate,currentAllowance:config.currentAllowance,currentNotional:config.currentNotional,currentSavingsNotional:config.currentSavingsNotional,
          currentDebtNotional:config.currentDebtNotional,currentDebtThreshold:config.currentDebtThreshold,futureTaxRate:config.futureTaxRate,futureExempt:config.futureExempt,futureLossThreshold:config.futureLossThreshold};
        const canSettle=endOfCalendarYear&&!(firstPartial&&regime==='future');
        const taxResult=canSettle
          ?box3TaxForYear({...common,allowActualRebuttal:!(firstPartial&&regime==='current')})
          :provisionalBox3(common);
        b.method=canSettle?taxResult.method:`unsettled estimate · ${taxResult.method}`;b.settled=canSettle;b.notionalTax=taxResult.notionalTax;b.actualTax=taxResult.actualTax;
        b.jan1Portfolio=jan1Portfolio;b.jan1Savings=jan1Savings;b.jan1Debt=jan1Debt;
        if(canSettle){
          lossCarry=taxResult.lossCarry;b.box3Tax=taxResult.tax;box3Tax+=taxResult.tax;
          if(regime==='current')currentTax+=taxResult.tax;if(regime==='future')futureTax+=taxResult.tax;
          const paid=payTaxFromSource({tax:taxResult.tax,paySource:config.box3PaySource,portfolio,savings});
          portfolio=paid.portfolio;savings=paid.savings;externalTax+=paid.external;externalCashFlows[monthIndex]+=paid.external;taxPaidFromSavings+=paid.fromSavings;taxPaidFromPortfolio+=paid.fromPortfolio;
          b.taxPaidFromSavings=paid.fromSavings;b.taxPaidFromPortfolio=paid.fromPortfolio;b.externalTax=paid.external;
        }else{b.box3Tax=0;b.unsettledTax=taxResult.tax;unsettledTaxEstimate+=taxResult.tax;}
        b.endAfterTax=portfolio;b.endSavings=savings;b.endDebt=box3Debt;
        series.push({year,month,portfolio,savings,box3Debt,netFinancialAssets:portfolio+savings-box3Debt,mort,invested,box3Tax,unsettledTaxEstimate});
      }
      year=nextYear;month=nextMonth;
    }
  }

  const allocation=allocateAnnualMortgageTax(rawSchedule,{enabled:config.mortTaxEnabled!==false,deductionRate:config.deductRate,wozValue:config.wozValue,hillenRelief:config.hillenRelief});
  const schedule=allocation.rows,mortTax=allocation.totalTaxBenefit;
  Object.values(yearBuckets).forEach(b=>{const taxBucket=allocation.annualBuckets[b.year];b.mortInterest=taxBucket?.grossInterest??b.mortInterest;b.deductibleInterest=taxBucket?.deductibleInterest??0;b.mortMonths=taxBucket?.ownershipMonths??0;b.mortTax=taxBucket?.taxBenefit??0;b.hillenRelief=taxBucket?.hillenRelief??0;});
  const netFinancialAssets=portfolio+savings-box3Debt;
  const externalCashFlowFutureValue=terminalValueOfDatedCashFlows(externalCashFlows,annualReturnPct);
  const cashConservationDifference=plannedMortgageExtra-extraPaid-fallbackInvested-fallbackSaved-fallbackConsumed;
  const box3DebtCashConservationDifference=plannedBox3DebtRepayment-totalDebtRepaid-box3DebtFallbackInvested-box3DebtFallbackSaved-box3DebtFallbackConsumed-box3DebtRepaymentShortfall;
  return{portfolio,savings,box3Debt,netFinancialAssets,householdComparableWealth:netFinancialAssets-externalCashFlowFutureValue-unsettledTaxEstimate,invested,mort,initialMort,grossInterest,mortTax,netInterest:grossInterest-mortTax,extraPaid,plannedMortgageExtra,unusedMortgageCash,fallbackInvested,fallbackSaved,fallbackConsumed,cashConservationDifference,unusedMortgageDestination,scheduledPrincipal,
    grossScheduledTotal:grossInterest+scheduledPrincipal,firstScheduled:schedule.length?schedule[0].gross:0,box3Tax,currentTax,futureTax,unsettledTaxEstimate,externalTax,taxPaidFromSavings,taxPaidFromPortfolio,
    totalDebtInterest,totalDebtRepaid,externalDebtRepayment,externalCashFlows,externalCashFlowFutureValue,lossCarry,payoffDate,schedule,series,yearBuckets,horizonMonths:global,mortType,hraRemainingMonths,qualifyingInterestFraction,homeOwnershipMonths,
    plannedBox3DebtRepayment,unusedBox3DebtRepayment,box3DebtFallbackInvested,box3DebtFallbackSaved,box3DebtFallbackConsumed,box3DebtRepaymentShortfall,externalBox3DebtFallback,box3DebtCashConservationDifference,box3DebtFallbackDestination};
}

return{clamp,effectiveAnnualPctToMonthly,nominalAnnualPctToMonthly,deductionRate2026,ewf2026,hillenReliefForYear,mortgageTaxBenefit,allocateAnnualMortgageTax,regimeForYear,box3TaxForYear,payTaxFromSource,terminalValueOfDatedCashFlows,mortgageSchedule,simulateInvestmentFlows,equalizeCashFlows,simulatePlan};
});
