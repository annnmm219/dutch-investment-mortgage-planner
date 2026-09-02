(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root){
    root.LogicIntegrityUI=api;
    root.MODEL_META=api.MODEL_META;
  }
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';

const MODEL_META=Object.freeze({
  version:'R6.5',
  ruleYear:2026,
  updated:'2026-09-02',
  stateSchema:4,
  releaseName:'Interface Simplification'
});

function readNumber(id,fallback=0){
  if(typeof document==='undefined')return fallback;
  const value=Number(document.getElementById(id)?.value);
  return Number.isFinite(value)?value:fallback;
}

function optionalNumber(value){
  if(value===null||value===undefined||value==='')return null;
  const parsed=Number(value);
  return Number.isFinite(parsed)?Math.max(0,parsed):null;
}

function mortgageTaxContext(){
  const years=Math.max(0,readNumber('hraRemainingYears',30));
  const months=Math.max(0,Math.min(11,readNumber('hraRemainingMonths',0)));
  return{
    hraRemainingMonths:Math.round(years*12+months),
    qualifyingInterestFraction:Math.max(0,Math.min(1,readNumber('qualifyingBox1DebtPct',100)/100))
  };
}

function monthCountFromPlan(config={}){
  if(Array.isArray(config.flows))return config.flows.length;
  if(Number.isFinite(Number(config.months)))return Math.max(0,Math.round(Number(config.months)));
  if(Array.isArray(config.phases))return config.phases.reduce((total,phase)=>total+Math.max(0,Math.round((Number(phase?.years)||0)*12)),0);
  if(Number.isFinite(Number(config.horizonYears)))return Math.max(0,Math.round(Number(config.horizonYears)*12));
  return 0;
}

function regimeForYear(mode,year,futureStart=2028){
  if(mode==='future')return'future';
  if(mode==='transition')return Number(year)>=Number(futureStart||2028)?'future':'current';
  if(mode==='current')return'current';
  return'none';
}

function periodInfo(config={}){
  const startYear=Number(config.startYear)||2026;
  const startMonth=Math.max(1,Math.min(12,Number(config.startMonth)||1));
  const months=monthCountFromPlan(config);
  if(months<=0)return{startYear,startMonth,endYear:startYear,endMonth:startMonth,months:0};
  const index=(startMonth-1)+(months-1);
  return{startYear,startMonth,endYear:startYear+Math.floor(index/12),endMonth:index%12+1,months};
}

function domOptional(id){
  if(typeof document==='undefined')return undefined;
  const element=document.getElementById(id);
  return element?optionalNumber(element.value):undefined;
}

function box3Config(config={}){
  const nested=config.box3||{};
  const browser=typeof document!=='undefined';
  const domPortfolio=browser?domOptional('firstJan1Portfolio'):undefined;
  const domSavings=browser?domOptional('firstJan1Savings'):undefined;
  const domDebt=browser?domOptional('firstJan1Debt'):undefined;
  return{
    mode:config.box3Mode??nested.mode??'none',
    futureStart:config.futureStart??nested.futureStart??2028,
    firstJan1Portfolio:browser&&document.getElementById('firstJan1Portfolio')?domPortfolio:(config.firstJan1Portfolio??nested.firstJan1Portfolio),
    firstJan1Savings:browser&&document.getElementById('firstJan1Savings')?domSavings:(config.firstJan1Savings??nested.firstJan1Savings),
    firstJan1Debt:browser&&document.getElementById('firstJan1Debt')?domDebt:(config.firstJan1Debt??nested.firstJan1Debt),
    assumePlanStartAsJan1:Boolean(config.assumePlanStartAsJan1??nested.assumePlanStartAsJan1??(browser&&document.getElementById('assumePlanStartAsJan1')?.checked)),
    startPortfolio:config.startPortfolio??config.initialPortfolio??0,
    startSavings:config.box3Savings??nested.savings??nested.box3Savings??0,
    startDebt:config.box3Debt??nested.debt??nested.box3Debt??0
  };
}

function resolveJan1Snapshot(config={}){
  const period=periodInfo(config);
  const box=box3Config(config);
  const required=period.startMonth>1&&box.mode!=='none';
  if(!required)return{required:false,valid:true,source:'not-required',snapshot:null,missing:[]};

  if(box.assumePlanStartAsJan1){
    return{
      required:true,
      valid:true,
      source:'plan-start-assumption',
      snapshot:{
        portfolio:Math.max(0,Number(box.startPortfolio)||0),
        savings:Math.max(0,Number(box.startSavings)||0),
        debt:Math.max(0,Number(box.startDebt)||0)
      },
      missing:[]
    };
  }

  const snapshot={
    portfolio:optionalNumber(box.firstJan1Portfolio),
    savings:optionalNumber(box.firstJan1Savings),
    debt:optionalNumber(box.firstJan1Debt)
  };
  const missing=Object.entries(snapshot).filter(([,value])=>value===null).map(([key])=>key);
  return{required:true,valid:missing.length===0,source:'entered',snapshot,missing};
}

function applySnapshot(config={},resolution){
  if(!resolution?.snapshot)return{...config};
  const copy={...config};
  copy.firstJan1Portfolio=resolution.snapshot.portfolio;
  copy.firstJan1Savings=resolution.snapshot.savings;
  copy.firstJan1Debt=resolution.snapshot.debt;
  if(config.box3){
    copy.box3={
      ...config.box3,
      firstJan1Portfolio:resolution.snapshot.portfolio,
      firstJan1Savings:resolution.snapshot.savings,
      firstJan1Debt:resolution.snapshot.debt,
      assumePlanStartAsJan1:Boolean(resolution.source==='plan-start-assumption')
    };
  }
  return copy;
}

function proposedPartialYearStatus(config={}){
  const period=periodInfo(config);
  const box=box3Config(config);
  if(box.mode==='none'||box.mode==='current'||period.months<=0)return{notEstimable:false};
  const firstPartial=period.startMonth>1&&regimeForYear(box.mode,period.startYear,box.futureStart)==='future';
  const finalPartial=period.endMonth<12&&regimeForYear(box.mode,period.endYear,box.futureStart)==='future';
  return{
    notEstimable:firstPartial||finalPartial,
    firstPartial,
    finalPartial,
    startYear:period.startYear,
    endYear:period.endYear,
    endMonth:period.endMonth
  };
}

function blockedFinanceResult(original,config,reason,status){
  const noTax={...config,box3Mode:'none'};
  if(config.box3)noTax.box3={...config.box3,mode:'none'};
  const result=original(noTax);
  return{
    ...result,
    taxStatus:status,
    box3Status:status,
    taxAdjustedComparableAvailable:false,
    taxNotEstimable:status==='not-estimable',
    taxBlockReason:reason,
    box3Tax:null,
    totalTax:null,
    currentTax:null,
    futureTax:null,
    unsettledTaxEstimate:null,
    comparableWealth:null,
    householdComparableWealth:null
  };
}

function decorateFinanceCore(FC){
  if(!FC||FC.__r64PublicBetaGate)return FC;
  const originalPlan=FC.simulatePlan.bind(FC);
  const originalFlows=FC.simulateInvestmentFlows.bind(FC);

  function wrap(original,config={}){
    const snapshot=resolveJan1Snapshot(config);
    if(!snapshot.valid){
      return blockedFinanceResult(
        original,
        config,
        `Enter the 1 January portfolio, savings and Box 3 debt values, or explicitly confirm the plan-start-balance assumption. Missing: ${snapshot.missing.join(', ')}.`,
        'missing-jan1-snapshot'
      );
    }
    const prepared=applySnapshot(config,snapshot);
    const proposed=proposedPartialYearStatus(prepared);
    if(proposed.notEstimable){
      const result=original(prepared);
      return{
        ...result,
        taxStatus:'not-estimable',
        box3Status:'not-estimable',
        taxAdjustedComparableAvailable:false,
        taxNotEstimable:true,
        taxBlockReason:'The proposed actual-return regime cannot be estimated from incomplete calendar-year data.',
        box3Tax:null,
        totalTax:null,
        currentTax:null,
        futureTax:null,
        unsettledTaxEstimate:null,
        comparableWealth:null,
        householdComparableWealth:null
      };
    }
    const result=original(prepared);
    const hasUnsettled=Object.values(result.yearBuckets||{}).some(bucket=>bucket?.settled===false);
    return{
      ...result,
      taxStatus:hasUnsettled?'unsettled-estimate':'settled',
      box3Status:hasUnsettled?'unsettled-estimate':'settled',
      taxAdjustedComparableAvailable:true,
      jan1SnapshotSource:snapshot.source
    };
  }

  FC.simulatePlan=function(config={}){return wrap(originalPlan,config);};
  FC.simulateInvestmentFlows=function(config={}){return wrap(originalFlows,config);};
  Object.defineProperty(FC,'__r64PublicBetaGate',{value:true,enumerable:false});
  return FC;
}

function invalidScenario(reason,names=['Strategy A','Strategy B'],status='invalid'){
  const empty=name=>({name,net:0,invest:0,savings:0,box3Debt:0,financial:0,mortgage:0,box3:0,unsettledBox3:0,label:'Comparison unavailable'});
  return{
    valid:false,
    reason,
    status,
    taxAdjustedComparableAvailable:false,
    A:empty(names[0]),
    B:empty(names[1]),
    note:reason,
    cashA:[],
    cashB:[],
    budgetSeries:[],
    peakRequirement:0,
    firstRequirement:0
  };
}

function scenarioNames(mode){
  if(mode==='buy-rent')return['Buy home','Rent + invest'];
  if(mode==='downpayment')return['Larger down payment','Smaller down payment'];
  if(mode==='mortgage-invest')return['Repay mortgage','Invest instead'];
  if(mode==='linear-annuity')return['Linear mortgage','Annuity mortgage'];
  if(mode==='sell-rent')return['Keep home','Sell now + rent/invest'];
  return['Strategy A','Strategy B'];
}

function purchaseTermFromConfig(config={}){
  if(config.mode==='buy-rent')return Number(config.buyRent?.mortgageYears)||0;
  if(config.mode==='downpayment')return Number(config.downpayment?.mortgageYears)||0;
  return 0;
}

function decorateScenarioCore(SC){
  if(!SC||SC.__r64PublicBetaGate)return SC;
  const original=SC.runScenario.bind(SC);
  SC.runScenario=function(config={}){
    const names=scenarioNames(config.mode);
    const purchaseTerm=purchaseTermFromConfig(config);
    if(purchaseTerm>30&&config.tax?.enabled!==false){
      return invalidScenario(
        'Mortgage-interest deduction is not modeled for a new purchase mortgage with a contractual term above 30 years. Use 30 years or less, or switch mortgage-interest relief off.',
        names,
        'purchase-hra-term-blocked'
      );
    }

    const snapshot=resolveJan1Snapshot(config);
    if(!snapshot.valid){
      return invalidScenario(
        'Comparison unavailable until the common 1 January Box 3 snapshot is entered or the plan-start-balance assumption is explicitly confirmed.',
        names,
        'missing-jan1-snapshot'
      );
    }

    const prepared=applySnapshot(config,snapshot);
    const proposed=proposedPartialYearStatus(prepared);
    if(proposed.notEstimable){
      return invalidScenario(
        'Tax-adjusted comparison unavailable: the proposed actual-return regime cannot be estimated from the supplied partial calendar-year data.',
        names,
        'box3-not-estimable'
      );
    }

    const result=original(prepared);
    if(result?.A&&result?.B&&(!Number.isFinite(Number(result.A.net))||!Number.isFinite(Number(result.B.net)))){
      return invalidScenario('Tax-adjusted comparison is unavailable for the selected inputs.',names,'tax-adjusted-unavailable');
    }
    return{...result,jan1SnapshotSource:snapshot.source,taxAdjustedComparableAvailable:true};
  };
  Object.defineProperty(SC,'__r64PublicBetaGate',{value:true,enumerable:false});
  return SC;
}

function setModelMeta(){
  if(typeof document==='undefined')return;
  document.documentElement.dataset.modelVersion=MODEL_META.version;
  document.documentElement.dataset.stateSchema=String(MODEL_META.stateSchema);
  const marker=document.getElementById('modelVersion');
  if(marker)marker.textContent=`Calculation build ${MODEL_META.version} · ${MODEL_META.ruleYear} rules · updated 2 Sep 2026`;
  try{localStorage.setItem('dimp-model-meta',JSON.stringify(MODEL_META));}catch(_error){}
}

function ensureSnapshotControls(){
  if(typeof document==='undefined')return;
  const portfolio=document.getElementById('firstJan1Portfolio');
  if(!portfolio)return;
  portfolio.placeholder='Required for a mid-year Box 3 plan';
  try{
    if(portfolio.value==='0'&&!localStorage.getItem('dimp-r64-jan1-confirmed'))portfolio.value='';
  }catch(_error){if(portfolio.value==='0')portfolio.value='';}

  if(!document.getElementById('jan1SnapshotGate')){
    const host=portfolio.closest('.field')?.parentElement||portfolio.closest('.field');
    const gate=document.createElement('div');
    gate.id='jan1SnapshotGate';
    gate.className='callout';
    gate.innerHTML=`<strong>1 January Box 3 snapshot</strong><br><span id="jan1SnapshotGateText">For a plan starting after January, enter the historical 1 January values above. Zero is valid when entered explicitly.</span><div class="toggle" style="margin-top:8px"><input id="assumePlanStartAsJan1" type="checkbox"><label for="assumePlanStartAsJan1">Use my plan-start balances as my 1 January balances</label></div><p class="inline">This is an explicit simplifying assumption. Do not select it if your investments, savings or debt changed before the plan start.</p>`;
    host?.insertAdjacentElement('afterend',gate);
  }

  ['firstJan1Portfolio','firstJan1Savings','firstJan1Debt'].forEach(id=>{
    const el=document.getElementById(id);
    if(!el||el.dataset.r64SnapshotBound==='1')return;
    el.dataset.r64SnapshotBound='1';
    el.addEventListener('input',()=>{
      try{
        if(el.value==='')localStorage.removeItem('dimp-r64-jan1-confirmed');
        else localStorage.setItem('dimp-r64-jan1-confirmed','1');
      }catch(_error){}
    });
  });
}

function inject(){
  if(typeof document==='undefined')return;
  setModelMeta();

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
    note.innerHTML='<strong>Calendar-year policy:</strong> a mid-year current-law plan uses the deemed method only after a complete 1 January snapshot is supplied. A proposed actual-return year cannot show a euro estimate from incomplete calendar-year data.';
    regime.insertAdjacentElement('afterend',note);
  }

  ensureSnapshotControls();

  if(!document.getElementById('purchaseHraTermWarning')&&document.getElementById('mortTaxEnabled')){
    const warning=document.createElement('div');
    warning.id='purchaseHraTermWarning';
    warning.className='callout warn hidden';
    warning.innerHTML='<strong>Mortgage-interest relief switched off.</strong><br><span>A new purchase mortgage with a contractual term above 30 years is not modeled as HRA-qualifying. Reduce the term to 30 years or less, or keep the gross mortgage calculation without HRA.</span>';
    document.getElementById('mortTaxEnabled').closest('.toggle')?.insertAdjacentElement('afterend',warning);
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

function browserBox3Config(){
  const readOptional=id=>optionalNumber(document.getElementById(id)?.value);
  return{
    box3Mode:document.getElementById('box3Mode')?.value||'none',
    futureStart:readNumber('futureStart',2028),
    startYear:readNumber('startYear',2026),
    startMonth:readNumber('startMonth',1),
    firstJan1Portfolio:readOptional('firstJan1Portfolio'),
    firstJan1Savings:readOptional('firstJan1Savings'),
    firstJan1Debt:readOptional('firstJan1Debt'),
    assumePlanStartAsJan1:Boolean(document.getElementById('assumePlanStartAsJan1')?.checked),
    startPortfolio:readNumber('startPortfolio',0),
    box3Savings:readNumber('box3Savings',0),
    box3Debt:readNumber('box3Debt',0),
    phases:[...document.querySelectorAll('#phaseList .phase-card')].map(card=>({years:Number(card.querySelector('[data-field="years"]')?.value)||0}))
  };
}

function enforcePurchaseHra(){
  if(typeof document==='undefined')return false;
  const purchase=document.getElementById('mortgageMode')?.value==='purchase';
  const tooLong=readNumber('purchaseYears',30)>30;
  const enabled=document.getElementById('mortTaxEnabled');
  const warning=document.getElementById('purchaseHraTermWarning');
  const blocked=purchase&&tooLong;
  warning?.classList.toggle('hidden',!blocked);
  if(blocked&&enabled?.checked){
    enabled.checked=false;
    enabled.dispatchEvent(new Event('change',{bubbles:true}));
  }
  return blocked;
}

function refreshPublicBetaGate(){
  if(typeof document==='undefined')return;
  setModelMeta();
  ensureSnapshotControls();
  enforcePurchaseHra();

  const config=browserBox3Config();
  const snapshot=resolveJan1Snapshot(config);
  const snapshotGate=document.getElementById('jan1SnapshotGate');
  const snapshotText=document.getElementById('jan1SnapshotGateText');
  snapshotGate?.classList.toggle('hidden',!snapshot.required);
  if(snapshotText&&snapshot.required){
    snapshotText.textContent=snapshot.valid
      ?(snapshot.source==='plan-start-assumption'?'Plan-start balances are being used as an explicit 1 January assumption.':'The complete historical 1 January snapshot is available.')
      :`Box 3 is paused until these 1 January values are supplied: ${snapshot.missing.join(', ')}.`;
  }
  snapshotGate?.classList.toggle('warn',snapshot.required&&!snapshot.valid);

  const proposed=proposedPartialYearStatus(config);
  const blocked=!snapshot.valid||proposed.notEstimable;
  if(blocked){
    const reason=!snapshot.valid
      ?'Enter or explicitly confirm the complete 1 January Box 3 snapshot.'
      :'The proposed actual-return regime is not estimable from incomplete calendar-year data.';
    const tax=document.getElementById('sBox3');
    const taxSub=document.getElementById('sBox3Sub');
    const after=document.getElementById('bAfterTax');
    const afterSub=document.getElementById('bAfterTaxSub');
    if(tax)tax.textContent='Not estimable';
    if(taxSub)taxSub.textContent=reason;
    if(after)after.textContent='Unavailable';
    if(afterSub)afterSub.textContent='Tax-adjusted portfolio is not shown until the missing calendar-year information is resolved.';
  }
}

function bootBrowser(){
  if(typeof window==='undefined')return;
  if(!window.FinanceCore)throw new Error('FinanceCore must load before logic-integrity-ui.js');
  inject();
  decorateFinanceCore(window.FinanceCore);
  const delayed=()=>{
    if(window.ScenarioCore)decorateScenarioCore(window.ScenarioCore);
    refreshPublicBetaGate();
    const trigger=document.getElementById('box3Mode')||document.getElementById('annualReturn');
    trigger?.dispatchEvent(new Event('input',{bubbles:true}));
    setTimeout(refreshPublicBetaGate,0);
  };
  window.addEventListener('load',delayed,{once:true});
  document.addEventListener('input',()=>setTimeout(refreshPublicBetaGate,0));
  document.addEventListener('change',()=>setTimeout(refreshPublicBetaGate,0));
}

return{
  MODEL_META,
  readNumber,
  optionalNumber,
  mortgageTaxContext,
  monthCountFromPlan,
  periodInfo,
  resolveJan1Snapshot,
  applySnapshot,
  proposedPartialYearStatus,
  decorateFinanceCore,
  decorateScenarioCore,
  invalidScenario,
  purchaseTermFromConfig,
  setModelMeta,
  inject,
  refreshPublicBetaGate,
  bootBrowser
};
});

if(typeof window!=='undefined')window.LogicIntegrityUI.bootBrowser();
