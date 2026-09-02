(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.ViewDensityState=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';

const LATE_CONTROL_IDS=['hillenOverrideEnabled','hillenOverridePct','scenarioBuyWozNew','scenarioDpWozNew','scenarioSellWozNew'];

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

function bootBrowser(){
  if(typeof window==='undefined'||typeof document==='undefined')return;
  const state=window.PlannerState;
  const key=state?.STORAGE_KEY||'dutch-investment-mortgage-planner:r6';
  const payload=readPayload(window.localStorage,key);
  if(!payload)return;

  let restored=false;
  LATE_CONTROL_IDS.forEach(id=>{
    const el=document.getElementById(id);
    const entry=payload.controls[`id:${id}`];
    if(!el||!entry)return;
    restored=restoreEntry(el,entry)||restored;
  });

  const hillenEnabled=document.getElementById('hillenOverrideEnabled');
  const hillenRate=document.getElementById('hillenOverridePct');
  if(hillenRate)hillenRate.disabled=!hillenEnabled?.checked;

  if(restored){
    const trigger=document.getElementById('annualReturn')||document.getElementById('scenarioReturnNew');
    trigger?.dispatchEvent(new Event('input',{bubbles:true}));
    trigger?.dispatchEvent(new Event('change',{bubbles:true}));
  }

  const meta=window.MODEL_META;
  const marker=document.getElementById('modelVersion');
  if(meta&&marker)marker.textContent=`Calculation build ${meta.version} · ${meta.ruleYear} rules · updated 2 Sep 2026`;
}

return{LATE_CONTROL_IDS,restoreEntry,readPayload,bootBrowser};
});

if(typeof window!=='undefined'&&window.document)window.ViewDensityState.bootBrowser();
