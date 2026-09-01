(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.LogicIntegrityUI=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';

function readNumber(id,fallback=0){
  if(typeof document==='undefined')return fallback;
  const value=Number(document.getElementById(id)?.value);
  return Number.isFinite(value)?value:fallback;
}

function mortgageTaxContext(){
  const years=Math.max(0,readNumber('hraRemainingYears',30));
  const months=Math.max(0,Math.min(11,readNumber('hraRemainingMonths',0)));
  return{
    hraRemainingMonths:Math.round(years*12+months),
    qualifyingInterestFraction:Math.max(0,Math.min(1,readNumber('qualifyingBox1DebtPct',100)/100))
  };
}

function inject(){
  if(typeof document==='undefined')return;

  const phaseList=document.getElementById('phaseList');
  if(phaseList&&!document.getElementById('unusedMortgageDestination')){
    const row=document.createElement('div');
    row.className='grid2 advanced-grid';
    row.id='mortgageFallbackControls';
    row.innerHTML=`<div class="field"><label for="unusedMortgageDestination">When the mortgage is repaid, redirect planned extra repayments to</label><select id="unusedMortgageDestination"><option value="invest" selected>Investments</option><option value="savings">Savings / cash</option><option value="consume">Stop allocating / spending</option></select><p class="inline">Also applies when a bonus or monthly extra repayment is larger than the remaining mortgage. The unused amount is never discarded.</p></div>`;
    phaseList.insertAdjacentElement('afterend',row);
  }

  const wozImpact=document.getElementById('wozImpact');
  if(wozImpact&&!document.getElementById('hraRemainingYears')){
    const details=document.createElement('details');
    details.className='inner-fold';
    details.id='hraEligibilityDetails';
    details.innerHTML=`<summary>Mortgage-interest deduction eligibility</summary><div class="inner-fold-body"><p class="subsection-copy">EWF continues while the home is owner-occupied, even after the mortgage is repaid. Mortgage interest is deductible only during the remaining eligible period and only for the qualifying Box 1 share.</p><div class="grid3 advanced-grid"><div class="field"><label for="hraRemainingYears">Remaining HRA eligibility, years</label><input id="hraRemainingYears" type="number" min="0" max="30" step="1" value="25"><p class="inline">For a new qualifying mortgage, the usual maximum is 30 years. For an existing mortgage, enter the remaining eligible period.</p></div><div class="field"><label for="hraRemainingMonths">Additional months</label><input id="hraRemainingMonths" type="number" min="0" max="11" step="1" value="0"></div><div class="field"><label for="qualifyingBox1DebtPct">Mortgage share qualifying for HRA %</label><input id="qualifyingBox1DebtPct" type="number" min="0" max="100" step="1" value="100"><p class="inline">Use less than 100% when part of the loan is not qualifying owner-occupied-home debt.</p></div></div><div class="callout"><strong>Hillen changes over time.</strong><br><span>The model uses 71.867% relief in 2026, reduces it by 4.8 percentage points each year, and applies no Hillen relief from 2041.</span></div></div>`;
    wozImpact.insertAdjacentElement('afterend',details);
  }

  const regime=document.getElementById('regimeExplanation');
  if(regime&&!document.getElementById('box3CalendarPolicy')){
    const note=document.createElement('div');
    note.id='box3CalendarPolicy';
    note.className='callout';
    note.innerHTML='<strong>Calendar-year policy:</strong> for a plan starting after January, the first-year actual-return rebuttal is not used because the planner does not know the earlier months. A plan ending before December shows the last year as an unsettled estimate rather than charging it as a completed tax year.';
    regime.insertAdjacentElement('afterend',note);
  }

  const mode=document.getElementById('mortgageMode');
  const existingTerm=document.getElementById('mortYears');
  const purchaseTerm=document.getElementById('purchaseYears');
  const hraYears=document.getElementById('hraRemainingYears');
  let touched=false,syncing=false;
  function syncDefault(){
    if(touched||!hraYears)return;
    const term=mode?.value==='purchase'?readNumber('purchaseYears',30):readNumber('mortYears',25);
    syncing=true;
    hraYears.value=String(Math.max(0,Math.min(30,Math.round(term))));
    syncing=false;
  }
  hraYears?.addEventListener('input',()=>{if(!syncing)touched=true});
  hraYears?.addEventListener('change',()=>{if(!syncing)touched=true});
  [mode,existingTerm,purchaseTerm].forEach(el=>{
    el?.addEventListener('input',syncDefault);
    el?.addEventListener('change',syncDefault);
  });
  syncDefault();
}

return{readNumber,mortgageTaxContext,inject};
});

if(typeof window!=='undefined'&&window.document)window.LogicIntegrityUI.inject();
