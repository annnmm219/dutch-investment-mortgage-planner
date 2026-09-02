(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.OutputIntegrity=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';

const RELEASE_META=Object.freeze({
  version:'R6.4.2',
  ruleYear:2026,
  updated:'2026-09-02',
  stateSchema:4,
  releaseName:'Output Integrity'
});

function finiteOrNull(value){
  if(value===null||value===undefined||value==='')return null;
  const number=Number(value);
  return Number.isFinite(number)?number:null;
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

function releaseLabel(meta=RELEASE_META){
  const date=String(meta.updated||'').split('-');
  const display=date.length===3?`${Number(date[2])} ${['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(date[1])]||date[1]} ${date[0]}`:String(meta.updated||'');
  return `Calculation build ${meta.version} · ${meta.ruleYear} rules · updated ${display}`;
}

function outputModel(result={},config={}){
  const available=taxAdjustedAvailable(result);
  const mode=config.box3Mode||config.box3?.mode||'current';
  const ignored=mode==='none';
  const reason=String(result.taxBlockReason||result.reason||'Complete the required Box 3 information to calculate a tax-adjusted result.');
  const portfolio=finiteOrNull(result.portfolio);
  const tax=available?finiteOrNull(result.box3Tax??result.totalTax):null;
  const unsettled=available?finiteOrNull(result.unsettledTaxEstimate):null;
  return{
    available,
    ignored,
    status:available?(result.taxStatus||result.box3Status||'settled'):(result.taxStatus||result.box3Status||'not-estimable'),
    reason,
    headlineLabel:available&&!ignored?'Investment portfolio after Box 3':'Investment portfolio before Box 3',
    headlineValue:formatOptionalMoney(portfolio),
    headlineSub:available?(ignored?'Box 3 is switched off for this projection.':'after the selected settled Box 3 treatment'):'Tax-adjusted result unavailable.',
    chartLabel:available&&!ignored?'Portfolio after Box 3':'Portfolio before Box 3',
    taxValue:available?formatOptionalMoney(tax,'€0'):'Not estimable',
    taxSub:available?(ignored?'Box 3 ignored.':'Settled tax under the selected model.'):`${reason}`,
    afterTaxLabel:available&&!ignored?'Portfolio after settled Box 3':'Tax-adjusted portfolio',
    afterTaxValue:available?formatOptionalMoney(portfolio):'Unavailable',
    afterTaxSub:available?(ignored?'Same as the before-Box-3 projection because tax is switched off.':'Includes only settled Box 3 charges; an incomplete final year may remain unsettled.'):'Tax-adjusted portfolio is not shown while Box 3 is unavailable.',
    scenarioTaxText:available?(ignored?'Box 3 ignored':`${formatOptionalMoney(tax,'€0')} settled Box 3${unsettled&&unsettled>0?` + ${formatMoney(unsettled)} unsettled`:''}`):'Tax-adjusted result unavailable',
    blockYearTable:!available,
    householdAvailable:available,
    exportRows:[
      ['Box 3','Status',available?(ignored?'Ignored':String(result.taxStatus||result.box3Status||'Available')):'Not estimable'],
      ['Box 3','Reason',available?'':reason],
      ['Results','Portfolio before Box 3',formatOptionalMoney(portfolio,'')],
      ['Results','Portfolio after Box 3',available?formatOptionalMoney(portfolio,''):''],
      ['Results','Box 3 tax',available?formatOptionalMoney(tax,'€0'):''],
      ['Results','Tax-adjusted comparable wealth',available?formatOptionalMoney(result.householdComparableWealth??result.comparableWealth,''):'' ]
    ]
  };
}

function scenarioCardModel({portfolio,mortgage,box3Tax,unsettledTaxEstimate}={},available=true,ignored=false){
  const value=formatOptionalMoney(portfolio);
  const mortgageText=finiteOrNull(mortgage)===null?'':` · mortgage ${formatMoney(mortgage)}`;
  if(!available)return{value,sub:`Before Box 3 projection · tax-adjusted result unavailable${mortgageText}`};
  if(ignored)return{value,sub:`Box 3 ignored${mortgageText}`};
  const tax=finiteOrNull(box3Tax);
  const unsettled=finiteOrNull(unsettledTaxEstimate);
  return{value,sub:`${formatOptionalMoney(tax,'€0')} settled Box 3${unsettled&&unsettled>0?` + ${formatMoney(unsettled)} unsettled`:''}${mortgageText}`};
}

function csvEscape(value){
  const text=String(value??'');
  return /[",\n\r]/.test(text)?`"${text.replace(/"/g,'""')}"`:text;
}

function outputCsv(model,extraRows=[]){
  return [['Section','Assumption','Value'],...model.exportRows,...extraRows]
    .map(row=>row.map(csvEscape).join(','))
    .join('\r\n');
}

function bootBrowser(){
  if(typeof window==='undefined'||typeof document==='undefined')return;
  const $=id=>document.getElementById(id);
  const FC=window.FinanceCore;
  if(!FC)throw new Error('FinanceCore must load before output-integrity.js');
  let latestResult=null;
  let latestConfig=null;
  let scheduled=false;

  window.MODEL_META=RELEASE_META;

  function selectedMortgageType(){
    return document.querySelector('.compare-card.active[data-mort-type]')?.dataset.mortType||'annuity';
  }

  function isMainPlan(config={}){
    if(!Array.isArray(config.phases)||config.phases.length===0)return false;
    const rate=Number($('annualReturn')?.value);
    const mode=$('box3Mode')?.value||'none';
    const phaseCount=Math.max(1,Number($('phaseCount')?.value)||3);
    if(config.phases.length!==phaseCount)return false;
    if((config.box3Mode||'none')!==mode)return false;
    if(Number.isFinite(rate)&&Math.abs(Number(config.annualReturnPct)-rate)>1e-8)return false;
    if(config.mortType&&config.mortType!==selectedMortgageType())return false;
    return true;
  }

  if(!FC.__r641OutputCapture){
    const original=FC.simulatePlan.bind(FC);
    FC.simulatePlan=function(config={}){
      const result=original(config);
      if(isMainPlan(config)){
        latestResult=result;
        latestConfig={...config};
        window.__R641_LAST_MAIN_RESULT=result;
        schedule();
      }
      return result;
    };
    Object.defineProperty(FC,'__r641OutputCapture',{value:true,enumerable:false});
  }

  function schedule(){
    if(scheduled)return;
    scheduled=true;
    setTimeout(()=>{
      const run=()=>{scheduled=false;apply();};
      if(typeof requestAnimationFrame==='function')requestAnimationFrame(run);else run();
    },0);
  }

  function setText(id,text){const el=$(id);if(el)el.textContent=text;}

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
    setText('sBox3',model.taxValue);
    setText('sBox3Sub',model.taxSub);
    setText('bAfterTaxLabel',model.afterTaxLabel);
    setText('bAfterTax',model.afterTaxValue);
    setText('bAfterTaxSub',model.afterTaxSub);
    if(!model.available)setText('taxSummaryPeriod','Tax-adjusted result unavailable');
  }

  function updateScenarioRateCards(model){
    const cards=Array.from(document.querySelectorAll('#scenarioCards .scenario'));
    cards.forEach(card=>{
      const sub=card.querySelector('.sub');
      if(!sub)return;
      if(!model.available){
        const mortgage=/mortgage\s+(€[^·]+)/i.exec(sub.textContent||'');
        sub.textContent=`Before Box 3 projection · tax-adjusted result unavailable${mortgage?` · mortgage ${mortgage[1].trim()}`:''}`;
      }else if(model.ignored){
        const mortgage=/mortgage\s+(€[^·]+)/i.exec(sub.textContent||'');
        sub.textContent=`Box 3 ignored${mortgage?` · mortgage ${mortgage[1].trim()}`:''}`;
      }
    });
  }

  function updateChart(model){
    const canvas=$('mainChart');
    const chart=window.Chart?.getChart?.(canvas)||window.Chart?.getChart?.('mainChart');
    if(chart?.data?.datasets?.[0]){
      chart.data.datasets[0].label=model.chartLabel;
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
    if(model.householdAvailable)return;
    ['householdSavingsEnd','householdNetEnd','householdExternalTax','bLoss'].forEach(id=>setText(id,'Unavailable'));
  }

  function updateDecisionAndNextEuro(model){
    if(model.available)return;
    const verdict=$('scenarioVerdictNew');
    if(verdict){
      verdict.classList.add('invalid');
      verdict.innerHTML=`<strong>Tax-adjusted comparison unavailable.</strong><span> ${model.reason}</span>`;
    }
    ['nextEuroBreakEven','nextEuroWinner','nextEuroDifference'].forEach(id=>setText(id,'Unavailable'));
    setText('nextEuroBreakEvenSub','Resolve the Box 3 status before using a tax-adjusted break-even result.');
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
      ?'<strong>Output status:</strong> tax-dependent cards, chart labels and exports use the selected Box 3 result.'
      :`<strong>Output status: tax-adjusted values unavailable.</strong><br><span>${model.reason} Untaxed projections are labeled Before Box 3.</span>`;
  }

  function appendAssumptionLog(model){
    const log=$('assumptionLog');
    if(!log)return;
    const marker='[Box 3 output]';
    const current=String(log.textContent||'').split('\n').filter(line=>!line.startsWith(marker));
    current.push(`${marker} Status: ${model.available?(model.ignored?'Ignored':model.status):'Not estimable'}`);
    if(!model.available)current.push(`${marker} Reason: ${model.reason}`);
    log.textContent=current.join('\n');
  }

  function collectExportRows(){
    const rows=[];
    document.querySelectorAll('input,select').forEach(el=>{
      if(el.type==='hidden'||el.name==='viewDensity')return;
      const label=el.id?document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent?.trim():'';
      if(!label)return;
      const value=(el.type==='checkbox'||el.type==='radio')?(el.checked?'Yes':'No'):(el.selectedOptions?.[0]?.textContent||el.value);
      rows.push(['Assumption',label,value]);
    });
    return rows;
  }

  function downloadBlockedCsv(model){
    const csv='\uFEFF'+outputCsv(model,[['Model','Version',RELEASE_META.version],['Model','Generated',new Date().toISOString()],...collectExportRows()]);
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;
    link.download=`dutch-investment-mortgage-plan-${RELEASE_META.version}-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  document.addEventListener('click',event=>{
    if(event.target?.id==='exportAssumptionsCsv'&&latestResult&&!taxAdjustedAvailable(latestResult)){
      event.preventDefault();
      event.stopImmediatePropagation();
      downloadBlockedCsv(outputModel(latestResult,latestConfig||{}));
    }
    if(event.target?.id==='refreshAssumptionLog')schedule();
  },true);

  function ensureInterpretationWarnings(){
    const taxBenefit=$('mTaxBenefit')?.closest('.summary-item');
    const label=taxBenefit?.querySelector('.k');
    const sub=taxBenefit?.querySelector('.s');
    if(label)label.textContent='Modeled HRA sensitivity estimate';
    if(sub)sub.textContent='simplified marginal-rate proxy, not a tax return';

    const boxCard=$('box3Mode')?.closest('.card');
    if(boxCard&&!$('r641ThirtyPercentBox3Warning')){
      const warning=document.createElement('div');
      warning.id='r641ThirtyPercentBox3Warning';
      warning.className='callout warn';
      warning.innerHTML='<strong>30% ruling and Box 3:</strong> the ruling checkbox changes only the HRA income proxy. It does not model transitional partial foreign taxpayer treatment that may affect Box 3 for some users through 2026.';
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
      warning.innerHTML='<strong>Owner-cost assumption:</strong> VvE, maintenance, owner taxes, insurance and ground lease stay flat in nominal euros, while rent and home value may use growth assumptions.';
      owner.appendChild(warning);
    }
    const savingsLabel=document.querySelector('label[for="box3SavingsReturn"]');
    if(savingsLabel)savingsLabel.textContent='Actual savings interest % / year';
    const debtLabel=document.querySelector('label[for="box3DebtInterest"]');
    if(debtLabel)debtLabel.textContent='Actual Box 3 debt interest % / year';
  }

  function apply(){
    updateRelease();
    ensureInterpretationWarnings();
    if(!latestResult)return;
    const model=outputModel(latestResult,latestConfig||{});
    window.__R641_OUTPUT_MODEL=model;
    updateHeadline(model);
    updateScenarioRateCards(model);
    updateChart(model);
    updateYearTable(model);
    updateHousehold(model);
    updateDecisionAndNextEuro(model);
    ensureStatusCallout(model);
    appendAssumptionLog(model);
  }

  document.addEventListener('input',schedule);
  document.addEventListener('change',schedule);
  window.addEventListener('load',schedule,{once:true});
  updateRelease();
  ensureInterpretationWarnings();
  const trigger=$('annualReturn')||$('box3Mode');
  trigger?.dispatchEvent(new Event('input',{bubbles:true}));
  schedule();
}

return{
  RELEASE_META,
  finiteOrNull,
  taxAdjustedAvailable,
  formatMoney,
  formatOptionalMoney,
  releaseLabel,
  outputModel,
  scenarioCardModel,
  csvEscape,
  outputCsv,
  bootBrowser
};
});

if(typeof window!=='undefined'&&window.document)window.OutputIntegrity.bootBrowser();
