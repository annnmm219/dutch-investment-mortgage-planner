(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.FinanceCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';

const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const nonNegative=v=>Math.max(0,Number(v)||0);

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

function regimeForYear({mode='none',year,futureStart=2028}={}){
  if(mode==='none')return'none';
  if(mode==='current')return'current';
  if(mode==='future')return'future';
  return Number(year)>=Number(futureStart||2028)?'future':'current';
}

function box3TaxForYear({
  regime='none',
  jan1Portfolio=0,
  marketGain=0,
  lossCarry=0,
  taxPartners=1,
  currentTaxRate=.36,
  currentAllowance=59357,
  currentNotional=.06,
  futureTaxRate=.36,
  futureExempt=1800,
  futureLossThreshold=500
}={}){
  let tax=0;
  let nextLossCarry=nonNegative(lossCarry);
  let method='none';

  if(regime==='current'){
    const partners=clamp(Number(taxPartners)||1,1,2);
    const allowance=nonNegative(currentAllowance)*partners;
    const notionalIncome=Math.max(0,nonNegative(jan1Portfolio)-allowance)*clamp(Number(currentNotional)||0,0,1);
    const notionalTax=notionalIncome*clamp(Number(currentTaxRate)||0,0,1);
    const actualTax=Math.max(0,Number(marketGain)||0)*clamp(Number(currentTaxRate)||0,0,1);
    tax=Math.min(notionalTax,actualTax);
    method=actualTax<=notionalTax?'actual-return rebuttal':'deemed return';
    return{tax,lossCarry:nextLossCarry,method,notionalTax,actualTax};
  }

  if(regime==='future'){
    const partners=clamp(Number(taxPartners)||1,1,2);
    const result=Number(marketGain)||0;
    if(result<0){
      nextLossCarry+=Math.max(0,-result-nonNegative(futureLossThreshold));
      method='proposed actual return · loss';
    }else{
      const usedLoss=Math.min(nextLossCarry,result);
      const afterLoss=Math.max(0,result-usedLoss);
      nextLossCarry-=usedLoss;
      tax=Math.max(0,afterLoss-nonNegative(futureExempt)*partners)*clamp(Number(futureTaxRate)||0,0,1);
      method='proposed actual return';
    }
  }

  return{tax,lossCarry:nextLossCarry,method};
}

function mortgageSchedule({
  balance=0,
  annualRatePct=0,
  termYears=30,
  type='annuity',
  months,
  extraMonthly=0,
  startYear=2026,
  startMonth=1,
  tax={}
}={}){
  const initialBalance=nonNegative(balance);
  const annualRate=clamp(Number(annualRatePct)||0,0,100)/100;
  const monthlyRate=annualRate/12;
  const termMonths=Math.max(1,Math.round(clamp(Number(termYears)||1,1,100)*12));
  const horizonMonths=Math.max(0,Math.round(months==null?termMonths:months));
  const mortgageType=type==='linear'?'linear':'annuity';
  const linearPrincipal=initialBalance/termMonths;
  const annuityPayment=monthlyRate===0?initialBalance/termMonths:initialBalance*monthlyRate/(1-Math.pow(1+monthlyRate,-termMonths));
  const taxEnabled=tax.enabled!==false;
  const deductionRate=clamp(Number(tax.deductionRate)||0,0,1);
  const wozValue=nonNegative(tax.wozValue);

  let outstanding=initialBalance;
  let totalInterest=0;
  let totalScheduledPrincipal=0;
  let totalExtra=0;
  let payoffMonthIndex=null;
  const rows=[];
  const annualBuckets={};

  let year=Number(startYear)||2026;
  let month=clamp(Number(startMonth)||1,1,12);

  for(let i=0;i<horizonMonths;i++){
    let interest=0,principal=0,gross=0,extra=0,taxReturn=0;
    if(outstanding>0){
      interest=outstanding*monthlyRate;
      principal=mortgageType==='linear'
        ?Math.min(outstanding,linearPrincipal)
        :Math.min(outstanding,Math.max(0,annuityPayment-interest));
      gross=interest+principal;
      outstanding-=principal;
      const extraRequested=Array.isArray(extraMonthly)
        ?nonNegative(extraMonthly[i])
        :typeof extraMonthly==='function'?nonNegative(extraMonthly(i,{year,month,balance:outstanding})):nonNegative(extraMonthly);
      extra=Math.min(outstanding,extraRequested);
      outstanding-=extra;
      taxReturn=mortgageTaxBenefit({interest,months:1,deductionRate,wozValue,enabled:taxEnabled});
      if(outstanding<=.005){
        outstanding=0;
        if(payoffMonthIndex===null)payoffMonthIndex=i;
      }
    }

    totalInterest+=interest;
    totalScheduledPrincipal+=principal;
    totalExtra+=extra;
    if(!annualBuckets[year])annualBuckets[year]={interest:0,months:0};
    if(interest>0){annualBuckets[year].interest+=interest;annualBuckets[year].months++;}
    rows.push({monthIndex:i,year,month,balance:outstanding,gross,principal,interest,taxReturn,net:gross-taxReturn,extra,cash:gross-taxReturn+extra});

    month++;
    if(month===13){month=1;year++;}
  }

  let totalTaxBenefit=0;
  Object.values(annualBuckets).forEach(b=>{
    totalTaxBenefit+=mortgageTaxBenefit({interest:b.interest,months:b.months,deductionRate,wozValue,enabled:taxEnabled});
  });

  return{
    rows,
    initialBalance,
    balance:outstanding,
    totalInterest,
    totalTaxBenefit,
    totalScheduledPrincipal,
    totalExtra,
    totalScheduledPaid:totalInterest+totalScheduledPrincipal,
    firstScheduled:rows.length?rows[0].gross:0,
    payoffMonthIndex,
    type:mortgageType
  };
}

function simulateInvestmentFlows({
  initialPortfolio=0,
  flows=[],
  annualReturnPct=0,
  startYear=2026,
  startMonth=1,
  box3Mode='none',
  taxPartners=1,
  paySource='portfolio',
  currentTaxRate=.36,
  currentAllowance=59357,
  currentNotional=.06,
  firstJan1Portfolio=0,
  futureStart=2028,
  futureTaxRate=.36,
  futureExempt=1800,
  futureLossThreshold=500
}={}){
  const monthlyReturn=(Number(annualReturnPct)||0)/100/12;
  let portfolio=nonNegative(initialPortfolio);
  let totalTax=0,currentTax=0,futureTax=0,externalTax=0,lossCarry=0;
  let year=Number(startYear)||2026;
  let month=clamp(Number(startMonth)||1,1,12);
  let yearStartPortfolio=portfolio;
  let marketGain=0;
  const yearBuckets={};
  const series=[];

  const monthlyFlows=Array.isArray(flows)?flows:[];
  for(let i=0;i<monthlyFlows.length;i++){
    const growth=portfolio*monthlyReturn;
    portfolio+=growth;
    marketGain+=growth;
    portfolio+=nonNegative(monthlyFlows[i]);

    const nextMonth=month===12?1:month+1;
    const nextYear=month===12?year+1:year;
    const yearEnd=nextYear!==year||i===monthlyFlows.length-1;

    if(yearEnd){
      const regime=regimeForYear({mode:box3Mode,year,futureStart});
      const jan1Value=(year===Number(startYear)&&Number(startMonth)>1)
        ?nonNegative(firstJan1Portfolio)
        :nonNegative(yearStartPortfolio);
      const taxResult=box3TaxForYear({regime,jan1Portfolio:jan1Value,marketGain,lossCarry,taxPartners,currentTaxRate,currentAllowance,currentNotional,futureTaxRate,futureExempt,futureLossThreshold});
      lossCarry=taxResult.lossCarry;
      totalTax+=taxResult.tax;
      if(regime==='current')currentTax+=taxResult.tax;
      if(regime==='future')futureTax+=taxResult.tax;
      const beforeTax=portfolio;
      if(paySource==='portfolio')portfolio=Math.max(0,portfolio-taxResult.tax);
      else externalTax+=taxResult.tax;
      yearBuckets[year]={year,regime,jan1Portfolio:jan1Value,marketGain,endBeforeTax:beforeTax,box3Tax:taxResult.tax,endAfterTax:portfolio,method:taxResult.method};
      series.push({year,month,portfolio,box3Tax:totalTax});
      yearStartPortfolio=portfolio;
      marketGain=0;
    }

    year=nextYear;
    month=nextMonth;
  }

  return{portfolio,totalTax,currentTax,futureTax,externalTax,comparableWealth:portfolio-externalTax,lossCarry,yearBuckets,series};
}

function equalizeCashFlows(a=[],b=[]){
  const length=Math.max(a.length,b.length);
  const flowA=[],flowB=[],budget=[];
  for(let i=0;i<length;i++){
    const av=nonNegative(a[i]);
    const bv=nonNegative(b[i]);
    const monthlyBudget=Math.max(av,bv);
    budget.push(monthlyBudget);
    flowA.push(Math.max(0,monthlyBudget-av));
    flowB.push(Math.max(0,monthlyBudget-bv));
  }
  return{a:flowA,b:flowB,budget};
}

function simulatePlan(config={}){
  const phases=Array.isArray(config.phases)?config.phases:[];
  const startYear=Number(config.startYear)||2026;
  const startMonth=clamp(Number(config.startMonth)||1,1,12);
  const bonusMonth=clamp(Number(config.bonusMonth)||12,1,12);
  const annualReturnPct=Number(config.annualReturnPct)||0;
  const monthlyReturn=annualReturnPct/100/12;
  const mortRatePct=clamp(Number(config.mortRatePct)||0,0,100);
  const monthlyMortRate=mortRatePct/100/12;
  const mortTermMonths=Math.max(1,Math.round(clamp(Number(config.mortYears)||1,1,100)*12));
  const initialMort=nonNegative(config.mortBalance);
  const mortType=config.mortType==='linear'?'linear':'annuity';
  const linearPrincipal=initialMort/mortTermMonths;
  const annuityPayment=monthlyMortRate===0?initialMort/mortTermMonths:initialMort*monthlyMortRate/(1-Math.pow(1+monthlyMortRate,-mortTermMonths));
  const totalMonths=phases.reduce((sum,p)=>sum+Math.max(0,Math.round((Number(p.years)||0)*12)),0);

  let portfolio=nonNegative(config.startPortfolio);
  let invested=portfolio;
  let mort=initialMort;
  let grossInterest=0,extraPaid=0,scheduledPrincipal=0,box3Tax=0,currentTax=0,futureTax=0,lossCarry=0;
  let payoffDate=null;
  const schedule=[],series=[],yearBuckets={};
  let year=startYear,month=startMonth,global=0;

  function bucket(y){
    if(!yearBuckets[y])yearBuckets[y]={year:y,startPortfolio:null,endBeforeTax:0,endAfterTax:0,marketGain:0,contrib:0,mortInterest:0,mortMonths:0,mortTax:0,box3Tax:0,regime:'none',method:'none'};
    return yearBuckets[y];
  }

  for(const phase of phases){
    const phaseMonths=Math.max(0,Math.round((Number(phase.years)||0)*12));
    for(let pm=0;pm<phaseMonths;pm++){
      global++;
      const b=bucket(year);
      if(b.startPortfolio===null)b.startPortfolio=portfolio;

      const growth=portfolio*monthlyReturn;
      portfolio+=growth;
      b.marketGain+=growth;

      let investContrib=nonNegative(phase.monthlyInvest);
      let bonusInvest=0,bonusMort=0;
      if(month===bonusMonth&&nonNegative(phase.annualBonus)>0){
        if(phase.bonusDest==='mortgage')bonusMort=nonNegative(phase.annualBonus);
        else if(phase.bonusDest==='split'){
          bonusInvest=nonNegative(phase.annualBonus)/2;
          bonusMort=nonNegative(phase.annualBonus)/2;
        }else bonusInvest=nonNegative(phase.annualBonus);
      }
      investContrib+=bonusInvest;
      portfolio+=investContrib;
      invested+=investContrib;
      b.contrib+=investContrib;

      let interest=0,principal=0,extra=0,grossScheduled=0,taxReturn=0;
      if(mort>0){
        interest=mort*monthlyMortRate;
        grossInterest+=interest;
        b.mortInterest+=interest;
        b.mortMonths++;
        principal=mortType==='linear'?Math.min(mort,linearPrincipal):Math.min(mort,Math.max(0,annuityPayment-interest));
        grossScheduled=interest+principal;
        mort-=principal;
        scheduledPrincipal+=principal;
        if(phase.mortgageFreq==='monthly')extra+=nonNegative(phase.mortgageExtra);
        else if(month===bonusMonth)extra+=nonNegative(phase.mortgageExtra);
        extra+=bonusMort;
        extra=Math.min(mort,Math.max(0,extra));
        mort-=extra;
        extraPaid+=extra;
        taxReturn=mortgageTaxBenefit({interest,months:1,deductionRate:config.deductRate,wozValue:config.wozValue,enabled:config.mortTaxEnabled!==false});
        if(mort<=.005){
          mort=0;
          if(!payoffDate)payoffDate={year,month};
        }
      }

      schedule.push({year,month,balance:mort,gross:grossScheduled,principal,interest,taxReturn,net:grossScheduled-taxReturn,extra});
      b.endBeforeTax=portfolio;

      const nextMonth=month===12?1:month+1;
      const nextYear=month===12?year+1:year;
      const endOfCalendarYear=nextYear!==year;
      const finalMonth=global===totalMonths;
      if(endOfCalendarYear||finalMonth){
        const regime=regimeForYear({mode:config.box3Mode,year,futureStart:config.futureStart});
        b.regime=regime;
        const jan1Value=(year===startYear&&startMonth>1)?nonNegative(config.firstJan1Portfolio):Math.max(0,b.startPortfolio||0);
        const taxResult=box3TaxForYear({regime,jan1Portfolio:jan1Value,marketGain:b.marketGain,lossCarry,taxPartners:config.taxPartners,currentTaxRate:config.currentTaxRate,currentAllowance:config.currentAllowance,currentNotional:config.currentNotional,futureTaxRate:config.futureTaxRate,futureExempt:config.futureExempt,futureLossThreshold:config.futureLossThreshold});
        lossCarry=taxResult.lossCarry;
        b.method=taxResult.method;
        b.box3Tax=taxResult.tax;
        box3Tax+=taxResult.tax;
        if(regime==='current')currentTax+=taxResult.tax;
        if(regime==='future')futureTax+=taxResult.tax;
        if(config.box3PaySource==='portfolio')portfolio=Math.max(0,portfolio-taxResult.tax);
        b.endAfterTax=portfolio;
        series.push({year,month,portfolio,mort,invested,box3Tax});
      }

      year=nextYear;
      month=nextMonth;
    }
  }

  let mortTax=0;
  Object.values(yearBuckets).forEach(b=>{
    b.mortTax=mortgageTaxBenefit({interest:b.mortInterest,months:b.mortMonths,deductionRate:config.deductRate,wozValue:config.wozValue,enabled:config.mortTaxEnabled!==false});
    mortTax+=b.mortTax;
  });

  return{
    portfolio,invested,mort,initialMort,grossInterest,mortTax,netInterest:grossInterest-mortTax,
    extraPaid,scheduledPrincipal,grossScheduledTotal:grossInterest+scheduledPrincipal,
    firstScheduled:schedule.length?schedule[0].gross:0,box3Tax,currentTax,futureTax,lossCarry,
    payoffDate,schedule,series,yearBuckets,horizonMonths:global,mortType
  };
}

return{
  clamp,
  deductionRate2026,
  ewf2026,
  mortgageTaxBenefit,
  regimeForYear,
  box3TaxForYear,
  mortgageSchedule,
  simulateInvestmentFlows,
  equalizeCashFlows,
  simulatePlan
};
});
