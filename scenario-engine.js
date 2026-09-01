(()=>{
'use strict';

const FC=window.FinanceCore;
if(!FC)throw new Error('FinanceCore must load before scenario-engine.js');
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

const engine=document.createElement('div');
engine.id='decisionEngine';
engine.innerHTML=`
  <div class="card scenario-builder">
    <div class="section-head"><div><p class="section-label">1 · Choose the decision</p><p class="section-note">Start with one question. Only the inputs relevant to that comparison are shown.</p></div></div>
    <div class="grid3">
      <div class="field"><label for="comparisonType">What do you want to compare?</label><select id="comparisonType"><option value="buy-rent" selected>Buy a home vs Rent + invest</option><option value="downpayment">Larger down payment vs Smaller down payment + invest</option><option value="mortgage-invest">Extra mortgage repayment vs Invest</option><option value="linear-annuity">Linear vs Annuity + invest cash-flow difference</option><option value="sell-rent">Keep home vs Sell now + rent/invest</option></select></div>
      <div class="field"><label for="scenarioHorizonNew">Comparison horizon, years</label><input id="scenarioHorizonNew" type="number" min="1" max="40" step="1" value="10"></div>
      <div class="field"><label for="scenarioReturnNew">Investment return %</label><input id="scenarioReturnNew" type="number" min="-30" max="30" step="0.5" value="7"></div>
    </div>
    <div id="scenarioQuestionNoteNew" class="callout"></div>

    <div class="scenario-specific-new" data-scenario="buy-rent">
      <div class="grid3 scenario-specific-grid-new">
        <div class="field"><label for="scenarioBuyPriceNew">House price</label><input id="scenarioBuyPriceNew" type="number" min="0" step="1000" value="350000"></div>
        <div class="field"><label for="scenarioCashUpfrontNew">Cash available upfront</label><input id="scenarioCashUpfrontNew" type="number" min="0" step="1000" value="50000"></div>
        <div class="field"><label for="scenarioDownPaymentNew">Down payment</label><input id="scenarioDownPaymentNew" type="number" min="0" step="1000" value="35000"></div>
        <div class="field"><label for="scenarioRentNew">Monthly rent at scenario start</label><input id="scenarioRentNew" type="number" min="0" step="25" value="1600"><p class="inline">Use the rent you pay now, or a realistic comparable rent at the start of the scenario.</p></div>
        <div class="field"><label for="scenarioBuyRateNew">Mortgage interest rate %</label><input id="scenarioBuyRateNew" type="number" min="0" max="20" step="0.01" value="4.00"></div>
        <div class="field"><label for="scenarioBuyYearsNew">Mortgage term, years</label><input id="scenarioBuyYearsNew" type="number" min="1" max="40" step="1" value="30"></div>
      </div>
    </div>

    <div class="scenario-specific-new hidden" data-scenario="downpayment">
      <div class="grid3 scenario-specific-grid-new">
        <div class="field"><label for="scenarioDpPriceNew">House price</label><input id="scenarioDpPriceNew" type="number" min="0" step="1000" value="350000"></div>
        <div class="field"><label for="scenarioDpCashNew">Cash available upfront</label><input id="scenarioDpCashNew" type="number" min="0" step="1000" value="90000"></div>
        <div class="field"><label for="scenarioDownANew">Strategy A down payment</label><input id="scenarioDownANew" type="number" min="0" step="1000" value="70000"></div>
        <div class="field"><label for="scenarioDownBNew">Strategy B down payment</label><input id="scenarioDownBNew" type="number" min="0" step="1000" value="30000"></div>
        <div class="field"><label for="scenarioDpRateNew">Mortgage interest rate %</label><input id="scenarioDpRateNew" type="number" min="0" max="20" step="0.01" value="4.00"></div>
        <div class="field"><label for="scenarioDpYearsNew">Mortgage term, years</label><input id="scenarioDpYearsNew" type="number" min="1" max="40" step="1" value="30"></div>
      </div>
    </div>

    <div class="scenario-specific-new hidden" data-scenario="mortgage-invest"><div class="grid2 scenario-specific-grid-new"><div class="field"><label for="scenarioExtraMonthlyNew">Extra amount available each month</label><input id="scenarioExtraMonthlyNew" type="number" min="0" step="50" value="500"></div><div class="callout"><strong>Uses your Mortgage tab.</strong><br><span>Current balance, rate, remaining term, selected repayment method and mortgage-interest deduction are reused.</span></div></div></div>
    <div class="scenario-specific-new hidden" data-scenario="linear-annuity"><div class="callout"><strong>Uses your Mortgage tab.</strong> Both structures are recalculated from the same balance, rate and term. Each month, the cheaper strategy invests the cash-flow difference.</div></div>
    <div class="scenario-specific-new hidden" data-scenario="sell-rent"><div class="grid2 scenario-specific-grid-new"><div class="field"><label for="scenarioHomeValueNew">Current home value</label><input id="scenarioHomeValueNew" type="number" min="0" step="1000" value="400000"></div><div class="field"><label for="scenarioSellRentNew">Monthly rent at scenario start</label><input id="scenarioSellRentNew" type="number" min="0" step="25" value="1600"><p class="inline">Expected rent immediately after selling the home.</p></div></div></div>
  </div>

  <div class="card">
    <div class="section-head"><div><p class="section-label">2 · Shared assumptions</p><p class="section-note">Both strategies use the same economic assumptions. Box 3 comes from Investment and mortgage tax relief comes from Mortgage.</p></div></div>
    <div class="grid3">
      <div class="field scenario-budget-field"><label for="scenarioMonthlyBudgetNew">Monthly housing + investing budget</label><input id="scenarioMonthlyBudgetNew" type="number" min="0" step="50" value="2500"><p class="inline">Affordability check only. Surplus common to both strategies is excluded from the comparison.</p></div>
      <div class="field"><label for="scenarioMortgageMethodNew">Mortgage method where relevant</label><select id="scenarioMortgageMethodNew"><option value="selected" selected>Use selected method from Mortgage</option><option value="linear">Linear</option><option value="annuity">Annuity</option></select></div>
      <div class="field"><label for="scenarioHomeGrowthNew">Home value growth % / year</label><input id="scenarioHomeGrowthNew" type="number" min="-20" max="20" step="0.25" value="2"></div>
      <div class="field"><label for="scenarioRentGrowthNew">Rent growth % / year</label><input id="scenarioRentGrowthNew" type="number" min="-10" max="20" step="0.25" value="2.5"></div>
      <div class="field"><label for="scenarioSellingCostNew">Selling costs % of home value</label><input id="scenarioSellingCostNew" type="number" min="0" max="15" step="0.25" value="2"></div>
      <div class="field"><label for="scenarioVveNew">VVE / service charges per month</label><input id="scenarioVveNew" type="number" min="0" step="25" value="250"></div>
      <div class="field"><label for="scenarioMaintenanceNew">Other owner maintenance per year</label><input id="scenarioMaintenanceNew" type="number" min="0" step="100" value="1500"></div>
    </div>
    <div class="callout scenario-principle"><strong>Fair-cash-flow rule:</strong> both strategies are compared using the same required monthly cash-flow capacity. The lower-cash-outflow strategy invests the difference.</div>
    <div id="scenarioBudgetStatusNew" class="callout scenario-budget-status"></div>
    <div id="scenarioTaxNoteNew" class="foot"></div>
  </div>

  <div class="card">
    <div class="section-head"><div><p class="section-label">3 · Result</p><p class="section-note">Final comparable wealth is measured at the selected horizon after mortgage balances, investments, Box 3 and property sale costs where relevant.</p></div></div>
    <div id="scenarioVerdictNew" class="scenario-verdict-new"></div>
    <div class="compare-grid scenario-result-grid-new"><div class="strategy-result-new" id="strategyAResultNew"></div><div class="strategy-result-new" id="strategyBResultNew"></div></div>
    <details class="inner-fold"><summary>Why the result looks this way</summary><div class="inner-fold-body"><div class="table-wrap scenario-table-wrap-new"><table class="scenario-table-new"><thead><tr><th>Driver</th><th id="strategyAHeadNew">Strategy A</th><th id="strategyBHeadNew">Strategy B</th></tr></thead><tbody id="scenarioBreakdownBodyNew"></tbody></table></div></div></details>
  </div>

  <details class="fold"><summary>Return sensitivity and crossover</summary><div class="fold-body"><p class="subsection-copy">Test whether the preferred strategy changes when investment returns move, including strong-market stress assumptions such as 12–14%.</p><div class="grid3 advanced-grid"><div class="field"><label for="sensitivityLowNew">Lowest return %</label><input id="sensitivityLowNew" type="number" min="-30" max="30" step="0.5" value="2"></div><div class="field"><label for="sensitivityHighNew">Highest return %</label><input id="sensitivityHighNew" type="number" min="-30" max="30" step="0.5" value="14"></div><div class="field"><label for="sensitivityStepNew">Step, percentage points</label><input id="sensitivityStepNew" type="number" min="0.5" max="10" step="0.5" value="2"></div></div><div id="sensitivitySummaryNew" class="callout"></div><div class="table-wrap sensitivity-wrap-new"><table class="scenario-table-new"><thead><tr><th>Investment return</th><th>Strategy A</th><th>Strategy B</th><th>Leader</th></tr></thead><tbody id="sensitivityBodyNew"></tbody></table></div></div></details>
`;
if(divider)divider.insertAdjacentElement('afterend',engine);else panel.prepend(engine);

const style=document.createElement('style');
style.textContent=`
.scenario-legacy-hidden{display:none!important}.scenario-builder .scenario-specific-new{margin-top:14px;padding-top:14px;border-top:.5px solid var(--border)}.scenario-principle{margin-top:4px}.scenario-budget-status{margin-top:10px}.scenario-budget-status.warn{background:var(--amberbg);color:var(--amber)}.scenario-budget-warning{color:var(--amber)!important;font-weight:600}.scenario-verdict-new{background:var(--accentbg);border-radius:var(--small);padding:15px 17px;margin-bottom:12px;color:var(--secondary);font-size:13px;line-height:1.55}.scenario-verdict-new strong{display:block;color:var(--text);font-size:15px;margin-bottom:3px}.scenario-verdict-new small{display:block;color:var(--muted);margin-top:7px;font-size:11px}.scenario-result-grid-new{margin-top:4px}.strategy-result-new{border:1px solid var(--border);border-radius:var(--radius);padding:17px;background:var(--alt);min-width:0}.strategy-result-new.leader{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}.strategy-name-new{font-size:14px;font-weight:600}.strategy-label-new{font-size:11px;color:var(--muted);margin-top:3px}.strategy-value-new{font-size:24px;font-weight:600;letter-spacing:-.02em;margin:5px 0 12px}.strategy-mini-new{display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-top:.5px solid var(--border);font-size:11px}.strategy-mini-new span{color:var(--muted)}.strategy-mini-new strong{text-align:right}.scenario-table-wrap-new,.sensitivity-wrap-new{margin-top:10px;max-height:430px}.scenario-table-new{min-width:620px}.scenario-table-new th:first-child,.scenario-table-new td:first-child{text-align:left}@media(max-width:800px){.scenario-specific-grid-new{grid-template-columns:1fr}}`;
document.head.appendChild(style);

function purchaseCosts(){return Math.max(0,num('purchaseCosts',0))}
function taxConfig(){return{enabled:$('mortTaxEnabled')?.checked!==false,deductionRate:FC.deductionRate2026({mode:$('deductionMode')?.value||'auto',manualRatePct:num('manualDeduction',37.56),grossIncome:num('grossIncome',0)}),wozValue:Math.max(0,num('wozValue',0))}}
function selectedMortType(){const v=$('scenarioMortgageMethodNew').value;if(v==='linear'||v==='annuity')return v;return document.querySelector('.compare-card.active[data-mort-type]')?.dataset.mortType||'annuity'}
function mainMortgage(){
  if($('mortgageMode')?.value==='purchase'){
    const price=Math.max(0,num('housePrice',0)),savings=Math.max(0,num('ownSavings',0)),cost=purchaseCosts();
    return{balance:Math.max(0,price-Math.max(0,savings-cost)),rate:clamp(num('purchaseRate',4),0,20),years:clamp(num('purchaseYears',30),1,40)};
  }
  return{balance:Math.max(0,num('mortBalance',0)),rate:clamp(num('mortRate',4),0,20),years:clamp(num('mortYears',25),1,40)};
}
function mortgage(balance,rate,years,type,months,extraMonthly=0){
  return FC.mortgageSchedule({balance,annualRatePct:rate,termYears:years,type,months,extraMonthly,startYear:clamp(num('startYear',2026),2020,2100),startMonth:clamp(num('startMonth',1),1,12),tax:taxConfig()});
}
function investment(initial,flows,ret){
  const x=FC.simulateInvestmentFlows({initialPortfolio:Math.max(0,initial),flows,annualReturnPct:ret,startYear:clamp(num('startYear',2026),2020,2100),startMonth:clamp(num('startMonth',1),1,12),box3Mode:$('box3Mode')?.value||'none',taxPartners:clamp(num('taxPartners',1),1,2),paySource:$('box3PaySource')?.value||'portfolio',currentTaxRate:clamp(num('currentTaxRate',36),0,100)/100,currentAllowance:Math.max(0,num('currentAllowance',59357)),currentNotional:clamp(num('currentNotional',6),0,30)/100,firstJan1Portfolio:Math.max(0,num('firstJan1Portfolio',0)),futureStart:clamp(num('futureStart',2028),2027,2100),futureTaxRate:clamp(num('futureTaxRate',36),0,100)/100,futureExempt:Math.max(0,num('futureExempt',1800)),futureLossThreshold:Math.max(0,num('futureLossThreshold',500))});
  return{wealth:x.comparableWealth,portfolio:x.portfolio,tax:x.totalTax};
}
function base(retOverride){
  const ret=retOverride??clamp(num('scenarioReturnNew',7),-30,30),months=Math.max(12,Math.round(clamp(num('scenarioHorizonNew',10),1,40)*12));
  return{ret,months,homeGrowth:clamp(num('scenarioHomeGrowthNew',2),-20,20)/100/12,rentGrowth:clamp(num('scenarioRentGrowthNew',2.5),-10,20)/100/12,sellPct:clamp(num('scenarioSellingCostNew',2),0,15)/100,vve:Math.max(0,num('scenarioVveNew',250)),maint:Math.max(0,num('scenarioMaintenanceNew',1500))/12,mort:mainMortgage(),startPortfolio:Math.max(0,num('startPortfolio',0))};
}
function result(name,v){return{name,net:v.net||0,invest:v.invest||0,equity:v.equity,mortgage:v.mortgage||0,interest:v.interest||0,mortTax:v.mortTax||0,rent:v.rent||0,owner:v.owner||0,purchase:v.purchase||0,selling:v.selling||0,box3:v.box3||0,short:v.short||0,label:v.label||'Final net worth'}}
function rents(start,n,growth){return Array.from({length:n},(_,m)=>Math.max(0,start)*Math.pow(1+growth,m))}
function ownerCash(schedule,common){return schedule.rows.map((r,i)=>r.cash+(common[i]||0))}

function run(retOverride){
  const S=base(retOverride),mode=$('comparisonType').value,n=S.months,homeAt=p=>p*Math.pow(1+S.homeGrowth,n),common=Array(n).fill(S.vve+S.maint);let A,B,note='',cashA=[],cashB=[];
  if(mode==='buy-rent'){
    const price=Math.max(0,num('scenarioBuyPriceNew',350000)),cash=Math.max(0,num('scenarioCashUpfrontNew',50000)),down=Math.min(price,Math.max(0,num('scenarioDownPaymentNew',35000))),cost=purchaseCosts(),loan=price-down,m=mortgage(loan,clamp(num('scenarioBuyRateNew',4),0,20),clamp(num('scenarioBuyYearsNew',30),1,40),selectedMortType(),n),rent=rents(num('scenarioRentNew',1600),n,S.rentGrowth);cashA=ownerCash(m,common);cashB=rent;const eq=FC.equalizeCashFlows(cashA,cashB),need=cost+down,short=Math.max(0,need-cash),ia=investment(Math.max(0,cash-need),eq.a,S.ret),ib=investment(cash,eq.b,S.ret),hv=homeAt(price),sale=hv*S.sellPct,equity=hv-m.balance-sale;
    A=result('Buy home',{net:ia.wealth+equity-short,invest:ia.wealth,equity,mortgage:m.balance,interest:m.totalInterest,mortTax:m.totalTaxBenefit,owner:(S.vve+S.maint)*n,purchase:cost,selling:sale,box3:ia.tax,short});B=result('Rent + invest',{net:ib.wealth,invest:ib.wealth,equity:0,rent:rent.reduce((x,y)=>x+y,0),box3:ib.tax});note=short>0?'The entered cash does not cover down payment + purchase costs; the shortfall is deducted from Strategy A.':'';
  }else if(mode==='downpayment'){
    const price=Math.max(0,num('scenarioDpPriceNew',350000)),cash=Math.max(0,num('scenarioDpCashNew',90000)),da=Math.min(price,Math.max(0,num('scenarioDownANew',70000))),db=Math.min(price,Math.max(0,num('scenarioDownBNew',30000))),cost=purchaseCosts(),rate=clamp(num('scenarioDpRateNew',4),0,20),years=clamp(num('scenarioDpYearsNew',30),1,40),ma=mortgage(price-da,rate,years,selectedMortType(),n),mb=mortgage(price-db,rate,years,selectedMortType(),n);cashA=ownerCash(ma,common);cashB=ownerCash(mb,common);const eq=FC.equalizeCashFlows(cashA,cashB),na=cost+da,nb=cost+db,sa=Math.max(0,na-cash),sb=Math.max(0,nb-cash),ia=investment(Math.max(0,cash-na),eq.a,S.ret),ib=investment(Math.max(0,cash-nb),eq.b,S.ret),hv=homeAt(price),sale=hv*S.sellPct,ea=hv-ma.balance-sale,eb=hv-mb.balance-sale;
    A=result('Down payment '+fmt(da),{net:ia.wealth+ea-sa,invest:ia.wealth,equity:ea,mortgage:ma.balance,interest:ma.totalInterest,mortTax:ma.totalTaxBenefit,owner:(S.vve+S.maint)*n,purchase:cost,selling:sale,box3:ia.tax,short:sa});B=result('Down payment '+fmt(db)+' + invest',{net:ib.wealth+eb-sb,invest:ib.wealth,equity:eb,mortgage:mb.balance,interest:mb.totalInterest,mortTax:mb.totalTaxBenefit,owner:(S.vve+S.maint)*n,purchase:cost,selling:sale,box3:ib.tax,short:sb});note=(sa||sb)?'One strategy needs more upfront cash than entered; the shortfall is deducted from comparable wealth.':'';
  }else if(mode==='mortgage-invest'){
    const extra=Math.max(0,num('scenarioExtraMonthlyNew',500)),ma=mortgage(S.mort.balance,S.mort.rate,S.mort.years,selectedMortType(),n,extra),mb=mortgage(S.mort.balance,S.mort.rate,S.mort.years,selectedMortType(),n,0);cashA=ma.rows.map(r=>r.cash);cashB=mb.rows.map(r=>r.cash);const eq=FC.equalizeCashFlows(cashA,cashB),ia=investment(S.startPortfolio,eq.a,S.ret),ib=investment(S.startPortfolio,eq.b,S.ret);
    A=result('Repay mortgage +'+fmt(extra)+'/mo',{net:ia.wealth-ma.balance,invest:ia.wealth,mortgage:ma.balance,interest:ma.totalInterest,mortTax:ma.totalTaxBenefit,box3:ia.tax,label:'Comparable wealth*'});B=result('Invest the '+fmt(extra)+'/mo',{net:ib.wealth-mb.balance,invest:ib.wealth,mortgage:mb.balance,interest:mb.totalInterest,mortTax:mb.totalTaxBenefit,box3:ib.tax,label:'Comparable wealth*'});note='*The home value is identical in both strategies, so it is excluded. Comparable wealth = investments − remaining mortgage.';
  }else if(mode==='linear-annuity'){
    const ma=mortgage(S.mort.balance,S.mort.rate,S.mort.years,'linear',n),mb=mortgage(S.mort.balance,S.mort.rate,S.mort.years,'annuity',n);cashA=ma.rows.map(r=>r.cash);cashB=mb.rows.map(r=>r.cash);const eq=FC.equalizeCashFlows(cashA,cashB),ia=investment(S.startPortfolio,eq.a,S.ret),ib=investment(S.startPortfolio,eq.b,S.ret);
    A=result('Linear mortgage',{net:ia.wealth-ma.balance,invest:ia.wealth,mortgage:ma.balance,interest:ma.totalInterest,mortTax:ma.totalTaxBenefit,box3:ia.tax,label:'Comparable wealth*'});B=result('Annuity mortgage',{net:ib.wealth-mb.balance,invest:ib.wealth,mortgage:mb.balance,interest:mb.totalInterest,mortTax:mb.totalTaxBenefit,box3:ib.tax,label:'Comparable wealth*'});note='*The same home is owned under both strategies, so its value is excluded. Monthly payment differences are invested and exposed to the selected Box 3 regime.';
  }else{
    const home=Math.max(0,num('scenarioHomeValueNew',400000)),rent=rents(num('scenarioSellRentNew',1600),n,S.rentGrowth),keep=mortgage(S.mort.balance,S.mort.rate,S.mort.years,selectedMortType(),n);cashA=ownerCash(keep,common);cashB=rent;const eq=FC.equalizeCashFlows(cashA,cashB),saleNow=home*S.sellPct,proceeds=home-S.mort.balance-saleNow,short=Math.max(0,-proceeds),ia=investment(S.startPortfolio,eq.a,S.ret),ib=investment(S.startPortfolio+Math.max(0,proceeds),eq.b,S.ret),hv=homeAt(home),saleFuture=hv*S.sellPct,equity=hv-keep.balance-saleFuture;
    A=result('Keep home',{net:ia.wealth+equity,invest:ia.wealth,equity,mortgage:keep.balance,interest:keep.totalInterest,mortTax:keep.totalTaxBenefit,owner:(S.vve+S.maint)*n,selling:saleFuture,box3:ia.tax});B=result('Sell now + rent/invest',{net:ib.wealth-short,invest:ib.wealth,equity:0,rent:rent.reduce((x,y)=>x+y,0),selling:saleNow,box3:ib.tax,short});note=proceeds>=0?'Net sale proceeds of '+fmt(proceeds)+' are invested at the start of Strategy B.':'Sale proceeds do not fully repay mortgage + selling costs; the shortfall is deducted from Strategy B.';
  }
  return{A,B,note,cashA,cashB};
}

function question(mode){if(mode==='buy-rent')return'Compares buying with renting while keeping starting cash and monthly cash-flow capacity equal. The renter invests unused upfront cash and any monthly housing-cost advantage.';if(mode==='downpayment')return'Compares using more cash to reduce the mortgage with keeping more cash invested. Both strategies buy the same home.';if(mode==='mortgage-invest')return'Compares directing the same extra monthly amount to mortgage principal or to investments. Earlier mortgage payoff automatically frees cash to invest.';if(mode==='linear-annuity')return'Compares total wealth rather than interest alone. Mortgage tax relief and Box 3 on invested payment differences are included.';return'Compares continuing to own the current home with selling now, investing the net proceeds and renting. Monthly cash flow is equalized.'}
function visibility(){const mode=$('comparisonType').value;document.querySelectorAll('.scenario-specific-new').forEach(el=>el.classList.toggle('hidden',el.dataset.scenario!==mode));$('scenarioQuestionNoteNew').textContent=question(mode)}
function card(el,r,lead){el.className='strategy-result-new'+(lead?' leader':'');el.innerHTML=`<p class="strategy-name-new">${r.name}</p><p class="strategy-label-new">${r.label}</p><p class="strategy-value-new">${fmt(r.net)}</p><div class="strategy-mini-new"><span>Investments</span><strong>${fmt(r.invest)}</strong></div><div class="strategy-mini-new"><span>Mortgage remaining</span><strong>${fmt(r.mortgage)}</strong></div>${r.equity!==undefined&&r.equity!==null?`<div class="strategy-mini-new"><span>Home equity after sale costs</span><strong>${fmt(r.equity)}</strong></div>`:''}`}
function breakdown(A,B){$('strategyAHeadNew').textContent=A.name;$('strategyBHeadNew').textContent=B.name;const rows=[['Final comparable wealth',A.net,B.net],['Investment wealth after Box 3',A.invest,B.invest],['Home equity after selling costs',A.equity,B.equity],['Mortgage remaining',A.mortgage,B.mortgage],['Gross mortgage interest',A.interest,B.interest],['Mortgage tax benefit',A.mortTax,B.mortTax],['Rent paid',A.rent,B.rent],['VVE + other owner costs',A.owner,B.owner],['Purchase costs',A.purchase,B.purchase],['Selling costs used in comparison',A.selling,B.selling],['Box 3 tax',A.box3,B.box3],['Upfront cash shortfall',A.short,B.short]],body=$('scenarioBreakdownBodyNew');body.innerHTML='';rows.forEach(([l,a,b])=>{if((a===undefined||a===null)&&(b===undefined||b===null))return;const tr=document.createElement('tr');tr.innerHTML=`<td>${l}</td><td>${a===undefined||a===null?'—':fmt(a)}</td><td>${b===undefined||b===null?'—':fmt(b)}</td>`;body.appendChild(tr)})}

function updateBudget(x){
  const required=x.cashA.map((a,i)=>Math.max(Math.max(0,a||0),Math.max(0,x.cashB[i]||0))),peak=Math.max(0,...required),budget=Math.max(0,num('scenarioMonthlyBudgetNew',0)),gap=peak-budget,status=$('scenarioBudgetStatusNew');
  status.classList.toggle('warn',gap>.01);
  status.innerHTML=gap<=.01?`<strong>Affordability check passed.</strong> Peak monthly requirement across the two strategies is ${fmt(peak)}. Your entered budget is ${fmt(budget)}.`:`<strong>Budget shortfall.</strong> One strategy needs up to ${fmt(peak)}/mo, which is ${fmt(gap)}/mo above your entered ${fmt(budget)} budget.`;
  return{peak,budget,gap};
}

function sensitivity(){
  let low=clamp(num('sensitivityLowNew',2),-30,30),high=clamp(num('sensitivityHighNew',14),-30,30),step=clamp(num('sensitivityStepNew',2),.5,10);if(high<low)[low,high]=[high,low];const rows=[];let prev=null,cross=null;
  for(let r=low;r<=high+1e-9&&rows.length<61;r+=step){const x=run(r),d=x.A.net-x.B.net;if(prev&&Math.sign(prev.d)!==Math.sign(d)&&prev.d!==0&&d!==0)cross=prev.r+(r-prev.r)*(Math.abs(prev.d)/(Math.abs(prev.d)+Math.abs(d)));else if(d===0)cross=r;rows.push({r,A:x.A.net,B:x.B.net,d});prev={r,d}}
  const body=$('sensitivityBodyNew');body.innerHTML='';rows.forEach(x=>{const tr=document.createElement('tr');tr.innerHTML=`<td>${pct(x.r)}</td><td>${fmt(x.A)}</td><td>${fmt(x.B)}</td><td>${Math.abs(x.d)<1?'Tie':x.d>0?'A':'B'}</td>`;body.appendChild(tr)});
  $('sensitivitySummaryNew').innerHTML=cross===null?'<strong>No crossover found in this return range.</strong> One strategy leads throughout the tested range.':`<strong>Approximate crossover: ${pct(cross)} investment return.</strong> Around this point the modeled wealth advantage changes sides. This is a numerical estimate, not a forecast.`;
}

function updateEngine(){
  visibility();const x=run(),d=x.A.net-x.B.net,a=d>1,b=d<-1,budget=updateBudget(x);card($('strategyAResultNew'),x.A,a);card($('strategyBResultNew'),x.B,b);const lead=a?x.A.name:b?x.B.name:'Neither strategy',years=clamp(num('scenarioHorizonNew',10),1,40);
  $('scenarioVerdictNew').innerHTML=`<strong>${lead}${a||b?' leads by '+fmt(Math.abs(d)):' is clearly ahead'} after ${years} years.</strong><span> Based on ${pct(clamp(num('scenarioReturnNew',7),-30,30))} investment return and the selected tax/mortgage assumptions.</span>${x.note?`<small>${x.note}</small>`:''}${budget.gap>.01?`<small class="scenario-budget-warning">Affordability warning: peak monthly requirement exceeds budget by ${fmt(budget.gap)}.</small>`:''}`;
  $('scenarioTaxNoteNew').textContent=`Box 3: ${$('box3Mode')?.selectedOptions?.[0]?.textContent||'not set'}. Mortgage-interest deduction: ${$('mortTaxEnabled')?.checked?'included':'ignored'}. The Scenario engine now uses the same shared tax and mortgage functions as the main planner, including the Jan 1 portfolio override for a mid-year start.`;
  breakdown(x.A,x.B);sensitivity();
}

engine.addEventListener('input',updateEngine);engine.addEventListener('change',updateEngine);
document.querySelectorAll('#tab-investment input,#tab-investment select,#tab-mortgage input,#tab-mortgage select').forEach(el=>{el.addEventListener('input',updateEngine);el.addEventListener('change',updateEngine)});
updateEngine();
})();
