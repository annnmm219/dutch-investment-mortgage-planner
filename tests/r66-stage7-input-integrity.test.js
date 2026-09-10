'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const II=require('../input-integrity.js');
const OI=require('../output-integrity.js');

function control({id='amount',value='',min='',max='',disabled=false,hidden=false,optional=false}={}){
  const attributes={};
  return{
    id,value,type:'number',disabled,hidden,dataset:optional?{optional:'true'}:{},
    classList:{contains:()=>false,toggle:()=>{}},closest:()=>null,
    getAttribute:name=>name==='min'?min:name==='max'?max:attributes[name]??null,
    setAttribute:(name,v)=>{attributes[name]=v;},removeAttribute:name=>{delete attributes[name];}
  };
}

test('Stage 7 browser contract distinguishes blank from explicit zero',()=>{
  assert.equal(II.validateControl(control({value:''})).valid,false);
  assert.equal(II.validateControl(control({value:'0',min:'0'})).valid,true);
  assert.equal(II.validateControl(control({value:'Infinity'})).valid,false);
});

test('Stage 7 browser contract rejects values outside declared bounds',()=>{
  assert.equal(II.validateControl(control({value:'-1',min:'0'})).errors[0].code,'min');
  assert.equal(II.validateControl(control({value:'31',max:'30'})).errors[0].code,'max');
});

test('Stage 7 optional blank inputs remain distinct from required blanks',()=>{
  assert.equal(II.validateControl(control({id:'scenarioPurchaseAppraisedValueNew',value:''})).valid,true);
  assert.equal(II.validateControl(control({id:'custom',value:'',optional:true})).valid,true);
});

test('invalid main inputs create a canonical unavailable result with blank exports',()=>{
  const canonical=OI.unavailablePlanResult('Results unavailable. Starting portfolio is required.');
  const rows=OI.planExportRows(canonical);
  assert.equal(canonical.available,false);
  assert.equal(canonical.status,'invalid-input');
  assert.equal(rows.find(row=>row[1]==='Portfolio before Box 3 (EUR)')[2],'');
  assert.match(rows.find(row=>row[1]==='Reason')[2],/Starting portfolio is required/);
});

test('Stage 7 wiring loads validation before calculation surfaces',()=>{
  const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),app=fs.readFileSync(path.join(root,'app.js'),'utf8'),scenario=fs.readFileSync(path.join(root,'scenario-engine.js'),'utf8'),next=fs.readFileSync(path.join(root,'next-euro.js'),'utf8');
  assert.ok(html.indexOf('input-integrity.js')<html.indexOf('app.js'));
  assert.match(app,/unavailablePlanResult/);
  assert.match(scenario,/scenarioInputReport/);
  assert.match(next,/II\.validateControls/);
});
