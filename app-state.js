(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PlannerState=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';

const STORAGE_KEY='dutch-investment-mortgage-planner:r6';
const SCHEMA_VERSION=1;

function controlKey(el){
  if(!el)return null;
  if(el.id)return`id:${el.id}`;
  const i=el.dataset?.i,field=el.dataset?.field;
  if(i!==undefined&&field)return`phase:${i}:${field}`;
  return null;
}

function isPersistable(el){
  if(!el||el.disabled)return false;
  const tag=String(el.tagName||'').toLowerCase();
  if(tag!=='input'&&tag!=='select')return false;
  if(tag==='input'&&String(el.type||'').toLowerCase()==='hidden')return false;
  return Boolean(controlKey(el));
}

function captureControls(controls,meta={}){
  const values={};
  Array.from(controls||[]).forEach(el=>{
    if(!isPersistable(el))return;
    const key=controlKey(el);
    const type=String(el.type||'').toLowerCase();
    values[key]=(type==='checkbox'||type==='radio')
      ?{kind:'checked',value:Boolean(el.checked)}
      :{kind:'value',value:String(el.value??'')};
  });
  return{
    schema:SCHEMA_VERSION,
    savedAt:new Date().toISOString(),
    controls:values,
    meta:{
      activeTab:typeof meta.activeTab==='string'?meta.activeTab:null,
      mortgageType:meta.mortgageType==='linear'?'linear':meta.mortgageType==='annuity'?'annuity':null
    }
  };
}

function normalizePayload(raw){
  let value=raw;
  if(typeof raw==='string'){
    try{value=JSON.parse(raw)}catch{return null;}
  }
  if(!value||typeof value!=='object'||value.schema!==SCHEMA_VERSION||!value.controls||typeof value.controls!=='object')return null;
  return{
    schema:SCHEMA_VERSION,
    savedAt:typeof value.savedAt==='string'?value.savedAt:null,
    controls:value.controls,
    meta:{
      activeTab:typeof value.meta?.activeTab==='string'?value.meta.activeTab:null,
      mortgageType:value.meta?.mortgageType==='linear'?'linear':value.meta?.mortgageType==='annuity'?'annuity':null
    }
  };
}

function applyEntry(el,entry){
  if(!el||!entry||typeof entry!=='object')return false;
  if(entry.kind==='checked'){
    el.checked=Boolean(entry.value);
    return true;
  }
  if(entry.kind==='value'){
    el.value=String(entry.value??'');
    return true;
  }
  return false;
}

function normalizeDecimalString(value){
  return String(value??'').trim().replace(/\s+/g,'').replace(/,/g,'.');
}
function parseFlexibleNumber(value){
  const normalized=normalizeDecimalString(value);
  if(!normalized||normalized==='-'||normalized==='.'||normalized==='-.')return NaN;
  const n=Number(normalized);
  return Number.isFinite(n)?n:NaN;
}
function clampFlexibleValue(value,min,max){
  let n=parseFlexibleNumber(value);
  if(!Number.isFinite(n))return null;
  if(Number.isFinite(min))n=Math.max(min,n);
  if(Number.isFinite(max))n=Math.min(max,n);
  return n;
}

function bootBrowser(){
  if(typeof window==='undefined'||typeof document==='undefined')return;
  const storage=window.localStorage;
  let restoring=false;
  let storageWorks=true;

  function safeGet(){
    if(!storageWorks)return null;
    try{return storage.getItem(STORAGE_KEY)}catch{storageWorks=false;return null;}
  }
  function safeSet(value){
    if(!storageWorks)return false;
    try{storage.setItem(STORAGE_KEY,value);return true}catch{storageWorks=false;return false;}
  }
  function safeRemove(){
    if(!storageWorks)return;
    try{storage.removeItem(STORAGE_KEY)}catch{storageWorks=false;}
  }
  function controls(){return Array.from(document.querySelectorAll('input,select')).filter(isPersistable)}
  function meta(){
    return{
      activeTab:document.querySelector('.tab.active[data-tab]')?.dataset.tab||null,
      mortgageType:document.querySelector('.compare-card.active[data-mort-type]')?.dataset.mortType||null
    };
  }

  const style=document.createElement('style');
  style.textContent=`.planner-storage-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;background:var(--surface);border:.5px solid var(--border);border-radius:var(--radius);padding:10px 13px;margin:-5px 0 14px;font-size:11px;color:var(--muted)}.planner-storage-actions{display:flex;align-items:center;gap:9px}.planner-reset{border:.5px solid var(--border2);border-radius:var(--small);background:var(--alt);color:var(--secondary);font:inherit;font-size:11px;padding:7px 10px;cursor:pointer}.planner-reset:hover{color:var(--text)}.r6-methodology{margin-bottom:10px}.field-disabled{opacity:.55}.field-disabled input{cursor:not-allowed}.ux-period{margin-top:10px}.ux-household-fold{margin-top:12px}.ux-position-note{margin:0 0 12px}.ux-flex-number{width:100%;min-height:40px;border:.5px solid var(--border2);border-radius:var(--small);background:var(--surface);color:var(--text);padding:8px 10px;font:inherit;font-size:13px;outline:none}`;
  document.head.appendChild(style);

  const header=document.querySelector('header');
  if(header&&!document.getElementById('plannerStorageBar')){
    const bar=document.createElement('div');
    bar.id='plannerStorageBar';bar.className='planner-storage-bar';
    bar.innerHTML=`<span><strong>Private browser save:</strong> inputs are stored only in this browser, not in an account or planner server.</span><span class="planner-storage-actions"><span id="plannerSaveStatus">Not saved yet</span><button type="button" class="planner-reset" id="plannerReset">Reset examples</button></span>`;
    header.insertAdjacentElement('afterend',bar);
  }

  const modelDetails=Array.from(document.querySelectorAll('details.fold')).find(d=>/Model status and sources/i.test(d.querySelector('summary')?.textContent||''));
  const modelBody=modelDetails?.querySelector('.fold-body');
  if(modelBody&&!document.getElementById('r6Methodology')){
    const methodology=document.createElement('div');
    methodology.id='r6Methodology';methodology.className='callout r6-methodology';
    methodology.innerHTML='<strong>How to read the model:</strong> results are scenario comparisons, not underwriting or a tax return. Cash-flow differences are equalised between strategies; annual HRA/EWF/Hillen is authoritative; the 2026 Box 3 path is the current-rules baseline; the proposed future regime is a legislative scenario; official Nibud/LTI borrowing capacity is not calculated.';
    const privacy=document.createElement('div');
    privacy.className='callout r6-methodology';
    privacy.innerHTML='<strong>Data handling:</strong> the planner has no backend account. R6 can save your entered assumptions in localStorage on this browser so they survive a refresh. Reset removes that local snapshot and reloads the illustrative defaults.';
    modelBody.prepend(privacy);modelBody.prepend(methodology);
  }

  const marker=document.getElementById('modelVersion');
  if(marker)marker.textContent='Calculation build R6.1 · user-testing UX patch · 2026 rules · updated 1 Sep 2026';

  const status=document.getElementById('plannerSaveStatus');
  function setStatus(text){if(status)status.textContent=text;}
  function save(){
    if(restoring)return;
    const payload=captureControls(controls(),meta());
    if(safeSet(JSON.stringify(payload))){
      const t=new Date();
      setStatus(`Saved locally ${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`);
    }else setStatus('Local save unavailable');
  }
  function dispatch(el){
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function byKey(key){
    if(key.startsWith('id:'))return document.getElementById(key.slice(3));
    const m=/^phase:(\d+):([A-Za-z0-9_-]+)$/.exec(key);
    return m?document.querySelector(`#phaseList [data-i="${m[1]}"][data-field="${m[2]}"]`):null;
  }
  function restore(){
    const payload=normalizePayload(safeGet());
    if(!payload){setStatus(storageWorks?'Not saved yet':'Local save unavailable');return;}
    restoring=true;
    try{
      const idKeys=Object.keys(payload.controls).filter(k=>k.startsWith('id:'));
      const priority=['id:phaseCount','id:startMonth','id:startYear'];
      const ordered=[...priority.filter(k=>idKeys.includes(k)),...idKeys.filter(k=>!priority.includes(k))];
      ordered.forEach(key=>{const el=byKey(key);if(el&&applyEntry(el,payload.controls[key]))dispatch(el)});

      const fieldOrder=['years','mortgageFreq','monthlyInvest','mortgageExtra','annualBonus','bonusDest'];
      const phaseKeys=Object.keys(payload.controls).filter(k=>k.startsWith('phase:')).sort((a,b)=>{
        const ma=/^phase:(\d+):(.+)$/.exec(a),mb=/^phase:(\d+):(.+)$/.exec(b);
        const di=Number(ma?.[1]||0)-Number(mb?.[1]||0);if(di)return di;
        return fieldOrder.indexOf(ma?.[2])-fieldOrder.indexOf(mb?.[2]);
      });
      phaseKeys.forEach(key=>{const el=byKey(key);if(el&&applyEntry(el,payload.controls[key]))dispatch(el)});

      if(payload.meta.mortgageType){
        const card=document.querySelector(`.compare-card[data-mort-type="${payload.meta.mortgageType}"]`);
        card?.click();
      }
      if(payload.meta.activeTab){
        const tab=document.querySelector(`.tab[data-tab="${payload.meta.activeTab}"]`);
        tab?.click();
      }
      if(payload.savedAt){
        const d=new Date(payload.savedAt);
        setStatus(Number.isNaN(d.getTime())?'Saved locally':`Restored local save · ${d.toLocaleDateString('nl-NL')}`);
      }else setStatus('Restored local save');
    }finally{restoring=false;}
  }

  function prepareNumberInput(el){
    if(!el||el.dataset.flexNumber==='1'||String(el.type).toLowerCase()!=='number')return;
    el.dataset.flexNumber='1';
    el.dataset.flexMin=el.getAttribute('min')??'';
    el.dataset.flexMax=el.getAttribute('max')??'';
    el.type='text';
    el.inputMode='decimal';
    el.classList.add('ux-flex-number');
  }
  function prepareAllNumberInputs(root=document){
    if(root.matches?.('input[type="number"]'))prepareNumberInput(root);
    root.querySelectorAll?.('input[type="number"]').forEach(prepareNumberInput);
  }
  prepareAllNumberInputs();
  const numberObserver=new MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(n=>{if(n.nodeType===1)prepareAllNumberInputs(n)})));
  numberObserver.observe(document.body,{childList:true,subtree:true});
  document.addEventListener('input',e=>{
    const el=e.target;
    if(el?.dataset?.flexNumber==='1'&&String(el.value).includes(','))el.value=normalizeDecimalString(el.value);
  },true);
  document.addEventListener('blur',e=>{
    const el=e.target;if(el?.dataset?.flexNumber!=='1')return;
    const min=parseFlexibleNumber(el.dataset.flexMin),max=parseFlexibleNumber(el.dataset.flexMax);
    const n=clampFlexibleValue(el.value,min,max);
    if(n!==null)el.value=String(n);
  },true);

  function simplifyHousehold(){
    const context=document.getElementById('box3HouseholdContext');
    if(!context||context.dataset.uxSimplified==='1')return;
    context.dataset.uxSimplified='1';
    const title=context.querySelector('.subsection-title');
    const copy=context.querySelector('.subsection-copy');
    if(title)title.textContent='Savings and optional other debt';
    if(copy)copy.textContent='Most people only need Savings / cash at start and Savings interest. Open the optional debt section only if you have a debt that actually belongs in Box 3; do not enter your normal owner-occupied home mortgage there.';
    const savingsLabel=context.querySelector('label[for="box3Savings"]');
    if(savingsLabel)savingsLabel.textContent='Savings / cash at start';
    const savingsHelp=document.getElementById('box3Savings')?.closest('.field')?.querySelector('.inline');
    if(savingsHelp)savingsHelp.textContent='Cash and bank savings available to the household at the start of the plan. Purchase scenarios can spend this balance.';
    const grid=context.querySelector('.advanced-grid');
    if(grid){grid.classList.remove('grid3');grid.classList.add('grid2');}
    const debtIds=['box3Debt','box3DebtInterest','box3DebtMonthlyRepayment','box3DebtRepaymentSource'];
    const debtFields=debtIds.map(id=>document.getElementById(id)?.closest('.field')).filter(Boolean);
    if(debtFields.length&&grid){
      const details=document.createElement('details');details.className='inner-fold ux-household-fold';
      details.innerHTML='<summary>Optional: other Box 3 debt</summary><div class="inner-fold-body"><p class="subsection-copy">Use this only for debt that belongs in Box 3, such as qualifying non-home debt. Your normal owner-occupied mortgage belongs in the Mortgage tab, not here.</p><div class="grid2" data-ux-debt-grid></div></div>';
      grid.insertAdjacentElement('afterend',details);
      const target=details.querySelector('[data-ux-debt-grid]');debtFields.forEach(f=>target.appendChild(f));
    }
    const summary=context.querySelector('.summary');
    const keep=document.getElementById('householdSavingsEnd')?.closest('.summary-item');
    if(summary&&keep){
      const more=Array.from(summary.children).filter(x=>x!==keep);
      if(more.length){
        const details=document.createElement('details');details.className='inner-fold ux-household-fold';
        details.innerHTML='<summary>More balance-sheet results</summary><div class="inner-fold-body"><div class="summary" data-ux-more-balances></div></div>';
        summary.insertAdjacentElement('afterend',details);
        const target=details.querySelector('[data-ux-more-balances]');more.forEach(x=>target.appendChild(x));
        const net=document.getElementById('householdNetEnd')?.closest('.summary-item')?.querySelector('.k');if(net)net.textContent='Investments + savings − other debt';
        const ext=document.getElementById('householdExternalTax')?.closest('.summary-item')?.querySelector('.k');if(ext)ext.textContent='Box 3 paid outside modeled accounts';
      }
    }
  }

  function cleanPhaseLabels(){
    document.querySelectorAll('#phaseList [data-field="monthlyInvest"]').forEach(el=>{const lab=el.closest('div')?.querySelector('.mini');if(lab)lab.textContent='Investment / month';});
    document.querySelectorAll('#phaseList [data-field="mortgageExtra"]').forEach(el=>{const lab=el.closest('div')?.querySelector('.mini');if(lab)lab.textContent='Extra mortgage repayment';});
    document.querySelectorAll('#phaseList [data-field="mortgageFreq"]').forEach(el=>{const lab=el.closest('div')?.querySelector('.mini');if(lab)lab.textContent='Repayment frequency';});
  }

  function explainIncomeAndDeduction(){
    const income=document.getElementById('grossIncome');
    const label=document.querySelector('label[for="grossIncome"]');
    if(label)label.textContent='Taxable annual Box 1 income';
    const field=income?.closest('.field');
    if(field&&!document.getElementById('grossIncomeHelp')){
      const p=document.createElement('p');p.className='inline';p.id='grossIncomeHelp';
      p.textContent='Use taxable Box 1 wage/income before the home deduction. If you use the expat (30%) ruling, use the taxable annual wage shown on your jaaropgaaf rather than your full contractual salary.';
      field.appendChild(p);
    }
    const mode=document.getElementById('deductionMode'),manual=document.getElementById('manualDeduction');
    if(!mode||!manual)return;
    const auto=mode.value==='auto';
    if(auto){
      const shown=parseFlexibleNumber(String(document.getElementById('deductionDisplay')?.textContent||'').replace('%',''));
      if(Number.isFinite(shown))manual.value=String(shown);
    }
    manual.disabled=auto;
    manual.closest('.field')?.classList.toggle('field-disabled',auto);
    const manualLabel=document.querySelector('label[for="manualDeduction"]');
    if(manualLabel)manualLabel.textContent=auto?'Calculated deduction rate %':'Manual deduction rate %';
    let help=document.getElementById('manualDeductionHelp');
    if(!help&&manual.closest('.field')){help=document.createElement('p');help.id='manualDeductionHelp';help.className='inline';manual.closest('.field').appendChild(help);}
    if(help)help.textContent=auto?'Calculated from the income above. Switch Deduction rate to Manual to edit it.':'Enter the planning deduction rate you want to use.';
  }

  const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function planningPeriod(){
    const startYear=parseFlexibleNumber(document.getElementById('startYear')?.value),startMonth=parseFlexibleNumber(document.getElementById('startMonth')?.value);
    if(!Number.isFinite(startYear)||!Number.isFinite(startMonth))return null;
    const years=Array.from(document.querySelectorAll('#phaseList [data-field="years"]')).reduce((s,el)=>s+(parseFlexibleNumber(el.value)||0),0);
    const months=Math.max(1,Math.round(years*12));
    const start=new Date(Date.UTC(startYear,startMonth-1,1));
    const end=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+months-1,1));
    return{start,end,label:`${MONTHS[start.getUTCMonth()]} ${start.getUTCFullYear()} – ${MONTHS[end.getUTCMonth()]} ${end.getUTCFullYear()}`,endLabel:`${MONTHS[end.getUTCMonth()]} ${end.getUTCFullYear()}`};
  }
  function explainMortgagePeriod(){
    const period=planningPeriod(),woz=document.getElementById('wozImpact');
    if(!period||!woz)return;
    let box=document.getElementById('mortgageSummaryPeriod');
    if(!box){box=document.createElement('div');box.id='mortgageSummaryPeriod';box.className='callout ux-period';woz.insertAdjacentElement('afterend',box);}
    box.innerHTML=`<strong>Mortgage summary period: ${period.label}.</strong><br><span>The interest and tax-benefit totals below stop at the end of your Investment phases. They are not automatically lifetime mortgage totals.</span>`;
    const gross=document.getElementById('mGrossInterest')?.closest('.summary-item'),tax=document.getElementById('mTaxBenefit')?.closest('.summary-item'),net=document.getElementById('mNetInterest')?.closest('.summary-item'),pay=document.getElementById('mPayoff')?.closest('.summary-item');
    if(gross?.querySelector('.s'))gross.querySelector('.s').textContent=period.label;
    if(tax?.querySelector('.s'))tax.querySelector('.s').textContent=`${period.label} · annual HRA/EWF/Hillen`;
    if(net?.querySelector('.s'))net.querySelector('.s').textContent=period.label;
    if(pay?.querySelector('.k'))pay.querySelector('.k').textContent=`Mortgage status at ${period.endLabel}`;
  }

  function reframeNextEuro(){
    const card=document.getElementById('nextEuroCard'),engine=document.getElementById('decisionEngine'),mode=document.getElementById('comparisonType')?.value;
    if(!card||!engine)return;
    const builder=engine.querySelector('.scenario-builder');if(builder&&card.previousElementSibling!==builder)builder.insertAdjacentElement('afterend',card);
    card.classList.toggle('hidden',mode!=='mortgage-invest');
    const label=card.querySelector('.section-label'),note=card.querySelector('.section-note');
    if(label)label.textContent='Extra cash: invest or repay?';
    if(note)note.textContent='If you have money left each month, this compares putting the same amount into investments versus making an extra mortgage repayment. The break-even return is the annual investment return needed for both choices to end with the same modeled wealth.';
    const labels=[['nextEuroAmount','Extra money available each month'],['nextEuroYears','Compare for, years'],['nextEuroReturn','Expected investment return %']];
    labels.forEach(([id,text])=>{const l=document.querySelector(`label[for="${id}"]`);if(l)l.textContent=text;});
    const items=card.querySelectorAll('.summary-item .k');
    if(items[0])items[0].textContent='Investment return needed to tie';
    if(items[1])items[1].textContent='Better choice at your return';
    if(items[2])items[2].textContent='Difference after selected period';
  }

  function scenarioAssumptions(){
    const mode=document.getElementById('comparisonType')?.value;if(!mode)return;
    const relevance={
      'scenarioMortgageMethodNew':['buy-rent','downpayment','mortgage-invest','sell-rent'],
      'scenarioUpfrontCashTreatmentNew':['buy-rent','downpayment'],
      'scenarioHomeGrowthNew':['buy-rent','downpayment','sell-rent'],
      'scenarioRentGrowthNew':['buy-rent','sell-rent'],
      'scenarioSellingCostNew':['buy-rent','downpayment','sell-rent'],
      'scenarioVveNew':['buy-rent','downpayment','mortgage-invest','linear-annuity','sell-rent'],
      'scenarioMaintenanceNew':['buy-rent','downpayment','mortgage-invest','linear-annuity','sell-rent'],
      'scenarioOwnerTaxesNew':['buy-rent','downpayment','mortgage-invest','linear-annuity','sell-rent'],
      'scenarioInsuranceNew':['buy-rent','downpayment','mortgage-invest','linear-annuity','sell-rent'],
      'scenarioGroundLeaseNew':['buy-rent','downpayment','mortgage-invest','linear-annuity','sell-rent']
    };
    Object.entries(relevance).forEach(([id,modes])=>document.getElementById(id)?.closest('.field')?.classList.toggle('hidden',!modes.includes(mode)));
    const shared=document.getElementById('scenarioMonthlyBudgetNew')?.closest('.card');
    const head=shared?.querySelector('.section-head .section-note');if(head)head.textContent='Only assumptions used by the selected comparison are shown. Owner-only costs remain visible where they affect the affordability check.';
    const builder=document.querySelector('#decisionEngine .scenario-builder .section-note');if(builder)builder.textContent='Choose one decision. Purchase comparisons use the Savings / cash balance in Investment, so spending cash changes later Box 3.';
    const cashNote=document.getElementById('scenarioCashSourceNoteNew');if(cashNote)cashNote.innerHTML=cashNote.innerHTML.replace('Investment → Household financial balances','Investment → Savings / cash');
  }

  function reframeComparableWealth(){
    const mode=document.getElementById('comparisonType')?.value;
    const resultA=document.getElementById('strategyAResultNew'),resultB=document.getElementById('strategyBResultNew');
    if(!resultA||!resultB)return;
    if(mode==='linear-annuity'||mode==='mortgage-invest'){
      [resultA,resultB].forEach(card=>{const lab=card.querySelector('.strategy-label-new');if(lab)lab.textContent='Net position excluding the home*';});
      const resultCard=resultA.closest('.card'),sectionNote=resultCard?.querySelector('.section-head .section-note');
      if(sectionNote)sectionNote.textContent='For this decision, the home is the same on both sides and is excluded. Net position = investments + savings − Box 3 debt − remaining mortgage.';
      let expl=document.getElementById('uxPositionExplanation');
      if(!expl&&document.getElementById('scenarioVerdictNew')){expl=document.createElement('div');expl.id='uxPositionExplanation';expl.className='callout ux-position-note';document.getElementById('scenarioVerdictNew').insertAdjacentElement('afterend',expl);}
      if(expl){
        expl.classList.remove('hidden');
        expl.innerHTML=mode==='linear-annuity'
          ?'<strong>Why can Annuity win even with a larger mortgage balance?</strong><br><span>An annuity mortgage usually has a lower monthly payment early on. The model invests that payment difference. So the comparison is not mortgage balance alone: a larger investment portfolio can outweigh the extra mortgage debt.</span>'
          :'<strong>How this comparison works:</strong><br><span>The same extra monthly amount either reduces mortgage principal or is invested. The winner is based on investments + savings − other debt − remaining mortgage, with the common home value excluded.</span>';
      }
    }else{
      const expl=document.getElementById('uxPositionExplanation');if(expl)expl.classList.add('hidden');
    }
  }

  function refreshUx(){
    simplifyHousehold();cleanPhaseLabels();explainIncomeAndDeduction();explainMortgagePeriod();scenarioAssumptions();reframeNextEuro();reframeComparableWealth();
  }

  document.addEventListener('input',e=>{if(isPersistable(e.target))save();refreshUx();});
  document.addEventListener('change',e=>{if(isPersistable(e.target))save();refreshUx();});
  document.querySelectorAll('.tab[data-tab],.compare-card[data-mort-type]').forEach(el=>el.addEventListener('click',()=>{if(!restoring)save();refreshUx()}));
  document.getElementById('plannerReset')?.addEventListener('click',()=>{
    if(window.confirm('Reset all planner inputs to the illustrative examples?')){
      safeRemove();
      window.location.reload();
    }
  });

  restore();
  refreshUx();
  const uxObserver=new MutationObserver(()=>refreshUx());
  ['phaseList','strategyAResultNew','strategyBResultNew','scenarioVerdictNew'].forEach(id=>{const el=document.getElementById(id);if(el)uxObserver.observe(el,{childList:true,subtree:true});});
}

return{STORAGE_KEY,SCHEMA_VERSION,controlKey,isPersistable,captureControls,normalizePayload,applyEntry,normalizeDecimalString,parseFlexibleNumber,clampFlexibleValue,bootBrowser};
});

if(typeof window!=='undefined'&&window.document)window.PlannerState.bootBrowser();