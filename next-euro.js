(function(root,factory){
  const SC=typeof module==='object'&&module.exports?require('./scenario-engine.js'):root.ScenarioCore;
  const api=factory(SC);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root){root.NextEuroCore=api;root.NextEuro=api;}
})(typeof globalThis!=='undefined'?globalThis:this,function(SC){
'use strict';
if(!SC)throw new Error('ScenarioCore is required by NextEuroCore');

const nonNegative=v=>Math.max(0,Number(v)||0);
const finiteOr=(v,d)=>Number.isFinite(Number(v))?Number(v):d;
const clone=value=>JSON.parse(JSON.stringify(value||{}));

function scenarioConfig(baseConfig,{amount,years,returnPct}){
  const cfg=clone(baseConfig);
  cfg.mode='mortgage-invest';
  cfg.horizonYears=Math.max(1,nonNegative(years)||10);
  delete cfg.months;
  cfg.investmentReturnPct=finiteOr(returnPct,0);
  cfg.mortgageInvest={...(cfg.mortgageInvest||{}),extraMonthly:nonNegative(amount)};
  return cfg;
}

function evaluate(baseConfig={},options={}){
  const extraMonthly=nonNegative(options.extraMonthly??baseConfig.mortgageInvest?.extraMonthly);
  const returnPct=finiteOr(options.returnPct,baseConfig.investmentReturnPct??0);
  const years=Math.max(1,finiteOr(options.years,baseConfig.horizonYears??10));
  const scenario=SC.runScenario(scenarioConfig(baseConfig,{amount:extraMonthly,years,returnPct}));
  const difference=scenario.valid===false?NaN:scenario.B.net-scenario.A.net;
  return{extraMonthly,returnPct,repay:scenario.A,invest:scenario.B,difference,leader:Number.isFinite(difference)?(Math.abs(difference)<1?'tie':difference>0?'invest':'repay'):'unavailable',scenario};
}

function differenceAtRate(baseConfig,{amount,years,returnPct}){
  return evaluate(baseConfig,{extraMonthly:amount,years,returnPct}).difference;
}

function findBreakEvenReturn(baseConfig={},options={}){
  const amount=nonNegative(options.amount??options.extraMonthly??baseConfig.mortgageInvest?.extraMonthly);
  const years=Math.max(1,finiteOr(options.years,baseConfig.horizonYears??10));
  const mortgageBalance=nonNegative(baseConfig.mortgage?.balance);
  if(mortgageBalance<=0)return{valid:false,breakEven:null,reason:'no-mortgage'};
  if(amount<=0)return{valid:false,breakEven:null,reason:'no-extra'};
  let low=finiteOr(options.minRate??options.minReturnPct,-10),high=finiteOr(options.maxRate??options.maxReturnPct,20);
  if(high<low)[low,high]=[high,low];
  const tolerance=Math.max(.000001,Math.abs(finiteOr(options.tolerance??options.rateTolerance,.0001)));
  const wealthTolerance=Math.max(.01,Math.abs(finiteOr(options.wealthTolerance,1)));
  const at=r=>evaluate(baseConfig,{extraMonthly:amount,years,returnPct:r});
  let a=at(low),b=at(high);
  if(!Number.isFinite(a.difference)||!Number.isFinite(b.difference))return{valid:false,breakEven:null,reason:'invalid-scenario'};
  if(Math.abs(a.difference)<=wealthTolerance)return{valid:true,breakEven:low,outcome:a,range:[low,high]};
  if(Math.abs(b.difference)<=wealthTolerance)return{valid:true,breakEven:high,outcome:b,range:[low,high]};
  if(Math.sign(a.difference)===Math.sign(b.difference))return{valid:true,breakEven:null,range:[low,high],leader:a.difference>0?'invest':'repay',low:a,high:b};
  for(let i=0;i<80&&high-low>tolerance;i++){
    const mid=(low+high)/2,m=at(mid);
    if(Math.abs(m.difference)<=wealthTolerance){low=high=mid;a=b=m;break;}
    if(Math.sign(m.difference)===Math.sign(a.difference)){low=mid;a=m}else{high=mid;b=m}
  }
  const breakEven=(low+high)/2;
  return{valid:true,breakEven,outcome:at(breakEven),range:[finiteOr(options.minRate??options.minReturnPct,-10),finiteOr(options.maxRate??options.maxReturnPct,20)]};
}

function findBreakEven(baseConfig={},options={}){
  const extraMonthly=nonNegative(options.extraMonthly??baseConfig.mortgageInvest?.extraMonthly);
  const r=findBreakEvenReturn(baseConfig,{...options,amount:extraMonthly});
  if(!r.valid)return{status:'invalid',reason:r.reason,extraMonthly};
  if(r.breakEven==null)return{status:'none',extraMonthly,range:r.range,leader:r.leader,low:r.low,high:r.high};
  return{status:'found',extraMonthly,breakEvenReturnPct:r.breakEven,outcome:r.outcome,range:r.range};
}

function analyseNextEuro(baseConfig={},options={}){
  const amount=nonNegative(options.amount??options.extraMonthly??baseConfig.mortgageInvest?.extraMonthly??500);
  const years=Math.max(1,finiteOr(options.years,baseConfig.horizonYears??10));
  const assumedReturnPct=finiteOr(options.assumedReturnPct??options.selectedReturnPct,baseConfig.investmentReturnPct??5);
  const quickAmounts=Array.isArray(options.quickAmounts??options.amounts)?(options.quickAmounts??options.amounts):[250,500,1000];
  const main=findBreakEvenReturn(baseConfig,{...options,amount,years});
  const selected=evaluate(baseConfig,{extraMonthly:amount,years,returnPct:assumedReturnPct});
  const quick=quickAmounts.map(x=>{const a=nonNegative(x),be=findBreakEvenReturn(baseConfig,{...options,amount:a,years}),current=evaluate(baseConfig,{extraMonthly:a,years,returnPct:assumedReturnPct});return{amount:a,breakEven:be.breakEven,valid:be.valid,difference:current.difference,winner:current.leader==='invest'?'Invest':current.leader==='repay'?'Repay':current.leader==='tie'?'Tie':'Unavailable',current,crossover:be.valid?(be.breakEven==null?{status:'none',leader:be.leader}:{status:'found',breakEvenReturnPct:be.breakEven}):{status:'invalid'}};});
  return{main,amount,extraMonthly:amount,years,assumedReturnPct,selectedReturnPct:assumedReturnPct,difference:selected.difference,winner:selected.leader==='invest'?'Invest':selected.leader==='repay'?'Repay':selected.leader==='tie'?'Tie':'Unavailable',selected,quick};
}

function analyze(baseConfig={},options={}){
  const r=analyseNextEuro(baseConfig,options);
  return{extraMonthly:r.extraMonthly,selectedReturnPct:r.selectedReturnPct,selected:r.selected,breakEven:findBreakEven(baseConfig,{...options,extraMonthly:r.extraMonthly,years:r.years}),quick:r.quick};
}

return{scenarioConfig,evaluate,differenceAtRate,findBreakEvenReturn,findBreakEven,analyseNextEuro,analyze};
});

if(typeof window!=='undefined'&&window.document&&window.FinanceCore&&window.ScenarioCore){(()=>{
'use strict';
const FC=window.FinanceCore,NE=window.NextEuroCore,$=id=>document.getElementById(id),clamp=FC.clamp;
const num=(id,d=0)=>{const n=Number($(id)?.value);return Number.isFinite(n)?n:d};
const optional=id=>{const el=$(id);if(!el||el.value==='')return null;const n=Number(el.value);return Number.isFinite(n)?Math.max(0,n):null};
const fmt=v=>'€'+Math.round(Number(v)||0).toLocaleString('nl-NL');
const pct=v=>(Number(v)||0).toLocaleString('nl-NL',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';
const panel=$('tab-scenarios'),engine=$('decisionEngine');if(!panel||!engine||$('nextEuroCard'))return;

const card=document.createElement('div');card.className='card';card.id='nextEuroCard';
card.innerHTML=`<div class="section-head"><div><p class="section-label">R5 · Next €</p><p class="section-note">Given one additional monthly amount, what investment return is required to beat extra mortgage repayment after the selected mortgage tax and Box 3 assumptions?</p></div></div><div class="grid3"><div class="field"><label for="nextEuroAmount">Extra amount per month</label><input id="nextEuroAmount" type="number" min="1" step="50" value="500"></div><div class="field"><label for="nextEuroYears">Decision horizon, years</label><input id="nextEuroYears" type="number" min="1" max="40" step="1" value="10"></div><div class="field"><label for="nextEuroReturn">Your assumed investment return %</label><input id="nextEuroReturn" type="number" min="-30" max="30" step="0.5" value="5"></div></div><div class="summary next-euro-summary"><div class="summary-item accent"><p class="k">Break-even investment return</p><p class="v" id="nextEuroBreakEven">—</p><p class="s" id="nextEuroBreakEvenSub">—</p></div><div class="summary-item"><p class="k">Winner at your return</p><p class="v" id="nextEuroWinner">—</p><p class="s" id="nextEuroWinnerSub">—</p></div><div class="summary-item"><p class="k">Modeled final difference</p><p class="v" id="nextEuroDifference">—</p><p class="s">same amount and horizon</p></div></div><div class="callout next-euro-risk"><strong>Not a risk-adjusted hurdle.</strong><br><span>Extra mortgage repayment is comparatively certain. Investment returns can be volatile and may underperform this break-even percentage over the selected period.</span></div><p class="subsection-copy">Quick amounts: €250 / €500 / €1,000 per month</p><div class="table-wrap next-euro-table-wrap"><table class="next-euro-table"><thead><tr><th>Extra per month</th><th>Break-even return</th><th>Result at your return</th><th>Difference</th></tr></thead><tbody id="nextEuroQuickBody"></tbody></table></div><p class="foot">This reruns the production Repay mortgage vs Invest comparison. It is not a forecast or financial recommendation.</p>`;
const resultCard=engine.querySelector('.card:nth-of-type(3)');if(resultCard)resultCard.insertAdjacentElement('afterend',card);else engine.appendChild(card);
const style=document.createElement('style');style.textContent='.next-euro-summary{grid-template-columns:repeat(3,minmax(0,1fr))}.next-euro-table-wrap{margin-top:12px;max-height:280px}.next-euro-table{min-width:620px}.next-euro-risk{margin-top:12px}@media(max-width:800px){.next-euro-summary{grid-template-columns:1fr}}';document.head.appendChild(style);

function selectedMortType(){const v=$('scenarioMortgageMethodNew')?.value;if(v==='linear'||v==='annuity')return v;return document.querySelector('.compare-card.active[data-mort-type]')?.dataset.mortType||'annuity'}
function mainMortgage(){if($('mortgageMode')?.value==='purchase'){const price=Math.max(0,num('housePrice')),savings=Math.max(0,num('ownSavings')),cost=Math.max(0,num('purchaseCosts'));return{balance:Math.max(0,price-Math.max(0,savings-cost)),ratePct:clamp(num('purchaseRate',4),0,20),years:clamp(num('purchaseYears',30),1,40)}}return{balance:Math.max(0,num('mortBalance')),ratePct:clamp(num('mortRate',4),0,20),years:clamp(num('mortYears',25),1,40)}}
function box3(){return{mode:$('box3Mode')?.value||'none',taxPartners:clamp(num('taxPartners',1),1,2),paySource:$('box3PaySource')?.value||'savings',currentTaxRate:clamp(num('currentTaxRate',36),0,100)/100,currentAllowance:Math.max(0,num('currentAllowance',59357)),currentNotional:clamp(num('currentNotional',6),0,30)/100,currentSavingsNotional:clamp(num('currentSavingsNotional',1.28),0,30)/100,currentDebtNotional:clamp(num('currentDebtNotional',2.7),0,30)/100,currentDebtThreshold:Math.max(0,num('currentDebtThreshold',3800)),firstJan1Portfolio:Math.max(0,num('firstJan1Portfolio')),firstJan1Savings:optional('firstJan1Savings'),firstJan1Debt:optional('firstJan1Debt'),savings:Math.max(0,num('box3Savings')),debt:Math.max(0,num('box3Debt')),savingsReturnPct:clamp(num('box3SavingsReturn',1.28),-10,30),debtInterestPct:clamp(num('box3DebtInterest',2.7),0,30),debtMonthlyRepayment:Math.max(0,num('box3DebtMonthlyRepayment')),debtRepaymentSource:$('box3DebtRepaymentSource')?.value==='savings'?'savings':'external',futureStart:clamp(num('futureStart',2028),2027,2100),futureTaxRate:clamp(num('futureTaxRate',36),0,100)/100,futureExempt:Math.max(0,num('futureExempt',1800)),futureLossThreshold:Math.max(0,num('futureLossThreshold',500))}}
function baseConfig(){const hra=window.LogicIntegrityUI?.mortgageTaxContext?.()||{hraRemainingMonths:360,qualifyingInterestFraction:1};return{startYear:clamp(num('startYear',2026),2020,2100),startMonth:clamp(num('startMonth',1),1,12),startPortfolio:Math.max(0,num('startPortfolio')),mortgageType:selectedMortType(),mortgage:mainMortgage(),tax:{enabled:$('mortTaxEnabled')?.checked!==false,deductionRate:FC.deductionRate2026({mode:$('deductionMode')?.value||'auto',manualRatePct:num('manualDeduction',37.56),grossIncome:num('grossIncome')}),wozValue:Math.max(0,num('wozValue')),hraRemainingMonths:hra.hraRemainingMonths,qualifyingInterestFraction:hra.qualifyingInterestFraction},box3:box3(),vveMonthly:Math.max(0,num('scenarioVveNew',250)),maintenanceAnnual:Math.max(0,num('scenarioMaintenanceNew',1500)),ownerTaxesAnnual:Math.max(0,num('scenarioOwnerTaxesNew')),insuranceAnnual:Math.max(0,num('scenarioInsuranceNew')),groundLeaseAnnual:Math.max(0,num('scenarioGroundLeaseNew'))}}
function render(){const amount=Math.max(1,num('nextEuroAmount',500)),years=clamp(num('nextEuroYears',10),1,40),ret=clamp(num('nextEuroReturn',5),-30,30),x=NE.analyseNextEuro(baseConfig(),{amount,years,assumedReturnPct:ret});$('nextEuroBreakEven').textContent=x.main.valid?(x.main.breakEven==null?'Outside range':pct(x.main.breakEven)):'Unavailable';$('nextEuroBreakEvenSub').textContent=x.main.reason||'nominal return before modeled Box 3';$('nextEuroWinner').textContent=x.winner;$('nextEuroWinnerSub').textContent=`at ${pct(ret)} assumed return`;$('nextEuroDifference').textContent=Number.isFinite(x.difference)?fmt(Math.abs(x.difference)):'—';const body=$('nextEuroQuickBody');body.innerHTML='';x.quick.forEach(r=>{const tr=document.createElement('tr');tr.innerHTML=`<td>${fmt(r.amount)}</td><td>${r.valid?(r.breakEven==null?'Outside range':pct(r.breakEven)):'Unavailable'}</td><td>${r.winner}</td><td>${Number.isFinite(r.difference)?fmt(Math.abs(r.difference)):'—'}</td>`;body.appendChild(tr)})}
card.addEventListener('input',render);card.addEventListener('change',render);document.querySelectorAll('#tab-investment input,#tab-investment select,#tab-mortgage input,#tab-mortgage select,#decisionEngine input,#decisionEngine select').forEach(el=>{el.addEventListener('input',render);el.addEventListener('change',render)});render();
})();}
