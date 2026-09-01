(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.Box3Household=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';

const DEFAULTS={
  savings:0,
  debt:0,
  savingsReturnPct:1.28,
  debtInterestPct:2.70,
  currentSavingsNotional:.0128,
  currentDebtNotional:.027,
  currentDebtThreshold:3800
};

function nonNegative(v){return Math.max(0,Number(v)||0)}

function normalizeContext(context={}){
  return{
    box3Savings:nonNegative(context.box3Savings??context.savings??DEFAULTS.savings),
    box3Debt:nonNegative(context.box3Debt??context.debt??DEFAULTS.debt),
    savingsReturnPct:Number(context.savingsReturnPct??DEFAULTS.savingsReturnPct)||0,
    debtInterestPct:Number(context.debtInterestPct??DEFAULTS.debtInterestPct)||0,
    currentSavingsNotional:Number(context.currentSavingsNotional??DEFAULTS.currentSavingsNotional),
    currentDebtNotional:Number(context.currentDebtNotional??DEFAULTS.currentDebtNotional),
    currentDebtThreshold:nonNegative(context.currentDebtThreshold??DEFAULTS.currentDebtThreshold)
  };
}

function decorateCore(FC,getContext){
  if(!FC||FC.__box3HouseholdDecorated)return FC;
  const read=typeof getContext==='function'?getContext:()=>normalizeContext();
  const originalPlan=FC.simulatePlan.bind(FC);
  const originalFlows=FC.simulateInvestmentFlows.bind(FC);

  FC.simulatePlan=function(config={}){
    const c=normalizeContext(read());
    return originalPlan({...config,
      box3Savings:config.box3Savings??c.box3Savings,
      box3Debt:config.box3Debt??c.box3Debt,
      savingsReturnPct:config.savingsReturnPct??c.savingsReturnPct,
      debtInterestPct:config.debtInterestPct??c.debtInterestPct,
      currentSavingsNotional:config.currentSavingsNotional??c.currentSavingsNotional,
      currentDebtNotional:config.currentDebtNotional??c.currentDebtNotional,
      currentDebtThreshold:config.currentDebtThreshold??c.currentDebtThreshold
    });
  };

  FC.simulateInvestmentFlows=function(config={}){
    const c=normalizeContext(read());
    return originalFlows({...config,
      box3Savings:config.box3Savings??c.box3Savings,
      box3Debt:config.box3Debt??c.box3Debt,
      savingsReturnPct:config.savingsReturnPct??c.savingsReturnPct,
      debtInterestPct:config.debtInterestPct??c.debtInterestPct,
      currentSavingsNotional:config.currentSavingsNotional??c.currentSavingsNotional,
      currentDebtNotional:config.currentDebtNotional??c.currentDebtNotional,
      currentDebtThreshold:config.currentDebtThreshold??c.currentDebtThreshold
    });
  };

  Object.defineProperty(FC,'__box3HouseholdDecorated',{value:true,enumerable:false});
  return FC;
}

function browserContext(){
  const $=id=>document.getElementById(id);
  const val=(id,d=0)=>{const el=$(id);const n=el?Number(el.value):NaN;return Number.isFinite(n)?n:d};
  return normalizeContext({
    box3Savings:val('box3Savings',0),
    box3Debt:val('box3Debt',0),
    savingsReturnPct:val('box3SavingsReturn',DEFAULTS.savingsReturnPct),
    debtInterestPct:val('box3DebtInterest',DEFAULTS.debtInterestPct),
    currentSavingsNotional:val('currentSavingsNotional',DEFAULTS.currentSavingsNotional*100)/100,
    currentDebtNotional:val('currentDebtNotional',DEFAULTS.currentDebtNotional*100)/100,
    currentDebtThreshold:val('currentDebtThreshold',DEFAULTS.currentDebtThreshold)
  });
}

function injectBrowserUI(){
  if(typeof document==='undefined'||document.getElementById('box3HouseholdContext'))return;
  const box3Mode=document.getElementById('box3Mode');
  const card=box3Mode?.closest('.card');
  const explanation=document.getElementById('regimeExplanation');
  if(!card||!explanation)return;

  const context=document.createElement('div');
  context.id='box3HouseholdContext';
  context.innerHTML=`
    <p class="subsection-title">Household Box 3 context</p>
    <p class="subsection-copy">Add bank deposits and Box 3 debt that sit outside the investment portfolio. These balances are held constant as Jan 1 planning values across the plan. They affect Box 3 tax, not the investment contribution schedule.</p>
    <div class="grid4 advanced-grid">
      <div class="field"><label for="box3Savings">Savings / bank deposits · Jan 1</label><input id="box3Savings" type="number" min="0" step="100" value="0"><p class="inline">2026 deemed-return category: bank deposits.</p></div>
      <div class="field"><label for="box3Debt">Box 3 debt · Jan 1</label><input id="box3Debt" type="number" min="0" step="100" value="0"><p class="inline">Only debts that belong in Box 3. The 2026 debt threshold is applied in the deemed-return calculation.</p></div>
      <div class="field"><label for="box3SavingsReturn">Actual savings interest %</label><input id="box3SavingsReturn" type="number" min="-10" max="30" step="0.01" value="1.28"><p class="inline">Planning assumption for the actual-return rebuttal / proposed actual-return regime.</p></div>
      <div class="field"><label for="box3DebtInterest">Actual Box 3 debt interest %</label><input id="box3DebtInterest" type="number" min="0" max="30" step="0.01" value="2.70"><p class="inline">Planning assumption for interest paid on Box 3 debt. The actual-return route uses the full modeled debt interest, without the deemed-method debt threshold.</p></div>
    </div>`;
  card.insertBefore(context,explanation);

  const currentNotional=document.getElementById('currentNotional');
  const currentGrid=currentNotional?.closest('.grid4');
  if(currentGrid&&!document.getElementById('currentSavingsNotional')){
    const advanced=document.createElement('div');
    advanced.className='grid3 advanced-grid';
    advanced.innerHTML=`
      <div class="field"><label for="currentSavingsNotional">Deemed return on bank deposits %</label><input id="currentSavingsNotional" type="number" min="0" max="30" step="0.01" value="1.28"><p class="inline">2026 provisional bank-deposit percentage.</p></div>
      <div class="field"><label for="currentDebtNotional">Deemed return on Box 3 debt %</label><input id="currentDebtNotional" type="number" min="0" max="30" step="0.01" value="2.70"><p class="inline">2026 provisional debt percentage.</p></div>
      <div class="field"><label for="currentDebtThreshold">Debt threshold / person</label><input id="currentDebtThreshold" type="number" min="0" step="100" value="3800"><p class="inline">€3,800 per person in 2026; €7,600 for two fiscal partners.</p></div>`;
    currentGrid.insertAdjacentElement('afterend',advanced);
  }

  const investmentLabel=document.querySelector('label[for="currentNotional"]');
  if(investmentLabel)investmentLabel.textContent='Deemed return on investments / other assets %';

  const trigger=()=>{
    const el=document.getElementById('currentNotional')||document.getElementById('box3Mode');
    if(el)el.dispatchEvent(new Event('input',{bubbles:true}));
  };
  context.addEventListener('input',trigger);
  context.addEventListener('change',trigger);
  ['currentSavingsNotional','currentDebtNotional','currentDebtThreshold'].forEach(id=>{
    const el=document.getElementById(id);
    el?.addEventListener('input',trigger);
    el?.addEventListener('change',trigger);
  });
}

function bootBrowser(){
  if(typeof window==='undefined'||!window.FinanceCore)return;
  injectBrowserUI();
  decorateCore(window.FinanceCore,browserContext);
  const trigger=()=>{
    const el=document.getElementById('currentNotional')||document.getElementById('box3Mode');
    if(el)el.dispatchEvent(new Event('input',{bubbles:true}));
  };
  setTimeout(trigger,0);
  setTimeout(trigger,150);
}

return{DEFAULTS,normalizeContext,decorateCore,browserContext,injectBrowserUI,bootBrowser};
});

if(typeof window!=='undefined'&&window.FinanceCore){
  window.Box3Household.bootBrowser();
}
