(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.ViewDensityState=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';

const LATE_CONTROL_IDS=[
  'hillenOverrideEnabled','hillenOverridePct',
  'scenarioBuyWozNew','scenarioDpWozNew','scenarioSellWozNew',
  'nextEuroHraTreatment','nextEuroBox3Treatment'
];

function restoreEntry(el,entry){
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

function readPayload(storage,key){
  try{
    const raw=storage?.getItem?.(key);
    if(!raw)return null;
    const parsed=JSON.parse(raw);
    return parsed&&typeof parsed==='object'&&parsed.controls&&typeof parsed.controls==='object'?parsed:null;
  }catch(_error){return null;}
}

function applyNextEuroTaxTreatment(config={},hraTreatment='planner',box3Treatment='planner'){
  const next={
    ...config,
    tax:{...(config.tax||{})},
    box3:{...(config.box3||{})}
  };
  if(hraTreatment==='on')next.tax.enabled=true;
  else if(hraTreatment==='off')next.tax.enabled=false;
  if(box3Treatment==='current')next.box3.mode='current';
  else if(box3Treatment==='none')next.box3.mode='none';
  return next;
}

function box3MethodLabel(bucket={}){
  const method=String(bucket.method||'').trim();
  if(bucket.estimable===false||/not estimable/i.test(method))return'Not estimable';
  const unsettled=bucket.settled===false||/unsettled/i.test(method);
  let label='—';
  if(/actual-return rebuttal/i.test(method))label='Tegenbewijs / actual return';
  else if(/deemed return/i.test(method))label=/incomplete/i.test(method)?'Deemed return · incomplete year':'Deemed return';
  else if(/proposed actual return/i.test(method))label='Proposed actual return';
  else if(bucket.regime==='none'||/no box 3/i.test(method))label='No Box 3';
  else if(method)label=method.replace(/^unsettled estimate\s*[·,:-]?\s*/i,'');
  return unsettled&&label!=='Not estimable'?`Unsettled · ${label}`:label;
}

function bootBrowser(){
  if(typeof window==='undefined'||typeof document==='undefined')return;
  const $=id=>document.getElementById(id);
  const state=window.PlannerState;
  const key=state?.STORAGE_KEY||'dutch-investment-mortgage-planner:r6';
  const payload=readPayload(window.localStorage,key);
  let latestMainPlan=null;
  let refreshQueued=false;

  function near(a,b,tolerance=1e-9){return Math.abs((Number(a)||0)-(Number(b)||0))<=tolerance;}
  function fireInput(el){el?.dispatchEvent(new Event('input',{bubbles:true}));}
  function selectedMortgageType(){return document.querySelector('.compare-card.active[data-mort-type]')?.dataset.mortType||'annuity';}
  function isMainPlanConfig(config={}){
    if(!Array.isArray(config.phases)||!config.phases.length)return false;
    const count=Math.max(1,Number($('phaseCount')?.value)||3);
    const mode=$('box3Mode')?.value||'none';
    const annualReturn=Number($('annualReturn')?.value)||0;
    if(config.phases.length!==count)return false;
    if((config.box3Mode||'none')!==mode)return false;
    if(!near(config.annualReturnPct,annualReturn,1e-7))return false;
    if(config.mortType&&config.mortType!==selectedMortgageType())return false;
    return true;
  }

  function ensureNextEuroControls(){
    const card=$('nextEuroCard');
    if(!card||$('nextEuroTaxTreatmentControls'))return;
    const block=document.createElement('div');
    block.id='nextEuroTaxTreatmentControls';
    block.className='grid2 advanced-grid density-advanced-only';
    block.innerHTML=`
      <div class="field"><label for="nextEuroHraTreatment">Next € mortgage-interest relief</label><select id="nextEuroHraTreatment"><option value="planner" selected>Use planner setting</option><option value="on">Include HRA</option><option value="off">Ignore HRA</option></select><p class="inline">Affects the Next € calculation only. It does not rewrite the Mortgage tab.</p></div>
      <div class="field"><label for="nextEuroBox3Treatment">Next € Box 3 treatment</label><select id="nextEuroBox3Treatment"><option value="planner" selected>Use planner setting</option><option value="current">Use 2026 current rules</option><option value="none">Ignore Box 3</option></select><p class="inline">Use this to compare the break-even with and without modeled Box 3.</p></div>`;
    const summary=card.querySelector('.next-euro-summary');
    if(summary)summary.insertAdjacentElement('beforebegin',block);else card.appendChild(block);
  }

  function decorateNextEuro(){
    const NE=window.NextEuroCore;
    if(!NE||NE.__viewDensityTaxTreatmentDecorated)return;
    const original=NE.analyseNextEuro.bind(NE);
    NE.analyseNextEuro=function(baseConfig={},options={}){
      const hra=$('nextEuroHraTreatment')?.value||'planner';
      const box3=$('nextEuroBox3Treatment')?.value||'planner';
      return original(applyNextEuroTaxTreatment(baseConfig,hra,box3),options);
    };
    Object.defineProperty(NE,'__viewDensityTaxTreatmentDecorated',{value:true,enumerable:false});
  }

  function decorateFinanceCapture(){
    const FC=window.FinanceCore;
    if(!FC||FC.__viewDensityAuditCaptureDecorated)return;
    const original=FC.simulatePlan.bind(FC);
    FC.simulatePlan=function(config={}){
      const result=original(config);
      if(isMainPlanConfig(config)){
        latestMainPlan=result;
        queueRefresh();
      }
      return result;
    };
    Object.defineProperty(FC,'__viewDensityAuditCaptureDecorated',{value:true,enumerable:false});
  }

  function ensureMethodColumn(){
    const body=$('box3YearBody');
    const table=body?.closest('table');
    const header=table?.querySelector('thead tr');
    if(!body||!header)return;
    if(!header.querySelector('[data-density-method-head]')){
      const th=document.createElement('th');
      th.dataset.densityMethodHead='';
      th.textContent='Method';
      header.insertBefore(th,header.children[2]||null);
    }
    const buckets=Object.values(latestMainPlan?.yearBuckets||{}).sort((a,b)=>(Number(a.year)||0)-(Number(b.year)||0));
    Array.from(body.rows).forEach((row,index)=>{
      let cell=row.querySelector('[data-density-method-cell]');
      if(!cell){
        cell=document.createElement('td');
        cell.dataset.densityMethodCell='';
        row.insertBefore(cell,row.children[2]||null);
      }
      cell.textContent=buckets[index]?box3MethodLabel(buckets[index]):'—';
    });
  }

  function restoreLateControls(){
    if(!payload)return false;
    let restored=false;
    LATE_CONTROL_IDS.forEach(id=>{
      const el=$(id);
      const entry=payload.controls[`id:${id}`];
      if(!el||!entry)return;
      restored=restoreEntry(el,entry)||restored;
    });
    const hillenEnabled=$('hillenOverrideEnabled');
    const hillenRate=$('hillenOverridePct');
    if(hillenRate)hillenRate.disabled=!hillenEnabled?.checked;
    return restored;
  }

  function syncTaxTreatmentChips(){
    const summary=$('advancedStateSummary');
    const list=summary?.querySelector('[data-density-chips]');
    if(!summary||!list)return;
    list.querySelectorAll('[data-density-state-chip]').forEach(el=>el.remove());
    const chips=[];
    const hra=$('nextEuroHraTreatment')?.value||'planner';
    const box3=$('nextEuroBox3Treatment')?.value||'planner';
    if(hra!=='planner')chips.push(`Next € HRA: ${hra==='on'?'included':'ignored'}`);
    if(box3!=='planner')chips.push(`Next € Box 3: ${box3==='current'?'2026 current rules':'ignored'}`);
    if(!chips.length)return;
    chips.forEach(label=>{
      const chip=document.createElement('span');
      chip.className='density-chip';
      chip.dataset.densityStateChip='';
      chip.textContent=label;
      list.appendChild(chip);
    });
    if(document.documentElement.dataset.viewDensity==='standard')summary.classList.remove('hidden');
  }

  function setModelMarker(){
    const meta=window.MODEL_META;
    const marker=$('modelVersion');
    if(meta&&marker)marker.textContent=`Calculation build ${meta.version} · ${meta.ruleYear} rules · updated 2 Sep 2026`;
  }

  function refresh(){
    ensureMethodColumn();
    syncTaxTreatmentChips();
    setModelMarker();
  }
  function queueRefresh(){
    if(refreshQueued)return;
    refreshQueued=true;
    requestAnimationFrame(()=>{
      refreshQueued=false;
      refresh();
    });
  }

  ensureNextEuroControls();
  decorateNextEuro();
  decorateFinanceCapture();
  const restored=restoreLateControls();

  document.addEventListener('input',queueRefresh);
  document.addEventListener('change',queueRefresh);
  window.addEventListener('load',refresh,{once:true});

  fireInput($('annualReturn'));
  if(restored||$('nextEuroTaxTreatmentControls'))fireInput($('nextEuroAmount'));
  queueRefresh();
}

return{
  LATE_CONTROL_IDS,
  restoreEntry,
  readPayload,
  applyNextEuroTaxTreatment,
  box3MethodLabel,
  bootBrowser
};
});

if(typeof window!=='undefined'&&window.document)window.ViewDensityState.bootBrowser();
