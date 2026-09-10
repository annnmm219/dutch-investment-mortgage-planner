(function(root,factory){
  const Policy2026=typeof module==='object'&&module.exports?require('./policy-2026.js'):root.Policy2026;
  const api=factory(Policy2026);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PurchaseRules=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Policy2026){
'use strict';
if(!Policy2026)throw new Error('Policy2026 is required by PurchaseRules');
const POLICY=Policy2026.VALUES;

const nonNegative=v=>Math.max(0,Number(v)||0);

const RULES_2026=Object.freeze({
  starterValueLimit:POLICY.transferTax.starterExemptionValueLimit,
  mainResidenceTransferTaxRate:POLICY.transferTax.mainResidenceRate,
  otherResidenceTransferTaxRate:POLICY.transferTax.otherResidenceRate,
  otherRealEstateTransferTaxRate:POLICY.transferTax.otherRealEstateRate,
  nhgLimit:POLICY.nhg.standardLimit,
  nhgEnergyLimit:POLICY.nhg.energyLimit,
  nhgFeeRate:POLICY.nhg.feeRate,
  standardLtvLimit:POLICY.ltv.standardLimit
});

function transferTax2026({propertyValue=0,mode='main',manualAmount=0}={}){
  const value=nonNegative(propertyValue);
  if(mode==='manual')return{amount:nonNegative(manualAmount),rate:null,mode,starterEligible:null,propertyValue:value};
  if(mode==='starter'){
    const eligible=value>0&&value<=RULES_2026.starterValueLimit;
    const rate=eligible?0:RULES_2026.mainResidenceTransferTaxRate;
    return{
      amount:value*rate,
      rate,
      mode,
      propertyValue:value,
      starterEligible:eligible,
      warning:eligible?'':`Starter exemption cannot apply above €${RULES_2026.starterValueLimit.toLocaleString('en-US')} in 2026; ${(RULES_2026.mainResidenceTransferTaxRate*100).toLocaleString('nl-NL')}% main-residence transfer tax is used instead.`
    };
  }
  if(mode==='other-home')return{amount:value*RULES_2026.otherResidenceTransferTaxRate,rate:RULES_2026.otherResidenceTransferTaxRate,mode,propertyValue:value,starterEligible:null};
  if(mode==='other-real-estate')return{amount:value*RULES_2026.otherRealEstateTransferTaxRate,rate:RULES_2026.otherRealEstateTransferTaxRate,mode,propertyValue:value,starterEligible:null};
  return{amount:value*RULES_2026.mainResidenceTransferTaxRate,rate:RULES_2026.mainResidenceTransferTaxRate,mode:'main',propertyValue:value,starterEligible:null};
}

function nhg2026({purchasePrice=0,appraisedValue=0,mortgageAmount=0,mode='none'}={}){
  const purchase=nonNegative(purchasePrice);
  const appraisal=nonNegative(appraisedValue)||purchase;
  const loan=nonNegative(mortgageAmount);
  if(mode==='none')return{enabled:false,eligible:false,limit:0,fee:0,referenceValue:Math.min(...[purchase,appraisal].filter(x=>x>0)),warning:''};

  const energy=mode==='energy';
  const limit=energy?RULES_2026.nhgEnergyLimit:RULES_2026.nhgLimit;
  const values=[purchase,appraisal].filter(x=>x>0);
  const referenceValue=values.length?Math.min(...values):0;
  const eligibleByValue=referenceValue>0&&referenceValue<=limit;
  const eligibleByLoan=loan<=limit;
  const eligible=eligibleByValue&&eligibleByLoan;
  let warning='';
  if(!eligibleByValue)warning=`The lower of purchase price and appraised value exceeds the ${energy?'energy-enhanced ':''}2026 NHG planning limit of €${limit.toLocaleString('nl-NL')}.`;
  else if(!eligibleByLoan)warning=`The mortgage exceeds the ${energy?'energy-enhanced ':''}2026 NHG planning limit of €${limit.toLocaleString('nl-NL')}.`;
  else if(energy&&loan>RULES_2026.nhgLimit)warning=`NHG above €${RULES_2026.nhgLimit.toLocaleString('en-US')} is only available for qualifying energy-saving measures; the amount above the normal limit must be used for those measures.`;

  return{
    enabled:true,
    eligible,
    energy,
    limit,
    fee:eligible?loan*RULES_2026.nhgFeeRate:0,
    feeRate:RULES_2026.nhgFeeRate,
    referenceValue,
    eligibleByValue,
    eligibleByLoan,
    warning
  };
}

function ltv2026({mortgageAmount=0,appraisedValue=0}={}){
  const loan=nonNegative(mortgageAmount);
  const value=nonNegative(appraisedValue);
  const ratio=value>0?loan/value:0;
  return{
    ratio,
    percentage:ratio*100,
    standardLimit:RULES_2026.standardLtvLimit,
    overStandardLimit:value>0&&ratio>RULES_2026.standardLtvLimit+1e-9,
    warning:value>0&&ratio>RULES_2026.standardLtvLimit+1e-9
      ?'The planned mortgage exceeds 100% of the entered market value. Dutch mortgages are generally capped at 100% LTV, subject to specific exceptions such as qualifying energy measures.'
      :''
  };
}

function calculatePurchase2026({
  housePrice=0,
  ownSavings=0,
  baseCosts=0,
  transferTaxMode='main',
  manualTransferTax=0,
  appraisedValue=0,
  nhgMode='none'
}={}){
  const price=nonNegative(housePrice);
  const savings=nonNegative(ownSavings);
  const appraisal=nonNegative(appraisedValue)||price;
  const base=nonNegative(baseCosts);
  // Dutch transfer tax is based on economic value, which is at least the consideration paid.
  // In this planning model the entered appraisal is our market-value proxy, so the automatic tax base is the higher of price and appraisal.
  const transferTaxBase=Math.max(price,appraisal);
  const transfer=transferTax2026({propertyValue:transferTaxBase,mode:transferTaxMode,manualAmount:manualTransferTax});

  let nhgFee=0;
  let loan=0;
  let totalCosts=0;
  let nhg=nhg2026({purchasePrice:price,appraisedValue:appraisal,mortgageAmount:0,mode:nhgMode});
  for(let i=0;i<12;i++){
    totalCosts=base+transfer.amount+nhgFee;
    const savingsAfterCosts=Math.max(0,savings-totalCosts);
    loan=Math.max(0,price-savingsAfterCosts);
    nhg=nhg2026({purchasePrice:price,appraisedValue:appraisal,mortgageAmount:loan,mode:nhgMode});
    const nextFee=nhg.fee;
    if(Math.abs(nextFee-nhgFee)<.01){nhgFee=nextFee;break;}
    nhgFee=nextFee;
  }
  totalCosts=base+transfer.amount+nhgFee;
  const savingsAfterCosts=Math.max(0,savings-totalCosts);
  const shortfall=Math.max(0,totalCosts-savings);
  loan=Math.max(0,price-savingsAfterCosts);
  nhg=nhg2026({purchasePrice:price,appraisedValue:appraisal,mortgageAmount:loan,mode:nhgMode});
  nhgFee=nhg.fee;
  totalCosts=base+transfer.amount+nhgFee;
  const ltv=ltv2026({mortgageAmount:loan,appraisedValue:appraisal});

  return{
    housePrice:price,
    ownSavings:savings,
    appraisedValue:appraisal,
    transferTaxBase,
    baseCosts:base,
    transferTax:transfer,
    nhg,
    nhgFee,
    totalCosts,
    savingsAfterCosts:Math.max(0,savings-totalCosts),
    shortfall:Math.max(0,totalCosts-savings),
    requiredLoan:loan,
    ltv
  };
}


function starterEligibility2026({buyerAge,mainResidence=true,exemptionUnused=true,propertyValue=0}={}){
  const age=Number(buyerAge);
  const value=nonNegative(propertyValue);
  const ageEligible=Number.isFinite(age)&&age>=18&&age<=34;
  const valueEligible=value>0&&value<=RULES_2026.starterValueLimit;
  const residenceEligible=Boolean(mainResidence);
  const unusedEligible=Boolean(exemptionUnused);
  const reasons=[];
  if(!ageEligible)reasons.push('buyer age must be 18–34 at acquisition');
  if(!residenceEligible)reasons.push('the property must be used as the buyer’s main residence');
  if(!unusedEligible)reasons.push('the starter exemption must not have been used before');
  if(!valueEligible)reasons.push(`the full property value must not exceed €${RULES_2026.starterValueLimit.toLocaleString('en-US')} in 2026`);
  return{
    eligible:ageEligible&&valueEligible&&residenceEligible&&unusedEligible,
    buyerAge:Number.isFinite(age)?age:null,
    ageEligible,
    valueEligible,
    residenceEligible,
    unusedEligible,
    propertyValue:value,
    reasons
  };
}

function calculateScenarioPurchase2026({
  housePrice=0,
  downPayment=0,
  availableSavings=0,
  baseCosts=0,
  transferTaxMode='main',
  manualTransferTax=0,
  appraisedValue=0,
  nhgMode='none',
  buyerAge=35,
  starterMainResidence=true,
  starterExemptionUnused=true
}={}){
  const price=nonNegative(housePrice);
  const cash=nonNegative(availableSavings);
  const appraisal=nonNegative(appraisedValue)||price;
  const down=nonNegative(downPayment);
  const base=nonNegative(baseCosts);
  const errors=[];
  if(price<=0)errors.push({code:'property-price-required',message:'Enter a property price greater than zero.'});
  if(down>price+.005)errors.push({code:'buyer-cash-exceeds-price',message:`Buyer cash toward the purchase price exceeds the property price by ${(down-price).toFixed(2)}.`});

  const transferTaxBase=Math.max(price,appraisal);
  const requestedTransferTaxMode=['main','starter','other-home','other-real-estate','manual'].includes(transferTaxMode)?transferTaxMode:'main';
  let effectiveTransferTaxMode=requestedTransferTaxMode;
  let starterEligibility=null;
  if(requestedTransferTaxMode==='starter'){
    starterEligibility=starterEligibility2026({buyerAge,mainResidence:starterMainResidence,exemptionUnused:starterExemptionUnused,propertyValue:transferTaxBase});
    if(!starterEligibility.eligible)effectiveTransferTaxMode=starterEligibility.residenceEligible?'main':'other-home';
  }
  const transferTax=transferTax2026({propertyValue:transferTaxBase,mode:effectiveTransferTaxMode,manualAmount:manualTransferTax});
  transferTax.requestedMode=requestedTransferTaxMode;
  transferTax.effectiveMode=effectiveTransferTaxMode;
  transferTax.starterEligibility=starterEligibility;
  if(requestedTransferTaxMode==='starter'&&!starterEligibility?.eligible){
    transferTax.warning=`Starter exemption not applied: ${starterEligibility.reasons.join('; ')}. ${effectiveTransferTaxMode==='other-home'?'The 8% residential non-main-residence rate is used.':'The 2% main-residence rate is used.'}`;
  }

  const mortgageProceeds=Math.max(0,price-Math.min(price,down));
  const nhg=nhg2026({purchasePrice:price,appraisedValue:appraisal,mortgageAmount:mortgageProceeds,mode:nhgMode});
  if(nhg.enabled&&!nhg.eligible)errors.push({code:'nhg-ineligible',message:nhg.warning||'The selected NHG route is not eligible for these scenario inputs.'});
  const nhgFee=nhg.fee;
  const totalCosts=base+transferTax.amount+nhgFee;
  const buyerCashForCosts=totalCosts;
  const totalBuyerCash=down+buyerCashForCosts;
  const totalUses=price+totalCosts;
  const totalSources=mortgageProceeds+totalBuyerCash;
  const identityDifference=totalSources-totalUses;
  const fundingShortfall=Math.max(0,totalBuyerCash-cash);
  const remainingSavings=Math.max(0,cash-totalBuyerCash);
  if(fundingShortfall>.005)errors.push({code:'purchase-cash-shortfall',message:`Starting savings are ${fundingShortfall.toFixed(2)} below the complete cash-at-closing requirement.`});
  if(Math.abs(identityDifference)>.005)errors.push({code:'sources-uses-mismatch',message:`Purchase sources and uses differ by ${Math.abs(identityDifference).toFixed(2)}.`});
  const ltv=ltv2026({mortgageAmount:mortgageProceeds,appraisedValue:appraisal});
  const warnings=[transferTax.warning,nhg.warning,ltv.warning].filter(Boolean);

  return{
    source:'scenario-local-2026-rules',
    valid:errors.length===0,
    propertyPrice:price,
    appraisedValue:appraisal,
    availableSavings:cash,
    baseCosts:base,
    transferTaxBase,
    transferTax,
    nhg,
    nhgFee,
    transactionCosts:totalCosts,
    totalCosts,
    buyerCashTowardPrice:down,
    buyerCashForCosts,
    totalBuyerCash,
    mortgageProceeds,
    totalUses,
    totalSources,
    identityDifference,
    remainingSavings,
    fundingShortfall,
    shortfall:fundingShortfall,
    funded:fundingShortfall<=.005,
    ltv,
    warnings,
    errors
  };
}

return{RULES_2026,transferTax2026,nhg2026,ltv2026,calculatePurchase2026,starterEligibility2026,calculateScenarioPurchase2026};
});
