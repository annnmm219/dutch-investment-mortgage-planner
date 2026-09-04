(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.Stage91Quality=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';

const VERSION='R6.6-stage9.1-quality';
const MORTGAGE_TYPE_KEY='dimp.stage91.main-mortgage-type.v1';

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

function installMortgageTypePersistence(){
  if(typeof document==='undefined')return;
  const cards=Array.from(document.querySelectorAll('.compare-card[data-mort-type]'));
  if(!cards.length)return;
  const write=type=>{const normalized=normalizeMortgageType(type);if(!normalized)return;try{localStorage.setItem(MORTGAGE_TYPE_KEY,normalized);}catch(_error){}};
  cards.forEach(card=>card.addEventListener('click',()=>write(card.dataset.mortType)));
  document.getElementById('plannerReset')?.addEventListener('click',()=>{try{localStorage.removeItem(MORTGAGE_TYPE_KEY);}catch(_error){}},{capture:true});
  let saved=null;try{saved=normalizeMortgageType(localStorage.getItem(MORTGAGE_TYPE_KEY));}catch(_error){}
  if(!saved)return;
  const active=normalizeMortgageType(document.querySelector('.compare-card.active[data-mort-type]')?.dataset.mortType);
  if(active===saved)return;
  const target=document.querySelector(`.compare-card[data-mort-type="${saved}"]`);
  if(target)requestAnimationFrame(()=>target.click());
}

function bootBrowser(){
  if(typeof document==='undefined')return;
  patchOutputIntegrity();
  installMortgageTypePersistence();
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
return{VERSION,MORTGAGE_TYPE_KEY,spreadsheetSafe,csvEscape,rowsToCsv,normalizeMortgageType,patchOutputIntegrity,installMortgageTypePersistence,bootBrowser};
});
