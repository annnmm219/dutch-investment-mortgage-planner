(function(root){
'use strict';
const Policy2026=root?.Policy2026;
const FinanceCore=root?.FinanceCore;
const Box1=root?.Box1OwnHome2026;
const ScenarioCore=root?.ScenarioCore;
if(!Policy2026)throw new Error('Policy2026 must load before box1-2026-ui.js');
if(!FinanceCore)throw new Error('FinanceCore must load before box1-2026-ui.js');
if(!Box1)throw new Error('Box1OwnHome2026 must load before box1-2026-ui.js');
if(!ScenarioCore)throw new Error('ScenarioCore must load before box1-2026-ui.js');

const POLICY=Policy2026.VALUES;
Box1.decorateScenarioCore(ScenarioCore);

const finite=value=>Number.isFinite(Number(value));
const number=value=>finite(value)?Number(value):0;
const clamp=(value,min,max)=>Math.min(max,Math.max(min,number(value)));
const $=id=>document.getElementById(id);

function readNumber(id,fallback=0){
  const raw=String($(id)?.value??'').trim().replace(/\s+/g,'').replace(/,/g,'.');
  const value=Number(raw);
  return Number.isFinite(value)?value:fallback;
}

function investmentMonths(){
  const count=Math.max(1,Math.round(readNumber('phaseCount',1)));
  let months=0;
  for(let index=0;index<count;index++){
    const input=document.querySelector(`#phaseList [data-i="${index}"][data-field="years"]`);
    const years=Number(String(input?.value??'').replace(',','.'));
    months+=Math.max(0,Math.round((Number.isFinite(years)?years:0)*12));
  }
  return months;
}

function mortgageSetup(){
  if($('mortgageMode')?.value==='purchase'){
    const price=Math.max(0,readNumber('housePrice',0));
    const savings=Math.max(0,readNumber('ownSavings',0));
    const costs=Math.max(0,readNumber('purchaseCosts',0));
    return{
      balance:Math.max(0,price-Math.max(0,savings-costs)),
      ratePct:Math.max(0,readNumber('purchaseRate',0)),
      years:Math.max(1,readNumber('purchaseYears',30))
    };
  }
  return{
    balance:Math.max(0,readNumber('mortBalance',0)),
    ratePct:Math.max(0,readNumber('mortRate',0)),
    years:Math.max(1,readNumber('mortYears',25))
  };
}

function reportingMonths(startYear,startMonth,termMonths){
  const mode=$('mortgageReportHorizon')?.value||'investment';
  if(mode==='mortgage')return termMonths;
  if(mode==='year'){
    const year=Math.max(startYear,Math.round(readNumber('mortgageReportYear',startYear)));
    return Math.min(termMonths,Math.max(1,(year-startYear)*12+(13-startMonth)));
  }
  return Math.min(termMonths,Math.max(1,investmentMonths()));
}

function mortgageExtraSeries(months,startMonth){
  const count=Math.max(1,Math.round(readNumber('phaseCount',1)));
  const bonusMonth=clamp(Math.round(readNumber('bonusMonth',12)),1,12);
  const phases=[];
  for(let index=0;index<count;index++){
    const field=name=>document.querySelector(`#phaseList [data-i="${index}"][data-field="${name}"]`);
    const years=Number(String(field('years')?.value??'').replace(',','.'));
    const extra=Number(String(field('mortgageExtra')?.value??'').replace(',','.'));
    const annual=Number(String(field('annualBonus')?.value??'').replace(',','.'));
    phases.push({
      months:Math.max(0,Math.round((Number.isFinite(years)?years:0)*12)),
      extra:Math.max(0,Number.isFinite(extra)?extra:0),
      annual:Math.max(0,Number.isFinite(annual)?annual:0),
      destination:field('bonusDest')?.value||'invest'
    });
  }
  const output=Array(months).fill(0);
  let phaseIndex=0,phaseMonth=0,month=startMonth;
  for(let index=0;index<months;index++){
    while(phaseIndex<phases.length&&phaseMonth>=phases[phaseIndex].months){phaseIndex++;phaseMonth=0;}
    if(phaseIndex<phases.length){
      const phase=phases[phaseIndex];
      let amount=phase.extra;
      if(month===bonusMonth){
        if(phase.destination==='mortgage')amount+=phase.annual;
        else if(phase.destination==='split')amount+=phase.annual/2;
      }
      output[index]=amount;
      phaseMonth++;
    }
    month++;if(month===13)month=1;
  }
  return output;
}

function selectedMortgageType(){
  return document.querySelector('.compare-card.active[data-mort-type]')?.dataset.mortType==='linear'?'linear':'annuity';
}

function mortgageAuditResult(){
  const setup=mortgageSetup();
  const startYear=Math.round(readNumber('startYear',POLICY.taxYear));
  const startMonth=clamp(Math.round(readNumber('startMonth',1)),1,12);
  const termMonths=Math.max(1,Math.round(setup.years*12));
  const months=reportingMonths(startYear,startMonth,termMonths);
  const defaultHraYears=Math.min(setup.years,POLICY.ownHome.maximumQualifyingMortgageMonths/12);
  const tax={
    enabled:$('mortTaxEnabled')?.checked!==false,
    calculationMode:'box1-2026',
    box1IncomeBeforeOwnHome:Math.max(0,readNumber('grossIncome',0)),
    box1Profile:Box1.PROFILE,
    wozValue:Math.max(0,readNumber('wozValue',0)),
    hraRemainingMonths:Math.max(0,Math.round(readNumber('hraRemainingYears',defaultHraYears)*12+clamp(readNumber('hraRemainingMonths',0),0,11))),
    qualifyingInterestFraction:clamp(readNumber('qualifyingBox1DebtPct',100)/100,0,1)
  };
  if($('hillenOverrideEnabled')?.checked){
    tax.hillenRelief=clamp(readNumber('hillenOverridePct',POLICY.hillen.relief2026*100)/100,0,1);
  }
  return FinanceCore.mortgageSchedule({
    balance:setup.balance,
    annualRatePct:setup.ratePct,
    termYears:setup.years,
    type:selectedMortgageType(),
    months,
    extraMonthly:mortgageExtraSeries(months,startMonth),
    startYear,
    startMonth,
    tax
  });
}

function ensureInterface(){
  const mode=$('deductionMode');
  const modeLabel=document.querySelector('label[for="deductionMode"]');
  const manualLabel=document.querySelector('label[for="manualDeduction"]');
  const taxToggle=document.querySelector('label[for="mortTaxEnabled"]');
  if(modeLabel)modeLabel.textContent='Box 1 calculation';
  if(manualLabel)manualLabel.textContent='Manual tax-effect rate %';
  if(taxToggle)taxToggle.textContent='Include modeled Box 1 own-home effect';
  if(mode){
    const automatic=mode.querySelector('option[value="auto"]');
    const manual=mode.querySelector('option[value="manual"]');
    if(automatic)automatic.textContent='2026 non-AOW employment profile';
    if(manual)manual.textContent='Manual percentage override';
  }

  const visibleIncomeLabel=document.querySelector('label[for="grossAnnualIncome"]');
  if(visibleIncomeLabel)visibleIncomeLabel.textContent='Gross annual employment income';
  const grossHelp=$('grossIncomeHelp');
  if(grossHelp)grossHelp.textContent='The planner converts this to an estimated Box 1 employment-income amount, including the selected 30% ruling assumption. Your jaaropgaaf or tax return remains authoritative.';

  const woz=$('wozImpact');
  if(woz&&!$('box1ScopeNotice')){
    const notice=document.createElement('div');
    notice.id='box1ScopeNotice';
    notice.className='callout';
    notice.innerHTML='<strong>Bounded automatic Box 1 scope:</strong><br><span>Use the automatic profile only for a taxpayer below AOW age with ordinary employment income. It compares 2026 Box 1 tax before and after eigenwoningforfait, qualifying own-home costs, Hillen and the high-income rate adjustment. Tax credits, Box 1 losses, other rate-adjusted deductions, complex fiscal-partner allocation and mixed transitional debt are excluded. Projection years after 2026 keep the 2026 brackets and EWF rules as a scenario assumption; the existing Hillen schedule still changes by calendar year.</span>';
    woz.insertAdjacentElement('afterend',notice);
  }

  const card=$('mTaxBenefit')?.closest('.card');
  if(card&&!$('box1AnnualBridge')){
    const details=document.createElement('details');
    details.id='box1AnnualBridge';
    details.className='inner-fold';
    details.innerHTML='<summary>Year-by-year Box 1 own-home tax bridge</summary><div class="inner-fold-body"><p class="subsection-copy">Automatic mode keeps qualifying own-home costs, eigenwoningforfait, Hillen and the high-income adjustment separate. Positive amounts in the last column reduce modeled tax; negative amounts increase it.</p><div id="box1BridgeStatus" class="callout"></div><div class="table-wrap"><table><thead><tr><th>Year</th><th>Income before home</th><th>Qualifying costs</th><th>EWF</th><th>Hillen deduction</th><th>Tax before home</th><th>Table tax after</th><th>High-income adjustment</th><th>Benefit (+) / cost (−)</th></tr></thead><tbody id="box1BridgeBody"></tbody></table></div></div>';
    card.appendChild(details);
  }
}

function rewriteResultLabels(){
  const setLabel=(valueId,text)=>{
    const label=$(valueId)?.closest('.summary-item,.stat')?.querySelector('.k,.stat-label');
    if(label)label.textContent=text;
  };
  setLabel('mTaxBenefit','Estimated Box 1 effect');
  setLabel('mNetInterest','Interest after Box 1 effect');
  document.querySelectorAll('.compare-card .metric span').forEach(element=>{
    if(element.textContent.trim()==='Estimated tax benefit')element.textContent='Estimated Box 1 effect';
  });
  document.querySelectorAll('#scenarioBreakdownBodyNew td:first-child').forEach(element=>{
    if(element.textContent.trim()==='Mortgage tax benefit')element.textContent='Mortgage Box 1 effect';
  });
  $('scheduleBody')?.closest('table')?.querySelectorAll('thead th').forEach(element=>{
    if(/allocated tax benefit/i.test(element.textContent||''))element.textContent='Allocated Box 1 effect';
  });

  if($('deductionMode')?.value==='auto'){
    if($('deductionDisplay'))$('deductionDisplay').textContent='2026 progressive';
    if($('deductionWhy'))$('deductionWhy').textContent=`Before-and-after Box 1 tax; qualifying own-home deductions in the top bracket are adjusted to a maximum ${String(POLICY.box1.ownHomeDeductionMaxRate*100).replace('.',',')}% rate effect.`;
  }
}

function renderBridge(){
  ensureInterface();
  rewriteResultLabels();
  const status=$('box1BridgeStatus');
  const body=$('box1BridgeBody');
  if(!status||!body)return;
  body.innerHTML='';

  if($('deductionMode')?.value==='manual'){
    status.innerHTML='<strong>Manual override selected.</strong><br><span>The legacy one-rate estimate is preserved as an explicit manual assumption, so no progressive before-and-after Box 1 bridge is shown.</span>';
    return;
  }
  if($('mortTaxEnabled')?.checked===false){
    status.innerHTML='<strong>Box 1 own-home effect is switched off.</strong><br><span>Mortgage payments remain gross and no modeled tax effect is allocated.</span>';
    return;
  }

  try{
    const result=mortgageAuditResult();
    const buckets=Object.values(result?.annualTaxBuckets||{}).sort((a,b)=>a.year-b.year);
    if(!buckets.length){
      status.innerHTML='<strong>No modeled owner-occupied months.</strong><br><span>The selected reporting period has no annual own-home tax bridge.</span>';
      return;
    }
    const total=buckets.reduce((sum,bucket)=>sum+number(bucket.taxBenefit),0);
    const fmt=value=>'€'+Math.round(number(value)).toLocaleString('nl-NL');
    const fmtSigned=value=>(number(value)<0?'−':'+')+fmt(Math.abs(number(value)));
    status.innerHTML=`<strong>Automatic 2026 Box 1 profile applied.</strong><br><span>${buckets.length} annual calculation${buckets.length===1?'':'s'} reconcile to ${fmtSigned(total)}. Tax credits and unsupported personal circumstances remain outside this estimate.</span>`;
    buckets.forEach(bucket=>{
      const trace=bucket.box1Trace||{};
      const row=document.createElement('tr');
      row.innerHTML=`<td>${bucket.year}</td><td>${fmt(trace.incomeBeforeOwnHome)}</td><td>${fmt(trace.deductibleOwnHomeCosts)}</td><td>${fmt(trace.ewfIncome)}</td><td>${fmt(trace.hillenDeduction)}</td><td>${fmt(trace.taxBeforeOwnHome)}</td><td>${fmt(trace.tableTaxAfterOwnHome)}</td><td>${fmt(trace.highIncomeAdjustment)}</td><td>${fmtSigned(trace.taxBenefit)}</td>`;
      body.appendChild(row);
    });
  }catch(error){
    status.innerHTML=`<strong>Automatic Box 1 estimate unavailable.</strong><br><span>${String(error?.message||error)} Use the manual override only with a rate you can justify for your own tax position.</span>`;
  }
}

let scheduled=false;
function schedule(){
  if(scheduled)return;
  scheduled=true;
  const run=()=>{scheduled=false;renderBridge();};
  if(typeof requestAnimationFrame==='function')requestAnimationFrame(run);else setTimeout(run,0);
}

document.addEventListener('input',schedule);
document.addEventListener('change',schedule);
document.addEventListener('click',schedule);
ensureInterface();
rewriteResultLabels();
$('scenarioReturnNew')?.dispatchEvent(new Event('input',{bubbles:true}));
schedule();
window.addEventListener('load',()=>{
  Box1.decorateScenarioCore(root.ScenarioCore);
  schedule();
},{once:true});

})(typeof globalThis!=='undefined'?globalThis:this);
