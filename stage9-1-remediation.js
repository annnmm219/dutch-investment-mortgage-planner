(function(root,factory){
  const FC=typeof module==='object'&&module.exports?require('./finance-core.js'):root.FinanceCore;
  const PR=typeof module==='object'&&module.exports?require('./purchase-rules.js'):root.PurchaseRules;
  const SC=typeof module==='object'&&module.exports?require('./scenario-engine.js'):root.ScenarioCore;
  const NE=typeof module==='object'&&module.exports?require('./next-euro.js'):root.NextEuroCore;
  const api=factory(FC,PR,SC,NE,root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.Stage91Remediation=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(FC,PR,SC,NE,root){
'use strict';
if(!FC||!PR||!SC)throw new Error('Stage 9.1 requires FinanceCore, PurchaseRules and ScenarioCore');

const VERSION='R6.6-stage9.1';
const SNAPSHOT_KEY='dimp.stage91.scenario-state.v1';
const TOL=.005;
const nonNegative=v=>Math.max(0,Number(v)||0);
const finite=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const clone=v=>JSON.parse(JSON.stringify(v||{}));
const isPurchase=mode=>mode==='buy-rent'||mode==='downpayment';
const isNonMain=rules=>['other-home','other-real-estate'].includes(rules?.transferTaxMode)||rules?.starterMainResidence===false;
const strategyNames=mode=>mode==='buy-rent'?['Buy home','Rent + invest']:mode==='downpayment'?['Larger down payment','Smaller down payment']:mode==='mortgage-invest'?['Repay mortgage','Invest instead']:mode==='linear-annuity'?['Linear mortgage','Annuity mortgage']:['Keep home','Sell now + rent/invest'];

function invalidScenario(reason,mode=''){
  const [a,b]=strategyNames(mode);
  const blank=name=>({name,net:0,invest:0,savings:0,box3Debt:0,financial:0,mortgage:0,interest:0,mortTax:0,rent:0,owner:0,purchase:0,box3:0,unsettledBox3:0,externalTax:0,externalDebtRepayment:0,box3DebtInterest:0,short:0,label:'Final comparable wealth'});
  return{valid:false,reason:String(reason),A:blank(a),B:blank(b),note:String(reason),cashA:[],cashB:[],budgetSeries:[],peakRequirement:0,firstRequirement:0};
}

function enhancedNhgRequirement({purchasePrice=0,appraisedValue=0,mortgageAmount=0}={}){
  const standard=PR.RULES_2026.nhgLimit;
  const values=[nonNegative(purchasePrice),nonNegative(appraisedValue)].filter(x=>x>0);
  const referenceValue=values.length?Math.min(...values):0;
  return Math.max(0,nonNegative(mortgageAmount)-standard,referenceValue-standard);
}

function nhg2026({purchasePrice=0,appraisedValue=0,mortgageAmount=0,mode='none',qualifyingEnergyExpenditure=0}={}){
  const purchase=nonNegative(purchasePrice),appraisal=nonNegative(appraisedValue)||purchase,loan=nonNegative(mortgageAmount),energySpend=nonNegative(qualifyingEnergyExpenditure);
  const values=[purchase,appraisal].filter(x=>x>0),referenceValue=values.length?Math.min(...values):0;
  if(mode==='none')return{enabled:false,eligible:false,energy:false,limit:0,fee:0,referenceValue,qualifyingEnergyExpenditure:energySpend,requiredEnergyExpenditure:0,eligibleByEnergySpend:true,warning:''};
  const energy=mode==='energy';
  const limit=energy?PR.RULES_2026.nhgEnergyLimit:PR.RULES_2026.nhgLimit;
  const eligibleByValue=referenceValue>0&&referenceValue<=limit+TOL;
  const eligibleByLoan=loan<=limit+TOL;
  const requiredEnergyExpenditure=energy?enhancedNhgRequirement({purchasePrice:purchase,appraisedValue:appraisal,mortgageAmount:loan}):0;
  const eligibleByEnergySpend=!energy||energySpend+TOL>=requiredEnergyExpenditure;
  const eligible=eligibleByValue&&eligibleByLoan&&eligibleByEnergySpend;
  let warning='';
  if(!eligibleByValue)warning=`The lower of purchase price and appraised value exceeds the ${energy?'energy-enhanced ':''}2026 NHG planning limit of €${limit.toLocaleString('nl-NL')}.`;
  else if(!eligibleByLoan)warning=`The mortgage exceeds the ${energy?'energy-enhanced ':''}2026 NHG planning limit of €${limit.toLocaleString('nl-NL')}.`;
  else if(!eligibleByEnergySpend)warning=`Enhanced NHG requires at least €${Math.ceil(requiredEnergyExpenditure).toLocaleString('nl-NL')} of qualifying energy expenditure for these inputs; only €${Math.round(energySpend).toLocaleString('nl-NL')} is entered.`;
  return{enabled:true,eligible,energy,limit,fee:eligible?loan*PR.RULES_2026.nhgFeeRate:0,feeRate:PR.RULES_2026.nhgFeeRate,referenceValue,eligibleByValue,eligibleByLoan,qualifyingEnergyExpenditure:energySpend,requiredEnergyExpenditure,eligibleByEnergySpend,warning};
}

function calculateScenarioPurchase2026(input={}){
  const price=nonNegative(input.housePrice),cash=nonNegative(input.availableSavings),appraisal=nonNegative(input.appraisedValue)||price,down=nonNegative(input.downPayment),base=nonNegative(input.baseCosts);
  const energySpend=input.nhgMode==='energy'?nonNegative(input.qualifyingEnergyExpenditure):0;
  const errors=[];
  if(price<=0)errors.push({code:'property-price-required',message:'Enter a property price greater than zero.'});
  if(down>price+TOL)errors.push({code:'buyer-cash-exceeds-price',message:`Buyer cash toward the purchase price exceeds the property price by ${(down-price).toFixed(2)}.`});
  const appraisalGap=Math.max(0,price-appraisal);
  if(down+TOL<appraisalGap)errors.push({code:'appraisal-gap-unfunded',message:`The purchase price is €${Math.round(appraisalGap).toLocaleString('nl-NL')} above the appraised value. Fund at least that appraisal gap explicitly with buyer cash.`});

  const transferTaxBase=Math.max(price,appraisal);
  const requested=['main','starter','other-home','other-real-estate','manual'].includes(input.transferTaxMode)?input.transferTaxMode:'main';
  let effective=requested,starterEligibility=null;
  if(requested==='starter'){
    starterEligibility=PR.starterEligibility2026({buyerAge:input.buyerAge,mainResidence:input.starterMainResidence!==false,exemptionUnused:input.starterExemptionUnused!==false,propertyValue:transferTaxBase});
    if(!starterEligibility.eligible)effective=starterEligibility.residenceEligible?'main':'other-home';
  }
  const transferTax=PR.transferTax2026({propertyValue:transferTaxBase,mode:effective,manualAmount:input.manualTransferTax});
  transferTax.requestedMode=requested;transferTax.effectiveMode=effective;transferTax.starterEligibility=starterEligibility;
  if(requested==='starter'&&!starterEligibility?.eligible)transferTax.warning=`Starter exemption not applied: ${starterEligibility.reasons.join('; ')}. ${effective==='other-home'?'The 8% residential non-main-residence rate is used.':'The 2% main-residence rate is used.'}`;

  const baseMortgage=Math.max(0,price-Math.min(price,down));
  const mortgageProceeds=baseMortgage+energySpend;
  const supportedEnergyAboveAppraisal=input.nhgMode==='energy'?Math.min(energySpend,appraisal*.06):0;
  const supportedLtvLoan=appraisal+supportedEnergyAboveAppraisal;
  if(mortgageProceeds>supportedLtvLoan+TOL)errors.push({code:'mortgage-above-supported-ltv',message:`The planned mortgage is €${Math.round(mortgageProceeds-supportedLtvLoan).toLocaleString('nl-NL')} above the supported appraisal-based financing limit. Increase buyer cash or reduce the mortgage.`});

  const nhg=nhg2026({purchasePrice:price,appraisedValue:appraisal,mortgageAmount:mortgageProceeds,mode:input.nhgMode,qualifyingEnergyExpenditure:energySpend});
  if(nhg.enabled&&!nhg.eligible)errors.push({code:'nhg-ineligible',message:nhg.warning||'The selected NHG route is not eligible for these scenario inputs.'});
  const nhgFee=nhg.fee,totalCosts=base+transferTax.amount+nhgFee;
  const buyerCashForCosts=totalCosts,totalBuyerCash=down+buyerCashForCosts;
  const totalUses=price+energySpend+totalCosts,totalSources=mortgageProceeds+totalBuyerCash,identityDifference=totalSources-totalUses;
  const fundingShortfall=Math.max(0,totalBuyerCash-cash),remainingSavings=Math.max(0,cash-totalBuyerCash);
  if(fundingShortfall>TOL)errors.push({code:'purchase-cash-shortfall',message:`Starting savings are ${fundingShortfall.toFixed(2)} below the complete cash-at-closing requirement.`});
  if(Math.abs(identityDifference)>TOL)errors.push({code:'sources-uses-mismatch',message:`Purchase sources and uses differ by ${Math.abs(identityDifference).toFixed(2)}.`});
  const ltv=PR.ltv2026({mortgageAmount:mortgageProceeds,appraisedValue:appraisal});
  ltv.supportedEnergyAboveAppraisal=supportedEnergyAboveAppraisal;ltv.supportedLoanLimit=supportedLtvLoan;ltv.overSupportedLimit=mortgageProceeds>supportedLtvLoan+TOL;
  const warnings=[transferTax.warning,nhg.warning,ltv.overStandardLimit&&!ltv.overSupportedLimit?'Mortgage exceeds 100% of appraisal only through the entered qualifying energy-finance allowance.':ltv.warning].filter(Boolean);
  return{source:'scenario-local-2026-rules-stage9.1',valid:errors.length===0,propertyPrice:price,appraisedValue:appraisal,availableSavings:cash,baseCosts:base,transferTaxBase,transferTax,nhg,nhgFee,qualifyingEnergyExpenditure:energySpend,transactionCosts:totalCosts,totalCosts,buyerCashTowardPrice:down,buyerCashForCosts,totalBuyerCash,mortgageProceeds,totalUses,totalSources,identityDifference,remainingSavings,fundingShortfall,shortfall:fundingShortfall,funded:fundingShortfall<=TOL,appraisalGap,minimumBuyerCashForAppraisalGap:appraisalGap,ltv,warnings,errors};
}

function simulateInvestmentFlowsStage91(args={},property={}){
  const flows=Array.isArray(args.flows)?args.flows:[];
  const monthlyReturn=FC.effectiveAnnualPctToMonthly(args.annualReturnPct),monthlySavingsRate=FC.effectiveAnnualPctToMonthly(args.savingsReturnPct),monthlyDebtRate=FC.nominalAnnualPctToMonthly(args.debtInterestPct);
  let portfolio=nonNegative(args.initialPortfolio),savings=nonNegative(args.box3Savings),debt=nonNegative(args.box3Debt);
  let totalTax=0,currentTax=0,futureTax=0,unsettledTaxEstimate=0,externalTax=0,taxPaidFromSavings=0,taxPaidFromPortfolio=0,lossCarry=0;
  let externalDebtRepayment=0,totalDebtRepaid=0,totalDebtInterest=0,cashShortfall=0;
  let plannedBox3DebtRepayment=0,unusedBox3DebtRepayment=0,box3DebtFallbackInvested=0,box3DebtFallbackSaved=0,box3DebtFallbackConsumed=0,box3DebtRepaymentShortfall=0,externalBox3DebtFallback=0;
  let year=finite(args.startYear,2026),month=FC.clamp(finite(args.startMonth,1),1,12),yearStartPortfolio=portfolio,yearStartSavings=savings,yearStartDebt=debt;
  let marketGain=0,savingsIncome=0,debtInterest=0;
  let propertyValue=nonNegative(property.startValue),propertyGain=0,propertyDebtInterest=0,propertyYearStartValue=propertyValue,propertyYearStartDebt=nonNegative(property.startDebt);
  const propertyGrowth=FC.effectiveAnnualPctToMonthly(property.growthPct||0),propertyDebtRows=Array.isArray(property.debtRows)?property.debtRows:[];
  const yearBuckets={},series=[],monthlySavingsFlows=Array.isArray(args.savingsFlows)?args.savingsFlows:[],monthlyDebtRepayments=Array.isArray(args.debtRepayments)?args.debtRepayments:[],externalCashFlows=Array.from({length:flows.length},()=>0);
  const paySource=args.paySource||'portfolio',debtRepaymentSource=args.debtRepaymentSource==='savings'?'savings':'external',fallback=['invest','savings','consume'].includes(args.box3DebtFallbackDestination)?args.box3DebtFallbackDestination:'invest';
  for(let i=0;i<flows.length;i++){
    const growth=portfolio*monthlyReturn;portfolio+=growth;marketGain+=growth;portfolio+=nonNegative(flows[i]);
    const saveInterest=savings*monthlySavingsRate;savings+=saveInterest;savingsIncome+=saveInterest;
    const interestOnDebt=debt*monthlyDebtRate;debtInterest+=interestOnDebt;totalDebtInterest+=interestOnDebt;externalCashFlows[i]+=interestOnDebt;
    const propGrowth=propertyValue*propertyGrowth;propertyValue+=propGrowth;propertyGain+=propGrowth;
    const propInterest=nonNegative(propertyDebtRows[i]?.interest);propertyDebtInterest+=propInterest;
    const savingFlow=finite(monthlySavingsFlows[i],0);if(savingFlow>=0)savings+=savingFlow;else{const req=-savingFlow,used=Math.min(savings,req),shortfall=req-used;savings-=used;cashShortfall+=shortfall;externalCashFlows[i]+=shortfall;}
    const requested=monthlyDebtRepayments.length?nonNegative(monthlyDebtRepayments[i]):nonNegative(args.box3DebtMonthlyRepayment);plannedBox3DebtRepayment+=requested;
    const available=debtRepaymentSource==='savings'?Math.min(requested,savings):requested,repay=Math.min(debt,available);
    if(repay>0){if(debtRepaymentSource==='savings')savings-=repay;else{externalDebtRepayment+=repay;externalCashFlows[i]+=repay;}debt-=repay;totalDebtRepaid+=repay;}
    const budgetShortfall=Math.max(0,requested-available),unused=Math.max(0,available-repay);box3DebtRepaymentShortfall+=budgetShortfall;unusedBox3DebtRepayment+=unused;
    if(unused>0){if(fallback==='savings'){if(debtRepaymentSource!=='savings'){savings+=unused;externalBox3DebtFallback+=unused;externalCashFlows[i]+=unused;}box3DebtFallbackSaved+=unused;}else if(fallback==='consume'){if(debtRepaymentSource==='savings')savings-=unused;box3DebtFallbackConsumed+=unused;}else{if(debtRepaymentSource==='savings')savings-=unused;else{externalBox3DebtFallback+=unused;externalCashFlows[i]+=unused;}portfolio+=unused;box3DebtFallbackInvested+=unused;}}
    const nextMonth=month===12?1:month+1,nextYear=month===12?year+1:year,endYear=nextYear!==year,finalMonth=i===flows.length-1;
    if(endYear||finalMonth){
      const regime=FC.regimeForYear({mode:args.box3Mode||'none',year,futureStart:finite(args.futureStart,2028)}),firstYear=year===finite(args.startYear,2026),firstPartial=firstYear&&finite(args.startMonth,1)>1;
      const jan1Portfolio=firstPartial?nonNegative(args.firstJan1Portfolio):nonNegative(yearStartPortfolio),jan1Savings=firstPartial&&args.firstJan1Savings!=null?nonNegative(args.firstJan1Savings):nonNegative(yearStartSavings),jan1Debt=firstPartial&&args.firstJan1Debt!=null?nonNegative(args.firstJan1Debt):nonNegative(yearStartDebt);
      const jan1Property=firstPartial?0:nonNegative(propertyYearStartValue),jan1PropertyDebt=firstPartial?0:nonNegative(propertyYearStartDebt);
      const common={regime,jan1Portfolio:jan1Portfolio+jan1Property,jan1Savings,jan1Debt:jan1Debt+jan1PropertyDebt,marketGain:marketGain+propertyGain,savingsIncome,debtInterest:debtInterest+propertyDebtInterest,lossCarry,taxPartners:finite(args.taxPartners,1),currentTaxRate:finite(args.currentTaxRate,.36),currentAllowance:nonNegative(args.currentAllowance??59357),currentNotional:finite(args.currentNotional,.06),currentSavingsNotional:finite(args.currentSavingsNotional,.0128),currentDebtNotional:finite(args.currentDebtNotional,.027),currentDebtThreshold:nonNegative(args.currentDebtThreshold??3800),futureTaxRate:finite(args.futureTaxRate,.36),futureExempt:nonNegative(args.futureExempt??1800),futureLossThreshold:nonNegative(args.futureLossThreshold??500)};
      const canSettle=endYear&&!(firstPartial&&regime==='future');
      const taxResult=FC.box3TaxForYear({...common,allowActualRebuttal:canSettle&&!(firstPartial&&regime==='current')});
      const beforePortfolio=portfolio,beforeSavings=savings,beforeDebt=debt;
      let paid={portfolio,savings,fromPortfolio:0,fromSavings:0,external:0};
      if(canSettle){lossCarry=taxResult.lossCarry;totalTax+=taxResult.tax;if(regime==='current')currentTax+=taxResult.tax;if(regime==='future')futureTax+=taxResult.tax;paid=FC.payTaxFromSource({tax:taxResult.tax,paySource,portfolio,savings});portfolio=paid.portfolio;savings=paid.savings;externalTax+=paid.external;externalCashFlows[i]+=paid.external;taxPaidFromSavings+=paid.fromSavings;taxPaidFromPortfolio+=paid.fromPortfolio;}else unsettledTaxEstimate+=taxResult.tax;
      yearBuckets[year]={year,regime,settled:canSettle,jan1Portfolio,jan1Savings,jan1Debt,box3OtherPropertyValue:jan1Property,box3PropertyDebt:jan1PropertyDebt,propertyGain,propertyDebtInterest,marketGain,savingsIncome,debtInterest,endPortfolioBeforeTax:beforePortfolio,endSavingsBeforeTax:beforeSavings,endDebt:beforeDebt,endBeforeTax:beforePortfolio,box3Tax:canSettle?taxResult.tax:0,unsettledTax:canSettle?0:taxResult.tax,endAfterTax:portfolio,endPortfolio:portfolio,endSavings:savings,method:canSettle?taxResult.method:`unsettled estimate · ${taxResult.method}`,notionalTax:taxResult.notionalTax,actualTax:taxResult.actualTax,taxPaidFromSavings:paid.fromSavings,taxPaidFromPortfolio:paid.fromPortfolio,externalTax:paid.external};
      series.push({year,month,portfolio,savings,box3Debt:debt,netFinancialAssets:portfolio+savings-debt,box3Tax:totalTax,unsettledTaxEstimate});
      yearStartPortfolio=portfolio;yearStartSavings=savings;yearStartDebt=debt;propertyYearStartValue=propertyValue;propertyYearStartDebt=nonNegative(propertyDebtRows[i]?.balance);marketGain=0;savingsIncome=0;debtInterest=0;propertyGain=0;propertyDebtInterest=0;
    }
    year=nextYear;month=nextMonth;
  }
  const netFinancialAssets=portfolio+savings-debt,box3DebtCashConservationDifference=plannedBox3DebtRepayment-totalDebtRepaid-box3DebtFallbackInvested-box3DebtFallbackSaved-box3DebtFallbackConsumed-box3DebtRepaymentShortfall,externalCashFlowFutureValue=FC.terminalValueOfDatedCashFlows(externalCashFlows,args.annualReturnPct),householdComparableWealth=netFinancialAssets-externalCashFlowFutureValue-unsettledTaxEstimate;
  return{portfolio,savings,box3Debt:debt,netFinancialAssets,totalTax,currentTax,futureTax,unsettledTaxEstimate,externalTax,taxPaidFromSavings,taxPaidFromPortfolio,comparableWealth:householdComparableWealth,householdComparableWealth,externalDebtRepayment,totalDebtRepaid,totalDebtInterest,cashShortfall,externalCashFlows,externalCashFlowFutureValue,lossCarry,yearBuckets,series,plannedBox3DebtRepayment,unusedBox3DebtRepayment,box3DebtFallbackInvested,box3DebtFallbackSaved,box3DebtFallbackConsumed,box3DebtRepaymentShortfall,externalBox3DebtFallback,box3DebtCashConservationDifference,box3DebtFallbackDestination:fallback,nonMainPropertyBox3:propertyValue>0||nonNegative(property.startValue)>0};
}

function findAllBreakEvenReturns(baseConfig={},options={}){
  if(!NE||typeof NE.evaluate!=='function')return{valid:false,reason:'next-euro-unavailable',crossings:[],leaderRanges:[]};
  const amount=nonNegative(options.amount??options.extraMonthly??baseConfig.mortgageInvest?.extraMonthly),years=Math.max(1,finite(options.years,baseConfig.horizonYears??10));
  if(nonNegative(baseConfig.mortgage?.balance)<=0)return{valid:false,reason:'no-mortgage',crossings:[],leaderRanges:[]};
  if(amount<=0)return{valid:false,reason:'no-extra',crossings:[],leaderRanges:[]};
  let min=finite(options.minRate??options.minReturnPct,-10),max=finite(options.maxRate??options.maxReturnPct,20);if(max<min)[min,max]=[max,min];
  const defaultScanStep=(typeof document!=='undefined'&&root.__DIMP_STAGE91_TESTING)?2:.1;
  const scanStep=Math.max(.01,Math.abs(finite(options.scanStep,defaultScanStep))),rateTolerance=Math.max(.000001,Math.abs(finite(options.tolerance??options.rateTolerance,.0001))),wealthTolerance=Math.max(.01,Math.abs(finite(options.wealthTolerance,1)));
  const at=r=>typeof options.evaluate==='function'?options.evaluate(r):NE.evaluate(baseConfig,{extraMonthly:amount,years,returnPct:r});
  const points=[];for(let r=min;r<max-1e-12;r=Math.min(max,r+scanStep)){const x=at(r);if(!Number.isFinite(x.difference))return{valid:false,reason:'invalid-scenario',crossings:[],leaderRanges:[]};points.push({r,x,d:x.difference});if(r===max)break;}if(!points.length||points.at(-1).r<max-1e-9){const x=at(max);if(!Number.isFinite(x.difference))return{valid:false,reason:'invalid-scenario',crossings:[],leaderRanges:[]};points.push({r:max,x,d:x.difference});}
  const crossings=[];
  function addCross(low,high,rate,outcome){if(crossings.some(c=>Math.abs(c.rate-rate)<=Math.max(rateTolerance,1e-6)))return;crossings.push({low,high,rate,outcome});}
  for(let i=0;i<points.length;i++){
    const p=points[i];if(Math.abs(p.d)<=wealthTolerance)addCross(p.r,p.r,p.r,p.x);
    if(i===0)continue;const q=points[i-1];if(Math.abs(q.d)<=wealthTolerance||Math.abs(p.d)<=wealthTolerance||Math.sign(q.d)===Math.sign(p.d))continue;
    let low=q.r,high=p.r,a=q.x,b=p.x;for(let k=0;k<80&&high-low>rateTolerance;k++){const mid=(low+high)/2,m=at(mid);if(!Number.isFinite(m.difference))break;if(Math.abs(m.difference)<=wealthTolerance){low=high=mid;a=b=m;break;}if(Math.sign(m.difference)===Math.sign(a.difference)){low=mid;a=m}else{high=mid;b=m}}
    const rate=(low+high)/2;addCross(q.r,p.r,rate,at(rate));
  }
  crossings.sort((a,b)=>a.rate-b.rate);
  const bounds=[min,...crossings.map(c=>c.rate),max],leaderRanges=[];
  for(let i=0;i<bounds.length-1;i++){const from=bounds[i],to=bounds[i+1],probe=from===to?from:(from+to)/2,x=at(probe),leader=Math.abs(x.difference)<=wealthTolerance?'tie':x.difference>0?'invest':'repay';leaderRanges.push({from,to,leader});}
  return{valid:true,amount,years,range:[min,max],crossings,breakEvens:crossings.map(c=>c.rate),breakEven:crossings[0]?.rate??null,outcome:crossings[0]?.outcome??null,leaderRanges,multiple:crossings.length>1,leader:crossings.length?null:leaderRanges[0]?.leader,low:points[0]?.x,high:points.at(-1)?.x,scanStep};
}

let activeScenario=null;
function installCorePatches(){
  if(SC.__stage91Patched)return;
  const originalRun=SC.runScenario.bind(SC),originalResolve=SC.resolveScenarioInputSource.bind(SC),originalSim=FC.simulateInvestmentFlows.bind(FC),originalMortgage=FC.mortgageSchedule.bind(FC);
  const originalCalcPurchase=PR.calculateScenarioPurchase2026?.bind(PR);
  PR.nhg2026=nhg2026;
  PR.calculateScenarioPurchase2026=function(input={}){const merged={...input};if(activeScenario&&merged.qualifyingEnergyExpenditure==null)merged.qualifyingEnergyExpenditure=activeScenario.config.purchaseRules?.qualifyingEnergyExpenditure;return calculateScenarioPurchase2026(merged);};

  SC.resolveScenarioInputSource=function(args={}){
    const resolved=originalResolve(args);
    const rawSource=args.sourceMode==='imported'?(args.plannerData||{}):(args.freshData||{});
    if(typeof document!=='undefined'){
      const $=id=>document.getElementById(id),n=id=>{const el=$(id);return el&&el.value!==''&&Number.isFinite(Number(el.value))?Number(el.value):null;};
      const fallback=$('scenarioDebtFallbackFresh')?.value;
      resolved.commonMonthlyInvestment=nonNegative(n('scenarioCommonMonthlyInvestmentFresh'));
      const fallbackValid=['invest','savings','consume'].includes(fallback);
      resolved.box3={...(resolved.box3||{}),debtFallbackDestination:fallbackValid?fallback:null};
      resolved.stage91MissingDebtFallback=!fallbackValid;
      resolved.purchaseRules={...(resolved.purchaseRules||{}),qualifyingEnergyExpenditure:nonNegative(n('scenarioQualifyingEnergySpendNew')),hraRemainingMonths:n('scenarioPurchaseHraYearsNew')==null?null:Math.round(nonNegative(n('scenarioPurchaseHraYearsNew'))*12),qualifyingInterestFraction:n('scenarioPurchaseQualifyingDebtPctNew')==null?null:FC.clamp(n('scenarioPurchaseQualifyingDebtPctNew')/100,0,1)};
    }else{
      resolved.commonMonthlyInvestment=nonNegative(rawSource.commonMonthlyInvestment);
      const rawFallback=rawSource.box3?.debtFallbackDestination??rawSource.box3?.box3DebtFallbackDestination??resolved.box3?.debtFallbackDestination;
      resolved.box3={...(resolved.box3||{}),debtFallbackDestination:['invest','savings','consume'].includes(rawFallback)?rawFallback:'invest'};
    }
    return resolved;
  };

  FC.mortgageSchedule=function(args={}){
    if(!activeScenario||!isPurchase(activeScenario.config.mode))return originalMortgage(args);
    const rules=activeScenario.config.purchaseRules||{},tax={...(args.tax||{})};
    if(isNonMain(rules)){tax.enabled=false;tax.hraRemainingMonths=0;tax.qualifyingInterestFraction=0;tax.wozValue=0;}
    else{if(rules.hraRemainingMonths!=null)tax.hraRemainingMonths=Math.max(0,Math.round(Number(rules.hraRemainingMonths)||0));if(rules.qualifyingInterestFraction!=null)tax.qualifyingInterestFraction=FC.clamp(Number(rules.qualifyingInterestFraction)||0,0,1);}
    return originalMortgage({...args,tax});
  };

  function propertyContext(config,callIndex,flowsLength){
    if(!isPurchase(config.mode)||!isNonMain(config.purchaseRules))return null;
    if(config.mode==='buy-rent'&&callIndex!==0)return null;
    const d=config.mode==='buy-rent'?config.buyRent:config.downpayment,down=config.mode==='buy-rent'?d?.downPayment:(callIndex===0?d?.downA:d?.downB);
    const funding=calculateScenarioPurchase2026({housePrice:d?.price,downPayment:down,availableSavings:config.box3?.savings,baseCosts:d?.purchaseCosts,transferTaxMode:config.purchaseRules?.transferTaxMode,manualTransferTax:config.purchaseRules?.manualTransferTax,appraisedValue:config.purchaseRules?.appraisedValue,nhgMode:config.purchaseRules?.nhgMode,buyerAge:config.purchaseRules?.buyerAge,starterMainResidence:config.purchaseRules?.starterMainResidence,starterExemptionUnused:config.purchaseRules?.starterExemptionUnused,qualifyingEnergyExpenditure:config.purchaseRules?.qualifyingEnergyExpenditure});
    if(!funding.valid)return null;
    const debt=originalMortgage({balance:funding.mortgageProceeds,annualRatePct:d?.mortgageRatePct,termYears:d?.mortgageYears,type:d?.mortgageType,months:flowsLength,startYear:config.startYear,startMonth:config.startMonth,tax:{enabled:false,hraRemainingMonths:0,qualifyingInterestFraction:0,wozValue:0}});
    return{startValue:nonNegative(d?.wozValue||d?.price),growthPct:finite(config.homeGrowthPct,0),startDebt:funding.mortgageProceeds,debtRows:debt.rows};
  }

  FC.simulateInvestmentFlows=function(args={}){
    if(!activeScenario)return originalSim(args);
    const common=nonNegative(activeScenario.config.commonMonthlyInvestment),base=Array.isArray(args.flows)?args.flows:[],flows=base.map(v=>nonNegative(v)+common),idx=activeScenario.investmentCall++;
    const property=propertyContext(activeScenario.config,idx,flows.length)||{};
    const result=simulateInvestmentFlowsStage91({...args,flows},property);
    activeScenario.ledgers.push(clone(result));
    return result;
  };

  SC.runScenario=function(config={}){
    const c=clone(config),rules=c.purchaseRules||{};
    if(c.stage91MissingDebtFallback)return invalidScenario('Comparison unavailable: choose where the Box 3 debt repayment budget goes after the debt is repaid.',c.mode);
    if(isPurchase(c.mode)&&!isNonMain(rules)){
      if(rules.hraRemainingMonths==null||!Number.isFinite(Number(rules.hraRemainingMonths)))return invalidScenario('Comparison unavailable: enter the remaining mortgage-interest deduction years for the planned purchase.',c.mode);
      if(rules.qualifyingInterestFraction==null||!Number.isFinite(Number(rules.qualifyingInterestFraction)))return invalidScenario('Comparison unavailable: enter the percentage of the planned mortgage debt that qualifies for Box 1 mortgage-interest deduction.',c.mode);
    }
    const prev=activeScenario;activeScenario={config:c,investmentCall:0,ledgers:[]};
    try{const result=originalRun(c);return{...result,stage91Ledgers:activeScenario.ledgers};}finally{activeScenario=prev;}
  };
  Object.defineProperty(SC,'__stage91Patched',{value:true,enumerable:false});
  SC.__stage91OriginalCalculateScenarioPurchase2026=originalCalcPurchase;
}

function installNextEuroPatches(){
  if(!NE||NE.__stage91Patched)return;
  NE.findAllBreakEvenReturns=findAllBreakEvenReturns;
  NE.findBreakEvenReturn=function(baseConfig={},options={}){return findAllBreakEvenReturns(baseConfig,options);};
  NE.findBreakEven=function(baseConfig={},options={}){const r=findAllBreakEvenReturns(baseConfig,{...options,amount:options.extraMonthly??options.amount});if(!r.valid)return{status:'invalid',reason:r.reason,extraMonthly:nonNegative(options.extraMonthly??options.amount)};if(!r.crossings.length)return{status:'none',extraMonthly:r.amount,range:r.range,leader:r.leader,leaderRanges:r.leaderRanges,low:r.low,high:r.high};return{status:r.crossings.length>1?'multiple':'found',extraMonthly:r.amount,breakEvenReturnPct:r.crossings[0].rate,breakEvenReturnsPct:r.breakEvens,crossings:r.crossings,leaderRanges:r.leaderRanges,range:r.range};};
  NE.analyseNextEuro=function(baseConfig={},options={}){if(typeof document!=='undefined'){const hra=document.getElementById('nextEuroHraTreatment')?.value||'planner',box3Mode=document.getElementById('nextEuroBox3Treatment')?.value||'planner';baseConfig=clone(baseConfig);baseConfig.tax={...(baseConfig.tax||{})};baseConfig.box3={...(baseConfig.box3||{})};if(hra==='on')baseConfig.tax.enabled=true;else if(hra==='off')baseConfig.tax.enabled=false;if(box3Mode==='current')baseConfig.box3.mode='current';else if(box3Mode==='none')baseConfig.box3.mode='none';}const amount=nonNegative(options.amount??options.extraMonthly??baseConfig.mortgageInvest?.extraMonthly??500),years=Math.max(1,finite(options.years,baseConfig.horizonYears??10)),assumedReturnPct=finite(options.assumedReturnPct??options.selectedReturnPct,baseConfig.investmentReturnPct??5),quickAmounts=Array.isArray(options.quickAmounts??options.amounts)?(options.quickAmounts??options.amounts):[250,500,1000],main=findAllBreakEvenReturns(baseConfig,{...options,amount,years}),selected=NE.evaluate(baseConfig,{extraMonthly:amount,years,returnPct:assumedReturnPct}),quick=quickAmounts.map(x=>{const a=nonNegative(x),be=findAllBreakEvenReturns(baseConfig,{...options,amount:a,years}),current=NE.evaluate(baseConfig,{extraMonthly:a,years,returnPct:assumedReturnPct});return{amount:a,breakEven:be.breakEven,breakEvens:be.breakEvens,crossings:be.crossings,leaderRanges:be.leaderRanges,valid:be.valid,difference:current.difference,winner:current.leader==='invest'?'Invest':current.leader==='repay'?'Repay':current.leader==='tie'?'Tie':'Unavailable',current,crossover:be.valid?(be.crossings.length?{status:be.crossings.length>1?'multiple':'found',breakEvenReturnPct:be.breakEven,breakEvenReturnsPct:be.breakEvens}:{status:'none',leader:be.leader}):{status:'invalid'}};});return{main,amount,extraMonthly:amount,years,assumedReturnPct,selectedReturnPct:assumedReturnPct,difference:selected.difference,winner:selected.leader==='invest'?'Invest':selected.leader==='repay'?'Repay':selected.leader==='tie'?'Tie':'Unavailable',selected,quick};};
  NE.analyze=function(baseConfig={},options={}){const r=NE.analyseNextEuro(baseConfig,options);return{extraMonthly:r.extraMonthly,selectedReturnPct:r.selectedReturnPct,selected:r.selected,breakEven:NE.findBreakEven(baseConfig,{...options,extraMonthly:r.extraMonthly,years:r.years}),quick:r.quick};};
  Object.defineProperty(NE,'__stage91Patched',{value:true,enumerable:false});
}

function browserBoot(){
  if(typeof document==='undefined')return;
  const $=id=>document.getElementById(id),engine=$('decisionEngine');if(!engine)return;
  let restoring=false,sourceChanging=false;
  const css=document.createElement('style');css.textContent=`.stage91-grid{margin-top:12px}.stage91-source{font-size:10px;color:var(--secondary)}.stage91-live{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}#decisionEngine .section-note,#decisionEngine .inline,#decisionEngine .foot{color:var(--secondary)}.stage91-warning{margin-top:12px}`;document.head.appendChild(css);

  const rules=$('scenarioPurchaseRulesNew')?.querySelector('.inner-fold-body');
  if(rules&&!$('scenarioPurchaseEligibilityStage91')){const block=document.createElement('div');block.id='scenarioPurchaseEligibilityStage91';block.className='grid3 advanced-grid stage91-grid';block.innerHTML=`<div class="field"><label for="scenarioPurchaseQualifyingDebtPctNew">Purchase mortgage debt qualifying for Box 1 relief %</label><input id="scenarioPurchaseQualifyingDebtPctNew" type="number" min="0" max="100" step="1" placeholder="Enter 0–100"><p class="inline">Do not assume the complete mortgage qualifies. Enter the share that meets the Dutch owner-occupied-home deduction conditions.</p><p class="stage91-source scenario-source-tag" data-source-for="scenarioPurchaseQualifyingDebtPctNew">Entered here</p></div><div class="field"><label for="scenarioPurchaseHraYearsNew">Remaining mortgage-interest deduction years</label><input id="scenarioPurchaseHraYearsNew" type="number" min="0" max="30" step="0.5" placeholder="Enter 0–30"><p class="inline">The 30-year deduction clock can already have elapsed partly for replacement or refinanced qualifying debt.</p><p class="stage91-source scenario-source-tag" data-source-for="scenarioPurchaseHraYearsNew">Entered here</p></div><div class="field"><label for="scenarioQualifyingEnergySpendNew">Qualifying energy expenditure financed</label><input id="scenarioQualifyingEnergySpendNew" type="number" min="0" step="500" value="0"><p class="inline">Required for the enhanced NHG route. Every amount above the standard NHG ceiling must be supported by qualifying energy expenditure.</p><p class="stage91-source scenario-source-tag" data-source-for="scenarioQualifyingEnergySpendNew">Entered here</p></div>`;rules.prepend(block);}

  const starting=$('scenarioStartingPositionNew')||Array.from(engine.querySelectorAll('.card')).find(x=>/starting position/i.test(x.textContent||''));
  if(starting&&!$('scenarioEconomicInputsStage91')){const block=document.createElement('div');block.id='scenarioEconomicInputsStage91';block.className='grid2 advanced-grid stage91-grid';block.innerHTML=`<div class="field"><label for="scenarioCommonMonthlyInvestmentFresh">Common monthly investment contribution</label><input id="scenarioCommonMonthlyInvestmentFresh" type="number" min="0" step="50" placeholder="Enter amount" required><p class="inline">Applied to both strategies every month before Box 3 is calculated. This prevents ordinary contributions from disappearing from a nonlinear Box 3 comparison.</p><p class="stage91-source scenario-source-tag" data-source-for="scenarioCommonMonthlyInvestmentFresh">Choose a Scenario source</p></div><div class="field"><label for="scenarioDebtFallbackFresh">After Box 3 debt payoff, redirect the monthly debt budget to</label><select id="scenarioDebtFallbackFresh" required><option value="">Choose destination</option><option value="invest">Investments</option><option value="savings">Savings / cash</option><option value="consume">Stop allocating / spending</option></select><p class="inline">Imported from the Investing plan or chosen here. Scenarios and Next € use the same destination.</p><p class="stage91-source scenario-source-tag" data-source-for="scenarioDebtFallbackFresh">Choose a Scenario source</p></div>`;starting.appendChild(block);}

  if(!$('stage91Box3Estimate')){const note=document.createElement('div');note.id='stage91Box3Estimate';note.className='callout warn stage91-warning';note.innerHTML='<strong>Box 3 estimate.</strong> The model applies the published 2026 parameters but does not reproduce every statutory intermediate rounding step. Small euro-level differences from an official assessment are possible.';const target=$('scenarioTaxNoteNew');target?.insertAdjacentElement('afterend',note);}
  if(!$('stage91ScopeWarning')){const note=document.createElement('div');note.id='stage91ScopeWarning';note.className='callout warn stage91-warning';note.innerHTML='<strong>Scope boundary.</strong> Automatic Box 1 calculations cover the pre-AOW standard employment-income profile used by this planner. AOW-age rates, complex fiscal-partner allocations, transitional own-home debt, foreign tax positions and other specialist profiles require professional calculation.';engine.prepend(note);}
  if(!$('stage91Live')){const live=document.createElement('div');live.id='stage91Live';live.className='stage91-live';live.setAttribute('aria-live','polite');live.setAttribute('aria-atomic','true');engine.appendChild(live);}

  function upstreamMonthlyInvestment(){const values=Array.from(document.querySelectorAll('#phaseList [data-field="monthlyInvest"]')).filter(el=>!el.disabled).map(el=>Number(el.value)).filter(Number.isFinite);if(!values.length)return{value:0,vary:false};const first=values[0],vary=values.some(v=>Math.abs(v-first)>.005);return{value:vary?null:first,vary};}
  function setTag(id,text){const t=document.querySelector(`[data-source-for="${id}"]`);if(t)t.textContent=text;}
  function refreshStage91Imported(){const m=upstreamMonthlyInvestment(),common=$('scenarioCommonMonthlyInvestmentFresh'),fallback=$('scenarioDebtFallbackFresh');if(common){common.value=m.value==null?'':String(Math.max(0,m.value));setTag(common.id,m.vary?'Planner phases vary: enter one common Scenario amount':'Imported snapshot');}if(fallback){const v=$('box3DebtFallbackDestination')?.value;fallback.value=['invest','savings','consume'].includes(v)?v:'';setTag(fallback.id,'Imported snapshot');}
    [['firstJan1Savings','scenarioFirstJan1SavingsFresh'],['firstJan1Debt','scenarioFirstJan1DebtFresh']].forEach(([from,to])=>{const src=$(from),dest=$(to);if(dest)dest.value=src&&src.value!==''?src.value:'';});
  }
  function resetStage91Fresh(){const common=$('scenarioCommonMonthlyInvestmentFresh'),fallback=$('scenarioDebtFallbackFresh');if(common)common.value='';if(fallback)fallback.value='';['scenarioPurchaseQualifyingDebtPctNew','scenarioPurchaseHraYearsNew'].forEach(id=>{if($(id))$(id).value='';});if($('scenarioQualifyingEnergySpendNew'))$('scenarioQualifyingEnergySpendNew').value='0';setTag('scenarioCommonMonthlyInvestmentFresh','Entered here');setTag('scenarioDebtFallbackFresh','Entered here');}
  function syncRequirements(){const mode=$('comparisonType')?.value,purchase=isPurchase(mode),transfer=$('scenarioTransferTaxModeNew')?.value,nonMain=['other-home','other-real-estate'].includes(transfer)||(transfer==='starter'&&$('scenarioStarterMainResidenceNew')?.checked===false),q=$('scenarioPurchaseQualifyingDebtPctNew'),y=$('scenarioPurchaseHraYearsNew'),e=$('scenarioQualifyingEnergySpendNew'),energy=$('scenarioPurchaseNhgModeNew')?.value==='energy';[q,y].forEach(el=>{if(!el)return;el.required=purchase&&!nonMain;el.disabled=!purchase||nonMain;if(el.disabled)el.value='0';});if(e){e.required=purchase&&energy;e.disabled=!purchase||!energy;if(e.disabled)e.value='0';}}

  function captureControls(){const values={};document.querySelectorAll('#tab-scenarios input,#tab-scenarios select').forEach(el=>{if(!el.id&&el.name!=='scenarioDataSource')return;const key=el.id||`name:${el.name}:${el.value}`;values[key]=(el.type==='checkbox'||el.type==='radio')?{kind:'checked',value:Boolean(el.checked)}:{kind:'value',value:String(el.value??'')};});const provenance={};document.querySelectorAll('.scenario-source-tag[data-source-for]').forEach(t=>provenance[t.dataset.sourceFor]=t.textContent||'');return{version:1,sourceMode:document.querySelector('input[name="scenarioDataSource"]:checked')?.value||null,values,provenance,activeConfig:root.__DIMP_ACTIVE_SCENARIO_CONFIG?clone(root.__DIMP_ACTIVE_SCENARIO_CONFIG):null,canonical:root.__DIMP_CANONICAL_COMPARISON?clone(root.__DIMP_CANONICAL_COMPARISON):null,savedAt:new Date().toISOString()};}
  function saveSnapshot(){if(restoring)return;try{localStorage.setItem(SNAPSHOT_KEY,JSON.stringify(captureControls()));}catch(_){}}
  function applyValues(payload){Object.entries(payload?.values||{}).forEach(([key,entry])=>{let el=null;if(key.startsWith('name:')){const [,name,value]=key.split(':');el=document.querySelector(`input[name="${name}"][value="${value}"]`);}else el=$(key);if(!el||!entry)return;if(entry.kind==='checked')el.checked=Boolean(entry.value);else el.value=String(entry.value??'');});Object.entries(payload?.provenance||{}).forEach(([id,text])=>setTag(id,text));}
  function fireUpdate(){const el=$('scenarioReturnNew')||$('scenarioHorizonNew');el?.dispatchEvent(new Event('change',{bubbles:true}));}
  function restoreSnapshot(){let payload=null;try{payload=JSON.parse(localStorage.getItem(SNAPSHOT_KEY)||'null');}catch(_){}if(!payload||!payload.sourceMode)return false;const radio=document.querySelector(`input[name="scenarioDataSource"][value="${payload.sourceMode}"]`);if(!radio)return false;restoring=true;try{radio.checked=true;radio.dispatchEvent(new Event('change',{bubbles:true}));applyValues(payload);syncRequirements();fireUpdate();const live=$('stage91Live');if(live)live.textContent=`Restored ${payload.sourceMode} Scenario snapshot without refreshing planner data.`;}finally{restoring=false;}return true;}

  document.querySelectorAll('input[name="scenarioDataSource"]').forEach(r=>r.addEventListener('change',()=>{if(restoring)return;sourceChanging=true;try{if(r.checked&&r.value==='imported')refreshStage91Imported();else if(r.checked&&r.value==='fresh')resetStage91Fresh();syncRequirements();fireUpdate();saveSnapshot();}finally{sourceChanging=false;}}));
  $('scenarioRefreshImport')?.addEventListener('click',()=>{if(restoring)return;refreshStage91Imported();syncRequirements();fireUpdate();saveSnapshot();const live=$('stage91Live');if(live)live.textContent='Imported Scenario snapshot refreshed explicitly.';});
  engine.addEventListener('input',()=>{if(!sourceChanging){queueMicrotask(()=>{syncRequirements();saveSnapshot();});}});engine.addEventListener('change',()=>{if(!sourceChanging){queueMicrotask(()=>{syncRequirements();saveSnapshot();renderNextEuroRanges();});}});

  function renderNextEuroRanges(){if(!NE||!root.__DIMP_ACTIVE_SCENARIO_CONFIG||!$('nextEuroCard'))return;const amount=nonNegative(Number($('nextEuroAmount')?.value)||0),years=Math.max(1,finite($('nextEuroYears')?.value,10)),report=findAllBreakEvenReturns(root.__DIMP_ACTIVE_SCENARIO_CONFIG,{amount,years});const value=$('nextEuroBreakEven'),sub=$('nextEuroBreakEvenSub');if(!value||!sub||!report.valid)return;if(!report.crossings.length){value.textContent='No crossing';sub.textContent=`No sign change found from ${report.range[0].toFixed(1)}% to ${report.range[1].toFixed(1)}%.`;}else if(report.crossings.length===1){value.textContent=`${report.crossings[0].rate.toLocaleString('nl-NL',{minimumFractionDigits:2,maximumFractionDigits:2})}%`;sub.textContent='One modeled break-even return in the searched range.';}else{value.textContent=`${report.crossings.length} crossings`;sub.textContent=report.crossings.map(c=>c.rate.toLocaleString('nl-NL',{minimumFractionDigits:2,maximumFractionDigits:2})+'%').join(' · ');}let box=$('nextEuroRangeReportStage91');if(!box){box=document.createElement('div');box.id='nextEuroRangeReportStage91';box.className='callout';$('nextEuroCard').appendChild(box);}box.innerHTML=`<strong>Leadership ranges across the full search:</strong><br>${report.leaderRanges.map(r=>`${r.from.toFixed(2)}% to ${r.to.toFixed(2)}%: ${r.leader==='invest'?'Invest':r.leader==='repay'?'Repay':'Tie'}`).join('<br>')}`;}
  document.addEventListener('input',e=>{if(e.target?.closest?.('#nextEuroCard'))queueMicrotask(renderNextEuroRanges);});document.addEventListener('change',e=>{if(e.target?.closest?.('#nextEuroCard'))queueMicrotask(renderNextEuroRanges);});

  const tabs=Array.from(document.querySelectorAll('.tabs .tab[data-tab]'));tabs.forEach((tab,i)=>{tab.setAttribute('role','tab');tab.id=tab.id||`planner-tab-${tab.dataset.tab}`;const panel=$(`tab-${tab.dataset.tab}`);if(panel){panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',tab.id);}const active=tab.classList.contains('active');tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;tab.addEventListener('click',()=>tabs.forEach(t=>{const a=t===tab;t.setAttribute('aria-selected',String(a));t.tabIndex=a?0:-1;}));tab.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();let j=i;if(e.key==='ArrowLeft')j=(i-1+tabs.length)%tabs.length;if(e.key==='ArrowRight')j=(i+1)%tabs.length;if(e.key==='Home')j=0;if(e.key==='End')j=tabs.length-1;tabs[j].focus();tabs[j].click();});});

  syncRequirements();const restored=restoreSnapshot();if(!restored){const selected=document.querySelector('input[name="scenarioDataSource"]:checked');if(selected?.value==='imported')refreshStage91Imported();else if(selected?.value==='fresh')resetStage91Fresh();syncRequirements();fireUpdate();saveSnapshot();}
  renderNextEuroRanges();
}

installCorePatches();installNextEuroPatches();
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',browserBoot,{once:true});else browserBoot();}

return{VERSION,SNAPSHOT_KEY,enhancedNhgRequirement,nhg2026,calculateScenarioPurchase2026,simulateInvestmentFlowsStage91,findAllBreakEvenReturns,invalidScenario,installCorePatches,installNextEuroPatches,browserBoot};
});
