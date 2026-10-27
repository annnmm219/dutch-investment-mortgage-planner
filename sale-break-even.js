(function(root,factory){
  const commonJS=typeof module==='object'&&module.exports;
  const FC=commonJS?require('./finance-core.js'):root.FinanceCore;
  const Box1=commonJS?require('./box1-2026.js'):root.Box1OwnHome2026;
  // Keep the Node entry point on the same Box 1 implementation as the browser.
  if(commonJS){
    // The browser applies this existing completeness gate before simulations.
    // In particular, proposed Box 3 tax needs complete calendar-year data.
    require('./logic-integrity-ui.js').decorateFinanceCore(FC);
  }
  const api=factory(FC,Box1);
  if(commonJS)module.exports=api;
  if(root)root.SaleBreakEvenCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(FC,Box1){
'use strict';
if(!FC)throw new Error('FinanceCore is required by SaleBreakEvenCore');

const MONEY_TOLERANCE=.01;
const MAX_MONTHS=1200;
const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
const sum=values=>values.reduce((total,value)=>total+value,0);
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const issue=(errors,field,message)=>errors.push({field,message});
const invalid=errors=>({valid:false,errors,reason:errors.map(error=>error.message).join(' ')});

function numeric(source,key,errors,{fallback,min=-Infinity,max=Infinity,integer=false,path=key}={}){
  const raw=source?.[key];
  if(raw===undefined&&fallback!==undefined)return fallback;
  const allowedType=typeof raw==='number'||typeof raw==='string';
  const value=allowedType&&!(typeof raw==='string'&&raw.trim()==='')?Number(raw):NaN;
  if(!Number.isFinite(value)||value<min||value>max||(integer&&!Number.isInteger(value))){
    issue(errors,path,`${path} must be a finite ${integer?'whole ':''}number${min!==-Infinity?` at least ${min}`:''}${max!==Infinity?` and at most ${max}`:''}.`);
    return 0;
  }
  return value;
}

function acquisition(input,errors,mortgageValue){
  const purchasePrice=numeric(input,'purchasePrice',errors,{min:.01});
  const downPayment=numeric(input,'downPayment',errors,{min:0});
  const purchaseCosts=numeric(input,'purchaseCosts',errors,{fallback:0,min:0});
  const financedPurchaseCosts=numeric(input,'financedPurchaseCosts',errors,{fallback:0,min:0});
  const initialMortgage=mortgageValue===undefined?numeric(input,'initialMortgage',errors,{min:0}):mortgageValue;
  const salePrice=numeric(input,'salePrice',errors,{min:0});
  const sellingCostPct=numeric(input,'sellingCostPct',errors,{fallback:0,min:0,max:99.999999});
  const sellingCostFixed=numeric(input,'sellingCostFixed',errors,{fallback:0,min:0});
  if(downPayment>purchasePrice+MONEY_TOLERANCE)issue(errors,'downPayment','Down payment toward the purchase price cannot exceed that price.');
  if(financedPurchaseCosts>purchaseCosts+MONEY_TOLERANCE)issue(errors,'financedPurchaseCosts','Financed purchase costs cannot exceed total purchase costs.');
  const initialCash=downPayment+purchaseCosts-financedPurchaseCosts;
  const sources=initialCash+initialMortgage,uses=purchasePrice+purchaseCosts;
  if(Math.abs(sources-uses)>MONEY_TOLERANCE)issue(errors,'initialMortgage','Initial mortgage plus buyer cash must exactly fund the purchase price and purchase costs.');
  return{purchasePrice,downPayment,purchaseCosts,financedPurchaseCosts,initialMortgage,initialCash,salePrice,sellingCostPct,sellingCostFixed,sources,uses};
}

function aggregateValues(a,totals,remainingMortgage){
  const cashContributed=a.initialCash+totals.principalPaid+totals.interestPaid+totals.ownerCosts-totals.netTaxBenefit;
  const saleCosts=a.sellingCostFixed+a.salePrice*a.sellingCostPct/100;
  const netSaleProceeds=a.salePrice-saleCosts-remainingMortgage;
  const ownershipProfit=netSaleProceeds-cashContributed;
  const denominator=1-a.sellingCostPct/100;
  return{
    valid:true,errors:[],initialCash:a.initialCash,cashContributed,remainingMortgage,salePrice:a.salePrice,saleCosts,
    netSaleProceeds,ownershipProfit,owningCost:-ownershipProfit,advantageVsRent:ownershipProfit+totals.rentPaid,
    cashRequiredAtSale:Math.max(0,-netSaleProceeds),
    breakEven:{
      cashRecovery:(remainingMortgage+cashContributed+a.sellingCostFixed)/denominator,
      rentParity:(remainingMortgage+cashContributed+a.sellingCostFixed-totals.rentPaid)/denominator,
      debtClearance:(remainingMortgage+a.sellingCostFixed)/denominator
    },
    totals:{...totals},
    funding:{initialMortgage:a.initialMortgage,downPayment:a.downPayment,purchaseCosts:a.purchaseCosts,
      financedPurchaseCosts:a.financedPurchaseCosts,initialCash:a.initialCash,totalSources:a.sources,totalUses:a.uses,difference:a.sources-a.uses},
    conventions:{currency:'EUR',priceBasis:'nominal',rentTreatment:'Avoided rent is added to the ownership cash result.',
      principalTreatment:'Principal payments reduce sale debt by the same amount; principal is not a second economic cost.',
      sellingCostPct:a.sellingCostPct,sellingCostFixed:a.sellingCostFixed}
  };
}

function containsNonFinite(value){
  if(typeof value==='number')return!Number.isFinite(value);
  if(Array.isArray(value))return value.some(containsNonFinite);
  if(record(value))return Object.values(value).some(containsNonFinite);
  return false;
}

/** Aggregate cash-flow identity, also suitable for reconciled historical totals. */
function aggregate(input={}){
  if(!record(input))return invalid([{field:'input',message:'Sale inputs must be an object.'}]);
  const errors=[],a=acquisition(input,errors);
  const totals={
    principalPaid:numeric(input,'principalPaid',errors,{min:0}),
    interestPaid:numeric(input,'interestPaid',errors,{min:0}),
    ownerCosts:numeric(input,'ownerCosts',errors,{fallback:0,min:0}),
    netTaxBenefit:numeric(input,'netTaxBenefit',errors,{fallback:0}),
    rentPaid:numeric(input,'rentPaid',errors,{fallback:0,min:0})
  };
  const remainingMortgage=own(input,'remainingMortgage')
    ?numeric(input,'remainingMortgage',errors,{min:0})
    :Math.max(0,a.initialMortgage-totals.principalPaid);
  if(Math.abs(remainingMortgage+totals.principalPaid-a.initialMortgage)>MONEY_TOLERANCE)
    issue(errors,'principalPaid','Principal paid plus remaining mortgage must equal the initial mortgage. Later borrowing needs a separate ledger and is not supported by this purchase scenario.');
  if(errors.length)return invalid(errors);
  const result=aggregateValues(a,totals,remainingMortgage);
  return containsNonFinite(result)?invalid([{field:'result',message:'These inputs exceed the supported numerical range.'}]):result;
}

function dateAt(startYear,startMonth,index){
  const offset=startMonth-1+index;
  const year=startYear+Math.floor(offset/12),month=offset%12+1;
  return{year,month,label:`${year}-${String(month).padStart(2,'0')}`};
}

function periodFor(config,months){
  const start=dateAt(config.startYear,config.startMonth,0);
  const end=months?dateAt(config.startYear,config.startMonth,months-1):start;
  return{startYear:start.year,startMonth:start.month,start:start.label,endYear:end.year,endMonth:end.month,end:end.label,
    months,years:months/12,saleTiming:months?'after-the-scheduled-payment-in-the-final-month':'at-purchase-before-monthly-payments',
    label:months?`${start.label} to ${end.label}, ${months} months; sale after the final monthly payment`:`${start.label}, at purchase before monthly payments`};
}

function validateTax(tax,errors){
  if(!record(tax)){issue(errors,'tax','Tax assumptions must be an object.');return{};}
  const normalized={...tax};
  if(own(tax,'enabled')&&typeof tax.enabled!=='boolean')issue(errors,'tax.enabled','Tax enabled must be true or false.');
  for(const [key,min,max] of [['deductionRate',0,1],['hraRemainingMonths',0,MAX_MONTHS],['qualifyingInterestFraction',0,1]]){
    if(own(tax,key))normalized[key]=numeric(tax,key,errors,{min,max,path:`tax.${key}`,integer:key==='hraRemainingMonths'});
  }
  for(const key of ['wozValue','box1IncomeBeforeOwnHome','hillenRelief','additionalDeductibleOwnHomeCosts','deductibleOwnHomeCostsByYear']){
    if(!own(tax,key))continue;
    const max=key==='hillenRelief'?1:Infinity;
    if(record(tax[key])){
      normalized[key]={};
      Object.keys(tax[key]).forEach(year=>{normalized[key][year]=numeric(tax[key],year,errors,{min:0,max,path:`tax.${key}.${year}`});});
    }else normalized[key]=numeric(tax,key,errors,{min:0,max,path:`tax.${key}`});
  }
  if(tax.calculationMode==='box1-2026'&&!FC.__r66Stage4Box1)issue(errors,'tax.calculationMode','The existing Box 1 2026 module must be loaded for the selected tax model.');
  return normalized;
}

function normalize(input){
  const errors=[];
  if(!record(input))return invalid([{field:'input',message:'Sale inputs must be an object.'}]);
  const mortgage=record(input.mortgage)?input.mortgage:{};
  if(!record(input.mortgage))issue(errors,'mortgage','Original purchase mortgage inputs are required.');
  const balance=numeric(mortgage,'balance',errors,{min:0,path:'mortgage.balance'});
  const a=acquisition(input,errors,balance);
  const months=numeric(input,'months',errors,{min:0,max:MAX_MONTHS,integer:true});
  const startYear=numeric(input,'startYear',errors,{fallback:2026,min:1900,max:2200,integer:true});
  const startMonth=numeric(input,'startMonth',errors,{fallback:1,min:1,max:12,integer:true});
  const config={...a,months,startYear,startMonth};
  for(const key of ['rentMonthly','ownerCostsMonthly'])config[key]=numeric(input,key,errors,{fallback:0,min:0});
  for(const key of ['rentGrowthPct','ownerCostsGrowthPct'])config[key]=numeric(input,key,errors,{fallback:0,min:-99.999999,max:1000});
  config.oneOffOwnerCost=numeric(input,'oneOffOwnerCost',errors,{fallback:0,min:0});
  config.oneOffOwnerCostMonth=numeric(input,'oneOffOwnerCostMonth',errors,{fallback:1,min:1,max:MAX_MONTHS,integer:true});
  config.oneOffTaxBenefit=numeric(input,'oneOffTaxBenefit',errors,{fallback:0});
  config.oneOffTaxMonth=numeric(input,'oneOffTaxMonth',errors,{fallback:1,min:1,max:MAX_MONTHS,integer:true});
  config.tax=validateTax(input.tax===undefined?{enabled:false}:input.tax,errors);
  const termYears=numeric(mortgage,'termYears',errors,{fallback:30,min:1,max:100,path:'mortgage.termYears'});
  const automaticOwnHomeTax=config.tax.calculationMode==='box1-2026'
    ||(config.tax.calculationMode===undefined&&own(config.tax,'box1IncomeBeforeOwnHome'));
  if(termYears>30&&config.tax.enabled!==false&&automaticOwnHomeTax&&(config.tax.qualifyingInterestFraction??1)>0)
    issue(errors,'mortgage.termYears','Automatic mortgage-interest deduction is unavailable for a new purchase mortgage with an original contractual amortization term above 30 years. Use an eligible loan term of 30 years or less, or switch housing tax relief off.');
  const annualRatePct=numeric(mortgage,'annualRatePct',errors,{fallback:0,min:0,max:100,path:'mortgage.annualRatePct'});
  const type=mortgage.type===undefined?'annuity':mortgage.type;
  if(!['annuity','linear'].includes(type))issue(errors,'mortgage.type','Mortgage type must be annuity or linear.');
  const extraMonthly=Array.isArray(mortgage.extraMonthly)
    ?mortgage.extraMonthly.map((value,index)=>numeric({value},'value',errors,{min:0,path:`mortgage.extraMonthly[${index}]`}))
    :numeric(mortgage,'extraMonthly',errors,{fallback:0,min:0,path:'mortgage.extraMonthly'});
  const extraAnnual=numeric(mortgage,'extraAnnual',errors,{fallback:0,min:0,path:'mortgage.extraAnnual'});
  const extraAnnualMonth=numeric(mortgage,'extraAnnualMonth',errors,{fallback:12,min:1,max:12,integer:true,path:'mortgage.extraAnnualMonth'});
  let ratePeriods=[];
  if(mortgage.ratePeriods!==undefined&&!Array.isArray(mortgage.ratePeriods))issue(errors,'mortgage.ratePeriods','Mortgage rate periods must be an array.');
  else ratePeriods=(mortgage.ratePeriods||[]).map((period,index)=>{
    if(!record(period)){issue(errors,`mortgage.ratePeriods[${index}]`,'Every mortgage rate period must be an object.');return{months:1,annualRatePct:0};}
    return{months:numeric(period,'months',errors,{min:1,max:MAX_MONTHS,integer:true,path:`mortgage.ratePeriods[${index}].months`}),
      annualRatePct:numeric(period,'annualRatePct',errors,{min:0,max:100,path:`mortgage.ratePeriods[${index}].annualRatePct`})};
  });
  if(ratePeriods.length&&sum(ratePeriods.map(period=>period.months))!==Math.round(termYears*12))
    issue(errors,'mortgage.ratePeriods','Rate periods must cover the original mortgage term exactly.');
  const extraByMonth=new Map();
  if(mortgage.extraPayments!==undefined&&!Array.isArray(mortgage.extraPayments))issue(errors,'mortgage.extraPayments','Scheduled extra payments must be an array.');
  else(mortgage.extraPayments||[]).forEach((payment,index)=>{
    if(!record(payment)){issue(errors,`mortgage.extraPayments[${index}]`,'Every scheduled extra payment must be an object.');return;}
    const monthIndex=numeric(payment,'monthIndex',errors,{min:0,max:MAX_MONTHS-1,integer:true,path:`mortgage.extraPayments[${index}].monthIndex`});
    const amount=numeric(payment,'amount',errors,{min:0,path:`mortgage.extraPayments[${index}].amount`});
    extraByMonth.set(monthIndex,(extraByMonth.get(monthIndex)||0)+amount);
  });
  config.mortgage={balance,annualRatePct,termYears,type,extraMonthly,extraAnnual,extraAnnualMonth,ratePeriods,extraByMonth};
  if(input.investment!==undefined&&!record(input.investment))issue(errors,'investment','Investment assumptions must be an object.');
  config.investment=record(input.investment)?{...input.investment}:{enabled:false};
  if(own(config.investment,'enabled')&&typeof config.investment.enabled!=='boolean')issue(errors,'investment.enabled','Investment enabled must be true or false.');
  return errors.length?invalid(errors):{valid:true,config};
}

function normalizeInvestment(raw,config){
  if(raw.enabled!==true)return{enabled:false,available:false,reason:'Investment comparison is switched off.'};
  const errors=[];
  const annualReturnPct=numeric(raw,'annualReturnPct',errors,{fallback:0,min:-99.999999,max:1000,path:'investment.annualReturnPct'});
  const portfolioInput={commonInitialPortfolio:own(raw,'commonInitialPortfolio')?raw.commonInitialPortfolio:own(raw,'initialPortfolio')?raw.initialPortfolio:0};
  const commonInitialPortfolio=numeric(portfolioInput,'commonInitialPortfolio',errors,{min:0,path:'investment.commonInitialPortfolio'});
  const commonMonthlyContribution=numeric(raw,'commonMonthlyContribution',errors,{fallback:0,min:0,path:'investment.commonMonthlyContribution'});
  const box=raw.box3===undefined?{}:raw.box3;
  if(!record(box))return{enabled:true,available:false,invalidInputs:true,errors:[{field:'investment.box3',message:'Box 3 assumptions must be an object.'}],reason:'Box 3 assumptions must be an object.'};
  const mode=box.mode??box.box3Mode??'none';
  if(!['none','current','future','transition'].includes(mode))issue(errors,'investment.box3.mode','Select a supported Box 3 model: none, current, future or transition.');
  const args={box3Mode:mode};
  const numericFields={taxPartners:[1,2],currentTaxRate:[0,1],currentAllowance:[0,Infinity],currentNotional:[0,1],
    currentSavingsNotional:[0,1],currentDebtNotional:[0,1],currentDebtThreshold:[0,Infinity],
    firstJan1Portfolio:[0,Infinity],firstJan1Savings:[0,Infinity],firstJan1Debt:[0,Infinity],
    savingsReturnPct:[-99.999999,1000],debtInterestPct:[0,100],futureStart:[1900,2300],futureTaxRate:[0,1],
    futureExempt:[0,Infinity],futureLossThreshold:[0,Infinity]};
  for(const[key,[min,max]]of Object.entries(numericFields)){
    if(own(box,key))args[key]=numeric(box,key,errors,{min,max,integer:['taxPartners','futureStart'].includes(key),path:`investment.box3.${key}`});
  }
  for(const[key,aliases]of Object.entries({box3Savings:['savings','box3Savings'],box3Debt:['debt','box3Debt'],box3DebtMonthlyRepayment:['debtMonthlyRepayment','box3DebtMonthlyRepayment']})){
    const sourceKey=aliases.find(alias=>own(box,alias));
    args[key]=sourceKey?numeric(box,sourceKey,errors,{min:0,path:`investment.box3.${sourceKey}`}):0;
  }
  args.paySource=box.paySource??'portfolio';
  if(!['portfolio','savings','external'].includes(args.paySource))issue(errors,'investment.box3.paySource','Box 3 tax payment source must be portfolio, savings or external.');
  args.debtRepaymentSource=box.debtRepaymentSource??'external';
  if(!['savings','external'].includes(args.debtRepaymentSource))issue(errors,'investment.box3.debtRepaymentSource','Box 3 debt repayment source must be savings or external.');
  args.box3DebtFallbackDestination=box.debtFallbackDestination??box.box3DebtFallbackDestination??'invest';
  if(!['invest','savings','consume'].includes(args.box3DebtFallbackDestination))issue(errors,'investment.box3.debtFallbackDestination','Box 3 debt fallback destination must be invest, savings or consume.');
  if(errors.length)return{enabled:true,available:false,invalidInputs:true,errors,reason:errors.map(error=>error.message).join(' ')};
  if(mode!=='none'&&config.startMonth!==1){
    for(const key of ['firstJan1Portfolio','firstJan1Savings','firstJan1Debt']){
      if(!own(box,key))issue(errors,`investment.box3.${key}`,'A midyear Box 3 comparison requires explicit January 1 portfolio, savings and debt snapshots.');
    }
  }
  if(errors.length)return{enabled:true,available:false,errors,reason:errors.map(error=>error.message).join(' ')};
  return{enabled:true,available:true,annualReturnPct,commonInitialPortfolio,commonMonthlyContribution,args};
}

function compareInvestments(config,base,rows,settings){
  if(!settings.available)return{...settings};
  // FC's public equalizer accepts nonnegative costs. A common offset preserves
  // signed costs (for example a large tax refund) without losing that income.
  const offsets=rows.map(row=>Math.max(0,-Math.min(row.ownerCashCost,row.rent)));
  const equalized=FC.equalizeCashFlows(rows.map((row,i)=>row.ownerCashCost+offsets[i]),rows.map((row,i)=>row.rent+offsets[i]));
  const ownerContributions=equalized.a.map(flow=>flow+settings.commonMonthlyContribution);
  const renterContributions=equalized.b.map(flow=>flow+settings.commonMonthlyContribution);
  const common={...settings.args,annualReturnPct:settings.annualReturnPct,startYear:config.startYear,startMonth:config.startMonth,
    box3InputSource:'explicit',assumePlanStartAsJan1:false};
  const owner=FC.simulateInvestmentFlows({...common,initialPortfolio:settings.commonInitialPortfolio,flows:ownerContributions});
  const renter=FC.simulateInvestmentFlows({...common,initialPortfolio:settings.commonInitialPortfolio+config.initialCash,flows:renterContributions});
  const blocked=[owner,renter].find(result=>result.taxAdjustedComparableAvailable===false);
  if(blocked)return{enabled:true,available:false,box3Mode:settings.args.box3Mode,
    reason:blocked.taxBlockReason||'The selected tax model cannot produce a comparable investment result for this period.'};
  if(!Number.isFinite(owner.householdComparableWealth)||!Number.isFinite(renter.householdComparableWealth))
    return{enabled:true,available:false,box3Mode:settings.args.box3Mode,reason:'The investment tax model did not return finite comparable wealth for both alternatives.'};
  const ownerComparableWealth=owner.householdComparableWealth,renterComparableWealth=renter.householdComparableWealth;
  const advantage=base.netSaleProceeds+ownerComparableWealth-renterComparableWealth;
  const result={enabled:true,available:true,annualReturnPct:settings.annualReturnPct,box3Mode:settings.args.box3Mode,
    commonInitialPortfolio:settings.commonInitialPortfolio,commonMonthlyContribution:settings.commonMonthlyContribution,owner,renter,
    ownerTerminalInvestments:owner.portfolio,renterTerminalInvestments:renter.portfolio,
    ownerComparableWealth,renterComparableWealth,ownerTerminalWealth:base.netSaleProceeds+ownerComparableWealth,
    renterTerminalWealth:renterComparableWealth,advantage,
    breakEvenSalePrice:(base.remainingMortgage+config.sellingCostFixed+renterComparableWealth-ownerComparableWealth)/(1-config.sellingCostPct/100),
    monthlyBudget:equalized.budget.map((budget,i)=>budget-offsets[i]+settings.commonMonthlyContribution),ownerContributions,renterContributions,
    conventions:{equalStartingResources:true,equalMonthlyBudgets:true,contributionTiming:'end-of-month',
      saleTiming:'At the endpoint, before investing sale proceeds or modeling later taxes on those proceeds.',
      comparisonBasis:'FinanceCore householdComparableWealth, including dated external funding and unsettled Box 3 estimates.'}
  };
  return containsNonFinite(result)?{enabled:true,available:false,reason:'Investment inputs exceed the supported numerical range.'}:result;
}

/** Full purchase-to-sale primary-residence scenario; mortgage and taxes are delegated to FinanceCore. */
function calculateWithOwnTaxContext(input={}){
  const normalized=normalize(input);
  if(!normalized.valid)return normalized;
  const config=normalized.config,mortgage=config.mortgage;
  try{
    const extraMonthly=(index,{month})=>(Array.isArray(mortgage.extraMonthly)?mortgage.extraMonthly[index]||0:mortgage.extraMonthly)
      +(month===mortgage.extraAnnualMonth?mortgage.extraAnnual:0)+(mortgage.extraByMonth.get(index)||0);
    const schedule=FC.mortgageSchedule({balance:mortgage.balance,annualRatePct:mortgage.annualRatePct,termYears:mortgage.termYears,
      type:mortgage.type,months:config.months,startYear:config.startYear,startMonth:config.startMonth,ratePeriods:mortgage.ratePeriods,
      extraMonthly,tax:{...config.tax,homeOwnershipMonths:config.months}});
    if(containsNonFinite(schedule))return invalid([{field:'mortgage',message:'Mortgage inputs exceed the supported numerical range.'}]);
    const investmentSettings=normalizeInvestment(config.investment,config);
    if(investmentSettings.invalidInputs)return invalid(investmentSettings.errors);
    const atHorizon=months=>{
      // Reallocate each prospective sale year independently. A prefix of a
      // longer schedule can contain tax allocated using later-year interest.
      const allocation=FC.allocateAnnualMortgageTax(schedule.rows.slice(0,months),{...config.tax,homeOwnershipMonths:months});
      const rows=allocation.rows.map((row,index)=>{
        const rent=config.rentMonthly*Math.pow(1+config.rentGrowthPct/100,index/12);
        const recurringOwnerCosts=config.ownerCostsMonthly*Math.pow(1+config.ownerCostsGrowthPct/100,index/12);
        const oneOffOwnerCosts=index+1===config.oneOffOwnerCostMonth?config.oneOffOwnerCost:0;
        const ownerCosts=recurringOwnerCosts+oneOffOwnerCosts;
        const oneOffTaxBenefit=index+1===config.oneOffTaxMonth?config.oneOffTaxBenefit:0;
        const netTaxBenefit=row.taxReturn+oneOffTaxBenefit;
        return{...row,rent,ownerCosts,recurringOwnerCosts,oneOffOwnerCosts,oneOffTaxBenefit,netTaxBenefit,ownerCashCost:row.gross+row.extra+ownerCosts-netTaxBenefit};
      });
      const totals={
        principalPaid:sum(rows.map(row=>row.principal+row.extra)),scheduledPrincipalPaid:sum(rows.map(row=>row.principal)),
        extraPrincipalPaid:sum(rows.map(row=>row.extra)),interestPaid:sum(rows.map(row=>row.interest)),
        ownerCosts:sum(rows.map(row=>row.ownerCosts)),recurringOwnerCosts:sum(rows.map(row=>row.recurringOwnerCosts)),
        oneOffOwnerCosts:sum(rows.map(row=>row.oneOffOwnerCosts)),netTaxBenefit:sum(rows.map(row=>row.netTaxBenefit)),
        scheduledTaxBenefit:allocation.totalTaxBenefit,oneOffTaxBenefit:sum(rows.map(row=>row.oneOffTaxBenefit)),
        rentPaid:sum(rows.map(row=>row.rent)),requestedExtra:sum(rows.map(row=>row.requestedExtra)),unusedExtra:sum(rows.map(row=>row.unusedExtra))
      };
      const remainingMortgage=rows.length?rows[rows.length-1].balance:config.initialMortgage;
      if(Math.abs(totals.principalPaid+remainingMortgage-config.initialMortgage)>MONEY_TOLERANCE)
        throw new Error('Mortgage principal does not reconcile to the original purchase loan.');
      const result=aggregateValues(config,totals,remainingMortgage);
      result.months=months;result.years=months/12;result.period=periodFor(config,months);
      result.investment=compareInvestments(config,result,rows,investmentSettings);
      result.annualTaxBuckets=allocation.annualBuckets;
      result.rows=rows;
      return result;
    };
    const result=atHorizon(config.months);
    const annual=[];
    for(let months=12;months<config.months;months+=12){
      const entry=atHorizon(months);
      delete entry.rows;
      // Detailed investment simulations belong to the selected horizon; the
      // annual comparison retains their totals without duplicating every flow.
      if(entry.investment.available){entry.investment={...entry.investment};for(const key of ['owner','renter','monthlyBudget','ownerContributions','renterContributions'])delete entry.investment[key];}
      annual.push(entry);
    }
    const finalEntry={...result};delete finalEntry.rows;
    if(finalEntry.investment.available){finalEntry.investment={...finalEntry.investment};for(const key of ['owner','renter','monthlyBudget','ownerContributions','renterContributions'])delete finalEntry.investment[key];}
    annual.push(finalEntry);
    result.annual=annual;
    result.mortgage={type:mortgage.type,originalTermMonths:Math.round(mortgage.termYears*12),ratePeriods:mortgage.ratePeriods,
      payoffMonthIndex:schedule.payoffMonthIndex,totalRequestedExtra:schedule.totalRequestedExtra,totalUnusedExtra:schedule.totalUnusedExtra};
    result.assumptions={scope:'Primary residence, from purchase to sale',taxPolicy:'Existing 2026 policy model and its selected future planning assumptions; no live-law updates.',
      housingTaxTiming:'Housing tax effects are attributed to the modeled ownership period, not the government refund payment date.',
      growthTiming:'Effective annual rent and owner-cost growth is applied monthly, starting after month one.',
      annualExtraTiming:`Extra annual payment in calendar month ${mortgage.extraAnnualMonth}.`,
      oneOffOwnerCostTiming:`A one-off ownership expense is paid in month ${config.oneOffOwnerCostMonth} from purchase and is not spread across other months.`,
      initialCashTiming:'Buyer cash is paid at purchase. The renter can invest the same amount at purchase.',
      priceBasis:'Nominal euros; no inflation adjustment.',laterBorrowing:'Not supported; enter original purchase funding, not a current mortgage balance.'};
    result.warnings=[];
    if(config.startYear!==2026)result.warnings.push('The selected purchase date changes the timeline; historical tax rules are not reconstructed. The selected 2026 model remains a planning assumption.');
    if(config.oneOffTaxBenefit!==0)result.warnings.push('The one-off tax adjustment is added to scheduled housing tax effects. Include each benefit or charge once.');
    if(investmentSettings.enabled&&!investmentSettings.available)result.warnings.push(investmentSettings.reason);
    else if(result.investment.enabled&&!result.investment.available)result.warnings.push(result.investment.reason);
    return containsNonFinite(result)?invalid([{field:'result',message:'These inputs exceed the supported numerical range.'}]):result;
  }catch(error){
    return invalid([{field:'calculation',message:error instanceof Error?error.message:'The sale scenario could not be calculated.'}]);
  }
}

function calculate(input={}){
  // Existing Box 1 helpers normally inherit the main planner's DOM controls.
  // A standalone purchase scenario must depend only on its explicit inputs.
  return Box1&&typeof Box1.withTaxContext==='function'
    ?Box1.withTaxContext({},()=>calculateWithOwnTaxContext(input))
    :calculateWithOwnTaxContext(input);
}

return{aggregate,calculate};
});
