(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.ViewDensity=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';

const DEFAULT_VIEW='single';
const STANDARD_PHASE_LIMIT=6;
const ADVANCED_SCENARIOS=new Set();
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const DEFAULTS=Object.freeze({
  bonusMonth:12,
  box3Mode:'current',
  box3PaySource:'savings',
  box3Debt:0,
  box3DebtInterest:4,
  box3DebtMonthlyRepayment:0,
  box3DebtRepaymentSource:'external',
  box3DebtFallbackDestination:'invest',
  currentTaxRate:36,
  currentAllowance:59357,
  currentNotional:6,
  currentSavingsNotional:1.28,
  currentDebtNotional:2.70,
  currentDebtThreshold:3800,
  futureStart:2028,
  futureTaxRate:36,
  futureExempt:1800,
  futureLossThreshold:500,
  deductionMode:'auto',
  qualifyingShare:100,
  unusedMortgageDestination:'invest',
  mortgageReportHorizon:'investment',
  transferTaxMode:'main',
  nhgMode:'none',
  upfrontCashTreatment:'invest',
  scenarioMortgageMethod:'selected',
  sensitivityLow:2,
  sensitivityHigh:10,
  sensitivityStep:2,
  vveMonthly:250,
  maintenanceAnnual:1500,
  ownerTaxesAnnual:0,
  insuranceAnnual:0,
  groundLeaseAnnual:0,
  ownerCostGrowthPct:2
});

function normalizeView(){return DEFAULT_VIEW;}
function number(value,fallback=0){
  const parsed=Number(String(value??'').trim().replace(/\s+/g,'').replace(',','.'));
  return Number.isFinite(parsed)?parsed:fallback;
}
function optionalNumber(value){
  if(value==null||String(value).trim()==='')return null;
  const parsed=number(value,NaN);
  return Number.isFinite(parsed)?parsed:null;
}
function near(a,b,tolerance=.005){return Math.abs(number(a)-number(b))<=tolerance;}
function money(value){return '€'+Math.round(number(value)).toLocaleString('nl-NL');}
function percent(value){return number(value).toLocaleString('nl-NL',{maximumFractionDigits:2})+'%';}
function monthlyOwnerCost(values={}){
  return Math.max(0,number(values.vveMonthly))+
    (Math.max(0,number(values.maintenanceAnnual))+
     Math.max(0,number(values.ownerTaxesAnnual))+
     Math.max(0,number(values.insuranceAnnual))+
     Math.max(0,number(values.groundLeaseAnnual)))/12;
}
function resolveScenarioReturn(globalValue,scenarioValue,overrideEnabled=false){
  return overrideEnabled?number(scenarioValue,number(globalValue,5)):number(globalValue,5);
}
function escapeCsv(value){
  const text=String(value??'');
  return /[",\n\r]/.test(text)?`"${text.replace(/"/g,'""')}"`:text;
}
function assumptionsToCsv(rows=[]){
  return [['Section','Assumption','Value'],...rows.map(row=>[row.section||'',row.label||'',row.value??''])]
    .map(row=>row.map(escapeCsv).join(','))
    .join('\r\n');
}
function applyScenarioWoz(config={},values={}){
  const next={...config};
  if(next.mode==='buy-rent'&&values.buyRentWoz!=null)next.buyRent={...(next.buyRent||{}),wozValue:Math.max(0,number(values.buyRentWoz))};
  else if(next.mode==='downpayment'&&values.downpaymentWoz!=null)next.downpayment={...(next.downpayment||{}),wozValue:Math.max(0,number(values.downpaymentWoz))};
  else if(next.mode==='sell-rent'&&values.sellRentWoz!=null)next.sellRent={...(next.sellRent||{}),wozValue:Math.max(0,number(values.sellRentWoz))};
  return next;
}
function collectAdvancedState(values={}){
  const items=[];
  const add=(group,key,label)=>items.push({group,key,label});
  if(Math.round(number(values.bonusMonth,12))!==12)add('plan','bonus-month',`Annual bonus month: ${MONTHS[Math.max(0,Math.min(11,Math.round(number(values.bonusMonth))-1))]||values.bonusMonth}`);
  if(values.box3Mode==='transition')add('box3','box3-mode','Box 3 transition scenario');
  if(values.box3Mode==='future')add('box3','box3-mode','Proposed Box 3 regime');
  if(values.box3PaySource&&values.box3PaySource!==DEFAULTS.box3PaySource)add('box3','box3-source',`Box 3 paid from ${values.box3PaySource}`);
  if(number(values.box3Debt)>0)add('box3','box3-debt',`Other Box 3 debt: ${money(values.box3Debt)}`);
  if(number(values.box3DebtMonthlyRepayment)>0)add('box3','box3-debt-payment',`Box 3 debt repayment: ${money(values.box3DebtMonthlyRepayment)}/mo`);
  if(number(values.box3Debt)>0&&!near(values.box3DebtInterest,DEFAULTS.box3DebtInterest))add('box3','box3-debt-interest',`Box 3 debt interest: ${percent(values.box3DebtInterest)}`);
  if(values.box3DebtRepaymentSource&&values.box3DebtRepaymentSource!==DEFAULTS.box3DebtRepaymentSource)add('box3','box3-debt-source','Box 3 debt repayment uses savings');
  if(values.box3DebtFallbackDestination&&values.box3DebtFallbackDestination!==DEFAULTS.box3DebtFallbackDestination)add('box3','box3-debt-fallback',`After Box 3 debt payoff: ${values.box3DebtFallbackDestination}`);
  const customCurrent=!near(values.currentTaxRate,DEFAULTS.currentTaxRate)||!near(values.currentAllowance,DEFAULTS.currentAllowance)||!near(values.currentNotional,DEFAULTS.currentNotional)||!near(values.currentSavingsNotional,DEFAULTS.currentSavingsNotional)||!near(values.currentDebtNotional,DEFAULTS.currentDebtNotional)||!near(values.currentDebtThreshold,DEFAULTS.currentDebtThreshold);
  if(customCurrent)add('box3','box3-parameters','Custom 2026 Box 3 parameters');
  const customFuture=!near(values.futureStart,DEFAULTS.futureStart)||!near(values.futureTaxRate,DEFAULTS.futureTaxRate)||!near(values.futureExempt,DEFAULTS.futureExempt)||!near(values.futureLossThreshold,DEFAULTS.futureLossThreshold);
  if(customFuture)add('box3','future-box3','Custom proposed-regime parameters');
  if(values.jan1Assumption)add('box3','jan1','Plan-start balances used as 1 January assumption');
  else if(values.jan1SnapshotEntered)add('box3','jan1','Custom 1 January snapshot');
  if(values.deductionMode&&values.deductionMode!==DEFAULTS.deductionMode)add('mortgage','deduction-mode','Manual mortgage deduction rate');
  if(Number.isFinite(number(values.hraRemainingMonths,NaN))&&Number.isFinite(number(values.defaultHraMonths,NaN))&&!near(values.hraRemainingMonths,values.defaultHraMonths,.5))add('mortgage','hra-remaining',`HRA remaining: ${Math.floor(number(values.hraRemainingMonths)/12)}y ${Math.round(number(values.hraRemainingMonths))%12}m`);
  if(!near(values.qualifyingShare,DEFAULTS.qualifyingShare))add('mortgage','qualifying-share',`HRA-qualifying share: ${percent(values.qualifyingShare)}`);
  if(values.hillenOverrideEnabled)add('mortgage','hillen-override',`Hillen override: ${percent(values.hillenOverridePct)}`);
  if(values.unusedMortgageDestination&&values.unusedMortgageDestination!==DEFAULTS.unusedMortgageDestination)add('mortgage','unused-mortgage',`After-payoff cash: ${values.unusedMortgageDestination}`);
  if(values.mortgageReportHorizon&&values.mortgageReportHorizon!==DEFAULTS.mortgageReportHorizon)add('mortgage','mortgage-horizon',`Mortgage report horizon: ${values.mortgageReportHorizon}`);
  if(values.transferTaxMode&&!['main','starter'].includes(values.transferTaxMode))add('mortgage','transfer-tax',`Transfer-tax treatment: ${values.transferTaxMode}`);
  if(number(values.appraisedValue)>0&&number(values.housePrice)>0&&!near(values.appraisedValue,values.housePrice,1))add('mortgage','appraisal','Appraised value differs from price');
  if(values.nhgMode==='energy')add('mortgage','nhg','Energy-enhanced NHG path');
  if(values.upfrontCashTreatment&&values.upfrontCashTreatment!==DEFAULTS.upfrontCashTreatment)add('scenario','upfront-cash','Unused purchase cash kept in savings');
  if(values.scenarioMortgageMethod&&values.scenarioMortgageMethod!==DEFAULTS.scenarioMortgageMethod)add('scenario','scenario-mortgage-method',`Scenario mortgage method: ${values.scenarioMortgageMethod}`);
  if(values.scenarioWoz!=null)add('scenario','scenario-woz',`Scenario WOZ: ${money(values.scenarioWoz)}`);
  if(values.scenarioReturnOverrideEnabled)add('scenario','scenario-return','Custom scenario return');
  const customSensitivity=!near(values.sensitivityLow,DEFAULTS.sensitivityLow)||!near(values.sensitivityHigh,DEFAULTS.sensitivityHigh)||!near(values.sensitivityStep,DEFAULTS.sensitivityStep);
  if(customSensitivity)add('scenario','sensitivity','Custom return sensitivity range');
  const ownerCostGrowth=values.ownerCostGrowthPct==null?DEFAULTS.ownerCostGrowthPct:number(values.ownerCostGrowthPct);
  const customOwner=!near(values.vveMonthly,DEFAULTS.vveMonthly)||!near(values.maintenanceAnnual,DEFAULTS.maintenanceAnnual)||!near(values.ownerTaxesAnnual,DEFAULTS.ownerTaxesAnnual)||!near(values.insuranceAnnual,DEFAULTS.insuranceAnnual)||!near(values.groundLeaseAnnual,DEFAULTS.groundLeaseAnnual)||!near(ownerCostGrowth,DEFAULTS.ownerCostGrowthPct);
  if(customOwner)add('scenario','owner-costs',`Customized owner-cost split: ${money(monthlyOwnerCost(values))}/mo`);
  return items;
}

function bootBrowser(){
  if(typeof window==='undefined'||typeof document==='undefined')return;
  if(document.documentElement.dataset.r65Interface==='1')return;
  document.documentElement.dataset.r65Interface='1';
  const $=id=>document.getElementById(id);
  let ownerSync=false,refreshQueued=false,wrappedScenario=false,wrappedFinance=false;

  function fire(el){
    if(!el)return;
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function field(id){return $(id)?.closest('.field')||null;}
  function detailsBySummary(pattern,root=document){return Array.from(root.querySelectorAll('details')).find(el=>pattern.test(String(el.querySelector(':scope > summary')?.textContent||'')))||null;}
  function createDetails(id,title,className='fold r65-local-fold'){
    const details=document.createElement('details');
    details.id=id;
    details.className=className;
    details.innerHTML=`<summary><span data-r65-summary-base>${title}</span><span class="r65-fold-badge" data-r65-fold-badge></span></summary><div class="fold-body" data-r65-fold-body></div>`;
    return details;
  }
  function bodyOf(details){return details?.querySelector('[data-r65-fold-body],.fold-body,.inner-fold-body')||null;}
  function move(container,...nodes){nodes.flat().filter(Boolean).forEach(node=>container.appendChild(node));}
  function setHidden(el,hidden){if(el)el.classList.toggle('hidden',Boolean(hidden));}

  function injectStyle(){
    if($('r65InterfaceStyle'))return;
    const style=document.createElement('style');
    style.id='r65InterfaceStyle';
    style.textContent=`
      #viewDensityBar,#advancedStateSummary{display:none!important}
      .planner-storage-bar.r65-save-compact{display:inline-flex;align-items:center;gap:10px;width:auto;margin:12px 0 0;padding:0;background:transparent;border:0;border-radius:0;font-size:11px;color:var(--muted)}
      .planner-storage-bar.r65-save-compact>span:first-child{display:none!important}
      .r65-save-compact .planner-storage-actions{gap:8px}
      .r65-save-compact .planner-reset{padding:5px 8px;background:transparent}
      .r65-local-fold{margin-top:12px}
      .r65-local-fold>summary{display:flex;align-items:center;justify-content:space-between;gap:12px}
      .r65-fold-badge{font-size:10px;font-weight:500;color:var(--amber)}
      .r65-simple-row{display:flex;align-items:center;gap:18px;flex-wrap:wrap;margin:10px 0 14px;padding:11px 13px;background:var(--alt);border-radius:var(--small)}
      .r65-simple-row .field{margin:0;min-width:190px;flex:0 1 280px}
      .r65-simple-toggle{display:flex;align-items:center;gap:9px;font-size:13px;color:var(--text)}
      .r65-simple-toggle input{width:17px;height:17px;accent-color:var(--accent)}
      .r65-mode-summary{font-size:11px;color:var(--muted)}
      .r65-advanced-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
      .r65-inherited-return{min-height:42px;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;background:var(--alt);border:.5px solid var(--border2);border-radius:var(--small)}
      .r65-inherited-return strong{font-size:13px;color:var(--text)}
      .r65-inherited-return label{display:flex;align-items:center;gap:6px;margin:0;font-size:10px;color:var(--secondary);cursor:pointer}
      .r65-inherited-return input{width:15px;height:15px;accent-color:var(--accent)}
      .r65-owner-total input{width:100%;min-height:40px;border:.5px solid var(--border2);border-radius:var(--small);background:var(--surface);color:var(--text);padding:8px 10px;font:inherit;font-size:13px;outline:none}
      .r65-how-fold .callout{margin:8px 0;background:var(--alt);color:var(--secondary)}
      .r65-how-fold .foot{margin:8px 0}
      .r65-status-ok{display:inline-flex;align-items:center;gap:6px;color:var(--green);font-size:12px;font-weight:600}
      .r65-status-ok::before{content:'✓'}
      .scenario-budget-status.r65-compact-ok{padding:7px 0;background:transparent;border:0;margin-top:8px}
      .scenario-verdict-new small:not(.scenario-budget-warning){display:none!important}
      .scenario-specific-new .callout{padding:9px 11px;margin:8px 0;font-size:12px}
      .r65-copy-hidden{display:none!important}
      .r65-audit-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
      .r65-assumption-log{max-height:360px;overflow:auto;white-space:pre-wrap;background:var(--alt);border-radius:var(--small);padding:12px;font-size:11px;color:var(--secondary)}
      option.density-option-hidden{display:block!important}
      #phaseList .density-advanced-phase{display:block!important}
      @media(max-width:800px){.r65-advanced-grid{grid-template-columns:1fr}.r65-inherited-return{align-items:flex-start;flex-direction:column}.planner-storage-bar.r65-save-compact{display:flex}}
    `;
    document.head.appendChild(style);
  }

  function compactSaveBar(){
    const bar=$('plannerStorageBar'),header=document.querySelector('header');
    if(!bar||!header)return;
    bar.classList.add('r65-save-compact');
    header.appendChild(bar);
    const reset=$('plannerReset');
    if(reset){reset.textContent='Start fresh';reset.title='Clear the saved plan in this browser and restore the example values.';}
    const status=$('plannerSaveStatus');
    if(!status)return;
    const raw=String(status.textContent||'');
    const desired=/Restored/i.test(raw)?'Previous plan restored':/Saved locally/i.test(raw)?'Saved in this browser':/Not saved/i.test(raw)?'Example values':raw;
    if(desired!==raw)status.textContent=desired;
  }

  function simplifyStaticCopy(){
    const header=document.querySelector('header>p');
    if(header)header.textContent='Plan investments, mortgage choices and Dutch tax assumptions in one timeline.';
    const investmentDivider=$('tab-investment')?.querySelector(':scope>.section-divider p');
    if(investmentDivider)investmentDivider.textContent='Set your timeline, contributions and investment assumptions.';
    const mortgageDivider=$('tab-mortgage')?.querySelector(':scope>.section-divider p');
    if(mortgageDivider)mortgageDivider.textContent='Enter an existing mortgage or plan a purchase.';
    const scenarioDivider=$('tab-scenarios')?.querySelector(':scope>.section-divider p');
    if(scenarioDivider)scenarioDivider.textContent='Compare two strategies under one shared set of assumptions.';
    const notes=[
      [$('startMonth')?.closest('.card')?.querySelector('.section-note'),'Choose when the plan starts.'],
      [$('phaseList')?.closest('.card')?.querySelector('.section-note'),'Set how monthly contributions change over time.'],
      [$('annualReturn')?.closest('.card')?.querySelector('.section-note'),'One return assumption applies to the whole plan.'],
      [$('mortgageMode')?.closest('.card')?.querySelector('.section-note'),'Use either your current loan or a planned purchase.'],
      [$('linearCompare')?.closest('.card')?.querySelector('.section-note'),'Both structures are calculated; select the one used elsewhere in the planner.'],
      [$('wozValue')?.closest('.card')?.querySelector('.section-note'),'Planning estimate based on income, WOZ and HRA eligibility.'],
      [$('comparisonType')?.closest('.card')?.querySelector('.section-note'),'Choose the decision and horizon.'],
      [$('scenarioMonthlyBudgetNew')?.closest('.card')?.querySelector('.section-note'),'Only assumptions relevant to the selected decision remain visible.'],
      [$('scenarioVerdictNew')?.closest('.card')?.querySelector('.section-note'),'The result compares final modeled positions under the same cash-flow rule.']
    ];
    notes.forEach(([el,text])=>{if(el)el.textContent=text;});
    const phaseFoot=$('phaseList')?.closest('.card')?.querySelector('.foot');
    if(phaseFoot)phaseFoot.classList.add('r65-copy-hidden');
  }

  function ensurePlanTiming(){
    if($('r65PlanTiming'))return;
    const bonus=field('bonusMonth'),card=$('startMonth')?.closest('.card');
    if(!bonus||!card)return;
    const details=createDetails('r65PlanTiming','Bonus timing','inner-fold r65-local-fold');
    const body=bodyOf(details);
    const grid=document.createElement('div');grid.className='r65-advanced-grid';body.appendChild(grid);grid.appendChild(bonus);
    card.appendChild(details);
  }

  function ensureBox3Advanced(){
    let details=detailsBySummary(/^Box 3 assumptions and advanced settings/i);
    if(!details)return;
    details.id='r65Box3Advanced';
    details.classList.add('r65-local-fold');
    const summary=details.querySelector(':scope>summary');
    if(summary)summary.innerHTML='<span data-r65-summary-base>Advanced Box 3 assumptions</span><span class="r65-fold-badge" data-r65-fold-badge></span>';
    const body=bodyOf(details);
    if(!body.querySelector('[data-r65-box3-core]')){
      const grid=document.createElement('div');grid.className='r65-advanced-grid';grid.dataset.r65Box3Core='';
      body.prepend(grid);
      move(grid,field('box3Mode'),field('box3PaySource'));
    }
    const debt=detailsBySummary(/^Optional: other Box 3 debt/i);
    if(debt&&!body.contains(debt))body.appendChild(debt);
    const card=$('box3Mode')?.closest('.card')||$('sBox3')?.closest('.card');
    if(card&&!$('r65Box3How')){
      const how=createDetails('r65Box3How','How Box 3 is modeled','inner-fold r65-local-fold r65-how-fold');
      const howBody=bodyOf(how);
      move(howBody,$('regimeExplanation'),$('box3CalendarPolicy'));
      const context=$('box3HouseholdContext');
      context?.querySelectorAll(':scope>.callout').forEach(el=>howBody.appendChild(el));
      card.appendChild(how);
    }
  }

  function ensureBox3Simple(){
    if(document.querySelector('[data-r65-role="box3-simple"]'))return;
    const mode=$('box3Mode'),card=$('sBox3')?.closest('.card')||mode?.closest('.card');
    if(!mode||!card)return;
    const row=document.createElement('div');
    row.className='r65-simple-row';row.dataset.r65Role='box3-simple';
    row.innerHTML='<label class="r65-simple-toggle"><input type="checkbox" data-r65-role="box3-enabled"><span>Include Box 3</span></label><span class="r65-mode-summary" data-r65-role="box3-mode-summary"></span>';
    const originalGrid=mode.closest('.grid3');
    originalGrid?.insertAdjacentElement('beforebegin',row);
    const partner=field('taxPartners');if(partner)row.insertBefore(partner,row.lastElementChild);
    const checkbox=row.querySelector('[data-r65-role="box3-enabled"]');
    checkbox.addEventListener('change',()=>{
      if(checkbox.checked){mode.value=mode.dataset.r65LastMode&&mode.dataset.r65LastMode!=='none'?mode.dataset.r65LastMode:'current';}
      else{if(mode.value!=='none')mode.dataset.r65LastMode=mode.value;mode.value='none';}
      fire(mode);
      queueRefresh();
    });
  }

  function ensureJan1Gate(){
    if(document.querySelector('[data-r65-role="jan1-gate"]'))return;
    const card=$('sBox3')?.closest('.card')||$('box3Mode')?.closest('.card');
    if(!card)return;
    const note=document.createElement('div');
    note.className='callout warn hidden';note.dataset.r65Role='jan1-gate';
    note.innerHTML='<strong>1 January Box 3 values are required.</strong><br><span>Complete the historical portfolio, savings and Box 3 debt snapshot, or explicitly confirm the plan-start assumption.</span><br><button type="button" class="density-action" data-r65-open-box3>Open Box 3 assumptions</button>';
    card.appendChild(note);
    note.querySelector('[data-r65-open-box3]')?.addEventListener('click',()=>{const details=$('r65Box3Advanced');if(details){details.open=true;details.scrollIntoView({behavior:'smooth',block:'start'});}});
  }

  function ensurePurchaseLight(){
    const host=$('purchaseMortgageFields');
    if(!host||host.querySelector('[data-r65-role="purchase-light"]'))return;
    const block=document.createElement('div');
    block.className='grid2 r65-simple-row';block.dataset.r65Role='purchase-light';
    block.innerHTML='<div class="field"><label>Transfer tax<select data-r65-role="transfer-light"><option value="main">Main residence · 2%</option><option value="starter">Starter exemption · if eligible</option></select></label></div><div class="field"><label>NHG<select data-r65-role="nhg-light"><option value="none">No NHG</option><option value="standard">Standard NHG</option></select></label></div>';
    const summary=host.querySelector('.summary');summary?.insertAdjacentElement('beforebegin',block);
    block.querySelector('[data-r65-role="transfer-light"]')?.addEventListener('change',event=>{if(['main','starter'].includes(event.target.value)){const underlying=$('purchaseTransferTaxMode');if(underlying){underlying.value=event.target.value;fire(underlying);}}});
    block.querySelector('[data-r65-role="nhg-light"]')?.addEventListener('change',event=>{if(['none','standard'].includes(event.target.value)){const underlying=$('purchaseNhgMode');if(underlying){underlying.value=event.target.value;fire(underlying);}}});
    const details=$('purchaseCostDetails');
    if(details){details.classList.add('r65-local-fold');const s=details.querySelector(':scope>summary');if(s)s.textContent='Purchase costs and rules';}
  }

  function ensureHillenAdvanced(){
    const details=$('hraEligibilityDetails'),body=details?.querySelector('.inner-fold-body');
    if(!body||$('hillenOverrideEnabled'))return;
    const block=document.createElement('div');
    block.innerHTML='<div class="r65-advanced-grid"><div class="toggle"><input id="hillenOverrideEnabled" type="checkbox"><label for="hillenOverrideEnabled">Override the year-specific Hillen path</label></div><div class="field"><label for="hillenOverridePct">Hillen relief %</label><input id="hillenOverridePct" type="number" min="0" max="100" step="0.001" value="71.867" disabled></div></div><div class="callout"><strong>Interest-only boundary:</strong> this planner models annuity and linear repayment only.</div>';
    body.appendChild(block);
    $('hillenOverrideEnabled').addEventListener('change',()=>{syncHillenControls();fire($('wozValue'));});
    $('hillenOverridePct').addEventListener('input',()=>fire($('wozValue')));
  }

  function ensureMortgageAdvanced(){
    if($('r65MortgageAdvanced'))return;
    const card=$('wozValue')?.closest('.card');if(!card)return;
    const details=createDetails('r65MortgageAdvanced','Advanced mortgage and tax assumptions');
    const body=bodyOf(details),grid=document.createElement('div');grid.className='r65-advanced-grid';body.appendChild(grid);
    move(grid,field('deductionMode'),field('manualDeduction'));
    move(body,$('hraEligibilityDetails'),$('mortgageFallbackControls'),$('mortgageHorizonControls'));
    card.appendChild(details);
    const how=createDetails('r65MortgageHow','How the mortgage tax estimate works','inner-fold r65-local-fold r65-how-fold');
    const howBody=bodyOf(how);
    move(howBody,$('wozImpact'),$('grossIncomeHelp'));
    card.appendChild(how);
  }

  function ensureScenarioReturn(){
    if($('scenarioReturnOverrideEnabled'))return;
    const input=$('scenarioReturnNew'),wrap=input?.closest('.field'),grid=wrap?.parentElement;
    if(!input||!wrap||!grid)return;
    const global=$('annualReturn');
    const display=document.createElement('div');display.className='field';display.id='r65ScenarioReturnDisplay';
    display.innerHTML='<label>Investment return</label><div class="r65-inherited-return"><strong data-r65-role="scenario-return-label"></strong><label><input id="scenarioReturnOverrideEnabled" type="checkbox">Use a different return</label></div>';
    grid.insertBefore(display,wrap);
    wrap.classList.add('r65-return-override-field','hidden');
    const label=wrap.querySelector('label[for="scenarioReturnNew"]');if(label)label.textContent='Custom comparison return %';
    wrap.querySelector('.inline')?.classList.add('r65-copy-hidden');
    if(!near(input.value,global?.value,.0001))$('scenarioReturnOverrideEnabled').checked=true;
    $('scenarioReturnOverrideEnabled').addEventListener('change',()=>{syncScenarioReturn(true);queueRefresh();});
    input.addEventListener('input',()=>queueRefresh());
    global?.addEventListener('input',()=>syncScenarioReturn(true));
    global?.addEventListener('change',()=>syncScenarioReturn(true));
  }

  function ensureOwnerLight(){
    if(document.querySelector('[data-r65-role="owner-total"]'))return;
    const advanced=field('scenarioVveNew'),grid=advanced?.parentElement;
    if(!advanced||!grid)return;
    const wrap=document.createElement('div');wrap.className='field r65-owner-total';
    wrap.innerHTML='<label>Extra owner costs per month<input type="text" inputmode="decimal" data-r65-role="owner-total"></label>';
    grid.insertBefore(wrap,advanced);
    const input=wrap.querySelector('[data-r65-role="owner-total"]');
    input.addEventListener('input',()=>{
      if(ownerSync)return;
      const target=Math.max(0,number(input.value,NaN));if(!Number.isFinite(target))return;
      ownerSync=true;
      try{
        const ids=['scenarioVveNew','scenarioMaintenanceNew','scenarioOwnerTaxesNew','scenarioInsuranceNew','scenarioGroundLeaseNew'];
        const current={vveMonthly:number($('scenarioVveNew')?.value),maintenanceAnnual:number($('scenarioMaintenanceNew')?.value),ownerTaxesAnnual:number($('scenarioOwnerTaxesNew')?.value),insuranceAnnual:number($('scenarioInsuranceNew')?.value),groundLeaseAnnual:number($('scenarioGroundLeaseNew')?.value)};
        const total=monthlyOwnerCost(current);
        if(total>.000001){
          const factor=target/total;
          $('scenarioVveNew').value=String(current.vveMonthly*factor);
          $('scenarioMaintenanceNew').value=String(current.maintenanceAnnual*factor);
          $('scenarioOwnerTaxesNew').value=String(current.ownerTaxesAnnual*factor);
          $('scenarioInsuranceNew').value=String(current.insuranceAnnual*factor);
          $('scenarioGroundLeaseNew').value=String(current.groundLeaseAnnual*factor);
        }else{
          $('scenarioVveNew').value=String(target);
          ['scenarioMaintenanceNew','scenarioOwnerTaxesNew','scenarioInsuranceNew','scenarioGroundLeaseNew'].forEach(id=>{$(id).value='0';});
        }
        ids.forEach(id=>fire($(id)));
      }finally{ownerSync=false;}
      queueRefresh();
    });
  }

  function ensureScenarioWozFields(){
    const definitions=[['buy-rent','scenarioBuyWozNew','Scenario WOZ value'],['downpayment','scenarioDpWozNew','Scenario WOZ value'],['sell-rent','scenarioSellWozNew','Current-home WOZ value']];
    definitions.forEach(([mode,id,label])=>{
      if($(id))return;
      const block=document.querySelector(`.scenario-specific-new[data-scenario="${mode}"] .scenario-specific-grid-new`);if(!block)return;
      const wrap=document.createElement('div');wrap.className='field r65-scenario-woz-field';wrap.dataset.r65Scenario=mode;
      wrap.innerHTML=`<label for="${id}">${label}</label><input id="${id}" type="number" min="0" step="1000" placeholder="Use property value">`;
      block.appendChild(wrap);
    });
  }

  function ensureScenarioAdvanced(){
    if($('r65ScenarioAdvanced'))return;
    const card=$('scenarioMonthlyBudgetNew')?.closest('.card');if(!card)return;
    const details=createDetails('r65ScenarioAdvanced','Advanced scenario assumptions');
    const body=bodyOf(details),grid=document.createElement('div');grid.className='r65-advanced-grid';body.appendChild(grid);
    const ids=['scenarioMortgageMethodNew','scenarioUpfrontCashTreatmentNew','scenarioVveNew','scenarioMaintenanceNew','scenarioOwnerTaxesNew','scenarioInsuranceNew','scenarioGroundLeaseNew'];
    ids.forEach(id=>{const el=field(id);if(el)grid.appendChild(el);});
    document.querySelectorAll('.r65-scenario-woz-field').forEach(el=>grid.appendChild(el));
    card.appendChild(details);
    ['scenarioHomeGrowthNew','scenarioRentGrowthNew','scenarioSellingCostNew'].forEach(id=>field(id)?.classList.add('r65-property-assumption'));
  }

  function ensureScenarioHow(){
    if($('r65ScenarioHow'))return;
    const card=$('scenarioMonthlyBudgetNew')?.closest('.card');if(!card)return;
    const details=createDetails('r65ScenarioHow','How this comparison works','inner-fold r65-local-fold r65-how-fold');
    const body=bodyOf(details);
    move(body,$('scenarioQuestionNoteNew'),$('scenarioCashSourceNoteNew'),document.querySelector('.scenario-principle'));
    const discipline=Array.from(card.querySelectorAll('.callout')).find(el=>/Assumption discipline/i.test(el.textContent||''));if(discipline)body.appendChild(discipline);
    move(body,$('scenarioTaxNoteNew'));
    card.appendChild(details);
  }

  function ensureAuditTools(){
    if($('advancedAuditTools'))return;
    const panel=$('tab-scenarios');if(!panel)return;
    const details=createDetails('advancedAuditTools','Assumption log and CSV export');
    const body=bodyOf(details);
    body.innerHTML='<p class="subsection-copy">Creates a local audit of the current controls and headline results. Nothing is uploaded.</p><div class="r65-audit-actions"><button type="button" class="density-action" id="refreshAssumptionLog">Refresh log</button><button type="button" class="density-action" id="exportAssumptionsCsv">Export CSV</button></div><pre class="r65-assumption-log" id="assumptionLog"></pre>';
    const model=detailsBySummary(/^Model status and sources/i,panel);if(model)model.insertAdjacentElement('beforebegin',details);else panel.appendChild(details);
    $('refreshAssumptionLog').addEventListener('click',renderAssumptionLog);
    $('exportAssumptionsCsv').addEventListener('click',exportAssumptionCsv);
  }

  function currentHillenOverride(){return $('hillenOverrideEnabled')?.checked?Math.max(0,Math.min(1,number($('hillenOverridePct')?.value,71.867)/100)):null;}
  function decorateFinanceForHillen(){
    const FC=window.FinanceCore;if(!FC||wrappedFinance||FC.__viewDensityHillenDecorated)return;
    wrappedFinance=true;
    const originalSchedule=FC.mortgageSchedule.bind(FC),originalPlan=FC.simulatePlan.bind(FC);
    FC.mortgageSchedule=function(config={}){const override=currentHillenOverride();return originalSchedule(override==null?config:{...config,tax:{...(config.tax||{}),hillenRelief:override}});};
    FC.simulatePlan=function(config={}){const override=currentHillenOverride();return originalPlan(override==null?config:{...config,hillenRelief:override});};
    Object.defineProperty(FC,'__viewDensityHillenDecorated',{value:true,enumerable:false});
  }
  function scenarioWozValues(){return{buyRentWoz:optionalNumber($('scenarioBuyWozNew')?.value),downpaymentWoz:optionalNumber($('scenarioDpWozNew')?.value),sellRentWoz:optionalNumber($('scenarioSellWozNew')?.value)};}
  function decorateScenarioForWoz(){
    const SC=window.ScenarioCore;if(!SC||wrappedScenario||SC.__viewDensityWozDecorated)return;
    wrappedScenario=true;const original=SC.runScenario.bind(SC);
    SC.runScenario=function(config={}){return original(applyScenarioWoz(config,scenarioWozValues()));};
    Object.defineProperty(SC,'__viewDensityWozDecorated',{value:true,enumerable:false});
    fire($('scenarioReturnNew'));
  }

  function syncBox3(){
    const mode=$('box3Mode'),checkbox=document.querySelector('[data-r65-role="box3-enabled"]'),summary=document.querySelector('[data-r65-role="box3-mode-summary"]');
    if(!mode||!checkbox)return;
    checkbox.checked=mode.value!=='none';
    if(mode.value!=='none')mode.dataset.r65LastMode=mode.value;
    const labels={none:'Off',current:'2026 current rules',transition:'2026 rules, then proposed regime',future:'Proposed regime'};
    if(summary)summary.textContent=labels[mode.value]||mode.value;
    const warning=$('futureLawWarning');if(warning)warning.classList.toggle('hidden',!['transition','future'].includes(mode.value));
  }
  function syncJan1Gate(){
    const note=document.querySelector('[data-r65-role="jan1-gate"]');if(!note)return;
    const required=number($('startMonth')?.value,1)>1&&($('box3Mode')?.value||'none')!=='none';
    const assumed=Boolean($('assumePlanStartAsJan1')?.checked);
    const complete=['firstJan1Portfolio','firstJan1Savings','firstJan1Debt'].every(id=>$(id)&&String($(id).value).trim()!=='');
    note.classList.toggle('hidden',!required||assumed||complete);
  }
  function syncPurchaseLight(){
    const transfer=$('purchaseTransferTaxMode'),light=document.querySelector('[data-r65-role="transfer-light"]');
    if(transfer&&light){let advanced=light.querySelector('option[value="advanced"]');if(['main','starter'].includes(transfer.value)){advanced?.remove();light.value=transfer.value;}else{if(!advanced){advanced=document.createElement('option');advanced.value='advanced';light.appendChild(advanced);}advanced.textContent=`Detailed setting · ${transfer.selectedOptions?.[0]?.textContent||transfer.value}`;light.value='advanced';}}
    const nhg=$('purchaseNhgMode'),nhgLight=document.querySelector('[data-r65-role="nhg-light"]');
    if(nhg&&nhgLight){let advanced=nhgLight.querySelector('option[value="advanced"]');if(['none','standard'].includes(nhg.value)){advanced?.remove();nhgLight.value=nhg.value;}else{if(!advanced){advanced=document.createElement('option');advanced.value='advanced';nhgLight.appendChild(advanced);}advanced.textContent=`Detailed setting · ${nhg.selectedOptions?.[0]?.textContent||nhg.value}`;nhgLight.value='advanced';}}
  }
  function syncHillenControls(){const enabled=Boolean($('hillenOverrideEnabled')?.checked);if($('hillenOverridePct'))$('hillenOverridePct').disabled=!enabled;}
  function syncScenarioReturn(trigger=false){
    const global=$('annualReturn'),scenario=$('scenarioReturnNew'),override=$('scenarioReturnOverrideEnabled'),wrap=scenario?.closest('.field'),label=document.querySelector('[data-r65-role="scenario-return-label"]');
    if(!global||!scenario||!override)return;
    const value=resolveScenarioReturn(global.value,scenario.value,override.checked);
    if(!override.checked&&!near(scenario.value,value,.000001)){scenario.value=String(value);if(trigger)fire(scenario);}
    wrap?.classList.toggle('hidden',!override.checked);
    if(label)label.textContent=override.checked?`${percent(value)} custom for this comparison`:`${percent(value)} from Investment`;
  }
  function syncOwnerLight(){
    if(ownerSync)return;const input=document.querySelector('[data-r65-role="owner-total"]');if(!input||document.activeElement===input)return;
    input.value=String(Math.round(monthlyOwnerCost({vveMonthly:number($('scenarioVveNew')?.value),maintenanceAnnual:number($('scenarioMaintenanceNew')?.value),ownerTaxesAnnual:number($('scenarioOwnerTaxesNew')?.value),insuranceAnnual:number($('scenarioInsuranceNew')?.value),groundLeaseAnnual:number($('scenarioGroundLeaseNew')?.value)})*100)/100);
  }
  function syncScenarioVisibility(){
    const mode=$('comparisonType')?.value||'buy-rent';
    const property=['buy-rent','downpayment','sell-rent'].includes(mode),rent=['buy-rent','sell-rent'].includes(mode);
    setHidden(field('scenarioHomeGrowthNew'),!property);setHidden(field('scenarioRentGrowthNew'),!rent);setHidden(field('scenarioSellingCostNew'),!property);
    document.querySelectorAll('.r65-scenario-woz-field').forEach(el=>setHidden(el,el.dataset.r65Scenario!==mode));
  }
  function compactBudgetStatus(){
    const el=$('scenarioBudgetStatusNew');if(!el)return;
    if(el.classList.contains('warn')){el.classList.remove('r65-compact-ok');return;}
    el.classList.add('r65-compact-ok');el.innerHTML='<span class="r65-status-ok">Within entered monthly budget</span>';
  }

  function mortgageTermMonths(){const purchase=$('mortgageMode')?.value==='purchase';const years=purchase?number($('purchaseYears')?.value,30):number($('mortYears')?.value,25);return Math.max(0,Math.round(Math.min(years,30)*12));}
  function activeScenarioWoz(){const mode=$('comparisonType')?.value;if(mode==='buy-rent')return optionalNumber($('scenarioBuyWozNew')?.value);if(mode==='downpayment')return optionalNumber($('scenarioDpWozNew')?.value);if(mode==='sell-rent')return optionalNumber($('scenarioSellWozNew')?.value);return null;}
  function domState(){
    const firstValues=[$('firstJan1Portfolio')?.value,$('firstJan1Savings')?.value,$('firstJan1Debt')?.value];
    return{
      bonusMonth:number($('bonusMonth')?.value,12),box3Mode:$('box3Mode')?.value||'current',box3PaySource:$('box3PaySource')?.value||'savings',box3Debt:number($('box3Debt')?.value),box3DebtInterest:number($('box3DebtInterest')?.value,4),box3DebtMonthlyRepayment:number($('box3DebtMonthlyRepayment')?.value),box3DebtRepaymentSource:$('box3DebtRepaymentSource')?.value||'external',box3DebtFallbackDestination:$('box3DebtFallbackDestination')?.value||'invest',
      currentTaxRate:number($('currentTaxRate')?.value,36),currentAllowance:number($('currentAllowance')?.value,59357),currentNotional:number($('currentNotional')?.value,6),currentSavingsNotional:number($('currentSavingsNotional')?.value,1.28),currentDebtNotional:number($('currentDebtNotional')?.value,2.70),currentDebtThreshold:number($('currentDebtThreshold')?.value,3800),futureStart:number($('futureStart')?.value,2028),futureTaxRate:number($('futureTaxRate')?.value,36),futureExempt:number($('futureExempt')?.value,1800),futureLossThreshold:number($('futureLossThreshold')?.value,500),jan1Assumption:Boolean($('assumePlanStartAsJan1')?.checked),jan1SnapshotEntered:firstValues.some(value=>value!==undefined&&value!==''),
      deductionMode:$('deductionMode')?.value||'auto',hraRemainingMonths:Math.max(0,Math.round(number($('hraRemainingYears')?.value,30)*12+number($('hraRemainingMonths')?.value))),defaultHraMonths:mortgageTermMonths(),qualifyingShare:number($('qualifyingBox1DebtPct')?.value,100),hillenOverrideEnabled:Boolean($('hillenOverrideEnabled')?.checked),hillenOverridePct:number($('hillenOverridePct')?.value,71.867),unusedMortgageDestination:$('unusedMortgageDestination')?.value||'invest',mortgageReportHorizon:$('mortgageReportHorizon')?.value||'investment',transferTaxMode:$('purchaseTransferTaxMode')?.value||'main',appraisedValue:number($('purchaseAppraisedValue')?.value),housePrice:number($('housePrice')?.value),nhgMode:$('purchaseNhgMode')?.value||'none',
      upfrontCashTreatment:$('scenarioUpfrontCashTreatmentNew')?.value||'invest',scenarioMortgageMethod:$('scenarioMortgageMethodNew')?.value||'selected',scenarioWoz:activeScenarioWoz(),scenarioReturnOverrideEnabled:Boolean($('scenarioReturnOverrideEnabled')?.checked),sensitivityLow:number($('sensitivityLowNew')?.value,2),sensitivityHigh:number($('sensitivityHighNew')?.value,10),sensitivityStep:number($('sensitivityStepNew')?.value,2),vveMonthly:number($('scenarioVveNew')?.value,250),maintenanceAnnual:number($('scenarioMaintenanceNew')?.value,1500),ownerTaxesAnnual:number($('scenarioOwnerTaxesNew')?.value),insuranceAnnual:number($('scenarioInsuranceNew')?.value),groundLeaseAnnual:number($('scenarioGroundLeaseNew')?.value),ownerCostGrowthPct:number($('scenarioOwnerCostGrowthNew')?.value,2)
    };
  }
  function setBadge(details,count){
    if(!details)return;const badge=details.querySelector('[data-r65-fold-badge]');if(badge)badge.textContent=count?`${count} customized`:'';
  }
  function updateBadges(){
    const items=collectAdvancedState(domState());
    setBadge($('r65PlanTiming'),items.filter(x=>x.group==='plan').length);
    setBadge($('r65Box3Advanced'),items.filter(x=>x.group==='box3').length);
    setBadge($('r65MortgageAdvanced'),items.filter(x=>x.group==='mortgage').length);
    setBadge($('r65ScenarioAdvanced'),items.filter(x=>x.group==='scenario').length);
  }

  function labelForControl(el){
    if(el.id){const label=document.querySelector(`label[for="${CSS.escape(el.id)}"]`);if(label)return String(label.childNodes[0]?.textContent||label.textContent||el.id).trim();}
    if(el.dataset?.field){const phase=Number(el.dataset.i)+1;const map={years:'Duration, years',monthlyInvest:'Monthly investment',mortgageExtra:'Monthly extra mortgage repayment',annualBonus:'Annual bonus / lump sum',bonusDest:'Bonus allocation',mortgageFreq:'Repayment frequency'};return `Phase ${phase} · ${map[el.dataset.field]||el.dataset.field}`;}
    return el.id||el.name||'Control';
  }
  function assumptionRows(){
    const rows=[],seen=new Set();
    document.querySelectorAll('input,select').forEach(el=>{if(el.type==='hidden'||el.disabled)return;const key=el.id||`${el.dataset?.i||''}:${el.dataset?.field||''}:${el.name||''}`;if(!key||seen.has(key))return;seen.add(key);const value=(el.type==='checkbox'||el.type==='radio')?(el.checked?'Yes':'No'):(el.selectedOptions?.[0]?.textContent||el.value);rows.push({section:el.closest('.panel')?.id?.replace('tab-','')||'Planner',label:labelForControl(el),value});});
    [['Results','Investment portfolio','sPortfolio'],['Results','Savings / cash at end','householdSavingsEnd'],['Results','Mortgage remaining','sMortgage'],['Results','Scenario verdict','scenarioVerdictNew'],['Results','Next € break-even','nextEuroBreakEven']].forEach(([section,label,id])=>{const el=$(id);if(el)rows.push({section,label,value:String(el.textContent||'').trim().replace(/\s+/g,' ')});});
    return rows;
  }
  function renderAssumptionLog(){const log=$('assumptionLog');if(!log)return;const meta=window.MODEL_META||{};const lines=[`Model: ${meta.version||'R6.5'} · rule year ${meta.ruleYear||2026}`,`Generated: ${new Date().toISOString()}`,''];assumptionRows().forEach(row=>lines.push(`[${row.section}] ${row.label}: ${row.value}`));log.textContent=lines.join('\n');}
  function exportAssumptionCsv(){const meta=window.MODEL_META||{};const rows=[{section:'Model',label:'Version',value:meta.version||'R6.5'},{section:'Model',label:'Rule year',value:meta.ruleYear||2026},{section:'Model',label:'Generated',value:new Date().toISOString()},...assumptionRows()];const blob=new Blob(['\uFEFF'+assumptionsToCsv(rows)],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`dutch-investment-mortgage-plan-${meta.version||'R6.5'}-${new Date().toISOString().slice(0,10)}.csv`;document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);}
  function setModelMarker(){const meta=window.MODEL_META,marker=$('modelVersion');if(meta&&marker)marker.textContent=`Calculation build ${meta.version} · ${meta.ruleYear} rules · updated 2 Sep 2026`;}

  function refresh(){
    compactSaveBar();syncBox3();syncJan1Gate();syncPurchaseLight();syncHillenControls();syncScenarioReturn();syncOwnerLight();syncScenarioVisibility();compactBudgetStatus();updateBadges();setModelMarker();
    document.querySelectorAll('#phaseCount option,#comparisonType option').forEach(option=>{option.hidden=false;option.classList.remove('density-option-hidden');});
    document.querySelectorAll('#phaseList .density-advanced-phase').forEach(card=>card.classList.remove('density-advanced-phase'));
  }
  function queueRefresh(){if(refreshQueued)return;refreshQueued=true;requestAnimationFrame(()=>{refreshQueued=false;refresh();});}

  injectStyle();compactSaveBar();simplifyStaticCopy();ensurePlanTiming();ensureBox3Simple();ensureBox3Advanced();ensureJan1Gate();ensurePurchaseLight();ensureHillenAdvanced();ensureMortgageAdvanced();ensureScenarioReturn();ensureOwnerLight();ensureScenarioWozFields();ensureScenarioAdvanced();ensureScenarioHow();ensureAuditTools();decorateFinanceForHillen();decorateScenarioForWoz();
  document.addEventListener('input',queueRefresh);
  document.addEventListener('change',queueRefresh);
  window.addEventListener('load',refresh,{once:true});
  refresh();
}

return{DEFAULT_VIEW,STANDARD_PHASE_LIMIT,ADVANCED_SCENARIOS,DEFAULTS,normalizeView,number,optionalNumber,monthlyOwnerCost,resolveScenarioReturn,escapeCsv,assumptionsToCsv,applyScenarioWoz,collectAdvancedState,bootBrowser};
});

if(typeof window!=='undefined'&&window.document)window.ViewDensity.bootBrowser();
