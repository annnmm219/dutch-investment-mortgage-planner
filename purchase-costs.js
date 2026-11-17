(()=>{
'use strict';

function boot(){
const PR=window.PurchaseRules;
if(!PR)throw new Error('PurchaseRules failed to load before purchase-cost initialization');
const totalInput=document.getElementById('purchaseCosts');
if(!totalInput||document.getElementById('purchaseCostDetails'))return;
const field=totalInput.closest('.field');
const grid=field?.closest('.grid3');
if(!field||!grid)return;

const editableItems=[
  ['purchaseNotaryTransfer','Notary · transfer deed',900,''],
  ['purchaseNotaryMortgage','Notary · mortgage deed',900,''],
  ['purchaseValuation','Valuation report',800,''],
  ['purchaseMortgageAdvice','Mortgage advice / broker',2500,''],
  ['purchaseInspection','Technical inspection',500,''],
  ['purchaseBankGuarantee','Bank guarantee',350,''],
  ['purchaseAgentFee','Purchase agent / makelaar',0,'Optional.'],
  ['purchaseOtherCosts','Other costs / buffer',2050,'']
];
const fmt=v=>'€'+Math.round(v||0).toLocaleString('nl-NL');
const pct=v=>(Number(v)||0).toLocaleString('nl-NL',{maximumFractionDigits:1})+'%';
let appraisalTouched=false;

totalInput.type='hidden';
field.querySelector('label')?.removeAttribute('for');
field.querySelector('.inline')?.remove();

const display=document.createElement('div');
display.className='callout';
display.innerHTML='<strong id="purchaseCostsDisplay">€15.000</strong><br><span>Calculated from the 2026 rule settings and editable cost breakdown.</span>';
field.appendChild(display);

const details=document.createElement('details');
details.className='inner-fold';
details.id='purchaseCostDetails';
details.innerHTML=`
  <summary>Edit estimated purchase costs and 2026 rules</summary>
  <div class="inner-fold-body">
    <p class="subsection-copy">Transfer tax is calculated from the settings below. NHG is not checked on this tab. Other costs remain editable planning inputs.</p>
    <p class="subsection-copy">For 2027, only one confirmed change is included: the €615,000 starter exemption limit (for notary transfers from 1 Jan 2027). Other figures for 2027 and later, including tax and NHG limits, keep their 2026 values. The Hillen deduction follows its planned yearly reduction.</p>
    <div class="grid3 advanced-grid" id="purchaseRuleGrid">
      <div class="field"><label for="purchaseTransferTaxMode">Transfer-tax treatment</label><select id="purchaseTransferTaxMode"><option value="main" selected>Main residence · 2%</option><option value="starter">Starter exemption · 0% if eligible</option><option value="other-home">Residential property, not main residence · 8%</option><option value="other-real-estate">Other real estate · 10.4%</option><option value="manual">Manual amount</option></select><p class="inline">Starter exemption assumes you are 18–34, will use the home as your main residence, have not used the exemption before, and the full home value is ≤ €555,000.</p></div>
      <div class="field"><label for="purchaseAppraisedValue">Estimated market / appraised value</label><input id="purchaseAppraisedValue" type="number" min="0" step="1000" value="350000"><p class="inline">Defaults to house price until you edit it. Used for the LTV planning check and NHG sanity check.</p></div>
      <div class="field"><label for="purchaseNhgMode">NHG</label><select id="purchaseNhgMode"><option value="none" selected>No NHG</option><option value="standard">Standard NHG · 2026 limit €470,000</option><option value="energy">NHG with qualifying energy measures · up to €498,200</option></select><p class="inline">The planner applies the 0.4% NHG fee when the simplified eligibility check passes. R6.6 decision-grade NHG checks stay on the Scenario tab.</p></div>
      <div class="field"><label for="purchaseGroundLease">Yearly ground rent (canon), €</label><input id="purchaseGroundLease" type="number" min="0" step="50" value="0"></div>
      <div class="field"><label for="purchaseGroundRentBoughtOff">Ground rent bought off?</label><select id="purchaseGroundRentBoughtOff"><option value="no" selected>no</option><option value="yes">yes</option></select></div>
      <div class="field"><label for="purchaseGroundRentPerpetual">Perpetual and not tied to anyone's lifetime?</label><select id="purchaseGroundRentPerpetual"><option value="dont-know" selected>don't know</option><option value="yes">yes</option><option value="no">no</option></select></div>
      <div class="field"><label for="purchaseGroundRentNotary">Capitalised ground rent from your notary, €</label><input id="purchaseGroundRentNotary" type="number" min="0" step="100" value="" data-optional="true"></div>
      <div class="field"><label for="purchaseNotaryTransferDate">Expected notary transfer date (levering)</label><input id="purchaseNotaryTransferDate" type="date"></div>
      <div class="field"><label for="purchaseBuyingWith">Buying alone or with someone?</label><select id="purchaseBuyingWith"><option value="alone" selected>Buying alone</option><option value="one">With one other person</option><option value="three">Three or more buyers</option></select><p class="inline">Buying with someone else? Each buyer is checked on their own. The starter exemption only covers the part of the home that a starter buys. The price limit is for the whole home, not for each part.</p></div>
      <div id="purchaseJointBuyers" class="grid3 hidden" aria-label="Details for each buyer">
        <div class="field"><label for="purchaseBuyerAShare">Your share of the home (%)</label><input id="purchaseBuyerAShare" type="number" min="0" max="100" step="1" value=""><p class="inline" id="purchaseBuyerAShareHelp">Your co-buyer's share is the rest: —%.</p><p class="inline" id="purchaseBuyerAShareError"></p></div>
        <div class="field"><label for="purchaseBuyerBShareReadout">Co-buyer's share of the home (%)</label><input id="purchaseBuyerBShareReadout" type="text" readonly value=""></div>
        <div class="field"><label for="purchaseBuyerAAge">Your age on the notary transfer date</label><input id="purchaseBuyerAAge" type="number" min="0" max="120" step="1" value="" aria-describedby="purchaseBuyerAAgeHelp"><p class="inline" id="purchaseBuyerAAgeHelp">The starter exemption is for buyers aged 18 to 34 on the notary transfer date.</p><p class="inline" id="purchaseBuyerAAgeError"></p></div>
        <div class="toggle"><input id="purchaseBuyerAMain" type="checkbox" checked><label for="purchaseBuyerAMain">You will live in the home as your main residence</label></div>
        <div class="toggle"><input id="purchaseBuyerAUsed" type="checkbox" aria-describedby="purchaseBuyerAUsedHelp"><label for="purchaseBuyerAUsed">You have used the starter exemption before</label><p class="inline" id="purchaseBuyerAUsedHelp">Each person can use the starter exemption only once.</p></div>
        <div class="field"><label for="purchaseBuyerBAge">Co-buyer's age on the notary transfer date</label><input id="purchaseBuyerBAge" type="number" min="0" max="120" step="1" value="" aria-describedby="purchaseBuyerBAgeHelp"><p class="inline" id="purchaseBuyerBAgeHelp">The starter exemption is for buyers aged 18 to 34 on the notary transfer date.</p><p class="inline" id="purchaseBuyerBAgeError"></p></div>
        <div class="toggle"><input id="purchaseBuyerBMain" type="checkbox" checked><label for="purchaseBuyerBMain">Your co-buyer will live in the home as their main residence</label></div>
        <div class="toggle"><input id="purchaseBuyerBUsed" type="checkbox" aria-describedby="purchaseBuyerBUsedHelp"><label for="purchaseBuyerBUsed">Your co-buyer has used the starter exemption before</label><p class="inline" id="purchaseBuyerBUsedHelp">Each person can use the starter exemption only once.</p></div>
      </div>
      <div class="toggle"><input id="purchaseStarterMainResidence" type="checkbox" checked><label for="purchaseStarterMainResidence">I will use the property as my main residence</label><p class="inline">Choose "Main residence · 2%" if you will live in the home as your main home, including if you will move in within 3 years. Choose "Residential property, not main residence · 8%" for a second home, holiday home or a home you rent out.</p></div>
    </div>
    <div class="grid3 advanced-grid" id="purchaseCostGrid"></div>
    <div class="callout"><strong>Total estimated purchase costs: <span id="purchaseCostsBreakdownTotal">—</span></strong><br><span>All non-tax fee amounts are illustrative and editable.</span></div>
    <div class="callout" id="purchaseRuleStatus"></div>
  </div>`;
grid.insertAdjacentElement('afterend',details);

const costGrid=document.getElementById('purchaseCostGrid');
const autoRows=[
  ['purchaseTransferTax','Transfer tax',7000,'Calculated from the selected 2026 transfer-tax treatment.'],
  ['purchaseNhgFee','NHG fee',0,'Calculated at 0.4% of the planned mortgage when the NHG planning check passes.']
];
autoRows.forEach(([id,label,value,help])=>{
  const wrap=document.createElement('div');
  wrap.className='field';
  wrap.innerHTML=`<label for="${id}">${label}</label><input id="${id}" type="number" min="0" step="50" value="${value}" disabled><p class="inline">${help}</p>`;
  costGrid.appendChild(wrap);
});
editableItems.forEach(([id,label,value,help])=>{
  const wrap=document.createElement('div');
  wrap.className='field';
  wrap.innerHTML=`<label for="${id}">${label}</label><input id="${id}" type="number" min="0" step="50" value="${value}">${help?`<p class="inline">${help}</p>`:''}`;
  costGrid.appendChild(wrap);
});

const housePrice=document.getElementById('housePrice');
const ownSavings=document.getElementById('ownSavings');
const appraisal=document.getElementById('purchaseAppraisedValue');
const transferMode=document.getElementById('purchaseTransferTaxMode');
const nhgMode=document.getElementById('purchaseNhgMode');
const transferInput=document.getElementById('purchaseTransferTax');
const nhgInput=document.getElementById('purchaseNhgFee');

function baseCosts(){return editableItems.reduce((sum,[id])=>sum+Math.max(0,Number(document.getElementById(id)?.value)||0),0)}

function sync(){
  const price=Math.max(0,Number(housePrice?.value)||0);
  if(!appraisalTouched)appraisal.value=String(price);
  const manual=transferMode.value==='manual';
  transferInput.disabled=!manual;
  const planYear=Number(document.getElementById('startYear')?.value);
  const transferDate=document.getElementById('purchaseNotaryTransferDate')?.value||'';
  const acquisitionYear=transferDate?Number(transferDate.slice(0,4)):(Number.isFinite(planYear)?planYear:undefined);
  const notaryCanon=document.getElementById('purchaseGroundRentNotary')?.value;
  const result=PR.calculatePurchase2026({
    housePrice:price,
    ownSavings:Math.max(0,Number(ownSavings?.value)||0),
    baseCosts:baseCosts(),
    transferTaxMode:transferMode.value,
    manualTransferTax:Math.max(0,Number(transferInput.value)||0),
    appraisedValue:Math.max(0,Number(appraisal.value)||0),
    nhgMode:nhgMode.value,
    acquisitionYear,
    yearlyCanon:document.getElementById('purchaseGroundLease')?.value,
    groundRentBoughtOff:document.getElementById('purchaseGroundRentBoughtOff')?.value==='yes',
    groundRentPerpetual:document.getElementById('purchaseGroundRentPerpetual')?.value||'dont-know',
    notaryCapitalisedCanon:notaryCanon,
    notaryTransferDate:transferDate
  });

  const buying=document.getElementById('purchaseBuyingWith')?.value||'alone';
  document.getElementById('purchaseJointBuyers')?.classList.toggle('hidden',buying!=='one');
  const shareRaw=document.getElementById('purchaseBuyerAShare')?.value;
  const shareA=shareRaw===''||shareRaw==null?NaN:Number(shareRaw);
  const readout=document.getElementById('purchaseBuyerBShareReadout');
  const shareHelp=document.getElementById('purchaseBuyerAShareHelp');
  const shareError=document.getElementById('purchaseBuyerAShareError');
  if(Number.isFinite(shareA)){
    if(readout)readout.value=String(Math.round((100-shareA)*1000)/1000);
    if(shareHelp)shareHelp.textContent=`Your co-buyer's share is the rest: ${100-shareA}%.`;
    if(shareError)shareError.textContent=shareA<0||shareA>100?'Enter a share from 0% to 100%.':'';
  }else{
    if(readout)readout.value='';
    if(shareHelp)shareHelp.textContent='Your co-buyer\'s share is the rest: —%.';
    if(shareError)shareError.textContent=buying==='one'?'Enter a share from 0% to 100%.':'';
  }
  const ageA=document.getElementById('purchaseBuyerAAge')?.value??'';
  const ageB=document.getElementById('purchaseBuyerBAge')?.value??'';
  const ageError=id=>document.getElementById(id);
  if(ageError('purchaseBuyerAAgeError'))ageError('purchaseBuyerAAgeError').textContent=buying==='one'&&String(ageA).trim()===''?'Enter an age to check the starter exemption.':'';
  if(ageError('purchaseBuyerBAgeError'))ageError('purchaseBuyerBAgeError').textContent=buying==='one'&&String(ageB).trim()===''?'Enter an age to check the starter exemption.':'';
  const tab=PR.mortgageTabTransfer({
    housePrice:price,ownSavings:Math.max(0,Number(ownSavings?.value)||0),baseCosts:baseCosts(),transferTaxMode:transferMode.value,
    manualTransferTax:Math.max(0,Number(transferInput.value)||0),appraisedValue:Math.max(0,Number(appraisal.value)||0),nhgMode:nhgMode.value,acquisitionYear,
    yearlyCanon:document.getElementById('purchaseGroundLease')?.value,groundRentBoughtOff:document.getElementById('purchaseGroundRentBoughtOff')?.value==='yes',
    groundRentPerpetual:document.getElementById('purchaseGroundRentPerpetual')?.value||'dont-know',notaryCapitalisedCanon:notaryCanon,notaryTransferDate:transferDate,buying,
    buyers:[{share:shareA,age:ageA,usedBefore:document.getElementById('purchaseBuyerAUsed')?.checked===true,mainHome:document.getElementById('purchaseBuyerAMain')?.checked!==false},{share:Number.isFinite(shareA)?100-shareA:NaN,age:ageB,usedBefore:document.getElementById('purchaseBuyerBUsed')?.checked===true,mainHome:document.getElementById('purchaseBuyerBMain')?.checked!==false}]
  });
  const transferFieldLabel=document.querySelector('label[for="purchaseTransferTax"]');
  const jointModes=transferMode.value==='main'||transferMode.value==='starter'||transferMode.value==='other-home';
  let transferAmount=result.transferTax.amount;
  let jointText='';
  if(buying!=='alone'&&(jointModes||buying==='three')){
    if(transferFieldLabel)transferFieldLabel.textContent=tab.manual?'Transfer tax from your notary, €':tab.label;
    jointText=tab.line||'';
    if(!tab.automatic){
      transferInput.disabled=false;
      if(transferInput.dataset.jointManual!=='1'){transferInput.value='';transferInput.dataset.jointManual='1';}
      transferAmount=Math.max(0,Number(transferInput.value)||0);
    }else{
      delete transferInput.dataset.jointManual;
      transferInput.disabled=true;
      transferInput.value=String(Math.round(tab.amount*100)/100);
      transferAmount=tab.amount;
    }
  }else{
    delete transferInput.dataset.jointManual;
    if(transferFieldLabel)transferFieldLabel.textContent='Transfer tax';
    transferInput.disabled=!manual;
    if(!manual)transferInput.value=String(Math.round(result.transferTax.amount*100)/100);
  }
  const totalCosts=result.totalCosts+(transferAmount-result.transferTax.amount);
  nhgInput.value=String(Math.round(result.nhgFee*100)/100);
  totalInput.value=String(Math.round(totalCosts*100)/100);
  document.getElementById('purchaseCostsDisplay').textContent=fmt(totalCosts);
  document.getElementById('purchaseCostsBreakdownTotal').textContent=fmt(totalCosts);

  const status=document.getElementById('purchaseRuleStatus');
  const starterYear=result.transferTax.acquisitionYear||PR.starterAcquisitionYear(acquisitionYear);
  const starterLimit=result.transferTax.starterLimit||PR.starterLimitForAcquisitionYear(acquisitionYear);
  const starterHelp=document.querySelector('label[for="purchaseTransferTaxMode"]')?.parentElement?.querySelector('.inline');
  if(starterHelp){
    starterHelp.textContent=starterYear===2026
      ?'Starter exemption assumes you are 18–34, will use the home as your main residence, have not used the exemption before, and the full home value is ≤ €555,000.'
      :`Starter exemption assumes you are 18–34, will use the home as your main residence, have not used the exemption before, and the full home value is ≤ €${starterLimit.toLocaleString('en-US')} in ${starterYear}.`;
  }
  const transferLabel=transferMode.value==='starter'
    ?(result.transferTax.starterEligible?`Starter exemption passes the €${starterLimit.toLocaleString('en-US')} value test.`:'Starter exemption value test fails; 2% is used.')
    :transferMode.value==='main'?'Main-residence transfer tax: 2%.'
    :transferMode.value==='other-home'?'Residential property not used as the main residence: 8%.'
    :transferMode.value==='other-real-estate'?'Other real estate transfer tax: 10.4%.'
    :'Manual transfer-tax amount.';
  const ltvText=result.appraisedValue>0
    ?`Estimated LTV: <strong>${pct(result.ltv.percentage)}</strong> of entered market value${result.ltv.overStandardLimit?' · above the normal 100% LTV limit.':' · within the normal 100% LTV limit.'}`
    :'Enter an appraised value for an LTV check.';
  let nhgText='NHG not selected.';
  // PENDING FEMKE WORDING REVIEW
  if(result.nhg.enabled)nhgText='NHG is unavailable here; use the Scenario purchase-rule section.';
  const proposal=PR.residentialNonMainProposalNote({transferTaxMode:transferMode.value,notaryTransferDate:transferDate,acquisitionYear});
  status.classList.toggle('warn',Boolean(result.ltv.warning||result.transferTax.warning||proposal||jointText));
  status.innerHTML=`<strong>2026 purchase-rule check</strong><br>${transferLabel}<br>${result.transferTax.erfpachtNote?`${result.transferTax.erfpachtNote}<br>`:''}${proposal?`${proposal}<br>`:''}${jointText?`${jointText}<br>`:''}${ltvText}<br>${nhgText}<br><span>This is a planning screen, not an affordability or lender-acceptance decision. NHG also depends on the actual valuation, loan purpose and full NHG conditions.</span>`;
  totalInput.dispatchEvent(new Event('input',{bubbles:true}));
}

costGrid.addEventListener('input',sync);
costGrid.addEventListener('change',sync);
transferMode.addEventListener('change',sync);
nhgMode.addEventListener('change',sync);
appraisal.addEventListener('input',()=>{appraisalTouched=true;sync()});
appraisal.addEventListener('change',()=>{appraisalTouched=true;sync()});
housePrice?.addEventListener('input',sync);
housePrice?.addEventListener('change',sync);
ownSavings?.addEventListener('input',sync);
ownSavings?.addEventListener('change',sync);
['startYear','purchaseGroundLease','purchaseGroundRentBoughtOff','purchaseGroundRentPerpetual','purchaseGroundRentNotary','purchaseNotaryTransferDate','purchaseBuyingWith','purchaseStarterMainResidence','purchaseBuyerAShare','purchaseBuyerAAge','purchaseBuyerAMain','purchaseBuyerAUsed','purchaseBuyerBAge','purchaseBuyerBMain','purchaseBuyerBUsed'].forEach(id=>{
  const el=document.getElementById(id);
  el?.addEventListener('input',sync);
  el?.addEventListener('change',sync);
});
sync();
}

if(!window.PurchaseRules)throw new Error('PurchaseRules must load before purchase-costs.js');
boot();
})();