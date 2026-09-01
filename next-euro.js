(function(root,factory){
  const SC=typeof module==='object'&&module.exports?require('./scenario-engine.js'):root.ScenarioCore;
  const api=factory(SC);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.NextEuro=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(SC){
'use strict';
if(!SC)throw new Error('ScenarioCore is required by NextEuro');

const nonNegative=v=>Math.max(0,Number(v)||0);
const finiteOr=(v,d)=>Number.isFinite(Number(v))?Number(v):d;

function evaluate(config={},options={}){
  const extraMonthly=nonNegative(options.extraMonthly??config.mortgageInvest?.extraMonthly);
  const returnPct=finiteOr(options.returnPct,config.investmentReturnPct??0);
  const scenario=SC.runScenario({
    ...config,
    mode:'mortgage-invest',
    investmentReturnPct:returnPct,
    mortgageInvest:{...(config.mortgageInvest||{}),extraMonthly}
  });
  const difference=scenario.B.net-scenario.A.net;
  return{
    extraMonthly,
    returnPct,
    repay:scenario.A,
    invest:scenario.B,
    difference,
    leader:Math.abs(difference)<1?'tie':difference>0?'invest':'repay',
    scenario
  };
}

function findBreakEven(config={},options={}){
  const extraMonthly=nonNegative(options.extraMonthly??config.mortgageInvest?.extraMonthly);
  const mortgageBalance=nonNegative(config.mortgage?.balance);
  if(mortgageBalance<=0)return{status:'invalid',reason:'no-mortgage',extraMonthly};
  if(extraMonthly<=0)return{status:'invalid',reason:'no-extra',extraMonthly};

  let minReturnPct=finiteOr(options.minReturnPct,-10);
  let maxReturnPct=finiteOr(options.maxReturnPct,20);
  if(maxReturnPct<minReturnPct)[minReturnPct,maxReturnPct]=[maxReturnPct,minReturnPct];
  const scanStepPct=Math.max(.05,Math.abs(finiteOr(options.scanStepPct,.25)));
  const wealthTolerance=Math.max(.01,Math.abs(finiteOr(options.wealthTolerance,1)));
  const rateTolerance=Math.max(.00001,Math.abs(finiteOr(options.rateTolerance,.0001)));

  const at=r=>evaluate(config,{extraMonthly,returnPct:r});
  let leftRate=minReturnPct,left=at(leftRate);
  if(Math.abs(left.difference)<=wealthTolerance)return{status:'found',extraMonthly,breakEvenReturnPct:leftRate,outcome:left,range:[minReturnPct,maxReturnPct]};

  let bracket=null;
  for(let r=minReturnPct+scanStepPct;r<=maxReturnPct+1e-9;r+=scanStepPct){
    const rightRate=Math.min(r,maxReturnPct),right=at(rightRate);
    if(Math.abs(right.difference)<=wealthTolerance){
      return{status:'found',extraMonthly,breakEvenReturnPct:rightRate,outcome:right,range:[minReturnPct,maxReturnPct]};
    }
    if(Math.sign(left.difference)!==Math.sign(right.difference)){
      bracket={lowRate:leftRate,low:left,highRate:rightRate,high:right};
      break;
    }
    leftRate=rightRate;left=right;
    if(rightRate===maxReturnPct)break;
  }

  if(!bracket){
    const low=at(minReturnPct),high=at(maxReturnPct);
    let leader='mixed';
    if(low.difference>0&&high.difference>0)leader='invest';
    else if(low.difference<0&&high.difference<0)leader='repay';
    else if(Math.abs(low.difference)<=wealthTolerance||Math.abs(high.difference)<=wealthTolerance)leader='tie';
    return{status:'none',extraMonthly,range:[minReturnPct,maxReturnPct],leader,low,high};
  }

  let {lowRate,low,highRate,high}=bracket;
  for(let i=0;i<80&&highRate-lowRate>rateTolerance;i++){
    const midRate=(lowRate+highRate)/2,mid=at(midRate);
    if(Math.abs(mid.difference)<=wealthTolerance){
      lowRate=highRate=midRate;low=high=mid;break;
    }
    if(Math.sign(low.difference)===Math.sign(mid.difference)){
      lowRate=midRate;low=mid;
    }else{
      highRate=midRate;high=mid;
    }
  }
  const breakEvenReturnPct=(lowRate+highRate)/2;
  const outcome=at(breakEvenReturnPct);
  return{status:'found',extraMonthly,breakEvenReturnPct,outcome,range:[minReturnPct,maxReturnPct],bracket:[lowRate,highRate]};
}

function analyze(config={},options={}){
  const extraMonthly=nonNegative(options.extraMonthly??config.mortgageInvest?.extraMonthly??500);
  const selectedReturnPct=finiteOr(options.selectedReturnPct,config.investmentReturnPct??5);
  const amounts=(Array.isArray(options.amounts)&&options.amounts.length?options.amounts:[250,500,1000]).map(nonNegative).filter(v=>v>0);
  const selected=evaluate(config,{extraMonthly,returnPct:selectedReturnPct});
  const breakEven=findBreakEven(config,{...options,extraMonthly});
  const quick=amounts.map(amount=>{
    const current=evaluate(config,{extraMonthly:amount,returnPct:selectedReturnPct});
    const crossover=findBreakEven(config,{...options,extraMonthly:amount});
    return{amount,current,crossover};
  });
  return{extraMonthly,selectedReturnPct,selected,breakEven,quick};
}

return{evaluate,findBreakEven,analyze};
});

if(typeof window!=='undefined'&&window.document){(()=>{
'use strict';
const NE=window.NextEuro,FC=window.FinanceCore;
if(!NE||!FC||!window.ScenarioCore)throw new Error('FinanceCore, ScenarioCore and NextEuro must load before the Next € UI');
const $=id=>document.getElementById(id);
const clamp=FC.clamp;
const num=(id,d=0)=>{const el=$(id);if(!el)return d;const v=Number(el.value);return Number.isFinite(v)?v:d};
const optional=id=>{const el=$(id);if(!el||el.value==='')return null;const v=Number(el.value);return Number.isFinite(v)?Math.max(0,v):null};
const fmt=v=>'€'+Math.round(Number(v)||0).toLocaleString('nl-NL');
const pct=v=>(Number(v)||0).toLocaleString('nl-NL',{minimumFractionDigits:1,maximumFractionDigits:2})+'%';

const panel=$('tab-scenarios'),decision=$('decisionEngine');
if(!panel||!decision||$('nextEuroCard'))return;

function selectedMortType(){return document.querySelector('.compare-card.active[data-mort-type]')?.dataset.mortType||'annuity'}
function mainMortgage(){
  if($('mortgageMode')?.value==='purchase'){
    const price=Math.max(0,num('housePrice',0)),savings=Math.max(0,num('ownSavings',0)),cost=Math.max(0,num('purchaseCosts',0));
    return{balance:Math.max(0,price-Math.max(0,savings-cost)),ratePct:clamp(num('purchaseRate',4),0,20),years:clamp(num('purchaseYears',30),1,40)};
  }
  return{balance:Math.max(0,num('mortBalance',0)),ratePct:clamp(num('mortRate',4),0,20),years:clamp(num('mortYears',25),1,40)};
}
function box3(){
  const h=window.Box3Household?.browserContext?window.Box3Household.browserContext():{};
  return{
    mode:$('box3Mode')?.value||'none',taxPartners:clamp(num('taxPartners',1),1,2),paySource:$('box3PaySource')?.value||'savings',
    currentTaxRate:clamp(num('currentTaxRate',36),0,100)/100,currentAllowance:Math.max(0,num('currentAllowance',59357)),currentNotional:clamp(num('currentNotional',6),0,30)/100,
    currentSavingsNotional:clamp(num('currentSavingsNotional',1.28),0,30)/100,currentDebtNotional:clamp(num('currentDebtNotional',2.70),0,30)/100,currentDebtThreshold:Math.max(0,num('currentDebtThreshold',3800)),
    firstJan1Portfolio:Math.max(0,num('firstJan1Portfolio',0)),firstJan1Savings:optional('firstJan1Savings'),firstJan1Debt:optional('firstJan1Debt'),
    savings:Math.max(0,Number(h.box3Savings)||0),debt:Math.max(0,Number(h.box3Debt)||0),savingsReturnPct:Number(h.savingsReturnPct)||0,debtInterestPct:Number(h.debtInterestPct)||0,
    debtMonthlyRepayment:Math.max(0,Number(h.box3DebtMonthlyRepayment)||0),debtRepaymentSource:h.debtRepaymentSource==='savings'?'savings':'external',
    futureStart:clamp(num('futureStart',2028),2027,2100),futureTaxRate:clamp(num('futureTaxRate',36),0,100)/100,futureExempt:Math.max(0,num('futureExempt',1800)),futureLossThreshold:Math.max(0,num('futureLossThreshold',500))
  };
}
function config(returnPct,extraMonthly,horizonYears){
  return{
    mode:'mortgage-invest',horizonYears,startYear:clamp(num('startYear',2026),2020,2100),startMonth:clamp(num('startMonth',1),1,12),investmentReturnPct:returnPct,
    startPortfolio:Math.max(0,num('startPortfolio',0)),mortgageType:selectedMortType(),mortgage:mainMortgage(),
    tax:{enabled:$('mortTaxEnabled')?.checked!==false,deductionRate:FC.deductionRate2026({mode:$('deductionMode')?.value||'auto',manualRatePct:num('manualDeduction',37.56),grossIncome:num('grossIncome',0)}),wozValue:Math.max(0,num('wozValue',0))},
    box3:box3(),mortgageInvest:{extraMonthly},vveMonthly:0,maintenanceAnnual:0,ownerTaxesAnnual:0,insuranceAnnual:0,groundLeaseAnnual:0
  };
}

const card=document.createElement('div');
card.className='card next-euro-card';card.id='nextEuroCard';
card.innerHTML=`
  <div class="section-head"><div><p class="section-label">R5 · Next €</p><p class="section-note">What should you do with the next monthly euro: invest it or repay the mortgage? The break-even uses the same mortgage, HRA, Box 3 and household-balance engine as the full scenario comparison.</p></div></div>
  <div class="grid3"><div class="field"><label for="nextEuroAmount">Extra amount per month</label><input id="nextEuroAmount" type="number" min="1" step="50" value="500"></div><div class="field"><label for="nextEuroYears">Decision horizon, years</label><input id="nextEuroYears" type="number" min="1" max="40" step="1" value="10"></div><div class="field"><label for="nextEuroReturn">Your assumed investment return %</label><input id="nextEuroReturn" type="number" min="-30" max="30" step="0.25" value="5"></div></div>
  <div class="summary"><div class="summary-item accent"><p class="k">Break-even investment return</p><p class="v" id="nextEuroBreakEven">—</p><p class="s">nominal return before Box 3</p></div><div class="summary-item"><p class="k">At your assumed return</p><p class="v" id="nextEuroLeader">—</p><p class="s" id="nextEuroLeaderSub">—</p></div><div class="summary-item"><p class="k">Modeled wealth difference</p><p class="v" id="nextEuroDifference">—</p><p class="s">same monthly cash capacity</p></div></div>
  <div id="nextEuroExplanation" class="callout"></div>
  <details class="inner-fold"><summary>Quick amounts: €250 / €500 / €1,000 per month</summary><div class="inner-fold-body"><div class="table-wrap"><table><thead><tr><th>Extra / month</th><th>Break-even return</th><th>At assumed return</th><th>Wealth difference</th></tr></thead><tbody id="nextEuroQuickBody"></tbody></table></div></div></details>
  <p class="foot">Break-even is model-dependent, not a promised investment return. Extra mortgage repayment has lower market risk; investment returns are uncertain and lender repayment rules can differ.</p>`;
decision.insertAdjacentElement('beforebegin',card);

function render(){
  const extra=Math.max(1,num('nextEuroAmount',500)),years=clamp(num('nextEuroYears',10),1,40),ret=clamp(num('nextEuroReturn',5),-30,30),base=config(ret,extra,years);
  if(base.mortgage.balance<=0){
    $('nextEuroBreakEven').textContent='No mortgage';$('nextEuroLeader').textContent='—';$('nextEuroDifference').textContent='—';$('nextEuroLeaderSub').textContent='Enter a mortgage balance';
    $('nextEuroExplanation').innerHTML='<strong>No mortgage balance to compare.</strong> Add or select a mortgage in the Mortgage tab.';$('nextEuroQuickBody').innerHTML='';return;
  }
  const a=NE.analyze(base,{extraMonthly:extra,selectedReturnPct:ret,amounts:[250,500,1000],minReturnPct:-10,maxReturnPct:20,scanStepPct:.25});
  const be=a.breakEven;
  $('nextEuroBreakEven').textContent=be.status==='found'?pct(be.breakEvenReturnPct):'Outside -10% to 20%';
  const lead=a.selected.leader==='invest'?'Invest':a.selected.leader==='repay'?'Repay':'Tie';
  $('nextEuroLeader').textContent=lead;
  $('nextEuroLeaderSub').textContent=`at ${pct(ret)} over ${years} years`;
  $('nextEuroDifference').textContent=fmt(Math.abs(a.selected.difference));
  if(be.status==='found'){
    $('nextEuroExplanation').innerHTML=`<strong>Investing needs about ${pct(be.breakEvenReturnPct)} nominal annual return before Box 3 to match repaying ${fmt(extra)}/month over ${years} years.</strong><br><span>At your ${pct(ret)} assumption, ${lead==='Tie'?'the two strategies are effectively tied':lead.toLowerCase()+' leads by '+fmt(Math.abs(a.selected.difference))}. This includes the selected HRA/EWF/Hillen and Box 3 settings.</span>`;
  }else{
    $('nextEuroExplanation').innerHTML=`<strong>No crossover was found between -10% and 20%.</strong><br><span>${be.leader==='invest'?'Investing leads throughout that search range.':be.leader==='repay'?'Repayment leads throughout that search range.':'The result is not monotonic enough for a single crossover in that range.'}</span>`;
  }
  const body=$('nextEuroQuickBody');body.innerHTML='';
  a.quick.forEach(row=>{
    const tr=document.createElement('tr'),cross=row.crossover.status==='found'?pct(row.crossover.breakEvenReturnPct):'No crossover',leader=row.current.leader==='invest'?'Invest':row.current.leader==='repay'?'Repay':'Tie';
    tr.innerHTML=`<td>${fmt(row.amount)}</td><td>${cross}</td><td>${leader}</td><td>${fmt(Math.abs(row.current.difference))}</td>`;body.appendChild(tr);
  });
}
card.addEventListener('input',render);card.addEventListener('change',render);
document.querySelectorAll('#tab-investment input,#tab-investment select,#tab-mortgage input,#tab-mortgage select').forEach(el=>{el.addEventListener('input',render);el.addEventListener('change',render)});
render();
})();}
