(function(root,factory){
  const SC=typeof module==='object'&&module.exports?require('./scenario-engine.js'):root.ScenarioCore;
  const api=factory(SC);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.NextEuroCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(SC){
'use strict';
if(!SC)throw new Error('ScenarioCore is required by NextEuroCore');

function clone(value){return JSON.parse(JSON.stringify(value||{}))}
function positive(v,fallback=0){const n=Number(v);return Number.isFinite(n)&&n>=0?n:fallback}

function scenarioConfig(baseConfig,{amount,years,returnPct}){
  const cfg=clone(baseConfig);
  cfg.mode='mortgage-invest';
  cfg.horizonYears=Math.max(1,positive(years,10));
  delete cfg.months;
  cfg.investmentReturnPct=Number(returnPct)||0;
  cfg.mortgageInvest={extraMonthly:positive(amount,0)};
  return cfg;
}

function differenceAtRate(baseConfig,{amount,years,returnPct}){
  const scenario=SC.runScenario(scenarioConfig(baseConfig,{amount,years,returnPct}));
  if(scenario.valid===false)return NaN;
  return scenario.B.net-scenario.A.net;
}

function findBreakEvenReturn(baseConfig,{amount=500,years=10,minRate=-20,maxRate=30,tolerance=1e-5,maxIterations=90}={}){
  const monthlyAmount=positive(amount,0),horizon=Math.max(1,positive(years,10));
  const mortgageBalance=positive(baseConfig?.mortgage?.balance,0);
  if(monthlyAmount<=0||mortgageBalance<=0)return{valid:false,breakEven:null,reason:monthlyAmount<=0?'Enter an extra monthly amount above zero.':'Enter a mortgage balance above zero.'};
  let low=Number(minRate),high=Number(maxRate);
  if(!Number.isFinite(low))low=-20;if(!Number.isFinite(high))high=30;if(high<low)[low,high]=[high,low];
  let dLow=differenceAtRate(baseConfig,{amount:monthlyAmount,years:horizon,returnPct:low});
  let dHigh=differenceAtRate(baseConfig,{amount:monthlyAmount,years:horizon,returnPct:high});
  if(!Number.isFinite(dLow)||!Number.isFinite(dHigh))return{valid:false,breakEven:null,reason:'The comparison could not be calculated with the selected inputs.'};
  const atLow={rate:low,difference:dLow},atHigh={rate:high,difference:dHigh};
  if(Math.abs(dLow)<=.01)return{valid:true,breakEven:low,atLow,atHigh,bracketed:true};
  if(Math.abs(dHigh)<=.01)return{valid:true,breakEven:high,atLow,atHigh,bracketed:true};
  if(Math.sign(dLow)===Math.sign(dHigh))return{valid:true,breakEven:null,atLow,atHigh,bracketed:false,reason:dLow>0&&dHigh>0?'Investing leads throughout the tested return range.':'Mortgage repayment leads throughout the tested return range.'};
  for(let i=0;i<maxIterations;i++){
    const mid=(low+high)/2,dMid=differenceAtRate(baseConfig,{amount:monthlyAmount,years:horizon,returnPct:mid});
    if(!Number.isFinite(dMid))return{valid:false,breakEven:null,reason:'The comparison became invalid while solving the break-even return.'};
    if(Math.abs(dMid)<=.01||Math.abs(high-low)<=tolerance)return{valid:true,breakEven:mid,difference:dMid,iterations:i+1,atLow,atHigh,bracketed:true};
    if(Math.sign(dMid)===Math.sign(dLow)){low=mid;dLow=dMid}else{high=mid;dHigh=dMid}
  }
  return{valid:true,breakEven:(low+high)/2,difference:differenceAtRate(baseConfig,{amount:monthlyAmount,years:horizon,returnPct:(low+high)/2}),iterations:maxIterations,atLow,atHigh,bracketed:true};
}

function analyseNextEuro(baseConfig,{amount=500,years=10,assumedReturnPct=5,quickAmounts=[250,500,1000],minRate=-20,maxRate=30}={}){
  const main=findBreakEvenReturn(baseConfig,{amount,years,minRate,maxRate});
  const scenario=SC.runScenario(scenarioConfig(baseConfig,{amount,years,returnPct:assumedReturnPct}));
  const difference=scenario.valid===false?NaN:scenario.B.net-scenario.A.net;
  const quick=quickAmounts.map(x=>{const a=positive(x,0),be=findBreakEvenReturn(baseConfig,{amount:a,years,minRate,maxRate});const s=SC.runScenario(scenarioConfig(baseConfig,{amount:a,years,returnPct:assumedReturnPct}));const d=s.valid===false?NaN:s.B.net-s.A.net;return{amount:a,breakEven:be.breakEven,valid:be.valid,difference:d,winner:Number.isFinite(d)?(Math.abs(d)<1?'Tie':d>0?'Invest':'Repay'):'Unavailable'};});
  return{main,amount:positive(amount,0),years:Math.max(1,positive(years,10)),assumedReturnPct:Number(assumedReturnPct)||0,difference,winner:Number.isFinite(difference)?(Math.abs(difference)<1?'Tie':difference>0?'Invest':'Repay'):'Unavailable',scenario,quick};
}

return{scenarioConfig,differenceAtRate,findBreakEvenReturn,analyseNextEuro};
});

if(typeof window!=='undefined'&&window.document&&window.FinanceCore&&window.ScenarioCore){(()=>{
'use strict';
const FC=window.FinanceCore,SC=window.ScenarioCore,NE=window.NextEuroCore;
const $=id=>document.getElementById(id);
const clamp=FC.clamp;
const num=(id,d=0)=>{const el=$(id);if(!el)return d;const v=Number(el.value);return Number.isFinite(v)?v:d};
const optional=id=>{const el=$(id);if(!el||el.value==='')return null;const v=Number(el.value);return Number.isFinite(v)?Math.max(0,v):null};
const fmt=v=>'€'+Math.round(Number(v)||0).toLocaleString('nl-NL');
const pct=v=>(Number(v)||0).toLocaleString('nl-NL',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';

const panel=$('tab-scenarios'),engine=$('decisionEngine');
if(!panel||!engine||$('nextEuroCard'))return;
const card=document.createElement('div');
card.className='card';card.id='nextEuroCard';
card.innerHTML=`<div class="section-head"><div><p class="section-label">R5 · Next €</p><p class="section-note">Given one additional monthly amount, what investment return is required to beat extra mortgage repayment after the selected mortgage tax and Box 3 assumptions?</p></div></div><div class="grid3"><div class="field"><label for="nextEuroAmount">Extra amount per month</label><input id="nextEuroAmount" type="number" min="1" step="50" value="500"></div><div class="field"><label for="nextEuroYears">Decision horizon, years</label><input id="nextEuroYears" type="number" min="1" max="40" step="1" value="10"></div><div class="field"><label for="nextEuroReturn">Your assumed investment return %</label><input id="nextEuroReturn" type="number" min="-30" max="30" step="0.5" value="5"></div></div><div class="summary next-euro-summary"><div class="summary-item accent"><p class="k">Break-even investment return</p><p class="v" id="nextEuroBreakEven">—</p><p class="s" id="nextEuroBreakEvenSub">—</p></div><div class="summary-item"><p class="k">Winner at your return</p><p class="v" id="nextEuroWinner">—</p><p class="s" id="nextEuroWinnerSub">—</p></div><div class="summary-item"><p class="k">Modeled final difference</p><p class="v" id="nextEuroDifference">—</p><p class="s">same amount and horizon</p></div></div><div class="callout next-euro-risk"><strong>Not a risk-adjusted hurdle.</strong><br><span>Extra mortgage repayment is comparatively certain. Investment returns can be volatile and may underperform this break-even percentage over the selected period.</span></div><div class="table-wrap next-euro-table-wrap"><table class="next-euro-table"><thead><tr><th>Extra per month</th><th>Break-even return</th><th>Result at your return</th><th>Difference</th></tr></thead><tbody id="nextEuroQuickBody"></tbody></table></div><p class="foot">This reruns the production Repay mortgage vs Invest comparison and solves for the nominal investment return where both strategies produce the same modeled wealth. It is not a forecast or financial recommendation.</p>`;
const resultCard=engine.querySelector('.card:nth-of-type(3)');if(resultCard)resultCard.insertAdjacentElement('afterend',card);else engine.appendChild(card);
const style=document.createElement('style');style.textContent='.next-euro-summary{grid-template-columns:repeat(3,minmax(0,1fr))}.next-euro-table-wrap{margin-top:12px;max-height:280px}.next-euro-table{min-width:620px}.next-euro-risk{margin-top:12px}@media(max-width:800px){.next-euro-summary{grid-template-columns:1fr}}';document.head.appendChild(style);

function selectedMortType(){const v=$('scenarioMortgageMethodNew')?.value;if(v==='linear'||v==='annuity')return v;return document.querySelector('.compare-card.active[data-mort-type]')?.dataset.mortType||'annuity'}
function mainMortgage(){if($('mortgageMode')?.value==='purchase'){const price=Math.max(0,num('housePrice',0)),savings=Math.max(0,num('ownSavings',0)),cost=Math.max(0,num('purchaseCosts',0));return{balance:Math.max(0,price-Math.max(0,savings-cost)),ratePct:clamp(num('purchaseRate',4),0,20),years:clamp(num('purchaseYears',30),1,40)}}return{balance:Math.max(0,num('mortBalance',0)),ratePct:clamp(num('mortRate',4),0,20),years:clamp(num('mortYears',25),1,40)}}
function box3(){return{mode:$('box3Mode')?.value||'none',taxPartners:clamp(num('taxPartners',1),1,2),paySource:$('box3PaySource')?.value||'savings',currentTaxRate:clamp(num('currentTaxRate',36),0,100)/100,currentAllowance:Math.max(0,num('currentAllowance',59357)),currentNotional:clamp(num('currentNotional',6),0,30)/100,currentSavingsNotional:clamp(num('currentSavingsNotional',1.28),0,30)/100,currentDebtNotional:clamp(num('currentDebtNotional',2.70),0,30)/100,currentDebtThreshold:Math.max(0,num('currentDebtThreshold',3800)),firstJan1Portfolio:Math.max(0,num('firstJan1Portfolio',0)),firstJan1Savings:optional('firstJan1Savings'),firstJan1Debt:optional('firstJan1Debt'),savings:Math.max(0,num('box3Savings',0)),debt:Math.max(0,num('box3Debt',0)),savingsReturnPct:clamp(num('box3SavingsReturn',1.28),-10,30),debtInterestPct:clamp(num('box3DebtInterest',2.70),0,30),debtMonthlyRepayment:Math.max(0,num('box3DebtMonthlyRepayment',0)),debtRepaymentSource:$('box3DebtRepaymentSource')?.value==='savings'?'savings':'external',futureStart:clamp(num('futureStart',2028),2027,2100),futureTaxRate:clamp(num('futureTaxRate',36),0,100)/100,futureExempt:Math.max(0,num('futureExempt',1800)),futureLossThreshold:Math.max(0,num('futureLossThreshold',500))}}
function baseConfig(){
  const hra=window.LogicIntegrityUI?.mortgageTaxContext?.()||{hraRemainingMonths:360,qualifyingInterestFraction:1};
  return{startYear:clamp(num('startYear',2026),2020,2100),startMonth:clamp(num('startMonth',1),1,12),startPortfolio:Math.max(0,num('startPortfolio',0)),purchaseCosts:Math.max(0,num('purchaseCosts',0)),mortgageType:selectedMortType(),mortgage:mainMortgage(),tax:{enabled:$('mortTaxEnabled')?.checked!==false,deductionRate:FC.deductionRate2026({mode:$('deductionMode')?.value||'auto',manualRatePct:num('manualDeduction',37.56),grossIncome:num('grossIncome',0)}),wozValue:Math.max(0,num('wozValue',0)),hraRemainingMonths:hra.hraRemainingMonths,qualifyingInterestFraction:hra.qualifyingInterestFraction},box3:box3(),homeGrowthPct:0,rentGrowthPct:0,sellingCostPct:0,vveMonthly:Math.max(0,num('scenarioVveNew',250)),maintenanceAnnual:Math.max(0,num('scenarioMaintenanceNew',1500)),ownerTaxesAnnual:Math.max(0,num('scenarioOwnerTaxesNew',0)),insuranceAnnual:Math.max(0,num('scenarioInsuranceNew',0)),groundLeaseAnnual:Math.max(0,num('scenarioGroundLeaseNew',0))};
}
function update(){
  const x=NE.analyseNextEuro(baseConfig(),{amount:Math.max(0,num('nextEuroAmount',500)),years:clamp(num('nextEuroYears',10),1,40),assumedReturnPct:clamp(num('nextEuroReturn',5),-30,30)});
  $('nextEuroBreakEven').textContent=x.main.valid?(x.main.breakEven===null?'Outside range':pct(x.main.breakEven)):'Unavailable';
  $('nextEuroBreakEvenSub').textContent=x.main.reason||'nominal return before modeled Box 3';
  $('nextEuroWinner').textContent=x.winner;$('nextEuroWinnerSub').textContent=`at ${pct(x.assumedReturnPct)} assumed return`;
  $('nextEuroDifference').textContent=Number.isFinite(x.difference)?fmt(Math.abs(x.difference)):'—';
  const body=$('nextEuroQuickBody');body.innerHTML='';x.quick.forEach(r=>{const tr=document.createElement('tr');tr.innerHTML=`<td>${fmt(r.amount)}</td><td>${r.valid?(r.breakEven===null?'Outside range':pct(r.breakEven)):'Unavailable'}</td><td>${r.winner}</td><td>${Number.isFinite(r.difference)?fmt(Math.abs(r.difference)):'—'}</td>`;body.appendChild(tr)});
}
card.addEventListener('input',update);card.addEventListener('change',update);
document.querySelectorAll('#tab-investment input,#tab-investment select,#tab-mortgage input,#tab-mortgage select,#decisionEngine input,#decisionEngine select').forEach(el=>{el.addEventListener('input',update);el.addEventListener('change',update)});
update();
})();}
