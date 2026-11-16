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

function starterAcquisitionYear(acquisitionYear){
  if(acquisitionYear==null||acquisitionYear==='')return POLICY.taxYear;
  const year=Math.round(Number(acquisitionYear));
  return Number.isFinite(year)?year:POLICY.taxYear;
}

function starterLimitForAcquisitionYear(acquisitionYear){
  return starterAcquisitionYear(acquisitionYear)>=2027
    ?POLICY.transferTax.starterExemptionValueLimitFrom2027
    :POLICY.transferTax.starterExemptionValueLimit;
}

const RULES_2026=Object.freeze({
  starterValueLimit:POLICY.transferTax.starterExemptionValueLimit,
  starterValueLimitFrom2027:POLICY.transferTax.starterExemptionValueLimitFrom2027,
  mainResidenceTransferTaxRate:POLICY.transferTax.mainResidenceRate,
  otherResidenceTransferTaxRate:POLICY.transferTax.otherResidenceRate,
  otherRealEstateTransferTaxRate:POLICY.transferTax.otherRealEstateRate,
  nhgLimit:POLICY.nhg.standardLimit,
  nhgEnergyLimit:POLICY.nhg.energyLimit,
  nhgFeeRate:POLICY.nhg.feeRate,
  standardLtvLimit:POLICY.ltv.standardLimit
});

function transferTax2026({propertyValue=0,mode='main',manualAmount=0,acquisitionYear}={}){
  const value=nonNegative(propertyValue);
  if(mode==='manual')return{amount:nonNegative(manualAmount),rate:null,mode,starterEligible:null,propertyValue:value};
  if(mode==='starter'){
    const year=starterAcquisitionYear(acquisitionYear);
    const limit=starterLimitForAcquisitionYear(year);
    const eligible=value>0&&value<=limit;
    const rate=eligible?0:RULES_2026.mainResidenceTransferTaxRate;
    return{
      amount:value*rate,
      rate,
      mode,
      propertyValue:value,
      acquisitionYear:year,
      starterLimit:limit,
      starterEligible:eligible,
      warning:eligible?'':`Starter exemption cannot apply above €${limit.toLocaleString('en-US')} in ${year}; ${(RULES_2026.mainResidenceTransferTaxRate*100).toLocaleString('nl-NL')}% main-residence transfer tax is used instead.`
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
  const cashGap=Math.max(0,loan-value);
  return{
    ratio,
    percentage:ratio*100,
    cashGap,
    ownFundsNeeded:cashGap,
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
  nhgMode='none',
  acquisitionYear,
  yearlyCanon=0,
  groundRentBoughtOff=false,
  boughtOff=false,
  groundRentPerpetual,
  perpetual,
  notaryCapitalisedCanon,
  notaryAmount,
  unencumberedValue,
  notaryTransferDate
}={}){
  const price=nonNegative(housePrice);
  const savings=nonNegative(ownSavings);
  const appraisal=nonNegative(appraisedValue)||price;
  const base=nonNegative(baseCosts);
  const acquired=taxableAcquisitionValue({price,appraisal,yearlyCanon,boughtOff:groundRentBoughtOff===true||boughtOff===true,perpetual:groundRentPerpetual||perpetual,notaryAmount:notaryCapitalisedCanon??notaryAmount,unencumberedValue,notaryTransferDate,acquisitionYear});
  const transferTaxBase=transferTaxMode==='manual'?Math.max(price,appraisal):acquired.transferTaxBase;
  const transfer=transferTax2026({propertyValue:transferTaxBase,mode:transferTaxMode,manualAmount:manualTransferTax,acquisitionYear:acquired.acquisitionYear});
  transfer.erfpachtNote=acquired.undetermined&&transferTaxMode==='starter'?acquired.note:'';
  transfer.taxableAcquisition=acquired;

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


const ERFPACHT_CANON_MULTIPLE=17;
const ERFPACHT_STARTER_UNDETERMINED_NOTE='We can\'t tell whether the starter exemption applies, because it depends on the ground rent (erfpacht) details. This estimate uses the standard 2% transfer tax. Your notary can confirm.';
const ERFPACHT_INCLUDED_NOTE_2026='Includes 17 × your yearly ground rent in the value test (€555,000 limit in 2026).';
const ERFPACHT_INCLUDED_NOTE_FROM_2027='Includes 17 × your yearly ground rent in the value test (€615,000 limit for transfers from 1 Jan 2027).';
const ERFPACHT_ABOVE_STARTER_LIMIT_NOTE='Based on 17 × your yearly ground rent, the value is above the starter limit. The exemption may still apply if your notary calculates it differently. Check with your notary.';
const ERFPACHT_NOTARY_INCLUDED_NOTE_2026='Includes the capitalised ground rent from your notary in the value test (€555,000 limit in 2026).';
const ERFPACHT_NOTARY_INCLUDED_NOTE_FROM_2027='Includes the capitalised ground rent from your notary in the value test (€615,000 limit for transfers from 1 Jan 2027).';
const ERFPACHT_NOTARY_ABOVE_STARTER_LIMIT_NOTE='Based on the capitalised ground rent from your notary, the value is above the starter limit.';

function transferYear({notaryTransferDate,acquisitionYear}={}){
  const text=String(notaryTransferDate||'').trim();
  const match=/^(\d{4})-\d{2}-\d{2}$/.exec(text);
  if(match)return Number(match[1]);
  return starterAcquisitionYear(acquisitionYear);
}

function enteredNotaryCanon(notaryAmount){
  if(notaryAmount==null)return null;
  const text=typeof notaryAmount==='string'?notaryAmount.trim():notaryAmount;
  if(text==='')return null;
  const amount=Number(text);
  if(!Number.isFinite(amount)||amount<0)return null;
  return amount;
}

function resolveErfpachtCanon({yearlyCanon=0,boughtOff=false,perpetual='dont-know',notaryAmount=null}={}){
  const notary=enteredNotaryCanon(notaryAmount);
  if(notary!=null)return{status:'determined',canon:notary,method:'notary'};
  const yearlyBlank=yearlyCanon==null||(typeof yearlyCanon==='string'&&yearlyCanon.trim()==='');
  const yearly=yearlyBlank?0:nonNegative(yearlyCanon);
  if(boughtOff===true||yearly<=0)return{status:'none',canon:0,method:'none'};
  if(perpetual==='yes')return{status:'determined',canon:yearly*ERFPACHT_CANON_MULTIPLE,method:'seventeen'};
  return{status:'undetermined',canon:0,method:'undetermined',note:ERFPACHT_STARTER_UNDETERMINED_NOTE};
}

function starterPropertyValue({price=0,appraisal=0,canon=0,unencumberedValue=null}={}){
  const base=Math.max(nonNegative(price),nonNegative(appraisal));
  const added=base+nonNegative(canon);
  const cap=unencumberedValue==null||unencumberedValue===''||!Number.isFinite(Number(unencumberedValue))?null:nonNegative(unencumberedValue);
  const capped=cap!=null&&cap>0&&added>cap;
  return{base,uncapped:added,value:capped?cap:added,capped,unencumberedValue:cap};
}

function taxableAcquisitionValue(input={}){
  const price=nonNegative(input.price??input.housePrice);
  const appraisal=nonNegative(input.appraisal??input.appraisedValue)||price;
  const erfpacht=resolveErfpachtCanon(input);
  const year=transferYear(input);
  const limit=starterLimitForAcquisitionYear(year);
  if(erfpacht.status==='undetermined'){
    return{transferTaxBase:Math.max(price,appraisal),undetermined:true,note:erfpacht.note||ERFPACHT_STARTER_UNDETERMINED_NOTE,erfpacht,tested:null,acquisitionYear:year,starterLimit:limit,method:'undetermined'};
  }
  const tested=starterPropertyValue({price,appraisal,canon:erfpacht.canon,unencumberedValue:input.unencumberedValue});
  const canonKnown=erfpacht.method==='notary'||erfpacht.method==='seventeen';
  return{transferTaxBase:canonKnown?tested.value:Math.max(price,appraisal),undetermined:false,note:'',erfpacht,tested,acquisitionYear:year,starterLimit:limit,method:erfpacht.method};
}

function applyStarterWithErfpacht(input={}){
  const acquired=taxableAcquisitionValue(input);
  const price=nonNegative(input.price??input.housePrice);
  const appraisal=nonNegative(input.appraisal??input.appraisedValue)||price;
  const erfpacht=acquired.erfpacht;
  const year=acquired.acquisitionYear;
  const limit=acquired.starterLimit;
  if(erfpacht.status==='undetermined'){
    return{undetermined:true,eligible:false,transferTaxBase:acquired.transferTaxBase,acquisitionYear:year,starterLimit:limit,note:ERFPACHT_STARTER_UNDETERMINED_NOTE,erfpacht,method:'undetermined'};
  }
  const tested=acquired.tested;
  const eligibility=starterEligibility2026({buyerAge:input.buyerAge,mainResidence:input.mainResidence!==false,exemptionUnused:input.exemptionUnused!==false,propertyValue:tested.value,acquisitionYear:year});
  const notes=[];
  if(eligibility.eligible&&erfpacht.method==='seventeen')notes.push(year>=2027?ERFPACHT_INCLUDED_NOTE_FROM_2027:ERFPACHT_INCLUDED_NOTE_2026);
  if(erfpacht.method==='seventeen'&&tested.uncapped>limit)notes.push(ERFPACHT_ABOVE_STARTER_LIMIT_NOTE);
  if(eligibility.eligible&&erfpacht.method==='notary')notes.push(year>=2027?ERFPACHT_NOTARY_INCLUDED_NOTE_FROM_2027:ERFPACHT_NOTARY_INCLUDED_NOTE_2026);
  if(erfpacht.method==='notary'&&tested.value>limit)notes.push(ERFPACHT_NOTARY_ABOVE_STARTER_LIMIT_NOTE);
  const note=notes.join(' ');
  const propertyBase=Math.max(price,appraisal);
  const canonKnown=erfpacht.method==='notary'||erfpacht.method==='seventeen';
  return{undetermined:false,eligible:eligibility.eligible,transferTaxBase:canonKnown?tested.value:propertyBase,acquisitionYear:year,starterLimit:limit,note,erfpacht,tested,eligibility,method:erfpacht.method};
}

function starterEligibility2026({buyerAge,mainResidence=true,exemptionUnused=true,propertyValue=0,acquisitionYear}={}){
  const age=Number(buyerAge);
  const value=nonNegative(propertyValue);
  const year=starterAcquisitionYear(acquisitionYear);
  const limit=starterLimitForAcquisitionYear(year);
  const ageEligible=Number.isFinite(age)&&age>=18&&age<=34;
  const valueEligible=value>0&&value<=limit;
  const residenceEligible=Boolean(mainResidence);
  const unusedEligible=Boolean(exemptionUnused);
  const reasons=[];
  if(!ageEligible)reasons.push('buyer age must be 18–34 at acquisition');
  if(!residenceEligible)reasons.push('the property must be used as the buyer’s main residence');
  if(!unusedEligible)reasons.push('the starter exemption must not have been used before');
  if(!valueEligible)reasons.push(`the full property value must not exceed €${limit.toLocaleString('en-US')} in ${year}`);
  return{
    eligible:ageEligible&&valueEligible&&residenceEligible&&unusedEligible,
    buyerAge:Number.isFinite(age)?age:null,
    acquisitionYear:year,
    starterLimit:limit,
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
  starterExemptionUnused=true,
  acquisitionYear
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
    starterEligibility=starterEligibility2026({buyerAge,mainResidence:starterMainResidence,exemptionUnused:starterExemptionUnused,propertyValue:transferTaxBase,acquisitionYear});
    if(!starterEligibility.eligible)effectiveTransferTaxMode=starterEligibility.residenceEligible?'main':'other-home';
  }
  const transferTax=transferTax2026({propertyValue:transferTaxBase,mode:effectiveTransferTaxMode,manualAmount:manualTransferTax,acquisitionYear});
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

const JOINT_INTRO='Buying with someone else? Each buyer is checked on their own. The starter exemption only covers the part of the home that a starter buys. The price limit is for the whole home, not for each part.';
const JOINT_UNAVAILABLE='We can\'t work out transfer tax for this purchase yet. Please ask your notary for the amount and enter it here.';
const TRANSFER_2027_NOTE='The government plans to lower this tax from 8% to 7% from 1 January 2027. This is not law yet: the Eerste Kamer still has to vote (status 16 Nov 2026). We use 8%.';

function formatJointEuro(amount){return '€'+Math.round(Number(amount)||0).toLocaleString('en-US');}

function jointPartLine(parts){
  const [a,c]=parts;
  return `Your part: ${a.share}% · Tax on your part: ${formatJointEuro(a.amount)}. Your co-buyer's part: ${c.share}% · Tax on their part: ${formatJointEuro(c.amount)}.`;
}

function jointBuyerRate(buyer,value,year){
  const main=buyer.mainHome!==false&&buyer.mainResidence!==false;
  if(!main)return{rate:RULES_2026.otherResidenceTransferTaxRate,eligible:false,mainHome:false};
  const limit=starterLimitForAcquisitionYear(year);
  const age=Number(buyer.age);
  const used=buyer.usedBefore===true||buyer.exemptionUnused===false;
  const ageOk=Number.isFinite(age)&&age>=18&&age<=34;
  const eligible=value>0&&value<=limit&&ageOk&&!used;
  return{rate:eligible?0:RULES_2026.mainResidenceTransferTaxRate,eligible,mainHome:true};
}

function jointAcquisitionTax({propertyValue=0,buyers=null,buyerCount=null,notaryTransferDate,acquisitionYear,sharesUnknown=false}={}){
  const year=transferYear({notaryTransferDate,acquisitionYear});
  const value=nonNegative(propertyValue);
  const count=buyerCount==null?(Array.isArray(buyers)?buyers.length:1):Number(buyerCount);
  if(count>=3||sharesUnknown||!Array.isArray(buyers)||buyers.length!==2){
    return{available:false,automatic:false,amount:null,line:JOINT_UNAVAILABLE,intro:JOINT_INTRO,acquisitionYear:year,wholeValue:value};
  }
  const shareSum=buyers.reduce((sum,buyer)=>sum+Number(buyer.share||0),0);
  if(Math.abs(shareSum-100)>.05)return{available:false,automatic:false,amount:null,line:JOINT_UNAVAILABLE,intro:JOINT_INTRO,reason:'shares',acquisitionYear:year,wholeValue:value};
  const parts=buyers.map(buyer=>{
    const rated=jointBuyerRate(buyer,value,year);
    const share=Number(buyer.share);
    return{share,rate:rated.rate,eligible:rated.eligible,mainHome:rated.mainHome,amount:value*(share/100)*rated.rate};
  });
  const amount=parts.reduce((sum,part)=>sum+part.amount,0);
  const nonMain=parts.some(part=>!part.mainHome);
  return{available:true,automatic:true,amount,parts,line:jointPartLine(parts),intro:JOINT_INTRO,acquisitionYear:year,starterLimit:starterLimitForAcquisitionYear(year),wholeValue:value,proposalNote:nonMain&&year>=2027?TRANSFER_2027_NOTE:''};
}

function residentialNonMainProposalNote({transferTaxMode,notaryTransferDate,acquisitionYear,mainHome=true}={}){
  const year=transferYear({notaryTransferDate,acquisitionYear});
  const eightPercent=transferTaxMode==='other-home'||mainHome===false;
  return eightPercent&&year>=2027?TRANSFER_2027_NOTE:'';
}

return{RULES_2026,starterAcquisitionYear,starterLimitForAcquisitionYear,transferYear,resolveErfpachtCanon,starterPropertyValue,taxableAcquisitionValue,applyStarterWithErfpacht,jointAcquisitionTax,residentialNonMainProposalNote,JOINT_INTRO,JOINT_UNAVAILABLE,TRANSFER_2027_NOTE,ERFPACHT_CANON_MULTIPLE,ERFPACHT_STARTER_UNDETERMINED_NOTE,ERFPACHT_INCLUDED_NOTE_2026,ERFPACHT_INCLUDED_NOTE_FROM_2027,ERFPACHT_ABOVE_STARTER_LIMIT_NOTE,ERFPACHT_NOTARY_INCLUDED_NOTE_2026,ERFPACHT_NOTARY_INCLUDED_NOTE_FROM_2027,ERFPACHT_NOTARY_ABOVE_STARTER_LIMIT_NOTE,transferTax2026,nhg2026,ltv2026,calculatePurchase2026,starterEligibility2026,calculateScenarioPurchase2026};
});
