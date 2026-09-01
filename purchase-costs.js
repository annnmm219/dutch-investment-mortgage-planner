(()=>{
'use strict';
const totalInput=document.getElementById('purchaseCosts');
if(!totalInput||document.getElementById('purchaseCostDetails'))return;
const field=totalInput.closest('.field');
const grid=field?.closest('.grid3');
if(!field||!grid)return;
const items=[
  ['purchaseTransferTax','Transfer tax',7000,'Set to €0 if an exemption applies.'],
  ['purchaseNotaryTransfer','Notary · transfer deed',900,''],
  ['purchaseNotaryMortgage','Notary · mortgage deed',900,''],
  ['purchaseValuation','Valuation report',800,''],
  ['purchaseMortgageAdvice','Mortgage advice / broker',2500,''],
  ['purchaseInspection','Technical inspection',500,''],
  ['purchaseBankGuarantee','Bank guarantee',350,''],
  ['purchaseNhgFee','NHG fee',0,'Only if applicable.'],
  ['purchaseAgentFee','Purchase agent / makelaar',0,'Optional.'],
  ['purchaseOtherCosts','Other costs / buffer',2050,'']
];
const fmt=v=>'€'+Math.round(v||0).toLocaleString('nl-NL');
totalInput.type='hidden';
field.querySelector('label').removeAttribute('for');
const note=field.querySelector('.inline');
if(note)note.remove();
const display=document.createElement('div');
display.className='callout';
display.innerHTML='<strong id="purchaseCostsDisplay">€15.000</strong><br><span>Calculated from the editable breakdown.</span>';
field.appendChild(display);
const details=document.createElement('details');
details.className='inner-fold';
details.id='purchaseCostDetails';
details.innerHTML=`<summary>Edit estimated purchase costs</summary><div class="inner-fold-body"><p class="subsection-copy">The categories are planning inputs, not fixed fees. Change each line to match the buyer, transaction and any exemptions.</p><div class="grid3 advanced-grid" id="purchaseCostGrid"></div><div class="callout"><strong>Total estimated purchase costs: <span id="purchaseCostsBreakdownTotal">—</span></strong><br><span>All starting amounts are illustrative.</span></div></div>`;
grid.insertAdjacentElement('afterend',details);
const costGrid=document.getElementById('purchaseCostGrid');
items.forEach(([id,label,value,help])=>{
  const wrap=document.createElement('div');wrap.className='field';
  wrap.innerHTML=`<label for="${id}">${label}</label><input id="${id}" type="number" min="0" step="50" value="${value}">${help?`<p class="inline">${help}</p>`:''}`;
  costGrid.appendChild(wrap);
});
function sync(){
  const total=items.reduce((sum,[id])=>sum+Math.max(0,Number(document.getElementById(id).value)||0),0);
  totalInput.value=String(total);
  document.getElementById('purchaseCostsDisplay').textContent=fmt(total);
  document.getElementById('purchaseCostsBreakdownTotal').textContent=fmt(total);
  totalInput.dispatchEvent(new Event('input',{bubbles:true}));
}
costGrid.addEventListener('input',sync);
costGrid.addEventListener('change',sync);
sync();
})();
