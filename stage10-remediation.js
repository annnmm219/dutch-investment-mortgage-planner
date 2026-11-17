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
const NHG_COST_STACK_BELOW_REFERENCE_WARNING='Your cost total is lower than the purchase price or appraisal, so the NHG check can\'t run. Enter the full cost total to see the NHG estimate.';
const NHG_STANDARD=470000;
const NHG_ENERGY=498200;
const NHG_FEE=.004;
const NHG_TABLES={
  2026:{year:2026,standard:470000,energy:498200,fee:.004,status:'final'},
  2027:{year:2027,standard:500000,energy:530000,fee:.004,status:'final'}
};
const NHG_NON_MAIN_LINE='NHG is only possible for a home you will live in as your main home. This home is not your main home, so the NHG check does not apply and no NHG fee is included.';
const NHG_LIMITS_LINE='NHG limits depend on the date of your binding mortgage offer: €470,000 (€498,200 with energy-saving measures) for offers in 2026, €500,000 (€530,000) for offers from 1 Jan 2027.';
const NHG_FALLBACK_LINE='No offer date entered, so the 2026 NHG limits are used. Enter the expected offer date to use the 2027 limits.';
const NHG_DATE_ORDER_LINE='The binding mortgage offer usually comes before the notary transfer. Check both dates.';
const DAY_RULE_LINE='A day counts either as rented out or as your own use, not both. Days the home stands empty count as your own use.';
const LEEGWAARDE_LINE='For a home let long-term to a tenant with rent protection, Box 3 may use a lower value than the WOZ value (the leegwaarderatio). This estimate uses the full WOZ value, so the Box 3 tax shown may be higher than you will pay.';
const OWN_USE_DAY_LINE='Your own-use days are all days you can use the home, even when you are not there. Days the home is let, or can\'t be used because of building work, don\'t count.';
const SECOND_HOME_OUT_OF_SCOPE='We can\'t estimate Box 3 tax for this second home yet. We only cover a second home that you own for all of 2026 and that you either use yourself (with or without short holiday letting) or let to one tenant long-term. Your situation is different, so no Box 3 figure is shown. A tax adviser can help.';
const TEGENBEWIJS_LINE='If your actual return is lower than the deemed return, you can ask the Belastingdienst to tax the actual return instead. This estimate assumes you do that. Your real figures and proof decide the outcome.';
function euroLabel(amount){return '€'+Math.round(Number(amount)||0).toLocaleString('nl-NL');}
function isoDate(value){const text=String(value||'').trim();return /^(\d{4})-(\d{2})-(\d{2})$/.test(text)?text:'';}
function nhgTableForOfferDate(offerDate){
  const text=isoDate(offerDate);
  if(!text)return{table:NHG_TABLES[2026],fallback:true,offerDate:''};
  return{table:text>='2027-01-01'?NHG_TABLES[2027]:NHG_TABLES[2026],fallback:false,offerDate:text};
}
const OWN_USE_RATE_2026=.0506;
const TOL=.005;
const nonNegative=v=>Math.max(0,Number(v)||0);
const finiteOrNull=v=>(v===null||v===undefined||v==='')?null:(Number.isFinite(Number(v))?Number(v):null);
const finite=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,finite(v,a)));
const clone=v=>JSON.parse(JSON.stringify(v||{}));
const isPurchase=mode=>mode==='buy-rent'||mode==='downpayment';
const normalizePurchaseType=value=>value==='new-build'?'new-build':value==='existing-home'?'existing-home':null;

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
function nhg2026Exact({purchasePrice=0,appraisedValue=0,mortgageAmount=0,mode='none',qualifyingEnergyExpenditure=0,nonEnergyCostStack=null,propertyUse=null,offerDate=null,notaryTransferDate=null}={}){
  const purchase=nonNegative(purchasePrice),appraisal=nonNegative(appraisedValue)||purchase,loan=nonNegative(mortgageAmount);
  const energy=mode==='energy',enabled=mode==='standard'||energy,energySpend=energy?nonNegative(qualifyingEnergyExpenditure):0,stack=finiteOrNull(nonEnergyCostStack);
  const referenceValues=[purchase,appraisal].filter(x=>x>0),referenceValue=referenceValues.length?Math.min(...referenceValues):0;
  if(!enabled)return{enabled:false,eligible:false,energy:false,limit:0,fee:0,referenceValue,nonEnergyCostStack:stack,totalCostStack:stack,qualifyingEnergyExpenditure:energySpend,warning:'',lines:[]};
  const use=propertyUse==='non-main'?'non-main':propertyUse==='main-residence'?'main-residence':null;
  if(use==='non-main')return{enabled:true,eligible:false,energy,limit:0,fee:0,feeRate:0,referenceValue,nonEnergyCostStack:stack,totalCostStack:stack,qualifyingEnergyExpenditure:energySpend,warning:NHG_NON_MAIN_LINE,lines:[NHG_NON_MAIN_LINE],code:'nhg-non-main',unavailable:true};
  const offer=isoDate(offerDate),transfer=isoDate(notaryTransferDate);
  if(offer&&transfer&&offer>transfer)return{enabled:true,eligible:false,energy,limit:0,fee:0,feeRate:0,referenceValue,nonEnergyCostStack:stack,totalCostStack:stack,qualifyingEnergyExpenditure:energySpend,warning:NHG_DATE_ORDER_LINE,lines:[NHG_DATE_ORDER_LINE],code:'nhg-date-order',unavailable:true};
  const picked=nhgTableForOfferDate(offer),table=picked.table,year=table.year,standard=table.standard,enhanced=table.energy,feeRate=table.fee;
  const costStackKnown=stack!==null&&stack>=0,nonEnergyLoan=Math.max(0,loan-energySpend),totalCostStack=costStackKnown?stack+energySpend:null;
  const eligibleByNonEnergyCost=costStackKnown&&stack<=standard+TOL;
  const eligibleByTotalCost=costStackKnown&&(energy?totalCostStack<=enhanced+TOL:stack<=standard+TOL);
  const eligibleByNonEnergyLoan=nonEnergyLoan<=standard+TOL,eligibleByTotalLoan=loan<=(energy?enhanced:standard)+TOL;
  const requiredEnergyExpenditure=energy?Math.max(0,loan-standard):0,eligibleByEnergySpend=!energy||energySpend+TOL>=requiredEnergyExpenditure;
  const costStackBelowReference=costStackKnown&&referenceValue>0&&stack+TOL<referenceValue;
  const eligible=costStackKnown&&!costStackBelowReference&&eligibleByNonEnergyCost&&eligibleByTotalCost&&eligibleByNonEnergyLoan&&eligibleByTotalLoan&&eligibleByEnergySpend;
  let warning='';
  if(!costStackKnown)warning='Enter the official NHG non-energy cost stack (items a–g) before NHG eligibility can be assessed.';
  else if(costStackBelowReference)warning=NHG_COST_STACK_BELOW_REFERENCE_WARNING;
  else if(!eligibleByNonEnergyCost)warning=`NHG is unavailable because the non-energy cost stack is ${euroLabel(stack)}, above the ${year} ${euroLabel(standard)} limit. Energy measures cannot raise this a–g limit.`;
  else if(!eligibleByTotalCost)warning=`NHG is unavailable because the total cost stack including qualifying energy measures exceeds ${euroLabel(enhanced)}.`;
  else if(!eligibleByNonEnergyLoan)warning=`NHG is unavailable because the non-energy part of the loan exceeds ${euroLabel(standard)}.`;
  else if(!eligibleByTotalLoan)warning=`The mortgage exceeds the ${energy?'energy-enhanced ':''}${year} NHG loan limit of ${euroLabel(energy?enhanced:standard)}.`;
  else if(!eligibleByEnergySpend)warning=`At least ${euroLabel(Math.ceil(requiredEnergyExpenditure))} of the mortgage above ${euroLabel(standard)} must be fully allocated to qualifying energy measures.`;
  const lines=[NHG_LIMITS_LINE];
  if(picked.fallback)lines.push(NHG_FALLBACK_LINE);
  if(warning)lines.push(warning);
  return{enabled:true,eligible,energy,limit:energy?enhanced:standard,standardLimit:standard,energyLimit:enhanced,offerYear:year,fee:eligible?loan*feeRate:0,feeRate,referenceValue,nonEnergyCostStack:stack,totalCostStack,qualifyingEnergyExpenditure:energySpend,nonEnergyLoan,requiredEnergyExpenditure,costStackKnown,eligibleByNonEnergyCost,eligibleByTotalCost,eligibleByNonEnergyLoan,eligibleByTotalLoan,eligibleByEnergySpend,warning,fallback:picked.fallback,fallbackLine:picked.fallback?NHG_FALLBACK_LINE:'',lines,limitsLine:NHG_LIMITS_LINE};
}
function transferTaxPropertyValue({price=0,appraisal=0}={}){
  // Without a known capitalised canon, transfer tax stays on max(purchase price, appraisal). A notary amount or 17× canon uses the same capped starter-test value, and the existing 2% rate applies to that value when the exemption is refused.
  return Math.max(nonNegative(price),nonNegative(appraisal));
}
function calculateScenarioPurchase2026(input={}){
  const purchaseType=normalizePurchaseType(input.purchaseType)||'existing-home';
  const price=nonNegative(input.housePrice),cash=nonNegative(input.availableSavings),appraisal=nonNegative(input.appraisedValue)||price,down=nonNegative(input.downPayment),base=nonNegative(input.baseCosts),energySpend=input.nhgMode==='energy'?nonNegative(input.qualifyingEnergyExpenditure):0,errors=[];
  if(purchaseType==='new-build')errors.push({code:'new-build-unsupported',message:'R6.6 purchase scenarios support existing homes only. New-build purchase, VAT/transfer-tax and NHG cost rules use a separate structure and are not modeled in this release.'});
  if(price<=0)errors.push({code:'property-price-required',message:'Enter a property price greater than zero.'});
  if(down>price+TOL)errors.push({code:'buyer-cash-exceeds-price',message:`Buyer cash toward the purchase price exceeds the property price by ${(down-price).toFixed(2)}.`});
  const appraisalGap=Math.max(0,price-appraisal);if(down+TOL<appraisalGap)errors.push({code:'appraisal-gap-unfunded',message:`The purchase price is €${Math.round(appraisalGap).toLocaleString('nl-NL')} above the appraised value. Fund at least that appraisal gap explicitly with buyer cash.`});
  const acquired=PR.taxableAcquisitionValue({price,appraisal,yearlyCanon:input.yearlyCanon,boughtOff:input.groundRentBoughtOff===true,perpetual:input.groundRentPerpetual||'dont-know',notaryAmount:input.notaryCapitalisedCanon,unencumberedValue:input.unencumberedValue,notaryTransferDate:input.notaryTransferDate,acquisitionYear:input.acquisitionYear});
  const requested=['main','starter','other-home','other-real-estate','manual'].includes(input.transferTaxMode)?input.transferTaxMode:'main';let effective=requested,starterEligibility=null,transferTaxBase=requested==='manual'?transferTaxPropertyValue({price,appraisal}):acquired.transferTaxBase,erfpachtNote=acquired.undetermined&&requested==='starter'?acquired.note:'';
  if(requested==='starter'){
    const starter=PR.applyStarterWithErfpacht({price,appraisal,buyerAge:input.buyerAge,mainResidence:input.starterMainResidence!==false,exemptionUnused:input.starterExemptionUnused!==false,yearlyCanon:input.yearlyCanon,boughtOff:input.groundRentBoughtOff===true,perpetual:input.groundRentPerpetual||'dont-know',notaryAmount:input.notaryCapitalisedCanon,unencumberedValue:input.unencumberedValue,notaryTransferDate:input.notaryTransferDate,acquisitionYear:input.acquisitionYear});
    transferTaxBase=starter.transferTaxBase;erfpachtNote=starter.note||'';
    starterEligibility=starter.undetermined?{eligible:false,undetermined:true,acquisitionYear:starter.acquisitionYear,starterLimit:starter.starterLimit,propertyValue:transferTaxBase,note:starter.note,reasons:[starter.note]}:starter.eligibility;
    if(starter.undetermined)effective='main';
    else if(!starter.eligible)effective=starter.eligibility?.residenceEligible?'main':'other-home';
  }
  const transferYear=starterEligibility?.acquisitionYear||acquired.acquisitionYear||input.acquisitionYear;
  const transferTax=PR.transferTax2026({propertyValue:transferTaxBase,mode:effective,manualAmount:input.manualTransferTax,acquisitionYear:transferYear});transferTax.requestedMode=requested;transferTax.effectiveMode=effective;transferTax.starterEligibility=starterEligibility;transferTax.erfpachtNote=erfpachtNote;transferTax.proposalNote=PR.residentialNonMainProposalNote({transferTaxMode:effective,notaryTransferDate:input.notaryTransferDate,acquisitionYear:transferYear,mainHome:effective!=='other-home'&&effective!=='other-real-estate'});
  if(requested==='starter'&&starterEligibility?.undetermined)transferTax.warning=erfpachtNote;
  else if(requested==='starter'&&!starterEligibility?.eligible)transferTax.warning=`Starter exemption not applied: ${starterEligibility.reasons.join('; ')}. ${effective==='other-home'?'The 8% residential non-main-residence rate is used.':'The 2% main-residence rate is used.'}`;
  const baseMortgage=Math.max(0,price-Math.min(price,down)),mortgageProceeds=baseMortgage+energySpend,supportedEnergyAboveAppraisal=input.nhgMode==='energy'?Math.min(energySpend,appraisal*.06):0,supportedLtvLoan=appraisal+supportedEnergyAboveAppraisal;
  if(mortgageProceeds>supportedLtvLoan+TOL)errors.push({code:'mortgage-above-supported-ltv',message:`The planned mortgage is €${Math.round(mortgageProceeds-supportedLtvLoan).toLocaleString('nl-NL')} above the supported appraisal-based financing limit. Increase buyer cash or reduce the mortgage.`});
  const propertyUse=input.propertyUse==='non-main'?'non-main':input.propertyUse==='main-residence'?'main-residence':(['other-home','other-real-estate'].includes(requested)?'non-main':null);
  const nhg=nhg2026Exact({purchasePrice:price,appraisedValue:appraisal,mortgageAmount:mortgageProceeds,mode:input.nhgMode,qualifyingEnergyExpenditure:energySpend,nonEnergyCostStack:input.nhgNonEnergyCostStack,propertyUse,offerDate:input.bindingOfferDate,notaryTransferDate:input.notaryTransferDate});
  if(nhg.code==='nhg-non-main')errors.push({code:'nhg-non-main',message:nhg.warning});
  else if(nhg.code==='nhg-date-order')errors.push({code:'nhg-date-order',message:nhg.warning});
  else if(nhg.enabled&&!nhg.eligible)errors.push({code:'nhg-ineligible',message:nhg.warning||'The selected NHG route is not eligible for these scenario inputs.'});
  const nhgFee=nhg.fee,totalCosts=base+transferTax.amount+nhgFee,buyerCashForCosts=totalCosts,totalBuyerCash=down+buyerCashForCosts,totalUses=price+energySpend+totalCosts,totalSources=mortgageProceeds+totalBuyerCash,identityDifference=totalSources-totalUses,fundingShortfall=Math.max(0,totalBuyerCash-cash),remainingSavings=Math.max(0,cash-totalBuyerCash);
  if(fundingShortfall>TOL)errors.push({code:'purchase-cash-shortfall',message:`Starting savings are ${fundingShortfall.toFixed(2)} below the complete cash-at-closing requirement.`});
  if(Math.abs(identityDifference)>TOL)errors.push({code:'sources-uses-mismatch',message:`Purchase sources and uses differ by ${Math.abs(identityDifference).toFixed(2)}.`});
  const ltv=PR.ltv2026({mortgageAmount:mortgageProceeds,appraisedValue:appraisal});ltv.supportedEnergyAboveAppraisal=supportedEnergyAboveAppraisal;ltv.supportedLoanLimit=supportedLtvLoan;ltv.overSupportedLimit=mortgageProceeds>supportedLtvLoan+TOL;
  const jointLine=(input.buyingWith==='one'||input.buyingWith==='three'||input.jointManual)?PR.JOINT_UNAVAILABLE:'';
  const warnings=[...new Set([transferTax.warning,transferTax.erfpachtNote,transferTax.proposalNote,jointLine,nhg.fallbackLine,nhg.limitsLine,nhg.warning,ltv.overStandardLimit&&!ltv.overSupportedLimit?'Mortgage exceeds 100% of appraisal only through the entered qualifying energy-finance allowance.':ltv.warning].filter(Boolean))];
  return{source:'scenario-local-2026-rules-stage10',purchaseType,valid:errors.length===0,propertyPrice:price,appraisedValue:appraisal,availableSavings:cash,baseCosts:base,transferTaxBase,transferTax,nhg,nhgFee,nhgNonEnergyCostStack:nhg.nonEnergyCostStack,qualifyingEnergyExpenditure:energySpend,transactionCosts:totalCosts,totalCosts,buyerCashTowardPrice:down,buyerCashForCosts,totalBuyerCash,mortgageProceeds,totalUses,totalSources,identityDifference,remainingSavings,fundingShortfall,shortfall:fundingShortfall,funded:fundingShortfall<=TOL,appraisalGap,minimumBuyerCashForAppraisalGap:appraisalGap,ltv,warnings,errors};
}
function unsupportedStandaloneNhg(prior,input={}){
  const mode=['standard','energy'].includes(input.nhgMode)?input.nhgMode:'none';
  if(mode==='none')return prior(input);
  const base=prior({...input,nhgMode:'none'}),energy=mode==='energy';
  const picked=nhgTableForOfferDate(input.bindingOfferDate||input.offerDate||''),table=picked.table,limit=energy?table.energy:table.standard;
  return{...base,nhg:{enabled:true,eligible:false,energy,offerYear:table.year,limit,fee:0,warning:`Standalone Mortgage-tab NHG is intentionally unavailable in R6.6, even if hidden cost-stack inputs are supplied. ${picked.fallback?NHG_FALLBACK_LINE:NHG_LIMITS_LINE} Use the Scenario purchase-rule section for the exact existing-home NHG check.`},nhgFee:0};
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
  return calculateScenarioPurchase2026({purchaseType:config.purchaseRules?.purchaseType,housePrice:d?.price,downPayment:down,availableSavings:d?.cash??config.box3?.savings,baseCosts:d?.purchaseCosts,transferTaxMode:config.purchaseRules?.transferTaxMode,manualTransferTax:config.purchaseRules?.manualTransferTax,appraisedValue:config.purchaseRules?.appraisedValue,nhgMode:config.purchaseRules?.nhgMode,buyerAge:config.purchaseRules?.buyerAge,starterMainResidence:config.purchaseRules?.starterMainResidence,starterExemptionUnused:config.purchaseRules?.starterExemptionUnused,qualifyingEnergyExpenditure:config.purchaseRules?.qualifyingEnergyExpenditure,nhgNonEnergyCostStack:config.purchaseRules?.nhgNonEnergyCostStack,acquisitionYear:config.startYear,yearlyCanon:config.groundLeaseAnnual,groundRentBoughtOff:config.purchaseRules?.groundRentBoughtOff===true,groundRentPerpetual:config.purchaseRules?.groundRentPerpetual||'dont-know',notaryCapitalisedCanon:config.purchaseRules?.notaryCapitalisedCanon,unencumberedValue:config.purchaseRules?.unencumberedValue,notaryTransferDate:config.purchaseRules?.notaryTransferDate,bindingOfferDate:config.purchaseRules?.bindingOfferDate,buyingWith:config.purchaseRules?.buyingWith,jointManual:config.purchaseRules?.jointManual,propertyUse:config.purchaseRules?.propertyUse});
}
function additionalDeductibleCostsByYear(config={},months=0,mortgageCallIndex=0){
  const out=annualGroundLeaseByYear(config,months),existing=config.tax?.additionalDeductibleOwnHomeCosts,years=Object.keys(out);
  if(existing&&typeof existing==='object'&&!Array.isArray(existing))Object.entries(existing).forEach(([year,value])=>{out[year]=(out[year]||0)+nonNegative(value);});
  else if(Number.isFinite(Number(existing)))years.forEach(year=>{out[year]=(out[year]||0)+nonNegative(existing);});
  if(isPurchase(config.mode)&&inferredPropertyUse(config.purchaseRules)==='main-residence'){
    const funding=purchaseFundingForCall(config,mortgageCallIndex),firstYear=String(finite(config.startYear,2026)),explicit=nonNegative(config.purchaseRules?.deductibleFinancingCosts),qualifyingShare=clamp(config.purchaseRules?.qualifyingInterestFraction??config.tax?.qualifyingInterestFraction??1,0,1),deductibleNhgFee=nonNegative(funding?.nhgFee)*qualifyingShare;out[firstYear]=(out[firstYear]||0)+explicit+deductibleNhgFee;
  }
  return out;
}
function daysInYear(year){const y=Math.round(Number(year)||2026);return y%4===0&&(y%100!==0||y%400===0)?366:365;}
function privateUseAddition({woz=0,ownUseDays=0,year=2026}={}){
  const days=clamp(ownUseDays,0,daysInYear(year));
  return nonNegative(woz)*OWN_USE_RATE_2026*(days/daysInYear(year));
}
function secondHomeProfile(rules={},config={}){
  const pattern=rules.propertyUsePattern==='long-term'?'long-term':rules.propertyUsePattern==='own-holiday'?'own-holiday':null;
  const year=finite(config.startYear,2026),month=clamp(config.startMonth||1,1,12);
  const daysLet=clamp(rules.daysLet??0,0,365),building=clamp(rules.buildingDays??0,0,365);
  const calculatedOwn=Math.max(0,365-daysLet-building);
  const ownUse=pattern==='long-term'?0:pattern==='own-holiday'?calculatedOwn:clamp(rules.privateUseDays??0,0,365);
  const rent=nonNegative(rules.grossRentalIncomeAnnual);
  if(pattern==='own-holiday'&&daysLet+building>365)return{profile:'out-of-scope',message:'Days let and days of building work together can\'t be more than 365.',ownUseDays:0,daysLet,buildingDays:building};
  if(rent>0&&ownUse===365&&daysLet===0)return{profile:'blocked',message:DAY_RULE_LINE,ownUseDays:365,daysLet:0,buildingDays:building};
  const partYear=month!==1||year!==2026||rules.ownedAllCalendarYear===false||rules.boughtDuringYear===true||rules.soldDuringYear===true;
  const excluded=rules.fixedTermLease===true||rules.relatedPartyRent===true||rules.partOfBuilding===true;
  if(!pattern){
    const legacyOwn=clamp(rules.privateUseDays??0,0,365);
    if(excluded||partYear)return{profile:'out-of-scope',message:SECOND_HOME_OUT_OF_SCOPE,ownUseDays:legacyOwn,daysLet,buildingDays:building};
    if(rent>0&&legacyOwn>0&&legacyOwn<365)return{profile:'out-of-scope',message:'Choose how this second home is used.',ownUseDays:legacyOwn,daysLet,buildingDays:building};
    const disclosure=rent>0&&legacyOwn===0?LEEGWAARDE_LINE:'';
    return{profile:'legacy',message:'',disclosure,ownUseDays:legacyOwn,daysLet,buildingDays:building};
  }
  const full2026=year===2026&&month===1&&rules.ownedAllCalendarYear!==false&&rules.boughtDuringYear!==true&&rules.soldDuringYear!==true;
  if(excluded||!full2026)return{profile:'out-of-scope',message:SECOND_HOME_OUT_OF_SCOPE,ownUseDays:ownUse,daysLet,buildingDays:building};
  if(pattern==='long-term')return{profile:'p2',message:'',disclosure:LEEGWAARDE_LINE,ownUseDays:0,daysLet:0,buildingDays:0,longTermNote:'A home let long-term has no own-use days.'};
  if(daysLet+ownUse+building!==365)return{profile:'out-of-scope',message:SECOND_HOME_OUT_OF_SCOPE,ownUseDays:ownUse,daysLet,buildingDays:building};
  return{profile:'p1',message:'',disclosure:OWN_USE_DAY_LINE,ownUseDays:ownUse,daysLet,buildingDays:building};
}
function propertyIncomeSchedule(config={},months=0){
  const rules=config.purchaseRules||{},profile=secondHomeProfile(rules,config),supported=profile.profile==='p1'||profile.profile==='p2'||profile.profile==='legacy';
  const annualRent=supported?nonNegative(rules.grossRentalIncomeAnnual):0,incomeGrowth=finite(rules.propertyIncomeGrowthPct,0),monthlyGrowth=FC.effectiveAnnualPctToMonthly(incomeGrowth),baseMonthly=annualRent/12,monthly=[],rentalByYear={};let year=finite(config.startYear,2026),month=clamp(config.startMonth||1,1,12);
  for(let i=0;i<Math.max(0,Math.round(months));i++){const amount=baseMonthly*Math.pow(1+monthlyGrowth,i);monthly.push(amount);rentalByYear[year]=(rentalByYear[year]||0)+amount;month++;if(month===13){month=1;year++;}}
  const ownUseByYear={},days=supported?profile.ownUseDays:0,woz=nonNegative(rules.privateUseWozValue),legacy=profile.profile==='legacy',homeGrowth=finite(config.homeGrowthPct,0);
  Object.keys(rentalByYear).forEach((yearKey,index)=>{ownUseByYear[yearKey]=legacy?(days>0?woz*Math.pow(1+homeGrowth/100,index)*OWN_USE_RATE_2026*(days/365):0):privateUseAddition({woz,ownUseDays:days,year:Number(yearKey)});});
  return{monthly,rentalByYear,ownUseByYear,profile,addition:privateUseAddition({woz,ownUseDays:profile.ownUseDays,year:finite(config.startYear,2026)}),directReturn:annualRent+privateUseAddition({woz,ownUseDays:profile.ownUseDays,year:finite(config.startYear,2026)})};
}
function isPropertyInvestmentCall(config={},callIndex=0){if(!isPurchase(config.mode)||inferredPropertyUse(config.purchaseRules)!=='non-main')return false;return config.mode==='buy-rent'?callIndex===0:(config.mode==='downpayment'&&(callIndex===0||callIndex===1));}
function releaseIdentity(identity=root?.__DIMP_RELEASE_IDENTITY){const sha=String(identity?.calculationManifestSha||identity?.calculationSourceSha||'').trim().toLowerCase(),valid=/^[0-9a-f]{40}$|^[0-9a-f]{64}$/.test(sha);const out={valid,calculationSourceSha:valid?sha:null,buildId:String(identity?.buildId||'').trim()||null,status:valid?'frozen':'unfrozen'};if(valid&&sha.length===64)out.calculationManifestSha=sha;if(identity&&Object.prototype.hasOwnProperty.call(identity,'frozenFromCommit'))out.frozenFromCommit=String(identity.frozenFromCommit||'').trim()||null;return out;}
function releaseIdentityRows(identity=root?.__DIMP_RELEASE_IDENTITY){
  const id=releaseIdentity(identity);
  if(!id.valid)return[['Model','Version','UNFROZEN'],['Model','Build identity','UNFROZEN']];
  const policyDate=root?.Policy2026?.LAST_VERIFIED_AT||'2026-11-14';
  const digest=id.calculationManifestSha||id.calculationSourceSha;
  const rows=[
    ['Model','Version','R6.6'],
    ['Model','Release date','2026-11-04'],
    ['Model','Patch date',root?.OutputIntegrity?.RELEASE_META?.patched||'not yet deployed'],
    ['Model','Rules verified date',policyDate],
    ['Model','Calculation manifest (SHA-256 of 12 files; not a Git commit)',digest],
    ['Model','Manifest frozen from commit',id.frozenFromCommit||''],
    ['Model','Build identity',id.buildId||'UNFROZEN']
  ];
  const deployed=identity?.deployingCommit||identity?.deployedCommit;
  if(deployed)rows.push(['Model','Deployed commit',String(deployed)]);
  return rows;
}

let activeRun=null,activeInvestment=null;
function invalidScenario(reason,mode=''){
  const names=mode==='buy-rent'?['Buy home','Rent + invest']:mode==='downpayment'?['Larger down payment','Smaller down payment']:['Strategy A','Strategy B'],blank=name=>({name,net:0,invest:0,savings:0,box3Debt:0,financial:0,mortgage:0,interest:0,mortTax:0,rent:0,owner:0,purchase:0,box3:0,unsettledBox3:0,externalTax:0,externalDebtRepayment:0,box3DebtInterest:0,short:0,label:'Comparison unavailable'});
  return{valid:false,status:'stage10-blocked',reason:String(reason),A:blank(names[0]),B:blank(names[1]),note:String(reason),cashA:[],cashB:[],budgetSeries:[],peakRequirement:0,firstRequirement:0,stage10Blocked:true};
}
function validateStage10Config(config={}){
  if(!isPurchase(config.mode))return{valid:true};const rules=config.purchaseRules||{},purchaseType=normalizePurchaseType(rules.purchaseType)||'existing-home',use=inferredPropertyUse(rules),alignment=propertyTransferTaxAlignment(use,rules.transferTaxMode);
  if(purchaseType==='new-build')return{valid:false,reason:'Comparison unavailable: R6.6 purchase scenarios support existing homes only. New-build purchase, VAT/transfer-tax and NHG rules use a separate structure and are not modeled.'};
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
    if(!rules.propertyUsePattern)return{valid:false,reason:'Choose how this second home is used.'};
    const profile=secondHomeProfile(rules,config);
    if(profile.profile==='blocked')return{valid:false,reason:profile.message};
    if(profile.profile==='out-of-scope')return{valid:false,reason:profile.message};
    if(finiteOrNull(rules.grossRentalIncomeAnnual)===null)return{valid:false,reason:'Comparison unavailable: enter annual basic rent (kale huur) / pacht received for the non-main property, excluding service charges (0 is allowed).'};
    if(profile.profile==='p1'&&profile.ownUseDays>0&&nonNegative(rules.privateUseWozValue)<=0)return{valid:false,reason:'Comparison unavailable: enter the relevant prior-year WOZ value to calculate the 2026 5.06% private-use addition.'};
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
      if(merged.purchaseType==null)merged.purchaseType=rules.purchaseType;
      if(merged.propertyUse==null)merged.propertyUse=rules.propertyUse;
      if(merged.qualifyingEnergyExpenditure==null)merged.qualifyingEnergyExpenditure=rules.qualifyingEnergyExpenditure;
      if(merged.nhgNonEnergyCostStack==null)merged.nhgNonEnergyCostStack=rules.nhgNonEnergyCostStack;
      if(merged.bindingOfferDate==null)merged.bindingOfferDate=rules.bindingOfferDate;
      if(merged.notaryTransferDate==null)merged.notaryTransferDate=rules.notaryTransferDate;
      if(merged.yearlyCanon==null)merged.yearlyCanon=activeRun.config.groundLeaseAnnual;
      if(merged.groundRentBoughtOff==null)merged.groundRentBoughtOff=rules.groundRentBoughtOff;
      if(merged.groundRentPerpetual==null)merged.groundRentPerpetual=rules.groundRentPerpetual;
      if(merged.notaryCapitalisedCanon==null)merged.notaryCapitalisedCanon=rules.notaryCapitalisedCanon;
    }
    return calculateScenarioPurchase2026(merged);
  };
  SC.resolveScenarioInputSource=function(args={}){
    const resolved=priorResolve(args),rules={...(resolved.purchaseRules||{})};
    if(typeof document!=='undefined'){
      const $=id=>document.getElementById(id),n=id=>finiteOrNull($(id)?.value);rules.purchaseType=normalizePurchaseType($('scenarioPurchaseTypeNew')?.value)||'existing-home';rules.propertyUse=normalizePropertyUse($('scenarioPropertyUseNew')?.value)||inferredPropertyUse(rules);rules.starterMainResidence=rules.propertyUse==='main-residence';rules.deductibleFinancingCosts=nonNegative(n('scenarioDeductibleFinancingCostsNew'));rules.nhgNonEnergyCostStack=n('scenarioNhgNonEnergyCostStackNew');rules.grossRentalIncomeAnnual=n('scenarioPropertyRentalIncomeNew');rules.privateUseDays=n('scenarioPropertyPrivateUseDaysNew');rules.privateUseWozValue=n('scenarioPropertyPrivateUseWozNew');rules.propertyIncomeGrowthPct=finite(n('scenarioPropertyIncomeGrowthNew'),0);
      const pattern=$('scenarioPropertyUsePatternNew')?.value;if(pattern==='long-term'||pattern==='own-holiday')rules.propertyUsePattern=pattern;
      rules.daysLet=n('scenarioDaysLetNew');rules.buildingDays=n('scenarioBuildingDaysNew');rules.fixedTermLease=$('scenarioFixedTermLeaseNew')?.checked===true;rules.relatedPartyRent=$('scenarioRelatedPartyRentNew')?.checked===true;rules.partOfBuilding=$('scenarioPartOfBuildingNew')?.checked===true;if($('scenarioOwnedAllYearNew'))rules.ownedAllCalendarYear=$('scenarioOwnedAllYearNew').value!=='no';
      const buying=$('scenarioBuyingWithNew')?.value;if(buying==='one'||buying==='three'){rules.buyingWith=buying;rules.transferTaxMode='manual';rules.manualTransferTax=nonNegative(n('scenarioJointTransferTaxNew'));rules.jointManual=true;}
      const offer=$('scenarioBindingOfferDateNew')?.value;if(offer)rules.bindingOfferDate=offer;
    }else{rules.purchaseType=normalizePurchaseType(rules.purchaseType)||'existing-home';rules.propertyUse=normalizePropertyUse(rules.propertyUse)||inferredPropertyUse(rules);if(rules.propertyUse)rules.starterMainResidence=rules.propertyUse==='main-residence';}
    if(!isPurchase(resolved.mode)){rules.purchaseType='existing-home';rules.propertyUse='main-residence';rules.deductibleFinancingCosts=0;rules.nhgNonEnergyCostStack=null;rules.grossRentalIncomeAnnual=0;rules.privateUseDays=0;rules.privateUseWozValue=0;rules.propertyIncomeGrowthPct=0;}
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
    const prepared=clone(config),rules={...(prepared.purchaseRules||{})};if(isPurchase(prepared.mode)){rules.purchaseType=normalizePurchaseType(rules.purchaseType)||'existing-home';rules.propertyUse=normalizePropertyUse(rules.propertyUse)||inferredPropertyUse(rules);if(rules.propertyUse)rules.starterMainResidence=rules.propertyUse==='main-residence';prepared.purchaseRules=rules;const check=validateStage10Config(prepared);if(!check.valid)return invalidScenario(check.reason,prepared.mode);}
    const previous=activeRun;activeRun={config:prepared,investmentCall:0,mortgageCall:0};try{return priorRun(prepared);}finally{activeRun=previous;}
  };
  OI.canonicalExportRows=function(args={}){return[...releaseIdentityRows(),...priorCanonicalRows(args)];};
  Object.defineProperty(SC,'__stage10Patched',{value:true,enumerable:false});
}
function browserBoot(){
  if(typeof document==='undefined')return;const $=id=>document.getElementById(id),engine=$('decisionEngine');if(!engine)return;const rulesBody=$('scenarioPurchaseRulesNew')?.querySelector('.inner-fold-body');
  if(rulesBody&&!$('scenarioStage10PropertyBlock')){
    const block=document.createElement('div');block.id='scenarioStage10PropertyBlock';block.className='stage10-property-block';block.innerHTML=`<p class="subsection-title">Property tax classification and deductible costs</p><div class="grid3 advanced-grid"><div class="field"><label for="scenarioPurchaseTypeNew">Purchase type</label><select id="scenarioPurchaseTypeNew" required><option value="existing-home" selected>Existing home (supported)</option><option value="new-build">New build (not supported in R6.6)</option></select><p class="inline">This planner's purchase, transfer-tax and NHG rules are scoped to existing homes. New-build uses a separate legal/cost structure and is blocked rather than approximated.</p><p class="stage91-source scenario-source-tag" data-source-for="scenarioPurchaseTypeNew">Entered here</p></div><div class="field"><label for="scenarioPropertyUseNew">Property income-tax classification</label><select id="scenarioPropertyUseNew" required><option value="main-residence" selected>Main residence / own home (Box 1)</option><option value="non-main">Non-main property / other real estate (Box 3)</option></select><p class="inline">Independent from the transfer-tax amount. Manual transfer tax does not decide Box 1 versus Box 3.</p><p class="stage91-source scenario-source-tag" data-source-for="scenarioPropertyUseNew">Entered here</p></div><div class="field"><label for="scenarioDeductibleFinancingCostsNew">Deductible financing costs within “other purchase costs”</label><input id="scenarioDeductibleFinancingCostsNew" type="number" min="0" step="100" value="0"><p class="inline">Main residence only. Enter only the qualifying subset, such as mortgage advice/intermediation, mortgage-deed notary and valuation costs. The calculated NHG fee is added automatically.</p><p class="stage91-source scenario-source-tag" data-source-for="scenarioDeductibleFinancingCostsNew">Entered here</p></div><div class="field hidden" id="scenarioNhgNonEnergyCostStackField"><label for="scenarioNhgNonEnergyCostStackNew">NHG non-energy cost stack (official a–g total)</label><input id="scenarioNhgNonEnergyCostStackNew" type="number" min="0" step="100" placeholder="Required when NHG is selected"><p class="inline">For an existing-home purchase, 2026 NHG requires a–g ≤ €470,000. Qualifying energy measures are item h and can lift a–h only to €498,200.</p><p class="stage91-source scenario-source-tag" data-source-for="scenarioNhgNonEnergyCostStackNew">Entered here</p></div></div><div class="callout warn hidden" id="scenarioNewBuildWarning"><strong>New-build not supported:</strong> R6.6 models existing-home purchase rules only. It does not approximate the separate new-build VAT/transfer-tax or NHG cost structure.</div><div id="scenarioNonMainReturnFields" class="hidden"><p class="subsection-title">2026 current-law actual return for non-main property</p><p class="subsection-copy">Actual return includes property value change, received basic rent (kale huur) / pacht excluding service charges, Box 3 debt interest, and from 2026 an own-use addition when the property is available for private use. The fixed 5.06% own-use route is modeled below.</p><div class="grid4 advanced-grid"><div class="field"><label for="scenarioPropertyRentalIncomeNew">Annual basic rent (kale huur) / pacht received</label><input id="scenarioPropertyRentalIncomeNew" type="number" min="0" step="100" value="0"><p class="inline">Exclude service charges. Do not subtract property operating costs; those costs are not deducted from current-law actual Box 3 return.</p></div><div class="field"><label for="scenarioPropertyIncomeGrowthNew">Effective annual rental-income growth %</label><input id="scenarioPropertyIncomeGrowthNew" type="number" min="-20" max="30" step="0.25" value="0"><p class="inline">Planning assumption. Basic rent / pacht is modeled as received monthly and retained/invested.</p></div><div class="field"><label for="scenarioPropertyPrivateUseDaysNew">Private-use availability, days/year</label><input id="scenarioPropertyPrivateUseDaysNew" type="number" min="0" max="365" step="1" value="0"><p class="inline">Days available for private use, excluding days rented/leased or unavailable during qualifying construction/renovation.</p></div><div class="field" id="scenarioPropertyPrivateUseWozField"><label for="scenarioPropertyPrivateUseWozNew">WOZ for 5.06% own-use addition</label><input id="scenarioPropertyPrivateUseWozNew" type="number" min="0" step="1000" placeholder="Required if private-use days > 0"><p class="inline">For 2026 use the WOZ with value date 1 January 2025. Later current-rule sensitivity years grow this planning base with the entered home-value growth.</p></div></div><div class="callout warn" id="scenarioNonMainFutureWarning"><strong>Proposed/transition Box 3:</strong> R6.6 does not model the bill's real-estate-specific capital-gains/direct-return branch. Non-main property is therefore blocked under Future or Transition mode.</div></div>`;
    const stage91=$('scenarioPurchaseEligibilityStage91');if(stage91)stage91.insertAdjacentElement('afterend',block);else rulesBody.prepend(block);
  }
  const nonMainHost=$('scenarioNonMainReturnFields');
  if(nonMainHost&&!$('scenarioPropertyUsePatternNew')){
    const profile=document.createElement('div');profile.id='scenarioSecondHomeProfile';profile.className='grid3 advanced-grid';
    profile.innerHTML=`<div class="field"><label for="scenarioPropertyUsePatternNew">How this second home is used</label><button type="button" class="info-button" id="scenarioPropertyUseInfo" aria-expanded="false" aria-controls="scenarioPropertyUsePanel" aria-label="More about how this second home is used">ⓘ</button><span id="scenarioPropertyUsePanel" class="info-panel" role="region">Box 3 values a second home differently depending on how it is used. Choose the option that fits all of 2026. If neither fits, we can't estimate Box 3 tax for this home. <a href="https://wetten.overheid.nl/BWBR0011353/2026-01-01">Wet IB 2001, art. 5.20 and 5.27a</a></span><select id="scenarioPropertyUsePatternNew"><option value="" selected>Choose</option><option value="long-term">Let to one tenant for all of 2026, with rent protection</option><option value="own-holiday">Available for your own use, sometimes let for short periods (for example as a holiday home)</option></select><p class="inline">A day counts either as rented out or as your own use, not both. Days the home stands empty count as your own use.</p></div><div class="field"><label for="scenarioDaysLetNew">Days let out per year</label><input id="scenarioDaysLetNew" type="number" min="0" max="365" step="1" value="0"></div><div class="field"><label for="scenarioBuildingDaysNew">Days not usable because of building work</label><input id="scenarioBuildingDaysNew" type="number" min="0" max="365" step="1" value="0"></div><div class="field"><label for="scenarioOwnUseDaysReadout">Your own-use days (calculated)</label><button type="button" class="info-button" id="scenarioOwnUseInfo" aria-expanded="false" aria-controls="scenarioOwnUsePanel" aria-label="More about own-use days">ⓘ</button><span id="scenarioOwnUsePanel" class="info-panel" role="region">We calculate this as 365 minus the days the home is let and the days it can't be used because of building work. <a href="https://wetten.overheid.nl/BWBR0011353/2026-01-01">Wet IB 2001, art. 5.27a</a></span><input id="scenarioOwnUseDaysReadout" type="number" readonly value="0"><p class="inline">Your own-use days are all days you can use the home, even when you are not there. Days the home is let, or can't be used because of building work, don't count.</p></div><div class="toggle"><input id="scenarioFixedTermLeaseNew" type="checkbox"><label for="scenarioFixedTermLeaseNew">Fixed-term lease?</label></div><div class="toggle"><input id="scenarioRelatedPartyRentNew" type="checkbox"><label for="scenarioRelatedPartyRentNew">Let to a family member or related business below market rent?</label></div><div class="field"><label for="scenarioOwnedAllYearNew">Owned for all of 2026?</label><select id="scenarioOwnedAllYearNew"><option value="yes" selected>Yes</option><option value="no">No</option></select></div><div class="toggle"><input id="scenarioPartOfBuildingNew" type="checkbox"><label for="scenarioPartOfBuildingNew">Only part of the home is let?</label><button type="button" class="info-button" id="scenarioPartLetInfo" aria-expanded="false" aria-controls="scenarioPartLetPanel" aria-label="More about letting part of the home">ⓘ</button><span id="scenarioPartLetPanel" class="info-panel" role="region">For example, you let one floor and keep the rest for yourself. Box 3 uses special rules for this that this planner doesn't cover. <a href="https://wetten.overheid.nl/BWBR0012066/2026-01-01/#Artikel17a">Uitvoeringsbesluit IB 2001, art. 17a</a></span></div><p class="inline" id="scenarioSecondHomeNotice"></p>`;
    nonMainHost.appendChild(profile);
  }
  const starterMain=$('scenarioStarterMainResidenceNew');if(starterMain){const wrapper=starterMain.closest('.toggle');if(wrapper)wrapper.classList.add('hidden');}
  function sync(){
    if($('scenarioVerdictNew')&&!$('scenarioLeegwaardeNote')){const note=document.createElement('p');note.id='scenarioLeegwaardeNote';note.className='inline';$('scenarioVerdictNew').insertAdjacentElement('afterend',note);}
    const purchase=isPurchase($('comparisonType')?.value),purchaseType=normalizePurchaseType($('scenarioPurchaseTypeNew')?.value)||'existing-home',use=normalizePropertyUse($('scenarioPropertyUseNew')?.value)||'main-residence',nonMain=use==='non-main',nhg=$('scenarioPurchaseNhgModeNew')?.value||'none',box3=$('scenarioBox3ModeFresh')?.value||'none';if(starterMain){starterMain.checked=!nonMain;starterMain.disabled=true;}
    $('scenarioNewBuildWarning')?.classList.toggle('hidden',!purchase||purchaseType!=='new-build');$('scenarioNonMainReturnFields')?.classList.toggle('hidden',!purchase||!nonMain);$('scenarioNhgNonEnergyCostStackField')?.classList.toggle('hidden',!purchase||nhg==='none');const stack=$('scenarioNhgNonEnergyCostStackNew');if(stack)stack.required=purchase&&nhg!=='none';
    const pattern=$('scenarioPropertyUsePatternNew')?.value||'',letDays=nonNegative($('scenarioDaysLetNew')?.value),buildingDays=nonNegative($('scenarioBuildingDaysNew')?.value),ownReadout=$('scenarioOwnUseDaysReadout');
    const calculatedOwn=pattern==='long-term'?0:pattern==='own-holiday'?Math.max(0,365-letDays-buildingDays):nonNegative($('scenarioPropertyPrivateUseDaysNew')?.value);
    const priorWoz=$('scenarioPropertyPrivateUseWozNew'),priorWozField=$('scenarioPropertyPrivateUseWozField'),showPriorWoz=purchase&&nonMain&&box3==='current'&&pattern==='own-holiday'&&calculatedOwn>0;
    if(priorWozField)priorWozField.classList.toggle('hidden',!showPriorWoz);
    if(priorWoz)priorWoz.required=showPriorWoz;
    const oldDaysField=$('scenarioPropertyPrivateUseDaysNew')?.closest('.field');
    if(oldDaysField)oldDaysField.classList.toggle('hidden',pattern==='long-term'||pattern==='own-holiday');
    const warning=$('scenarioNonMainFutureWarning');if(warning)warning.classList.toggle('hidden',!(purchase&&nonMain&&(box3==='future'||box3==='transition')));
    if(!$('scenarioOwnUseLongTermNote')&&ownReadout){const line=document.createElement('p');line.id='scenarioOwnUseLongTermNote';line.className='inline';ownReadout.insertAdjacentElement('afterend',line);}
    const ownNote=$('scenarioOwnUseLongTermNote');if(ownReadout)ownReadout.value=String(pattern==='long-term'?0:pattern==='own-holiday'?calculatedOwn:nonNegative($('scenarioPropertyPrivateUseDaysNew')?.value));if(ownNote)ownNote.textContent=pattern==='long-term'?'A home let long-term has no own-use days.':(letDays+buildingDays>365?"Days let and days of building work together can't be more than 365.":'');
    const profile=secondHomeProfile({propertyUsePattern:pattern||null,grossRentalIncomeAnnual:nonNegative($('scenarioPropertyRentalIncomeNew')?.value),privateUseDays:nonNegative($('scenarioPropertyPrivateUseDaysNew')?.value),daysLet:letDays,buildingDays,fixedTermLease:$('scenarioFixedTermLeaseNew')?.checked===true,relatedPartyRent:$('scenarioRelatedPartyRentNew')?.checked===true,partOfBuilding:$('scenarioPartOfBuildingNew')?.checked===true,ownedAllCalendarYear:$('scenarioOwnedAllYearNew')?.value!=='no'},{startYear:finite($('scenarioStartYearFresh')?.value,2026),startMonth:finite($('scenarioStartMonthFresh')?.value,1)});
    const notice=$('scenarioSecondHomeNotice'),leeg=$('scenarioLeegwaardeNote');if(notice)notice.textContent=purchase&&nonMain&&(profile.profile==='out-of-scope'||profile.profile==='blocked')?profile.message:'';if(leeg)leeg.textContent=purchase&&nonMain&&profile.disclosure===LEEGWAARDE_LINE?LEEGWAARDE_LINE:'';
    const jointLabel=document.querySelector('label[for="scenarioBuyingWithNew"]');if(jointLabel)jointLabel.textContent='Buying alone or with someone?';
  }
  const STAGE10_STATE_KEY='dimp.stage10.scenario-state.v1',STAGE10_IDS=['scenarioPurchaseTypeNew','scenarioPropertyUseNew','scenarioDeductibleFinancingCostsNew','scenarioNhgNonEnergyCostStackNew','scenarioPropertyRentalIncomeNew','scenarioPropertyIncomeGrowthNew','scenarioPropertyPrivateUseDaysNew','scenarioPropertyPrivateUseWozNew','scenarioPropertyUsePatternNew','scenarioDaysLetNew','scenarioBuildingDaysNew','scenarioFixedTermLeaseNew','scenarioRelatedPartyRentNew','scenarioOwnedAllYearNew','scenarioPartOfBuildingNew','scenarioBuyingWithNew','scenarioJointTransferTaxNew','scenarioBindingOfferDateNew'];function captureStage10State(){const values={};STAGE10_IDS.forEach(id=>{const el=$(id);if(!el)return;values[id]={kind:(el.type==='checkbox'||el.type==='radio')?'checked':'value',value:(el.type==='checkbox'||el.type==='radio')?Boolean(el.checked):String(el.value??'')};});return{version:1,values,savedAt:new Date().toISOString()};}function saveStage10State(){try{localStorage.setItem(STAGE10_STATE_KEY,JSON.stringify(captureStage10State()));}catch(_){}}function readStage10State(){try{const own=JSON.parse(localStorage.getItem(STAGE10_STATE_KEY)||'null');if(own?.values)return own;const legacy=JSON.parse(localStorage.getItem(S91.SNAPSHOT_KEY)||'null');return legacy?.values?{version:1,values:legacy.values,migratedFrom:S91.SNAPSHOT_KEY}:null;}catch(_){return null;}}function restoreStage10State(){const payload=readStage10State();if(!payload?.values)return false;let restored=false;STAGE10_IDS.forEach(id=>{const entry=payload.values[id],el=$(id);if(!entry||!el)return;if(entry.kind==='checked')el.checked=Boolean(entry.value);else el.value=String(entry.value??'');restored=true;});return restored;}function stage10Provenance(){STAGE10_IDS.forEach(id=>{const tag=document.querySelector(`.scenario-source-tag[data-source-for="${id}"]`);if(tag)tag.textContent='Entered here';});}function stage10Event(e){sync();stage10Provenance();if(STAGE10_IDS.includes(e.target?.id))saveStage10State();}engine.addEventListener('input',stage10Event,true);engine.addEventListener('change',stage10Event,true);const restoredStage10=restoreStage10State();sync();stage10Provenance();if(restoredStage10){saveStage10State();queueMicrotask(()=>{const trigger=$('scenarioDeductibleFinancingCostsNew')||$('scenarioPropertyUseNew');if(!trigger)return;trigger.dispatchEvent(new Event('input',{bubbles:true}));trigger.dispatchEvent(new Event('change',{bubbles:true}));});}
  const purchaseNhg=$('purchaseNhgMode');if(purchaseNhg&&!$('stage10StandaloneNhgNote')){const note=document.createElement('p');note.id='stage10StandaloneNhgNote';note.className='inline';note.textContent='R6.6 decision-grade NHG checks are scoped to existing-home purchases and need the official a–g cost stack plus energy allocation. Use the Scenario purchase-rule section; this Mortgage-tab selector will not return an NHG pass without those inputs.';purchaseNhg.insertAdjacentElement('afterend',note);}
  const identity=releaseIdentity();document.documentElement.dataset.calculationSourceSha=identity.calculationSourceSha||'unfrozen';let marker=$('stage10ReleaseIdentity');if(!marker){marker=document.createElement('div');marker.id='stage10ReleaseIdentity';marker.className='foot';const footer=$('modelVersion');footer?.insertAdjacentElement('beforebegin',marker);}if(marker)marker.textContent=identity.valid?`Calculation source: ${identity.calculationSourceSha}`:'Calculation source identity not frozen — do not treat this build as final release evidence.';
}
installPatches();if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',browserBoot,{once:true});else browserBoot();}
return{VERSION,NHG_STANDARD,NHG_ENERGY,NHG_FEE,NHG_TABLES,NHG_NON_MAIN_LINE,NHG_LIMITS_LINE,NHG_FALLBACK_LINE,NHG_DATE_ORDER_LINE,DAY_RULE_LINE,LEEGWAARDE_LINE,OWN_USE_DAY_LINE,SECOND_HOME_OUT_OF_SCOPE,TEGENBEWIJS_LINE,OWN_USE_RATE_2026,NHG_COST_STACK_BELOW_REFERENCE_WARNING,normalizePropertyUse,inferredPropertyUse,isNonMain,propertyTransferTaxAlignment,transferTaxPropertyValue,nhg2026Exact,nhgTableForOfferDate,privateUseAddition,secondHomeProfile,calculateScenarioPurchase2026,unsupportedStandaloneNhg,ownerCostMode,annualGroundLeaseByYear,purchaseFundingForCall,additionalDeductibleCostsByYear,propertyIncomeSchedule,isPropertyInvestmentCall,releaseIdentity,releaseIdentityRows,validateStage10Config,installPatches,browserBoot};
});
