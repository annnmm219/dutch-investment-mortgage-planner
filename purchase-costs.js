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

(()=>{
'use strict';
const $=id=>document.getElementById(id);
const n=(el,d=0)=>{const v=Number(el?.value);return Number.isFinite(v)?v:d};
const num=(id,d=0)=>n($(id),d);
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const fmt=v=>'€'+Math.round(Number(v)||0).toLocaleString('nl-NL');
const phaseBudgets=[];

const style=document.createElement('style');
style.textContent=`
@media(min-width:1001px){.phase-fields{grid-template-columns:repeat(7,minmax(0,1fr))!important}}
.phase-budget-status{margin-top:10px;padding:9px 11px;border-radius:var(--small);font-size:11px;line-height:1.5;background:var(--surface);border:.5px solid var(--border);color:var(--muted)}
.phase-budget-status strong{color:var(--text)}.phase-budget-status.warn{background:var(--amberbg);color:var(--amber);border-color:transparent}.phase-budget-summary{margin-top:12px}.scenario-budget-status{margin-top:10px}.scenario-budget-status.warn{background:var(--amberbg);color:var(--amber)}.scenario-budget-warning{color:var(--amber)!important;font-weight:600}.scenario-budget-field .inline{max-width:320px}
`;
document.head.appendChild(style);

function phasePlan(card){
  const invest=Math.max(0,n(card.querySelector('[data-field="monthlyInvest"]'),0));
  const extra=Math.max(0,n(card.querySelector('[data-field="mortgageExtra"]'),0));
  const freq=card.querySelector('[data-field="mortgageFreq"]')?.value||'monthly';
  return invest+(freq==='yearly'?extra/12:extra);
}
function defaultPhaseBudget(card){
  const planned=phasePlan(card);
  return Math.ceil(planned/50)*50;
}
function updatePhaseCard(card,i){
  const input=card.querySelector('[data-phase-budget]');
  const status=card.querySelector('.phase-budget-status');
  if(!input||!status)return;
  const planned=phasePlan(card),budget=Math.max(0,n(input,0)),delta=budget-planned;
  card.dataset.budgetOk=delta>=-0.01?'1':'0';
  status.classList.toggle('warn',delta<-.01);
  status.innerHTML=delta>=-.01
    ?`<strong>Monthly plan fits:</strong> ${fmt(planned)}/mo planned against ${fmt(budget)}/mo available${delta>0?` · ${fmt(delta)}/mo unallocated`:''}. Annual bonus is treated separately.`
    :`<strong>Monthly budget exceeded:</strong> ${fmt(planned)}/mo planned against ${fmt(budget)}/mo available · short by ${fmt(-delta)}/mo. Results remain mathematical until this is resolved.`;
}
function updatePhaseSummary(){
  const cards=[...document.querySelectorAll('#phaseList .phase-card')];
  const summary=$('phaseBudgetSummary');
  if(!summary)return;
  const bad=cards.filter(c=>c.dataset.budgetOk==='0').length;
  summary.classList.toggle('warn',bad>0);
  summary.innerHTML=bad
    ?`<strong>${bad} phase${bad===1?'':'s'} exceed the entered monthly surplus.</strong> Adjust contributions, mortgage overpayments, or the available surplus before treating the plan as affordable.`
    :'<strong>Cash-flow check passed.</strong> Every visible phase fits within its entered monthly surplus. Annual bonuses are checked separately as one-off cash sources.';
}
function decoratePhases(){
  const root=$('phaseList');if(!root)return;
  const cards=[...root.querySelectorAll('.phase-card')];
  cards.forEach((card,i)=>{
    const fields=card.querySelector('.phase-fields');if(!fields)return;
    if(phaseBudgets[i]==null)phaseBudgets[i]=defaultPhaseBudget(card);
    let input=card.querySelector('[data-phase-budget]');
    if(!input){
      const wrap=document.createElement('div');
      wrap.className='phase-budget-field';
      wrap.innerHTML=`<label class="mini">Available monthly surplus</label><input data-phase-budget="${i}" type="number" min="0" step="50" value="${phaseBudgets[i]}">`;
      const first=fields.children[0];
      first?.insertAdjacentElement('afterend',wrap);
      input=wrap.querySelector('input');
      input.addEventListener('input',()=>{phaseBudgets[i]=Math.max(0,n(input,0));updatePhaseCard(card,i);updatePhaseSummary();});
      input.addEventListener('change',()=>{phaseBudgets[i]=Math.max(0,n(input,0));updatePhaseCard(card,i);updatePhaseSummary();});
      const status=document.createElement('div');status.className='phase-budget-status';fields.insertAdjacentElement('afterend',status);
    }
    input.value=String(phaseBudgets[i]);
    updatePhaseCard(card,i);
  });
  if(!$('phaseBudgetSummary')){
    const summary=document.createElement('div');summary.id='phaseBudgetSummary';summary.className='callout phase-budget-summary';
    root.insertAdjacentElement('afterend',summary);
  }
  updatePhaseSummary();
}
function schedulePhaseRefresh(){setTimeout(decoratePhases,0)}
const phaseRoot=$('phaseList');
if(phaseRoot){
  new MutationObserver(schedulePhaseRefresh).observe(phaseRoot,{childList:true});
  phaseRoot.addEventListener('input',schedulePhaseRefresh);
  phaseRoot.addEventListener('change',schedulePhaseRefresh);
  schedulePhaseRefresh();
}

function deductionRate(){
  if($('deductionMode')?.value==='manual')return clamp(num('manualDeduction',37.56),0,60)/100;
  return num('grossIncome',0)<=38883?.3575:.3756;
}
function ewf(woz){if(woz<=12500)return 0;if(woz<=25000)return woz*.001;if(woz<=50000)return woz*.002;if(woz<=75000)return woz*.0025;if(woz<=1350000)return woz*.0035;return 4725+(woz-1350000)*.0235}
function mortTax(interest){
  if(!$('mortTaxEnabled')?.checked)return 0;
  const e=ewf(Math.max(0,num('wozValue',0)))/12,r=deductionRate();
  if(interest>=e)return(interest-e)*r;
  return-(e-interest)*(1-.71867)*r;
}
function selectedMortType(){
  const v=$('scenarioMortgageMethodNew')?.value;
  if(v==='linear'||v==='annuity')return v;
  return document.querySelector('.compare-card.active[data-mort-type]')?.dataset.mortType||'annuity';
}
function currentMainMortgage(){
  if($('mortgageMode')?.value==='purchase'){
    const price=Math.max(0,num('housePrice',0)),savings=Math.max(0,num('ownSavings',0)),cost=Math.max(0,num('purchaseCosts',0));
    return{balance:Math.max(0,price-Math.max(0,savings-cost)),rate:clamp(num('purchaseRate',4),0,20),years:clamp(num('purchaseYears',30),1,40)};
  }
  return{balance:Math.max(0,num('mortBalance',0)),rate:clamp(num('mortRate',4),0,20),years:clamp(num('mortYears',25),1,40)};
}
function mortgageCash(balance,rate,years,type,months,extraMonthly=0){
  const r=Math.max(0,rate)/100/12,term=Math.max(1,Math.round(years*12)),initial=Math.max(0,balance),linear=initial/term,ann=r===0?initial/term:initial*r/(1-Math.pow(1+r,-term));
  let mort=initial;const out=[];
  for(let m=0;m<months;m++){
    let cash=0;
    if(mort>0){
      const interest=mort*r,principal=type==='linear'?Math.min(mort,linear):Math.min(mort,Math.max(0,ann-interest));
      mort-=principal;const extra=Math.min(mort,Math.max(0,extraMonthly));mort-=extra;if(mort<.005)mort=0;
      cash=interest+principal-mortTax(interest)+extra;
    }
    out.push(Math.max(0,cash));
  }
  return out;
}
function rentCash(start,months,growthAnnual){
  const g=clamp(growthAnnual,-10,20)/100/12;
  return Array.from({length:months},(_,m)=>Math.max(0,start)*Math.pow(1+g,m));
}
function scenarioRequirements(){
  const mode=$('comparisonType')?.value||'buy-rent';
  const months=Math.max(12,Math.round(clamp(num('scenarioHorizonNew',10),1,40)*12));
  const vve=Math.max(0,num('scenarioVveNew',250)),maint=Math.max(0,num('scenarioMaintenanceNew',1500))/12,ownerCommon=vve+maint;
  const rentGrowth=num('scenarioRentGrowthNew',2.5),type=selectedMortType();
  let a=[],b=[];
  if(mode==='buy-rent'){
    const price=Math.max(0,num('scenarioBuyPriceNew',350000)),down=Math.min(price,Math.max(0,num('scenarioDownPaymentNew',35000)));
    a=mortgageCash(price-down,clamp(num('scenarioBuyRateNew',4),0,20),clamp(num('scenarioBuyYearsNew',30),1,40),type,months).map(x=>x+ownerCommon);
    b=rentCash(num('scenarioRentNew',1600),months,rentGrowth);
  }else if(mode==='downpayment'){
    const price=Math.max(0,num('scenarioDpPriceNew',350000)),da=Math.min(price,Math.max(0,num('scenarioDownANew',70000))),db=Math.min(price,Math.max(0,num('scenarioDownBNew',30000))),rate=clamp(num('scenarioDpRateNew',4),0,20),years=clamp(num('scenarioDpYearsNew',30),1,40);
    a=mortgageCash(price-da,rate,years,type,months).map(x=>x+ownerCommon);b=mortgageCash(price-db,rate,years,type,months).map(x=>x+ownerCommon);
  }else if(mode==='mortgage-invest'){
    const m=currentMainMortgage(),extra=Math.max(0,num('scenarioExtraMonthlyNew',500));
    a=mortgageCash(m.balance,m.rate,m.years,type,months,extra);b=mortgageCash(m.balance,m.rate,m.years,type,months);
  }else if(mode==='linear-annuity'){
    const m=currentMainMortgage();a=mortgageCash(m.balance,m.rate,m.years,'linear',months);b=mortgageCash(m.balance,m.rate,m.years,'annuity',months);
  }else{
    const m=currentMainMortgage();a=mortgageCash(m.balance,m.rate,m.years,type,months).map(x=>x+ownerCommon);b=rentCash(num('scenarioSellRentNew',1600),months,rentGrowth);
  }
  const required=a.map((x,i)=>Math.max(x,b[i]||0));
  const peak=Math.max(0,...required),first=required[0]||0;
  return{peak,first,a,b};
}
function updateScenarioBudget(){
  const input=$('scenarioMonthlyBudgetNew'),status=$('scenarioBudgetStatusNew');if(!input||!status)return;
  const budget=Math.max(0,num('scenarioMonthlyBudgetNew',0)),req=scenarioRequirements(),gap=req.peak-budget;
  status.classList.toggle('warn',gap>.01);
  status.innerHTML=gap<=.01
    ?`<strong>Affordability check passed.</strong> Peak monthly requirement across the two strategies is ${fmt(req.peak)}. Your entered budget is ${fmt(budget)}. Any budget above the common comparison requirement is intentionally excluded because it is available to both strategies.`
    :`<strong>Budget shortfall.</strong> One of the strategies needs up to ${fmt(req.peak)}/mo during the comparison, which is ${fmt(gap)}/mo above your entered ${fmt(budget)} budget. The result below is mathematical, not affordable under this budget.`;
  const verdict=$('scenarioVerdictNew');
  if(verdict){
    verdict.querySelector('.scenario-budget-warning')?.remove();
    if(gap>.01){const small=document.createElement('small');small.className='scenario-budget-warning';small.textContent=` Affordability warning: peak monthly requirement exceeds budget by ${fmt(gap)}.`;verdict.appendChild(small);}
  }
}
function initScenarioBudget(){
  const engine=$('decisionEngine');if(!engine)return false;
  const rentLabel=document.querySelector('label[for="scenarioRentNew"]');
  if(rentLabel){rentLabel.textContent='Monthly rent at scenario start';if(!rentLabel.parentElement.querySelector('.rent-helper')){const p=document.createElement('p');p.className='inline rent-helper';p.textContent='Use the rent you pay now, or the realistic rent for a comparable home at the start of this scenario.';rentLabel.parentElement.appendChild(p);}}
  const sellRentLabel=document.querySelector('label[for="scenarioSellRentNew"]');
  if(sellRentLabel){sellRentLabel.textContent='Monthly rent at scenario start';if(!sellRentLabel.parentElement.querySelector('.rent-helper')){const p=document.createElement('p');p.className='inline rent-helper';p.textContent='Expected rent immediately after selling the home.';sellRentLabel.parentElement.appendChild(p);}}
  if(!$('scenarioMonthlyBudgetNew')){
    const principle=engine.querySelector('.scenario-principle');
    const sharedCard=principle?.closest('.card'),grid=sharedCard?.querySelector('.grid3');
    if(grid){
      const wrap=document.createElement('div');wrap.className='field scenario-budget-field';
      wrap.innerHTML='<label for="scenarioMonthlyBudgetNew">Monthly housing + investing budget</label><input id="scenarioMonthlyBudgetNew" type="number" min="0" step="50" value="2500"><p class="inline">Affordability check only. Surplus common to both strategies is excluded from the comparison.</p>';
      grid.insertBefore(wrap,grid.firstChild);
      const status=document.createElement('div');status.id='scenarioBudgetStatusNew';status.className='callout scenario-budget-status';principle.insertAdjacentElement('afterend',status);
      principle.innerHTML='<strong>Fair-cash-flow rule:</strong> both strategies are compared using the same required monthly cash-flow capacity. The lower-cash-outflow strategy invests the difference. The budget above checks whether that required capacity is actually affordable.';
    }
  }
  updateScenarioBudget();return true;
}
let tries=0;
function waitScenario(){if(initScenarioBudget())return;if(++tries<100)setTimeout(waitScenario,50)}
setTimeout(waitScenario,0);
let queued=false;
function scheduleScenario(){if(queued)return;queued=true;setTimeout(()=>{queued=false;updateScenarioBudget()},0)}
document.addEventListener('input',scheduleScenario);
document.addEventListener('change',scheduleScenario);
})();
