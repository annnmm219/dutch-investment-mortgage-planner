(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.ModelContract=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';

function deepFreeze(value){
  if(!value||typeof value!=='object'||Object.isFrozen(value))return value;
  Object.getOwnPropertyNames(value).forEach(key=>deepFreeze(value[key]));
  return Object.freeze(value);
}

const RATE_CONVENTIONS=deepFreeze({
  mortgageInterest:{
    inputUnit:'percent-per-year',
    annualType:'nominal',
    monthlyConversion:'annual nominal rate divided by 12',
    formula:'r_month = r_nominal / 12',
    activeFrom:'existing engine'
  },
  investmentReturn:{
    inputUnit:'percent-per-year',
    annualType:'effective',
    monthlyConversion:'monthly equivalent of the effective annual rate',
    formula:'r_month = (1 + r_effective)^(1/12) - 1',
    activeFrom:'R6.6 Stage 2'
  },
  savingsYield:{
    inputUnit:'percent-per-year',
    annualType:'effective',
    monthlyConversion:'monthly equivalent of the effective annual yield',
    formula:'r_month = (1 + r_effective)^(1/12) - 1',
    activeFrom:'R6.6 Stage 2'
  },
  homeValueGrowth:{
    inputUnit:'percent-per-year',
    annualType:'effective',
    monthlyConversion:'monthly equivalent of effective annual growth',
    formula:'g_month = (1 + g_effective)^(1/12) - 1',
    activeFrom:'R6.6 Stage 2'
  },
  rentGrowth:{
    inputUnit:'percent-per-year',
    annualType:'effective',
    monthlyConversion:'monthly equivalent of effective annual growth',
    formula:'g_month = (1 + g_effective)^(1/12) - 1',
    activeFrom:'R6.6 Stage 2'
  },
  ownerCostGrowth:{
    inputUnit:'percent-per-year',
    annualType:'effective',
    monthlyConversion:'monthly equivalent of effective annual growth',
    formula:'g_month = (1 + g_effective)^(1/12) - 1',
    activeFrom:'R6.6 Stage 5'
  },
  box3DeemedReturns:{
    inputUnit:'annual statutory factor',
    annualType:'tax parameter',
    monthlyConversion:'none',
    formula:'annual factor applied to the relevant 1 January category value',
    activeFrom:'2026 policy module'
  }
});

const TRANSACTION_TIMING=deepFreeze({
  portfolioGrowth:'Applied to the opening monthly portfolio balance.',
  monthlyInvestment:'Added at the end of the month, after that month’s portfolio growth.',
  annualBonusInvestment:'Added at the end of the selected bonus month together with that month’s ordinary investment.',
  mortgageInterest:'Calculated on the opening monthly mortgage balance.',
  scheduledMortgagePayment:'Applied after monthly mortgage interest is calculated.',
  extraMortgageRepayment:'Applied after scheduled principal for the month.',
  annualBonusMortgage:'Applied as part of the extra repayment in the selected bonus month, after scheduled principal.',
  savingsInterest:'Credited on the opening monthly savings balance before that month’s savings cash flow.',
  box3DebtInterest:'Calculated on the opening monthly Box 3 debt balance before that month’s repayment.',
  box3Tax:'Settled after the final modeled month of a complete calendar year; incomplete final years remain unsettled.',
  purchaseCashEvent:'Applied at time zero before recurring monthly scenario cash flows and equalisation.'
});

const INPUT_SCHEMAS=deepFreeze({
  mortgageSchedule:{
    balance:{type:'number',required:true,min:0,unit:'EUR'},
    nominalAnnualInterestPct:{type:'number',required:true,min:0,max:100,unit:'percent-per-year'},
    termYears:{type:'number',required:true,exclusiveMin:0,max:100,unit:'years'},
    type:{type:'enum',required:true,values:['annuity','linear']},
    months:{type:'number',required:false,min:0,integer:true,unit:'months'}
  },
  investmentPlan:{
    initialPortfolio:{type:'number',required:true,min:0,unit:'EUR'},
    effectiveAnnualReturnPct:{type:'number',required:true,min:-100,max:100,exclusiveMin:-100,unit:'percent-per-year'},
    startYear:{type:'number',required:true,integer:true,min:2020,max:2100,unit:'calendar-year'},
    startMonth:{type:'number',required:true,integer:true,min:1,max:12,unit:'calendar-month'},
    phases:{type:'array',required:true,minLength:1}
  },
  box3Snapshot:{
    jan1Portfolio:{type:'number',required:true,min:0,unit:'EUR'},
    jan1Savings:{type:'number',required:true,min:0,unit:'EUR'},
    jan1Debt:{type:'number',required:true,min:0,unit:'EUR'}
  },
  purchaseScenario:{
    propertyPrice:{type:'number',required:true,exclusiveMin:0,unit:'EUR'},
    appraisedValue:{type:'number',required:false,exclusiveMin:0,unit:'EUR'},
    availableSavings:{type:'number',required:true,min:0,unit:'EUR'},
    downPayment:{type:'number',required:true,min:0,unit:'EUR'},
    nominalAnnualMortgageRatePct:{type:'number',required:true,min:0,max:100,unit:'percent-per-year'},
    mortgageTermYears:{type:'number',required:true,exclusiveMin:0,max:100,unit:'years'},
    mortgageType:{type:'enum',required:true,values:['annuity','linear']}
  }
});

class ModelInputError extends Error{
  constructor(errors){
    const list=Array.isArray(errors)?errors:[];
    super(list.map(error=>`${error.path}: ${error.message}`).join('; ')||'Invalid model input');
    this.name='ModelInputError';
    this.errors=list;
  }
}

function isMissing(value){return value===null||value===undefined||value==='';}

function finiteNumber(value){
  if(isMissing(value))return{ok:false,code:'required'};
  const parsed=typeof value==='number'?value:Number(value);
  if(!Number.isFinite(parsed))return{ok:false,code:'not-finite'};
  return{ok:true,value:parsed};
}

function validateField(raw,spec={},path='value'){
  const errors=[];
  if(isMissing(raw)){
    if(spec.required)errors.push({path,code:'required',message:'A value is required.'});
    return{valid:errors.length===0,value:null,errors};
  }

  if(spec.type==='boolean'){
    if(typeof raw!=='boolean')errors.push({path,code:'type',message:'Expected a boolean value.'});
    return{valid:errors.length===0,value:errors.length?null:raw,errors};
  }

  if(spec.type==='enum'){
    if(!spec.values?.includes(raw))errors.push({path,code:'enum',message:`Expected one of: ${(spec.values||[]).join(', ')}.`});
    return{valid:errors.length===0,value:errors.length?null:raw,errors};
  }

  if(spec.type==='array'){
    if(!Array.isArray(raw))errors.push({path,code:'type',message:'Expected an array.'});
    else if(spec.minLength!=null&&raw.length<spec.minLength)errors.push({path,code:'min-length',message:`Expected at least ${spec.minLength} item(s).`});
    return{valid:errors.length===0,value:errors.length?null:raw,errors};
  }

  const parsed=finiteNumber(raw);
  if(!parsed.ok){
    errors.push({path,code:parsed.code,message:parsed.code==='required'?'A value is required.':'Enter a finite number.'});
    return{valid:false,value:null,errors};
  }
  const value=parsed.value;
  if(spec.integer&&!Number.isInteger(value))errors.push({path,code:'integer',message:'Enter a whole number.'});
  if(spec.min!=null&&value<spec.min)errors.push({path,code:'min',message:`Value must be at least ${spec.min}.`});
  if(spec.exclusiveMin!=null&&value<=spec.exclusiveMin)errors.push({path,code:'exclusive-min',message:`Value must be greater than ${spec.exclusiveMin}.`});
  if(spec.max!=null&&value>spec.max)errors.push({path,code:'max',message:`Value must be no more than ${spec.max}.`});
  return{valid:errors.length===0,value:errors.length?null:value,errors};
}

function validateObject(input={},schema={},prefix=''){
  const values={};
  const errors=[];
  Object.entries(schema).forEach(([key,spec])=>{
    const path=prefix?`${prefix}.${key}`:key;
    const result=validateField(input?.[key],spec,path);
    if(result.valid)values[key]=result.value;
    else errors.push(...result.errors);
  });
  return{valid:errors.length===0,value:errors.length?null:values,errors};
}

function validateNamedSchema(name,input){
  const schema=INPUT_SCHEMAS[name];
  if(!schema)throw new RangeError(`Unknown model schema: ${name}`);
  return validateObject(input,schema,name);
}

function assertValid(name,input){
  const result=validateNamedSchema(name,input);
  if(!result.valid)throw new ModelInputError(result.errors);
  return result.value;
}

function percentToDecimal(percent){
  const parsed=finiteNumber(percent);
  if(!parsed.ok)throw new TypeError('Percent must be a finite number.');
  return parsed.value/100;
}

function decimalToPercent(decimal){
  const parsed=finiteNumber(decimal);
  if(!parsed.ok)throw new TypeError('Rate must be a finite number.');
  return parsed.value*100;
}

function nominalAnnualToMonthly(annualRateDecimal){
  const parsed=finiteNumber(annualRateDecimal);
  if(!parsed.ok)throw new TypeError('Nominal annual rate must be a finite number.');
  return parsed.value/12;
}

function effectiveAnnualToMonthly(annualRateDecimal){
  const parsed=finiteNumber(annualRateDecimal);
  if(!parsed.ok)throw new TypeError('Effective annual rate must be a finite number.');
  if(parsed.value<=-1)throw new RangeError('Effective annual rate must be greater than -100%.');
  return Math.expm1(Math.log1p(parsed.value)/12);
}

function monthlyToEffectiveAnnual(monthlyRateDecimal){
  const parsed=finiteNumber(monthlyRateDecimal);
  if(!parsed.ok)throw new TypeError('Monthly rate must be a finite number.');
  if(parsed.value<=-1)throw new RangeError('Monthly rate must be greater than -100%.');
  return Math.expm1(Math.log1p(parsed.value)*12);
}

return{
  RATE_CONVENTIONS,
  TRANSACTION_TIMING,
  INPUT_SCHEMAS,
  ModelInputError,
  deepFreeze,
  isMissing,
  finiteNumber,
  validateField,
  validateObject,
  validateNamedSchema,
  assertValid,
  percentToDecimal,
  decimalToPercent,
  nominalAnnualToMonthly,
  effectiveAnnualToMonthly,
  monthlyToEffectiveAnnual
};
});
