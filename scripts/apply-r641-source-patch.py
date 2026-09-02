from pathlib import Path
import json
import re

ROOT=Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT/path).read_text(encoding='utf-8')


def write(path,text):
    (ROOT/path).write_text(text,encoding='utf-8')


def replace_once(text,old,new,label):
    count=text.count(old)
    if count!=1:
        raise RuntimeError(f'{label}: expected one match, found {count}')
    return text.replace(old,new,1)


# finance-core.js: conserve the recurring Box 3 debt-repayment budget after payoff.
path=Path('finance-core.js')
text=read(path)
text=replace_once(text,
"  savingsFlows=[],box3DebtMonthlyRepayment=0,debtRepayments=[],debtRepaymentSource='external',futureStart=2028,futureTaxRate=.36,futureExempt=1800,futureLossThreshold=500\n",
"  savingsFlows=[],box3DebtMonthlyRepayment=0,debtRepayments=[],debtRepaymentSource='external',box3DebtFallbackDestination='invest',futureStart=2028,futureTaxRate=.36,futureExempt=1800,futureLossThreshold=500\n",
'investment-flow fallback parameter')
text=replace_once(text,
"  let externalDebtRepayment=0,totalDebtRepaid=0,totalDebtInterest=0,cashShortfall=0;\n",
"  let externalDebtRepayment=0,totalDebtRepaid=0,totalDebtInterest=0,cashShortfall=0;\n  let plannedBox3DebtRepayment=0,unusedBox3DebtRepayment=0,box3DebtFallbackInvested=0,box3DebtFallbackSaved=0,box3DebtFallbackConsumed=0,box3DebtRepaymentShortfall=0,externalBox3DebtFallback=0;\n",
'investment-flow fallback tracking')
old="""    const requestedDebtRepay=monthlyDebtRepayments.length?nonNegative(monthlyDebtRepayments[i]):nonNegative(box3DebtMonthlyRepayment);
    if(requestedDebtRepay>0&&debt>0){
      let repay=Math.min(debt,requestedDebtRepay);
      if(debtRepaymentSource==='savings'){repay=Math.min(repay,savings);savings-=repay;}
      else externalDebtRepayment+=repay;
      debt-=repay;totalDebtRepaid+=repay;
    }
"""
new="""    const requestedDebtRepay=monthlyDebtRepayments.length?nonNegative(monthlyDebtRepayments[i]):nonNegative(box3DebtMonthlyRepayment);
    plannedBox3DebtRepayment+=requestedDebtRepay;
    const availableDebtBudget=debtRepaymentSource==='savings'?Math.min(requestedDebtRepay,savings):requestedDebtRepay;
    const repay=Math.min(debt,availableDebtBudget);
    if(repay>0){
      if(debtRepaymentSource==='savings')savings-=repay;
      else externalDebtRepayment+=repay;
      debt-=repay;totalDebtRepaid+=repay;
    }
    const debtBudgetShortfall=Math.max(0,requestedDebtRepay-availableDebtBudget);
    const unusedDebtBudget=Math.max(0,availableDebtBudget-repay);
    box3DebtRepaymentShortfall+=debtBudgetShortfall;
    unusedBox3DebtRepayment+=unusedDebtBudget;
    if(unusedDebtBudget>0){
      if(box3DebtFallbackDestination==='savings'){
        if(debtRepaymentSource!=='savings'){savings+=unusedDebtBudget;externalBox3DebtFallback+=unusedDebtBudget;}
        box3DebtFallbackSaved+=unusedDebtBudget;
      }else if(box3DebtFallbackDestination==='consume'){
        if(debtRepaymentSource==='savings')savings-=unusedDebtBudget;
        box3DebtFallbackConsumed+=unusedDebtBudget;
      }else{
        if(debtRepaymentSource==='savings')savings-=unusedDebtBudget;
        else externalBox3DebtFallback+=unusedDebtBudget;
        portfolio+=unusedDebtBudget;box3DebtFallbackInvested+=unusedDebtBudget;
      }
    }
"""
text=replace_once(text,old,new,'investment-flow debt block')
old="""  const netFinancialAssets=portfolio+savings-debt;
  const householdComparableWealth=netFinancialAssets-externalTax-externalDebtRepayment-totalDebtInterest-unsettledTaxEstimate;
  return{portfolio,savings,box3Debt:debt,netFinancialAssets,totalTax,currentTax,futureTax,unsettledTaxEstimate,externalTax,taxPaidFromSavings,taxPaidFromPortfolio,
    comparableWealth:householdComparableWealth,householdComparableWealth,
    externalDebtRepayment,totalDebtRepaid,totalDebtInterest,cashShortfall,lossCarry,yearBuckets,series};
"""
new="""  const netFinancialAssets=portfolio+savings-debt;
  const box3DebtCashConservationDifference=plannedBox3DebtRepayment-totalDebtRepaid-box3DebtFallbackInvested-box3DebtFallbackSaved-box3DebtFallbackConsumed-box3DebtRepaymentShortfall;
  const householdComparableWealth=netFinancialAssets-externalTax-externalDebtRepayment-externalBox3DebtFallback-totalDebtInterest-unsettledTaxEstimate;
  return{portfolio,savings,box3Debt:debt,netFinancialAssets,totalTax,currentTax,futureTax,unsettledTaxEstimate,externalTax,taxPaidFromSavings,taxPaidFromPortfolio,
    comparableWealth:householdComparableWealth,householdComparableWealth,
    externalDebtRepayment,totalDebtRepaid,totalDebtInterest,cashShortfall,lossCarry,yearBuckets,series,
    plannedBox3DebtRepayment,unusedBox3DebtRepayment,box3DebtFallbackInvested,box3DebtFallbackSaved,box3DebtFallbackConsumed,box3DebtRepaymentShortfall,externalBox3DebtFallback,box3DebtCashConservationDifference,box3DebtFallbackDestination};
"""
text=replace_once(text,old,new,'investment-flow return accounting')
text=replace_once(text,
"  const unusedMortgageDestination=['invest','savings','consume'].includes(config.unusedMortgageDestination)?config.unusedMortgageDestination:'invest';\n",
"  const unusedMortgageDestination=['invest','savings','consume'].includes(config.unusedMortgageDestination)?config.unusedMortgageDestination:'invest';\n  const box3DebtFallbackDestination=['invest','savings','consume'].includes(config.box3DebtFallbackDestination)?config.box3DebtFallbackDestination:'invest';\n",
'plan fallback setting')
text=replace_once(text,
"  let totalDebtInterest=0,totalDebtRepaid=0,externalDebtRepayment=0,payoffDate=null;\n",
"  let totalDebtInterest=0,totalDebtRepaid=0,externalDebtRepayment=0,payoffDate=null;\n  let plannedBox3DebtRepayment=0,unusedBox3DebtRepayment=0,box3DebtFallbackInvested=0,box3DebtFallbackSaved=0,box3DebtFallbackConsumed=0,box3DebtRepaymentShortfall=0,externalBox3DebtFallback=0;\n",
'plan debt fallback tracking')
old="""      const debtRepayRequested=nonNegative(config.box3DebtMonthlyRepayment);
      if(debtRepayRequested>0&&box3Debt>0){
        let repay=Math.min(box3Debt,debtRepayRequested);
        if(config.debtRepaymentSource==='savings'){repay=Math.min(repay,savings);savings-=repay;}
        else externalDebtRepayment+=repay;
        box3Debt-=repay;totalDebtRepaid+=repay;
      }
"""
new="""      const debtRepayRequested=nonNegative(config.box3DebtMonthlyRepayment);
      plannedBox3DebtRepayment+=debtRepayRequested;
      const availableDebtBudget=config.debtRepaymentSource==='savings'?Math.min(debtRepayRequested,savings):debtRepayRequested;
      const debtRepaidThisMonth=Math.min(box3Debt,availableDebtBudget);
      if(debtRepaidThisMonth>0){
        if(config.debtRepaymentSource==='savings')savings-=debtRepaidThisMonth;
        else externalDebtRepayment+=debtRepaidThisMonth;
        box3Debt-=debtRepaidThisMonth;totalDebtRepaid+=debtRepaidThisMonth;
      }
      const debtBudgetShortfall=Math.max(0,debtRepayRequested-availableDebtBudget);
      const unusedDebtBudget=Math.max(0,availableDebtBudget-debtRepaidThisMonth);
      box3DebtRepaymentShortfall+=debtBudgetShortfall;
      unusedBox3DebtRepayment+=unusedDebtBudget;
      if(unusedDebtBudget>0){
        if(box3DebtFallbackDestination==='savings'){
          if(config.debtRepaymentSource!=='savings'){savings+=unusedDebtBudget;externalBox3DebtFallback+=unusedDebtBudget;}
          box3DebtFallbackSaved+=unusedDebtBudget;
        }else if(box3DebtFallbackDestination==='consume'){
          if(config.debtRepaymentSource==='savings')savings-=unusedDebtBudget;
          box3DebtFallbackConsumed+=unusedDebtBudget;
        }else{
          if(config.debtRepaymentSource==='savings')savings-=unusedDebtBudget;
          else externalBox3DebtFallback+=unusedDebtBudget;
          portfolio+=unusedDebtBudget;invested+=unusedDebtBudget;b.contrib+=unusedDebtBudget;box3DebtFallbackInvested+=unusedDebtBudget;
        }
      }
"""
text=replace_once(text,old,new,'plan debt block')
old="""  const netFinancialAssets=portfolio+savings-box3Debt;
  const cashConservationDifference=plannedMortgageExtra-extraPaid-fallbackInvested-fallbackSaved-fallbackConsumed;
  return{portfolio,savings,box3Debt,netFinancialAssets,householdComparableWealth:netFinancialAssets-externalTax-externalDebtRepayment-totalDebtInterest-unsettledTaxEstimate,invested,mort,initialMort,grossInterest,mortTax,netInterest:grossInterest-mortTax,extraPaid,plannedMortgageExtra,unusedMortgageCash,fallbackInvested,fallbackSaved,fallbackConsumed,cashConservationDifference,unusedMortgageDestination,scheduledPrincipal,
    grossScheduledTotal:grossInterest+scheduledPrincipal,firstScheduled:schedule.length?schedule[0].gross:0,box3Tax,currentTax,futureTax,unsettledTaxEstimate,externalTax,taxPaidFromSavings,taxPaidFromPortfolio,
    totalDebtInterest,totalDebtRepaid,externalDebtRepayment,lossCarry,payoffDate,schedule,series,yearBuckets,horizonMonths:global,mortType,hraRemainingMonths,qualifyingInterestFraction,homeOwnershipMonths};
"""
new="""  const netFinancialAssets=portfolio+savings-box3Debt;
  const cashConservationDifference=plannedMortgageExtra-extraPaid-fallbackInvested-fallbackSaved-fallbackConsumed;
  const box3DebtCashConservationDifference=plannedBox3DebtRepayment-totalDebtRepaid-box3DebtFallbackInvested-box3DebtFallbackSaved-box3DebtFallbackConsumed-box3DebtRepaymentShortfall;
  return{portfolio,savings,box3Debt,netFinancialAssets,householdComparableWealth:netFinancialAssets-externalTax-externalDebtRepayment-externalBox3DebtFallback-totalDebtInterest-unsettledTaxEstimate,invested,mort,initialMort,grossInterest,mortTax,netInterest:grossInterest-mortTax,extraPaid,plannedMortgageExtra,unusedMortgageCash,fallbackInvested,fallbackSaved,fallbackConsumed,cashConservationDifference,unusedMortgageDestination,scheduledPrincipal,
    grossScheduledTotal:grossInterest+scheduledPrincipal,firstScheduled:schedule.length?schedule[0].gross:0,box3Tax,currentTax,futureTax,unsettledTaxEstimate,externalTax,taxPaidFromSavings,taxPaidFromPortfolio,
    totalDebtInterest,totalDebtRepaid,externalDebtRepayment,lossCarry,payoffDate,schedule,series,yearBuckets,horizonMonths:global,mortType,hraRemainingMonths,qualifyingInterestFraction,homeOwnershipMonths,
    plannedBox3DebtRepayment,unusedBox3DebtRepayment,box3DebtFallbackInvested,box3DebtFallbackSaved,box3DebtFallbackConsumed,box3DebtRepaymentShortfall,externalBox3DebtFallback,box3DebtCashConservationDifference,box3DebtFallbackDestination};
"""
text=replace_once(text,old,new,'plan return accounting')
write(path,text)

# box3-household.js: expose and propagate the destination.
path=Path('box3-household.js')
text=read(path)
text=replace_once(text,"  debtRepaymentSource:'external',\n","  debtRepaymentSource:'external',\n  debtFallbackDestination:'invest',\n",'household default fallback')
text=replace_once(text,
"    debtRepaymentSource:context.debtRepaymentSource==='savings'?'savings':'external',\n",
"    debtRepaymentSource:context.debtRepaymentSource==='savings'?'savings':'external',\n    box3DebtFallbackDestination:['invest','savings','consume'].includes(context.box3DebtFallbackDestination??context.debtFallbackDestination)?(context.box3DebtFallbackDestination??context.debtFallbackDestination):DEFAULTS.debtFallbackDestination,\n",
'household normalize fallback')
text=replace_once(text,
"      debtRepaymentSource:config.debtRepaymentSource??c.debtRepaymentSource,\n",
"      debtRepaymentSource:config.debtRepaymentSource??c.debtRepaymentSource,\n      box3DebtFallbackDestination:config.box3DebtFallbackDestination??c.box3DebtFallbackDestination,\n",
'household merge fallback')
text=replace_once(text,
"    debtRepaymentSource:$('box3DebtRepaymentSource')?.value||'external',\n",
"    debtRepaymentSource:$('box3DebtRepaymentSource')?.value||'external',\n    box3DebtFallbackDestination:$('box3DebtFallbackDestination')?.value||DEFAULTS.debtFallbackDestination,\n",
'household browser fallback')
needle="""      <div class=\"field\"><label for=\"box3DebtRepaymentSource\">Debt repayment comes from</label><select id=\"box3DebtRepaymentSource\"><option value=\"external\" selected>External cash flow</option><option value=\"savings\">Savings / cash balance</option></select><p class=\"inline\">Savings-funded repayment reduces cash and debt together. External repayment is tracked separately.</p></div>
"""
replacement=needle+"""      <div class=\"field\"><label for=\"box3DebtFallbackDestination\">After Box 3 debt payoff, redirect the monthly budget to</label><select id=\"box3DebtFallbackDestination\"><option value=\"invest\" selected>Investments</option><option value=\"savings\">Savings / cash</option><option value=\"consume\">Stop allocating / spending</option></select><p class=\"inline\">Also applies to the unused portion of the final repayment. The repayment budget is never left without a destination.</p></div>
"""
text=replace_once(text,needle,replacement,'household fallback UI')
write(path,text)

# scenario-engine.js: pass the shared destination into FinanceCore.
path=Path('scenario-engine.js')
text=read(path)
text=replace_once(text,
"    debtRepaymentSource:rawBox3.debtRepaymentSource==='savings'?'savings':'external',\n",
"    debtRepaymentSource:rawBox3.debtRepaymentSource==='savings'?'savings':'external',\n    debtFallbackDestination:['invest','savings','consume'].includes(rawBox3.debtFallbackDestination??rawBox3.box3DebtFallbackDestination)?(rawBox3.debtFallbackDestination??rawBox3.box3DebtFallbackDestination):'invest',\n",
'scenario normalize fallback')
text=replace_once(text,
"    debtRepaymentSource:S.box3.debtRepaymentSource,\n",
"    debtRepaymentSource:S.box3.debtRepaymentSource,\n    box3DebtFallbackDestination:S.box3.debtFallbackDestination,\n",
'scenario pass fallback')
write(path,text)

# app-state.js: group the new Advanced control and remove its stale release writer.
path=Path('app-state.js')
text=read(path)
text=replace_once(text,
"  const marker=$('modelVersion');if(marker)marker.textContent='Calculation build R6.2 · user-testing UX round 2 · 2026 rules · updated 1 Sep 2026';\n",
"",
'app-state stale release writer')
text=replace_once(text,
"    const debtFields=['box3Debt','box3DebtInterest','box3DebtMonthlyRepayment','box3DebtRepaymentSource'].map(id=>$(id)?.closest('.field')).filter(Boolean);\n",
"    const debtFields=['box3Debt','box3DebtInterest','box3DebtMonthlyRepayment','box3DebtRepaymentSource','box3DebtFallbackDestination'].map(id=>$(id)?.closest('.field')).filter(Boolean);\n",
'app-state debt group')
write(path,text)

# app.js: remove the obsolete fallback release writer. The public metadata path owns the version.
path=Path('app.js')
text=read(path)
text=replace_once(text,
"  window.addEventListener('load',()=>{const marker=$('modelVersion');if(marker)marker.textContent='Calculation build R6.3 · logic integrity · 2026 rules · updated 1 Sep 2026';});\n",
"",
'app stale release writer')
write(path,text)

# logic-integrity-ui.js: central public metadata becomes R6.4.1.
path=Path('logic-integrity-ui.js')
text=read(path)
text=replace_once(text,"  version:'R6.4',\n","  version:'R6.4.1',\n",'model version')
text=replace_once(text,"  releaseName:'Public Beta Gate'\n","  releaseName:'Output Integrity'\n",'release name')
write(path,text)

# view-density.js: include the new hidden default and visible chip when changed.
path=Path('view-density.js')
text=read(path)
text=replace_once(text,"  box3DebtRepaymentSource:'external',\n","  box3DebtRepaymentSource:'external',\n  box3DebtFallbackDestination:'invest',\n",'density default fallback')
text=replace_once(text,
"  if(number(values.box3Debt)>0&&values.box3DebtRepaymentSource&&values.box3DebtRepaymentSource!==DEFAULTS.box3DebtRepaymentSource)add('box3-debt-source','Box 3 debt repayment uses savings');\n",
"  if(number(values.box3Debt)>0&&values.box3DebtRepaymentSource&&values.box3DebtRepaymentSource!==DEFAULTS.box3DebtRepaymentSource)add('box3-debt-source','Box 3 debt repayment uses savings');\n  if(values.box3DebtFallbackDestination&&values.box3DebtFallbackDestination!==DEFAULTS.box3DebtFallbackDestination)add('box3-debt-fallback',`After Box 3 debt payoff: ${values.box3DebtFallbackDestination}`);\n",
'density fallback chip')
text=replace_once(text,
"    ['box3Debt','box3DebtInterest','box3DebtMonthlyRepayment','box3DebtRepaymentSource'].forEach(id=>markAdvanced(field(id)));\n",
"    ['box3Debt','box3DebtInterest','box3DebtMonthlyRepayment','box3DebtRepaymentSource','box3DebtFallbackDestination'].forEach(id=>markAdvanced(field(id)));\n",
'density hidden field')
text=replace_once(text,
"      box3DebtRepaymentSource:$('box3DebtRepaymentSource')?.value||'external',\n",
"      box3DebtRepaymentSource:$('box3DebtRepaymentSource')?.value||'external',\n      box3DebtFallbackDestination:$('box3DebtFallbackDestination')?.value||'invest',\n",
'density DOM state')
write(path,text)

# index.html: cache-bust every local asset and load the final output-integrity layer last.
path=Path('index.html')
text=read(path)
text=text.replace('<link rel="stylesheet" href="styles.css">','<link rel="stylesheet" href="styles.css?v=R6.4.1">')
text=re.sub(r'<script src="((?!https?://)[^"]+\.js)(?:\?v=[^"]+)?"></script>',lambda m:f'<script src="{m.group(1)}?v=R6.4.1"></script>',text)
text=replace_once(text,
'<script src="view-density-state.js?v=R6.4.1"></script>\n</body></html>',
'<script src="view-density-state.js?v=R6.4.1"></script>\n<script src="output-integrity.js?v=R6.4.1"></script>\n</body></html>',
'output integrity script load')
text=text.replace('Calculation build R6.4 · 2026 rules · updated 2 Sep 2026','Calculation build R6.4.1 · 2026 rules · updated 2 Sep 2026')
write(path,text)

# package.json: expose the deterministic scenario matrix command.
path=Path('package.json')
data=json.loads(read(path))
data.setdefault('scripts',{})['verify:50']='node scripts/verify-50-scenarios.js'
write(path,json.dumps(data,indent=2,ensure_ascii=False)+'\n')

# Runtime-order test: tolerate cache queries and require the output-integrity layer last.
path=Path('tests/runtime-integrity.test.js')
text=read(path)
text=replace_once(text,
"const EXPECTED_LOCAL_SCRIPTS=['finance-core.js','logic-integrity-ui.js','box3-household.js','purchase-rules.js','app.js','purchase-costs.js','scenario-engine.js','next-euro.js','app-state.js','view-density.js','view-density-state.js'];\n",
"const EXPECTED_LOCAL_SCRIPTS=['finance-core.js','logic-integrity-ui.js','box3-household.js','purchase-rules.js','app.js','purchase-costs.js','scenario-engine.js','next-euro.js','app-state.js','view-density.js','view-density-state.js','output-integrity.js'];\n",
'runtime expected modules')
text=replace_once(text,
"  const local=scripts.filter(src=>!/^https?:\\/\\//i.test(src));\n",
"  const local=scripts.filter(src=>!/^https?:\\/\\//i.test(src)).map(src=>src.split('?')[0]);\n",
'runtime query normalization')
text=text.replace('/Calculation build R6\\.4/','/Calculation build R6\\.4\\.1/')
text=text.replace("assert.match(gate,/version:'R6\\.4'/);","assert.match(gate,/version:'R6\\.4\\.1'/);")
text=replace_once(text,
"  assert.ok(html.indexOf('view-density.js')<html.indexOf('view-density-state.js'));\n",
"  assert.ok(html.indexOf('view-density.js')<html.indexOf('view-density-state.js'));\n  assert.ok(html.indexOf('view-density-state.js')<html.indexOf('output-integrity.js'));\n",
'runtime output order')
text += "\n\ntest('R6.4.1 cache-busts every local browser asset',()=>{\n  const html=read('index.html');\n  const local=[...html.matchAll(/<script\\s+src=\"((?!https?:\\/\\/)[^\"]+)\"/g)].map(m=>m[1]);\n  assert.equal(local.length,EXPECTED_LOCAL_SCRIPTS.length);\n  local.forEach(src=>assert.match(src,/\\?v=R6\\.4\\.1$/));\n  assert.match(html,/styles\\.css\\?v=R6\\.4\\.1/);\n});\n"
write(path,text)

# README release marker and bounded release note.
path=Path('README.md')
text=read(path)
text=text.replace('## Current release candidate: R6.4 Public Beta Gate','## Current release: R6.4.1 Output Integrity')
insert="""
### R6.4.1 output integrity

R6.4.1 makes the Box 3 availability status authoritative across the full page. When tax cannot be estimated, retained projections are labeled **before Box 3**, tax-dependent cards and exports are unavailable, the year table is blocked, and no missing amount is rendered as €0. The release also routes the recurring Box 3 debt-repayment budget after payoff to investments, savings or spending and verifies 50 deterministic cross-engine scenarios.

"""
marker='## One engine, two densities\n'
if insert.strip() not in text:
    text=text.replace(marker,insert+marker,1)
text=text.replace('**R6.4 Public Beta Gate and view density: release candidate**','**R6.4 Public Beta Gate and view density: complete**\n- **R6.4.1 Output integrity and 50-scenario reconciliation: complete**')
write(path,text)

print('R6.4.1 source patch applied successfully.')
