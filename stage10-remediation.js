(function(root,factory){
  const FC=typeof module==='object'&&module.exports?require('./finance-core.js'):root.FinanceCore;
  const PR=typeof module==='object'&&module.exports?require('./purchase-rules.js'):root.PurchaseRules;
  const SC=typeof module==='object'&&module.exports?require('./scenario-engine.js'):root.ScenarioCore;
  const OI=typeof module==='object'&&module.exports?require('./output-integrity.js'):root.OutputIntegrity;
  const S91=typeof module==='object'&&module.exports?require('./stage9-1-remediation.js'):root.Stage91Remediation;
  const api=factory(FC,PR,SC,OI,S91,root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.Stage10Remediation=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(FC,PR,SC,OI,S91,root){
'use strict';
if(!FC||!PR||!SC||!OI||!S91)throw new Error('Stage 10 requires FinanceCore, PurchaseRules, ScenarioCore, OutputIntegrity and Stage91Remediation');

const VERSION='R6.6-stage10';
const NHG_STANDARD=470000;
const NHG_ENERGY=498200;
const NHG_FEE=.004;
const OWN_USE_RATE_2026=.0506;
const TOL=.005;
const nonNegative=v=>Math.max(0,Number(v)||0);
const finiteOrNull=v=>(v===null||v===undefined||v==='')?null:(Number.isFinite(Number(v))?Number(v):null);
const finite=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,finite(v,a)));
const clone=v=>JSON.parse(JSON.stringify(v||{}));
const isPurchase=mode=>mode==='buy-rent'||mode==='downpayment';

function normalizePropertyUse(value){return value==='non-main'?'non-main':value==='main-residence'?'main-residence':null;}
function inferredPropertyUse(rules={}){
  const explicit=normalizePropertyUse(rules.propertyUse);if(explicit)return explicit;
  if(['other-home','other-real-estate'].includes(rules.transferTaxMode))return'non-main';
  if(['main','starter'].includes(rules.transferTaxMode))return'main-residence';
  return null;
}
function isNonMain(config={}){return inferredPropertyUse(config.purchaseRules||config)==='non-main';}
function propertyTransferTaxAlignment(propertyUse,transferTaxMode){
  const use=normalizePropertyUse(propertyUse),mode=String(transferTaxMode||'main');
  if(!use)return{valid:false,reason:'Choose whether the purchased property is your main residence or a non-main property.'};
  if(mode==='manual')return{valid:true};
  if(use==='main-residence'&&!['main','starter'].includes(mode))return{valid:false,reason:'Main-residence property classification conflicts with the selected non-main-residence transfer-tax treatment.'};
  if(use==='non-main'&&!['other-home','other-real-estate'].includes(mode))return{valid:false,reason:'Non-main property classification conflicts with the selected main-residence/starter transfer-tax treatment. Use the matching non-main rate or Manual amount.'};
  return{valid:true};
}
function nhg2026Exact({purchasePrice=0,appraisedValue=0,mortgageAmount=0,mode='none',qualifyingEnergyExpenditure=0,nonEnergyCostStack=null}={}){
  const purchase=nonNegative(purchasePrice),appraisal=nonNegative(appraisedValue)||purchase,loan=nonNegative(mortgageAmount);
  const energy=mode==='energy',enabled=mode==='standard'||energy,energySpend=energy?nonNegative(qualifyingEnergyExpenditure):0,stack=finiteOrNull(nonEnergyCostStack);
  const referenceValues=[purchase,appraisal].filter(x=>x>0),referenceValue=referenceValues.length?Math.min(...referenceValues):0;
  if(!enabled)return{enabled:false,eligible:false,energy:false,limit:0,fee:0,referenceValue,nonEnergyCostStack:stack,totalCostStack:stack,qualifyingEnergyExpenditure:energySpend,warning:''};
  const costStackKnown=stack!==null&&stack>=0,nonEnergyLoan=Math.max(0,loan-energySpend),totalCostStack=costStackKnown?stack+energySpend:null;
  const eligibleByNonEnergyCost=costStackKnown&&stack<=NHG_STANDARD+TOL;
  const eligibleByTotalCost=costStackKnown&&(energy?totalCostStack<=NHG_ENERGY+TOL:stack<=NHG_STANDARD+TOL);
  const eligibleByNonEnergyLoan=nonEnergyLoan<=NHG_STANDARD+TOL,eligibleByTotalLoan=loan<=(energy?NHG_ENERGY:NHG_STANDARD)+TOL;
  const requiredEnergyExpenditure=energy?Math.max(0,loan-NHG_STANDARD):0,eligibleByEnergySpend=!energy||energySpend+TOL>=requiredEnergyExpenditure;
  const eligible=costStackKnown&&eligibleByNonEnergyCost&&eligibleByTotalCost&&eligibleByNonEnergyLoan&&eligibleByTotalLoan&&eligibleByEnergySpend;
  let warning='';
  if(!costStackKnown)warning='Enter the official NHG non-energy cost stack (items a–g) before NHG eligibility can be assessed.';
  else if(!eligibleByNonEnergyCost)warning=`NHG is unavailable because the non-energy cost stack is €${Math.round(stack).toLocaleString('nl-NL')}, above the 2026 €470,000 limit. Energy measures cannot raise this a–g limit.`;
  else if(!eligibleByTotalCost)warning=`NHG is unavailable because the total cost stack including qualifying energy measures exceeds €${NHG_ENERGY.toLocaleString('nl-NL')}.`;
  else if(!eligibleByNonEnergyLoan)warning=`NHG is unavailable because the non-energy part of the loan exceeds €${NHG_STANDARD.toLocaleString('nl-NL')}.`;
  else if(!eligibleByTotalLoan)warning=`The mortgage exceeds the ${energy?'energy-enhanced ':''}2026 NHG loan limit of €${(energy?NHG_ENERGY:NHG_STANDARD).toLocaleString('nl-NL')}.`;
  else if(!eligibleByEnergySpend)warning=`At least €${Math.ceil(requiredEnergyExpenditure).toLocaleString('nl-NL')} of the mortgage above €470,000 must be fully allocated to qualifying energy measures.`;
  return{enabled:true,eligible,energy,limit:energy?NHG_ENERGY:NHG_STANDARD,fee:eligible?loan*NHG_FEE:0,feeRate:NHG_FEE,referenceValue,nonEnergyCostStack:stack,totalCostStack,qualifyingEnergyExpenditure:energySpend,nonEnergyLoan,requiredEnergyExpenditure,costStackKnown,eligibleByNonEnergyCost,eligibleByTotalCost,eligibleByNonEnergyLoan,eligibleByTotalLoan,eligibleByEnergySpend,warning};
}
function calculateScenarioPurchase2026(input={}){
  const price=nonNegative(input.housePrice),cash=nonNegative(input.availableSavings),appraisal=nonNegative(input.appraisedValue)||price,down=nonNegative(input.downPayment),base=nonNegative(input.baseCosts),energySpend=input.nhgMode==='energy'?nonNegative(input.qualifyingEnergyExpenditure):0,errors=[];
  if(price<=0)errors.push({code:'property-price-required',message:'Enter a property price greater than zero.'});
  if(down>price+TOL)errors.push({code:'buyer-cash-exceeds-price',message:`Buyer cash toward the purchase price exceeds the property price by ${(down-price).toFixed(2)}.`});
  const appraisalGap=Math.max(0,price-appraisal);if(down+TOL<appraisalGap)errors.push({code:'appraisal-gap-unfunded',message:`The purchase price is €${Math.round(appraisalGap).toLocaleString('nl-NL')} above the appraised value. Fund at least that appraisal gap explicitly with buyer cash.`});
  const transferTaxBase=Math.max(price,appraisal),requested=['main','starter','other-home','other-real-estate','manual'].includes(input.transferTaxMode)?input.transferTaxMode:'main';let effective=requested,starterEligibility=null;
  if(requested==='starter'){starterEligibility=PR.starterEligibility2026({buyerAge:input.buyerAge,mainResidence:input.starterMainResidence!==false,exemptionUnused:input.starterExemptionUnused!==false,propertyValue:transferTaxBase});if(!starterEligibility.eligible)effective=starterEligibility.residenceEligible?'main':'other-home';}
  const transferTax=PR.transferTax2026({propertyValue:transferTaxBase,mode:effective,manualAmount:input.manualTransferTax});transferTax.requestedMode=requested;transferTax.effectiveMode=effective;transferTax.starterEligibility=starterEligibility;
  if(requested==='starter'&&!starterEligibility?.eligible)transferTax.warning=`Starter exemption not applied: ${starterEligibility.reasons.join('; ')}. ${effective==='other-home'?'The 8% residential non-main-residence rate is used.':'The 2% main-residence rate is used.'}`;
  const baseMortgage=Math.max(0,price-Math.min(price,down)),mortgageProceeds=baseMortgage+energySpend,supportedEnergyAboveAppraisal=input.nhgMode==='energy'?Math.min(energySpend,appraisal*.06):0,supportedLtvLoan=appraisal+supportedEnergyAboveAppraisal;
  if(mortgageProceeds>supportedLtvLoan+TOL)errors.push({code:'mortgage-above-supported-ltv',message:`The planned mortgage is €${Math.round(mortgageProceeds-supportedLtvLoan).toLocaleString('nl-NL')} above the supported appraisal-based financing limit. Increase buyer cash or reduce the mortgage.`});
  const nhg=nhg2026Exact({purchasePrice:price,appraisedValue:appraisal,mortgageAmount:mortgageProceeds,mode:input.nhgMode,qualifyingEnergyExpenditure:energySpend,nonEnergyCostStack:input.nhgNonEnergyCostStack});
  if(nhg.enabled&&!nhg.eligible)errors.push({code:'nhg-ineligible',message:nhg.warning||'The selected NHG route is not eligible for these scenario inputs.'});
  const nhgFee=nhg.fee,totalCosts=base+transferTax.amount+nhgFee,buyerCashForCosts=totalCosts,totalBuyerCash=down+buyerCashForCosts,totalUses=price+energySpend+totalCosts,totalSources=mortgageProceeds+totalBuyerCash,identityDifference=totalSources-totalUses,fundingShortfall=Math.max(0,totalBuyerCash-cash),remainingSavings=Math.max(0,cash-totalBuyerCash);
  if(fundingShortfall>TOL)errors.push({code:'purchase-cash-shortfall',message:`Starting savings are ${fundingShortfall.toFixed(2)} below the complete cash-at-closing requirement.`});
  if(Math.abs(identityDifference)>TOL)errors.push({code:'sources-uses-mismatch',message:`Purchase sources and uses differ by ${Math.abs(identityDifference).toFixed(2)}.`});
  const ltv=PR.ltv2026({mortgageAmount:mortgageProceeds,appraisedValue:appraisal});ltv.supportedEnergyAboveAppraisal=supportedEnergyAboveAppraisal;ltv.supportedLoanLimit=supportedLtvLoan;ltv.overSupportedLimit=mortgageProceeds>supportedLtvLoan+TOL;
  const warnings=[transferTax.warning,nhg.warning,ltv.overStandardLimit&&!ltv.overSupportedLimit?'Mortgage exceeds 100% of appraisal only through the entered qualifying energy-finance allowance.':ltv.warning].filter(Boolean);
  return{source:'scenario-local-2026-rules-stage10',valid:errors.length===0,propertyPrice:price,appraisedValue:appraisal,availableSavings:cash,baseCosts:base,transferTaxBase,transferTax,nhg,nhgFee,nhgNonEnergyCostStack:nhg.nonEnergyCostStack,qualifyingEnergyExpenditure:energySpend,transactionCosts:totalCosts,totalCosts,buyerCashTowardPrice:down,buyerCashForCosts,totalBuyerCash,mortgageProceeds,totalUses,totalSources,identityDifference,remainingSavings,fundingShortfall,shortfall:fundingShortfall,funded:fundingShortfall<=TOL,appraisalGap,minimumBuyerCashForAppraisalGap:appraisalGap,ltv,warnings,errors};
}
function unsupportedStandaloneNhg(prior,input={}){
  const mode=['standard','energy'].includes(input.nhgMode)?input.nhgMode:'none';
  if(mode==='none')return prior(input);
  if(finiteOrNull(input.nhgNonEnergyCostStack)!==null)return prior(input);
  const base=prior({...input,nhgMode:'none'}),energy=mode==='energy';
  return{...base,nhg:{enabled:true,eligible:false,energy,limit:energy?NHG_ENERGY:NHG_STANDARD,fee:0,warning:'Exact NHG eligibility requires the official non-energy cost stack (items a–g) and, for the enhanced route, qualifying energy expenditure. Use the Scenario purchase-rule section for this exact check.'},nhgFee:0};
}
function ownerCostMode(config={}){return config.ownerCostMode?(config.ownerCostMode==='itemized'?'itemized':'total'):(config.ownerCostTotalMonthly==null?'itemized':'total');}
function annualGroundLeaseByYear(config={},months=0){
  const result={};if(ownerCostMode(config)!=='itemized')return result;
  const base=nonNegative(config.groundLeaseAnnual)/12,g=FC.effectiveAnnualPctToMonthly(config.ownerCostGrowthPct||0);let year=finite(config.startYear,2026),month=clamp(config.startMonth||1,1,12);
  for(let i=0;i<Math.max(0,Math.round(months));i++){result[year]=(result[year]||0)+base*Math.pow(1+g,i);month++;if(month===13){month=1;year++;}}
  return result;
}
function purchaseFundingForCall(config={},callIndex=0){
  if(!isPurchase(config.mode))return null;const d=config.mode==='buy-rent'?config.buyRent:config.downpayment,down=config.mode==='buy-rent'?d?.downPayment:(callIndex===0?d?.downA:d?.downB);
  return calculateScenarioPurchase2026({housePrice:d?.price,downPayment:down,availableSavings:d?.cash??config.box3?.savings,baseCosts:d?.purchaseCosts,transferTaxMode:config.purchaseRules?.transferTaxMode,manualTransferTax:config.purchaseRules?.manualTransferTax,appraisedValue:config.purchaseRules?.appraisedValue,nhgMode:config.purchaseRules?.nhgMode,buyerAge:config.purchaseRules?.buyerAge,starterMainResidence:config.purchaseRules?.starterMainResidence,starterExemptionUnused:config.purchaseRules?.starterExemptionUnused,qualifyingEnergyExpenditure:config.purchaseRules?.qualifyingEnergyExpenditure,nhgNonEnergyCostStack:config.purchaseRules?.nhgNonEnergyCostStack});
}
function additionalDeductibleCostsByYear(config={},months=0,mortgageCallIndex=0){
  const out=annualGroundLeaseByYear(config,months),existing=config.tax?.additionalDeductibleOwnHomeCosts,years=Object.keys(out);
  if(existing&&typeof existing==='object'&&!Array.isArray(existing))Object.entries(existing).forEach(([year,value])=>{out[year]=(out[year]||0)+nonNegative(value);});
  else if(Number.isFinite(Number(existing)))years.forEach(year=>{out[year]=(out[year]||0)+nonNegative(existing);});
  if(isPurchase(config.mode)&&inferredPropertyUse(config.purchaseRules)==='main-residence'){
    const funding=purchaseFundingForCall(config,mortgageCallIndex),firstYear=String(finite(config.startYear,2026)),explicit=nonNegative(config.purchaseRules?.deductibleFinancingCosts),nhgFee=nonNegative(funding?.nhgFee);out[firstYear]=(out[firstYear]||0)+explicit+nhgFee;
  }
  return out;
}
function propertyIncomeSchedule(config={},months=0){
  const rules=config.purchaseRules||{},annualRent=nonNegative(rules.grossRentalIncomeAnnual),incomeGrowth=finite(rules.propertyIncomeGrowthPct,0),monthlyGrowth=FC.effectiveAnnualPctToMonthly(incomeGrowth),baseMonthly=annualRent/12,monthly=[],rentalByYear={};let year=finite(config.startYear,2026),month=clamp(config.startMonth||1,1,12);
  for(let i=0;i<Math.max(0,Math.round(months));i++){const amount=baseMonthly*Math.pow(1+monthlyGrowth,i);monthly.push(amount);rentalByYear[year]=(rentalByYear[year]||0)+amount;month++;if(month===13){month=1;year++;}}
  const ownUseByYear={},days=clamp(rules.privateUseDays??0,0,365),woz=nonNegative(rules.privateUseWozValue),homeGrowth=finite(config.homeGrowthPct,0);
  Object.keys(rentalByYear).forEach((yearKey,index)=>{ownUseByYear[yearKey]=days>0?woz*Math.pow(1+homeGrowth/100,index)*OWN_USE_RATE_2026*(days/365):0;});
  return{monthly,rentalByYear,ownUseByYear};
}
function isPropertyInvestmentCall(config={},callIndex=0){if(!isPurchase(config.mode)||inferredPropertyUse(config.purchaseRules)!=='non-main')return false;return config.mode==='buy-rent'?callIndex===0:(config.mode==='downpayment'&&(callIndex===0||callIndex===1));}
function releaseIdentity(identity=root?.__DIMP_RELEASE_IDENTITY){const sha=String(identity?.calculationSourceSha||'').trim().toLowerCase(),valid=/^[0-9a-f]{40}$/.test(sha);return{valid,calculationSourceSha:valid?sha:null,buildId:String(identity?.buildId||'').trim()||null,status:valid?'frozen':'unfrozen'};}
function releaseIdentityRows(identity=root?.__DIMP_RELEASE_IDENTITY){const id=releaseIdentity(identity);return[['Model','Calculation source commit',id.calculationSourceSha||'UNFROZEN'],['Model','Build identity',id.buildId||'UNFROZEN']];}

let activeRun=null,activeInvestment=null;
function invalidScenario(reason,mode=''){
  const names=mode==='buy-rent'?['Buy home','Rent + invest']:mode==='downpayment'?['Larger down payment','Smaller down payment']:['Strategy A','Strategy B'],blank=name=>({name,net:0,invest:0,savings:0,box3Debt:0,financial:0,mortgage:0,interest:0,mortTax:0,rent:0,owner:0,purchase:0,box3:0,unsettledBox3:0,externalTax:0,externalDebtRepayment:0,box3DebtInterest:0,short:0,label:'Comparison unavailable'});
  return{valid:false,status:'stage10-blocked',reason:String(reason),A:blank(names[0]),B:blank(names[1]),note:String(reason),cashA:[],cashB:[],budgetSeries:[],peakRequirement:0,firstRequirement:0,stage10Blocked:true};
}
function validateStage10Config(config={}){
  if(!isPurchase(config.mode))return{valid:true};const rules=config.purchaseRules||{},use=inferredPropertyUse(rules),alignment=propertyTransferTaxAlignment(use,rules.transferTaxMode);
  if(!use)return{valid:false,reason:'Comparison unavailable: choose the property income-tax classification.'};if(!alignment.valid)return{valid:false,reason:`Comparison unavailable: ${alignment.reason}`};
  if(rules.nhgMode&&rules.nhgMode!=='none'&&finiteOrNull(rules.nhgNonEnergyCostStack)===null)return{valid:false,reason:'Comparison unavailable: enter the official NHG non-energy cost stack (items a–g).'};
  const d=config.mode==='buy-rent'?config.buyRent:config.downpayment;
  if(use==='main-residence'){
    if(nonNegative(rules.deductibleFinancingCosts)>nonNegative(d?.purchaseCosts)+TOL)return{valid:false,reason:'Comparison unavailable: the deductible financing-cost subset cannot exceed the entered other purchase and financing costs.'};
    return{valid:true};
  }
  const boxMode=config.box3?.mode||'none';
  if(boxMode==='future'||boxMode==='transition')return{valid:false,reason:'Tax-adjusted non-main-property scenarios are unavailable for proposed/transition Box 3 because the current bill uses a real-estate-specific capital-gains/direct-return structure that this release does not model.'};
  if(boxMode==='current'){
    if(finiteOrNull(rules.grossRentalIncomeAnnual)===null)return{valid:false,reason:'Comparison unavailable: enter gross annual rent/pacht income for the non-main property (0 is allowed).'};
    if(finiteOrNull(rules.privateUseDays)===null)return{valid:false,reason:'Comparison unavailable: enter annual private-use days for the non-main property (0 is allowed).'};
    const days=Number(rules.privateUseDays);if(days<0||days>365)return{valid:false,reason:'Comparison unavailable: private-use days must be between 0 and 365.'};
    if(days>0&&nonNegative(rules.privateUseWozValue)<=0)return{valid:false,reason:'Comparison unavailable: enter the relevant prior-year WOZ value to calculate the 2026 5.06% private-use addition.'};
  }
  return{valid:true};
}
function installPatches(){
  if(SC.__stage10Patched)return;
  const priorResolve=SC.resolveScenarioInputSource.bind(SC),priorRun=SC.runScenario.bind(SC),priorSim=FC.simulateInvestmentFlows.bind(FC),priorTax=FC.box3TaxForYear.bind(FC),priorMortgage=FC.mortgageSchedule.bind(FC),priorCanonicalRows=OI.canonicalExportRows.bind(OI),priorMainPurchase=PR.calculatePurchase2026.bind(PR);
  PR.nhg2026=nhg2026Exact;
  PR.calculatePurchase2026=function(input={}){return unsupportedStandaloneNhg(priorMainPurchase,input);};
  PR.calculateScenarioPurchase2026=function(input={}){
    const merged={...input};
    if(activeRun&&isPurchase(activeRun.config.mode)){
      const rules=activeRun.config.purchaseRules||{};
      if(merged.qualifyingEnergyExpenditure==null)merged.qualifyingEnergyExpenditure=rules.qualifyingEnergyExpenditure;
      if(merged.nhgNonEnergyCostStack==null)merged.nhgNonEnergyCostStack=rules.nhgNonEnergyCostStack;
    }
    return calculateScenarioPurchase2026(merged);
  };
  SC.resolveScenarioInputSource=function(args={}){
    const resolved=priorResolve(args),rules={...(resolved.purchaseRules||{})};
    if(typeof document!=='undefined'){
      const $=id=>document.getElementById(id),n=id=>finiteOrNull($(id)?.value);rules.propertyUse=normalizePropertyUse($('scenarioPropertyUseNew')?.value)||inferredPropertyUse(rules);rules.starterMainResidence=rules.propertyUse==='main-residence';rules.deductibleFinancingCosts=nonNegative(n('scenarioDeductibleFinancingCostsNew'));rules.nhgNonEnergyCostStack=n('scenarioNhgNonEnergyCostStackNew');rules.grossRentalIncomeAnnual=n('scenarioPropertyRentalIncomeNew');rules.privateUseDays=n('scenarioPropertyPrivateUseDaysNew');rules.privateUseWozValue=n('scenarioPropertyPrivateUseWozNew');rules.propertyIncomeGrowthPct=finite(n('scenarioPropertyIncomeGrowthNew'),0);
    }else{rules.propertyUse=normalizePropertyUse(rules.propertyUse)||inferredPropertyUse(rules);if(rules.propertyUse)rules.starterMainResidence=rules.propertyUse==='main-residence';}
    resolved.purchaseRules=rules;return resolved;
  };
  FC.box3TaxForYear=function(args={}){
    if(!activeInvestment||args.regime!=='current')return priorTax(args);const year=activeInvestment.currentYear++,rental=nonNegative(activeInvestment.rentalByYear[year]),ownUse=nonNegative(activeInvestment.ownUseByYear[year]),adjusted={...args,savingsIncome:finite(args.savingsIncome,0)+rental+ownUse},result=priorTax(adjusted);return{...result,propertyRentalIncome:rental,propertyOwnUseAddition:ownUse,propertyDirectReturn:rental+ownUse};
  };
  FC.simulateInvestmentFlows=function(args={}){
    if(!activeRun)return priorSim(args);const callIndex=activeRun.investmentCall++;if(!isPropertyInvestmentCall(activeRun.config,callIndex))return priorSim(args);
    const base=Array.isArray(args.flows)?args.flows:[],schedule=propertyIncomeSchedule(activeRun.config,base.length),flows=base.map((value,index)=>finite(value,0)+nonNegative(schedule.monthly[index])),previous=activeInvestment;activeInvestment={rentalByYear:schedule.rentalByYear,ownUseByYear:schedule.ownUseByYear,currentYear:finite(args.startYear,activeRun.config.startYear||2026)};
    try{const result=priorSim({...args,flows});Object.entries(result.yearBuckets||{}).forEach(([year,bucket])=>{bucket.propertyRentalIncome=nonNegative(schedule.rentalByYear[year]);bucket.propertyOwnUseAddition=nonNegative(schedule.ownUseByYear[year]);bucket.propertyDirectReturn=bucket.propertyRentalIncome+bucket.propertyOwnUseAddition;});result.propertyRentalIncome=Object.values(schedule.rentalByYear).reduce((s,x)=>s+nonNegative(x),0);result.propertyOwnUseAddition=Object.values(schedule.ownUseByYear).reduce((s,x)=>s+nonNegative(x),0);return result;}finally{activeInvestment=previous;}
  };
  FC.mortgageSchedule=function(args={}){
    if(!activeRun)return priorMortgage(args);const config=activeRun.config,use=isPurchase(config.mode)?inferredPropertyUse(config.purchaseRules):'main-residence',callIndex=activeRun.mortgageCall++;if(use==='non-main')return priorMortgage(args);
    const months=args.months==null?Math.max(1,Math.round((Number(args.termYears)||30)*12)):Math.max(0,Math.round(Number(args.months)||0)),additional=additionalDeductibleCostsByYear(config,months,callIndex);return priorMortgage({...args,tax:{...(args.tax||{}),additionalDeductibleOwnHomeCosts:additional}});
  };
  SC.runScenario=function(config={}){
    const prepared=clone(config),rules={...(prepared.purchaseRules||{})};if(isPurchase(prepared.mode)){rules.propertyUse=normalizePropertyUse(rules.propertyUse)||inferredPropertyUse(rules);if(rules.propertyUse)rules.starterMainResidence=rules.propertyUse==='main-residence';prepared.purchaseRules=rules;const check=validateStage10Config(prepared);if(!check.valid)return invalidScenario(check.reason,prepared.mode);}
    const previous=activeRun;activeRun={config:prepared,investmentCall:0,mortgageCall:0};try{return priorRun(prepared);}finally{activeRun=previous;}
  };
  OI.canonicalExportRows=function(args={}){return[...releaseIdentityRows(),...priorCanonicalRows(args)];};
  Object.defineProperty(SC,'__stage10Patched',{value:true,enumerable:false});
}
function browserBoot(){
  if(typeof document==='undefined')return;const $=id=>document.getElementById(id),engine=$('decisionEngine');if(!engine)return;const rulesBody=$('scenarioPurchaseRulesNew')?.querySelector('.inner-fold-body');
  if(rulesBody&&!$('scenarioStage10PropertyBlock')){
    const block=document.createElement('div');block.id='scenarioStage10PropertyBlock';block.className='stage10-property-block';block.innerHTML=`<p class="subsection-title">Property tax classification and deductible costs</p><div class="grid3 advanced-grid"><div class="field"><label for="scenarioPropertyUseNew">Property income-tax classification</label><select id="scenarioPropertyUseNew" required><option value="main-residence" selected>Main residence / own home (Box 1)</option><option value="non-main">Non-main property / other real estate (Box 3)</option></select><p class="inline">Independent from the transfer-tax amount. Manual transfer tax does not decide Box 1 versus Box 3.</p><p class="stage91-source scenario-source-tag" data-source-for="scenarioPropertyUseNew">Entered here</p></div><div class="field"><label for="scenarioDeductibleFinancingCostsNew">Deductible financing costs within “other purchase costs”</label><input id="scenarioDeductibleFinancingCostsNew" type="number" min="0" step="100" value="0"><p class="inline">Main residence only. Enter only the qualifying subset, such as mortgage advice/intermediation, mortgage-deed notary and valuation costs. The calculated NHG fee is added automatically.</p><p class="stage91-source scenario-source-tag" data-source-for="scenarioDeductibleFinancingCostsNew">Entered here</p></div><div class="field hidden" id="scenarioNhgNonEnergyCostStackField"><label for="scenarioNhgNonEnergyCostStackNew">NHG non-energy cost stack (official a–g total)</label><input id="scenarioNhgNonEnergyCostStackNew" type="number" min="0" step="100" placeholder="Required when NHG is selected"><p class="inline">2026 NHG requires a–g ≤ €470,000. Qualifying energy measures are item h and can lift a–h only to €498,200.</p><p class="stage91-source scenario-source-tag" data-source-for="scenarioNhgNonEnergyCostStackNew">Entered here</p></div></div><div id="scenarioNonMainReturnFields" class="hidden"><p class="subsection-title">2026 current-law actual return for non-main property</p><p class="subsection-copy">Actual return includes property value change, gross rent/pacht received, Box 3 debt interest, and from 2026 an own-use addition when the property is available for private use. The fixed 5.06% own-use route is modeled below.</p><div class="grid4 advanced-grid"><div class="field"><label for="scenarioPropertyRentalIncomeNew">Gross annual rent / pacht income</label><input id="scenarioPropertyRentalIncomeNew" type="number" min="0" step="100" value="0"><p class="inline">Before property operating costs; those costs are not deducted from current-law actual Box 3 return.</p></div><div class="field"><label for="scenarioPropertyIncomeGrowthNew">Effective annual rental-income growth %</label><input id="scenarioPropertyIncomeGrowthNew" type="number" min="-20" max="30" step="0.25" value="0"><p class="inline">Planning assumption. Gross rent is modeled as received monthly and retained/invested.</p></div><div class="field"><label for="scenarioPropertyPrivateUseDaysNew">Private-use availability, days/year</label><input id="scenarioPropertyPrivateUseDaysNew" type="number" min="0" max="365" step="1" value="0"><p class="inline">Days available for private use, excluding days rented/leased or unavailable during qualifying construction/renovation.</p></div><div class="field" id="scenarioPropertyPrivateUseWozField"><label for="scenarioPropertyPrivateUseWozNew">WOZ for 5.06% own-use addition</label><input id="scenarioPropertyPrivateUseWozNew" type="number" min="0" step="1000" placeholder="Required if private-use days > 0"><p class="inline">For 2026 use the WOZ with value date 1 January 2025. Later current-rule sensitivity years grow this planning base with the entered home-value growth.</p></div></div><div class="callout warn" id="scenarioNonMainFutureWarning"><strong>Proposed/transition Box 3:</strong> R6.6 does not model the bill's real-estate-specific capital-gains/direct-return branch. Non-main property is therefore blocked under Future or Transition mode.</div></div>`;
    const stage91=$('scenarioPurchaseEligibilityStage91');if(stage91)stage91.insertAdjacentElement('afterend',block);else rulesBody.prepend(block);
  }
  const starterMain=$('scenarioStarterMainResidenceNew');if(starterMain){const wrapper=starterMain.closest('.toggle');if(wrapper)wrapper.classList.add('hidden');}
  function sync(){
    const purchase=isPurchase($('comparisonType')?.value),use=normalizePropertyUse($('scenarioPropertyUseNew')?.value)||'main-residence',nonMain=use==='non-main',nhg=$('scenarioPurchaseNhgModeNew')?.value||'none',box3=$('scenarioBox3ModeFresh')?.value||'none';if(starterMain){starterMain.checked=!nonMain;starterMain.disabled=true;}
    $('scenarioNonMainReturnFields')?.classList.toggle('hidden',!purchase||!nonMain);$('scenarioNhgNonEnergyCostStackField')?.classList.toggle('hidden',!purchase||nhg==='none');const stack=$('scenarioNhgNonEnergyCostStackNew');if(stack)stack.required=purchase&&nhg!=='none';
    const priorWoz=$('scenarioPropertyPrivateUseWozNew'),days=nonNegative($('scenarioPropertyPrivateUseDaysNew')?.value);if(priorWoz)priorWoz.required=purchase&&nonMain&&box3==='current'&&days>0;const warning=$('scenarioNonMainFutureWarning');if(warning)warning.classList.toggle('hidden',!(purchase&&nonMain&&(box3==='future'||box3==='transition')));
  }
  engine.addEventListener('input',sync,true);engine.addEventListener('change',sync,true);sync();
  const purchaseNhg=$('purchaseNhgMode');if(purchaseNhg&&!$('stage10StandaloneNhgNote')){const note=document.createElement('p');note.id='stage10StandaloneNhgNote';note.className='inline';note.textContent='Exact NHG eligibility needs the official a–g cost stack and energy allocation. Use the Scenario purchase-rule section for the decision-grade NHG check; this Mortgage-tab selector will not return an NHG pass without those inputs.';purchaseNhg.insertAdjacentElement('afterend',note);}
  const identity=releaseIdentity();document.documentElement.dataset.calculationSourceSha=identity.calculationSourceSha||'unfrozen';let marker=$('stage10ReleaseIdentity');if(!marker){marker=document.createElement('div');marker.id='stage10ReleaseIdentity';marker.className='foot';const footer=$('modelVersion');footer?.insertAdjacentElement('beforebegin',marker);}if(marker)marker.textContent=identity.valid?`Calculation source: ${identity.calculationSourceSha}`:'Calculation source identity not frozen — do not treat this build as final release evidence.';
}
installPatches();if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',browserBoot,{once:true});else browserBoot();}
return{VERSION,NHG_STANDARD,NHG_ENERGY,NHG_FEE,OWN_USE_RATE_2026,normalizePropertyUse,inferredPropertyUse,isNonMain,propertyTransferTaxAlignment,nhg2026Exact,calculateScenarioPurchase2026,unsupportedStandaloneNhg,ownerCostMode,annualGroundLeaseByYear,purchaseFundingForCall,additionalDeductibleCostsByYear,propertyIncomeSchedule,isPropertyInvestmentCall,releaseIdentity,releaseIdentityRows,validateStage10Config,installPatches,browserBoot};
});
