(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.InputIntegrity=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';

const OPTIONAL_IDS=new Set([
  'firstJan1Portfolio','firstJan1Savings','firstJan1Debt',
  'scenarioPurchaseAppraisedValueNew','scenarioBuyWozNew','scenarioDpWozNew'
]);

function parseFinite(value){
  if(value===null||value===undefined||String(value).trim()==='')return{valid:false,code:'required',value:null};
  const number=Number(String(value).trim().replace(/,/g,'.'));
  return Number.isFinite(number)?{valid:true,code:null,value:number}:{valid:false,code:'not-finite',value:null};
}

function bound(control,name){
  const raw=control?.dataset?.[`flex${name}`]??control?.getAttribute?.(name.toLowerCase());
  if(raw===null||raw===undefined||raw==='')return null;
  const parsed=Number(raw);
  return Number.isFinite(parsed)?parsed:null;
}

function numericControl(control){
  const type=String(control?.type||'').toLowerCase();
  return type==='number'||control?.dataset?.flexNumber==='1';
}

function hiddenByMode(control){
  return Boolean(control?.disabled||control?.hidden||control?.classList?.contains('hidden')||control?.closest?.('.hidden'));
}

function controlLabel(control){
  if(!control)return'Input';
  const id=control.id;
  const explicit=id&&typeof document!=='undefined'?document.querySelector(`label[for="${id}"]`)?.textContent:null;
  return String(explicit||control.getAttribute?.('aria-label')||control.closest?.('.field,div')?.querySelector?.('label')?.textContent||id||control.dataset?.field||'Input').trim();
}

function validateControl(control,{optionalIds=OPTIONAL_IDS}={}){
  if(!numericControl(control)||hiddenByMode(control))return{valid:true,skipped:true,control,value:null,errors:[]};
  const optional=control.dataset?.optional==='true'||optionalIds.has(control.id);
  const parsed=parseFinite(control.value);
  const label=controlLabel(control);
  const errors=[];
  if(!parsed.valid){
    if(!(optional&&parsed.code==='required'))errors.push({control,id:control.id||null,label,code:parsed.code,message:parsed.code==='required'?`${label} is required.`:`${label} must be a finite number.`});
  }else{
    const min=bound(control,'Min'),max=bound(control,'Max');
    if(min!==null&&parsed.value<min)errors.push({control,id:control.id||null,label,code:'min',message:`${label} must be at least ${min}.`});
    if(max!==null&&parsed.value>max)errors.push({control,id:control.id||null,label,code:'max',message:`${label} must be no more than ${max}.`});
  }
  return{valid:errors.length===0,skipped:false,control,value:errors.length?null:parsed.value,errors};
}

function uniqueControls(controls){return[...new Set(Array.from(controls||[]).filter(Boolean))];}

function validateControls(controls,options={}){
  const results=uniqueControls(controls).map(control=>validateControl(control,options));
  const errors=results.flatMap(result=>result.errors);
  results.forEach(result=>{
    const invalid=result.errors.length>0,control=result.control;
    if(!control?.setAttribute)return;
    if(invalid)control.setAttribute('aria-invalid','true');else control.removeAttribute('aria-invalid');
    control.classList?.toggle('input-invalid',invalid);
  });
  return{valid:errors.length===0,errors,values:Object.fromEntries(results.filter(result=>!result.skipped&&result.valid&&result.control?.id).map(result=>[result.control.id,result.value]))};
}

function controlsInRoots(roots){
  if(typeof document==='undefined')return[];
  return uniqueControls(Array.from(roots||[]).flatMap(root=>{
    const element=typeof root==='string'?document.querySelector(root):root;
    return element?[...element.querySelectorAll('input')]:[];
  }));
}

function validateRoots(roots,options={}){return validateControls(controlsInRoots(roots),options);}

function controlsById(ids){
  if(typeof document==='undefined')return[];
  return Array.from(ids||[],id=>document.getElementById(id)).filter(Boolean);
}

function validateIds(ids,options={}){return validateControls(controlsById(ids),options);}

function summary(report){
  if(report?.valid)return'';
  const messages=(report?.errors||[]).map(error=>error.message);
  return `Results unavailable. ${messages.slice(0,3).join(' ')}${messages.length>3?` ${messages.length-3} more input${messages.length-3===1?' is':'s are'} invalid.`:''}`;
}

return{OPTIONAL_IDS,parseFinite,numericControl,hiddenByMode,validateControl,validateControls,controlsInRoots,validateRoots,controlsById,validateIds,summary};
});
