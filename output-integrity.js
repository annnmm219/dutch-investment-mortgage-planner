(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.OutputIntegrity=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';

const RELEASE_META=Object.freeze({
  version:'R6.6',
  ruleYear:2026,
  updated:'2026-09-03',
  stateSchema:4,
  releaseName:'Decision Integrity'
});

const CANONICAL_KINDS=Object.freeze({
  plan:'dimp.canonical-plan-result.v1',
  comparison:'dimp.canonical-comparison-result.v1',
  nextEuro:'dimp.canonical-next-euro-result.v1'
});

function finiteOrNull(value){
  if(value===null||value===undefined||value==='')return null;
  const number=Number(value);
  return Number.isFinite(number)?number:null;
}

function finiteOr(value,fallback=0){
  const number=finiteOrNull(value);
  return number===null?fallback:number;
}

function taxAdjustedAvailable(result){
  return Boolean(result)&&result.taxAdjustedComparableAvailable!==false;
}

function formatMoney(value){
  const number=finiteOrNull(value);
  if(number===null)throw new TypeError('formatMoney requires a finite number');
  return '€'+Math.round(number).toLocaleString('nl-NL');
}

function formatOptionalMoney(value,fallback='Unavailable'){
  const number=finiteOrNull(value);
  return number===null?fallback:formatMoney(number);
}

function formatExportNumber(value){
  const number=finiteOrNull(value);
  return number===null?'':number.toFixed(2);
}

function formatPercent(value){
  const number=finiteOrNull(value);
  return number===null?'Unavailable':number.toLocaleString('nl-NL',{maximumFractionDigits:2})+'%';
}

function releaseLabel(meta=RELEASE_META){
  const date=String(meta.updated||'').split('-');
  const display=date.length===3?`${Number(date[2])} ${['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(date[1])]||date[1]} ${date[0]}`:String(meta.updated||'');
  return `Calculation build ${meta.version} · ${meta.ruleYear} rules · updated ${display}`;
}

function cloneSeries(source={}){
  return (Array.isArray(source.series)?source.series:[]).map(row=>({
    year:finiteOrNull(row.year),
    month:finiteOrNull(row.month),
    portfolio:finiteOrNull(row.portfolio),
    mortgage:finiteOrNull(row.mort),
    invested:finiteOrNull(row.invested)
  }));
}

function cloneYearBuckets(source={}){
  return Object.values(source.yearBuckets||{}).sort((a,b)=>finiteOr(a.year)-finiteOr(b.year)).map(bucket=>({...bucket}));
}

function canonicalPlanResult(selectedResult={},beforeBox3Result={},config={}){
  const available=taxAdjustedAvailable(selectedResult);
  const mode=config.box3Mode||config.box3?.mode||'none';
  const ignored=mode==='none';
  const paySource=config.box3PaySource||config.box3?.paySource||'savings';
  const reason=String(selectedResult.taxBlockReason||selectedResult.reason||'Complete the required Box 3 information to calculate a tax-adjusted result.');
  const beforePortfolio=finiteOrNull(beforeBox3Result.portfolio);
  if(beforePortfolio===null)throw new TypeError('canonicalPlanResult requires a finite before-Box-3 portfolio');
  const displaySource=available&&!ignored?selectedResult:beforeBox3Result;
  const status=available?(selectedResult.taxStatus||selectedResult.box3Status||'settled'):(selectedResult.taxStatus||selectedResult.box3Status||'not-estimable');
  const results={
    portfolioBeforeBox3:beforePortfolio,
    portfolioAfterBox3:available?finiteOrNull(selectedResult.portfolio):null,
    savingsBeforeBox3:finiteOrNull(beforeBox3Result.savings),
    savingsAfterBox3:available?finiteOrNull(selectedResult.savings):null,
    box3DebtBeforeBox3:finiteOrNull(beforeBox3Result.box3Debt),
    box3DebtAfterBox3:available?finiteOrNull(selectedResult.box3Debt):null,
    netFinancialAssetsBeforeBox3:finiteOrNull(beforeBox3Result.netFinancialAssets),
    netFinancialAssetsAfterBox3:available?finiteOrNull(selectedResult.netFinancialAssets):null,
    comparableWealthBeforeBox3:finiteOrNull(beforeBox3Result.householdComparableWealth??beforeBox3Result.comparableWealth),
    comparableWealthAfterBox3:available?finiteOrNull(selectedResult.householdComparableWealth??selectedResult.comparableWealth):null,
    mortgageRemaining:finiteOrNull(selectedResult.mort??beforeBox3Result.mort),
    totalInvested:finiteOrNull(selectedResult.invested??beforeBox3Result.invested),
    settledBox3Tax:available?finiteOrNull(selectedResult.box3Tax??selectedResult.totalTax):null,
    unsettledBox3Tax:available?finiteOrNull(selectedResult.unsettledTaxEstimate):null,
    externalBox3Tax:available?finiteOrNull(selectedResult.externalTax):null,
    taxPaidFromPortfolio:available?finiteOrNull(selectedResult.taxPaidFromPortfolio):null,
    taxPaidFromSavings:available?finiteOrNull(selectedResult.taxPaidFromSavings):null,
    externalCashFlowFutureValue:available?finiteOrNull(selectedResult.externalCashFlowFutureValue):null,
    lossCarry:available?finiteOrNull(selectedResult.lossCarry):null
  };
  return{
    kind:CANONICAL_KINDS.plan,
    available,
    ignored,
    status,
    reason,
    ruleYear:RELEASE_META.ruleYear,
    assumptions:{
      box3Mode:mode,
      box3PaySource:paySource,
      effectiveAnnualInvestmentReturnPct:finiteOrNull(config.annualReturnPct??config.annualReturn),
      startYear:finiteOrNull(config.startYear),
      startMonth:finiteOrNull(config.startMonth)
    },
    results,
    series:cloneSeries(displaySource),
    yearBuckets:cloneYearBuckets(displaySource)
  };
}

function unavailablePlanResult(reason='Complete the required inputs to calculate results.',config={}){
  return{
    kind:CANONICAL_KINDS.plan,
    available:false,
    ignored:false,
    status:'invalid-input',
    reason:String(reason),
    ruleYear:RELEASE_META.ruleYear,
    assumptions:{
      box3Mode:String(config.box3Mode||''),
      box3PaySource:String(config.box3PaySource||''),
      effectiveAnnualInvestmentReturnPct:null,
      startYear:null,
      startMonth:null
    },
    results:{
      portfolioBeforeBox3:null,portfolioAfterBox3:null,savingsBeforeBox3:null,savingsAfterBox3:null,
      box3DebtBeforeBox3:null,box3DebtAfterBox3:null,netFinancialAssetsBeforeBox3:null,netFinancialAssetsAfterBox3:null,
      comparableWealthBeforeBox3:null,comparableWealthAfterBox3:null,mortgageRemaining:null,totalInvested:null,
      settledBox3Tax:null,unsettledBox3Tax:null,externalBox3Tax:null,taxPaidFromPortfolio:null,
      taxPaidFromSavings:null,externalCashFlowFutureValue:null,lossCarry:null
    },
    series:[],
    yearBuckets:[]
  };
}

function withoutBox3(config={}){
  const copy={...config,canonicalOutput:false,box3Mode:'none'};
  if(config.box3)copy.box3={...config.box3,mode:'none'};
  return copy;
}

function decorateFinanceCore(core,onCanonical){
  if(!core||typeof core.simulatePlan!=='function')throw new TypeError('FinanceCore.simulatePlan is required');
  if(core.__r66Stage6CanonicalOutput)return core;
  const original=core.simulatePlan.bind(core);
  core.simulatePlan=function(config={}){
    const selected=original(config);
    if(config.canonicalOutput!==true)return selected;
    const mode=config.box3Mode||config.box3?.mode||'none';
    const before=mode==='none'?selected:original(withoutBox3(config));
    const canonical=canonicalPlanResult(selected,before,config);
    const enriched={...selected,canonicalResult:canonical};
    if(typeof onCanonical==='function')onCanonical(enriched,canonical,config);
    return enriched;
  };
  Object.defineProperty(core,'__r66Stage6CanonicalOutput',{value:true,enumerable:false});
  return core;
}

function assertKind(value,kind,label){
  if(!value||value.kind!==kind)throw new TypeError(`${label} requires the Stage 6 canonical result`);
  return value;
}

function planExportRows(canonical){
  assertKind(canonical,CANONICAL_KINDS.plan,'planExportRows');
  const r=canonical.results;
  return[
    ['Box 3','Status',canonical.available?(canonical.ignored?'Ignored':String(canonical.status)):'Not estimable'],
    ['Box 3','Mode',String(canonical.assumptions.box3Mode)],
    ['Box 3','Payment source',String(canonical.assumptions.box3PaySource)],
    ['Box 3','Reason',canonical.available?'':canonical.reason],
    ['Results','Portfolio before Box 3 (EUR)',formatExportNumber(r.portfolioBeforeBox3)],
    ['Results','Portfolio after settled Box 3 (EUR)',formatExportNumber(r.portfolioAfterBox3)],
    ['Results','Savings before Box 3 (EUR)',formatExportNumber(r.savingsBeforeBox3)],
    ['Results','Savings after settled Box 3 (EUR)',formatExportNumber(r.savingsAfterBox3)],
    ['Results','Box 3 debt before Box 3 (EUR)',formatExportNumber(r.box3DebtBeforeBox3)],
    ['Results','Box 3 debt after settled Box 3 (EUR)',formatExportNumber(r.box3DebtAfterBox3)],
    ['Results','Net financial assets before Box 3 (EUR)',formatExportNumber(r.netFinancialAssetsBeforeBox3)],
    ['Results','Net financial assets after settled Box 3 (EUR)',formatExportNumber(r.netFinancialAssetsAfterBox3)],
    ['Results','Comparable wealth before Box 3 (EUR)',formatExportNumber(r.comparableWealthBeforeBox3)],
    ['Results','Tax-adjusted comparable wealth (EUR)',formatExportNumber(r.comparableWealthAfterBox3)],
    ['Results','Settled Box 3 tax (EUR)',formatExportNumber(r.settledBox3Tax)],
    ['Results','Unsettled Box 3 estimate (EUR)',formatExportNumber(r.unsettledBox3Tax)],
    ['Results','Box 3 tax paid externally (EUR)',formatExportNumber(r.externalBox3Tax)],
    ['Results','Box 3 tax paid from portfolio (EUR)',formatExportNumber(r.taxPaidFromPortfolio)],
    ['Results','Box 3 tax paid from savings (EUR)',formatExportNumber(r.taxPaidFromSavings)],
    ['Results','External outflows at plan horizon (EUR)',formatExportNumber(r.externalCashFlowFutureValue)],
    ['Results','Loss carryforward (EUR)',formatExportNumber(r.lossCarry)],
    ['Results','Mortgage remaining (EUR)',formatExportNumber(r.mortgageRemaining)],
    ['Results','Total invested (EUR)',formatExportNumber(r.totalInvested)]
  ];
}

function outputModel(canonical){
  assertKind(canonical,CANONICAL_KINDS.plan,'outputModel');
  const r=canonical.results;
  const useAfter=canonical.available&&!canonical.ignored;
  const tax=canonical.available?r.settledBox3Tax:null;
  const unsettled=canonical.available?r.unsettledBox3Tax:null;
  const headline=useAfter?r.portfolioAfterBox3:r.portfolioBeforeBox3;
  const unsettledSuffix=unsettled&&unsettled>0?` ${formatMoney(unsettled)} remains an unsettled final-year estimate.`:'';
  const source=canonical.assumptions.box3PaySource;
  const taxSub=canonical.available
    ?canonical.ignored
      ?'Box 3 ignored.'
      :source==='portfolio'
        ?`Settled tax is withdrawn from the investment portfolio.${unsettledSuffix}`
        :source==='savings'
          ?`Settled tax is paid from savings / cash.${unsettledSuffix}`
          :`Settled tax is recorded as external cash flow.${unsettledSuffix}`
    :canonical.reason;
  const afterTaxSub=canonical.available
    ?canonical.ignored
      ?'Same as the before-Box-3 projection because tax is switched off.'
      :source==='portfolio'
        ?'Includes lower future compounding after settled tax withdrawals.'
        :source==='savings'
          ?'The portfolio is unchanged by payment; settled tax reduces savings / cash.'
          :'Portfolio and savings are unchanged by payment; settled tax increases external cash requirements.'
    :'Tax-adjusted portfolio is not shown while Box 3 is unavailable.';
  return{
    canonical,
    available:canonical.available,
    ignored:canonical.ignored,
    status:canonical.status,
    reason:canonical.reason,
    headlineLabel:useAfter?'Investment portfolio after settled Box 3':'Investment portfolio before Box 3',
    headlineValue:formatOptionalMoney(headline),
    headlineSub:canonical.available?(canonical.ignored?'Box 3 is switched off for this projection.':'After settled Box 3 charges under the selected treatment.'):'Tax-adjusted result unavailable; showing the before-Box-3 projection.',
    chartLabel:useAfter?'Portfolio after settled Box 3':'Portfolio before Box 3',
    chartSeries:canonical.series,
    beforeTaxLabel:'Portfolio before Box 3',
    beforeTaxValue:formatOptionalMoney(r.portfolioBeforeBox3),
    beforeTaxSub:'Same plan with Box 3 switched off; this is a separate counterfactual calculation.',
    taxValue:canonical.available?formatOptionalMoney(tax,'€0'):'Not estimable',
    taxSub,
    afterTaxLabel:canonical.available&&!canonical.ignored?'Portfolio after settled Box 3':'Tax-adjusted portfolio',
    afterTaxValue:canonical.available?formatOptionalMoney(r.portfolioAfterBox3):'Unavailable',
    afterTaxSub,
    scenarioTaxText:canonical.available?(canonical.ignored?'Box 3 ignored':`${formatOptionalMoney(tax,'€0')} settled Box 3${unsettled&&unsettled>0?` + ${formatMoney(unsettled)} unsettled`:''}`):'Tax-adjusted result unavailable',
    blockYearTable:!canonical.available,
    householdAvailable:canonical.available,
    household:{
      savings:r.savingsAfterBox3,
      box3Debt:r.box3DebtAfterBox3,
      netFinancialAssets:r.netFinancialAssetsAfterBox3,
      externalTax:r.externalBox3Tax,
      externalCashFlowFutureValue:r.externalCashFlowFutureValue,
      lossCarry:r.lossCarry
    },
    exportRows:planExportRows(canonical)
  };
}

function scenarioCardModel(canonical){
  const model=outputModel(canonical);
  const mortgage=model.canonical.results.mortgageRemaining;
  const mortgageText=mortgage===null?'':` · mortgage ${formatMoney(mortgage)}`;
  const sub=model.available?model.scenarioTaxText:'Before Box 3 projection · tax-adjusted result unavailable';
  return{value:model.headlineValue,sub:`${sub}${mortgageText}`};
}

function canonicalComparisonResult(result={},context={}){
  const A=result.A||{name:'Strategy A'};
  const B=result.B||{name:'Strategy B'};
  const aNet=finiteOrNull(A.net),bNet=finiteOrNull(B.net);
  const valid=result.valid!==false&&aNet!==null&&bNet!==null;
  const difference=valid?aNet-bNet:null;
  const tolerance=Math.max(0,finiteOr(context.tieTolerance,1));
  const outcome=!valid?'unavailable':Math.abs(difference)<tolerance?'tie':difference>0?'A':'B';
  return{
    kind:CANONICAL_KINDS.comparison,
    valid,
    status:valid?'available':String(result.status||'unavailable'),
    reason:String(result.reason||'The comparison is unavailable for the entered assumptions.'),
    assumptions:{
      comparisonType:String(context.mode||context.comparisonType||''),
      years:finiteOrNull(context.years),
      effectiveAnnualInvestmentReturnPct:finiteOrNull(context.returnPct)
    },
    strategies:{A:{...A},B:{...B}},
    difference,
    absoluteDifference:difference===null?null:Math.abs(difference),
    outcome,
    peakRequirement:finiteOrNull(result.peakRequirement),
    budgetGap:Math.max(0,finiteOr(context.budgetGap,0)),
    note:String(result.note||''),
    sourcesAndUses:result.sourcesAndUses?{
      A:result.sourcesAndUses.A?{...result.sourcesAndUses.A}:null,
      B:result.sourcesAndUses.B?{...result.sourcesAndUses.B}:null
    }:null
  };
}

function comparisonExportRows(canonical){
  assertKind(canonical,CANONICAL_KINDS.comparison,'comparisonExportRows');
  const A=canonical.strategies.A,B=canonical.strategies.B;
  const outcome=canonical.outcome==='A'?A.name:canonical.outcome==='B'?B.name:canonical.outcome==='tie'?'Modeled tie':'Unavailable';
  return[
    ['Decision comparison','Status',canonical.valid?'Available':'Unavailable'],
    ['Decision comparison','Reason',canonical.valid?'':canonical.reason],
    ['Decision comparison','Comparison type',canonical.assumptions.comparisonType],
    ['Decision comparison','Strategy A',String(A.name||'Strategy A')],
    ['Decision comparison','Strategy A comparable wealth (EUR)',formatExportNumber(canonical.valid?A.net:null)],
    ['Decision comparison','Strategy B',String(B.name||'Strategy B')],
    ['Decision comparison','Strategy B comparable wealth (EUR)',formatExportNumber(canonical.valid?B.net:null)],
    ['Decision comparison','Difference A minus B (EUR)',formatExportNumber(canonical.difference)],
    ['Decision comparison','Higher modeled wealth',outcome],
    ['Decision comparison','Horizon (years)',formatExportNumber(canonical.assumptions.years)],
    ['Decision comparison','Effective annual investment return (%)',formatExportNumber(canonical.assumptions.effectiveAnnualInvestmentReturnPct)]
  ];
}

function comparisonOutputModel(canonical){
  assertKind(canonical,CANONICAL_KINDS.comparison,'comparisonOutputModel');
  if(!canonical.valid)return{
    title:'Comparison unavailable.',
    detail:canonical.reason,
    outcome:'unavailable',
    strategies:canonical.strategies,
    exportRows:comparisonExportRows(canonical)
  };
  const years=canonical.assumptions.years;
  const period=years===null?'at the selected horizon':`after ${years.toLocaleString('nl-NL',{maximumFractionDigits:2})} years`;
  const title=canonical.outcome==='tie'
    ?`Under the entered assumptions, neither strategy has meaningfully higher modeled wealth ${period}.`
    :`Under the entered assumptions, ${canonical.strategies[canonical.outcome].name} has ${formatMoney(canonical.absoluteDifference)} more modeled wealth ${period}.`;
  const rate=canonical.assumptions.effectiveAnnualInvestmentReturnPct;
  const detail=rate===null?'Uses the selected tax, mortgage and cash-flow assumptions.':`Uses the entered ${formatPercent(rate)} effective annual investment return and selected tax, mortgage and cash-flow assumptions.`;
  return{title,detail,outcome:canonical.outcome,strategies:canonical.strategies,exportRows:comparisonExportRows(canonical)};
}

function canonicalNextEuroResult(analysis={}){
  const selected=analysis.selected||{};
  const difference=finiteOrNull(analysis.difference??selected.difference);
  const leader=selected.leader||analysis.leader||(difference===null?'unavailable':Math.abs(difference)<1?'tie':difference>0?'invest':'repay');
  const valid=analysis.main?.valid!==false&&difference!==null&&!['unavailable',null,undefined].includes(leader);
  const quick=Array.isArray(analysis.quick)?analysis.quick.map(row=>{
    const rowDifference=finiteOrNull(row.difference??row.current?.difference);
    const rowLeader=row.current?.leader||row.leader||(rowDifference===null?'unavailable':Math.abs(rowDifference)<1?'tie':rowDifference>0?'invest':'repay');
    const rowValid=row.valid!==false&&rowDifference!==null&&rowLeader!=='unavailable';
    return{
      amount:finiteOrNull(row.amount),
      valid:rowValid,
      breakEvenReturnPct:row.breakEven==null?null:finiteOrNull(row.breakEven),
      breakEvenStatus:row.valid===false?'invalid':row.breakEven==null?'outside-range':'found',
      difference:rowValid?rowDifference:null,
      absoluteDifference:rowValid?Math.abs(rowDifference):null,
      outcome:rowValid?rowLeader:'unavailable'
    };
  }):[];
  return{
    kind:CANONICAL_KINDS.nextEuro,
    valid,
    reason:String(analysis.main?.reason||selected.reason||'The comparison is unavailable for the entered assumptions.'),
    amount:finiteOrNull(analysis.amount??analysis.extraMonthly),
    years:finiteOrNull(analysis.years),
    assumedReturnPct:finiteOrNull(analysis.assumedReturnPct??analysis.selectedReturnPct),
    breakEvenReturnPct:analysis.main?.breakEven==null?null:finiteOrNull(analysis.main.breakEven),
    breakEvenStatus:analysis.main?.valid===false?'invalid':analysis.main?.breakEven==null?'outside-range':'found',
    difference:valid?difference:null,
    absoluteDifference:valid?Math.abs(difference):null,
    outcome:valid?leader:'unavailable',
    quick
  };
}

function nextEuroExportRows(canonical){
  assertKind(canonical,CANONICAL_KINDS.nextEuro,'nextEuroExportRows');
  const outcome=canonical.outcome==='invest'?'Invest':canonical.outcome==='repay'?'Repay mortgage':canonical.outcome==='tie'?'Modeled tie':'Unavailable';
  return[
    ['Next Euro','Status',canonical.valid?'Available':'Unavailable'],
    ['Next Euro','Reason',canonical.valid?'':canonical.reason],
    ['Next Euro','Monthly amount (EUR)',formatExportNumber(canonical.amount)],
    ['Next Euro','Horizon (years)',formatExportNumber(canonical.years)],
    ['Next Euro','Entered effective annual return (%)',formatExportNumber(canonical.assumedReturnPct)],
    ['Next Euro','Break-even status',canonical.breakEvenStatus],
    ['Next Euro','Break-even effective annual return (%)',formatExportNumber(canonical.breakEvenReturnPct)],
    ['Next Euro','Higher modeled wealth',outcome],
    ['Next Euro','Modeled terminal difference (EUR)',formatExportNumber(canonical.absoluteDifference)]
  ];
}

function nextEuroOutputModel(canonical){
  assertKind(canonical,CANONICAL_KINDS.nextEuro,'nextEuroOutputModel');
  const choice=canonical.outcome==='invest'?'Invest':canonical.outcome==='repay'?'Repay mortgage':canonical.outcome==='tie'?'Modeled tie':'Unavailable';
  return{
    breakEvenValue:canonical.breakEvenStatus==='found'?formatPercent(canonical.breakEvenReturnPct):canonical.breakEvenStatus==='outside-range'?'Outside tested range':'Unavailable',
    breakEvenSub:canonical.valid?'Effective annual investment return under the selected tax and mortgage assumptions.':canonical.reason,
    choiceValue:choice,
    choiceSub:canonical.valid?`Under the entered ${formatPercent(canonical.assumedReturnPct)} effective annual return.`:canonical.reason,
    differenceValue:canonical.valid?formatMoney(canonical.absoluteDifference):'Unavailable',
    exportRows:nextEuroExportRows(canonical)
  };
}

function canonicalExportRows({plan,comparison,nextEuro}={}){
  const rows=[];
  if(plan?.kind===CANONICAL_KINDS.plan)rows.push(...planExportRows(plan));
  if(comparison?.kind===CANONICAL_KINDS.comparison)rows.push(...comparisonExportRows(comparison));
  if(nextEuro?.kind===CANONICAL_KINDS.nextEuro)rows.push(...nextEuroExportRows(nextEuro));
  return rows;
}

function csvEscape(value){
  const text=String(value??'');
  return /[",\n\r]/.test(text)?`"${text.replace(/"/g,'""')}"`:text;
}

function outputCsv(model,extraRows=[]){
  const rows=Array.isArray(model)?model:model?.exportRows;
  if(!Array.isArray(rows))throw new TypeError('outputCsv requires an output model or export rows');
  return [['Section','Assumption','Value'],...rows,...extraRows]
    .map(row=>row.map(csvEscape).join(','))
    .join('\r\n');
}

function bootBrowser(){
  if(typeof window==='undefined'||typeof document==='undefined')return;
  const $=id=>document.getElementById(id);
  const FC=window.FinanceCore;
  if(!FC)throw new Error('FinanceCore must load before output-integrity.js');
  let latestCanonical=null;
  let scheduled=false;

  window.MODEL_META=RELEASE_META;

  decorateFinanceCore(FC,(enriched,canonical,config)=>{
    if(config.canonicalOutputScope==='card')return;
    latestCanonical=canonical;
    window.__DIMP_CANONICAL_RESULT=canonical;
    window.__R641_LAST_MAIN_RESULT=enriched;
    schedule();
  });

  function schedule(){
    if(scheduled)return;
    scheduled=true;
    setTimeout(()=>{
      const run=()=>{scheduled=false;apply();};
      if(typeof requestAnimationFrame==='function')requestAnimationFrame(run);else run();
    },0);
  }

  function setText(id,value){const el=$(id);if(el)el.textContent=value;}

  function setStatLabel(valueId,label){
    const item=$(valueId)?.closest('.stat,.summary-item');
    const target=item?.querySelector('.stat-label,.k');
    if(target)target.textContent=label;
  }

  function updateRelease(){
    document.documentElement.dataset.modelVersion=RELEASE_META.version;
    document.documentElement.dataset.stateSchema=String(RELEASE_META.stateSchema);
    setText('modelVersion',releaseLabel());
    try{localStorage.setItem('dimp-model-meta',JSON.stringify(RELEASE_META));}catch(_error){}
  }

  function updateHeadline(model){
    setStatLabel('sPortfolio',model.headlineLabel);
    setText('sPortfolio',model.headlineValue);
    setText('sPortfolioSub',model.headlineSub);
    setText('bBeforeTaxLabel',model.beforeTaxLabel);
    setText('bBeforeTax',model.beforeTaxValue);
    setText('bBeforeTaxSub',model.beforeTaxSub);
    setText('sBox3',model.taxValue);
    setText('sBox3Sub',model.taxSub);
    setText('bAfterTaxLabel',model.afterTaxLabel);
    setText('bAfterTax',model.afterTaxValue);
    setText('bAfterTaxSub',model.afterTaxSub);
    if(!model.available)setText('taxSummaryPeriod','Tax-adjusted result unavailable');
  }

  function updateChart(model){
    const canvas=$('mainChart');
    const chart=window.Chart?.getChart?.(canvas)||window.Chart?.getChart?.('mainChart');
    if(chart?.data?.datasets?.[0]){
      chart.data.datasets[0].label=model.chartLabel;
      chart.data.datasets[0].data=model.chartSeries.map(row=>Math.round(finiteOr(row.portfolio)));
      if(chart.data.datasets[1])chart.data.datasets[1].data=model.chartSeries.map(row=>Math.round(finiteOr(row.mortgage)));
      if(chart.data.datasets[2])chart.data.datasets[2].data=model.chartSeries.map(row=>Math.round(finiteOr(row.invested)));
      chart.update?.('none');
    }
    const legend=document.querySelector('#tab-scenarios .legend span:first-child');
    if(legend){
      const icon=legend.querySelector('i');
      legend.textContent='';
      if(icon)legend.appendChild(icon);
      legend.appendChild(document.createTextNode(model.chartLabel));
    }
  }

  function updateYearTable(model){
    if(!model.blockYearTable)return;
    const body=$('box3YearBody');
    if(!body)return;
    const columns=body.closest('table')?.querySelectorAll('thead th').length||6;
    body.innerHTML='';
    const row=document.createElement('tr');
    const cell=document.createElement('td');
    cell.colSpan=columns;
    cell.textContent=`Year-by-year Box 3 results are unavailable. ${model.reason}`;
    row.appendChild(cell);
    body.appendChild(row);
  }

  function updateHousehold(model){
    const h=model.household;
    const value=item=>model.householdAvailable?formatOptionalMoney(item):'Unavailable';
    setText('householdSavingsEnd',value(h.savings));
    setText('householdDebtEnd',value(h.box3Debt));
    setText('householdNetEnd',value(h.netFinancialAssets));
    setText('householdExternalTax',value(h.externalTax));
    setText('householdExternalFutureValue',value(h.externalCashFlowFutureValue));
    setText('bLoss',value(h.lossCarry));
  }

  function ensureStatusCallout(model){
    const host=$('regimeExplanation')?.closest('.card');
    if(!host)return;
    let callout=$('box3OutputIntegrityStatus');
    if(!callout){
      callout=document.createElement('div');
      callout.id='box3OutputIntegrityStatus';
      callout.className='callout';
      host.appendChild(callout);
    }
    callout.classList.toggle('warn',!model.available);
    callout.innerHTML=model.available
      ?'<strong>Output status:</strong> cards, charts, year tables and CSV exports use the same canonical result fields.'
      :`<strong>Output status: tax-adjusted values unavailable.</strong><br><span>${model.reason} Untaxed projections are labeled Before Box 3.</span>`;
  }

  function appendAssumptionLog(model){
    const log=$('assumptionLog');
    if(!log)return;
    const marker='[Canonical output]';
    const current=String(log.textContent||'').split('\n').filter(line=>!line.startsWith(marker));
    current.push(`${marker} Box 3 status: ${model.available?(model.ignored?'Ignored':model.status):'Not estimable'}`);
    current.push(`${marker} Portfolio before Box 3: ${model.beforeTaxValue}`);
    current.push(`${marker} Portfolio after settled Box 3: ${model.afterTaxValue}`);
    if(!model.available)current.push(`${marker} Reason: ${model.reason}`);
    log.textContent=current.join('\n');
  }

  function ensureInterpretationWarnings(){
    const taxBenefit=$('mTaxBenefit')?.closest('.summary-item');
    const label=taxBenefit?.querySelector('.k');
    const sub=taxBenefit?.querySelector('.s');
    if(label)label.textContent='Modeled own-home Box 1 effect';
    if(sub)sub.textContent='2026 progressive Box 1 bridge, not a tax return';

    const boxCard=$('box3Mode')?.closest('.card');
    if(boxCard&&!$('r641ThirtyPercentBox3Warning')){
      const warning=document.createElement('div');
      warning.id='r641ThirtyPercentBox3Warning';
      warning.className='callout warn';
      warning.innerHTML='<strong>30% ruling and Box 3:</strong> the ruling checkbox changes only the Box 1 income estimate. It does not model transitional partial foreign taxpayer treatment that may affect Box 3 for some users through 2026.';
      boxCard.appendChild(warning);
    }
    if(boxCard&&!$('r641FrozenRulesWarning')){
      const warning=document.createElement('div');
      warning.id='r641FrozenRulesWarning';
      warning.className='callout';
      warning.innerHTML='<strong>Long-horizon assumption:</strong> except for the Hillen phase-out, entered WOZ and most 2026 tax parameters are held constant. This is a constant-rules scenario, not a forecast of future Dutch law.';
      boxCard.appendChild(warning);
    }
    const owner=$('scenarioVveNew')?.closest('.card');
    if(owner&&!$('r641OwnerCostWarning')){
      const warning=document.createElement('div');
      warning.id='r641OwnerCostWarning';
      warning.className='callout';
      warning.innerHTML='<strong>Owner-cost assumption:</strong> VvE, maintenance, owner taxes, insurance and ground lease escalate at the entered effective annual owner-cost growth rate. This is a planning assumption, not a forecast.';
      owner.appendChild(warning);
    }
    const savingsLabel=document.querySelector('label[for="box3SavingsReturn"]');
    if(savingsLabel)savingsLabel.textContent='Expected effective annual savings yield %';
    const debtLabel=document.querySelector('label[for="box3DebtInterest"]');
    if(debtLabel)debtLabel.textContent='Contractual nominal annual Box 3 debt interest %';
  }

  function apply(){
    updateRelease();
    ensureInterpretationWarnings();
    const canonical=window.__DIMP_CANONICAL_RESULT||latestCanonical;
    if(!canonical)return;
    const model=outputModel(canonical);
    window.__DIMP_OUTPUT_MODEL=model;
    window.__R641_OUTPUT_MODEL=model;
    updateHeadline(model);
    updateChart(model);
    updateYearTable(model);
    updateHousehold(model);
    ensureStatusCallout(model);
    appendAssumptionLog(model);
  }

  document.addEventListener('input',schedule);
  document.addEventListener('change',schedule);
  window.addEventListener('load',schedule,{once:true});
  updateRelease();
  ensureInterpretationWarnings();
  schedule();
}

return{
  RELEASE_META,
  CANONICAL_KINDS,
  finiteOrNull,
  taxAdjustedAvailable,
  formatMoney,
  formatOptionalMoney,
  formatExportNumber,
  formatPercent,
  releaseLabel,
  canonicalPlanResult,
  unavailablePlanResult,
  withoutBox3,
  decorateFinanceCore,
  planExportRows,
  outputModel,
  scenarioCardModel,
  canonicalComparisonResult,
  comparisonExportRows,
  comparisonOutputModel,
  canonicalNextEuroResult,
  nextEuroExportRows,
  nextEuroOutputModel,
  canonicalExportRows,
  csvEscape,
  outputCsv,
  bootBrowser
};
});

if(typeof window!=='undefined'&&window.document)window.OutputIntegrity.bootBrowser();
