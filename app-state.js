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
  style.textContent=`.planner-storage-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;background:var(--surface);border:.5px solid var(--border);border-radius:var(--radius);padding:10px 13px;margin:-5px 0 14px;font-size:11px;color:var(--muted)}.planner-storage-actions{display:flex;align-items:center;gap:9px}.planner-reset{border:.5px solid var(--border2);border-radius:var(--small);background:var(--alt);color:var(--secondary);font:inherit;font-size:11px;padding:7px 10px;cursor:pointer}.planner-reset:hover{color:var(--text)}.r6-methodology{margin-bottom:10px}`;
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
  if(marker)marker.textContent='Calculation build R6 · 2026 rules · updated 1 Sep 2026';

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

  document.addEventListener('input',e=>{if(isPersistable(e.target))save()});
  document.addEventListener('change',e=>{if(isPersistable(e.target))save()});
  document.querySelectorAll('.tab[data-tab],.compare-card[data-mort-type]').forEach(el=>el.addEventListener('click',()=>{if(!restoring)save()}));
  document.getElementById('plannerReset')?.addEventListener('click',()=>{
    if(window.confirm('Reset all planner inputs to the illustrative examples?')){
      safeRemove();
      window.location.reload();
    }
  });

  restore();
}

return{STORAGE_KEY,SCHEMA_VERSION,controlKey,isPersistable,captureControls,normalizePayload,applyEntry,bootBrowser};
});

if(typeof window!=='undefined'&&window.document)window.PlannerState.bootBrowser();
