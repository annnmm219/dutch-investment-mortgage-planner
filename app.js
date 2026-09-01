(()=>{
'use strict';

const FC=window.FinanceCore;
if(!FC)throw new Error('FinanceCore must load before app.js');
const $=id=>document.getElementById(id);
const clamp=FC.clamp;
const num=(id,d=0)=>{const el=$(id);if(!el)return d;const v=Number(el.value);return Number.isFinite(v)?v:d};
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const COLORS=['#2a78d6','#1baf7a','#a576d4','#d48a54','#5c8eaa','#b16b86'];
const DEFAULT=[
 {years:5,monthlyInvest:500,mortgageExtra:0,mortgageFreq:'monthly',annualBonus:0,bonusDest:'invest'},
 {years:5,monthlyInvest:750,mortgageExtra:200,mortgageFreq:'monthly',annualBonus:2000,bonusDest:'split'},
 {years:10,monthlyInvest:1000,mortgageExtra:3000,mortgageFreq:'yearly',annualBonus:4000,bonusDest:'invest'},
 {years:5,monthlyInvest:750,mortgageExtra:500,mortgageFreq:'monthly',annualBonus:3000,bonusDest:'mortgage'},
 {years:5,monthlyInvest:500,mortgageExtra:0,mortgageFreq:'monthly',annualBonus:0,bonusDest:'invest'},
 {years:5,monthlyInvest:500,mortgageExtra:0,mortgageFreq:'monthly',annualBonus:0,bonusDest:'invest'}
];

let phases=DEFAULT.map(x=>({...x}));
let chart;
let mortTypeState='annuity';

function fmt(v){return '€'+Math.round(Number(v)||0).toLocaleString('nl-NL')}
function fmtSigned(v){return (v<0?'−':'+')+fmt(Math.abs(v))}
function pct(v){return (Number(v)||0).toLocaleString('nl-NL',{maximumFractionDigits:2})+'%'}

function initMonths(){
  ['startMonth','bonusMonth'].forEach(id=>{
    const el=$(id);
    MONTHS.forEach((m,i)=>{const o=document.createElement('option');o.value=i+1;o.textContent=m;el.appendChild(o)});
  });
  $('startMonth').value='1';
  $('bonusMonth').value='12';
}

function renderPhases(){
  const count=clamp(num('phaseCount',3),1,6),root=$('phaseList');
  root.innerHTML='';
  let cursor=new Date(Date.UTC(num('startYear',2026),num('startMonth',1)-1,1));
  for(let i=0;i<count;i++){
    const p=phases[i],months=Math.round(p.years*12),end=new Date(Date.UTC(cursor.getUTCFullYear(),cursor.getUTCMonth()+months-1,1));
    const card=document.createElement('div');
    card.className='phase-card';
    const extraMortgageLabel=p.mortgageFreq==='yearly'?'Yearly extra mortgage repayment':'Monthly extra mortgage repayment';
    card.innerHTML=`<div class="phase-head"><p class="phase-title"><span class="dot" style="background:${COLORS[i]}"></span>Phase ${i+1}</p><p class="phase-period">${MONTHS[cursor.getUTCMonth()].slice(0,3)} ${cursor.getUTCFullYear()} – ${MONTHS[end.getUTCMonth()].slice(0,3)} ${end.getUTCFullYear()}</p></div><div class="phase-fields"><div><label class="mini">Duration, years</label><input data-i="${i}" data-field="years" type="number" min="1" max="30" step="1" value="${p.years}"></div><div><label class="mini">Monthly investment</label><input data-i="${i}" data-field="monthlyInvest" type="number" min="0" step="50" value="${p.monthlyInvest}"></div><div><label class="mini">${extraMortgageLabel}</label><input data-i="${i}" data-field="mortgageExtra" type="number" min="0" step="50" value="${p.mortgageExtra}"></div><div><label class="mini">Frequency</label><select data-i="${i}" data-field="mortgageFreq"><option value="monthly" ${p.mortgageFreq==='monthly'?'selected':''}>Monthly</option><option value="yearly" ${p.mortgageFreq==='yearly'?'selected':''}>Yearly</option></select></div><div><label class="mini">Annual bonus / lump sum</label><input data-i="${i}" data-field="annualBonus" type="number" min="0" step="100" value="${p.annualBonus}"></div><div><label class="mini">Bonus allocation</label><select data-i="${i}" data-field="bonusDest"><option value="invest" ${p.bonusDest==='invest'?'selected':''}>Invest 100%</option><option value="mortgage" ${p.bonusDest==='mortgage'?'selected':''}>Mortgage 100%</option><option value="split" ${p.bonusDest==='split'?'selected':''}>Split 50 / 50</option></select></div></div>`;
    root.appendChild(card);
    cursor=new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()+1,1));
  }
}

function plan(){
  const count=clamp(num('phaseCount',3),1,6);
  return phases.slice(0,count).map(p=>({
    years:clamp(Number(p.years)||1,1,30),
    monthlyInvest:Math.max(0,Number(p.monthlyInvest)||0),
    mortgageExtra:Math.max(0,Number(p.mortgageExtra)||0),
    mortgageFreq:p.mortgageFreq==='yearly'?'yearly':'monthly',
    annualBonus:Math.max(0,Number(p.annualBonus)||0),
    bonusDest:['invest','mortgage','split'].includes(p.bonusDest)?p.bonusDest:'invest'
  }));
}

function deductionRate(){
  return FC.deductionRate2026({mode:$('deductionMode').value,manualRatePct:num('manualDeduction',37.56),grossIncome:num('grossIncome',0)});
}

function purchaseValues(){
  const price=Math.max(0,num('housePrice',0)),savings=Math.max(0,num('ownSavings',0)),costs=Math.max(0,num('purchaseCosts',0));
  const savingsAfterCosts=Math.max(0,savings-costs),shortfall=Math.max(0,costs-savings),requiredLoan=Math.max(0,price-savingsAfterCosts),ltv=price>0?requiredLoan/price*100:0;
  return{price,savings,costs,savingsAfterCosts,shortfall,requiredLoan,ltv};
}

function inputs(retOverride,mortTypeOverride){
  const mortgageMode=$('mortgageMode').value==='purchase'?'purchase':'existing',pv=purchaseValues();
  return{
    p:plan(),startMonth:clamp(num('startMonth',1),1,12),startYear:clamp(num('startYear',2026),2020,2100),startPortfolio:Math.max(0,num('startPortfolio',0)),annualReturn:retOverride??num('annualReturn',7),bonusMonth:clamp(num('bonusMonth',12),1,12),
    mortgageMode,mortBalance:mortgageMode==='purchase'?pv.requiredLoan:Math.max(0,num('mortBalance',0)),mortRate:mortgageMode==='purchase'?clamp(num('purchaseRate',0),0,20):clamp(num('mortRate',0),0,20),mortYears:mortgageMode==='purchase'?clamp(num('purchaseYears',30),1,40):clamp(num('mortYears',1),1,40),mortType:mortTypeOverride||mortTypeState,
    mortTaxEnabled:$('mortTaxEnabled').checked,deductRate:deductionRate(),wozValue:Math.max(0,num('wozValue',0)),
    box3Mode:$('box3Mode').value,taxPartners:clamp(num('taxPartners',1),1,2),box3PaySource:$('box3PaySource').value,currentTaxRate:clamp(num('currentTaxRate',36),0,100)/100,currentAllowance:Math.max(0,num('currentAllowance',59357)),currentNotional:clamp(num('currentNotional',6),0,30)/100,firstJan1Portfolio:Math.max(0,num('firstJan1Portfolio',0)),futureStart:clamp(num('futureStart',2028),2027,2100),futureTaxRate:clamp(num('futureTaxRate',36),0,100)/100,futureExempt:Math.max(0,num('futureExempt',1800)),futureLossThreshold:Math.max(0,num('futureLossThreshold',500))
  };
}

function simulate(retOverride,forceNoBox3=false,mortTypeOverride=null){
  const I=inputs(retOverride,mortTypeOverride);
  if(forceNoBox3)I.box3Mode='none';
  const result=FC.simulatePlan({
    phases:I.p,startMonth:I.startMonth,startYear:I.startYear,startPortfolio:I.startPortfolio,annualReturnPct:I.annualReturn,bonusMonth:I.bonusMonth,
    mortBalance:I.mortBalance,mortRatePct:I.mortRate,mortYears:I.mortYears,mortType:I.mortType,mortTaxEnabled:I.mortTaxEnabled,deductRate:I.deductRate,wozValue:I.wozValue,
    box3Mode:I.box3Mode,taxPartners:I.taxPartners,box3PaySource:I.box3PaySource,currentTaxRate:I.currentTaxRate,currentAllowance:I.currentAllowance,currentNotional:I.currentNotional,firstJan1Portfolio:I.firstJan1Portfolio,futureStart:I.futureStart,futureTaxRate:I.futureTaxRate,futureExempt:I.futureExempt,futureLossThreshold:I.futureLossThreshold
  });
  return{...I,...result};
}

function updateStats(s){
  $('sPortfolio').textContent=fmt(s.portfolio);$('sPortfolioSub').textContent='after selected Box 3 treatment';
  $('sInvested').textContent=fmt(s.invested);$('sInvestedSub').textContent='including starting portfolio';
  $('sMortgage').textContent=fmt(s.mort);$('sMortgageSub').textContent=fmt(s.initialMort-s.mort)+' principal repaid';
}

function updatePurchaseSummary(){
  const pv=purchaseValues();
  $('purchaseSavingsAfterCosts').textContent=fmt(pv.savingsAfterCosts);$('purchaseLoan').textContent=fmt(pv.requiredLoan);$('purchaseLtv').textContent=pv.price>0?pct(pv.ltv):'—';$('purchaseShortfall').textContent=fmt(pv.shortfall);$('purchaseShortfall').closest('.summary-item').style.display=pv.shortfall>0?'block':'none';
}
function updateMortgageMode(){const purchase=$('mortgageMode').value==='purchase';$('existingMortgageFields').classList.toggle('hidden',purchase);$('purchaseMortgageFields').classList.toggle('hidden',!purchase);updatePurchaseSummary()}
function planEndDate(s){const start=new Date(Date.UTC(s.startYear,s.startMonth-1,1));return new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+Math.max(0,s.horizonMonths-1),1))}
function regimeShortLabel(regime){if(regime==='current')return'2026 rules';if(regime==='future')return'Proposed regime';return'No Box 3'}

function updateBox3YearTable(s){
  const body=$('box3YearBody');if(!body)return;body.innerHTML='';
  Object.values(s.yearBuckets).sort((a,b)=>a.year-b.year).forEach(b=>{const tr=document.createElement('tr');tr.innerHTML=`<td>${b.year}</td><td>${regimeShortLabel(b.regime)}</td><td>${fmt(b.endBeforeTax)}</td><td>${fmt(b.box3Tax)}</td><td>${fmt(b.endAfterTax ?? b.endBeforeTax)}</td>`;body.appendChild(tr)});
}

function updateMortgage(s){
  $('deductionDisplay').textContent=(s.deductRate*100).toLocaleString('nl-NL',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';
  $('deductionWhy').textContent=$('deductionMode').value==='manual'?'Manual planning rate.':(num('grossIncome',0)>78426?'2026 maximum deduction-rate proxy.':num('grossIncome',0)>38883?'2026 second-bracket proxy.':'2026 first-bracket proxy.');
  const ewf=FC.ewf2026(s.wozValue);
  if($('wozImpact'))$('wozImpact').innerHTML=s.wozValue>0?`<strong>WOZ effect:</strong> ${fmt(s.wozValue)} gives an estimated 2026 eigenwoningforfait of <strong>${fmt(ewf)}/year</strong>. In this planner that amount offsets deductible mortgage interest before the deduction rate is applied, so a higher WOZ generally means a smaller mortgage-interest tax benefit. It does not change the mortgage payment, principal balance, or Box 3 calculation.`:'<strong>WOZ effect:</strong> Enter a WOZ value to include eigenwoningforfait in the mortgage-interest tax estimate. It does not change the mortgage payment, principal balance, or Box 3 calculation.';
  $('mGrossInterest').textContent=fmt(s.grossInterest);$('mTaxBenefit').textContent=fmtSigned(s.mortTax);$('mNetInterest').textContent=fmt(s.netInterest);
  $('mPayoff').textContent=s.payoffDate?MONTHS[s.payoffDate.month-1].slice(0,3)+' '+s.payoffDate.year:'Not yet';$('mPayoffSub').textContent=s.payoffDate?'with selected extra repayments':'remaining '+fmt(s.mort);updatePurchaseSummary();
}

function updateMortgageCompare(s){
  const linear=simulate(s.annualReturn,false,'linear'),annuity=simulate(s.annualReturn,false,'annuity');
  function card(el,x,label,type){const active=mortTypeState===type;el.className='compare-card selectable'+(active?' active':'');el.setAttribute('aria-pressed',active?'true':'false');el.innerHTML=`<h3>${label}</h3><p class="tag ${active?'selected-tag':''}">${active?'Used in combined plan & schedule':'Click to use this method'}</p><div class="metric"><span>First scheduled payment</span><strong>${fmt(x.firstScheduled)}</strong></div><div class="metric"><span>Gross scheduled paid</span><strong>${fmt(x.grossScheduledTotal)}</strong></div><div class="metric"><span>Gross interest</span><strong>${fmt(x.grossInterest)}</strong></div><div class="metric"><span>Estimated tax benefit</span><strong>${fmtSigned(x.mortTax)}</strong></div><div class="metric"><span>Extra repayments</span><strong>${fmt(x.extraPaid)}</strong></div><div class="metric"><span>End balance</span><strong>${fmt(x.mort)}</strong></div>`}
  card($('linearCompare'),linear,'Linear mortgage','linear');card($('annuityCompare'),annuity,'Annuity mortgage','annuity');
}

function regimeCopy(mode){
  if(mode==='none')return{text:'Ignores Box 3 entirely. Use this to see the portfolio before any modeled Dutch investment tax.',future:false};
  if(mode==='current')return{text:'Applies the editable 2026 current-rules parameters to every year in the plan. This is a sensitivity baseline, not a claim that 2026 rules will remain unchanged in future years.',future:false};
  if(mode==='future')return{text:'Applies the proposed actual-return / unrealized-gain method from the first year of the plan. This is a stress test only for years before any future law actually starts.',future:true};
  return{text:'Uses the current-rules model before the proposed transition year, then switches to the proposed actual-return / unrealized-gain model from that year onward. This is the most realistic transition scenario available in the planner, but the future law is not enacted.',future:true};
}

function updateBox3(s){
  const noTax=simulate(s.annualReturn,true),info=regimeCopy(s.box3Mode),end=planEndDate(s),endLabel=`${MONTHS[end.getUTCMonth()].slice(0,3)} ${end.getUTCFullYear()}`,startLabel=`${MONTHS[s.startMonth-1].slice(0,3)} ${s.startYear}`;
  $('regimeExplanation').textContent=info.text;$('futureLawWarning').classList.toggle('hidden',!info.future);
  $('taxSummaryPeriod').textContent=`End of plan: ${endLabel} · tax accumulated from ${startLabel} to ${endLabel}`;$('bBeforeTaxLabel').textContent=`Portfolio before Box 3 · ${endLabel}`;$('sBox3Label').textContent=`Cumulative Box 3 tax · ${s.startYear}–${end.getUTCFullYear()}`;$('bAfterTaxLabel').textContent=`Portfolio after Box 3 · ${endLabel}`;
  $('bBeforeTax').textContent=fmt(noTax.portfolio);$('sBox3').textContent=fmt(s.box3Tax);$('sBox3Sub').textContent=s.box3Mode==='none'?'Box 3 ignored':s.box3PaySource==='portfolio'?'total modeled tax withdrawn over the plan':'total modeled tax paid from external cash';$('bAfterTax').textContent=fmt(s.portfolio);$('bAfterTaxSub').textContent=s.box3PaySource==='portfolio'?'includes the lost future compounding caused by earlier tax withdrawals':'portfolio is not reduced because modeled tax is paid from external cash';$('bLoss').textContent=fmt(s.lossCarry);updateBox3YearTable(s);
}

function updateScenarios(){
  const rates=[clamp(num('scenarioRate1',4),-30,30),clamp(num('scenarioRate2',7),-30,30),clamp(num('scenarioRate3',10),-30,30)],colors=['#9a9a96','#2a78d6','#1baf7a'],root=$('scenarioCards');root.innerHTML='';
  rates.forEach((r,i)=>{const s=simulate(r),d=document.createElement('div');d.className='scenario';d.style.borderTopColor=colors[i];d.innerHTML=`<p class="lab">Scenario ${i+1} · ${pct(r)}</p><p class="val">${fmt(s.portfolio)}</p><p class="sub">${fmt(s.box3Tax)} Box 3 tax · mortgage ${fmt(s.mort)}</p>`;root.appendChild(d)});
}

function updateSchedule(s){
  const body=$('scheduleBody');body.innerHTML='';
  if($('scheduleView').value==='monthly')s.schedule.forEach(r=>{const tr=document.createElement('tr');tr.innerHTML=`<td>${MONTHS[r.month-1].slice(0,3)} ${r.year}</td><td>${fmt(r.balance)}</td><td>${fmt(r.gross)}</td><td>${fmt(r.principal)}</td><td>${fmt(r.interest)}</td><td>${fmtSigned(r.taxReturn)}</td><td>${fmt(r.net)}</td><td>${fmt(r.extra)}</td>`;body.appendChild(tr)});
  else{const y={};s.schedule.forEach(r=>{if(!y[r.year])y[r.year]={balance:0,gross:0,principal:0,interest:0,taxReturn:0,net:0,extra:0};const a=y[r.year];a.balance=r.balance;a.gross+=r.gross;a.principal+=r.principal;a.interest+=r.interest;a.taxReturn+=r.taxReturn;a.net+=r.net;a.extra+=r.extra});Object.entries(y).forEach(([yr,r])=>{const tr=document.createElement('tr');tr.innerHTML=`<td>${yr}</td><td>${fmt(r.balance)}</td><td>${fmt(r.gross)}</td><td>${fmt(r.principal)}</td><td>${fmt(r.interest)}</td><td>${fmtSigned(r.taxReturn)}</td><td>${fmt(r.net)}</td><td>${fmt(r.extra)}</td>`;body.appendChild(tr)})}
}

function updateChart(s){
  const labels=s.series.map(x=>MONTHS[x.month-1].slice(0,3)+' '+x.year),p=s.series.map(x=>Math.round(x.portfolio)),m=s.series.map(x=>Math.round(x.mort)),i=s.series.map(x=>Math.round(x.invested));
  if(typeof Chart==='undefined')return;const ctx=$('mainChart').getContext('2d');
  if(!chart){const dark=matchMedia('(prefers-color-scheme: dark)').matches;chart=new Chart(ctx,{type:'line',data:{labels,datasets:[{label:'Portfolio after Box 3',data:p,borderColor:'#2a78d6',backgroundColor:'rgba(42,120,214,.07)',fill:true,pointRadius:0,borderWidth:2,tension:.25},{label:'Mortgage',data:m,borderColor:'#1baf7a',pointRadius:0,borderWidth:2,tension:.2},{label:'Invested',data:i,borderColor:'#9a9a96',borderDash:[6,4],pointRadius:0,borderWidth:1.5,tension:.2}]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>c.dataset.label+': '+fmt(c.raw)}}},scales:{x:{ticks:{autoSkip:true,maxTicksLimit:12,maxRotation:0,color:dark?'#74746f':'#8b8b86'},grid:{display:false}},y:{ticks:{callback:v=>v>=1e6?'€'+(v/1e6).toFixed(1)+'M':v>=1000?'€'+Math.round(v/1000)+'k':'€'+v,color:dark?'#74746f':'#8b8b86'},grid:{color:dark?'rgba(255,255,255,.07)':'rgba(0,0,0,.06)'}}}}})}
  else{chart.data.labels=labels;chart.data.datasets[0].data=p;chart.data.datasets[1].data=m;chart.data.datasets[2].data=i;chart.update('none')}
}

function validate(s){
  const a=[];if(s.mortTaxEnabled&&s.wozValue===0)a.push('WOZ is €0, so eigenwoningforfait is not offsetting the mortgage deduction.');if(s.mortgageMode==='purchase'&&purchaseValues().shortfall>0)a.push('Savings do not fully cover the entered purchase costs; the mortgage calculation does not finance that cash shortfall.');if(s.box3Mode==='transition')a.push('The transition scenario holds the editable 2026 current-rule parameters constant until the proposed transition year.');if(s.box3Mode==='future'||s.box3Mode==='transition')a.push('The proposed actual-return regime is not enacted law as of 1 September 2026.');const el=$('validation');el.textContent=a.join(' ');el.classList.toggle('show',a.length>0);
}
function update(){updateMortgageMode();const s=simulate();updateStats(s);updateMortgage(s);updateMortgageCompare(s);updateBox3(s);updateScenarios();updateSchedule(s);updateChart(s);validate(s)}

$('phaseList').addEventListener('input',e=>{const i=Number(e.target.dataset.i),f=e.target.dataset.field;if(!Number.isInteger(i)||!f)return;phases[i][f]=(f==='mortgageFreq'||f==='bonusDest')?e.target.value:Math.max(0,Number(e.target.value)||0);if(f==='years'||f==='mortgageFreq')renderPhases();update()});
$('phaseList').addEventListener('change',e=>{const i=Number(e.target.dataset.i),f=e.target.dataset.field;if(!Number.isInteger(i)||!f)return;phases[i][f]=(f==='mortgageFreq'||f==='bonusDest')?e.target.value:Math.max(0,Number(e.target.value)||0);if(f==='mortgageFreq')renderPhases();update()});
document.querySelectorAll('input,select').forEach(el=>{if(el.closest('#phaseList'))return;el.addEventListener('input',()=>{if(el.id==='phaseCount'||el.id==='startMonth'||el.id==='startYear')renderPhases();update()});el.addEventListener('change',()=>{if(el.id==='phaseCount'||el.id==='startMonth'||el.id==='startYear')renderPhases();update()})});
document.querySelectorAll('.compare-card[data-mort-type]').forEach(card=>card.addEventListener('click',()=>{mortTypeState=card.dataset.mortType==='linear'?'linear':'annuity';update()}));
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.panel').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('tab-'+b.dataset.tab).classList.add('active')}));

initMonths();renderPhases();update();
})();
