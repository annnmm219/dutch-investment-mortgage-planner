'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const UI=require('../view-density.js');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');

function safeDefaults(){
  return{
    phaseCount:3,
    bonusMonth:12,
    box3Mode:'current',box3PaySource:'savings',box3Debt:0,box3DebtInterest:2.70,box3DebtMonthlyRepayment:0,box3DebtRepaymentSource:'external',box3DebtFallbackDestination:'invest',
    currentTaxRate:36,currentAllowance:59357,currentNotional:6,currentSavingsNotional:1.28,currentDebtNotional:2.70,currentDebtThreshold:3800,
    futureStart:2028,futureTaxRate:36,futureExempt:1800,futureLossThreshold:500,jan1Assumption:false,jan1SnapshotEntered:false,
    deductionMode:'auto',hraRemainingMonths:300,defaultHraMonths:300,qualifyingShare:100,hillenOverrideEnabled:false,hillenOverridePct:71.867,unusedMortgageDestination:'invest',mortgageReportHorizon:'investment',
    transferTaxMode:'main',appraisedValue:350000,housePrice:350000,nhgMode:'none',upfrontCashTreatment:'invest',scenarioMortgageMethod:'selected',scenarioMode:'buy-rent',scenarioWoz:null,scenarioReturnOverrideEnabled:false,
    sensitivityLow:2,sensitivityHigh:10,sensitivityStep:2,vveMonthly:250,maintenanceAnnual:1500,ownerTaxesAnnual:0,insuranceAnnual:0,groundLeaseAnnual:0
  };
}

test('R6.5 uses one interface rather than a global Standard and Advanced mode',()=>{
  assert.equal(UI.DEFAULT_VIEW,'single');
  assert.equal(UI.normalizeView(), 'single');
  assert.equal(UI.normalizeView('standard'), 'single');
  assert.equal(UI.normalizeView('advanced'), 'single');
  assert.equal(UI.STANDARD_PHASE_LIMIT,6);
  assert.equal(UI.ADVANCED_SCENARIOS.size,0);

  const source=read('view-density.js');
  assert.doesNotMatch(source,/function ensureSwitch\(/);
  assert.doesNotMatch(source,/role=\\?"radiogroup/);
  assert.doesNotMatch(source,/Advanced settings are affecting this plan/);
  assert.match(source,/#viewDensityBar,#advancedStateSummary\{display:none!important\}/);
});

test('all phases and all decision types remain available in the single interface',()=>{
  const items=UI.collectAdvancedState({...safeDefaults(),phaseCount:6,scenarioMode:'sell-rent'});
  assert.deepEqual(items,[],'phase count and decision type are ordinary choices, not hidden advanced state');
  const source=read('view-density.js');
  assert.match(source,/STANDARD_PHASE_LIMIT=6/);
  assert.match(source,/ADVANCED_SCENARIOS=new Set\(\)/);
  assert.match(source,/option\.hidden=false/);
  assert.match(source,/density-advanced-phase/);
});

test('one investment return drives scenarios unless a local override is enabled',()=>{
  assert.equal(UI.resolveScenarioReturn(7,4,false),7);
  assert.equal(UI.resolveScenarioReturn(7,4,true),4);
  assert.equal(UI.resolveScenarioReturn('7,5','4,25',false),7.5);
  assert.equal(UI.resolveScenarioReturn('7,5','4,25',true),4.25);
  const source=read('view-density.js');
  assert.match(source,/scenarioReturnOverrideEnabled/);
  assert.match(source,/from Investment/);
  assert.match(source,/Use a different return/);
});

test('safe defaults create no local customized badges',()=>{
  assert.deepEqual(UI.collectAdvancedState(safeDefaults()),[]);
});

test('non-default assumptions are attributed to their local folds',()=>{
  const items=UI.collectAdvancedState({...safeDefaults(),
    box3Mode:'future',box3PaySource:'portfolio',box3Debt:20000,
    deductionMode:'manual',hraRemainingMonths:96,qualifyingShare:80,
    scenarioMortgageMethod:'linear',scenarioReturnOverrideEnabled:true,
    vveMonthly:300,maintenanceAnnual:2400
  });
  const keyed=Object.fromEntries(items.map(item=>[item.key,item.group]));
  assert.equal(keyed['box3-mode'],'box3');
  assert.equal(keyed['box3-source'],'box3');
  assert.equal(keyed['box3-debt'],'box3');
  assert.equal(keyed['deduction-mode'],'mortgage');
  assert.equal(keyed['hra-remaining'],'mortgage');
  assert.equal(keyed['qualifying-share'],'mortgage');
  assert.equal(keyed['scenario-mortgage-method'],'scenario');
  assert.equal(keyed['scenario-return'],'scenario');
  assert.equal(keyed['owner-costs'],'scenario');
});

test('local advanced and methodology folds replace the global density banner',()=>{
  const source=read('view-density.js');
  [
    'Bonus timing',
    'Advanced Box 3 assumptions',
    'How Box 3 is modeled',
    'Advanced mortgage and tax assumptions',
    'How the mortgage tax estimate works',
    'Advanced scenario assumptions',
    'How this comparison works',
    'Assumption log and CSV export'
  ].forEach(text=>assert.match(source,new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))));
  assert.match(source,/\$\{count\} customized/);
});

test('browser save is compact and clearly distinguishes restored data from examples',()=>{
  const source=read('view-density.js');
  assert.match(source,/Start fresh/);
  assert.match(source,/Previous plan restored/);
  assert.match(source,/Saved in this browser/);
  assert.match(source,/Example values/);
  assert.match(source,/r65-save-compact/);
});

test('successful affordability is compact while warnings remain available',()=>{
  const source=read('view-density.js');
  assert.match(source,/Within entered monthly budget/);
  assert.match(source,/scenarioBudgetStatusNew/);
  assert.match(source,/classList\.contains\('warn'\)/);
  assert.match(source,/How this comparison works/);
});

test('combined owner cost remains exactly equal to its detailed split',()=>{
  assert.equal(UI.monthlyOwnerCost({vveMonthly:250,maintenanceAnnual:1500,ownerTaxesAnnual:600,insuranceAnnual:240,groundLeaseAnnual:1200}),545);
  const source=read('view-density.js');
  assert.match(source,/r65-owner-total input/);
  assert.match(source,/scenarioVveNew/);
  assert.match(source,/scenarioMaintenanceNew/);
});

test('Hillen, scenario WOZ and audit export remain available without a second engine',()=>{
  const source=read('view-density.js');
  assert.match(source,/hillenOverrideEnabled/);
  assert.match(source,/scenarioBuyWozNew/);
  assert.match(source,/exportAssumptionCsv/);
  assert.match(source,/__viewDensityHillenDecorated/);
  assert.match(source,/__viewDensityWozDecorated/);
});

test('scenario-specific WOZ is added only to the selected scenario branch',()=>{
  const base={mode:'buy-rent',buyRent:{purchaseCosts:0,mortgageType:'annuity',price:350000},downpayment:{purchaseCosts:0,mortgageType:'annuity',price:300000},sellRent:{homeValue:400000}};
  const buy=UI.applyScenarioWoz(base,{buyRentWoz:330000,downpaymentWoz:290000,sellRentWoz:390000});
  assert.equal(buy.buyRent.wozValue,330000);
  assert.equal(buy.downpayment.wozValue,undefined);
  assert.equal(buy.sellRent.wozValue,undefined);
  assert.equal(base.buyRent.wozValue,undefined,'source config must not be mutated');
});

test('CSV export quotes commas, quotes and line breaks safely',()=>{
  const csv=UI.assumptionsToCsv([{section:'Mortgage',label:'Rate, manual',value:'He said "4,00%"\nconfirmed'}]);
  assert.match(csv,/Section,Assumption,Value/);
  assert.match(csv,/"Rate, manual"/);
  assert.match(csv,/"He said ""4,00%""\nconfirmed"/);
});
