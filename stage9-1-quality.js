(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.Stage91Quality=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';

const VERSION='R6.6-stage9.1-quality';
const MORTGAGE_TYPE_KEY='dimp.stage91.main-mortgage-type.v1';
const PLANNER_STATE_KEY='dutch-investment-mortgage-planner:r6';

function spreadsheetSafe(value){
  if(value===null||value===undefined)return'';
  if(typeof value==='number'||typeof value==='boolean')return String(value);
  const text=String(value);
  return /^[\s\t\r\n]*[=+\-@]/.test(text)?`'${text}`:text;
}
function csvEscape(value){
  const text=spreadsheetSafe(value);
  return /[",\n\r]/.test(text)?`"${text.replace(/"/g,'""')}"`:text;
}
function rowsToCsv(rows=[]){return rows.map(row=>Array.from(row||[],csvEscape).join(',')).join('\r\n');}
function normalizeMortgageType(value){return value==='linear'?'linear':value==='annuity'?'annuity':null;}
function manualRateActive(treatment){return treatment==='manual';}
function authoritativeImportedMortgageType(sourceMode,mode,persisted,resolvedType){
  if(sourceMode!=='imported'||mode==='buy-rent'||mode==='downpayment')return normalizeMortgageType(resolvedType);
  return normalizeMortgageType(persisted)||normalizeMortgageType(resolvedType);
}
function readPersistedMortgageType(){
  if(typeof localStorage==='undefined')return null;
  try{
    const stable=normalizeMortgageType(localStorage.getItem(MORTGAGE_TYPE_KEY));if(stable)return stable;
    const planner=JSON.parse(localStorage.getItem(PLANNER_STATE_KEY)||'null');return normalizeMortgageType(planner?.meta?.mortgageType);
  }catch(_error){return null;}
}

function patchOutputIntegrity(){
  const OI=root?.OutputIntegrity;
  if(!OI||OI.__stage91CsvSafe)return;
  OI.csvEscape=csvEscape;
  OI.outputCsv=function(model,extraRows=[]){
    const rows=Array.isArray(model)?model:model?.exportRows;
    if(!Array.isArray(rows))throw new TypeError('outputCsv requires an output model or export rows');
    return rowsToCsv([['Section','Assumption','Value'],...rows,...extraRows]);
  };
  Object.defineProperty(OI,'__stage91CsvSafe',{value:true,enumerable:false});
}

function installScenarioSourceAuthority(){
  const SC=root?.ScenarioCore;if(!SC||SC.__stage91MortgageSourceAuthority)return;
  const original=SC.resolveScenarioInputSource.bind(SC);
  SC.resolveScenarioInputSource=function(args={}){
    const resolved=original(args),type=authoritativeImportedMortgageType(args.sourceMode,resolved.mode,readPersistedMortgageType(),resolved.mortgageType);
    if(type&&args.sourceMode==='imported'&&resolved.mode!=='buy-rent'&&resolved.mode!=='downpayment')resolved.mortgageType=type;
    return resolved;
  };
  Object.defineProperty(SC,'__stage91MortgageSourceAuthority',{value:true,enumerable:false});
}

function installMortgageTypePersistence(){
  if(typeof document==='undefined')return;
  const cards=Array.from(document.querySelectorAll('.compare-card[data-mort-type]'));
  if(!cards.length)return;
  let syncing=false;
  const activeType=()=>normalizeMortgageType(document.querySelector('.compare-card.active[data-mort-type]')?.dataset.mortType);
  const read=()=>readPersistedMortgageType();
  const write=type=>{const normalized=normalizeMortgageType(type);if(!normalized)return null;try{localStorage.setItem(MORTGAGE_TYPE_KEY,normalized);}catch(_error){}return normalized;};
  const desired=()=>read()||activeType();
  const restore=()=>{
    const saved=desired();if(!saved)return null;
    try{if(!normalizeMortgageType(localStorage.getItem(MORTGAGE_TYPE_KEY)))write(saved);}catch(_error){}
    const active=activeType();if(active===saved)return saved;
    const target=document.querySelector(`.compare-card[data-mort-type="${saved}"]`);
    if(target&&!syncing){syncing=true;try{target.click();}finally{syncing=false;}}
    return saved;
  };
  const imported=()=>document.querySelector('input[name="scenarioDataSource"]:checked')?.value==='imported';
  const enforceImported=()=>{
    if(!imported())return null;
    const type=restore();if(!type)return null;
    const field=document.getElementById('scenarioMortgageMethodFresh');
    if(field&&field.value!==type){field.value=type;field.dispatchEvent(new Event('change',{bubbles:true}));}
    return type;
  };
  cards.forEach(card=>card.addEventListener('click',()=>{if(!syncing)write(card.dataset.mortType);}));
  document.getElementById('plannerReset')?.addEventListener('click',()=>{try{localStorage.removeItem(MORTGAGE_TYPE_KEY);}catch(_error){}},{capture:true});
  const refresh=document.getElementById('scenarioRefreshImport'),source=document.getElementById('scenarioSourceImported');
  refresh?.addEventListener('click',restore,{capture:true});
  refresh?.addEventListener('click',()=>queueMicrotask(enforceImported));
  source?.addEventListener('click',restore,{capture:true});
  source?.addEventListener('change',()=>queueMicrotask(enforceImported));
  document.querySelectorAll('input[name="scenarioDataSource"]').forEach(el=>el.addEventListener('change',event=>{if(event.target?.value==='imported'){restore();queueMicrotask(enforceImported);}},{capture:true}));
  const observer=new MutationObserver(()=>{if(!syncing&&read()&&activeType()!==read())queueMicrotask(restore);});
  cards.forEach(card=>observer.observe(card,{attributes:true,attributeFilter:['class','aria-pressed']}));
  restore();queueMicrotask(enforceImported);
}

function installScenarioConditionalControls(){
  if(typeof document==='undefined')return;
  const treatment=document.getElementById('scenarioTaxTreatmentFresh'),manual=document.getElementById('scenarioManualDeductionFresh');
  if(!treatment||!manual)return;
  const field=manual.closest('.field');
  const sync=()=>{manual.disabled=false;field?.classList.toggle('hidden',!manualRateActive(treatment.value));};
  treatment.addEventListener('input',sync);treatment.addEventListener('change',sync);
  document.querySelectorAll('input[name="scenarioDataSource"]').forEach(el=>el.addEventListener('change',()=>queueMicrotask(sync)));
  document.getElementById('scenarioRefreshImport')?.addEventListener('click',()=>queueMicrotask(sync));
  sync();
}

function bootBrowser(){
  if(typeof document==='undefined')return;
  patchOutputIntegrity();
  installScenarioSourceAuthority();
  installMortgageTypePersistence();
  installScenarioConditionalControls();
  const $=id=>document.getElementById(id);
  const style=document.createElement('style');
  style.id='stage91QualityStyle';
  style.textContent=`:root{--muted:#66665f}@media(prefers-color-scheme:dark){:root{--muted:#b8b8b1}}.stage91-chart-table{margin-top:12px}.stage91-chart-table table{min-width:620px}.stage91-chart-table tbody td{font-variant-numeric:tabular-nums}.stage91-chart-table .table-wrap{max-height:360px}`;
  document.head.appendChild(style);

  function labelFor(el){
    if(el?.id){const label=document.querySelector(`label[for="${CSS.escape(el.id)}"]`);if(label)return String(label.textContent||el.id).trim();}
    if(el?.dataset?.field)return`Phase ${Number(el.dataset.i||0)+1} · ${el.dataset.field}`;
    return el?.id||el?.name||'Control';
  }
  function exportRows(){
    const rows=[['Model','Version',root.MODEL_META?.version||'R6.6'],['Model','Rule year',root.MODEL_META?.ruleYear||2026],['Model','Generated',new Date().toISOString()]],seen=new Set();
    document.querySelectorAll('input,select').forEach(el=>{
      if(el.type==='hidden'||el.disabled)return;
      const key=el.id||`${el.dataset?.i||''}:${el.dataset?.field||''}:${el.name||''}`;
      if(!key||seen.has(key))return;seen.add(key);
      const value=(el.type==='checkbox'||el.type==='radio')?(el.checked?'Yes':'No'):(el.selectedOptions?.[0]?.textContent||el.value);
      rows.push([el.closest('.panel')?.id?.replace('tab-','')||'Planner',labelFor(el),value]);
    });
    const canonical=root.OutputIntegrity?.canonicalExportRows?.({plan:root.__DIMP_CANONICAL_RESULT,comparison:root.__DIMP_CANONICAL_COMPARISON,nextEuro:root.__DIMP_CANONICAL_NEXT_EURO})||[];
    canonical.forEach(row=>rows.push(row));
    return rows;
  }
  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('#exportAssumptionsCsv');if(!button)return;
    event.preventDefault();event.stopImmediatePropagation();
    const csv='\uFEFF'+rowsToCsv(exportRows()),blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=`dutch-investment-mortgage-plan-${root.MODEL_META?.version||'R6.6'}-${new Date().toISOString().slice(0,10)}.csv`;document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
  },true);

  function ensureChartTable(){
    const canvas=$('mainChart'),wrap=canvas?.closest('.chart-wrap');if(!canvas||!wrap||$('stage91ChartTable'))return;
    const details=document.createElement('details');details.id='stage91ChartTable';details.className='inner-fold stage91-chart-table';
    details.innerHTML='<summary>Table alternative for investment and mortgage chart</summary><div class="inner-fold-body"><p class="subsection-copy">The same modeled timeline shown in the chart, available as text.</p><div class="table-wrap"><table><thead><tr><th>Date</th><th>Investment portfolio</th><th>Mortgage balance</th><th>Total invested</th></tr></thead><tbody id="stage91ChartTableBody"></tbody></table></div></div>';
    wrap.insertAdjacentElement('afterend',details);canvas.setAttribute('aria-describedby','stage91ChartTable');
  }
  function money(value){const n=Number(value);return Number.isFinite(n)?'€'+Math.round(n).toLocaleString('nl-NL'):'—';}
  function renderChartTable(){
    ensureChartTable();const body=$('stage91ChartTableBody');if(!body)return;body.innerHTML='';const series=root.__DIMP_CANONICAL_RESULT?.series||[];
    if(!series.length){const tr=document.createElement('tr');tr.innerHTML='<td colspan="4">Timeline unavailable until the plan inputs are valid.</td>';body.appendChild(tr);return;}
    const frag=document.createDocumentFragment();series.forEach(row=>{const tr=document.createElement('tr'),date=Number.isFinite(Number(row.year))?`${String(row.month||'').padStart(2,'0')}/${row.year}`:'—';tr.innerHTML=`<td>${date}</td><td>${money(row.portfolio)}</td><td>${money(row.mortgage)}</td><td>${money(row.invested)}</td>`;frag.appendChild(tr);});body.appendChild(frag);
  }
  let queued=false;function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;renderChartTable();});}
  ensureChartTable();renderChartTable();document.addEventListener('input',queue);document.addEventListener('change',queue);window.addEventListener('load',queue,{once:true});
}

if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootBrowser,{once:true});else bootBrowser();}else patchOutputIntegrity();
return{VERSION,MORTGAGE_TYPE_KEY,PLANNER_STATE_KEY,spreadsheetSafe,csvEscape,rowsToCsv,normalizeMortgageType,manualRateActive,authoritativeImportedMortgageType,readPersistedMortgageType,patchOutputIntegrity,installScenarioSourceAuthority,installMortgageTypePersistence,installScenarioConditionalControls,bootBrowser};
});
