(function(root,factory){
  const Policy2026=typeof module==='object'&&module.exports?require('./policy-2026.js'):root.Policy2026;
  const api=factory(Policy2026);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.Box3Household=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Policy2026){
'use strict';
if(!Policy2026)throw new Error('Policy2026 is required by Box3Household');
const POLICY=Policy2026.VALUES;

const DEFAULTS={
  savings:0,
  debt:0,
  // Legacy illustrative actual household rates. These are not statutory
  // deemed percentages and will be separated in R6.6 Stage 5.
  savingsReturnPct:1.28,
  debtInterestPct:2.70,
  debtMonthlyRepayment:0,
  debtRepaymentSource:'external',
  debtFallbackDestination:'invest',
  currentSavingsNotional:POLICY.box3.savingsDeemedRate,
  currentDebtNotional:POLICY.box3.debtDeemedRate,
  currentDebtThreshold:POLICY.box3.debtThresholdPerPerson,
  firstJan1Savings:null,
  firstJan1Debt:null
};

function nonNegative(v){return Math.max(0,Number(v)||0)}
function optionalNonNegative(v){return v==null||v===''?null:nonNegative(v)}
function fmt(v){return '€'+Math.round(Number(v)||0).toLocaleString('nl-NL')}

function normalizeContext(context={}){
  return{
    box3Savings:nonNegative(context.box3Savings??context.savings??DEFAULTS.savings),
    box3Debt:nonNegative(context.box3Debt??context.debt??DEFAULTS.debt),
    savingsReturnPct:Number(context.savingsReturnPct??DEFAULTS.savingsReturnPct)||0,
    debtInterestPct:Number(context.debtInterestPct??DEFAULTS.debtInterestPct)||0,
    box3DebtMonthlyRepayment:nonNegative(context.box3DebtMonthlyRepayment??context.debtMonthlyRepayment??DEFAULTS.debtMonthlyRepayment),
    debtRepaymentSource:context.debtRepaymentSource==='savings'?'savings':'external',
    box3DebtFallbackDestination:['invest','savings','consume'].includes(context.box3DebtFallbackDestination??context.debtFallbackDestination)?(context.box3DebtFallbackDestination??context.debtFallbackDestination):DEFAULTS.debtFallbackDestination,
    currentSavingsNotional:Number(context.currentSavingsNotional??DEFAULTS.currentSavingsNotional),
    currentDebtNotional:Number(context.currentDebtNotional??DEFAULTS.currentDebtNotional),
    currentDebtThreshold:nonNegative(context.currentDebtThreshold??DEFAULTS.currentDebtThreshold),
    firstJan1Savings:optionalNonNegative(context.firstJan1Savings),
    firstJan1Debt:optionalNonNegative(context.firstJan1Debt)
  };
}

function renderBalanceSummary(result){
  if(typeof document==='undefined'||!result)return;
  const savings=document.getElementById('householdSavingsEnd');
  const debt=document.getElementById('householdDebtEnd');
  const net=document.getElementById('householdNetEnd');
  const external=document.getElementById('householdExternalTax');
  if(savings)savings.textContent=fmt(result.savings);
  if(debt)debt.textContent=fmt(result.box3Debt);
  if(net)net.textContent=fmt(result.netFinancialAssets);
  if(external)external.textContent=fmt(result.externalTax);
}

function decorateCore(FC,getContext){
  if(!FC||FC.__box3HouseholdDecorated)return FC;
  const read=typeof getContext==='function'?getContext:()=>normalizeContext();
  const originalPlan=FC.simulatePlan.bind(FC);
  const originalFlows=FC.simulateInvestmentFlows.bind(FC);
  function merge(config={}){
    const c=normalizeContext(read());
    return{
      ...config,
      box3Savings:config.box3Savings??c.box3Savings,
      box3Debt:config.box3Debt??c.box3Debt,
      savingsReturnPct:config.savingsReturnPct??c.savingsReturnPct,
      debtInterestPct:config.debtInterestPct??c.debtInterestPct,
      box3DebtMonthlyRepayment:config.box3DebtMonthlyRepayment??c.box3DebtMonthlyRepayment,
      debtRepaymentSource:config.debtRepaymentSource??c.debtRepaymentSource,
      box3DebtFallbackDestination:config.box3DebtFallbackDestination??c.box3DebtFallbackDestination,
      currentSavingsNotional:config.currentSavingsNotional??c.currentSavingsNotional,
      currentDebtNotional:config.currentDebtNotional??c.currentDebtNotional,
      currentDebtThreshold:config.currentDebtThreshold??c.currentDebtThreshold,
      firstJan1Savings:config.firstJan1Savings??c.firstJan1Savings,
      firstJan1Debt:config.firstJan1Debt??c.firstJan1Debt
    };
  }
  FC.simulatePlan=function(config={}){
    const merged=merge(config),result=originalPlan(merged);
    if(typeof document==='undefined'||!document.getElementById('box3Mode')||document.getElementById('box3Mode').value===merged.box3Mode)renderBalanceSummary(result);
    return result;
  };
  FC.simulateInvestmentFlows=function(config={}){return originalFlows(merge(config));};
  Object.defineProperty(FC,'__box3HouseholdDecorated',{value:true,enumerable:false});
  return FC;
}

function browserContext(){
  const $=id=>document.getElementById(id);
  const val=(id,d=0)=>{const el=$(id),n=el?Number(el.value):NaN;return Number.isFinite(n)?n:d};
  const optional=id=>{const el=$(id);if(!el||el.value==='')return null;const n=Number(el.value);return Number.isFinite(n)?n:null};
  return normalizeContext({
    box3Savings:val('box3Savings',0),
    box3Debt:val('box3Debt',0),
    savingsReturnPct:val('box3SavingsReturn',DEFAULTS.savingsReturnPct),
    debtInterestPct:val('box3DebtInterest',DEFAULTS.debtInterestPct),
    box3DebtMonthlyRepayment:val('box3DebtMonthlyRepayment',0),
    debtRepaymentSource:$('box3DebtRepaymentSource')?.value||'external',
    box3DebtFallbackDestination:$('box3DebtFallbackDestination')?.value||DEFAULTS.debtFallbackDestination,
    currentSavingsNotional:val('currentSavingsNotional',DEFAULTS.currentSavingsNotional*100)/100,
    currentDebtNotional:val('currentDebtNotional',DEFAULTS.currentDebtNotional*100)/100,
    currentDebtThreshold:val('currentDebtThreshold',DEFAULTS.currentDebtThreshold),
    firstJan1Savings:optional('firstJan1Savings'),
    firstJan1Debt:optional('firstJan1Debt')
  });
}

function configureTaxSource(){
  const select=document.getElementById('box3PaySource');
  if(!select)return;
  if(!select.querySelector('option[value="savings"]')){
    const option=document.createElement('option');
    option.value='savings';
    option.textContent='Savings / cash';
    select.insertBefore(option,select.firstChild);
  }
  const external=select.querySelector('option[value="external"]');
  if(external)external.textContent='External cash flow';
  if(!select.dataset.r3DefaultApplied){
    select.value='savings';
    select.dataset.r3DefaultApplied='1';
  }
}

function configureR4Defaults(){
  const annualReturn=document.getElementById('annualReturn');
  if(annualReturn&&annualReturn.value==='7')annualReturn.value='5';
  const mode=document.getElementById('box3Mode');
  if(mode&&mode.value==='transition')mode.value='current';
}

function injectBrowserUI(){
  if(typeof document==='undefined'||document.getElementById('box3HouseholdContext'))return;
  const box3Mode=document.getElementById('box3Mode');
  const card=box3Mode?.closest('.card');
  const explanation=document.getElementById('regimeExplanation');
  if(!card||!explanation)return;
  configureTaxSource();

  const context=document.createElement('div');
  context.id='box3HouseholdContext';
  context.innerHTML=`
    <p class="subsection-title">Household financial balances</p>
    <p class="subsection-copy">Savings and Box 3 debt evolve through the plan. Savings earns the entered effective annual yield, Box 3 debt can be repaid, and the next calendar year's Box 3 calculation uses the resulting Jan 1 balances.</p>
    <div class="grid3 advanced-grid">
      <div class="field"><label for="box3Savings">Starting savings / bank deposits</label><input id="box3Savings" type="number" min="0" step="100" value="50000"><p class="inline">A real balance in the household ledger. Purchase scenarios use this as their starting cash instead of a separate cash pot.</p></div>
      <div class="field"><label for="box3Debt">Starting Box 3 debt</label><input id="box3Debt" type="number" min="0" step="100" value="0"><p class="inline">Only debt that belongs in Box 3. Keep the owner-occupied home mortgage separate.</p></div>
      <div class="field"><label for="box3SavingsReturn">Effective annual savings yield %</label><input id="box3SavingsReturn" type="number" min="-10" max="30" step="0.01" value="1.28"><p class="inline">Converted to its monthly equivalent so 12 months reproduce the entered annual yield. Savings interest is included in actual-return Box 3.</p></div>
      <div class="field"><label for="box3DebtInterest">Nominal annual Box 3 debt interest %</label><input id="box3DebtInterest" type="number" min="0" max="30" step="0.01" value="2.70"><p class="inline">Divided by 12 as a nominal contractual annual rate. Interest is modeled for Box 3 actual return and paid as external household cash flow.</p></div>
      <div class="field"><label for="box3DebtMonthlyRepayment">Monthly Box 3 debt repayment</label><input id="box3DebtMonthlyRepayment" type="number" min="0" step="50" value="0"><p class="inline">Optional. Reduces the debt balance each month.</p></div>
      <div class="field"><label for="box3DebtRepaymentSource">Debt repayment comes from</label><select id="box3DebtRepaymentSource"><option value="external" selected>External cash flow</option><option value="savings">Savings / cash balance</option></select><p class="inline">Savings-funded repayment reduces cash and debt together. External repayment is tracked separately.</p></div>
      <div class="field"><label for="box3DebtFallbackDestination">After Box 3 debt payoff, redirect the monthly budget to</label><select id="box3DebtFallbackDestination"><option value="invest" selected>Investments</option><option value="savings">Savings / cash</option><option value="consume">Stop allocating / spending</option></select><p class="inline">Also applies to the unused portion of the final repayment. The repayment budget is never left without a destination.</p></div>
    </div>
    <div class="summary">
      <div class="summary-item"><p class="k">Ending savings / cash</p><p class="v" id="householdSavingsEnd">—</p></div>
      <div class="summary-item"><p class="k">Ending Box 3 debt</p><p class="v" id="householdDebtEnd">—</p></div>
      <div class="summary-item"><p class="k">Net financial assets</p><p class="v" id="householdNetEnd">—</p><p class="s">portfolio + savings − Box 3 debt; excludes home and Box 1 mortgage</p></div>
      <div class="summary-item"><p class="k">Box 3 paid externally</p><p class="v" id="householdExternalTax">—</p></div>
    </div>
    <div class="callout"><strong>Household balance-sheet behavior:</strong> Box 3 tax paid from savings reduces savings; tax paid from investments reduces the portfolio; external tax is tracked separately. If the selected balance cannot cover the full tax charge, the remainder becomes external cash flow rather than disappearing.</div>`;
  card.insertBefore(context,explanation);

  const currentNotional=document.getElementById('currentNotional');
  const currentGrid=currentNotional?.closest('.grid4');
  if(currentGrid&&!document.getElementById('currentSavingsNotional')){
    const advanced=document.createElement('div');
    advanced.className='grid3 advanced-grid';
    advanced.innerHTML=`
      <div class="field"><label for="currentSavingsNotional">Deemed return on bank deposits %</label><input id="currentSavingsNotional" type="number" min="0" max="30" step="0.01" value="${(POLICY.box3.savingsDeemedRate*100).toFixed(2)}"><p class="inline">2026 provisional bank-deposit percentage.</p></div>
      <div class="field"><label for="currentDebtNotional">Deemed return on Box 3 debt %</label><input id="currentDebtNotional" type="number" min="0" max="30" step="0.01" value="${(POLICY.box3.debtDeemedRate*100).toFixed(2)}"><p class="inline">2026 provisional debt percentage.</p></div>
      <div class="field"><label for="currentDebtThreshold">Debt threshold / person</label><input id="currentDebtThreshold" type="number" min="0" step="100" value="${POLICY.box3.debtThresholdPerPerson}"><p class="inline">€${POLICY.box3.debtThresholdPerPerson.toLocaleString('en-US')} per person in 2026; €${(POLICY.box3.debtThresholdPerPerson*2).toLocaleString('en-US')} for two fiscal partners.</p></div>
      <div class="field"><label for="firstJan1Savings">Jan 1 savings · first plan year</label><input id="firstJan1Savings" type="number" min="0" step="100" placeholder="Required for a mid-year Box 3 plan"><p class="inline">Historical 1 January value. Enter 0 explicitly if none.</p></div>
      <div class="field"><label for="firstJan1Debt">Jan 1 Box 3 debt · first plan year</label><input id="firstJan1Debt" type="number" min="0" step="100" placeholder="Required for a mid-year Box 3 plan"><p class="inline">Historical 1 January value. Enter 0 explicitly if none.</p></div>`;
    currentGrid.insertAdjacentElement('afterend',advanced);
  }

  const investmentLabel=document.querySelector('label[for="currentNotional"]');
  if(investmentLabel)investmentLabel.textContent='Deemed return on investments / other assets %';
  const foldBody=currentGrid?.closest('.fold-body');
  if(foldBody){
    const currentTitle=foldBody.querySelector('.subsection-title');
    const currentCopy=foldBody.querySelector('.subsection-copy');
    if(currentTitle)currentTitle.textContent='2026 current rules, dynamic mixed-asset estimate';
    if(currentCopy)currentCopy.textContent='Uses the investment portfolio plus the household savings and Box 3 debt ledgers. Each complete calendar year takes the modeled Jan 1 balances, then compares the deemed-return method with the modeled actual-return rebuttal.';
  }

  const trigger=()=>{const el=document.getElementById('currentNotional')||document.getElementById('box3Mode');if(el)el.dispatchEvent(new Event('input',{bubbles:true}));};
  context.addEventListener('input',trigger);
  context.addEventListener('change',trigger);
  ['currentSavingsNotional','currentDebtNotional','currentDebtThreshold','firstJan1Savings','firstJan1Debt'].forEach(id=>{
    const el=document.getElementById(id);
    el?.addEventListener('input',trigger);
    el?.addEventListener('change',trigger);
  });
}

function bootBrowser(){
  if(typeof window==='undefined')return;
  if(!window.FinanceCore)throw new Error('FinanceCore must load before box3-household.js');
  configureR4Defaults();
  injectBrowserUI();
  decorateCore(window.FinanceCore,browserContext);
}

return{DEFAULTS,normalizeContext,decorateCore,browserContext,configureTaxSource,configureR4Defaults,injectBrowserUI,renderBalanceSummary,bootBrowser};
});
if(typeof window!=='undefined')window.Box3Household.bootBrowser();
