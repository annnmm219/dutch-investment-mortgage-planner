(function(root){
'use strict';
const core=root?.FinanceCore;
const Box1=root?.Box1OwnHome2026;
if(!core||!Box1)throw new Error('FinanceCore and box1-2026.js must load before box1-2026-ui.js');
const {BOX1_2026_RULES}=Box1;
const finite=value=>Number.isFinite(Number(value));
const number=value=>finite(value)?Number(value):0;
const clamp=(value,min,max)=>Math.min(max,Math.max(min,number(value)));

function parseDomNumber(id,fallback=0){
  if(typeof document==='undefined')return fallback;
  const raw=String(document.getElementById(id)?.value??'').trim().replace(/\s+/g,'').replace(/,/g,'.');
  const value=Number(raw);
  return Number.isFinite(value)?value:fallback;
}

function browserInvestmentMonths(){
  if(typeof document==='undefined')return 0;
  const count=Math.max(1,Math.round(parseDomNumber('phaseCount',1)));
  let months=0;
  for(let index=0;index<count;index++){
    const years=Math.max(0,Number(String(document.querySelector(`#phaseList [data-i="${index}"][data-field="years"]`)?.value??'').replace(',','.'))||0);
    months+=Math.round(years*12);
  }
  return months;
}

function browserMortgageSetup(){
  const purchase=document.getElementById('mortgageMode')?.value==='purchase';
  if(purchase){
    const price=Math.max(0,parseDomNumber('housePrice',0));
    const savings=Math.max(0,parseDomNumber('ownSavings',0));
    const costs=Math.max(0,parseDomNumber('purchaseCosts',0));
    const savingsAfterCosts=Math.max(0,savings-costs);
    return{
      balance:Math.max(0,price-savingsAfterCosts),
      ratePct:Math.max(0,parseDomNumber('purchaseRate',0)),
      years:Math.max(1,parseDomNumber('purchaseYears',30))
    };
  }
  return{
    balance:Math.max(0,parseDomNumber('mortBalance',0)),
    ratePct:Math.max(0,parseDomNumber('mortRate',0)),
    years:Math.max(1,parseDomNumber('mortYears',25))
  };
}

function browserMortgageReportingMonths({startYear,startMonth,investmentMonths,mortgageTermMonths}){
  const mode=document.getElementById('mortgageReportHorizon')?.value||'investment';
  const term=Math.max(1,Math.round(mortgageTermMonths));
  if(mode==='mortgage')return term;
  if(mode==='year'){
    const specificYear=Math.max(startYear,Math.round(parseDomNumber('mortgageReportYear',startYear)));
    const throughDecember=(specificYear-startYear)*12+(13-startMonth);
    return Math.min(term,Math.max(1,throughDecember));
  }
  return Math.min(term,Math.max(1,Math.round(investmentMonths)||1));
}

function browserMortgageExtraSeries(months,startMonth){
  const count=Math.max(1,Math.round(parseDomNumber('phaseCount',1)));
  const bonusMonth=Math.max(1,Math.min(12,Math.round(parseDomNumber('bonusMonth',12))));
  const phases=[];
  for(let index=0;index<count;index++){
    const field=name=>document.querySelector(`#phaseList [data-i="${index}"][data-field="${name}"]`);
    phases.push({
      months:Math.round(Math.max(0,Number(String(field('years')?.value??'').replace(',','.'))||0)*12),
      extra:Math.max(0,Number(String(field('mortgageExtra')?.value??'').replace(',','.'))||0),
      annual:Math.max(0,Number(String(field('annualBonus')?.value??'').replace(',','.'))||0),
      destination:field('bonusDest')?.value||'invest'
    });
  }
  const result=Array(months).fill(0);
  let phaseIndex=0,used=0,month=startMonth;
  for(let index=0;index<months;index++){
    while(phaseIndex<phases.length&&used>=phases[phaseIndex].months){phaseIndex++;used=0;}
    if(phaseIndex<phases.length){
      const phase=phases[phaseIndex];
      let amount=phase.extra;
      if(month===bonusMonth){
        if(phase.destination==='mortgage')amount+=phase.annual;
        else if(phase.destination==='split')amount+=phase.annual/2;
      }
      result[index]=amount;
      used++;
    }
    month++;if(month===13)month=1;
  }
  return result;
}

function browserSelectedMortgageType(){
  return document.querySelector('.compare-card.active[data-mort-type]')?.dataset.mortType==='linear'?'linear':'annuity';
}

function browserMortgageAuditResult(core){
  if(!core||typeof document==='undefined')return null;
  const setup=browserMortgageSetup();
  const startYear=Math.round(parseDomNumber('startYear',2026));
  const startMonth=Math.max(1,Math.min(12,Math.round(parseDomNumber('startMonth',1))));
  const termMonths=Math.max(1,Math.round(setup.years*12));
  const months=browserMortgageReportingMonths({startYear,startMonth,investmentMonths:browserInvestmentMonths(),mortgageTermMonths:termMonths});
  const hraYears=Math.max(0,Math.round(parseDomNumber('hraRemainingYears',setup.years)));
  const hraMonths=Math.max(0,Math.min(11,Math.round(parseDomNumber('hraRemainingMonths',0))));
  const tax={
    enabled:document.getElementById('mortTaxEnabled')?.checked!==false,
    calculationMode:'box1-2026',
    box1IncomeBeforeOwnHome:Math.max(0,parseDomNumber('grossIncome',0)),
    box1Profile:BOX1_2026_RULES.profile,
    wozValue:Math.max(0,parseDomNumber('wozValue',0)),
    hraRemainingMonths:Math.max(0,hraYears*12+hraMonths),
    qualifyingInterestFraction:clamp(parseDomNumber('qualifyingBox1DebtPct',100)/100,0,1)
  };
  if(document.getElementById('hillenOverrideEnabled')?.checked){
    tax.hillenRelief=clamp(parseDomNumber('hillenOverridePct',BOX1_2026_RULES.hillenRelief*100)/100,0,1);
  }
  return core.mortgageSchedule({
    balance:setup.balance,
    annualRatePct:setup.ratePct,
    termYears:setup.years,
    type:browserSelectedMortgageType(),
    months,
    extraMonthly:browserMortgageExtraSeries(months,startMonth),
    startYear,
    startMonth,
    tax
  });
}

function decorateScenarioCore(){
  if(root?.ScenarioCore)Box1.decorateScenarioCore(root.ScenarioCore);
}

function installBrowserDisclosure(){
  if(typeof document==='undefined')return;
  const enqueue=typeof queueMicrotask==='function'?queueMicrotask:callback=>Promise.resolve().then(callback);
  const install=()=>{
    decorateScenarioCore();
    const mode=document.getElementById('deductionMode');
    const modeLabel=document.querySelector('label[for="deductionMode"]');
    const manualLabel=document.querySelector('label[for="manualDeduction"]');
    if(modeLabel)modeLabel.textContent='Box 1 calculation';
    if(manualLabel)manualLabel.textContent='Manual tax-effect rate %';
    if(mode){
      const auto=mode.querySelector('option[value="auto"]'),manual=mode.querySelector('option[value="manual"]');
      if(auto)auto.textContent='2026 non-AOW employment profile';
      if(manual)manual.textContent='Manual percentage override';
    }

    const woz=document.getElementById('wozImpact');
    if(woz&&!document.getElementById('box1ScopeNotice')){
      const notice=document.createElement('div');
      notice.id='box1ScopeNotice';notice.className='callout';
      notice.innerHTML='<strong>Bounded automatic Box 1 scope:</strong><br><span>Select the automatic profile only for a taxpayer below AOW age with ordinary employment income. The calculation compares 2026 Box 1 tax before and after EWF, qualifying own-home costs, Hillen and the high-income rate adjustment. It excludes tax credits, Box 1 losses, other rate-adjusted deductions, complex fiscal-partner allocation and mixed transitional debt. In projection years after 2026, the 2026 brackets and EWF rules are held constant as a scenario assumption; the existing Hillen schedule still changes by calendar year.</span>';
      woz.insertAdjacentElement('afterend',notice);
    }

    const mortgageTaxCard=document.getElementById('mTaxBenefit')?.closest('.card');
    if(mortgageTaxCard&&!document.getElementById('box1AnnualBridge')){
      const details=document.createElement('details');
      details.id='box1AnnualBridge';details.className='inner-fold';
      details.innerHTML='<summary>Year-by-year Box 1 own-home tax bridge</summary><div class="inner-fold-body"><p class="subsection-copy">Automatic mode separates qualifying own-home costs, eigenwoningforfait, Hillen and the high-income rate adjustment. Positive amounts in the final column reduce tax; negative amounts increase tax.</p><div id="box1BridgeStatus" class="callout"></div><div class="table-wrap"><table><thead><tr><th>Year</th><th>Income before home</th><th>Qualifying costs</th><th>EWF</th><th>Hillen deduction</th><th>Tax before home</th><th>Table tax after</th><th>High-income adjustment</th><th>Net benefit (+) / cost (−)</th></tr></thead><tbody id="box1BridgeBody"></tbody></table></div></div>';
      mortgageTaxCard.appendChild(details);
    }

    const display=document.getElementById('deductionDisplay'),why=document.getElementById('deductionWhy');
    const fmt=value=>'€'+Math.round(number(value)).toLocaleString('nl-NL');
    const fmtSigned=value=>(number(value)<0?'−':'+')+fmt(Math.abs(number(value)));
    let rendering=false,queued=false;

    const setText=(element,text)=>{if(element&&element.textContent!==text)element.textContent=text;};
    const rewriteLabels=()=>{
      if(mode?.value==='auto'&&display&&why){
        setText(display,'2026 progressive');
        setText(why,'Before-and-after Box 1 tax; qualifying deductions in the top bracket are corrected to a maximum 37.56% effect.');
      }
      const headline=document.getElementById('mTaxBenefit')?.closest('.summary-item')?.querySelector('.k');
      setText(headline,'Estimated Box 1 effect');
      const net=document.getElementById('mNetInterest')?.closest('.summary-item')?.querySelector('.k');
      setText(net,'Interest after Box 1 effect');
      document.querySelectorAll('.compare-card .metric span').forEach(el=>{if(el.textContent.trim()==='Estimated tax benefit')el.textContent='Estimated Box 1 effect';});
      document.querySelectorAll('#scenarioBreakdownBodyNew td:first-child').forEach(el=>{if(el.textContent.trim()==='Mortgage tax benefit')el.textContent='Mortgage Box 1 effect';});
      document.querySelectorAll('#scheduleBody').forEach(body=>{
        const table=body.closest('table');
        table?.querySelectorAll('thead th').forEach(th=>{if(/tax return/i.test(th.textContent||''))th.textContent='Allocated Box 1 effect';});
      });
    };

    const renderBridge=()=>{
      if(rendering)return;
      rendering=true;
      try{
        rewriteLabels();
        const status=document.getElementById('box1BridgeStatus'),body=document.getElementById('box1BridgeBody');
        if(!status||!body)return;
        body.innerHTML='';
        if(mode?.value==='manual'){
          status.innerHTML='<strong>Manual override selected.</strong><br><span>The planner preserves the legacy single-rate estimate, so a progressive before-and-after Box 1 audit trail is not available.</span>';
          return;
        }
        if(document.getElementById('mortTaxEnabled')?.checked===false){
          status.innerHTML='<strong>Box 1 own-home effect is switched off.</strong><br><span>Mortgage payments remain gross and no automatic tax effect is allocated.</span>';
          return;
        }
        const result=browserMortgageAuditResult(core);
        const buckets=Object.values(result?.annualTaxBuckets||{}).sort((a,b)=>a.year-b.year);
        if(!buckets.length){
          status.innerHTML='<strong>No modeled owner-occupied months.</strong><br><span>There is no annual own-home tax bridge for the selected reporting period.</span>';
          return;
        }
        const total=buckets.reduce((sum,bucket)=>sum+number(bucket.taxBenefit),0);
        status.innerHTML=`<strong>Automatic 2026 Box 1 profile applied.</strong><br><span>${buckets.length} annual calculation${buckets.length===1?'':'s'} reconcile to a total modeled own-home effect of ${fmtSigned(total)}. Tax credits and unsupported personal circumstances remain outside the result.</span>`;
        buckets.forEach(bucket=>{
          const trace=bucket.box1Trace||{};
          const row=document.createElement('tr');
          row.innerHTML=`<td>${bucket.year}</td><td>${fmt(trace.incomeBeforeOwnHome)}</td><td>${fmt(trace.deductibleOwnHomeCosts)}</td><td>${fmt(trace.ewfIncome)}</td><td>${fmt(trace.hillenDeduction)}</td><td>${fmt(trace.taxBeforeOwnHome)}</td><td>${fmt(trace.tableTaxAfterOwnHome)}</td><td>${fmt(trace.highIncomeAdjustment)}</td><td>${fmtSigned(trace.taxBenefit)}</td>`;
          body.appendChild(row);
        });
      }catch(error){
        const status=document.getElementById('box1BridgeStatus');
        if(status)status.innerHTML=`<strong>Automatic Box 1 estimate unavailable.</strong><br><span>${String(error?.message||error)}</span>`;
      }finally{
        rendering=false;
      }
    };

    const scheduleRender=()=>{
      if(queued)return;
      queued=true;
      enqueue(()=>{queued=false;renderBridge();});
    };
    document.addEventListener('input',scheduleRender);
    document.addEventListener('change',scheduleRender);
    document.addEventListener('click',scheduleRender);
    scheduleRender();
    setTimeout(()=>{decorateScenarioCore();scheduleRender();},0);
  };
  if(document.readyState==='loading')root?.addEventListener?.('DOMContentLoaded',install,{once:true});
  else install();
}
installBrowserDisclosure();

})(typeof globalThis!=='undefined'?globalThis:this);
