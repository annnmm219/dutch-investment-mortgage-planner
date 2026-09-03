(function(root,factory){
  const Policy2026=typeof module==='object'&&module.exports?require('./policy-2026.js'):root.Policy2026;
  const FinanceCore=typeof module==='object'&&module.exports?require('./finance-core.js'):root.FinanceCore;
  const api=factory(Policy2026,FinanceCore);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.Box1OwnHome2026=api;
  api.decorateFinanceCore(FinanceCore);
})(typeof globalThis!=='undefined'?globalThis:this,function(Policy2026,initialCore){
'use strict';
if(!Policy2026)throw new Error('Policy2026 is required by Box1OwnHome2026');
if(!initialCore)throw new Error('FinanceCore is required by Box1OwnHome2026');

const POLICY=Policy2026.VALUES;
const PROFILE='non-aow-employment-2026';
const METHOD='bounded-2026-box1-before-after';
const taxContextStack=[];

const finite=value=>Number.isFinite(Number(value));
const number=value=>finite(value)?Number(value):0;
const nonNegative=value=>Math.max(0,number(value));
const clamp=(value,min,max)=>Math.min(max,Math.max(min,number(value)));

function progressiveBox1Tax2026(income){
  const value=Number(income);
  if(!Number.isFinite(value)||value<0)throw new RangeError('2026 Box 1 taxable income must be a finite non-negative number.');
  return POLICY.box1.preAowBrackets.reduce((tax,band)=>{
    const lower=Number(band.lower)||0;
    const upper=band.upper==null?Infinity:Number(band.upper);
    const taxable=Math.max(0,Math.min(value,upper)-lower);
    return tax+taxable*Number(band.rate);
  },0);
}

function unsupportedResult(reason,details={}){
  const reasons=(Array.isArray(reason)?reason:[reason]).filter(Boolean);
  return{
    supported:false,
    available:false,
    enabled:details.enabled!==false,
    method:'unavailable',
    ruleYear:POLICY.taxYear,
    profile:details.profile||null,
    unsupportedReasons:reasons,
    taxBenefit:null,
    taxEffect:null,
    ...details
  };
}

function ownHomeBox1Tax2026({
  enabled=true,
  box1IncomeBeforeOwnHome=0,
  ewfIncome=0,
  deductibleOwnHomeCosts=0,
  hillenRelief=POLICY.hillen.relief2026,
  profile=PROFILE,
  hasBox1LossCarry=false,
  hasOtherRateAdjustedDeductions=false,
  hasComplexFiscalPartnerAllocation=false,
  hasTransitionalDebt=false
}={}){
  const reasons=[];
  if(profile!==PROFILE)reasons.push('Only the 2026 non-AOW ordinary-employment profile is supported.');
  if(hasBox1LossCarry)reasons.push('Box 1 loss carryforward is outside this bounded model.');
  if(hasOtherRateAdjustedDeductions)reasons.push('Other deductions subject to the high-income rate adjustment are outside this bounded model.');
  if(hasComplexFiscalPartnerAllocation)reasons.push('Complex fiscal-partner allocation is outside this bounded model.');
  if(hasTransitionalDebt)reasons.push('Mixed or transitional pre-2013 own-home debt must be modeled separately.');
  if(!finite(box1IncomeBeforeOwnHome)||Number(box1IncomeBeforeOwnHome)<0)reasons.push('Box 1 income before own-home items must be a finite non-negative amount.');
  if(!finite(ewfIncome)||Number(ewfIncome)<0)reasons.push('EWF income must be a finite non-negative amount.');
  if(!finite(deductibleOwnHomeCosts)||Number(deductibleOwnHomeCosts)<0)reasons.push('Deductible own-home costs must be a finite non-negative amount.');
  if(!finite(hillenRelief)||Number(hillenRelief)<0||Number(hillenRelief)>1)reasons.push('Hillen relief must be between 0 and 1.');
  if(reasons.length)return unsupportedResult(reasons,{enabled,profile});

  const income=Number(box1IncomeBeforeOwnHome);
  const ewf=Number(ewfIncome);
  const deductible=Number(deductibleOwnHomeCosts);
  const relief=Number(hillenRelief);
  const grossOwnHomeBalance=ewf-deductible;
  const hillenDeduction=grossOwnHomeBalance>0?grossOwnHomeBalance*relief:0;
  const netOwnHomeIncome=grossOwnHomeBalance-hillenDeduction;
  const taxableIncomeAfterOwnHome=income+netOwnHomeIncome;

  if(taxableIncomeAfterOwnHome<0){
    return unsupportedResult('The own-home result creates negative Box 1 income; Box 1 loss treatment is outside this bounded model.',{
      enabled,profile,incomeBeforeOwnHome:income,ewfIncome:ewf,deductibleOwnHomeCosts:deductible,
      grossOwnHomeBalance,hillenRelief:relief,hillenDeduction,netOwnHomeIncome,taxableIncomeAfterOwnHome
    });
  }

  const taxBeforeOwnHome=progressiveBox1Tax2026(income);
  if(!enabled){
    return{
      supported:true,available:true,enabled:false,method:'disabled',ruleYear:POLICY.taxYear,profile,
      incomeBeforeOwnHome:income,ewfIncome:ewf,deductibleOwnHomeCosts:deductible,grossOwnHomeBalance,
      hillenRelief:relief,hillenDeduction,netOwnHomeIncome,taxableIncomeAfterOwnHome:income,
      taxBeforeOwnHome,tableTaxAfterOwnHome:taxBeforeOwnHome,highIncomeAdjustmentBase:0,
      highIncomeAdjustment:0,taxAfterOwnHome:taxBeforeOwnHome,taxEffect:0,taxBenefit:0
    };
  }

  const tableTaxAfterOwnHome=progressiveBox1Tax2026(taxableIncomeAfterOwnHome);
  const topThreshold=Number(POLICY.box1.preAowBrackets.at(-1).lower);
  const highIncomeAdjustmentBase=Math.min(
    deductible,
    Math.max(0,taxableIncomeAfterOwnHome+deductible-topThreshold)
  );
  const highIncomeAdjustment=highIncomeAdjustmentBase*POLICY.box1.ownHomeHighIncomeAdjustmentRate;
  const taxAfterOwnHome=tableTaxAfterOwnHome+highIncomeAdjustment;
  const taxEffect=taxAfterOwnHome-taxBeforeOwnHome;

  return{
    supported:true,
    available:true,
    enabled:true,
    method:METHOD,
    ruleYear:POLICY.taxYear,
    profile,
    incomeBeforeOwnHome:income,
    ewfIncome:ewf,
    deductibleOwnHomeCosts:deductible,
    grossOwnHomeBalance,
    hillenRelief:relief,
    hillenDeduction,
    netOwnHomeIncome,
    taxableIncomeAfterOwnHome,
    taxBeforeOwnHome,
    tableTaxAfterOwnHome,
    highIncomeAdjustmentBase,
    highIncomeAdjustment,
    taxAfterOwnHome,
    taxEffect,
    taxBenefit:-taxEffect
  };
}

function yearValue(value,year,fallback=0){
  let resolved=value;
  if(typeof value==='function')resolved=value(year);
  else if(value&&typeof value==='object'&&!Array.isArray(value))resolved=value[year]??value[String(year)]??fallback;
  return finite(resolved)?Number(resolved):fallback;
}

function browserNumber(id,fallback=0){
  if(typeof document==='undefined')return fallback;
  const raw=String(document.getElementById(id)?.value??'').trim().replace(/\s+/g,'').replace(/,/g,'.');
  const value=Number(raw);
  return Number.isFinite(value)?value:fallback;
}

function browserTaxContext(){
  if(typeof document==='undefined')return null;
  const mode=document.getElementById('deductionMode')?.value||'auto';
  if(mode==='manual')return{calculationMode:'manual-rate'};
  return{
    calculationMode:'box1-2026',
    box1IncomeBeforeOwnHome:Math.max(0,browserNumber('grossIncome',0)),
    box1Profile:PROFILE,
    hasBox1LossCarry:false,
    hasOtherRateAdjustedDeductions:false,
    hasComplexFiscalPartnerAllocation:false,
    hasTransitionalDebt:false
  };
}

function activeTaxContext(){return taxContextStack.length?taxContextStack[taxContextStack.length-1]:null;}

function withTaxContext(context,callback){
  if(typeof callback!=='function')throw new TypeError('withTaxContext requires a synchronous callback.');
  taxContextStack.push(context&&typeof context==='object'?{...context}:{});
  try{return callback();}
  finally{taxContextStack.pop();}
}

function normalizeTaxConfig(tax={}){
  const explicit=Object.fromEntries(Object.entries(tax||{}).filter(([,value])=>value!==undefined));
  const inherited=activeTaxContext()||browserTaxContext();
  if(explicit.calculationMode){
    return inherited?{...inherited,...explicit,calculationMode:explicit.calculationMode}:explicit;
  }
  if(finite(explicit.box1IncomeBeforeOwnHome)){
    return{...(inherited||{}),...explicit,calculationMode:'box1-2026'};
  }
  if(inherited)return{...inherited,...explicit,calculationMode:inherited.calculationMode||'manual-rate'};
  return{...explicit,calculationMode:'manual-rate'};
}

function additionalCostsForYear(tax,year){
  return nonNegative(yearValue(tax.additionalDeductibleOwnHomeCosts??tax.deductibleOwnHomeCostsByYear,year,0));
}

function allocateExactTax(rows=[],tax={},core=initialCore){
  const resultRows=(Array.isArray(rows)?rows:[]).map(row=>({
    ...row,
    taxReturn:0,
    net:number(row.gross),
    cash:number(row.gross)+nonNegative(row.extra),
    cashWithRequestedExtra:number(row.gross)+nonNegative(row.requestedExtra??row.extra)
  }));
  const annualBuckets={};

  resultRows.forEach((row,index)=>{
    if(row.homeOwned===false)return;
    const year=Number(row.year);
    if(!Number.isFinite(year))return;
    if(!annualBuckets[year])annualBuckets[year]={
      year,indexes:[],grossInterest:0,deductibleInterest:0,interest:0,
      additionalDeductibleOwnHomeCosts:0,deductibleOwnHomeCosts:0,ownershipMonths:0,
      months:0,eligibleMonths:0,taxBenefit:0,hillenRelief:0,box1Trace:null
    };
    const bucket=annualBuckets[year];
    const deductible=row.deductibleInterest!=null
      ?nonNegative(row.deductibleInterest)
      :(row.hraEligible===false?0:nonNegative(row.interest));
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
    const defaultRelief=core.hillenReliefForYear(bucket.year);
    const relief=clamp(yearValue(tax.hillenRelief,bucket.year,defaultRelief),0,1);
    const woz=nonNegative(yearValue(tax.wozValue,bucket.year,0));
    const ewfIncome=core.ewf2026(woz)*bucket.ownershipMonths/12;
    const additional=additionalCostsForYear(tax,bucket.year);
    const deductibleOwnHomeCosts=bucket.deductibleInterest+additional;
    const trace=ownHomeBox1Tax2026({
      enabled:tax.enabled!==false,
      box1IncomeBeforeOwnHome:yearValue(tax.box1IncomeBeforeOwnHome,bucket.year,NaN),
      ewfIncome,
      deductibleOwnHomeCosts,
      hillenRelief:relief,
      profile:tax.box1Profile||PROFILE,
      hasBox1LossCarry:Boolean(tax.hasBox1LossCarry),
      hasOtherRateAdjustedDeductions:Boolean(tax.hasOtherRateAdjustedDeductions),
      hasComplexFiscalPartnerAllocation:Boolean(tax.hasComplexFiscalPartnerAllocation),
      hasTransitionalDebt:Boolean(tax.hasTransitionalDebt)
    });
    if(!trace.supported)throw new RangeError(`Box 1 estimate unavailable: ${trace.unsupportedReasons.join(' ')}`);

    bucket.hillenRelief=relief;
    bucket.ewfIncome=ewfIncome;
    bucket.additionalDeductibleOwnHomeCosts=additional;
    bucket.deductibleOwnHomeCosts=deductibleOwnHomeCosts;
    bucket.taxBenefit=trace.taxBenefit;
    bucket.box1Trace=trace;
    Object.assign(bucket,{
      grossOwnHomeBalance:trace.grossOwnHomeBalance,
      hillenDeduction:trace.hillenDeduction,
      netOwnHomeIncome:trace.netOwnHomeIncome,
      incomeBeforeOwnHome:trace.incomeBeforeOwnHome,
      taxableIncomeAfterOwnHome:trace.taxableIncomeAfterOwnHome,
      taxBeforeOwnHome:trace.taxBeforeOwnHome,
      tableTaxAfterOwnHome:trace.tableTaxAfterOwnHome,
      highIncomeAdjustmentBase:trace.highIncomeAdjustmentBase,
      highIncomeAdjustment:trace.highIncomeAdjustment,
      taxAfterOwnHome:trace.taxAfterOwnHome
    });
    totalTaxBenefit+=trace.taxBenefit;

    if(!bucket.indexes.length)return;
    const positiveByInterest=trace.taxBenefit>=0&&bucket.deductibleInterest>0;
    const allocationIndexes=positiveByInterest
      ?bucket.indexes.filter(i=>nonNegative(resultRows[i].deductibleInterest)>0)
      :bucket.indexes;
    let allocated=0;
    allocationIndexes.forEach((rowIndex,position)=>{
      const row=resultRows[rowIndex];
      let share;
      if(position===allocationIndexes.length-1)share=trace.taxBenefit-allocated;
      else if(positiveByInterest)share=trace.taxBenefit*(nonNegative(row.deductibleInterest)/bucket.deductibleInterest);
      else share=trace.taxBenefit/allocationIndexes.length;
      allocated+=share;
      row.taxReturn=share;
    });
    bucket.indexes.forEach(rowIndex=>{
      const row=resultRows[rowIndex];
      row.net=number(row.gross)-number(row.taxReturn);
      row.cash=row.net+nonNegative(row.extra);
      row.cashWithRequestedExtra=row.net+nonNegative(row.requestedExtra??row.extra);
    });
  });

  return{
    rows:resultRows,
    annualBuckets,
    totalTaxBenefit,
    available:true,
    method:METHOD,
    ruleYear:POLICY.taxYear
  };
}

function taxFromPlanConfig(config={}){
  return normalizeTaxConfig({
    enabled:config.mortTaxEnabled!==false,
    calculationMode:config.box1CalculationMode,
    deductionRate:config.deductRate,
    wozValue:config.wozValue,
    hillenRelief:config.hillenRelief,
    box1IncomeBeforeOwnHome:config.box1IncomeBeforeOwnHome,
    box1Profile:config.box1Profile,
    additionalDeductibleOwnHomeCosts:config.additionalDeductibleOwnHomeCosts,
    hasBox1LossCarry:config.hasBox1LossCarry,
    hasOtherRateAdjustedDeductions:config.hasOtherRateAdjustedDeductions,
    hasComplexFiscalPartnerAllocation:config.hasComplexFiscalPartnerAllocation,
    hasTransitionalDebt:config.hasTransitionalDebt
  });
}

function applyExactMortgageResult(result,tax,core){
  if(!result||!Array.isArray(result.rows))return result;
  const allocation=allocateExactTax(result.rows,tax,core);
  return{
    ...result,
    rows:allocation.rows,
    annualTaxBuckets:allocation.annualBuckets,
    totalTaxBenefit:allocation.totalTaxBenefit,
    box1TaxAvailable:true,
    box1CalculationMode:allocation.method,
    box1RuleYear:allocation.ruleYear
  };
}

function applyExactPlanResult(result,tax,core){
  if(!result||!Array.isArray(result.schedule))return result;
  const allocation=allocateExactTax(result.schedule,tax,core);
  const yearBuckets={};
  Object.entries(result.yearBuckets||{}).forEach(([year,bucket])=>{
    const trace=allocation.annualBuckets[year];
    yearBuckets[year]=trace?{
      ...bucket,
      mortInterest:trace.grossInterest,
      deductibleInterest:trace.deductibleInterest,
      additionalDeductibleOwnHomeCosts:trace.additionalDeductibleOwnHomeCosts,
      deductibleOwnHomeCosts:trace.deductibleOwnHomeCosts,
      mortMonths:trace.ownershipMonths,
      mortTax:trace.taxBenefit,
      hillenRelief:trace.hillenRelief,
      ewfIncome:trace.ewfIncome,
      hillenDeduction:trace.hillenDeduction,
      highIncomeAdjustment:trace.highIncomeAdjustment,
      box1Trace:trace.box1Trace
    }:bucket;
  });
  return{
    ...result,
    schedule:allocation.rows,
    yearBuckets,
    annualTaxBuckets:allocation.annualBuckets,
    mortTax:allocation.totalTaxBenefit,
    netInterest:number(result.grossInterest)-allocation.totalTaxBenefit,
    box1TaxAvailable:true,
    box1CalculationMode:allocation.method,
    box1RuleYear:allocation.ruleYear
  };
}

function decorateFinanceCore(core){
  if(!core||core.__r66Stage4Box1)return core;
  const originalMortgageTaxBenefit=core.mortgageTaxBenefit.bind(core);
  const originalAllocateAnnualMortgageTax=core.allocateAnnualMortgageTax.bind(core);
  const originalMortgageSchedule=core.mortgageSchedule.bind(core);
  const originalSimulatePlan=core.simulatePlan.bind(core);

  core.BOX1_2026_PROFILE=PROFILE;
  core.progressiveBox1Tax2026=progressiveBox1Tax2026;
  core.ownHomeBox1Tax2026=ownHomeBox1Tax2026;

  core.mortgageTaxBenefit=function(config={}){
    const tax=normalizeTaxConfig(config);
    if(tax.calculationMode!=='box1-2026')return originalMortgageTaxBenefit(config);
    const ownedMonths=config.ownershipMonths==null?number(config.months):number(config.ownershipMonths);
    const relief=finite(config.hillenRelief)
      ?Number(config.hillenRelief)
      :core.hillenReliefForYear(config.year||POLICY.taxYear);
    const trace=ownHomeBox1Tax2026({
      enabled:config.enabled!==false,
      box1IncomeBeforeOwnHome:tax.box1IncomeBeforeOwnHome,
      ewfIncome:core.ewf2026(config.wozValue)*ownedMonths/12,
      deductibleOwnHomeCosts:nonNegative(config.interest)+nonNegative(config.additionalDeductibleOwnHomeCosts),
      hillenRelief:relief,
      profile:tax.box1Profile||PROFILE,
      hasBox1LossCarry:Boolean(tax.hasBox1LossCarry),
      hasOtherRateAdjustedDeductions:Boolean(tax.hasOtherRateAdjustedDeductions),
      hasComplexFiscalPartnerAllocation:Boolean(tax.hasComplexFiscalPartnerAllocation),
      hasTransitionalDebt:Boolean(tax.hasTransitionalDebt)
    });
    if(!trace.supported)throw new RangeError(`Box 1 estimate unavailable: ${trace.unsupportedReasons.join(' ')}`);
    return trace.taxBenefit;
  };

  core.allocateAnnualMortgageTax=function(rows=[],tax={}){
    const normalized=normalizeTaxConfig(tax);
    return normalized.calculationMode==='box1-2026'
      ?allocateExactTax(rows,normalized,core)
      :originalAllocateAnnualMortgageTax(rows,tax);
  };

  core.mortgageSchedule=function(config={}){
    const tax=normalizeTaxConfig(config.tax||{});
    const result=originalMortgageSchedule({...config,tax});
    return tax.calculationMode==='box1-2026'?applyExactMortgageResult(result,tax,core):result;
  };

  core.simulatePlan=function(config={}){
    const tax=taxFromPlanConfig(config);
    const result=originalSimulatePlan(config);
    return tax.calculationMode==='box1-2026'?applyExactPlanResult(result,tax,core):result;
  };

  Object.defineProperty(core,'__r66Stage4Box1',{value:true,enumerable:false});
  return core;
}

function decorateScenarioCore(scenarioCore){
  if(!scenarioCore||scenarioCore.__r66Stage4Box1)return scenarioCore;
  if(typeof scenarioCore.runScenario!=='function')throw new TypeError('ScenarioCore.runScenario is required.');
  const originalRunScenario=scenarioCore.runScenario.bind(scenarioCore);
  scenarioCore.runScenario=function(config={}){
    const context=normalizeTaxConfig(config.tax||{});
    return withTaxContext(context,()=>originalRunScenario(config));
  };
  Object.defineProperty(scenarioCore,'__r66Stage4Box1',{value:true,enumerable:false});
  return scenarioCore;
}

return{
  PROFILE,
  METHOD,
  progressiveBox1Tax2026,
  ownHomeBox1Tax2026,
  allocateExactTax,
  decorateFinanceCore,
  decorateScenarioCore,
  normalizeTaxConfig,
  withTaxContext
};
});
