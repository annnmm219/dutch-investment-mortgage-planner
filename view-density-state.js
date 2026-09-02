(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.ViewDensityState=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';

const LATE_CONTROL_IDS=[
  'hillenOverrideEnabled','hillenOverridePct',
  'scenarioBuyWozNew','scenarioDpWozNew','scenarioSellWozNew',
  'nextEuroHraTreatment','nextEuroBox3Treatment',
  'scenarioReturnOverrideEnabled'
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
  function fire(el){
    el?.dispatchEvent(new Event('input',{bubbles:true}));
    el?.dispatchEvent(new Event('change',{bubbles:true}));
  }
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
    const details=document.createElement('details');
    details.id='nextEuroTaxTreatmentDetails';
    details.className='inner-fold r65-local-fold';
    details.innerHTML=`
      <summary>Advanced Next € assumptions</summary>
      <div class="inner-fold-body">
        <div id="nextEuroTaxTreatmentControls" class="grid2 advanced-grid">
          <div class="field"><label for="nextEuroHraTreatment">Mortgage-interest relief</label><select id="nextEuroHraTreatment"><option value="planner" selected>Use planner setting</option><option value="on">Include HRA</option><option value="off">Ignore HRA</option></select><p class="inline">Changes this break-even calculation only.</p></div>
          <div class="field"><label for="nextEuroBox3Treatment">Box 3 treatment</label><select id="nextEuroBox3Treatment"><option value="planner" selected>Use planner setting</option><option value="current">Use 2026 current rules</option><option value="none">Ignore Box 3</option></select><p class="inline">Changes this break-even calculation only.</p></div>
        </div>
      </div>`;
    const summary=card.querySelector('.next-euro-summary');
    if(summary)summary.insertAdjacentElement('beforebegin',details);else card.appendChild(details);
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
    if(!payload)return[];
    const restored=[];
    LATE_CONTROL_IDS.forEach(id=>{
      const el=$(id);
      const entry=payload.controls[`id:${id}`];
      if(el&&entry&&restoreEntry(el,entry))restored.push(el);
    });
    const hillenEnabled=$('hillenOverrideEnabled');
    const hillenRate=$('hillenOverridePct');
    if(hillenRate)hillenRate.disabled=!hillenEnabled?.checked;
    return restored;
  }

  function setModelMarker(){
    const meta=window.MODEL_META;
    const marker=$('modelVersion');
    if(meta&&marker)marker.textContent=window.OutputIntegrity?.releaseLabel?.(meta)||`Calculation build ${meta.version} · ${meta.ruleYear} rules`;
  }

  function refresh(){
    ensureMethodColumn();
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

  restored.forEach(fire);
  document.addEventListener('input',queueRefresh);
  document.addEventListener('change',queueRefresh);
  window.addEventListener('load',refresh,{once:true});

  fire($('annualReturn'));
  if(restored.length||$('nextEuroTaxTreatmentControls'))fire($('nextEuroAmount'));
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
