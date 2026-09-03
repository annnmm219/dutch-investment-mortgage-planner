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
    const key=controlKey(el),type=String(el.type||'').toLowerCase();
    values[key]=(type==='checkbox'||type==='radio')?{kind:'checked',value:Boolean(el.checked)}:{kind:'value',value:String(el.value??'')};
  });
  return{schema:SCHEMA_VERSION,savedAt:new Date().toISOString(),controls:values,meta:{activeTab:typeof meta.activeTab==='string'?meta.activeTab:null,mortgageType:meta.mortgageType==='linear'?'linear':meta.mortgageType==='annuity'?'annuity':null}};
}
function normalizePayload(raw){
  let value=raw;
  if(typeof raw==='string'){try{value=JSON.parse(raw)}catch{return null;}}
  if(!value||typeof value!=='object'||value.schema!==SCHEMA_VERSION||!value.controls||typeof value.controls!=='object')return null;
  return{schema:SCHEMA_VERSION,savedAt:typeof value.savedAt==='string'?value.savedAt:null,controls:{...value.controls},meta:{activeTab:typeof value.meta?.activeTab==='string'?value.meta.activeTab:null,mortgageType:value.meta?.mortgageType==='linear'?'linear':value.meta?.mortgageType==='annuity'?'annuity':null}};
}
function applyEntry(el,entry){
  if(!el||!entry||typeof entry!=='object')return false;
  if(entry.kind==='checked'){el.checked=Boolean(entry.value);return true;}
  if(entry.kind==='value'){el.value=String(entry.value??'');return true;}
  return false;
}
function normalizeDecimalString(value){return String(value??'').trim().replace(/\s+/g,'').replace(/,/g,'.')}
function parseFlexibleNumber(value){const s=normalizeDecimalString(value);if(!s||s==='-'||s==='.'||s==='-.')return NaN;const n=Number(s);return Number.isFinite(n)?n:NaN}
function clampFlexibleValue(value,min,max){let n=parseFlexibleNumber(value);if(!Number.isFinite(n))return null;if(Number.isFinite(min))n=Math.max(min,n);if(Number.isFinite(max))n=Math.min(max,n);return n}
function estimateTaxableIncome2026({grossIncome=0,use30Ruling=false,rulingRate=.30,maxTaxFree=78600}={}){
  const gross=Math.max(0,Number(grossIncome)||0);
  if(!use30Ruling)return gross;
  const taxFree=Math.min(gross*Math.max(0,Number(rulingRate)||0),Math.max(0,Number(maxTaxFree)||0));
  return Math.max(0,gross-taxFree);
}
function monthlyEquivalentExtra(amount,frequency='monthly'){
  const value=Math.max(0,Number(amount)||0);
  return frequency==='yearly'?value/12:value;
}
function mortgageReportingMonths({mode='investment',startYear=2026,startMonth=1,investmentMonths=120,mortgageTermMonths=360,specificYear=2035}={}){
  const term=Math.max(1,Math.round(Number(mortgageTermMonths)||1));
  const invest=Math.max(1,Math.round(Number(investmentMonths)||1));
  if(mode==='mortgage')return term;
  if(mode==='year'){
    const sy=Number(startYear)||2026,sm=Math.min(12,Math.max(1,Number(startMonth)||1)),ey=Math.max(sy,Math.round(Number(specificYear)||sy));
    const throughDecember=(ey-sy)*12+(13-sm);
    return Math.min(term,Math.max(1,throughDecember));
  }
  return Math.min(term,invest);
}

function bootBrowser(){
  if(typeof window==='undefined'||typeof document==='undefined')return;
  const storage=window.localStorage,FC=window.FinanceCore;
  let restoring=false,storageWorks=true,syncingIncome=false,convertingPhase=false;
  const $=id=>document.getElementById(id);
  const fmt=v=>'€'+Math.round(Number(v)||0).toLocaleString('nl-NL');
  const fmtSigned=v=>(Number(v)<0?'−':'+')+fmt(Math.abs(Number(v)||0));
  const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  function safeGet(){if(!storageWorks)return null;try{return storage.getItem(STORAGE_KEY)}catch{storageWorks=false;return null}}
  function safeSet(value){if(!storageWorks)return false;try{storage.setItem(STORAGE_KEY,value);return true}catch{storageWorks=false;return false}}
  function safeRemove(){if(!storageWorks)return;try{storage.removeItem(STORAGE_KEY)}catch{storageWorks=false;}}
  function controls(){return Array.from(document.querySelectorAll('input,select')).filter(isPersistable)}
  function meta(){return{activeTab:document.querySelector('.tab.active[data-tab]')?.dataset.tab||null,mortgageType:document.querySelector('.compare-card.active[data-mort-type]')?.dataset.mortType||null}}
  function dispatch(el){el?.dispatchEvent(new Event('input',{bubbles:true}));el?.dispatchEvent(new Event('change',{bubbles:true}))}

  const style=document.createElement('style');
  style.textContent=`.planner-storage-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;background:var(--surface);border:.5px solid var(--border);border-radius:var(--radius);padding:10px 13px;margin:-5px 0 14px;font-size:11px;color:var(--muted)}.planner-storage-actions{display:flex;align-items:center;gap:9px}.planner-reset{border:.5px solid var(--border2);border-radius:var(--small);background:var(--alt);color:var(--secondary);font:inherit;font-size:11px;padding:7px 10px;cursor:pointer}.planner-reset:hover{color:var(--text)}.r6-methodology{margin-bottom:10px}.field-disabled{opacity:.55}.field-disabled input{cursor:not-allowed}.ux-period{margin-top:10px}.ux-household-fold{margin-top:12px}.ux-position-note{margin:0 0 12px}.ux-flex-number{width:100%;min-height:40px;border:.5px solid var(--border2);border-radius:var(--small);background:var(--surface);color:var(--text);padding:8px 10px;font:inherit;font-size:13px;outline:none}.ux-income-toggle{margin-top:8px}.ux-income-used{margin-top:7px}.ux-horizon-grid{margin-top:12px}.ux-phase-frequency-hidden{display:none!important}@media(min-width:1001px){#phaseList .phase-fields{grid-template-columns:repeat(5,minmax(0,1fr))!important}}`;
  document.head.appendChild(style);

  const header=document.querySelector('header');
  if(header&&!$('plannerStorageBar')){
    const bar=document.createElement('div');bar.id='plannerStorageBar';bar.className='planner-storage-bar';
    bar.innerHTML=`<span><strong>Private browser save:</strong> inputs are stored only in this browser, not in an account or planner server.</span><span class="planner-storage-actions"><span id="plannerSaveStatus">Not saved yet</span><button type="button" class="planner-reset" id="plannerReset">Reset examples</button></span>`;
    header.insertAdjacentElement('afterend',bar);
  }
  const modelDetails=Array.from(document.querySelectorAll('details.fold')).find(d=>/Model status and sources/i.test(d.querySelector('summary')?.textContent||''));
  const modelBody=modelDetails?.querySelector('.fold-body');
  if(modelBody&&!$('r6Methodology')){
    const methodology=document.createElement('div');methodology.id='r6Methodology';methodology.className='callout r6-methodology';
    methodology.innerHTML='<strong>How to read the model:</strong> results are scenario comparisons, not underwriting or a tax return. Cash-flow differences are equalised between strategies; annual HRA/EWF/Hillen is authoritative; the 2026 Box 3 path is the current-rules baseline; the proposed future regime is a legislative scenario; official Nibud/LTI borrowing capacity is not calculated.';
    const privacy=document.createElement('div');privacy.className='callout r6-methodology';privacy.innerHTML='<strong>Data handling:</strong> the planner has no backend account. R6 can save your entered assumptions in localStorage on this browser so they survive a refresh. Reset removes that local snapshot and reloads the illustrative defaults.';
    modelBody.prepend(privacy);modelBody.prepend(methodology);
  }

  const status=$('plannerSaveStatus');
  function setStatus(text){if(status)status.textContent=text}
  function save(){if(restoring)return;const payload=captureControls(controls(),meta());if(safeSet(JSON.stringify(payload))){const t=new Date();setStatus(`Saved locally ${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`)}else setStatus('Local save unavailable')}
  function byKey(key){if(key.startsWith('id:'))return $(key.slice(3));const m=/^phase:(\d+):([A-Za-z0-9_-]+)$/.exec(key);return m?document.querySelector(`#phaseList [data-i="${m[1]}"][data-field="${m[2]}"]`):null}

  function prepareRound2Controls(){
    const calcIncome=$('grossIncome'),field=calcIncome?.closest('.field');
    if(calcIncome&&field&&!$('grossAnnualIncome')){
      const label=field.querySelector('label[for="grossIncome"]');if(label){label.htmlFor='grossAnnualIncome';label.textContent='Gross annual employment income';}
      const visible=document.createElement('input');visible.id='grossAnnualIncome';visible.type='number';visible.min='0';visible.step='1000';visible.value=calcIncome.value||'60000';
      calcIncome.classList.add('hidden');field.insertBefore(visible,calcIncome);
      const toggle=document.createElement('div');toggle.className='toggle ux-income-toggle';toggle.innerHTML='<input id="use30Ruling" type="checkbox"><label for="use30Ruling">I use the 30% ruling / expat scheme</label>';field.appendChild(toggle);
      const used=document.createElement('p');used.id='taxableIncomeUsed';used.className='inline ux-income-used';field.appendChild(used);
      const help=document.createElement('p');help.id='grossIncomeHelp';help.className='inline';help.textContent='With the ruling selected, the planner estimates taxable Box 1 employment income by applying the full 30% tax-free allowance for a full year, capped at €78,600 in 2026. Your jaaropgaaf remains authoritative. This checkbox affects the HRA income estimate only, not Box 3 residency treatment.';field.appendChild(help);
    }
    const woz=$('wozImpact');
    if(woz&&!$('mortgageReportHorizon')){
      const wrap=document.createElement('div');wrap.className='grid2 ux-horizon-grid';wrap.id='mortgageHorizonControls';
      const startYear=parseFlexibleNumber($('startYear')?.value)||2026;
      wrap.innerHTML=`<div class="field"><label for="mortgageReportHorizon">Mortgage totals: report until</label><select id="mortgageReportHorizon"><option value="investment" selected>End of investment plan</option><option value="mortgage">End of mortgage term</option><option value="year">A specific year</option></select><p class="inline">Changes the Mortgage tab totals and payment schedule only. It does not extend the investment plan or Scenario horizon.</p></div><div class="field hidden" id="mortgageReportYearField"><label for="mortgageReportYear">Report through year</label><input id="mortgageReportYear" type="number" min="2026" max="2100" step="1" value="${startYear+10}"><p class="inline">For a specific year, the report runs through December of that year or until the mortgage ends, whichever comes first.</p></div>`;
      woz.insertAdjacentElement('afterend',wrap);
    }
  }

  function restore(){
    const payload=normalizePayload(safeGet());
    if(!payload){setStatus(storageWorks?'Not saved yet':'Local save unavailable');return;}
    if(!payload.controls['id:grossAnnualIncome']&&payload.controls['id:grossIncome'])payload.controls['id:grossAnnualIncome']={...payload.controls['id:grossIncome']};
    restoring=true;
    try{
      const idKeys=Object.keys(payload.controls).filter(k=>k.startsWith('id:'));
      const priority=['id:phaseCount','id:startMonth','id:startYear','id:grossAnnualIncome','id:use30Ruling','id:mortgageReportHorizon','id:mortgageReportYear'];
      const ordered=[...priority.filter(k=>idKeys.includes(k)),...idKeys.filter(k=>!priority.includes(k))];
      ordered.forEach(key=>{const el=byKey(key);if(el&&applyEntry(el,payload.controls[key]))dispatch(el)});
      const fieldOrder=['years','mortgageFreq','monthlyInvest','mortgageExtra','annualBonus','bonusDest'];
      const phaseKeys=Object.keys(payload.controls).filter(k=>k.startsWith('phase:')).sort((a,b)=>{const ma=/^phase:(\d+):(.+)$/.exec(a),mb=/^phase:(\d+):(.+)$/.exec(b);const di=Number(ma?.[1]||0)-Number(mb?.[1]||0);if(di)return di;return fieldOrder.indexOf(ma?.[2])-fieldOrder.indexOf(mb?.[2]);});
      phaseKeys.forEach(key=>{const el=byKey(key);if(el&&applyEntry(el,payload.controls[key]))dispatch(el)});
      if(payload.meta.mortgageType)document.querySelector(`.compare-card[data-mort-type="${payload.meta.mortgageType}"]`)?.click();
      if(payload.meta.activeTab)document.querySelector(`.tab[data-tab="${payload.meta.activeTab}"]`)?.click();
      if(payload.savedAt){const d=new Date(payload.savedAt);setStatus(Number.isNaN(d.getTime())?'Saved locally':`Restored local save · ${d.toLocaleDateString('nl-NL')}`)}else setStatus('Restored local save');
    }finally{restoring=false;}
  }

  function prepareNumberInput(el){if(!el||el.dataset.flexNumber==='1'||String(el.type).toLowerCase()!=='number')return;el.dataset.flexNumber='1';el.dataset.flexMin=el.getAttribute('min')??'';el.dataset.flexMax=el.getAttribute('max')??'';el.type='text';el.inputMode='decimal';el.classList.add('ux-flex-number')}
  function prepareAllNumberInputs(root=document){if(root.matches?.('input[type="number"]'))prepareNumberInput(root);root.querySelectorAll?.('input[type="number"]').forEach(prepareNumberInput)}

  function simplifyHousehold(){
    const context=$('box3HouseholdContext');if(!context||context.dataset.uxSimplified==='1')return;context.dataset.uxSimplified='1';
    const title=context.querySelector('.subsection-title'),copy=context.querySelector('.subsection-copy');if(title)title.textContent='Savings and optional other debt';if(copy)copy.textContent='Most people only need Savings / cash at start and Savings interest. Open the optional debt section only if you have a debt that actually belongs in Box 3; do not enter your normal owner-occupied home mortgage there.';
    const savingsLabel=context.querySelector('label[for="box3Savings"]');if(savingsLabel)savingsLabel.textContent='Savings / cash at start';
    const savingsHelp=$('box3Savings')?.closest('.field')?.querySelector('.inline');if(savingsHelp)savingsHelp.textContent='Cash and bank savings available to the household at the start of the plan. Purchase scenarios can spend this balance.';
    const grid=context.querySelector('.advanced-grid');if(grid){grid.classList.remove('grid3');grid.classList.add('grid2');}
    const debtFields=['box3Debt','box3DebtInterest','box3DebtMonthlyRepayment','box3DebtRepaymentSource','box3DebtFallbackDestination'].map(id=>$(id)?.closest('.field')).filter(Boolean);
    if(debtFields.length&&grid){const details=document.createElement('details');details.className='inner-fold ux-household-fold';details.innerHTML='<summary>Optional: other Box 3 debt</summary><div class="inner-fold-body"><p class="subsection-copy">Use this only for debt that belongs in Box 3. Your normal owner-occupied mortgage belongs in the Mortgage tab, not here.</p><div class="grid2" data-ux-debt-grid></div></div>';grid.insertAdjacentElement('afterend',details);const target=details.querySelector('[data-ux-debt-grid]');debtFields.forEach(f=>target.appendChild(f));}
    const summary=context.querySelector('.summary'),keep=$('householdSavingsEnd')?.closest('.summary-item');
    if(summary&&keep){const more=Array.from(summary.children).filter(x=>x!==keep);if(more.length){const details=document.createElement('details');details.className='inner-fold ux-household-fold';details.innerHTML='<summary>More balance-sheet results</summary><div class="inner-fold-body"><div class="summary" data-ux-more-balances></div></div>';summary.insertAdjacentElement('afterend',details);const target=details.querySelector('[data-ux-more-balances]');more.forEach(x=>target.appendChild(x));const net=$('householdNetEnd')?.closest('.summary-item')?.querySelector('.k');if(net)net.textContent='Investments + savings − other debt';const ext=$('householdExternalTax')?.closest('.summary-item')?.querySelector('.k');if(ext)ext.textContent='Box 3 paid outside modeled accounts';}}
  }

  function simplifyPhasesToMonthly(){
    if(convertingPhase)return;
    const freqs=Array.from(document.querySelectorAll('#phaseList [data-field="mortgageFreq"]'));
    const yearly=freqs.find(el=>el.value==='yearly');
    if(yearly){
      convertingPhase=true;
      const i=yearly.dataset.i,extra=document.querySelector(`#phaseList [data-i="${i}"][data-field="mortgageExtra"]`);
      if(extra){extra.value=String(monthlyEquivalentExtra(parseFlexibleNumber(extra.value)||0,'yearly'));dispatch(extra);}
      yearly.value='monthly';dispatch(yearly);convertingPhase=false;return;
    }
    document.querySelectorAll('#phaseList [data-field="monthlyInvest"]').forEach(el=>{const lab=el.closest('div')?.querySelector('.mini');if(lab)lab.textContent='Monthly investment';});
    document.querySelectorAll('#phaseList [data-field="mortgageExtra"]').forEach(el=>{const lab=el.closest('div')?.querySelector('.mini');if(lab)lab.textContent='Monthly extra mortgage repayment';});
    freqs.forEach(el=>{el.value='monthly';el.closest('div')?.classList.add('ux-phase-frequency-hidden');});
    const foot=$('phaseList')?.nextElementSibling;if(foot?.classList.contains('foot'))foot.innerHTML='<strong>Monthly extra mortgage repayment</strong> = recurring overpayment from normal monthly cash flow. <strong>Annual bonus / lump sum</strong> = one separate payment per year that can be invested, paid to the mortgage, or split.';
  }

  function syncIncome(){
    const visible=$('grossAnnualIncome'),use=$('use30Ruling'),calc=$('grossIncome'),used=$('taxableIncomeUsed');if(!visible||!use||!calc)return;
    const gross=Math.max(0,parseFlexibleNumber(visible.value)||0),taxable=estimateTaxableIncome2026({grossIncome:gross,use30Ruling:use.checked});
    if(used)used.innerHTML=use.checked?`Estimated taxable Box 1 employment income used for HRA: <strong>${fmt(taxable)}</strong>.`: `Taxable Box 1 employment income used for HRA: <strong>${fmt(taxable)}</strong>.`;
    if(syncingIncome)return;
    const current=parseFlexibleNumber(calc.value);
    if(!Number.isFinite(current)||Math.abs(current-taxable)>.005){syncingIncome=true;calc.value=String(taxable);dispatch(calc);syncingIncome=false;}
  }
  function explainIncomeAndDeduction(){
    syncIncome();
    const mode=$('deductionMode'),manual=$('manualDeduction');if(!mode||!manual)return;
    const auto=mode.value==='auto';
    if(auto){const shown=parseFlexibleNumber(String($('deductionDisplay')?.textContent||'').replace('%',''));if(Number.isFinite(shown))manual.value=String(shown);}
    manual.disabled=auto;manual.closest('.field')?.classList.toggle('field-disabled',auto);
    const label=document.querySelector('label[for="manualDeduction"]');if(label)label.textContent=auto?'Calculated deduction rate %':'Manual deduction rate %';
    let help=$('manualDeductionHelp');if(!help&&manual.closest('.field')){help=document.createElement('p');help.id='manualDeductionHelp';help.className='inline';manual.closest('.field').appendChild(help);}if(help)help.textContent=auto?'Calculated from the estimated taxable income above. Switch Deduction rate to Manual to edit it.':'Enter the planning deduction rate you want to use.';
  }

  function investmentPlanMonths(){return Math.max(1,Array.from(document.querySelectorAll('#phaseList [data-field="years"]')).reduce((s,el)=>s+Math.max(0,parseFlexibleNumber(el.value)||0)*12,0))}
  function mortgageSetup(){
    const purchase=$('mortgageMode')?.value==='purchase';
    if(purchase){const price=Math.max(0,parseFlexibleNumber($('housePrice')?.value)||0),savings=Math.max(0,parseFlexibleNumber($('ownSavings')?.value)||0),costs=Math.max(0,parseFlexibleNumber($('purchaseCosts')?.value)||0),after=Math.max(0,savings-costs);return{balance:Math.max(0,price-after),ratePct:Math.max(0,parseFlexibleNumber($('purchaseRate')?.value)||0),years:Math.max(1,parseFlexibleNumber($('purchaseYears')?.value)||30)};}
    return{balance:Math.max(0,parseFlexibleNumber($('mortBalance')?.value)||0),ratePct:Math.max(0,parseFlexibleNumber($('mortRate')?.value)||0),years:Math.max(1,parseFlexibleNumber($('mortYears')?.value)||25)};
  }
  function phaseExtraSeries(months,startYear,startMonth){
    const count=Math.max(1,Math.round(parseFlexibleNumber($('phaseCount')?.value)||1)),bonusMonth=Math.max(1,Math.min(12,Math.round(parseFlexibleNumber($('bonusMonth')?.value)||12)));
    const phaseData=[];
    for(let i=0;i<count;i++){
      const years=Math.max(0,parseFlexibleNumber(document.querySelector(`#phaseList [data-i="${i}"][data-field="years"]`)?.value)||0),extra=Math.max(0,parseFlexibleNumber(document.querySelector(`#phaseList [data-i="${i}"][data-field="mortgageExtra"]`)?.value)||0),annual=Math.max(0,parseFlexibleNumber(document.querySelector(`#phaseList [data-i="${i}"][data-field="annualBonus"]`)?.value)||0),dest=document.querySelector(`#phaseList [data-i="${i}"][data-field="bonusDest"]`)?.value||'invest';
      phaseData.push({months:Math.round(years*12),extra,annual,dest});
    }
    const out=Array(months).fill(0);let pIndex=0,pUsed=0,year=startYear,month=startMonth;
    for(let i=0;i<months;i++){
      while(pIndex<phaseData.length&&pUsed>=phaseData[pIndex].months){pIndex++;pUsed=0;}
      if(pIndex<phaseData.length){const p=phaseData[pIndex];let x=p.extra;if(month===bonusMonth){if(p.dest==='mortgage')x+=p.annual;else if(p.dest==='split')x+=p.annual/2;}out[i]=x;pUsed++;}
      month++;if(month===13){month=1;year++;}
    }
    return out;
  }
  function scheduleDate(startYear,startMonth,index){const d=new Date(Date.UTC(startYear,startMonth-1+index,1));return{year:d.getUTCFullYear(),month:d.getUTCMonth()+1,label:`${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`}}
  function mortgageReport(){
    if(!FC)return null;
    const setup=mortgageSetup(),startYear=Math.round(parseFlexibleNumber($('startYear')?.value)||2026),startMonth=Math.max(1,Math.min(12,Math.round(parseFlexibleNumber($('startMonth')?.value)||1))),investmentMonths=Math.round(investmentPlanMonths()),termMonths=Math.max(1,Math.round(setup.years*12)),mode=$('mortgageReportHorizon')?.value||'investment',specificYear=Math.round(parseFlexibleNumber($('mortgageReportYear')?.value)||startYear);
    const months=mortgageReportingMonths({mode,startYear,startMonth,investmentMonths,mortgageTermMonths:termMonths,specificYear});
    const extra=phaseExtraSeries(months,startYear,startMonth),deductionRate=FC.deductionRate2026({mode:$('deductionMode')?.value||'auto',manualRatePct:parseFlexibleNumber($('manualDeduction')?.value)||37.56,grossIncome:parseFlexibleNumber($('grossIncome')?.value)||0}),tax={enabled:$('mortTaxEnabled')?.checked!==false,deductionRate,wozValue:Math.max(0,parseFlexibleNumber($('wozValue')?.value)||0)};
    const type=document.querySelector('.compare-card.active[data-mort-type]')?.dataset.mortType==='linear'?'linear':'annuity';
    return{setup,startYear,startMonth,months,mode,specificYear,extra,tax,type,selected:FC.mortgageSchedule({balance:setup.balance,annualRatePct:setup.ratePct,termYears:setup.years,type,months,extraMonthly:extra,startYear,startMonth,tax}),linear:FC.mortgageSchedule({balance:setup.balance,annualRatePct:setup.ratePct,termYears:setup.years,type:'linear',months,extraMonthly:extra,startYear,startMonth,tax}),annuity:FC.mortgageSchedule({balance:setup.balance,annualRatePct:setup.ratePct,termYears:setup.years,type:'annuity',months,extraMonthly:extra,startYear,startMonth,tax})};
  }
  function renderMortgageSchedule(rows){
    const body=$('scheduleBody');if(!body)return;body.innerHTML='';
    if($('scheduleView')?.value==='yearly'){
      const years={};rows.forEach(r=>{if(!years[r.year])years[r.year]={balance:0,gross:0,principal:0,interest:0,taxReturn:0,net:0,extra:0};const a=years[r.year];a.balance=r.balance;a.gross+=r.gross;a.principal+=r.principal;a.interest+=r.interest;a.taxReturn+=r.taxReturn;a.net+=r.net;a.extra+=r.extra;});Object.entries(years).forEach(([yr,r])=>{const tr=document.createElement('tr');tr.innerHTML=`<td>${yr}</td><td>${fmt(r.balance)}</td><td>${fmt(r.gross)}</td><td>${fmt(r.principal)}</td><td>${fmt(r.interest)}</td><td>${fmtSigned(r.taxReturn)}</td><td>${fmt(r.net)}</td><td>${fmt(r.extra)}</td>`;body.appendChild(tr)});
    }else rows.forEach(r=>{const tr=document.createElement('tr');tr.innerHTML=`<td>${MONTHS[r.month-1]} ${r.year}</td><td>${fmt(r.balance)}</td><td>${fmt(r.gross)}</td><td>${fmt(r.principal)}</td><td>${fmt(r.interest)}</td><td>${fmtSigned(r.taxReturn)}</td><td>${fmt(r.net)}</td><td>${fmt(r.extra)}</td>`;body.appendChild(tr)});
  }
  function renderMortgageCompare(result){
    function card(el,x,label,type){if(!el)return;const active=result.type===type;el.className='compare-card selectable'+(active?' active':'');el.setAttribute('aria-pressed',active?'true':'false');el.innerHTML=`<h3>${label}</h3><p class="tag ${active?'selected-tag':''}">${active?'Used in combined plan & schedule':'Click to use this method'}</p><div class="metric"><span>First scheduled payment</span><strong>${fmt(x.firstScheduled)}</strong></div><div class="metric"><span>Gross scheduled paid</span><strong>${fmt(x.totalScheduledPaid)}</strong></div><div class="metric"><span>Gross interest</span><strong>${fmt(x.totalInterest)}</strong></div><div class="metric"><span>Estimated tax benefit</span><strong>${fmtSigned(x.totalTaxBenefit)}</strong></div><div class="metric"><span>Extra repayments</span><strong>${fmt(x.totalExtra)}</strong></div><div class="metric"><span>End balance</span><strong>${fmt(x.balance)}</strong></div>`;}
    card($('linearCompare'),result.linear,'Linear mortgage','linear');card($('annuityCompare'),result.annuity,'Annuity mortgage','annuity');
  }
  function updateMortgageReporting(){
    const r=mortgageReport();if(!r)return;
    const yearField=$('mortgageReportYearField');if(yearField)yearField.classList.toggle('hidden',r.mode!=='year');
    const start=scheduleDate(r.startYear,r.startMonth,0),end=scheduleDate(r.startYear,r.startMonth,r.months-1),period=`${start.label} – ${end.label}`;
    let box=$('mortgageSummaryPeriod');if(!box&&$('mortgageHorizonControls')){box=document.createElement('div');box.id='mortgageSummaryPeriod';box.className='callout ux-period';$('mortgageHorizonControls').insertAdjacentElement('afterend',box);}
    const modeLabel=r.mode==='mortgage'?'end of mortgage term':r.mode==='year'?`through ${r.specificYear}`:'end of investment plan';
    if(box)box.innerHTML=`<strong>Mortgage summary: ${period} (${modeLabel}).</strong><br><span>This selector changes the Mortgage tab totals and payment schedule only. Your Investment phases and Scenario comparison horizons stay independent.</span>`;
    $('mGrossInterest').textContent=fmt(r.selected.totalInterest);$('mTaxBenefit').textContent=fmtSigned(r.selected.totalTaxBenefit);$('mNetInterest').textContent=fmt(r.selected.totalInterest-r.selected.totalTaxBenefit);
    const gross=$('mGrossInterest')?.closest('.summary-item'),tax=$('mTaxBenefit')?.closest('.summary-item'),net=$('mNetInterest')?.closest('.summary-item'),pay=$('mPayoff')?.closest('.summary-item');
    if(gross?.querySelector('.s'))gross.querySelector('.s').textContent=period;if(tax?.querySelector('.s'))tax.querySelector('.s').textContent=`${period} · annual HRA/EWF/Hillen`;if(net?.querySelector('.s'))net.querySelector('.s').textContent=period;
    if(r.selected.payoffMonthIndex!=null){const p=scheduleDate(r.startYear,r.startMonth,r.selected.payoffMonthIndex);if(pay?.querySelector('.k'))pay.querySelector('.k').textContent='Mortgage payoff';$('mPayoff').textContent=p.label;$('mPayoffSub').textContent='including selected extra repayments';}
    else{if(pay?.querySelector('.k'))pay.querySelector('.k').textContent=`Mortgage status at ${end.label}`;$('mPayoff').textContent='Not yet';$('mPayoffSub').textContent='remaining '+fmt(r.selected.balance);}
    renderMortgageSchedule(r.selected.rows);renderMortgageCompare(r);
  }

  function reframeNextEuro(){const card=$('nextEuroCard'),engine=$('decisionEngine'),mode=$('comparisonType')?.value;if(!card||!engine)return;const builder=engine.querySelector('.scenario-builder');if(builder&&card.previousElementSibling!==builder)builder.insertAdjacentElement('afterend',card);card.classList.toggle('hidden',mode!=='mortgage-invest');const label=card.querySelector('.section-label'),note=card.querySelector('.section-note');if(label)label.textContent='Extra cash: invest or repay?';if(note)note.textContent='If you have money left each month, this compares putting the same amount into investments versus making an extra mortgage repayment. The break-even return is the annual investment return needed for both choices to end with the same modeled wealth.';[['nextEuroAmount','Extra money available each month'],['nextEuroYears','Compare for, years'],['nextEuroReturn','Expected investment return %']].forEach(([id,text])=>{const l=document.querySelector(`label[for="${id}"]`);if(l)l.textContent=text;});const items=card.querySelectorAll('.summary-item .k');if(items[0])items[0].textContent='Investment return needed to tie';if(items[1])items[1].textContent='Higher modeled wealth at your return';if(items[2])items[2].textContent='Difference after selected period';}
  function scenarioAssumptions(){const mode=$('comparisonType')?.value;if(!mode)return;const relevance={'scenarioMortgageMethodNew':['buy-rent','downpayment','mortgage-invest','sell-rent'],'scenarioUpfrontCashTreatmentNew':['buy-rent','downpayment'],'scenarioHomeGrowthNew':['buy-rent','downpayment','sell-rent'],'scenarioRentGrowthNew':['buy-rent','sell-rent'],'scenarioSellingCostNew':['buy-rent','downpayment','sell-rent'],'scenarioVveNew':['buy-rent','downpayment','mortgage-invest','linear-annuity','sell-rent'],'scenarioMaintenanceNew':['buy-rent','downpayment','mortgage-invest','linear-annuity','sell-rent'],'scenarioOwnerTaxesNew':['buy-rent','downpayment','mortgage-invest','linear-annuity','sell-rent'],'scenarioInsuranceNew':['buy-rent','downpayment','mortgage-invest','linear-annuity','sell-rent'],'scenarioGroundLeaseNew':['buy-rent','downpayment','mortgage-invest','linear-annuity','sell-rent']};Object.entries(relevance).forEach(([id,modes])=>$(id)?.closest('.field')?.classList.toggle('hidden',!modes.includes(mode)));const shared=$('scenarioMonthlyBudgetNew')?.closest('.card'),head=shared?.querySelector('.section-head .section-note');if(head)head.textContent='Only assumptions used by the selected comparison are shown. Owner-only costs remain visible where they affect the affordability check.';const builder=document.querySelector('#decisionEngine .scenario-builder .section-note');if(builder)builder.textContent='Choose one decision. Purchase comparisons use the Savings / cash balance in Investment, so spending cash changes later Box 3.';const cashNote=$('scenarioCashSourceNoteNew');if(cashNote)cashNote.innerHTML=cashNote.innerHTML.replace('Investment → Household financial balances','Investment → Savings / cash');}
  function reframeComparableWealth(){const mode=$('comparisonType')?.value,resultA=$('strategyAResultNew'),resultB=$('strategyBResultNew');if(!resultA||!resultB)return;if(mode==='linear-annuity'||mode==='mortgage-invest'){[resultA,resultB].forEach(card=>{const lab=card.querySelector('.strategy-label-new');if(lab)lab.textContent='Net position excluding the home*';});const resultCard=resultA.closest('.card'),sectionNote=resultCard?.querySelector('.section-head .section-note');if(sectionNote)sectionNote.textContent='For this decision, the home is the same on both sides and is excluded. Net position = investments + savings − Box 3 debt − remaining mortgage.';let expl=$('uxPositionExplanation');if(!expl&&$('scenarioVerdictNew')){expl=document.createElement('div');expl.id='uxPositionExplanation';expl.className='callout ux-position-note';$('scenarioVerdictNew').insertAdjacentElement('afterend',expl);}if(expl){expl.classList.remove('hidden');expl.innerHTML=mode==='linear-annuity'?'<strong>Why can Annuity show higher modeled wealth with a larger mortgage balance?</strong><br><span>An annuity mortgage usually has a lower monthly payment early on. The model invests that payment difference. Under the entered assumptions, a larger investment portfolio can outweigh the extra mortgage debt.</span>':'<strong>How this comparison works:</strong><br><span>The same extra monthly amount either reduces mortgage principal or is invested. Modeled wealth is investments + savings − other debt − remaining mortgage, with the common home value excluded.</span>';}}else{const expl=$('uxPositionExplanation');if(expl)expl.classList.add('hidden');}}

  let uxRefreshing=false;
  function refreshUx(){
    if(uxRefreshing)return;
    uxRefreshing=true;
    try{simplifyHousehold();simplifyPhasesToMonthly();explainIncomeAndDeduction();scenarioAssumptions();reframeNextEuro();reframeComparableWealth();updateMortgageReporting();}
    finally{uxRefreshing=false;}
  }

  prepareRound2Controls();prepareAllNumberInputs();
  const numberObserver=new MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(n=>{if(n.nodeType===1)prepareAllNumberInputs(n)})));numberObserver.observe(document.body,{childList:true,subtree:true});
  document.addEventListener('input',e=>{const el=e.target;if(el?.dataset?.flexNumber==='1'&&String(el.value).includes(','))el.value=normalizeDecimalString(el.value);},true);
  document.addEventListener('input',e=>{if(isPersistable(e.target))save();refreshUx();});
  document.addEventListener('change',e=>{if(isPersistable(e.target))save();refreshUx();});
  document.addEventListener('blur',e=>{const el=e.target;if(el?.dataset?.flexNumber!=='1')return;const min=parseFlexibleNumber(el.dataset.flexMin),max=parseFlexibleNumber(el.dataset.flexMax),n=clampFlexibleValue(el.value,min,max);if(n!==null)el.value=String(n);refreshUx();},true);
  document.querySelectorAll('.tab[data-tab],.compare-card[data-mort-type]').forEach(el=>el.addEventListener('click',()=>{if(!restoring)save();refreshUx()}));
  $('plannerReset')?.addEventListener('click',()=>{if(window.confirm('Reset all planner inputs to the illustrative examples?')){safeRemove();window.location.reload();}});

  restore();refreshUx();
  const uxTargetIds=['phaseList','strategyAResultNew','strategyBResultNew','scenarioVerdictNew'];
  let uxObserver=null,uxObserverQueued=false;
  function observeUxTargets(){
    if(!uxObserver)return;
    uxTargetIds.forEach(id=>{const el=$(id);if(el)uxObserver.observe(el,{childList:true,subtree:true});});
  }
  function refreshUxFromMutation(){
    if(uxObserverQueued)return;
    uxObserverQueued=true;
    const run=()=>{
      uxObserverQueued=false;
      uxObserver.disconnect();
      try{refreshUx();}
      finally{observeUxTargets();}
    };
    if(typeof requestAnimationFrame==='function')requestAnimationFrame(run);else setTimeout(run,0);
  }
  uxObserver=new MutationObserver(refreshUxFromMutation);
  observeUxTargets();
}

return{STORAGE_KEY,SCHEMA_VERSION,controlKey,isPersistable,captureControls,normalizePayload,applyEntry,normalizeDecimalString,parseFlexibleNumber,clampFlexibleValue,estimateTaxableIncome2026,monthlyEquivalentExtra,mortgageReportingMonths,bootBrowser};
});

if(typeof window!=='undefined'&&window.document)window.PlannerState.bootBrowser();
