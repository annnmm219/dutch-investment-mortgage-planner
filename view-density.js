(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.ViewDensity=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';

const DEFAULT_VIEW='standard';
const STANDARD_PHASE_LIMIT=3;
const ADVANCED_SCENARIOS=new Set(['downpayment','sell-rent']);
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];

const DEFAULTS=Object.freeze({
  bonusMonth:12,
  box3Mode:'current',
  box3PaySource:'savings',
  box3Debt:0,
  box3DebtInterest:2.70,
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
  groundLeaseAnnual:0
});

function normalizeView(value){return value==='advanced'?'advanced':'standard';}
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
  const mode=next.mode;
  if(mode==='buy-rent'&&values.buyRentWoz!=null){
    next.buyRent={...(next.buyRent||{}),wozValue:Math.max(0,number(values.buyRentWoz))};
  }else if(mode==='downpayment'&&values.downpaymentWoz!=null){
    next.downpayment={...(next.downpayment||{}),wozValue:Math.max(0,number(values.downpaymentWoz))};
  }else if(mode==='sell-rent'&&values.sellRentWoz!=null){
    next.sellRent={...(next.sellRent||{}),wozValue:Math.max(0,number(values.sellRentWoz))};
  }
  return next;
}

function collectAdvancedState(values={}){
  const items=[];
  const add=(key,label)=>items.push({key,label});
  const phaseCount=Math.max(1,Math.round(number(values.phaseCount,3)));
  if(phaseCount>STANDARD_PHASE_LIMIT)add('phase-count',`${phaseCount} phases active`);
  if(Math.round(number(values.bonusMonth,DEFAULTS.bonusMonth))!==DEFAULTS.bonusMonth){
    const month=MONTHS[Math.max(0,Math.min(11,Math.round(number(values.bonusMonth))-1))]||String(values.bonusMonth);
    add('bonus-month',`Annual bonus month: ${month}`);
  }
  if(values.box3Mode==='transition')add('box3-mode','Box 3 transition scenario active');
  if(values.box3Mode==='future')add('box3-mode','Proposed Box 3 regime active');
  if(values.box3PaySource&&values.box3PaySource!==DEFAULTS.box3PaySource)add('box3-source',`Box 3 paid from ${values.box3PaySource}`);
  if(number(values.box3Debt)>0)add('box3-debt',`Other Box 3 debt: ${money(values.box3Debt)}`);
  if(number(values.box3DebtMonthlyRepayment)>0)add('box3-debt-payment',`Box 3 debt repayment: ${money(values.box3DebtMonthlyRepayment)}/mo`);
  if(number(values.box3Debt)>0&&!near(values.box3DebtInterest,DEFAULTS.box3DebtInterest))add('box3-debt-interest',`Box 3 debt interest: ${percent(values.box3DebtInterest)}`);
  if(number(values.box3Debt)>0&&values.box3DebtRepaymentSource&&values.box3DebtRepaymentSource!==DEFAULTS.box3DebtRepaymentSource)add('box3-debt-source','Box 3 debt repayment uses savings');
  if(values.box3DebtFallbackDestination&&values.box3DebtFallbackDestination!==DEFAULTS.box3DebtFallbackDestination)add('box3-debt-fallback',`After Box 3 debt payoff: ${values.box3DebtFallbackDestination}`);
  const customBox3=!near(values.currentTaxRate,DEFAULTS.currentTaxRate)||!near(values.currentAllowance,DEFAULTS.currentAllowance)||
    !near(values.currentNotional,DEFAULTS.currentNotional)||!near(values.currentSavingsNotional,DEFAULTS.currentSavingsNotional)||
    !near(values.currentDebtNotional,DEFAULTS.currentDebtNotional)||!near(values.currentDebtThreshold,DEFAULTS.currentDebtThreshold);
  if(customBox3)add('box3-parameters','Custom Box 3 parameters');
  const customFuture=!near(values.futureStart,DEFAULTS.futureStart)||!near(values.futureTaxRate,DEFAULTS.futureTaxRate)||
    !near(values.futureExempt,DEFAULTS.futureExempt)||!near(values.futureLossThreshold,DEFAULTS.futureLossThreshold);
  if(customFuture)add('future-box3','Custom proposed-regime parameters');
  if(values.jan1Assumption)add('jan1','Plan-start balances used as 1 January assumption');
  else if(values.jan1SnapshotEntered)add('jan1','Custom 1 January snapshot entered');
  if(values.deductionMode&&values.deductionMode!==DEFAULTS.deductionMode)add('deduction-mode','Manual mortgage deduction rate');
  if(Number.isFinite(number(values.hraRemainingMonths,NaN))&&Number.isFinite(number(values.defaultHraMonths,NaN))&&!near(values.hraRemainingMonths,values.defaultHraMonths,.5)){
    const months=Math.max(0,Math.round(number(values.hraRemainingMonths)));
    add('hra-remaining',`HRA remaining: ${Math.floor(months/12)}y ${months%12}m`);
  }
  if(!near(values.qualifyingShare,DEFAULTS.qualifyingShare))add('qualifying-share',`HRA-qualifying loan share: ${percent(values.qualifyingShare)}`);
  if(values.hillenOverrideEnabled)add('hillen-override',`Hillen override: ${percent(values.hillenOverridePct)}`);
  if(values.unusedMortgageDestination&&values.unusedMortgageDestination!==DEFAULTS.unusedMortgageDestination)add('unused-mortgage',`After-payoff cash: ${values.unusedMortgageDestination}`);
  if(values.mortgageReportHorizon&&values.mortgageReportHorizon!==DEFAULTS.mortgageReportHorizon)add('mortgage-horizon',`Mortgage report horizon: ${values.mortgageReportHorizon}`);
  if(values.transferTaxMode&&!['main','starter'].includes(values.transferTaxMode))add('transfer-tax',`Advanced transfer-tax mode: ${values.transferTaxMode}`);
  if(number(values.appraisedValue)>0&&number(values.housePrice)>0&&!near(values.appraisedValue,values.housePrice,1))add('appraisal','Appraised value differs from price');
  if(values.nhgMode==='energy')add('nhg','Energy-enhanced NHG path active');
  if(values.upfrontCashTreatment&&values.upfrontCashTreatment!==DEFAULTS.upfrontCashTreatment)add('upfront-cash','Unused purchase cash kept in savings');
  if(values.scenarioMortgageMethod&&values.scenarioMortgageMethod!==DEFAULTS.scenarioMortgageMethod)add('scenario-mortgage-method',`Scenario mortgage method: ${values.scenarioMortgageMethod}`);
  if(ADVANCED_SCENARIOS.has(values.scenarioMode))add('scenario',`Advanced decision active: ${values.scenarioMode}`);
  if(values.scenarioWoz!=null)add('scenario-woz',`Scenario WOZ: ${money(values.scenarioWoz)}`);
  const customSensitivity=!near(values.sensitivityLow,DEFAULTS.sensitivityLow)||!near(values.sensitivityHigh,DEFAULTS.sensitivityHigh)||!near(values.sensitivityStep,DEFAULTS.sensitivityStep);
  if(customSensitivity)add('sensitivity','Custom return sensitivity range');
  const ownerTotal=monthlyOwnerCost(values);
  const customOwnerSplit=!near(values.vveMonthly,DEFAULTS.vveMonthly)||!near(values.maintenanceAnnual,DEFAULTS.maintenanceAnnual)||
    !near(values.ownerTaxesAnnual,DEFAULTS.ownerTaxesAnnual)||!near(values.insuranceAnnual,DEFAULTS.insuranceAnnual)||!near(values.groundLeaseAnnual,DEFAULTS.groundLeaseAnnual);
  if(customOwnerSplit)add('owner-costs',`Customized owner-cost split: ${money(ownerTotal)}/mo`);
  return items;
}

function bootBrowser(){
  if(typeof window==='undefined'||typeof document==='undefined')return;
  const $=id=>document.getElementById(id);
  let activeView=DEFAULT_VIEW;
  let ownerSync=false;
  let refreshQueued=false;
  let wrappedScenario=false;
  let wrappedFinance=false;

  function fire(el){
    if(!el)return;
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function field(id){return $(id)?.closest('.field')||null;}
  function detailsBySummary(pattern,root=document){
    return Array.from(root.querySelectorAll('details')).find(el=>pattern.test(String(el.querySelector(':scope > summary')?.textContent||'')))||null;
  }
  function markAdvanced(el){if(el)el.classList.add('density-advanced-only');}
  function parseStoredView(){
    const key=window.PlannerState?.STORAGE_KEY||'dutch-investment-mortgage-planner:r6';
    try{
      const payload=JSON.parse(localStorage.getItem(key)||'null');
      const controls=payload?.controls||{};
      if(controls['id:viewAdvanced']?.value===true)return'advanced';
      if(controls['id:viewStandard']?.value===true)return'standard';
    }catch(_error){}
    return DEFAULT_VIEW;
  }

  function injectStyle(){
    if($('viewDensityStyle'))return;
    const style=document.createElement('style');
    style.id='viewDensityStyle';
    style.textContent=`
      .view-density-bar{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-top:14px;padding:10px 12px;background:var(--surface);border:.5px solid var(--border);border-radius:var(--radius)}
      .view-density-title{font-size:12px;font-weight:600;color:var(--secondary)}
      .view-density-segment{display:inline-flex;padding:3px;background:var(--alt);border:.5px solid var(--border);border-radius:999px}
      .view-density-choice{position:relative;cursor:pointer}
      .view-density-choice input{position:absolute;opacity:0;pointer-events:none}
      .view-density-choice span{display:block;padding:6px 13px;border-radius:999px;font-size:12px;color:var(--secondary)}
      .view-density-choice input:checked+span{background:var(--surface);color:var(--text);font-weight:600;box-shadow:0 1px 3px rgba(0,0,0,.08)}
      .view-density-choice input:focus-visible+span{outline:2px solid var(--accent);outline-offset:1px}
      .density-standard-summary{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;background:var(--amberbg);color:var(--amber);border-radius:var(--radius);padding:12px 14px;margin:0 0 14px}
      .density-standard-summary strong{color:var(--text);font-size:12px}
      .density-chip-list{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px}
      .density-chip{display:inline-flex;align-items:center;padding:5px 8px;border-radius:999px;background:var(--surface);border:.5px solid var(--border);font-size:11px;color:var(--secondary)}
      .density-open-advanced,.density-action{border:.5px solid var(--border2);border-radius:var(--small);background:var(--surface);color:var(--text);font:inherit;font-size:11px;padding:7px 10px;cursor:pointer;white-space:nowrap}
      .density-light-row{margin:12px 0 4px;padding:12px 14px;background:var(--alt);border-radius:var(--small)}
      .density-light-row .field{margin-bottom:0}
      .density-light-toggle{display:flex;align-items:center;gap:9px;font-size:13px;color:var(--text)}
      .density-light-toggle input{width:17px;height:17px;accent-color:var(--accent)}
      .density-owner-total{margin-bottom:12px}
      .density-standard-note{margin-top:10px}
      .density-audit-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
      .density-assumption-log{max-height:360px;overflow:auto;white-space:pre-wrap;background:var(--alt);border-radius:var(--small);padding:12px;font-size:11px;color:var(--secondary)}
      html[data-view-density="standard"] .density-advanced-only,
      html[data-view-density="standard"] .density-advanced-phase{display:none!important}
      html[data-view-density="advanced"] .density-standard-only{display:none!important}
      html[data-view-density="standard"] option.density-option-hidden{display:none}
      html[data-view-density="standard"] .density-standard-result-open>summary{display:none}
      html[data-view-density="standard"] .density-standard-result-open>.fold-body{padding-top:18px}
      @media(max-width:620px){.view-density-bar{align-items:flex-start}.view-density-segment{width:100%}.view-density-choice{flex:1;text-align:center}.density-standard-summary{display:block}.density-open-advanced{margin-top:10px}}
    `;
    document.head.appendChild(style);
  }

  function ensureSwitch(){
    if($('viewDensityBar'))return;
    const header=document.querySelector('header');
    if(!header)return;
    const bar=document.createElement('div');
    bar.id='viewDensityBar';
    bar.className='view-density-bar';
    bar.innerHTML=`<span class="view-density-title">View:</span><div class="view-density-segment" role="radiogroup" aria-label="Planner detail level"><label class="view-density-choice"><input id="viewStandard" type="radio" name="viewDensity" value="standard" checked><span>Standard</span></label><label class="view-density-choice"><input id="viewAdvanced" type="radio" name="viewDensity" value="advanced"><span>Advanced</span></label></div>`;
    header.appendChild(bar);
    activeView=parseStoredView();
    $('viewStandard').checked=activeView==='standard';
    $('viewAdvanced').checked=activeView==='advanced';
    bar.addEventListener('change',event=>{
      if(!event.target.matches('input[name="viewDensity"]'))return;
      activeView=normalizeView(event.target.value);
      applyView();
    });
  }

  function ensureSummary(){
    if($('advancedStateSummary'))return;
    const anchor=$('plannerStorageBar')||document.querySelector('header');
    if(!anchor)return;
    const summary=document.createElement('div');
    summary.id='advancedStateSummary';
    summary.className='density-standard-summary density-standard-only hidden';
    summary.innerHTML='<div><strong>Advanced settings are affecting this plan.</strong><div class="density-chip-list" data-density-chips></div></div><button type="button" class="density-open-advanced" data-density-open-advanced>Open Advanced</button>';
    anchor.insertAdjacentElement('afterend',summary);
    summary.querySelector('[data-density-open-advanced]')?.addEventListener('click',openAdvanced);
  }

  function ensureBox3Light(){
    const mode=$('box3Mode');
    const card=mode?.closest('.card');
    if(!mode||!card||card.querySelector('[data-density-role="box3-enabled"]'))return;
    const row=document.createElement('div');
    row.className='density-light-row density-standard-only';
    row.innerHTML='<label class="density-light-toggle"><input type="checkbox" data-density-role="box3-enabled"><span>Include Box 3 using 2026 current rules</span></label><p class="inline" data-density-role="box3-light-help">Advanced contains payment source, statutory parameters and the proposed regime.</p>';
    const grid=mode.closest('.grid3');
    grid?.insertAdjacentElement('beforebegin',row);
    const control=row.querySelector('[data-density-role="box3-enabled"]');
    control.addEventListener('change',()=>{
      if(control.checked){if(mode.value==='none')mode.value='current';}
      else mode.value='none';
      fire(mode);
      queueRefresh();
    });
  }

  function ensureJan1StandardGate(){
    const card=$('box3Mode')?.closest('.card');
    if(!card||card.querySelector('[data-density-role="jan1-standard-gate"]'))return;
    const note=document.createElement('div');
    note.className='callout warn density-standard-only hidden';
    note.dataset.densityRole='jan1-standard-gate';
    note.innerHTML='<strong>1 January Box 3 values are required.</strong><br><span>A plan beginning after January needs the historical investment, savings and Box 3 debt snapshot. Blank does not mean zero.</span><br><button type="button" class="density-open-advanced" data-density-open-advanced>Open Advanced to enter the snapshot</button>';
    card.appendChild(note);
    note.querySelector('[data-density-open-advanced]')?.addEventListener('click',openAdvanced);
  }

  function ensurePurchaseLight(){
    const host=$('purchaseMortgageFields');
    if(!host||host.querySelector('[data-density-block="purchase-light"]'))return;
    const block=document.createElement('div');
    block.dataset.densityBlock='purchase-light';
    block.className='grid2 density-light-row density-standard-only';
    block.innerHTML=`<div class="field"><label>Transfer tax<select data-density-role="transfer-light"><option value="main">Normal main residence · 2%</option><option value="starter">Starter exemption · if eligible</option></select></label><p class="inline">Advanced contains other-home, other-real-estate and manual treatments.</p></div><div class="field"><label>NHG<select data-density-role="nhg-light"><option value="none">No NHG</option><option value="standard">Yes · standard NHG</option></select></label><p class="inline">Advanced contains the energy-enhanced path and valuation detail.</p></div>`;
    const summary=host.querySelector('.summary');
    summary?.insertAdjacentElement('beforebegin',block);
    block.querySelector('[data-density-role="transfer-light"]')?.addEventListener('change',event=>{
      if(!['main','starter'].includes(event.target.value))return;
      const underlying=$('purchaseTransferTaxMode');
      if(underlying){underlying.value=event.target.value;fire(underlying);}
    });
    block.querySelector('[data-density-role="nhg-light"]')?.addEventListener('change',event=>{
      if(!['none','standard'].includes(event.target.value))return;
      const underlying=$('purchaseNhgMode');
      if(underlying){underlying.value=event.target.value;fire(underlying);}
    });
  }

  function ensureOwnerLight(){
    const advanced=field('scenarioVveNew');
    const grid=advanced?.parentElement;
    if(!grid||grid.querySelector('[data-density-role="owner-total"]'))return;
    const wrap=document.createElement('div');
    wrap.className='field density-standard-only density-owner-total';
    wrap.innerHTML='<label>Extra owner costs per month<input type="text" inputmode="decimal" data-density-role="owner-total"></label><p class="inline">One combined monthly amount. Advanced shows the VvE, maintenance, OZB, insurance and erfpacht split.</p>';
    grid.insertBefore(wrap,advanced);
    const input=wrap.querySelector('[data-density-role="owner-total"]');
    input.addEventListener('input',()=>{
      if(ownerSync)return;
      const target=Math.max(0,number(input.value,NaN));
      if(!Number.isFinite(target))return;
      ownerSync=true;
      try{
        const ids=['scenarioVveNew','scenarioMaintenanceNew','scenarioOwnerTaxesNew','scenarioInsuranceNew','scenarioGroundLeaseNew'];
        const current={
          vveMonthly:number($('scenarioVveNew')?.value),
          maintenanceAnnual:number($('scenarioMaintenanceNew')?.value),
          ownerTaxesAnnual:number($('scenarioOwnerTaxesNew')?.value),
          insuranceAnnual:number($('scenarioInsuranceNew')?.value),
          groundLeaseAnnual:number($('scenarioGroundLeaseNew')?.value)
        };
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

  function ensureHillenAdvanced(){
    const details=$('hraEligibilityDetails');
    const body=details?.querySelector('.inner-fold-body');
    if(!body||$('hillenOverrideEnabled'))return;
    const block=document.createElement('div');
    block.className='density-advanced-only';
    block.innerHTML=`<div class="grid2 advanced-grid"><div class="toggle"><input id="hillenOverrideEnabled" type="checkbox"><label for="hillenOverrideEnabled">Override the year-specific Hillen path</label></div><div class="field"><label for="hillenOverridePct">Hillen relief %</label><input id="hillenOverridePct" type="number" min="0" max="100" step="0.001" value="71.867" disabled><p class="inline">When off, the model uses its year table. This override applies the entered percentage to every modeled year.</p></div></div><div class="callout"><strong>Interest-only boundary:</strong> the planner models annuity and linear repayment only. Entering a long term does not create an interest-only mortgage or establish its tax eligibility.</div>`;
    body.appendChild(block);
    $('hillenOverrideEnabled').addEventListener('change',()=>{syncHillenControls();fire($('wozValue'));});
    $('hillenOverridePct').addEventListener('input',()=>fire($('wozValue')));
  }

  function ensureScenarioWozFields(){
    const definitions=[
      ['buy-rent','scenarioBuyWozNew','Scenario WOZ value','Leave blank to use the scenario house price.'],
      ['downpayment','scenarioDpWozNew','Scenario WOZ value','Leave blank to use the scenario house price.'],
      ['sell-rent','scenarioSellWozNew','Current-home WOZ value','Leave blank to use the current home value or Mortgage-tab WOZ.']
    ];
    definitions.forEach(([mode,id,label,help])=>{
      if($(id))return;
      const block=document.querySelector(`.scenario-specific-new[data-scenario="${mode}"] .scenario-specific-grid-new`);
      if(!block)return;
      const wrap=document.createElement('div');
      wrap.className='field density-advanced-only';
      wrap.innerHTML=`<label for="${id}">${label}</label><input id="${id}" type="number" min="0" step="1000" placeholder="Use property value"><p class="inline">${help}</p>`;
      block.appendChild(wrap);
    });
  }

  function ensureAuditTools(){
    if($('advancedAuditTools'))return;
    const panel=$('tab-scenarios');
    if(!panel)return;
    const details=document.createElement('details');
    details.id='advancedAuditTools';
    details.className='fold density-advanced-only';
    details.innerHTML=`<summary>Assumption log and CSV export</summary><div class="fold-body"><p class="subsection-copy">Creates a local audit of the current controls and headline results. Nothing is uploaded.</p><div class="density-audit-actions"><button type="button" class="density-action" id="refreshAssumptionLog">Refresh log</button><button type="button" class="density-action" id="exportAssumptionsCsv">Export CSV</button></div><pre class="density-assumption-log" id="assumptionLog"></pre></div>`;
    const model=detailsBySummary(/^Model status and sources/i,panel);
    if(model)model.insertAdjacentElement('beforebegin',details);else panel.appendChild(details);
    $('refreshAssumptionLog').addEventListener('click',renderAssumptionLog);
    $('exportAssumptionsCsv').addEventListener('click',exportAssumptionCsv);
  }

  function ensureStandardNotes(){
    const box3Card=$('box3Mode')?.closest('.card');
    if(box3Card&&!box3Card.querySelector('[data-density-note="box3"]')){
      const note=document.createElement('div');
      note.className='callout density-standard-only density-standard-note';
      note.dataset.densityNote='box3';
      note.innerHTML='<strong>Calendar-year note:</strong> the last Box 3 year remains unsettled when the plan does not run through December. Open Advanced for the year-by-year method detail.';
      box3Card.appendChild(note);
    }
    const taxCard=$('wozValue')?.closest('.card');
    if(taxCard&&!taxCard.querySelector('[data-density-note="ewf"]')){
      const note=document.createElement('div');
      note.className='callout density-standard-only density-standard-note';
      note.dataset.densityNote='ewf';
      note.innerHTML='<strong>EWF after payoff:</strong> eigenwoningforfait continues while you still own and live in the home, even after the mortgage balance reaches zero.';
      taxCard.appendChild(note);
    }
    const builder=$('comparisonType')?.closest('.card');
    if(builder&&!builder.querySelector('[data-density-note="purchase-cash"]')){
      const note=document.createElement('div');
      note.className='callout density-standard-only density-standard-note';
      note.dataset.densityNote='purchase-cash';
      note.innerHTML='<strong>Cash at closing:</strong> a Buy or Down Payment comparison is unavailable until starting savings cover the down payment and purchase costs.';
      builder.appendChild(note);
    }
  }

  function currentHillenOverride(){
    return $('hillenOverrideEnabled')?.checked?Math.max(0,Math.min(1,number($('hillenOverridePct')?.value,71.867)/100)):null;
  }
  function decorateFinanceForHillen(){
    const FC=window.FinanceCore;
    if(!FC||wrappedFinance||FC.__viewDensityHillenDecorated)return;
    wrappedFinance=true;
    const originalSchedule=FC.mortgageSchedule.bind(FC);
    const originalPlan=FC.simulatePlan.bind(FC);
    FC.mortgageSchedule=function(config={}){
      const override=currentHillenOverride();
      if(override==null)return originalSchedule(config);
      return originalSchedule({...config,tax:{...(config.tax||{}),hillenRelief:override}});
    };
    FC.simulatePlan=function(config={}){
      const override=currentHillenOverride();
      return originalPlan(override==null?config:{...config,hillenRelief:override});
    };
    Object.defineProperty(FC,'__viewDensityHillenDecorated',{value:true,enumerable:false});
  }
  function scenarioWozValues(){
    return{
      buyRentWoz:optionalNumber($('scenarioBuyWozNew')?.value),
      downpaymentWoz:optionalNumber($('scenarioDpWozNew')?.value),
      sellRentWoz:optionalNumber($('scenarioSellWozNew')?.value)
    };
  }
  function decorateScenarioForWoz(){
    const SC=window.ScenarioCore;
    if(!SC||wrappedScenario||SC.__viewDensityWozDecorated)return;
    wrappedScenario=true;
    const original=SC.runScenario.bind(SC);
    SC.runScenario=function(config={}){return original(applyScenarioWoz(config,scenarioWozValues()));};
    Object.defineProperty(SC,'__viewDensityWozDecorated',{value:true,enumerable:false});
    fire($('scenarioReturnNew'));
  }

  function classify(){
    markAdvanced(field('bonusMonth'));
    markAdvanced(field('box3Mode'));
    markAdvanced(field('box3PaySource'));
    ['box3Debt','box3DebtInterest','box3DebtMonthlyRepayment','box3DebtRepaymentSource','box3DebtFallbackDestination'].forEach(id=>markAdvanced(field(id)));
    markAdvanced(detailsBySummary(/^Optional: other Box 3 debt/i));
    markAdvanced(detailsBySummary(/^More balance-sheet results/i));
    markAdvanced(detailsBySummary(/^Box 3 assumptions and advanced settings/i));
    markAdvanced(detailsBySummary(/^Year-by-year Box 3 breakdown/i));
    const household=$('box3HouseholdContext');
    household?.querySelectorAll(':scope > .callout').forEach(markAdvanced);
    markAdvanced(field('deductionMode'));
    markAdvanced(field('manualDeduction'));
    markAdvanced($('hraEligibilityDetails'));
    markAdvanced($('mortgageFallbackControls'));
    markAdvanced($('mortgageHorizonControls'));
    markAdvanced($('purchaseCostDetails'));
    ['scenarioMortgageMethodNew','scenarioUpfrontCashTreatmentNew','scenarioVveNew','scenarioMaintenanceNew','scenarioOwnerTaxesNew','scenarioInsuranceNew','scenarioGroundLeaseNew'].forEach(id=>markAdvanced(field(id)));
    markAdvanced(detailsBySummary(/^Return sensitivity and crossover/i,$('decisionEngine')||document));
    markAdvanced(detailsBySummary(/^Model status and sources/i));
    markAdvanced($('advancedAuditTools'));
    const finalResults=detailsBySummary(/^(Final main-plan results|Final results summary)/i);
    if(finalResults)finalResults.classList.add('density-standard-result-open');
  }

  function syncBox3Light(){
    const mode=$('box3Mode');
    const control=document.querySelector('[data-density-role="box3-enabled"]');
    const help=document.querySelector('[data-density-role="box3-light-help"]');
    if(!mode||!control)return;
    control.checked=mode.value!=='none';
    if(help)help.textContent=mode.value==='current'||mode.value==='none'
      ?'Advanced contains payment source, statutory parameters and the proposed regime.'
      :'An Advanced Box 3 regime is active. The value remains in use while this control is hidden.';
  }

  function syncJan1StandardGate(){
    const note=document.querySelector('[data-density-role="jan1-standard-gate"]');
    if(!note)return;
    const required=number($('startMonth')?.value,1)>1&&($('box3Mode')?.value||'none')!=='none';
    const assumed=Boolean($('assumePlanStartAsJan1')?.checked);
    const complete=['firstJan1Portfolio','firstJan1Savings','firstJan1Debt'].every(id=>$(id)&&String($(id).value).trim()!=='');
    note.classList.toggle('hidden',!required||assumed||complete);
  }

  function syncPurchaseLight(){
    const transfer=$('purchaseTransferTaxMode');
    const light=document.querySelector('[data-density-role="transfer-light"]');
    if(transfer&&light){
      let advanced=light.querySelector('option[value="advanced"]');
      if(['main','starter'].includes(transfer.value)){
        advanced?.remove();
        light.value=transfer.value;
      }else{
        if(!advanced){advanced=document.createElement('option');advanced.value='advanced';light.appendChild(advanced);}
        advanced.textContent=`Advanced setting · ${transfer.selectedOptions?.[0]?.textContent||transfer.value}`;
        light.value='advanced';
      }
    }
    const nhg=$('purchaseNhgMode');
    const nhgLight=document.querySelector('[data-density-role="nhg-light"]');
    if(nhg&&nhgLight){
      let advanced=nhgLight.querySelector('option[value="advanced"]');
      if(['none','standard'].includes(nhg.value)){
        advanced?.remove();
        nhgLight.value=nhg.value;
      }else{
        if(!advanced){advanced=document.createElement('option');advanced.value='advanced';nhgLight.appendChild(advanced);}
        advanced.textContent=`Advanced setting · ${nhg.selectedOptions?.[0]?.textContent||nhg.value}`;
        nhgLight.value='advanced';
      }
    }
  }

  function syncOwnerLight(){
    if(ownerSync)return;
    const input=document.querySelector('[data-density-role="owner-total"]');
    if(!input||document.activeElement===input)return;
    input.value=String(Math.round(monthlyOwnerCost({
      vveMonthly:number($('scenarioVveNew')?.value),
      maintenanceAnnual:number($('scenarioMaintenanceNew')?.value),
      ownerTaxesAnnual:number($('scenarioOwnerTaxesNew')?.value),
      insuranceAnnual:number($('scenarioInsuranceNew')?.value),
      groundLeaseAnnual:number($('scenarioGroundLeaseNew')?.value)
    })*100)/100);
  }
  function syncHillenControls(){
    const enabled=Boolean($('hillenOverrideEnabled')?.checked);
    if($('hillenOverridePct'))$('hillenOverridePct').disabled=!enabled;
  }

  function updateOptionVisibility(){
    const standard=activeView==='standard';
    const phase=$('phaseCount');
    if(phase){
      Array.from(phase.options).forEach(option=>{
        const advanced=number(option.value)>STANDARD_PHASE_LIMIT;
        const hide=standard&&advanced&&option.value!==phase.value;
        option.hidden=hide;
        option.classList.toggle('density-option-hidden',hide);
      });
    }
    const comparison=$('comparisonType');
    if(comparison){
      Array.from(comparison.options).forEach(option=>{
        const hide=standard&&ADVANCED_SCENARIOS.has(option.value)&&option.value!==comparison.value;
        option.hidden=hide;
        option.classList.toggle('density-option-hidden',hide);
      });
    }
  }

  function updatePhaseCards(){
    Array.from($('phaseList')?.children||[]).forEach((card,index)=>card.classList.toggle('density-advanced-phase',index>=STANDARD_PHASE_LIMIT));
  }

  function mortgageTermMonths(){
    const purchase=$('mortgageMode')?.value==='purchase';
    const years=purchase?number($('purchaseYears')?.value,30):number($('mortYears')?.value,25);
    return Math.max(0,Math.round(Math.min(years,30)*12));
  }
  function activeScenarioWoz(){
    const mode=$('comparisonType')?.value;
    if(mode==='buy-rent')return optionalNumber($('scenarioBuyWozNew')?.value);
    if(mode==='downpayment')return optionalNumber($('scenarioDpWozNew')?.value);
    if(mode==='sell-rent')return optionalNumber($('scenarioSellWozNew')?.value);
    return null;
  }
  function domState(){
    const firstValues=[$('firstJan1Portfolio')?.value,$('firstJan1Savings')?.value,$('firstJan1Debt')?.value];
    return{
      phaseCount:number($('phaseCount')?.value,3),
      bonusMonth:number($('bonusMonth')?.value,12),
      box3Mode:$('box3Mode')?.value||'current',
      box3PaySource:$('box3PaySource')?.value||'savings',
      box3Debt:number($('box3Debt')?.value),
      box3DebtInterest:number($('box3DebtInterest')?.value,2.70),
      box3DebtMonthlyRepayment:number($('box3DebtMonthlyRepayment')?.value),
      box3DebtRepaymentSource:$('box3DebtRepaymentSource')?.value||'external',
      box3DebtFallbackDestination:$('box3DebtFallbackDestination')?.value||'invest',
      currentTaxRate:number($('currentTaxRate')?.value,36),
      currentAllowance:number($('currentAllowance')?.value,59357),
      currentNotional:number($('currentNotional')?.value,6),
      currentSavingsNotional:number($('currentSavingsNotional')?.value,1.28),
      currentDebtNotional:number($('currentDebtNotional')?.value,2.70),
      currentDebtThreshold:number($('currentDebtThreshold')?.value,3800),
      futureStart:number($('futureStart')?.value,2028),
      futureTaxRate:number($('futureTaxRate')?.value,36),
      futureExempt:number($('futureExempt')?.value,1800),
      futureLossThreshold:number($('futureLossThreshold')?.value,500),
      jan1Assumption:Boolean($('assumePlanStartAsJan1')?.checked),
      jan1SnapshotEntered:firstValues.some(value=>value!==undefined&&value!==''),
      deductionMode:$('deductionMode')?.value||'auto',
      hraRemainingMonths:Math.max(0,Math.round(number($('hraRemainingYears')?.value,30)*12+number($('hraRemainingMonths')?.value))),
      defaultHraMonths:mortgageTermMonths(),
      qualifyingShare:number($('qualifyingBox1DebtPct')?.value,100),
      hillenOverrideEnabled:Boolean($('hillenOverrideEnabled')?.checked),
      hillenOverridePct:number($('hillenOverridePct')?.value,71.867),
      unusedMortgageDestination:$('unusedMortgageDestination')?.value||'invest',
      mortgageReportHorizon:$('mortgageReportHorizon')?.value||'investment',
      transferTaxMode:$('purchaseTransferTaxMode')?.value||'main',
      appraisedValue:number($('purchaseAppraisedValue')?.value),
      housePrice:number($('housePrice')?.value),
      nhgMode:$('purchaseNhgMode')?.value||'none',
      upfrontCashTreatment:$('scenarioUpfrontCashTreatmentNew')?.value||'invest',
      scenarioMortgageMethod:$('scenarioMortgageMethodNew')?.value||'selected',
      scenarioMode:$('comparisonType')?.value||'buy-rent',
      scenarioWoz:activeScenarioWoz(),
      sensitivityLow:number($('sensitivityLowNew')?.value,2),
      sensitivityHigh:number($('sensitivityHighNew')?.value,10),
      sensitivityStep:number($('sensitivityStepNew')?.value,2),
      vveMonthly:number($('scenarioVveNew')?.value,250),
      maintenanceAnnual:number($('scenarioMaintenanceNew')?.value,1500),
      ownerTaxesAnnual:number($('scenarioOwnerTaxesNew')?.value),
      insuranceAnnual:number($('scenarioInsuranceNew')?.value),
      groundLeaseAnnual:number($('scenarioGroundLeaseNew')?.value)
    };
  }

  function renderAdvancedSummary(){
    const summary=$('advancedStateSummary');
    if(!summary)return;
    const items=collectAdvancedState(domState());
    summary.classList.toggle('hidden',activeView!=='standard'||items.length===0);
    const chips=summary.querySelector('[data-density-chips]');
    if(chips)chips.innerHTML=items.slice(0,8).map(item=>`<span class="density-chip">${item.label}</span>`).join('')+(items.length>8?`<span class="density-chip">+${items.length-8} more</span>`:'');
  }

  function labelForControl(el){
    if(el.id){
      const label=document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if(label)return String(label.childNodes[0]?.textContent||label.textContent||el.id).trim();
    }
    if(el.dataset?.field){
      const phase=Number(el.dataset.i)+1;
      const map={years:'Duration, years',monthlyInvest:'Monthly investment',mortgageExtra:'Monthly extra mortgage repayment',annualBonus:'Annual bonus / lump sum',bonusDest:'Bonus allocation',mortgageFreq:'Repayment frequency'};
      return `Phase ${phase} · ${map[el.dataset.field]||el.dataset.field}`;
    }
    return el.id||el.name||'Control';
  }
  function assumptionRows(){
    const rows=[];
    const seen=new Set();
    document.querySelectorAll('input,select').forEach(el=>{
      if(el.type==='hidden'||el.disabled)return;
      const key=el.id||`${el.dataset?.i||''}:${el.dataset?.field||''}:${el.name||''}`;
      if(!key||seen.has(key)||el.name==='viewDensity')return;
      seen.add(key);
      const value=(el.type==='checkbox'||el.type==='radio')?(el.checked?'Yes':'No'):(el.selectedOptions?.[0]?.textContent||el.value);
      rows.push({section:el.closest('.panel')?.id?.replace('tab-','')||'Planner',label:labelForControl(el),value});
    });
    const resultIds=[
      ['Results','Investment portfolio after Box 3','sPortfolio'],['Results','Savings / cash at end','householdSavingsEnd'],['Results','Mortgage remaining','sMortgage'],
      ['Results','Scenario verdict','scenarioVerdictNew'],['Results','Next € break-even','nextEuroBreakEven'],['Results','Next € winner','nextEuroWinner'],['Results','Next € difference','nextEuroDifference']
    ];
    resultIds.forEach(([section,label,id])=>{const el=$(id);if(el)rows.push({section,label,value:String(el.textContent||'').trim().replace(/\s+/g,' ')});});
    return rows;
  }
  function renderAssumptionLog(){
    const log=$('assumptionLog');
    if(!log)return;
    const meta=window.MODEL_META||{};
    const lines=[`Model: ${meta.version||'R6.4'} · rule year ${meta.ruleYear||2026}`,`View: ${activeView}`,`Generated: ${new Date().toISOString()}`,''];
    assumptionRows().forEach(row=>lines.push(`[${row.section}] ${row.label}: ${row.value}`));
    log.textContent=lines.join('\n');
  }
  function exportAssumptionCsv(){
    const meta=window.MODEL_META||{};
    const rows=[{section:'Model',label:'Version',value:meta.version||'R6.4'},{section:'Model',label:'Rule year',value:meta.ruleYear||2026},{section:'Model',label:'View',value:activeView},{section:'Model',label:'Generated',value:new Date().toISOString()},...assumptionRows()];
    const blob=new Blob(['\uFEFF'+assumptionsToCsv(rows)],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;
    link.download=`dutch-investment-mortgage-plan-${meta.version||'R6.4'}-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function setModelMarker(){
    const meta=window.MODEL_META;
    const marker=$('modelVersion');
    if(meta&&marker)marker.textContent=`Calculation build ${meta.version} · ${meta.ruleYear} rules · updated 2 Sep 2026`;
  }

  function openAdvanced(){
    const radio=$('viewAdvanced');
    if(!radio)return;
    radio.checked=true;
    activeView='advanced';
    fire(radio);
    applyView();
    $('viewDensityBar')?.scrollIntoView({behavior:'smooth',block:'center'});
  }

  function applyView(){
    activeView=normalizeView(activeView);
    document.documentElement.dataset.viewDensity=activeView;
    if($('viewStandard'))$('viewStandard').checked=activeView==='standard';
    if($('viewAdvanced'))$('viewAdvanced').checked=activeView==='advanced';
    updateOptionVisibility();
    updatePhaseCards();
    syncBox3Light();
    syncJan1StandardGate();
    syncPurchaseLight();
    syncOwnerLight();
    syncHillenControls();
    renderAdvancedSummary();
    if(activeView==='advanced')renderAssumptionLog();
    const finalResults=detailsBySummary(/^(Final main-plan results|Final results summary)/i);
    if(finalResults&&activeView==='standard')finalResults.open=true;
    setModelMarker();
  }

  function refresh(){
    ensureSwitch();
    ensureSummary();
    ensureBox3Light();
    ensureJan1StandardGate();
    ensurePurchaseLight();
    ensureOwnerLight();
    ensureHillenAdvanced();
    ensureScenarioWozFields();
    ensureAuditTools();
    ensureStandardNotes();
    decorateFinanceForHillen();
    decorateScenarioForWoz();
    classify();
    applyView();
  }
  function queueRefresh(){
    if(refreshQueued)return;
    refreshQueued=true;
    requestAnimationFrame(()=>{refreshQueued=false;refresh();});
  }

  injectStyle();
  ensureSwitch();
  activeView=parseStoredView();
  document.addEventListener('input',queueRefresh);
  document.addEventListener('change',queueRefresh);
  window.addEventListener('load',refresh,{once:true});
  refresh();
}

return{
  DEFAULT_VIEW,STANDARD_PHASE_LIMIT,ADVANCED_SCENARIOS,DEFAULTS,
  normalizeView,number,optionalNumber,monthlyOwnerCost,escapeCsv,assumptionsToCsv,applyScenarioWoz,collectAdvancedState,bootBrowser
};
});

if(typeof window!=='undefined'&&window.document)window.ViewDensity.bootBrowser();
