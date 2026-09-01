(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.FinanceCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';

const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const nonNegative=v=>Math.max(0,Number(v)||0);
const number=v=>Number.isFinite(Number(v))?Number(v):0;

function deductionRate2026({mode='auto',manualRatePct=37.56,grossIncome=0}={}){
  if(mode==='manual')return clamp(Number(manualRatePct)||0,0,60)/100;
  return (Number(grossIncome)||0)<=38883?0.3575:0.3756;
}

function ewf2026(woz){
  const value=nonNegative(woz);
  if(value<=12500)return 0;
  if(value<=25000)return value*.001;
  if(value<=50000)return value*.002;
  if(value<=75000)return value*.0025;
  if(value<=1350000)return value*.0035;
  return 4725+(value-1350000)*.0235;
}

function mortgageTaxBenefit({interest=0,months=1,deductionRate=0,wozValue=0,enabled=true,hillenRelief=0.71867}={}){
  if(!enabled||months<=0)return 0;
  const grossInterest=nonNegative(interest);
  const rate=clamp(Number(deductionRate)||0,0,1);
  const ewf=ewf2026(wozValue)*months/12;
  if(grossInterest>=ewf)return (grossInterest-ewf)*rate;
  return -(ewf-grossInterest)*(1-clamp(Number(hillenRelief)||0,0,1))*rate;
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
    if(row.taxEligible===false)return;
    const year=Number(row.year);
    if(!Number.isFinite(year))return;
    if(!annualBuckets[year])annualBuckets[year]={year,indexes:[],interest:0,months:0,taxBenefit:0};
    const bucket=annualBuckets[year];
    bucket.indexes.push(index);
    bucket.interest+=nonNegative(row.interest);
    bucket.months++;
  });

  let totalTaxBenefit=0;
  Object.values(annualBuckets).forEach(bucket=>{
    const annualBenefit=mortgageTaxBenefit({
      interest:bucket.interest,
      months:bucket.months,
      deductionRate:tax.deductionRate,
      wozValue:tax.wozValue,
      enabled:tax.enabled!==false,
      hillenRelief:tax.hillenRelief
    });
    bucket.taxBenefit=annualBenefit;
    totalTaxBenefit+=annualBenefit;

    const count=bucket.indexes.length;
    if(!count)return;
    let allocated=0;
    bucket.indexes.forEach((rowIndex,pos)=>{
      const row=resultRows[rowIndex];
      let share;
      if(pos===count-1)share=annualBenefit-allocated;
      else if(bucket.interest>0)share=annualBenefit*(nonNegative(row.interest)/bucket.interest);
      else share=annualBenefit/count;
      allocated+=share;
      row.taxReturn=share;
      row.net=(Number(row.gross)||0)-share;
      row.cash=row.net+nonNegative(row.extra);
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
  regime='none',jan1Portfolio=0,jan1Savings=0,jan1Debt=0,marketGain=0,savingsIncome=0,debtInterest=0,lossCarry=0,
  taxPartners=1,currentTaxRate=.36,currentAllowance=59357,currentNotional=.06,currentSavingsNotional=.0128,currentDebtNotional=.027,currentDebtThreshold=3800,
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
    tax=Math.min(notionalTax,actualTax);
    method=actualTax<=notionalTax?'actual-return rebuttal':'deemed return';
    return{tax,lossCarry:nextLossCarry,method,notionalTax,actualTax,deemedIncome,deemedReturn,actualReturn,deductibleDebt,rendementsgrondslag,taxableBase,share,
      components:{savingsDeemed,investmentDeemed,debtDeemed,savingsIncome:Number(savingsIncome)||0,marketGain:Number(marketGain)||0,debtInterest:nonNegative(debtInterest)}};
  }

  if(regime==='future'){
    const result=actualReturn;
    if(result<0){nextLossCarry+=Math.max(0,-result-nonNegative(futureLossThreshold));method='proposed actual return · loss';}
    else{
      const usedLoss=Math.min(nextLossCarry,result),afterLoss=Math.max(0,result-usedLoss);
      nextLossCarry-=usedLoss;
      tax=Math.max(0,afterLoss-nonNegative(futureExempt)*partners)*clamp(Number(futureTaxRate)||0,0,1);
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
  const annualRate=clamp(Number(annualRatePct)||0,0,100)/100,monthlyRate=annualRate/12;
  const termMonths=Math.max(1,Math.round(clamp(Number(termYears)||1,1,100)*12));
  const horizonMonths=Math.max(0,Math.round(months==null?termMonths:months));
  const mortgageType=type==='linear'?'linear':'annuity';
  const linearPrincipal=initialBalance/termMonths;
  const annuityPayment=monthlyRate===0?initialBalance/termMonths:initialBalance*monthlyRate/(1-Math.pow(1+monthlyRate,-termMonths));
  const taxEnabled=tax.enabled!==false,deductionRate=clamp(Number(tax.deductionRate)||0,0,1),wozValue=nonNegative(tax.wozValue);
  let outstanding=initialBalance,totalInterest=0,totalScheduledPrincipal=0,totalExtra=0,payoffMonthIndex=null;
  const rawRows=[];
  let year=Number(startYear)||2026,month=clamp(Number(startMonth)||1,1,12);

  for(let i=0;i<horizonMonths;i++){
    const taxEligible=outstanding>0;
    let interest=0,principal=0,gross=0,extra=0;
    if(outstanding>0){
      interest=outstanding*monthlyRate;
      principal=mortgageType==='linear'?Math.min(outstanding,linearPrincipal):Math.min(outstanding,Math.max(0,annuityPayment-interest));
      gross=interest+principal;outstanding-=principal;
      const extraRequested=Array.isArray(extraMonthly)?nonNegative(extraMonthly[i]):typeof extraMonthly==='function'?nonNegative(extraMonthly(i,{year,month,balance:outstanding})):nonNegative(extraMonthly);
      extra=Math.min(outstanding,extraRequested);outstanding-=extra;
      if(outstanding<=.005){outstanding=0;if(payoffMonthIndex===null)payoffMonthIndex=i;}
    }
    totalInterest+=interest;totalScheduledPrincipal+=principal;totalExtra+=extra;
    rawRows.push({monthIndex:i,year,month,balance:outstanding,gross,principal,interest,taxReturn:0,net:gross,extra,cash:gross+extra,taxEligible});
    month++;if(month===13){month=1;year++;}
  }
  const allocation=allocateAnnualMortgageTax(rawRows,{enabled:taxEnabled,deductionRate,wozValue,hillenRelief:tax.hillenRelief});
  return{rows:allocation.rows,annualTaxBuckets:allocation.annualBuckets,initialBalance,balance:outstanding,totalInterest,totalTaxBenefit:allocation.totalTaxBenefit,
    totalScheduledPrincipal,totalExtra,totalScheduledPaid:totalInterest+totalScheduledPrincipal,firstScheduled:allocation.rows.length?allocation.rows[0].gross:0,payoffMonthIndex,type:mortgageType};
}

function simulateInvestmentFlows({
  initialPortfolio=0,flows=[],annualReturnPct=0,startYear=2026,startMonth=1,box3Mode='none',taxPartners=1,paySource='portfolio',
  currentTaxRate=.36,currentAllowance=59357,currentNotional=.06,currentSavingsNotional=.0128,currentDebtNotional=.027,currentDebtThreshold=3800,
  firstJan1Portfolio=0,box3Savings=0,box3Debt=0,firstJan1Savings=null,firstJan1Debt=null,savingsReturnPct=0,debtInterestPct=0,
  savingsFlows=[],box3DebtMonthlyRepayment=0,debtRepayments=[],debtRepaymentSource='external',futureStart=2028,futureTaxRate=.36,futureExempt=1800,futureLossThreshold=500
}={}){
  const monthlyReturn=(Number(annualReturnPct)||0)/100/12,monthlySavingsRate=(Number(savingsReturnPct)||0)/100/12,monthlyDebtRate=(Number(debtInterestPct)||0)/100/12;
  let portfolio=nonNegative(initialPortfolio),savings=nonNegative(box3Savings),debt=nonNegative(box3Debt);
  let totalTax=0,currentTax=0,futureTax=0,externalTax=0,taxPaidFromSavings=0,taxPaidFromPortfolio=0,lossCarry=0;
  let externalDebtRepayment=0,totalDebtRepaid=0,totalDebtInterest=0,cashShortfall=0;
  let year=Number(startYear)||2026,month=clamp(Number(startMonth)||1,1,12);
  let yearStartPortfolio=portfolio,yearStartSavings=savings,yearStartDebt=debt;
  let marketGain=0,savingsIncome=0,debtInterest=0;
  const yearBuckets={},series=[],monthlyFlows=Array.isArray(flows)?flows:[],monthlySavingsFlows=Array.isArray(savingsFlows)?savingsFlows:[],monthlyDebtRepayments=Array.isArray(debtRepayments)?debtRepayments:[];

  for(let i=0;i<monthlyFlows.length;i++){
    const growth=portfolio*monthlyReturn;portfolio+=growth;marketGain+=growth;portfolio+=nonNegative(monthlyFlows[i]);
    const saveInterest=savings*monthlySavingsRate;savings+=saveInterest;savingsIncome+=saveInterest;
    const interestOnDebt=debt*monthlyDebtRate;debtInterest+=interestOnDebt;totalDebtInterest+=interestOnDebt;

    const savingFlow=number(monthlySavingsFlows[i]);
    if(savingFlow>=0)savings+=savingFlow;
    else{const requested=-savingFlow,used=Math.min(savings,requested);savings-=used;cashShortfall+=requested-used;}

    const requestedDebtRepay=monthlyDebtRepayments.length?nonNegative(monthlyDebtRepayments[i]):nonNegative(box3DebtMonthlyRepayment);
    if(requestedDebtRepay>0&&debt>0){
      let repay=Math.min(debt,requestedDebtRepay);
      if(debtRepaymentSource==='savings'){repay=Math.min(repay,savings);savings-=repay;}
      else externalDebtRepayment+=repay;
      debt-=repay;totalDebtRepaid+=repay;
    }

    const nextMonth=month===12?1:month+1,nextYear=month===12?year+1:year,yearEnd=nextYear!==year||i===monthlyFlows.length-1;
    if(yearEnd){
      const regime=regimeForYear({mode:box3Mode,year,futureStart});
      const firstYear=year===Number(startYear),midYear=Number(startMonth)>1;
      const jan1Portfolio=firstYear&&midYear?nonNegative(firstJan1Portfolio):nonNegative(yearStartPortfolio);
      const jan1Savings=firstYear&&midYear&&firstJan1Savings!=null?nonNegative(firstJan1Savings):nonNegative(yearStartSavings);
      const jan1Debt=firstYear&&midYear&&firstJan1Debt!=null?nonNegative(firstJan1Debt):nonNegative(yearStartDebt);
      const taxResult=box3TaxForYear({regime,jan1Portfolio,jan1Savings,jan1Debt,marketGain,savingsIncome,debtInterest,lossCarry,taxPartners,currentTaxRate,currentAllowance,currentNotional,currentSavingsNotional,currentDebtNotional,currentDebtThreshold,futureTaxRate,futureExempt,futureLossThreshold});
      lossCarry=taxResult.lossCarry;totalTax+=taxResult.tax;if(regime==='current')currentTax+=taxResult.tax;if(regime==='future')futureTax+=taxResult.tax;
      const beforePortfolio=portfolio,beforeSavings=savings,beforeDebt=debt;
      const paid=payTaxFromSource({tax:taxResult.tax,paySource,portfolio,savings});
      portfolio=paid.portfolio;savings=paid.savings;externalTax+=paid.external;taxPaidFromSavings+=paid.fromSavings;taxPaidFromPortfolio+=paid.fromPortfolio;
      yearBuckets[year]={year,regime,jan1Portfolio,jan1Savings,jan1Debt,marketGain,savingsIncome,debtInterest,endPortfolioBeforeTax:beforePortfolio,endSavingsBeforeTax:beforeSavings,endDebt:beforeDebt,
        endBeforeTax:beforePortfolio,box3Tax:taxResult.tax,endAfterTax:portfolio,endPortfolio:portfolio,endSavings:savings,method:taxResult.method,notionalTax:taxResult.notionalTax,actualTax:taxResult.actualTax,
        taxPaidFromSavings:paid.fromSavings,taxPaidFromPortfolio:paid.fromPortfolio,externalTax:paid.external};
      series.push({year,month,portfolio,savings,box3Debt:debt,netFinancialAssets:portfolio+savings-debt,box3Tax:totalTax});
      yearStartPortfolio=portfolio;yearStartSavings=savings;yearStartDebt=debt;marketGain=0;savingsIncome=0;debtInterest=0;
    }
    year=nextYear;month=nextMonth;
  }

  const netFinancialAssets=portfolio+savings-debt;
  return{portfolio,savings,box3Debt:debt,netFinancialAssets,totalTax,currentTax,futureTax,externalTax,taxPaidFromSavings,taxPaidFromPortfolio,
    comparableWealth:portfolio-externalTax-taxPaidFromSavings,householdComparableWealth:netFinancialAssets-externalTax-externalDebtRepayment-totalDebtInterest,
    externalDebtRepayment,totalDebtRepaid,totalDebtInterest,cashShortfall,lossCarry,yearBuckets,series};
}

function equalizeCashFlows(a=[],b=[]){
  const length=Math.max(a.length,b.length),flowA=[],flowB=[],budget=[];
  for(let i=0;i<length;i++){
    const av=nonNegative(a[i]),bv=nonNegative(b[i]),monthlyBudget=Math.max(av,bv);
    budget.push(monthlyBudget);flowA.push(Math.max(0,monthlyBudget-av));flowB.push(Math.max(0,monthlyBudget-bv));
  }
  return{a:flowA,b:flowB,budget};
}

function simulatePlan(config={}){
  const phases=Array.isArray(config.phases)?config.phases:[];
  const startYear=Number(config.startYear)||2026,startMonth=clamp(Number(config.startMonth)||1,1,12),bonusMonth=clamp(Number(config.bonusMonth)||12,1,12);
  const annualReturnPct=Number(config.annualReturnPct)||0,monthlyReturn=annualReturnPct/100/12;
  const mortRatePct=clamp(Number(config.mortRatePct)||0,0,100),monthlyMortRate=mortRatePct/100/12;
  const mortTermMonths=Math.max(1,Math.round(clamp(Number(config.mortYears)||1,1,100)*12));
  const initialMort=nonNegative(config.mortBalance),mortType=config.mortType==='linear'?'linear':'annuity',linearPrincipal=initialMort/mortTermMonths;
  const annuityPayment=monthlyMortRate===0?initialMort/mortTermMonths:initialMort*monthlyMortRate/(1-Math.pow(1+monthlyMortRate,-mortTermMonths));
  const totalMonths=phases.reduce((sum,p)=>sum+Math.max(0,Math.round((Number(p.years)||0)*12)),0);
  const monthlySavingsRate=(Number(config.savingsReturnPct)||0)/100/12,monthlyDebtRate=(Number(config.debtInterestPct)||0)/100/12;

  let portfolio=nonNegative(config.startPortfolio),savings=nonNegative(config.box3Savings),box3Debt=nonNegative(config.box3Debt),invested=portfolio,mort=initialMort;
  let grossInterest=0,extraPaid=0,scheduledPrincipal=0,box3Tax=0,currentTax=0,futureTax=0,lossCarry=0,externalTax=0,taxPaidFromSavings=0,taxPaidFromPortfolio=0;
  let totalDebtInterest=0,totalDebtRepaid=0,externalDebtRepayment=0,payoffDate=null;
  const rawSchedule=[],series=[],yearBuckets={};
  let year=startYear,month=startMonth,global=0;

  function bucket(y){
    if(!yearBuckets[y])yearBuckets[y]={year:y,startPortfolio:null,startSavings:null,startDebt:null,endBeforeTax:0,endAfterTax:0,marketGain:0,savingsIncome:0,debtInterest:0,
      jan1Savings:0,jan1Debt:0,contrib:0,mortInterest:0,mortMonths:0,mortTax:0,box3Tax:0,regime:'none',method:'none'};
    return yearBuckets[y];
  }

  for(const phase of phases){
    const phaseMonths=Math.max(0,Math.round((Number(phase.years)||0)*12));
    for(let pm=0;pm<phaseMonths;pm++){
      global++;const b=bucket(year);
      if(b.startPortfolio===null){b.startPortfolio=portfolio;b.startSavings=savings;b.startDebt=box3Debt;}
      const growth=portfolio*monthlyReturn;portfolio+=growth;b.marketGain+=growth;
      const saveInterest=savings*monthlySavingsRate;savings+=saveInterest;b.savingsIncome+=saveInterest;
      const debtInterest=box3Debt*monthlyDebtRate;b.debtInterest+=debtInterest;totalDebtInterest+=debtInterest;

      const debtRepayRequested=nonNegative(config.box3DebtMonthlyRepayment);
      if(debtRepayRequested>0&&box3Debt>0){
        let repay=Math.min(box3Debt,debtRepayRequested);
        if(config.debtRepaymentSource==='savings'){repay=Math.min(repay,savings);savings-=repay;}
        else externalDebtRepayment+=repay;
        box3Debt-=repay;totalDebtRepaid+=repay;
      }

      let investContrib=nonNegative(phase.monthlyInvest),bonusInvest=0,bonusMort=0;
      if(month===bonusMonth&&nonNegative(phase.annualBonus)>0){
        if(phase.bonusDest==='mortgage')bonusMort=nonNegative(phase.annualBonus);
        else if(phase.bonusDest==='split'){bonusInvest=nonNegative(phase.annualBonus)/2;bonusMort=nonNegative(phase.annualBonus)/2;}
        else bonusInvest=nonNegative(phase.annualBonus);
      }
      investContrib+=bonusInvest;portfolio+=investContrib;invested+=investContrib;b.contrib+=investContrib;

      const taxEligible=mort>0;let interest=0,principal=0,extra=0,grossScheduled=0;
      if(mort>0){
        interest=mort*monthlyMortRate;grossInterest+=interest;b.mortInterest+=interest;b.mortMonths++;
        principal=mortType==='linear'?Math.min(mort,linearPrincipal):Math.min(mort,Math.max(0,annuityPayment-interest));
        grossScheduled=interest+principal;mort-=principal;scheduledPrincipal+=principal;
        if(phase.mortgageFreq==='monthly')extra+=nonNegative(phase.mortgageExtra);else if(month===bonusMonth)extra+=nonNegative(phase.mortgageExtra);
        extra+=bonusMort;extra=Math.min(mort,Math.max(0,extra));mort-=extra;extraPaid+=extra;
        if(mort<=.005){mort=0;if(!payoffDate)payoffDate={year,month};}
      }
      rawSchedule.push({year,month,balance:mort,gross:grossScheduled,principal,interest,taxReturn:0,net:grossScheduled,extra,cash:grossScheduled+extra,taxEligible});
      b.endBeforeTax=portfolio;

      const nextMonth=month===12?1:month+1,nextYear=month===12?year+1:year,endOfCalendarYear=nextYear!==year,finalMonth=global===totalMonths;
      if(endOfCalendarYear||finalMonth){
        const regime=regimeForYear({mode:config.box3Mode,year,futureStart:config.futureStart});b.regime=regime;
        const firstYear=year===startYear,midYear=startMonth>1;
        const jan1Portfolio=firstYear&&midYear?nonNegative(config.firstJan1Portfolio):Math.max(0,b.startPortfolio||0);
        const jan1Savings=firstYear&&midYear&&config.firstJan1Savings!=null?nonNegative(config.firstJan1Savings):Math.max(0,b.startSavings||0);
        const jan1Debt=firstYear&&midYear&&config.firstJan1Debt!=null?nonNegative(config.firstJan1Debt):Math.max(0,b.startDebt||0);
        const taxResult=box3TaxForYear({regime,jan1Portfolio,jan1Savings,jan1Debt,marketGain:b.marketGain,savingsIncome:b.savingsIncome,debtInterest:b.debtInterest,lossCarry,
          taxPartners:config.taxPartners,currentTaxRate:config.currentTaxRate,currentAllowance:config.currentAllowance,currentNotional:config.currentNotional,currentSavingsNotional:config.currentSavingsNotional,
          currentDebtNotional:config.currentDebtNotional,currentDebtThreshold:config.currentDebtThreshold,futureTaxRate:config.futureTaxRate,futureExempt:config.futureExempt,futureLossThreshold:config.futureLossThreshold});
        lossCarry=taxResult.lossCarry;b.method=taxResult.method;b.box3Tax=taxResult.tax;b.notionalTax=taxResult.notionalTax;b.actualTax=taxResult.actualTax;
        b.jan1Portfolio=jan1Portfolio;b.jan1Savings=jan1Savings;b.jan1Debt=jan1Debt;box3Tax+=taxResult.tax;
        if(regime==='current')currentTax+=taxResult.tax;if(regime==='future')futureTax+=taxResult.tax;
        const paid=payTaxFromSource({tax:taxResult.tax,paySource:config.box3PaySource,portfolio,savings});
        portfolio=paid.portfolio;savings=paid.savings;externalTax+=paid.external;taxPaidFromSavings+=paid.fromSavings;taxPaidFromPortfolio+=paid.fromPortfolio;
        b.taxPaidFromSavings=paid.fromSavings;b.taxPaidFromPortfolio=paid.fromPortfolio;b.externalTax=paid.external;b.endAfterTax=portfolio;b.endSavings=savings;b.endDebt=box3Debt;
        series.push({year,month,portfolio,savings,box3Debt,netFinancialAssets:portfolio+savings-box3Debt,mort,invested,box3Tax});
      }
      year=nextYear;month=nextMonth;
    }
  }

  const allocation=allocateAnnualMortgageTax(rawSchedule,{enabled:config.mortTaxEnabled!==false,deductionRate:config.deductRate,wozValue:config.wozValue,hillenRelief:config.hillenRelief});
  const schedule=allocation.rows,mortTax=allocation.totalTaxBenefit;
  Object.values(yearBuckets).forEach(b=>{const taxBucket=allocation.annualBuckets[b.year];b.mortInterest=taxBucket?.interest??b.mortInterest;b.mortMonths=taxBucket?.months??0;b.mortTax=taxBucket?.taxBenefit??0;});
  const netFinancialAssets=portfolio+savings-box3Debt;
  return{portfolio,savings,box3Debt,netFinancialAssets,invested,mort,initialMort,grossInterest,mortTax,netInterest:grossInterest-mortTax,extraPaid,scheduledPrincipal,
    grossScheduledTotal:grossInterest+scheduledPrincipal,firstScheduled:schedule.length?schedule[0].gross:0,box3Tax,currentTax,futureTax,externalTax,taxPaidFromSavings,taxPaidFromPortfolio,
    totalDebtInterest,totalDebtRepaid,externalDebtRepayment,lossCarry,payoffDate,schedule,series,yearBuckets,horizonMonths:global,mortType};
}

return{clamp,deductionRate2026,ewf2026,mortgageTaxBenefit,allocateAnnualMortgageTax,regimeForYear,box3TaxForYear,payTaxFromSource,mortgageSchedule,simulateInvestmentFlows,equalizeCashFlows,simulatePlan};
});
