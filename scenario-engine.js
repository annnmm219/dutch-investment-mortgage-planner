(function(root,factory){
  const FC=typeof module==='object'&&module.exports?require('./finance-core.js'):root.FinanceCore;
  const api=factory(FC);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.ScenarioCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(FC){
'use strict';
if(!FC)throw new Error('FinanceCore is required by ScenarioCore');

const nonNegative=v=>Math.max(0,Number(v)||0);
const sum=a=>a.reduce((s,x)=>s+(Number(x)||0),0);

function result(name,v={}){
  return{
    name,
    net:Number(v.net)||0,
    invest:Number(v.invest)||0,
    equity:v.equity,
    mortgage:Number(v.mortgage)||0,
    interest:Number(v.interest)||0,
    mortTax:Number(v.mortTax)||0,
    rent:Number(v.rent)||0,
    owner:Number(v.owner)||0,
    purchase:Number(v.purchase)||0,
    selling:Number(v.selling)||0,
    box3:Number(v.box3)||0,
    short:Number(v.short)||0,
    label:v.label||'Final net worth'
  };
}

function normalize(config={}){
  const months=Math.max(1,Math.round(Number(config.months)||((Number(config.horizonYears)||10)*12)));
  return{
    mode:config.mode||'buy-rent',
    months,
    investmentReturnPct:Number(config.investmentReturnPct)||0,
    startYear:Number(config.startYear)||2026,
    startMonth:FC.clamp(Number(config.startMonth)||1,1,12),
    startPortfolio:nonNegative(config.startPortfolio),
    purchaseCosts:nonNegative(config.purchaseCosts),
    mortgageType:config.mortgageType==='linear'?'linear':'annuity',
    mortgage:{
      balance:nonNegative(config.mortgage?.balance),
      ratePct:Math.max(0,Number(config.mortgage?.ratePct)||0),
      years:Math.max(1,Number(config.mortgage?.years)||30)
    },
    tax:{
      enabled:config.tax?.enabled!==false,
      deductionRate:Math.max(0,Number(config.tax?.deductionRate)||0),
      wozValue:nonNegative(config.tax?.wozValue)
    },
    box3:{
      mode:config.box3?.mode||'none',
      taxPartners:FC.clamp(Number(config.box3?.taxPartners)||1,1,2),
      paySource:config.box3?.paySource||'portfolio',
      currentTaxRate:Number(config.box3?.currentTaxRate??0.36),
      currentAllowance:nonNegative(config.box3?.currentAllowance??59357),
      currentNotional:Number(config.box3?.currentNotional??0.06),
      firstJan1Portfolio:nonNegative(config.box3?.firstJan1Portfolio),
      futureStart:Number(config.box3?.futureStart)||2028,
      futureTaxRate:Number(config.box3?.futureTaxRate??0.36),
      futureExempt:nonNegative(config.box3?.futureExempt??1800),
      futureLossThreshold:nonNegative(config.box3?.futureLossThreshold??500)
    },
    homeGrowthPct:Number(config.homeGrowthPct)||0,
    rentGrowthPct:Number(config.rentGrowthPct)||0,
    sellingCostPct:Math.max(0,Number(config.sellingCostPct)||0),
    vveMonthly:nonNegative(config.vveMonthly),
    maintenanceAnnual:nonNegative(config.maintenanceAnnual),
    buyRent:{
      price:nonNegative(config.buyRent?.price),
      cash:nonNegative(config.buyRent?.cash),
      downPayment:nonNegative(config.buyRent?.downPayment),
      monthlyRent:nonNegative(config.buyRent?.monthlyRent),
      mortgageRatePct:Math.max(0,Number(config.buyRent?.mortgageRatePct)||0),
      mortgageYears:Math.max(1,Number(config.buyRent?.mortgageYears)||30)
    },
    downpayment:{
      price:nonNegative(config.downpayment?.price),
      cash:nonNegative(config.downpayment?.cash),
      downA:nonNegative(config.downpayment?.downA),
      downB:nonNegative(config.downpayment?.downB),
      mortgageRatePct:Math.max(0,Number(config.downpayment?.mortgageRatePct)||0),
      mortgageYears:Math.max(1,Number(config.downpayment?.mortgageYears)||30)
    },
    mortgageInvest:{extraMonthly:nonNegative(config.mortgageInvest?.extraMonthly)},
    sellRent:{homeValue:nonNegative(config.sellRent?.homeValue),monthlyRent:nonNegative(config.sellRent?.monthlyRent)}
  };
}

function mortgage(S,balance,ratePct,years,type,extraMonthly=0){
  return FC.mortgageSchedule({
    balance,
    annualRatePct:ratePct,
    termYears:years,
    type,
    months:S.months,
    extraMonthly,
    startYear:S.startYear,
    startMonth:S.startMonth,
    tax:S.tax
  });
}

function investment(S,initial,flows){
  const x=FC.simulateInvestmentFlows({
    initialPortfolio:nonNegative(initial),
    flows,
    annualReturnPct:S.investmentReturnPct,
    startYear:S.startYear,
    startMonth:S.startMonth,
    box3Mode:S.box3.mode,
    taxPartners:S.box3.taxPartners,
    paySource:S.box3.paySource,
    currentTaxRate:S.box3.currentTaxRate,
    currentAllowance:S.box3.currentAllowance,
    currentNotional:S.box3.currentNotional,
    firstJan1Portfolio:S.box3.firstJan1Portfolio,
    futureStart:S.box3.futureStart,
    futureTaxRate:S.box3.futureTaxRate,
    futureExempt:S.box3.futureExempt,
    futureLossThreshold:S.box3.futureLossThreshold
  });
  return{wealth:x.comparableWealth,tax:x.totalTax,portfolio:x.portfolio,externalTax:x.externalTax};
}

function rentSeries(S,start){
  const monthlyGrowth=S.rentGrowthPct/100/12;
  return Array.from({length:S.months},(_,m)=>nonNegative(start)*Math.pow(1+monthlyGrowth,m));
}
function futureHomeValue(S,price){return nonNegative(price)*Math.pow(1+S.homeGrowthPct/100/12,S.months)}
function finalize(A,B,note,cashA,cashB){
  const eq=FC.equalizeCashFlows(cashA,cashB);
  return{A,B,note:note||'',cashA,cashB,budgetSeries:eq.budget,peakRequirement:Math.max(0,...eq.budget),firstRequirement:eq.budget[0]||0};
}

function runScenario(config={}){
  const S=normalize(config);
  const commonMonthly=S.vveMonthly+S.maintenanceAnnual/12;
  let A,B,note='',cashA=[],cashB=[];

  if(S.mode==='buy-rent'){
    const d=S.buyRent,price=d.price,down=Math.min(price,d.downPayment),loan=Math.max(0,price-down);
    const m=mortgage(S,loan,d.mortgageRatePct,d.mortgageYears,S.mortgageType);
    cashA=m.rows.map(r=>r.cash+commonMonthly);
    cashB=rentSeries(S,d.monthlyRent);
    const eq=FC.equalizeCashFlows(cashA,cashB);
    const needed=S.purchaseCosts+down,short=Math.max(0,needed-d.cash);
    const ia=investment(S,Math.max(0,d.cash-needed),eq.a),ib=investment(S,d.cash,eq.b);
    const home=futureHomeValue(S,price),selling=home*S.sellingCostPct/100,equity=home-m.balance-selling;
    A=result('Buy home',{net:ia.wealth+equity-short,invest:ia.wealth,equity,mortgage:m.balance,interest:m.totalInterest,mortTax:m.totalTaxBenefit,owner:commonMonthly*S.months,purchase:S.purchaseCosts,selling,box3:ia.tax,short});
    B=result('Rent + invest',{net:ib.wealth,invest:ib.wealth,equity:0,rent:sum(cashB),box3:ib.tax});
    note=short>0?'The entered cash does not cover down payment + purchase costs; the shortfall is deducted from Strategy A.':'';
  }else if(S.mode==='downpayment'){
    const d=S.downpayment,price=d.price,da=Math.min(price,d.downA),db=Math.min(price,d.downB);
    const ma=mortgage(S,price-da,d.mortgageRatePct,d.mortgageYears,S.mortgageType),mb=mortgage(S,price-db,d.mortgageRatePct,d.mortgageYears,S.mortgageType);
    cashA=ma.rows.map(r=>r.cash+commonMonthly);cashB=mb.rows.map(r=>r.cash+commonMonthly);
    const eq=FC.equalizeCashFlows(cashA,cashB),needA=S.purchaseCosts+da,needB=S.purchaseCosts+db,shortA=Math.max(0,needA-d.cash),shortB=Math.max(0,needB-d.cash);
    const ia=investment(S,Math.max(0,d.cash-needA),eq.a),ib=investment(S,Math.max(0,d.cash-needB),eq.b);
    const home=futureHomeValue(S,price),selling=home*S.sellingCostPct/100,equityA=home-ma.balance-selling,equityB=home-mb.balance-selling;
    A=result('Down payment A',{net:ia.wealth+equityA-shortA,invest:ia.wealth,equity:equityA,mortgage:ma.balance,interest:ma.totalInterest,mortTax:ma.totalTaxBenefit,owner:commonMonthly*S.months,purchase:S.purchaseCosts,selling,box3:ia.tax,short:shortA});
    B=result('Down payment B + invest',{net:ib.wealth+equityB-shortB,invest:ib.wealth,equity:equityB,mortgage:mb.balance,interest:mb.totalInterest,mortTax:mb.totalTaxBenefit,owner:commonMonthly*S.months,purchase:S.purchaseCosts,selling,box3:ib.tax,short:shortB});
    note=(shortA||shortB)?'One strategy needs more upfront cash than entered; the shortfall is deducted from comparable wealth.':'';
  }else if(S.mode==='mortgage-invest'){
    const extra=S.mortgageInvest.extraMonthly,m=S.mortgage;
    const ma=mortgage(S,m.balance,m.ratePct,m.years,S.mortgageType,extra),mb=mortgage(S,m.balance,m.ratePct,m.years,S.mortgageType,0);
    cashA=ma.rows.map(r=>r.cash);cashB=mb.rows.map(r=>r.cash);
    const eq=FC.equalizeCashFlows(cashA,cashB),ia=investment(S,S.startPortfolio,eq.a),ib=investment(S,S.startPortfolio,eq.b);
    A=result('Repay mortgage',{net:ia.wealth-ma.balance,invest:ia.wealth,mortgage:ma.balance,interest:ma.totalInterest,mortTax:ma.totalTaxBenefit,box3:ia.tax,label:'Comparable wealth*'});
    B=result('Invest instead',{net:ib.wealth-mb.balance,invest:ib.wealth,mortgage:mb.balance,interest:mb.totalInterest,mortTax:mb.totalTaxBenefit,box3:ib.tax,label:'Comparable wealth*'});
    note='*The home value is identical in both strategies, so it is excluded. Comparable wealth = investments − remaining mortgage.';
  }else if(S.mode==='linear-annuity'){
    const m=S.mortgage,ma=mortgage(S,m.balance,m.ratePct,m.years,'linear'),mb=mortgage(S,m.balance,m.ratePct,m.years,'annuity');
    cashA=ma.rows.map(r=>r.cash);cashB=mb.rows.map(r=>r.cash);
    const eq=FC.equalizeCashFlows(cashA,cashB),ia=investment(S,S.startPortfolio,eq.a),ib=investment(S,S.startPortfolio,eq.b);
    A=result('Linear mortgage',{net:ia.wealth-ma.balance,invest:ia.wealth,mortgage:ma.balance,interest:ma.totalInterest,mortTax:ma.totalTaxBenefit,box3:ia.tax,label:'Comparable wealth*'});
    B=result('Annuity mortgage',{net:ib.wealth-mb.balance,invest:ib.wealth,mortgage:mb.balance,interest:mb.totalInterest,mortTax:mb.totalTaxBenefit,box3:ib.tax,label:'Comparable wealth*'});
    note='*The same home is owned under both strategies, so its value is excluded. Monthly payment differences are invested and exposed to the selected Box 3 regime.';
  }else{
    const d=S.sellRent,m=S.mortgage,keep=mortgage(S,m.balance,m.ratePct,m.years,S.mortgageType);
    cashA=keep.rows.map(r=>r.cash+commonMonthly);cashB=rentSeries(S,d.monthlyRent);
    const eq=FC.equalizeCashFlows(cashA,cashB),sellingNow=d.homeValue*S.sellingCostPct/100,proceeds=d.homeValue-m.balance-sellingNow,short=Math.max(0,-proceeds);
    const ia=investment(S,S.startPortfolio,eq.a),ib=investment(S,S.startPortfolio+Math.max(0,proceeds),eq.b);
    const futureHome=futureHomeValue(S,d.homeValue),sellingFuture=futureHome*S.sellingCostPct/100,equity=futureHome-keep.balance-sellingFuture;
    A=result('Keep home',{net:ia.wealth+equity,invest:ia.wealth,equity,mortgage:keep.balance,interest:keep.totalInterest,mortTax:keep.totalTaxBenefit,owner:commonMonthly*S.months,selling:sellingFuture,box3:ia.tax});
    B=result('Sell now + rent/invest',{net:ib.wealth-short,invest:ib.wealth,equity:0,rent:sum(cashB),selling:sellingNow,box3:ib.tax,short});
    note=proceeds>=0?'Net sale proceeds are invested at the start of Strategy B.':'Sale proceeds do not fully repay mortgage + selling costs; the shortfall is deducted from Strategy B.';
  }
  return finalize(A,B,note,cashA,cashB);
}

return{runScenario,normalize};
});

if(typeof window!=='undefined'&&window.document){(()=>{
'use strict';
const FC=window.FinanceCore,SC=window.ScenarioCore;
if(!FC||!SC)throw new Error('FinanceCore and ScenarioCore must load before scenario UI');
const $=id=>document.getElementById(id);
const clamp=FC.clamp;
const num=(id,d=0)=>{const el=$(id);if(!el)return d;const v=Number(el.value);return Number.isFinite(v)?v:d};
const fmt=v=>'€'+Math.round(Number(v)||0).toLocaleString('nl-NL');
const pct=v=>(Number(v)||0).toLocaleString('nl-NL',{maximumFractionDigits:2})+'%';

const panel=$('tab-scenarios');
if(!panel||panel.dataset.decisionEngine==='1')return;
panel.dataset.decisionEngine='1';
[...panel.querySelectorAll(':scope > .card')].forEach(x=>x.classList.add('scenario-legacy-hidden'));
const firstDetails=panel.querySelector(':scope > details.fold');
if(firstDetails){const s=firstDetails.querySelector('summary');if(s)s.textContent='Final main-plan results'}
const divider=panel.querySelector(':scope > .section-divider');
if(divider){divider.querySelector('h2').textContent='Scenarios';divider.querySelector('p').textContent='Compare two financial strategies using the same starting wealth and the same monthly cash-flow capacity.'}

const engine=document.createElement('div');engine.id='decisionEngine';engine.innerHTML=`
<div class="card scenario-builder"><div class="section-head"><div><p class="section-label">1 · Choose the decision</p><p class="section-note">Start with one question. Only the relevant inputs are shown.</p></div></div><div class="grid3"><div class="field"><label for="comparisonType">What do you want to compare?</label><select id="comparisonType"><option value="buy-rent" selected>Buy a home vs Rent + invest</option><option value="downpayment">Larger down payment vs Smaller down payment + invest</option><option value="mortgage-invest">Extra mortgage repayment vs Invest</option><option value="linear-annuity">Linear vs Annuity + invest cash-flow difference</option><option value="sell-rent">Keep home vs Sell now + rent/invest</option></select></div><div class="field"><label for="scenarioHorizonNew">Comparison horizon, years</label><input id="scenarioHorizonNew" type="number" min="1" max="40" step="1" value="10"></div><div class="field"><label for="scenarioReturnNew">Investment return %</label><input id="scenarioReturnNew" type="number" min="-30" max="30" step="0.5" value="7"></div></div><div id="scenarioQuestionNoteNew" class="callout"></div>
<div class="scenario-specific-new" data-scenario="buy-rent"><div class="grid3 scenario-specific-grid-new"><div class="field"><label for="scenarioBuyPriceNew">House price</label><input id="scenarioBuyPriceNew" type="number" min="0" step="1000" value="350000"></div><div class="field"><label for="scenarioCashUpfrontNew">Cash available upfront</label><input id="scenarioCashUpfrontNew" type="number" min="0" step="1000" value="50000"></div><div class="field"><label for="scenarioDownPaymentNew">Down payment</label><input id="scenarioDownPaymentNew" type="number" min="0" step="1000" value="35000"></div><div class="field"><label for="scenarioRentNew">Monthly rent at scenario start</label><input id="scenarioRentNew" type="number" min="0" step="25" value="1600"><p class="inline">Use current rent or realistic comparable rent at the scenario start.</p></div><div class="field"><label for="scenarioBuyRateNew">Mortgage interest rate %</label><input id="scenarioBuyRateNew" type="number" min="0" max="20" step="0.01" value="4.00"></div><div class="field"><label for="scenarioBuyYearsNew">Mortgage term, years</label><input id="scenarioBuyYearsNew" type="number" min="1" max="40" step="1" value="30"></div></div></div>
<div class="scenario-specific-new hidden" data-scenario="downpayment"><div class="grid3 scenario-specific-grid-new"><div class="field"><label for="scenarioDpPriceNew">House price</label><input id="scenarioDpPriceNew" type="number" min="0" step="1000" value="350000"></div><div class="field"><label for="scenarioDpCashNew">Cash available upfront</label><input id="scenarioDpCashNew" type="number" min="0" step="1000" value="90000"></div><div class="field"><label for="scenarioDownANew">Strategy A down payment</label><input id="scenarioDownANew" type="number" min="0" step="1000" value="70000"></div><div class="field"><label for="scenarioDownBNew">Strategy B down payment</label><input id="scenarioDownBNew" type="number" min="0" step="1000" value="30000"></div><div class="field"><label for="scenarioDpRateNew">Mortgage interest rate %</label><input id="scenarioDpRateNew" type="number" min="0" max="20" step="0.01" value="4.00"></div><div class="field"><label for="scenarioDpYearsNew">Mortgage term, years</label><input id="scenarioDpYearsNew" type="number" min="1" max="40" step="1" value="30"></div></div></div>
<div class="scenario-specific-new hidden" data-scenario="mortgage-invest"><div class="grid2 scenario-specific-grid-new"><div class="field"><label for="scenarioExtraMonthlyNew">Extra amount available each month</label><input id="scenarioExtraMonthlyNew" type="number" min="0" step="50" value="500"></div><div class="callout"><strong>Uses your Mortgage tab.</strong><br><span>Balance, rate, term, selected repayment method and mortgage-interest deduction are reused.</span></div></div></div>
<div class="scenario-specific-new hidden" data-scenario="linear-annuity"><div class="callout"><strong>Uses your Mortgage tab.</strong> Both structures use the same balance, rate and term. The cheaper monthly strategy invests the difference.</div></div>
<div class="scenario-specific-new hidden" data-scenario="sell-rent"><div class="grid2 scenario-specific-grid-new"><div class="field"><label for="scenarioHomeValueNew">Current home value</label><input id="scenarioHomeValueNew" type="number" min="0" step="1000" value="400000"></div><div class="field"><label for="scenarioSellRentNew">Monthly rent at scenario start</label><input id="scenarioSellRentNew" type="number" min="0" step="25" value="1600"><p class="inline">Expected rent immediately after selling.</p></div></div></div></div>
<div class="card"><div class="section-head"><div><p class="section-label">2 · Shared assumptions</p><p class="section-note">Both strategies use the same economic assumptions. Box 3 comes from Investment and mortgage tax relief comes from Mortgage.</p></div></div><div class="grid3"><div class="field scenario-budget-field"><label for="scenarioMonthlyBudgetNew">Monthly housing + investing budget</label><input id="scenarioMonthlyBudgetNew" type="number" min="0" step="50" value="2500"><p class="inline">Affordability check only. Common surplus is excluded from the comparison.</p></div><div class="field"><label for="scenarioMortgageMethodNew">Mortgage method where relevant</label><select id="scenarioMortgageMethodNew"><option value="selected" selected>Use selected method from Mortgage</option><option value="linear">Linear</option><option value="annuity">Annuity</option></select></div><div class="field"><label for="scenarioHomeGrowthNew">Home value growth % / year</label><input id="scenarioHomeGrowthNew" type="number" min="-20" max="20" step="0.25" value="2"></div><div class="field"><label for="scenarioRentGrowthNew">Rent growth % / year</label><input id="scenarioRentGrowthNew" type="number" min="-10" max="20" step="0.25" value="2.5"></div><div class="field"><label for="scenarioSellingCostNew">Selling costs % of home value</label><input id="scenarioSellingCostNew" type="number" min="0" max="15" step="0.25" value="2"></div><div class="field"><label for="scenarioVveNew">VVE / service charges per month</label><input id="scenarioVveNew" type="number" min="0" step="25" value="250"></div><div class="field"><label for="scenarioMaintenanceNew">Other owner maintenance per year</label><input id="scenarioMaintenanceNew" type="number" min="0" step="100" value="1500"></div></div><div class="callout scenario-principle"><strong>Fair-cash-flow rule:</strong> both strategies are compared using the same required monthly capacity. The cheaper strategy invests the difference.</div><div id="scenarioBudgetStatusNew" class="callout scenario-budget-status"></div><div id="scenarioTaxNoteNew" class="foot"></div></div>
<div class="card"><div class="section-head"><div><p class="section-label">3 · Result</p><p class="section-note">Final comparable wealth is measured at the selected horizon after mortgage balances, investments, Box 3 and property sale costs where relevant.</p></div></div><div id="scenarioVerdictNew" class="scenario-verdict-new"></div><div class="compare-grid scenario-result-grid-new"><div class="strategy-result-new" id="strategyAResultNew"></div><div class="strategy-result-new" id="strategyBResultNew"></div></div><details class="inner-fold"><summary>Why the result looks this way</summary><div class="inner-fold-body"><div class="table-wrap scenario-table-wrap-new"><table class="scenario-table-new"><thead><tr><th>Driver</th><th id="strategyAHeadNew">Strategy A</th><th id="strategyBHeadNew">Strategy B</th></tr></thead><tbody id="scenarioBreakdownBodyNew"></tbody></table></div></div></details></div>
<details class="fold"><summary>Return sensitivity and crossover</summary><div class="fold-body"><p class="subsection-copy">Test whether the preferred strategy changes as assumed investment returns move.</p><div class="grid3 advanced-grid"><div class="field"><label for="sensitivityLowNew">Lowest return %</label><input id="sensitivityLowNew" type="number" min="-30" max="30" step="0.5" value="2"></div><div class="field"><label for="sensitivityHighNew">Highest return %</label><input id="sensitivityHighNew" type="number" min="-30" max="30" step="0.5" value="14"></div><div class="field"><label for="sensitivityStepNew">Step, percentage points</label><input id="sensitivityStepNew" type="number" min="0.5" max="10" step="0.5" value="2"></div></div><div id="sensitivitySummaryNew" class="callout"></div><div class="table-wrap sensitivity-wrap-new"><table class="scenario-table-new"><thead><tr><th>Investment return</th><th>Strategy A</th><th>Strategy B</th><th>Leader</th></tr></thead><tbody id="sensitivityBodyNew"></tbody></table></div></div></details>`;
if(divider)divider.insertAdjacentElement('afterend',engine);else panel.prepend(engine);

const style=document.createElement('style');style.textContent=`.scenario-legacy-hidden{display:none!important}.scenario-builder .scenario-specific-new{margin-top:14px;padding-top:14px;border-top:.5px solid var(--border)}.scenario-principle{margin-top:4px}.scenario-budget-status{margin-top:10px}.scenario-budget-status.warn{background:var(--amberbg);color:var(--amber)}.scenario-budget-warning{color:var(--amber)!important;font-weight:600}.scenario-verdict-new{background:var(--accentbg);border-radius:var(--small);padding:15px 17px;margin-bottom:12px;color:var(--secondary);font-size:13px;line-height:1.55}.scenario-verdict-new strong{display:block;color:var(--text);font-size:15px;margin-bottom:3px}.scenario-verdict-new small{display:block;color:var(--muted);margin-top:7px;font-size:11px}.scenario-result-grid-new{margin-top:4px}.strategy-result-new{border:1px solid var(--border);border-radius:var(--radius);padding:17px;background:var(--alt);min-width:0}.strategy-result-new.leader{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}.strategy-name-new{font-size:14px;font-weight:600}.strategy-label-new{font-size:11px;color:var(--muted);margin-top:3px}.strategy-value-new{font-size:24px;font-weight:600;letter-spacing:-.02em;margin:5px 0 12px}.strategy-mini-new{display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-top:.5px solid var(--border);font-size:11px}.strategy-mini-new span{color:var(--muted)}.strategy-mini-new strong{text-align:right}.scenario-table-wrap-new,.sensitivity-wrap-new{margin-top:10px;max-height:430px}.scenario-table-new{min-width:620px}.scenario-table-new th:first-child,.scenario-table-new td:first-child{text-align:left}@media(max-width:800px){.scenario-specific-grid-new{grid-template-columns:1fr}}`;document.head.appendChild(style);

function selectedMortType(){const v=$('scenarioMortgageMethodNew').value;if(v==='linear'||v==='annuity')return v;return document.querySelector('.compare-card.active[data-mort-type]')?.dataset.mortType||'annuity'}
function mainMortgage(){if($('mortgageMode')?.value==='purchase'){const price=Math.max(0,num('housePrice',0)),savings=Math.max(0,num('ownSavings',0)),cost=Math.max(0,num('purchaseCosts',0));return{balance:Math.max(0,price-Math.max(0,savings-cost)),ratePct:clamp(num('purchaseRate',4),0,20),years:clamp(num('purchaseYears',30),1,40)}}return{balance:Math.max(0,num('mortBalance',0)),ratePct:clamp(num('mortRate',4),0,20),years:clamp(num('mortYears',25),1,40)}}
function config(retOverride){
  return{
    mode:$('comparisonType').value,horizonYears:clamp(num('scenarioHorizonNew',10),1,40),investmentReturnPct:retOverride??clamp(num('scenarioReturnNew',7),-30,30),startYear:clamp(num('startYear',2026),2020,2100),startMonth:clamp(num('startMonth',1),1,12),startPortfolio:Math.max(0,num('startPortfolio',0)),purchaseCosts:Math.max(0,num('purchaseCosts',0)),mortgageType:selectedMortType(),mortgage:mainMortgage(),
    tax:{enabled:$('mortTaxEnabled')?.checked!==false,deductionRate:FC.deductionRate2026({mode:$('deductionMode')?.value||'auto',manualRatePct:num('manualDeduction',37.56),grossIncome:num('grossIncome',0)}),wozValue:Math.max(0,num('wozValue',0))},
    box3:{mode:$('box3Mode')?.value||'none',taxPartners:clamp(num('taxPartners',1),1,2),paySource:$('box3PaySource')?.value||'portfolio',currentTaxRate:clamp(num('currentTaxRate',36),0,100)/100,currentAllowance:Math.max(0,num('currentAllowance',59357)),currentNotional:clamp(num('currentNotional',6),0,30)/100,firstJan1Portfolio:Math.max(0,num('firstJan1Portfolio',0)),futureStart:clamp(num('futureStart',2028),2027,2100),futureTaxRate:clamp(num('futureTaxRate',36),0,100)/100,futureExempt:Math.max(0,num('futureExempt',1800)),futureLossThreshold:Math.max(0,num('futureLossThreshold',500))},
    homeGrowthPct:clamp(num('scenarioHomeGrowthNew',2),-20,20),rentGrowthPct:clamp(num('scenarioRentGrowthNew',2.5),-10,20),sellingCostPct:clamp(num('scenarioSellingCostNew',2),0,15),vveMonthly:Math.max(0,num('scenarioVveNew',250)),maintenanceAnnual:Math.max(0,num('scenarioMaintenanceNew',1500)),
    buyRent:{price:Math.max(0,num('scenarioBuyPriceNew',350000)),cash:Math.max(0,num('scenarioCashUpfrontNew',50000)),downPayment:Math.max(0,num('scenarioDownPaymentNew',35000)),monthlyRent:Math.max(0,num('scenarioRentNew',1600)),mortgageRatePct:clamp(num('scenarioBuyRateNew',4),0,20),mortgageYears:clamp(num('scenarioBuyYearsNew',30),1,40)},
    downpayment:{price:Math.max(0,num('scenarioDpPriceNew',350000)),cash:Math.max(0,num('scenarioDpCashNew',90000)),downA:Math.max(0,num('scenarioDownANew',70000)),downB:Math.max(0,num('scenarioDownBNew',30000)),mortgageRatePct:clamp(num('scenarioDpRateNew',4),0,20),mortgageYears:clamp(num('scenarioDpYearsNew',30),1,40)},
    mortgageInvest:{extraMonthly:Math.max(0,num('scenarioExtraMonthlyNew',500))},sellRent:{homeValue:Math.max(0,num('scenarioHomeValueNew',400000)),monthlyRent:Math.max(0,num('scenarioSellRentNew',1600))}
  };
}
function question(mode){if(mode==='buy-rent')return'Compares buying with renting using the same starting cash and monthly capacity.';if(mode==='downpayment')return'Compares using more cash to reduce the mortgage with keeping more cash invested.';if(mode==='mortgage-invest')return'Compares directing the same extra monthly amount to mortgage principal or investments.';if(mode==='linear-annuity')return'Compares total wealth, including mortgage tax relief and investing payment differences.';return'Compares keeping the current home with selling now, investing net proceeds and renting.'}
function visibility(){const mode=$('comparisonType').value;document.querySelectorAll('.scenario-specific-new').forEach(el=>el.classList.toggle('hidden',el.dataset.scenario!==mode));$('scenarioQuestionNoteNew').textContent=question(mode)}
function card(el,r,lead){el.className='strategy-result-new'+(lead?' leader':'');el.innerHTML=`<p class="strategy-name-new">${r.name}</p><p class="strategy-label-new">${r.label}</p><p class="strategy-value-new">${fmt(r.net)}</p><div class="strategy-mini-new"><span>Investments</span><strong>${fmt(r.invest)}</strong></div><div class="strategy-mini-new"><span>Mortgage remaining</span><strong>${fmt(r.mortgage)}</strong></div>${r.equity!==undefined&&r.equity!==null?`<div class="strategy-mini-new"><span>Home equity after sale costs</span><strong>${fmt(r.equity)}</strong></div>`:''}`}
function breakdown(A,B){$('strategyAHeadNew').textContent=A.name;$('strategyBHeadNew').textContent=B.name;const rows=[['Final comparable wealth',A.net,B.net],['Investment wealth after Box 3',A.invest,B.invest],['Home equity after selling costs',A.equity,B.equity],['Mortgage remaining',A.mortgage,B.mortgage],['Gross mortgage interest',A.interest,B.interest],['Mortgage tax benefit',A.mortTax,B.mortTax],['Rent paid',A.rent,B.rent],['VVE + other owner costs',A.owner,B.owner],['Purchase costs',A.purchase,B.purchase],['Selling costs used in comparison',A.selling,B.selling],['Box 3 tax',A.box3,B.box3],['Upfront cash shortfall',A.short,B.short]],body=$('scenarioBreakdownBodyNew');body.innerHTML='';rows.forEach(([l,a,b])=>{if((a===undefined||a===null)&&(b===undefined||b===null))return;const tr=document.createElement('tr');tr.innerHTML=`<td>${l}</td><td>${a===undefined||a===null?'—':fmt(a)}</td><td>${b===undefined||b===null?'—':fmt(b)}</td>`;body.appendChild(tr)})}
function budgetStatus(x){const budget=Math.max(0,num('scenarioMonthlyBudgetNew',0)),gap=x.peakRequirement-budget,el=$('scenarioBudgetStatusNew');el.classList.toggle('warn',gap>.01);el.innerHTML=gap<=.01?`<strong>Affordability check passed.</strong> Peak monthly requirement is ${fmt(x.peakRequirement)} against your ${fmt(budget)} budget.`:`<strong>Budget shortfall.</strong> Peak requirement is ${fmt(x.peakRequirement)}/mo, ${fmt(gap)}/mo above your budget.`;return gap}
function sensitivity(){let low=clamp(num('sensitivityLowNew',2),-30,30),high=clamp(num('sensitivityHighNew',14),-30,30),step=clamp(num('sensitivityStepNew',2),.5,10);if(high<low)[low,high]=[high,low];const rows=[];let prev=null,cross=null;for(let r=low;r<=high+1e-9&&rows.length<61;r+=step){const x=SC.runScenario(config(r)),d=x.A.net-x.B.net;if(prev&&Math.sign(prev.d)!==Math.sign(d)&&prev.d!==0&&d!==0)cross=prev.r+(r-prev.r)*(Math.abs(prev.d)/(Math.abs(prev.d)+Math.abs(d)));else if(d===0)cross=r;rows.push({r,A:x.A.net,B:x.B.net,d});prev={r,d}}const body=$('sensitivityBodyNew');body.innerHTML='';rows.forEach(x=>{const tr=document.createElement('tr');tr.innerHTML=`<td>${pct(x.r)}</td><td>${fmt(x.A)}</td><td>${fmt(x.B)}</td><td>${Math.abs(x.d)<1?'Tie':x.d>0?'A':'B'}</td>`;body.appendChild(tr)});$('sensitivitySummaryNew').innerHTML=cross===null?'<strong>No crossover found in this return range.</strong> One strategy leads throughout the tested range.':`<strong>Approximate crossover: ${pct(cross)} investment return.</strong> Around this point the modeled advantage changes sides.`}
function updateEngine(){visibility();const x=SC.runScenario(config()),d=x.A.net-x.B.net,a=d>1,b=d<-1;card($('strategyAResultNew'),x.A,a);card($('strategyBResultNew'),x.B,b);const lead=a?x.A.name:b?x.B.name:'Neither strategy',years=clamp(num('scenarioHorizonNew',10),1,40),gap=budgetStatus(x);$('scenarioVerdictNew').innerHTML=`<strong>${lead}${a||b?' leads by '+fmt(Math.abs(d)):' is clearly ahead'} after ${years} years.</strong><span> Based on ${pct(clamp(num('scenarioReturnNew',7),-30,30))} investment return and selected tax/mortgage assumptions.</span>${x.note?`<small>${x.note}</small>`:''}${gap>.01?`<small class="scenario-budget-warning">Affordability warning: peak monthly requirement exceeds budget by ${fmt(gap)}.</small>`:''}`;$('scenarioTaxNoteNew').textContent=`Box 3: ${$('box3Mode')?.selectedOptions?.[0]?.textContent||'not set'}. Mortgage-interest deduction: ${$('mortTaxEnabled')?.checked?'included':'ignored'}.`;breakdown(x.A,x.B);sensitivity()}
engine.addEventListener('input',updateEngine);engine.addEventListener('change',updateEngine);document.querySelectorAll('#tab-investment input,#tab-investment select,#tab-mortgage input,#tab-mortgage select').forEach(el=>{el.addEventListener('input',updateEngine);el.addEventListener('change',updateEngine)});updateEngine();
})();}
