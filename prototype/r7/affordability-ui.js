(()=>{
'use strict';

function boot(){
const NR=window.NibudRules;
if(!NR)throw new Error('NibudRules must load before affordability-ui.js');
const mortCard=document.getElementById('grossIncome')?.closest('.card');
if(!mortCard||document.getElementById('affordabilityCard'))return;

const fmt=v=>'€'+Math.round(v||0).toLocaleString('nl-NL');
const pct=v=>(Number(v)||0).toLocaleString('nl-NL',{minimumFractionDigits:1,maximumFractionDigits:1})+'%';
const num=(id,d=0)=>{const el=document.getElementById(id);const n=Number(el?.value);return Number.isFinite(n)?n:d};
const optional=id=>{const el=document.getElementById(id);if(!el||el.value==='')return null;const n=Number(el.value);return Number.isFinite(n)?n:null};

let income1Touched=false;

const card=document.createElement('div');
card.className='card';
card.id='affordabilityCard';
card.innerHTML=`
  <div class="section-head"><div><p class="section-label">Nibud income-based affordability (LTI)</p><p class="section-note">Indicative 2026 woonquote check: how does the planned mortgage compare to an income-based Nibud/AFM-style borrowing limit?</p></div></div>
  <div class="grid4">
    <div class="field"><label for="nibudIncome1">Your gross annual income</label><input id="nibudIncome1" type="number" min="0" step="1000" value="60000"><p class="inline">Defaults to the Box 1 income above until you edit it.</p></div>
    <div class="field"><label for="nibudIncome2">Partner gross annual income</label><input id="nibudIncome2" type="number" min="0" step="1000" value="0"></div>
    <div class="field"><label for="nibudSecondIncomeWeight">Partner income counted at %</label><input id="nibudSecondIncomeWeight" type="number" min="0" max="100" step="1" value="100"><p class="inline">100% since 2025 (previously 90%).</p></div>
    <div class="field"><label for="nibudFixedYears">Rate fixed for, years</label><input id="nibudFixedYears" type="number" min="1" max="30" step="1" value="10"><p class="inline">Under 10 years, the test rate is floored at 5%.</p></div>
  </div>
  <details class="inner-fold"><summary>Advanced: manual test rate</summary><div class="inner-fold-body"><div class="field compact-field"><label for="nibudTestRateOverride">Manual test rate % (optional)</label><input id="nibudTestRateOverride" type="number" min="0" max="20" step="0.01" placeholder="auto"><p class="inline">Leave blank to use the automatic 2026 test-rate rule.</p></div></div></details>
  <div class="summary">
    <div class="summary-item"><p class="k">Combined test income</p><p class="v" id="nibudCombinedIncome">—</p><p class="s" id="nibudTestRate">—</p></div>
    <div class="summary-item"><p class="k">Modeled woonquote</p><p class="v" id="nibudWoonquote">—</p><p class="s">of combined gross income</p></div>
    <div class="summary-item accent"><p class="k">Indicative max mortgage</p><p class="v" id="nibudMaxLoan">—</p><p class="s" id="nibudMaxMonthly">—</p></div>
    <div class="summary-item"><p class="k">Planned mortgage</p><p class="v" id="nibudRequestedLoan">—</p><p class="s" id="nibudMargin">—</p></div>
  </div>
  <div class="callout" id="nibudStatus"></div>
  <details class="inner-fold"><summary>What this check does not account for</summary><div class="inner-fold-body"><div class="source-list" id="nibudNotModeled"></div></div></details>
  <p class="foot">This is a simplified reconstruction of the Nibud/AFM woonquote methodology for planning purposes, not the official regeling table and not a lender pre-approval. Verify your actual maximum mortgage with a licensed Dutch mortgage adviser.</p>`;
mortCard.insertAdjacentElement('afterend',card);

const listEl=document.getElementById('nibudNotModeled');

function currentLoanAndRate(){
  if(document.getElementById('mortgageMode')?.value==='purchase'){
    const price=Math.max(0,num('housePrice',0)),savings=Math.max(0,num('ownSavings',0)),cost=Math.max(0,num('purchaseCosts',0));
    return{loan:Math.max(0,price-Math.max(0,savings-cost)),ratePct:num('purchaseRate',4)};
  }
  return{loan:Math.max(0,num('mortBalance',0)),ratePct:num('mortRate',4)};
}

function sync(){
  if(!income1Touched){
    const grossIncomeEl=document.getElementById('grossIncome');
    if(grossIncomeEl)document.getElementById('nibudIncome1').value=grossIncomeEl.value;
  }
  const{loan,ratePct}=currentLoanAndRate();
  const x=NR.affordability({
    income1:Math.max(0,num('nibudIncome1',0)),
    income2:Math.max(0,num('nibudIncome2',0)),
    secondIncomeWeightPct:Math.max(0,Math.min(100,num('nibudSecondIncomeWeight',100))),
    mortgageRatePct:ratePct,
    fixedYears:Math.max(1,num('nibudFixedYears',10)),
    testRateOverridePct:optional('nibudTestRateOverride'),
    requestedLoan:loan
  });

  document.getElementById('nibudCombinedIncome').textContent=fmt(x.combinedIncome);
  document.getElementById('nibudTestRate').textContent=`tested at ${pct(x.testRatePct)}${x.usedTestRateFloor?' (floor applied)':''}`;
  document.getElementById('nibudWoonquote').textContent=pct(x.woonquotePct);
  document.getElementById('nibudMaxLoan').textContent=fmt(x.maxLoan);
  document.getElementById('nibudMaxMonthly').textContent=`${fmt(x.maxMonthlyHousingCost)}/month budget`;
  document.getElementById('nibudRequestedLoan').textContent=fmt(x.requestedLoan);
  document.getElementById('nibudMargin').textContent=x.withinBudget
    ?`${fmt(x.marginEuro)} of room (${pct(x.marginPct)})`
    :`${fmt(-x.marginEuro)} over the modeled maximum`;

  const status=document.getElementById('nibudStatus');
  status.classList.toggle('warn',!x.withinBudget);
  status.innerHTML=x.combinedIncome<=0
    ?'<strong>Enter an income to run the affordability check.</strong>'
    :x.withinBudget
      ?`<strong>Within the modeled income-based limit.</strong><br><span>At ${fmt(x.combinedIncome)} combined income and a ${pct(x.testRatePct)} test rate, the indicative maximum mortgage is ${fmt(x.maxLoan)}. This is a planning estimate, not a lender decision.</span>`
      :`<strong>Above the modeled income-based limit.</strong><br><span>The planned mortgage of ${fmt(x.requestedLoan)} is ${fmt(-x.marginEuro)} above the indicative ${fmt(x.maxLoan)} maximum for ${fmt(x.combinedIncome)} combined income at a ${pct(x.testRatePct)} test rate.</span>`;

  if(listEl&&!listEl.textContent){
    listEl.innerHTML=(x.notModeled||[]).map(item=>`· ${item}`).join('<br>');
  }
}

const income1El=document.getElementById('nibudIncome1');
income1El.addEventListener('input',()=>{income1Touched=true});
income1El.addEventListener('change',()=>{income1Touched=true});
card.addEventListener('input',sync);
card.addEventListener('change',sync);
document.querySelectorAll('#tab-mortgage input,#tab-mortgage select').forEach(el=>{
  if(card.contains(el))return;
  el.addEventListener('input',sync);
  el.addEventListener('change',sync);
});
sync();
}

if(!window.NibudRules)throw new Error('NibudRules must load before affordability-ui.js');
boot();
})();
