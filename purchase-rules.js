(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PurchaseRules=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';

const nonNegative=v=>Math.max(0,Number(v)||0);

const RULES_2026={
  starterValueLimit:555000,
  mainResidenceTransferTaxRate:.02,
  otherResidenceTransferTaxRate:.08,
  otherRealEstateTransferTaxRate:.104,
  nhgLimit:470000,
  nhgEnergyLimit:498200,
  nhgFeeRate:.004,
  standardLtvLimit:1
};

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
      warning:eligible?'':'Starter exemption cannot apply above €555,000 in 2026; 2% main-residence transfer tax is used instead.'
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
  else if(energy&&loan>RULES_2026.nhgLimit)warning='NHG above €470,000 is only available for qualifying energy-saving measures; the amount above the normal limit must be used for those measures.';

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

return{RULES_2026,transferTax2026,nhg2026,ltv2026,calculatePurchase2026};
});
