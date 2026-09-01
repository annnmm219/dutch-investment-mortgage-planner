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
    <p class="subsection-copy">Transfer tax and NHG are calculated automatically from the settings below. Other costs remain editable planning inputs.</p>
    <div class="grid3 advanced-grid" id="purchaseRuleGrid">
      <div class="field"><label for="purchaseTransferTaxMode">Transfer-tax treatment</label><select id="purchaseTransferTaxMode"><option value="main" selected>Main residence · 2%</option><option value="starter">Starter exemption · 0% if eligible</option><option value="other-home">Not main residence · 8%</option><option value="manual">Manual amount</option></select><p class="inline">Starter exemption assumes you are 18–34, will use the home as your main residence, have not used the exemption before, and the full home value is ≤ €555,000.</p></div>
      <div class="field"><label for="purchaseAppraisedValue">Estimated market / appraised value</label><input id="purchaseAppraisedValue" type="number" min="0" step="1000" value="350000"><p class="inline">Defaults to house price until you edit it. Used for the LTV planning check and NHG sanity check.</p></div>
      <div class="field"><label for="purchaseNhgMode">NHG</label><select id="purchaseNhgMode"><option value="none" selected>No NHG</option><option value="standard">Standard NHG · 2026 limit €470,000</option><option value="energy">NHG with qualifying energy measures · up to €498,200</option></select><p class="inline">The planner applies the 0.4% NHG fee when the simplified eligibility check passes.</p></div>
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
  const result=PR.calculatePurchase2026({
    housePrice:price,
    ownSavings:Math.max(0,Number(ownSavings?.value)||0),
    baseCosts:baseCosts(),
    transferTaxMode:transferMode.value,
    manualTransferTax:Math.max(0,Number(transferInput.value)||0),
    appraisedValue:Math.max(0,Number(appraisal.value)||0),
    nhgMode:nhgMode.value
  });

  if(!manual)transferInput.value=String(Math.round(result.transferTax.amount*100)/100);
  nhgInput.value=String(Math.round(result.nhgFee*100)/100);
  totalInput.value=String(Math.round(result.totalCosts*100)/100);
  document.getElementById('purchaseCostsDisplay').textContent=fmt(result.totalCosts);
  document.getElementById('purchaseCostsBreakdownTotal').textContent=fmt(result.totalCosts);

  const status=document.getElementById('purchaseRuleStatus');
  const transferLabel=transferMode.value==='starter'
    ?(result.transferTax.starterEligible?'Starter exemption passes the €555,000 value test.':'Starter exemption value test fails; 2% is used.')
    :transferMode.value==='main'?'Main-residence transfer tax: 2%.':transferMode.value==='other-home'?'Non-main-residence residential transfer tax: 8%.':'Manual transfer-tax amount.';
  const ltvText=result.appraisedValue>0
    ?`Estimated LTV: <strong>${pct(result.ltv.percentage)}</strong> of entered market value${result.ltv.overStandardLimit?' · above the normal 100% LTV limit.':' · within the normal 100% LTV limit.'}`
    :'Enter an appraised value for an LTV check.';
  let nhgText='NHG not selected.';
  if(result.nhg.enabled){
    nhgText=result.nhg.eligible
      ?`Simplified NHG check passes. Estimated fee: <strong>${fmt(result.nhgFee)}</strong>.${result.nhg.warning?` ${result.nhg.warning}`:''}`
      :`Simplified NHG check does not pass. ${result.nhg.warning}`;
  }
  status.classList.toggle('warn',Boolean(result.ltv.warning||result.transferTax.warning||(result.nhg.enabled&&!result.nhg.eligible)));
  status.innerHTML=`<strong>2026 purchase-rule check</strong><br>${transferLabel}<br>${ltvText}<br>${nhgText}<br><span>This is a planning screen, not an affordability or lender-acceptance decision. NHG also depends on the actual valuation, loan purpose and full NHG conditions.</span>`;
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
sync();
}

if(!window.PurchaseRules)throw new Error('PurchaseRules must load before purchase-costs.js');
boot();
})();
