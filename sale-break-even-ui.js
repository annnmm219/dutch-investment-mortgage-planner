(function(root){
'use strict';
if(typeof document==='undefined')return;
const FC=root.FinanceCore,Core=root.SaleBreakEvenCore,OI=root.OutputIntegrity,II=root.InputIntegrity;
const $=id=>document.getElementById(id),engine=$('decisionEngine'),selector=$('comparisonType');
if(!engine||!selector||!FC||!Core||!OI||!II)return;
if(root.SaleBreakEvenUI)return;
const B3=root.Policy2026?.VALUES?.box3;
if(!B3)throw new Error('Policy2026 must load before sale-break-even-ui.js');
const policyPct=rate=>String(rate*100);
const MODE='sale-break-even';
const money=value=>Number.isFinite(value)?new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(value):'Unavailable';
const number=value=>String(value??'').trim().replace(/,/g,'.');
const read=id=>{const value=number($(id)?.value);return value===''?NaN:Number(value);};
const maybe=id=>{const value=number($(id)?.value);return value===''?undefined:Number(value);};
const value=(id,next)=>{if($(id))$(id).value=String(next??'');};
const text=(id,next)=>{if($(id))$(id).textContent=String(next??'');};
const selectedLabel=id=>$(id)?.selectedOptions?.[0]?.textContent||'Not selected';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const field=(id,label,initial,options={})=>`<div class="field"><label for="${id}">${label}</label><input id="${id}" type="number" value="${initial}" min="${options.min??0}"${options.max==null?'':` max="${options.max}"`} step="${options.step??1}"${options.optional?' data-optional="true"':''}>${options.help?`<p class="inline">${options.help}</p>`:''}</div>`;
const select=(id,label,options,selected)=>`<div class="field"><label for="${id}">${label}</label><select id="${id}">${options.map(([v,label])=>`<option value="${v}"${v===selected?' selected':''}>${label}</option>`).join('')}</select></div>`;
const monthOptions=Array.from({length:12},(_,i)=>[String(i+1),new Intl.DateTimeFormat('en-GB',{month:'long',timeZone:'UTC'}).format(new Date(Date.UTC(2026,i,1)))]);
const option=document.createElement('option');option.value=MODE;option.textContent='Home sale: break-even vs renting';selector.appendChild(option);
const panel=document.createElement('div');panel.id='saleBreakEvenPanel';panel.className='hidden';
panel.innerHTML=`
<div class="card">
  <div class="section-head"><div><p class="section-label">Home sale · purchase to sale</p><h2 class="sale-heading">Break-even selling price under these assumptions</h2><p id="salePanelDisclaimer">Illustration under the assumptions you enter. It does not predict prices or tell you whether to sell or rent.</p><p class="section-note">Compare the full cost of owning your main home with renting over the same period. Enter the original purchase, then choose when to sell.</p></div></div>
  <div class="sale-actions"><button type="button" id="saleImportMortgage" class="sale-button">Use my mortgage assumptions</button><button type="button" id="saleStartFresh" class="sale-button">Start fresh</button></div>
  <select id="saleInputSource" class="hidden" aria-label="Sale scenario input source"><option value="example">Illustrative example</option><option value="fresh">Entered here</option><option value="imported-purchase">Planned-purchase snapshot</option><option value="imported-existing">Existing-mortgage assumptions</option></select>
  <div id="saleSourceNote" class="callout sale-source-note"></div>
  <div class="grid2 sale-top-grid">
    ${select('saleComparisonMode','Comparison',['basic','investment'].map(v=>[v,v==='basic'?'Ownership costs versus renting':'Include renting and investing']),'basic')}
    ${field('saleMonths','Sell after this many months',60,{max:1200,help:'60 months = 5 years. The mortgage term and fixed-rate period are separate.'})}
  </div>
  <div class="grid3">
    ${field('salePurchasePrice','Original purchase price',350000,{min:.01,step:1000})}
    ${field('saleDownPayment','Own cash toward the purchase price',50000,{step:1000,help:'Exclude cash used for purchase fees. A purchase deposit counts here once.'})}
    ${field('salePurchaseCosts','Total purchase and financing costs',10000,{step:100,help:'Include transfer tax, notary, mortgage advice and other acquisition costs. Enter the complete total; no purchase tax is added again.'})}
    ${field('saleStartYear','Purchase / calculation start year',2026,{min:1900,max:2200})}
    ${select('saleStartMonth','First mortgage-payment month',monthOptions,'1')}
    <div class="field"><label for="saleInitialMortgage">Original mortgage, calculated</label><output id="saleInitialMortgage" class="sale-derived">€300,000</output><p class="inline">Price minus your down payment, plus any financed purchase costs below.</p></div>
    ${select('saleMortgageType','Mortgage repayment method',[['annuity','Annuity'],['linear','Linear']],'annuity')}
    ${field('saleMortgageRate','Original nominal mortgage rate %',4,{max:100,step:.01})}
    ${field('saleMortgageTerm','Original mortgage term, years',30,{min:1,max:100,step:1})}
  </div>
  <details class="inner-fold" id="saleMortgageDetails"><summary>Rate reset, extra repayments and financed costs</summary><div class="inner-fold-body">
    <div class="toggle"><input id="saleRateResetEnabled" type="checkbox"><label for="saleRateResetEnabled">Use a later mortgage interest rate</label></div>
    <div id="saleRateResetFields" class="grid2 hidden">
      ${field('saleFixedYears','Years from purchase until the rate resets',10,{min:1/12,max:100,step:.5})}
      ${field('saleLaterRate','Assumed nominal rate after reset %',4,{max:100,step:.01})}
    </div>
    <p class="inline">The later rate uses the debt left after repayments and the remaining original term. The loan term and tax eligibility do not restart.</p>
    <div class="grid3 advanced-grid">
      ${field('saleExtraMonthly','Extra mortgage repayment per month',0,{step:50})}
      ${field('saleExtraAnnual','Extra mortgage repayment per year',0,{step:100})}
      ${select('saleExtraAnnualMonth','Calendar month of annual extra repayment',monthOptions,'12')}
    </div>
    <div class="grid2">
      ${field('saleFinancedCosts','Purchase costs financed by the original loan',0,{step:100,help:'A subset of total purchase costs above. This increases the original debt and reduces cash paid at purchase. It does not confirm lender eligibility.'})}
      <div class="callout">Extra payments stop at the remaining debt. Later refinancing, cash-out borrowing and new renovation loans need a separate funding history and are outside this scenario.</div>
    </div>
  </div></details>
</div>
<div class="card">
  <div class="section-head"><div><p class="section-label">Rent, ownership and sale assumptions</p><p class="section-note">Use a comparable home and the same living period. Shared household expenses cancel when they are equal.</p></div></div>
  <div class="grid3">
    ${field('saleRentMonthly','Comparable monthly rent at purchase',1500,{step:25})}
    ${field('saleRentGrowth','Effective annual rent increase %',0,{min:-99,max:100,step:.25})}
    ${field('saleOwnerMonthly','Owner costs excluding mortgage, per month',250,{step:25,help:'Include VvE, maintenance, owner taxes, insurance and leasehold. Do not count VvE-funded maintenance twice.'})}
    ${field('saleOwnerGrowth','Effective annual owner-cost increase %',0,{min:-99,max:100,step:.25})}
    ${field('saleAssumedPrice','Assumed gross selling price',350000,{step:1000,help:'The price paid by the buyer, before selling costs and mortgage repayment.'})}
    ${field('saleSellingPct','Selling costs as % of sale price',1.5,{max:99.99,step:.1})}
    ${field('saleSellingFixed','Additional fixed selling costs',3000,{step:100,help:'Include fixed agent, notary or loan-discharge costs only if not already covered by the percentage.'})}
  </div>
  <details class="inner-fold"><summary>One-off renovation or other ownership expense</summary><div class="inner-fold-body"><div class="grid2">
    ${field('saleOneOffOwnerCost','One-off ownership expense paid from cash',0,{step:100,help:'For example, a renovation. Exclude amounts already included in purchase costs or monthly owner costs. The expense does not automatically increase the selling price.'})}
    ${field('saleOneOffOwnerCostMonth','Month the one-off expense is paid',1,{min:1,max:1200,help:'Count from purchase: 1 is the first payment month. Investment timing uses this date.'})}
  </div></div></details>
</div>
<div class="card">
  <div class="section-head"><div><p class="section-label">Housing-related tax benefit</p><p class="section-note">Use the net effect attributable to the home, including the eigenwoningforfait adjustment. Your entire income-tax refund is not the housing benefit.</p></div></div>
  ${select('saleTaxMode','Tax treatment',[['auto','Estimate with the shared 2026 Box 1 model'],['manual','Enter a net tax benefit / cost'],['none','Ignore housing tax effects']],'auto')}
  <div id="saleTaxAutoFields">
    <div class="grid2">
      ${field('saleTaxIncome','Annual taxable Box 1 income before own-home effects',60000,{step:1000})}
      ${field('saleTaxWoz','WOZ planning value',350000,{step:1000})}
      ${field('saleTaxHraYears','HRA eligibility remaining at purchase, years',30,{max:30,step:.5})}
      ${field('saleTaxQualifying','Original debt qualifying for interest relief %',100,{max:100,step:1})}
    </div>
    <p class="inline">The existing 2026 model covers the planner's standard pre-AOW employment-income profile. Rates and WOZ remain planning assumptions across the period; historical tax rules are not reconstructed. Enter a manual net amount for earlier purchases or unsupported profiles.</p>
    <details class="inner-fold"><summary>Additional net tax adjustment</summary><div class="inner-fold-body"><div class="grid2">
      ${field('saleTaxAdjustment','Additional net tax benefit / cost, once',0,{min:-1000000000,step:100,help:'Positive means a benefit; negative means a tax cost. For example, add the net refund from eligible financing fees once.'})}
      ${field('saleTaxAdjustmentMonth','Month to allocate this adjustment',1,{min:1,max:1200,help:'Count from purchase: 1 is the first payment month. Investment timing uses this month.'})}
    </div></div></details>
  </div>
  <div id="saleTaxManualFields" class="hidden"><div class="grid2">
    ${field('saleTaxManualTotal','Net housing-related tax benefit over this period',15000,{min:-1000000000,step:100,help:'Positive is money saved through tax; negative is an additional tax cost. Automatic housing tax is switched off.'})}
    ${field('saleTaxManualMonth','Month to allocate the entered net amount',60,{min:1,max:1200,help:'For investment timing and earlier-year break-even prices, the entire amount is attributed to this month. Enter the actual or assumed timing explicitly.'})}
  </div></div>
</div>
<div id="saleInvestmentCard" class="card hidden">
  <div class="section-head"><div><p class="section-label">Renting and investing</p><p class="section-note">Both alternatives start with equal resources and have the same monthly budget. Each invests the money left after its housing costs.</p></div></div>
  <div class="grid2">
    ${field('saleInvestmentReturn','Effective annual investment return after fees %',5,{min:-99,max:100,step:.25})}
    ${field('saleCommonPortfolio','Other investments already held in both alternatives',0,{step:1000,help:'Exclude the down payment and purchase-cost cash. The renter retains and invests that cash automatically.'})}
    ${field('saleCommonMonthly','Ordinary monthly investment in both alternatives',0,{step:50,help:'Additional to the monthly housing-cost difference. This matters for the Box 3 calculation.'})}
    ${select('saleBox3Mode','Investment wealth tax',[['none','Ignore Box 3 tax'],['current','2026 Box 3 rules held constant']],'none')}
  </div>
  <div id="saleBox3Fields" class="hidden">
    <div class="grid3">
      ${field('saleCommonSavings','Other savings retained in both alternatives',0,{step:1000,help:'Exclude cash used for the purchase. This balance stays available in both paths.'})}
      ${field('saleCommonDebt','Other Box 3 debt in both alternatives',0,{step:1000})}
      ${select('saleTaxPartners','Taxpayers / fiscal partners',[['1','1 person'],['2','2 fiscal partners']],'1')}
      ${field('saleSavingsReturn','Effective annual savings yield %',0,{min:-99,max:100,step:.01})}
      ${field('saleDebtInterest','Nominal annual rate on other debt %',0,{max:100,step:.01})}
      ${field('saleAllowance','2026 tax-free wealth allowance per person',B3.allowancePerPerson,{step:100})}
    </div>
    <details class="inner-fold"><summary>Box 3 statutory assumptions</summary><div class="inner-fold-body"><div class="grid3">
      ${field('saleBox3TaxRate','Box 3 tax rate %',policyPct(B3.taxRate),{max:100,step:.01})}
      ${field('saleDeemedInvestment','Deemed investment return %',policyPct(B3.investmentDeemedRate),{max:100,step:.01})}
      ${field('saleDeemedSavings','2026 deemed return, savings % (provisional)',policyPct(B3.savingsDeemedRate),{max:100,step:.01})}
      ${field('saleDeemedDebt','Deemed debt interest %',policyPct(B3.debtDeemedRate),{max:100,step:.01})}
      ${field('saleDebtThreshold','Debt threshold per person',B3.debtThresholdPerPerson,{step:100})}
      ${select('saleTaxPaySource','Pay Box 3 tax from',[['portfolio','Investment portfolio'],['savings','Savings'],['external','External cash flow']],'portfolio')}
    </div><p class="inline">Uses the existing 2026 planning model, including its actual-return comparison and year-end tax timing. Future law is not forecast. Other Box 3 debt is assumed interest-only here.</p></div></details>
    <div id="saleJan1Fields" class="hidden"><p class="subsection-copy sale-space">For a start after January, enter the common January 1 position before this purchase. Missing snapshots leave the investment comparison unavailable.</p><div class="grid3">
      ${field('saleJan1Portfolio','January 1 investment portfolio','',{optional:true,step:1000})}
      ${field('saleJan1Savings','January 1 savings / bank deposits','',{optional:true,step:1000})}
      ${field('saleJan1Debt','January 1 Box 3 debt','',{optional:true,step:1000})}
    </div></div>
  </div>
  <p class="inline">The final comparison ends immediately after the sale. It does not include investing sale proceeds afterward or later taxes on those proceeds.</p>
</div>
<div class="card" id="saleResultCard">
  <div class="section-head"><div><p class="section-label">Your result</p><p id="salePeriod" class="section-note"></p></div><button type="button" class="sale-button" id="saleExportCsv" disabled>Export this scenario CSV</button></div>
  <div id="saleErrors" class="callout warn hidden" role="status" aria-live="polite"></div>
  <div class="sale-headline"><p id="saleThresholdLabel">Sale price needed to match renting</p><p class="sale-headline-value" id="saleThreshold">Unavailable</p><p id="saleThresholdNote" class="inline"></p></div>
  <p id="saleConclusion" class="sale-conclusion" aria-live="polite"></p>
  <div class="summary sale-metrics">
    <div class="summary-item"><p class="k" id="saleAdvantageLabel">Modelled difference vs renting</p><p class="v" id="saleAdvantage">Unavailable</p><p class="s">Positive means owning finishes ahead</p></div>
    <div class="summary-item"><p class="k">Cash received after sale</p><p class="v" id="saleCashAfterSale">Unavailable</p><p class="s">After selling fees and mortgage repayment</p></div>
    <div class="summary-item"><p class="k">Price to recover ownership spending</p><p class="v" id="saleCashRecovery">Unavailable</p><p class="s">Recovers contributed cash, before alternative investment returns</p></div>
  </div>
  <div id="saleShortfall" class="callout warn hidden sale-space"></div>
  <div id="saleInvestmentUnavailable" class="callout warn hidden sale-space"></div>
  <p class="foot" id="saleResultBasis"></p>
  <details class="inner-fold"><summary>Full calculation breakdown</summary><div class="inner-fold-body"><div class="table-wrap"><table class="sale-breakdown-table"><thead><tr><th>Item</th><th>Amount</th></tr></thead><tbody id="saleBreakdownBody"></tbody></table></div><p class="inline">Cash contributed includes your down payment, fees and mortgage principal. Remaining debt falls by the same principal amount. Principal is counted once.</p></div></details>
  <details class="inner-fold" open><summary>Required selling price by holding period</summary><div class="inner-fold-body"><p class="subsection-copy">Each row is a separate sale date. The assumed gross selling price is held the same in every row to isolate the effect of time; this is not a house-price forecast.</p><div id="saleThresholdChart" class="sale-chart"></div><div class="table-wrap"><table class="sale-annual-table"><thead id="saleAnnualHead"></thead><tbody id="saleAnnualBody"></tbody></table></div></div></details>
</div>`;
engine.appendChild(panel);
const style=document.createElement('style');style.id='saleBreakEvenStyle';style.textContent=`
#saleBreakEvenPanel .sale-heading{font-size:22px;font-weight:600;letter-spacing:-.025em;line-height:1.3;margin:5px 0 7px}
#saleBreakEvenPanel .section-note,#saleBreakEvenPanel .inline,#saleBreakEvenPanel .subsection-copy,#saleBreakEvenPanel .foot,#saleBreakEvenPanel .summary-item .k,#saleBreakEvenPanel .summary-item .s{color:var(--secondary)}
#saleBreakEvenPanel .sale-actions{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.sale-button{font:inherit;font-size:12px;font-weight:500;border:1px solid var(--border2);border-radius:var(--small);padding:10px 13px;min-height:40px;background:var(--surface);color:var(--text);cursor:pointer}
.sale-button:hover{background:var(--alt)}.sale-button:disabled{opacity:.5;cursor:default}
#saleBreakEvenPanel .sale-top-grid{margin-top:16px}#saleBreakEvenPanel .sale-derived{display:block;min-height:40px;padding:8px 10px;border-radius:var(--small);background:var(--alt);color:var(--text);font-size:14px;font-weight:600}
#saleBreakEvenPanel .sale-headline{background:var(--accentbg);border-radius:var(--radius);padding:18px;margin:12px 0;color:var(--accenttext)}
#saleBreakEvenPanel .sale-headline>p:first-child{font-size:13px;font-weight:500}#saleBreakEvenPanel .sale-headline-value{font-size:32px;line-height:1.25;font-weight:600;letter-spacing:-.025em;margin:5px 0;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}
#saleBreakEvenPanel .sale-conclusion{font-size:14px;line-height:1.65;color:var(--text);margin:12px 0}#saleBreakEvenPanel .sale-metrics{grid-template-columns:repeat(3,minmax(0,1fr))}#saleBreakEvenPanel .sale-metrics .v{overflow-wrap:anywhere;font-variant-numeric:tabular-nums}
#saleBreakEvenPanel .sale-space{margin-top:12px}#saleBreakEvenPanel .sale-breakdown-table{min-width:420px}#saleBreakEvenPanel .sale-annual-table{min-width:670px}#saleBreakEvenPanel td{font-variant-numeric:tabular-nums}#saleBreakEvenPanel .sale-chart{margin:14px 0}#saleBreakEvenPanel .sale-chart svg{display:block;width:100%;height:auto;max-height:280px}#saleBreakEvenPanel .sale-chart text{fill:var(--secondary);font:12px Inter,Arial,sans-serif}
#saleBreakEvenPanel .sale-chart-legend{display:flex;gap:16px;flex-wrap:wrap;font-size:11px;color:var(--secondary);margin:8px 0}#saleBreakEvenPanel .sale-chart-key{display:inline-block;width:20px;height:3px;margin-right:6px;vertical-align:middle;background:var(--accent)}#saleBreakEvenPanel .sale-chart-key.cash{background:var(--secondary)}#saleBreakEvenPanel .sale-chart-key.investment{background:var(--green)}
#saleBreakEvenPanel .sale-errors-list{margin:6px 0 0 18px}#decisionEngine.sale-mode-active .scenario-builder>.grid3{grid-template-columns:1fr}#decisionEngine.sale-mode-active .scenario-builder .section-note{display:none}
@media(max-width:800px){#saleBreakEvenPanel .sale-metrics{grid-template-columns:1fr}#saleBreakEvenPanel .sale-headline-value{font-size:28px}#saleBreakEvenPanel .card{padding:17px 15px}#saleBreakEvenPanel .sale-chart text{font-size:13px}}
`;document.head.appendChild(style);
let active=false,updating=false,builderLabelBeforeSale=null;
const hiddenStates=new Map();
function conceal(element){if(!element||element===panel)return;if(!hiddenStates.has(element))hiddenStates.set(element,element.classList.contains('hidden'));element.classList.add('hidden');}
function setActive(next){
  const was=active;active=Boolean(next);engine.classList.toggle('sale-mode-active',active);panel.classList.toggle('hidden',!active);
  if(active){
    const builder=selector.closest('.scenario-builder'),selectorField=selector.closest('.field');
    const label=builder?.querySelector('.section-label');if(label){if(!was)builderLabelBeforeSale=label.textContent;label.textContent='Choose the decision';}
    Array.from(engine.children).forEach(el=>{if(el!==builder&&el!==panel&&el.tagName!=='STYLE')conceal(el);});
    if(builder){Array.from(builder.children).forEach(el=>{if(el.classList.contains('section-head'))return;if(el.contains(selector)){Array.from(el.children).forEach(child=>{if(child!==selectorField&&!child.contains(selector))conceal(child);});}else conceal(el);});}
    root.__DIMP_ACTIVE_SCENARIO_CONFIG=null;root.__DIMP_CANONICAL_COMPARISON=null;root.__DIMP_CANONICAL_NEXT_EURO=null;
  }else if(was){
    hiddenStates.forEach((hidden,el)=>el.classList.toggle('hidden',hidden));hiddenStates.clear();root.__DIMP_SALE_BREAK_EVEN_RESULT=null;
    const label=selector.closest('.scenario-builder')?.querySelector('.section-label');if(label&&builderLabelBeforeSale!==null)label.textContent=builderLabelBeforeSale;builderLabelBeforeSale=null;
  }
  return active;
}
function syncVisibility(){
  const invest=$('saleComparisonMode').value==='investment',taxMode=$('saleTaxMode').value,box=invest&&$('saleBox3Mode').value==='current';
  $('saleRateResetFields').classList.toggle('hidden',!$('saleRateResetEnabled').checked);
  $('saleTaxAutoFields').classList.toggle('hidden',taxMode!=='auto');$('saleTaxManualFields').classList.toggle('hidden',taxMode!=='manual');
  $('saleInvestmentCard').classList.toggle('hidden',!invest);$('saleBox3Fields').classList.toggle('hidden',!box);$('saleJan1Fields').classList.toggle('hidden',!box||read('saleStartMonth')===1);
  const notes={example:'Illustrative example. These numbers are examples, not your actual home. Edit them or copy your mortgage assumptions.',fresh:'Fresh scenario. Enter original purchase facts and your own assumptions. No values are being read from the other planner tabs.','imported-purchase':'Planned-purchase snapshot. Mortgage and purchase assumptions were copied once. Review the first-payment date, costs and tax eligibility. Extra repayment phases were not imported; enter them below. Later changes in other tabs do not alter this snapshot.','imported-existing':'Existing-mortgage assumptions copied once. The current rate, repayment method and tax assumptions are shown for review. The current debt, remaining term and years until the next reset are not original purchase facts and were not copied. Enter the original purchase, dates, term and rate history. Extra repayments need explicit entry.'};
  const source=$('saleInputSource').value;const note=notes[source]||notes.fresh;text('saleSourceNote',note+(source.startsWith('imported-')?' Rent, owner costs and the assumed selling price are not imported; review them separately.':''));
}
function makeConfig(){
  const taxMode=$('saleTaxMode').value,investmentEnabled=$('saleComparisonMode').value==='investment';
  const purchasePrice=read('salePurchasePrice'),downPayment=read('saleDownPayment'),financedPurchaseCosts=read('saleFinancedCosts'),termYears=read('saleMortgageTerm'),annualRatePct=read('saleMortgageRate');
  const tax=taxMode==='auto'?{enabled:true,calculationMode:'box1-2026',box1IncomeBeforeOwnHome:read('saleTaxIncome'),wozValue:read('saleTaxWoz'),hraRemainingMonths:Math.round(read('saleTaxHraYears')*12),qualifyingInterestFraction:read('saleTaxQualifying')/100}:{enabled:false};
  const oneOffTaxBenefit=taxMode==='manual'?read('saleTaxManualTotal'):taxMode==='auto'?read('saleTaxAdjustment'):0;
  const oneOffTaxMonth=taxMode==='manual'?read('saleTaxManualMonth'):taxMode==='auto'?read('saleTaxAdjustmentMonth'):1;
  const box3={mode:investmentEnabled?$('saleBox3Mode').value:'none'};
  if(box3.mode==='current'){
    Object.assign(box3,{savings:read('saleCommonSavings'),debt:read('saleCommonDebt'),savingsReturnPct:read('saleSavingsReturn'),debtInterestPct:read('saleDebtInterest'),taxPartners:read('saleTaxPartners'),currentAllowance:read('saleAllowance'),currentTaxRate:read('saleBox3TaxRate')/100,currentNotional:read('saleDeemedInvestment')/100,currentSavingsNotional:read('saleDeemedSavings')/100,currentDebtNotional:read('saleDeemedDebt')/100,currentDebtThreshold:read('saleDebtThreshold'),paySource:$('saleTaxPaySource').value});
    if(read('saleStartMonth')!==1)[['firstJan1Portfolio','saleJan1Portfolio'],['firstJan1Savings','saleJan1Savings'],['firstJan1Debt','saleJan1Debt']].forEach(([key,id])=>{const n=maybe(id);if(n!==undefined)box3[key]=n;});
  }
  return{purchasePrice,downPayment,purchaseCosts:read('salePurchaseCosts'),financedPurchaseCosts,months:read('saleMonths'),startYear:read('saleStartYear'),startMonth:read('saleStartMonth'),salePrice:read('saleAssumedPrice'),sellingCostPct:read('saleSellingPct'),sellingCostFixed:read('saleSellingFixed'),rentMonthly:read('saleRentMonthly'),rentGrowthPct:read('saleRentGrowth'),ownerCostsMonthly:read('saleOwnerMonthly'),ownerCostsGrowthPct:read('saleOwnerGrowth'),oneOffOwnerCost:read('saleOneOffOwnerCost'),oneOffOwnerCostMonth:read('saleOneOffOwnerCostMonth'),oneOffTaxBenefit,oneOffTaxMonth,mortgage:{balance:purchasePrice-downPayment+financedPurchaseCosts,annualRatePct,termYears,type:$('saleMortgageType').value,extraMonthly:read('saleExtraMonthly'),extraAnnual:read('saleExtraAnnual'),extraAnnualMonth:read('saleExtraAnnualMonth'),ratePeriods:FC.twoPeriodMortgageRates({enabled:$('saleRateResetEnabled').checked,termYears,fixedYears:read('saleFixedYears'),currentRatePct:annualRatePct,laterRatePct:read('saleLaterRate')})},tax,investment:{enabled:investmentEnabled,annualReturnPct:investmentEnabled?read('saleInvestmentReturn'):0,commonInitialPortfolio:investmentEnabled?read('saleCommonPortfolio'):0,commonMonthlyContribution:investmentEnabled?read('saleCommonMonthly'):0,box3}};
}
function customErrors(config){
  const errors=[];
  const selections=[['saleComparisonMode',['basic','investment']],['saleTaxMode',['auto','manual','none']],['saleMortgageType',['annuity','linear']]];if(config.investment.enabled)selections.push(['saleBox3Mode',['none','current']]);
  for(const [id,allowed] of selections)if(!allowed.includes($(id).value))errors.push({message:`Select a valid ${document.querySelector(`label[for="${id}"]`)?.textContent||id}.`});
  for(const id of ['saleMonths','saleStartYear','saleStartMonth','saleExtraAnnualMonth'])if(!Number.isInteger(read(id)))errors.push({message:`${document.querySelector(`label[for="${id}"]`)?.textContent||id} must be a whole number.`});
  if($('saleTaxMode').value==='auto'&&config.startYear<2026)errors.push({message:'Automatic tax mode uses the 2026 planning model. For a purchase before 2026, choose an explicit manual net housing-tax amount or ignore tax effects.'});
  if($('saleTaxMode').value==='auto'&&config.mortgage.termYears>30&&read('saleTaxQualifying')>0)errors.push({message:'Automatic purchase-mortgage interest relief requires a qualifying repayment term of at most 30 years. Review the original term or choose a manual tax amount.'});
  if($('saleRateResetEnabled').checked&&read('saleFixedYears')>config.mortgage.termYears)errors.push({message:'The first fixed-rate period cannot exceed the original mortgage term.'});
  if(config.oneOffTaxBenefit!==0&&config.oneOffTaxMonth>config.months)errors.push({message:'The entered tax amount is allocated after the selected sale date. Choose an allocation month within the holding period or exclude that amount.'});
  if(config.oneOffTaxBenefit!==0&&!Number.isInteger(config.oneOffTaxMonth))errors.push({message:'The tax allocation month must be a whole number counted from purchase.'});
  if(config.oneOffOwnerCost>0&&config.oneOffOwnerCostMonth>config.months)errors.push({message:'The one-off ownership expense is dated after the selected sale. Choose a month within the holding period or exclude this expense.'});
  if(config.oneOffOwnerCost>0&&!Number.isInteger(config.oneOffOwnerCostMonth))errors.push({message:'The one-off ownership-expense month must be a whole number counted from purchase.'});
  return errors;
}
function threshold(value){return Number.isFinite(value)?money(Math.max(0,Math.ceil(value))):'Unavailable';}
function displayDate(year,month){return Number.isFinite(year)&&Number.isFinite(month)?new Intl.DateTimeFormat('en-GB',{month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(year,month-1,1))):'';}
function periodText(period){return period.months?`${displayDate(period.startYear,period.startMonth)} to ${displayDate(period.endYear,period.endMonth)} · ${period.months} months · sale after the final monthly payment`:`${displayDate(period.startYear,period.startMonth)} · sale at purchase, before monthly payments`;}
function tableRow(label,amount){const tr=document.createElement('tr'),a=document.createElement('td'),b=document.createElement('td');a.textContent=label;b.textContent=money(amount);tr.append(a,b);return tr;}
function investmentReason(investment){const messages=(investment.errors||[]).map(error=>error.message).filter(Boolean);return messages.length?[...new Set(messages)].join(' '):investment.reason||'Complete the investment assumptions.';}
function exportRows(result,config){
  const rows=[['Sale scenario','Status',result.valid?'Available':'Unavailable'],['Sale scenario','Source',selectedLabel('saleInputSource')],['Sale scenario','Comparison',selectedLabel('saleComparisonMode')],['Sale scenario','Tax treatment',selectedLabel('saleTaxMode')]];
  if(!result.valid){rows.push(['Sale scenario','Reason',(result.errors||[]).map(e=>e.message).join(' ')]);return rows;}
  rows.push(['Sale scenario','Period',result.period.label],['Sale scenario','Currency / basis','EUR nominal'],['Sale input','Purchase price',config.purchasePrice],['Sale input','Down payment toward price',config.downPayment],['Sale input','Total purchase costs',config.purchaseCosts],['Sale input','Financed purchase costs',config.financedPurchaseCosts],['Sale input','Original mortgage',config.mortgage.balance],['Sale input','Original mortgage term, years',config.mortgage.termYears],['Sale input','Original nominal annual rate %',config.mortgage.annualRatePct],['Sale input','Repayment method',config.mortgage.type],['Sale input','Extra monthly principal',config.mortgage.extraMonthly],['Sale input','Extra annual principal',config.mortgage.extraAnnual],['Sale input','Annual extra calendar month',config.mortgage.extraAnnualMonth],['Sale input','Rate periods',JSON.stringify(config.mortgage.ratePeriods)],['Sale input','Rent per month at purchase',config.rentMonthly],['Sale input','Annual rent growth %',config.rentGrowthPct],['Sale input','Owner costs per month at purchase',config.ownerCostsMonthly],['Sale input','Annual owner-cost growth %',config.ownerCostsGrowthPct],['Sale input','Selling costs %',config.sellingCostPct],['Sale input','Fixed selling costs',config.sellingCostFixed],['Sale input','Tax assumptions',JSON.stringify(config.tax)],['Sale input','Additional net tax adjustment',config.oneOffTaxBenefit],['Sale input','Tax adjustment month',config.oneOffTaxMonth],['Sale input','Investment assumptions',JSON.stringify(config.investment)]);
  const pairs=[['Assumed gross selling price',result.salePrice],['Initial buyer cash',result.initialCash],['Total net cash contributed',result.cashContributed],['Mortgage principal repaid',result.totals.principalPaid],['Mortgage interest paid',result.totals.interestPaid],['Owner costs',result.totals.ownerCosts],['Net housing-tax benefit',result.totals.netTaxBenefit],['Comparable rent',result.totals.rentPaid],['Remaining mortgage',result.remainingMortgage],['Selling costs',result.saleCosts],['Cash after sale',result.netSaleProceeds],['Additional cash needed at sale',result.cashRequiredAtSale],['Ownership cash result',result.ownershipProfit],['Basic advantage versus renting',result.advantageVsRent],['Raw sale threshold to match rent',result.breakEven.rentParity],['Nonnegative sale threshold to match rent',Math.max(0,result.breakEven.rentParity)],['Sale threshold to recover ownership spending',result.breakEven.cashRecovery],['Sale threshold to clear mortgage and fees',result.breakEven.debtClearance]];
  rows.push(['Sale input','One-off owner expense',config.oneOffOwnerCost],['Sale input','One-off owner-expense month',config.oneOffOwnerCostMonth]);
  pairs.forEach(([label,amount])=>rows.push(['Sale result',label,amount]));
  if(result.investment.enabled){rows.push(['Sale investment','Available',result.investment.available]);if(result.investment.available){rows.push(['Sale investment','Modelled difference vs renting and investing',result.investment.advantage],['Sale investment','Raw sale threshold',result.investment.breakEvenSalePrice],['Sale investment','Owner terminal investments',result.investment.ownerTerminalInvestments],['Sale investment','Renter terminal investments',result.investment.renterTerminalInvestments],['Sale investment','Owner financial comparable wealth before sale',result.investment.ownerComparableWealth],['Sale investment','Renter financial comparable wealth',result.investment.renterComparableWealth]);}else rows.push(['Sale investment','Reason',investmentReason(result.investment)]);}
  (result.annual||[]).forEach(entry=>{const section=`Sale after ${entry.months} months`;rows.push([section,'End month',entry.period.end],[section,'Remaining debt',entry.remainingMortgage],[section,'Basic rent-parity price',entry.breakEven.rentParity],[section,'Cash-recovery price',entry.breakEven.cashRecovery],[section,'Basic advantage at same assumed sale price',entry.advantageVsRent]);if(entry.investment?.available)rows.push([section,'Investment-adjusted rent-parity price',entry.investment.breakEvenSalePrice],[section,'Investment-adjusted advantage',entry.investment.advantage]);});
  return rows;
}
function invalidResult(errors,config={}){
  const result={kind:'dimp.sale-break-even.v1',valid:false,errors,exportRows:[]};result.exportRows=exportRows(result,config);root.__DIMP_SALE_BREAK_EVEN_RESULT=result;
  const errorBox=$('saleErrors');errorBox.classList.remove('hidden');errorBox.replaceChildren();const title=document.createElement('strong');title.textContent='Complete or correct the scenario inputs.';errorBox.append(title);const list=document.createElement('ul');list.className='sale-errors-list';errors.slice(0,8).forEach(error=>{const li=document.createElement('li');li.textContent=error.message||String(error);list.appendChild(li);});errorBox.appendChild(list);
  ['saleThreshold','saleAdvantage','saleCashAfterSale','saleCashRecovery'].forEach(id=>text(id,'Unavailable'));
  ['salePeriod','saleThresholdNote','saleConclusion','saleResultBasis'].forEach(id=>text(id,''));
  ['saleBreakdownBody','saleAnnualHead','saleAnnualBody','saleThresholdChart'].forEach(id=>$(id).replaceChildren());
  $('saleShortfall').classList.add('hidden');$('saleInvestmentUnavailable').classList.add('hidden');$('saleExportCsv').disabled=true;
}
function renderChart(annual,withInvestment){
  const container=$('saleThresholdChart');container.replaceChildren();if(annual.length<2)return;
  const series=[{label:'Match renting',key:'rent',color:'var(--accent)',get:r=>r.breakEven.rentParity},{label:'Recover ownership spending',key:'cash',color:'var(--secondary)',get:r=>r.breakEven.cashRecovery}];
  if(withInvestment&&annual.every(r=>r.investment?.available))series.push({label:'Match renting and investing',key:'investment',color:'var(--green)',get:r=>r.investment.breakEvenSalePrice});
  const width=760,height=240,left=80,right=20,top=20,bottom=36,minMonth=annual[0].months,maxMonth=annual[annual.length-1].months;
  const values=series.flatMap(s=>annual.map(r=>Math.max(0,s.get(r)))).filter(Number.isFinite),minimum=Math.min(...values),maximum=Math.max(...values),span=Math.max(1000,maximum-minimum),lo=Math.max(0,minimum-span*.12),hi=maximum+span*.12;
  if(!values.length||!Number.isFinite(hi))return;
  const x=m=>left+(m-minMonth)/Math.max(1,maxMonth-minMonth)*(width-left-right),y=v=>top+(hi-Math.max(0,v))/(hi-lo)*(height-top-bottom);
  let markup='<title>Required gross selling price by holding period</title><desc>The table below provides the same values. This chart shows break-even thresholds, not a forecast of home prices.</desc>';
  for(let i=0;i<3;i++){const v=lo+(hi-lo)*i/2,yy=y(v);markup+=`<line x1="${left}" y1="${yy}" x2="${width-right}" y2="${yy}" stroke="var(--border)"/><text x="${left-10}" y="${yy+4}" text-anchor="end">${esc(money(v))}</text>`;}
  series.forEach(s=>{const points=annual.map(r=>`${x(r.months).toFixed(2)},${y(s.get(r)).toFixed(2)}`).join(' ');markup+=`<polyline points="${points}" fill="none" stroke="${s.color}" stroke-width="2.5"/>`;});
  markup+=`<text x="${left}" y="${height-8}">${minMonth} months</text><text x="${width-right}" y="${height-8}" text-anchor="end">${maxMonth} months</text>`;
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.setAttribute('role','img');svg.setAttribute('aria-label','Required selling-price thresholds over the selected holding periods; exact figures are in the following table.');svg.innerHTML=markup;container.appendChild(svg);
  const legend=document.createElement('div');legend.className='sale-chart-legend';series.forEach(s=>{const label=document.createElement('span'),swatch=document.createElement('i');swatch.className=`sale-chart-key ${s.key}`;swatch.setAttribute('aria-hidden','true');label.append(swatch,document.createTextNode(s.label));legend.append(label);});container.appendChild(legend);
}
function render(result,config){
  $('saleErrors').classList.add('hidden');$('saleExportCsv').disabled=false;
  const withInvestment=config.investment.enabled,available=!withInvestment||result.investment.available,required=withInvestment?result.investment.breakEvenSalePrice:result.breakEven.rentParity,advantage=withInvestment?result.investment.advantage:result.advantageVsRent;
  text('salePeriod',periodText(result.period));text('saleThresholdLabel',withInvestment?'Sale price needed to match renting and investing':'Sale price needed to match renting');
  text('saleThreshold',available?threshold(required):'Investment result unavailable');text('saleAdvantageLabel',withInvestment?'Modelled difference vs renting and investing':'Modelled difference vs renting');text('saleAdvantage',available?money(advantage):'Unavailable');text('saleCashAfterSale',money(result.netSaleProceeds));text('saleCashRecovery',threshold(result.breakEven.cashRecovery));
  text('saleThresholdNote',available?(required<=0?'Under these assumptions, the owning path matches renting even at a €0 sale price. Any remaining mortgage must still be repaid.':'Gross sale price before selling costs. At this price both paths end with the same modelled result. Above it, the owning path ends higher in this model.'):'The basic ownership-cost comparison remains available in the breakdown below.');
  const conclusion=$('saleConclusion');
  if(available){const relation=Math.abs(advantage)<.5?'<strong>level with</strong>':advantage>0?`<strong>${money(advantage)} higher than</strong>`:`<strong>${money(-advantage)} lower than</strong>`;const path=withInvestment?'renting and investing':'renting';if(conclusion)conclusion.innerHTML=`Under these assumptions, the owning path ends ${relation} the ${path} path. This is a model result, not a forecast.`;}else if(conclusion)conclusion.textContent=`At ${money(result.salePrice)}, the basic cash comparison shows the owning path ${money(Math.abs(result.advantageVsRent))} ${result.advantageVsRent>=0?'higher':'lower'} than renting. Complete the investment assumptions to compare final wealth.`;
  const shortfall=$('saleShortfall');shortfall.classList.toggle('hidden',result.cashRequiredAtSale<=.005);shortfall.textContent=result.cashRequiredAtSale>.005?`Additional cash needed at sale: ${money(result.cashRequiredAtSale)}. The sale would not fully repay the mortgage and selling costs, even if the lifetime comparison favours owning.`:'';
  const unavailable=$('saleInvestmentUnavailable');unavailable.classList.toggle('hidden',!withInvestment||result.investment.available);unavailable.textContent=withInvestment&&!result.investment.available?`Investment comparison unavailable: ${investmentReason(result.investment)}`:'';
  text('saleResultBasis',withInvestment?`Nominal euros. Investment returns are assumptions. Housing cash-flow differences are invested once; avoided rent is not added again. ${config.investment.box3.mode==='current'?'The 2026 Box 3 planning parameters are held constant; incomplete final years remain estimates.':'Box 3 tax is excluded.'}`:'Nominal euros. This basic comparison excludes alternative investment returns and inflation. A positive cash amount after selling includes your returned down payment and repaid principal; it is not all profit.');
  const t=result.totals,breakdown=[['Cash contributed at purchase',result.initialCash],['Scheduled principal repaid',t.scheduledPrincipalPaid],['Extra principal repaid',t.extraPrincipalPaid],['Mortgage interest paid',t.interestPaid],['Other ownership expenses',t.ownerCosts],['Net housing-tax benefit / cost',t.netTaxBenefit],['Total net cash contributed',result.cashContributed],['Comparable rent over the same period',t.rentPaid],['Assumed gross selling price',result.salePrice],['Selling costs',result.saleCosts],['Remaining mortgage repaid at sale',result.remainingMortgage],['Cash after sale',result.netSaleProceeds],['Net cash result from ownership',result.ownershipProfit],['Basic modelled difference vs renting',result.advantageVsRent],['Sale price to clear mortgage and fees',result.breakEven.debtClearance]];
  if(result.investment.available)breakdown.push(['Owner terminal investment portfolio',result.investment.ownerTerminalInvestments],['Renter terminal investment portfolio',result.investment.renterTerminalInvestments],['Owner financial position before home sale',result.investment.ownerComparableWealth],['Renter financial position',result.investment.renterComparableWealth],['Advantage including investments',result.investment.advantage]);
  $('saleBreakdownBody').replaceChildren(...breakdown.map(([label,amount])=>tableRow(label,amount)));
  const heads=['Sale after','Final payment month','Mortgage remaining','Match renting','Recover spending',...(withInvestment?['Match renting + investing']:[]),'Advantage at assumed sale price'];
  const headRow=document.createElement('tr');heads.forEach(label=>{const th=document.createElement('th');th.textContent=label;headRow.append(th);});$('saleAnnualHead').replaceChildren(headRow);
  const annual=result.annual||[];$('saleAnnualBody').replaceChildren(...annual.map(entry=>{const tr=document.createElement('tr'),cells=[`${entry.months} months`,displayDate(entry.period.endYear,entry.period.endMonth),money(entry.remainingMortgage),threshold(entry.breakEven.rentParity),threshold(entry.breakEven.cashRecovery),...(withInvestment?[entry.investment?.available?threshold(entry.investment.breakEvenSalePrice):'Unavailable']:[]),money(withInvestment?(entry.investment?.available?entry.investment.advantage:NaN):entry.advantageVsRent)];cells.forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.append(td);});return tr;}));renderChart(annual,withInvestment);
}
function update(){
  if(updating||selector.value!==MODE)return;
  updating=true;
  try{
    setActive(true);syncVisibility();
    const derived=read('salePurchasePrice')-read('saleDownPayment')+read('saleFinancedCosts');text('saleInitialMortgage',Number.isFinite(derived)?money(derived):'Enter purchase facts');
    const report=II.validateControls(panel.querySelectorAll('input'));
    if(!report.valid){invalidResult(report.errors);return;}
    const config=makeConfig(),errors=customErrors(config);if(errors.length){invalidResult(errors,config);return;}
    const result=Core.calculate(config);if(!result.valid){invalidResult(result.errors||[{message:result.reason||'Calculation unavailable.'}],config);return;}
    result.kind='dimp.sale-break-even.v1';result.inputSource=$('saleInputSource').value;result.config=config;result.exportRows=exportRows(result,config);root.__DIMP_SALE_BREAK_EVEN_RESULT=result;render(result,config);
  }catch(error){invalidResult([{message:error instanceof Error?error.message:'The scenario could not be calculated.'}]);}
  finally{updating=false;}
}
function notifyChange(){const trigger=$('saleInputSource');trigger.dispatchEvent(new Event('change',{bubbles:true}));update();}
function startFresh(){
  value('saleInputSource','fresh');
  ['salePurchasePrice','saleDownPayment','salePurchaseCosts','saleStartYear','saleMortgageRate','saleMortgageTerm','saleRentMonthly','saleOwnerMonthly','saleAssumedPrice','saleTaxIncome','saleTaxWoz','saleTaxHraYears','saleTaxQualifying','saleTaxManualTotal','saleJan1Portfolio','saleJan1Savings','saleJan1Debt'].forEach(id=>value(id,''));
  const defaults={saleMonths:60,saleStartMonth:1,saleMortgageType:'annuity',saleComparisonMode:'basic',saleFinancedCosts:0,saleExtraMonthly:0,saleExtraAnnual:0,saleExtraAnnualMonth:12,saleFixedYears:10,saleLaterRate:4,saleRentGrowth:0,saleOwnerGrowth:0,saleOneOffOwnerCost:0,saleOneOffOwnerCostMonth:1,saleSellingPct:1.5,saleSellingFixed:0,saleTaxMode:'auto',saleTaxAdjustment:0,saleTaxAdjustmentMonth:1,saleTaxManualMonth:60,saleInvestmentReturn:5,saleCommonPortfolio:0,saleCommonMonthly:0,saleBox3Mode:'none',saleCommonSavings:0,saleCommonDebt:0,saleSavingsReturn:0,saleDebtInterest:0,saleTaxPartners:1};Object.entries(defaults).forEach(([id,n])=>value(id,n));$('saleRateResetEnabled').checked=false;notifyChange();
}
function importMortgage(){
  const planned=$('mortgageMode')?.value==='purchase',copy=(from,to)=>value(to,$(from)?.value??'');
  value('saleInputSource',planned?'imported-purchase':'imported-existing');value('saleExtraMonthly',0);value('saleExtraAnnual',0);value('saleFinancedCosts',0);
  value('saleMortgageType',document.querySelector('.compare-card.active[data-mort-type]')?.dataset.mortType||'annuity');copy(planned?'purchaseRate':'mortRate','saleMortgageRate');
  if(planned){copy('housePrice','salePurchasePrice');copy('purchaseCosts','salePurchaseCosts');const saved=read('ownSavings'),fees=read('purchaseCosts');value('saleDownPayment',Number.isFinite(saved)&&Number.isFinite(fees)?saved-fees:'');copy('purchaseYears','saleMortgageTerm');copy('startYear','saleStartYear');copy('startMonth','saleStartMonth');$('saleRateResetEnabled').checked=Boolean($('mortRateResetEnabled')?.checked);copy('mortRateFixedYears','saleFixedYears');copy('mortRateLaterPct','saleLaterRate');}
  else{['salePurchasePrice','salePurchaseCosts','saleDownPayment','saleMortgageTerm','saleStartYear'].forEach(id=>value(id,''));value('saleStartMonth','');$('saleRateResetEnabled').checked=false;value('saleFixedYears','');value('saleLaterRate','');}
  if($('mortTaxEnabled')?.checked===false)value('saleTaxMode','none');else if($('deductionMode')?.value==='manual'){value('saleTaxMode','manual');value('saleTaxManualTotal','');}else value('saleTaxMode','auto');
  copy('grossIncome','saleTaxIncome');copy('wozValue','saleTaxWoz');const hraYears=read('hraRemainingYears'),hraMonths=read('hraRemainingMonths');value('saleTaxHraYears',Number.isFinite(hraYears)?hraYears+(Number.isFinite(hraMonths)?hraMonths/12:0):'');copy('qualifyingBox1DebtPct','saleTaxQualifying');
  value('saleTaxAdjustment',0);value('saleTaxAdjustmentMonth',1);['saleJan1Portfolio','saleJan1Savings','saleJan1Debt'].forEach(id=>value(id,''));notifyChange();
}
$('saleStartFresh').addEventListener('click',startFresh);$('saleImportMortgage').addEventListener('click',importMortgage);
$('saleExportCsv').addEventListener('click',()=>{const result=root.__DIMP_SALE_BREAK_EVEN_RESULT;if(!result?.valid)return;const identity=root.__DIMP_RELEASE_IDENTITY||{},rows=[['Model','Build',identity.buildId||root.MODEL_META?.version||'Development'],['Model','Source status',identity.calculationSourceSha||'Unfrozen development preview'],...result.exportRows],blob=new Blob(['\uFEFF'+OI.outputCsv(rows)],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`home-sale-break-even-${result.period.start}-to-${result.period.end}.csv`;document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);});
const priorExport=OI.canonicalExportRows.bind(OI);OI.canonicalExportRows=function(args={}){const rows=priorExport(args),result=root.__DIMP_SALE_BREAK_EVEN_RESULT;return selector.value===MODE&&result?.exportRows?[...rows,...result.exportRows]:rows;};
root.SaleBreakEvenUI={update,setActive,makeConfig,startFresh,importMortgage};
setActive(selector.value===MODE);syncVisibility();if(active)update();
})(typeof globalThis!=='undefined'?globalThis:this);
