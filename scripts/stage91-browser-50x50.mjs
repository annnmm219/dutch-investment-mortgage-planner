import http from 'node:http';
import path from 'node:path';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json'};
const MODES=['buy-rent','downpayment','mortgage-invest','linear-annuity','sell-rent'];
const VIEWPORTS=[
  {name:'desktop',options:{viewport:{width:1440,height:1000}}},
  {name:'mobile',options:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}}
];

const server=http.createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
    const relative=pathname==='/'?'index.html':pathname.replace(/^\/+/, '');
    const file=path.resolve(ROOT,relative);
    if(!file.startsWith(ROOT+path.sep))throw new Error('Invalid path');
    const info=await stat(file);if(!info.isFile())throw new Error('Not a file');
    res.writeHead(200,{'content-type':TYPES[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});
    res.end(await readFile(file));
  }catch{res.writeHead(404);res.end('Not found');}
});

function dataset(mode,index){
  const purchasePrice=index===9?480000:300000+index*12000;
  const nonMain=(mode==='buy-rent'||mode==='downpayment')&&index===8;
  const energy=(mode==='buy-rent'||mode==='downpayment')&&index===9;
  const years=[20,25,30][index%3];
  return{
    id:`${mode}-${index+1}`,mode,index,
    startMonth:1,startYear:2026,horizon:3+(index%3),returnPct:2.5+index*.55,
    portfolio:25000+index*6500,commonMonthly:200+index*50,savings:220000+index*5000,
    debt:index%4===0?8000+index*500:0,taxPartners:index%3===0?2:1,
    paySource:['savings','portfolio','external'][index%3],fallback:['invest','savings','consume'][index%3],
    savingsReturn:1.5+(index%4)*.25,debtInterest:3.2+(index%3)*.35,
    debtRepayment:index%4===0?250+index*20:0,debtRepaymentSource:index%2?'savings':'external',
    mortgage:{balance:180000+index*15000,rate:2.6+index*.18,years,type:index%2?'linear':'annuity'},
    income:62000+index*4500,woz:340000+index*12000,hraYears:Math.min(years,18+(index%4)*3),qualifyingPct:70+(index%4)*10,
    ownerTotal:325+index*20,ownerGrowth:1.5+(index%4)*.25,homeGrowth:1.5+(index%5)*.3,rentGrowth:1.8+(index%4)*.35,sellingCost:1.5+(index%3)*.25,
    transferMode:nonMain?'other-home':'main',appraisal:purchasePrice,nhgMode:energy?'energy':'none',energySpend:energy?20000:0,
    purchaseHraYears:nonMain?0:Math.min(30,20+(index%3)*5),purchaseQualifyingPct:nonMain?0:75+(index%3)*10,
    buy:{price:purchasePrice,costs:6500+index*100,down:energy?90000:65000+index*2500,rent:1250+index*55,rate:3.1+index*.12,years,type:index%2?'linear':'annuity'},
    downpayment:{price:purchasePrice,costs:6500+index*100,downA:energy?115000:90000+index*2500,downB:energy?85000:55000+index*1800,rate:3.1+index*.12,years,type:index%2?'linear':'annuity'},
    extraMonthly:250+index*40,sell:{homeValue:420000+index*16000,rent:1350+index*60}
  };
}

async function prepareControl(page,id){
  await page.waitForFunction(fieldId=>Boolean(document.getElementById(fieldId)),id);
  await page.evaluate(fieldId=>{
    const el=document.getElementById(fieldId);if(!el)return;
    const panel=el.closest('.panel');
    if(panel&&!panel.classList.contains('active'))document.querySelector(`.tab[data-tab="${panel.id.replace(/^tab-/,'')}"]`)?.click();
    let node=el.parentElement;
    while(node){if(node.tagName==='DETAILS')node.open=true;node=node.parentElement;}
  },id);
}
async function setControl(page,id,value){
  await prepareControl(page,id);
  const loc=page.locator(`#${id}`),tag=await loc.evaluate(el=>el.tagName.toLowerCase()),type=await loc.getAttribute('type');
  if(type==='checkbox'||type==='radio'){if(Boolean(value))await loc.check();else await loc.uncheck();}
  else if(tag==='select')await loc.selectOption(String(value));
  else await loc.fill(String(value));
}
async function setPhase(page,field,value){
  await page.locator('.tab[data-tab="investment"]').click();
  const loc=page.locator(`#phaseList [data-i="0"][data-field="${field}"]`);await loc.waitFor({state:'visible'});
  if((await loc.evaluate(el=>el.tagName.toLowerCase()))==='select')await loc.selectOption(String(value));else await loc.fill(String(value));
}
async function settle(page){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}

async function enterPlanner(page,d){
  await setControl(page,'phaseCount',1);await settle(page);
  await setControl(page,'startMonth',d.startMonth);await setControl(page,'startYear',d.startYear);await setControl(page,'startPortfolio',d.portfolio);await setControl(page,'annualReturn',d.returnPct);
  await setPhase(page,'years',d.horizon);await setPhase(page,'monthlyInvest',d.commonMonthly);await setPhase(page,'mortgageExtra',0);await setPhase(page,'annualBonus',0);
  await setControl(page,'box3Mode','current');await setControl(page,'taxPartners',d.taxPartners);await setControl(page,'box3PaySource',d.paySource);
  await setControl(page,'box3Savings',d.savings);await setControl(page,'box3Debt',d.debt);await setControl(page,'box3SavingsReturn',d.savingsReturn);await setControl(page,'box3DebtInterest',d.debtInterest);await setControl(page,'box3DebtMonthlyRepayment',d.debtRepayment);await setControl(page,'box3DebtRepaymentSource',d.debtRepaymentSource);await setControl(page,'box3DebtFallbackDestination',d.fallback);
  await setControl(page,'firstJan1Portfolio',d.portfolio);await setControl(page,'firstJan1Savings',d.savings);await setControl(page,'firstJan1Debt',d.debt);
  await setControl(page,'mortgageMode','existing');await setControl(page,'mortBalance',d.mortgage.balance);await setControl(page,'mortRate',d.mortgage.rate);await setControl(page,'mortYears',d.mortgage.years);
  await page.locator(d.mortgage.type==='linear'?'#linearCompare':'#annuityCompare').click();
  if(await page.locator('#grossAnnualIncome').count())await setControl(page,'grossAnnualIncome',d.income);else await setControl(page,'grossIncome',d.income);
  await setControl(page,'wozValue',d.woz);await setControl(page,'deductionMode','auto');await setControl(page,'mortTaxEnabled',true);await setControl(page,'hraRemainingYears',d.hraYears);await setControl(page,'hraRemainingMonths',0);await setControl(page,'qualifyingBox1DebtPct',d.qualifyingPct);
  await settle(page);
}

async function enterScenarioOwned(page,d){
  await setControl(page,'comparisonType',d.mode);await setControl(page,'scenarioHorizonNew',d.horizon);await setControl(page,'scenarioReturnNew',d.returnPct);
  await setControl(page,'scenarioOwnerItemizedNew',false);await setControl(page,'scenarioOwnerTotalNew',d.ownerTotal);await setControl(page,'scenarioOwnerCostGrowthNew',d.ownerGrowth);await setControl(page,'scenarioHomeGrowthNew',d.homeGrowth);await setControl(page,'scenarioRentGrowthNew',d.rentGrowth);await setControl(page,'scenarioSellingCostNew',d.sellingCost);
  if(await page.locator('#scenarioUpfrontCashTreatmentNew').count())await setControl(page,'scenarioUpfrontCashTreatmentNew','invest');
  if(d.mode==='buy-rent'){
    await setControl(page,'scenarioBuyPriceNew',d.buy.price);await setControl(page,'scenarioBuyCostsNew',d.buy.costs);await setControl(page,'scenarioDownPaymentNew',d.buy.down);await setControl(page,'scenarioRentNew',d.buy.rent);await setControl(page,'scenarioBuyRateNew',d.buy.rate);await setControl(page,'scenarioBuyYearsNew',d.buy.years);await setControl(page,'scenarioBuyMortgageTypeNew',d.buy.type);
  }else if(d.mode==='downpayment'){
    await setControl(page,'scenarioDpPriceNew',d.downpayment.price);await setControl(page,'scenarioDpCostsNew',d.downpayment.costs);await setControl(page,'scenarioDownANew',d.downpayment.downA);await setControl(page,'scenarioDownBNew',d.downpayment.downB);await setControl(page,'scenarioDpRateNew',d.downpayment.rate);await setControl(page,'scenarioDpYearsNew',d.downpayment.years);await setControl(page,'scenarioDpMortgageTypeNew',d.downpayment.type);
  }else if(d.mode==='mortgage-invest')await setControl(page,'scenarioExtraMonthlyNew',d.extraMonthly);
  else if(d.mode==='sell-rent'){await setControl(page,'scenarioHomeValueNew',d.sell.homeValue);await setControl(page,'scenarioSellRentNew',d.sell.rent);}
  if(d.mode==='buy-rent'||d.mode==='downpayment'){
    await setControl(page,'scenarioPurchaseAppraisedValueNew',d.appraisal);await setControl(page,'scenarioTransferTaxModeNew',d.transferMode);await setControl(page,'scenarioPurchaseNhgModeNew',d.nhgMode);await setControl(page,'scenarioQualifyingEnergySpendNew',d.energySpend);await setControl(page,'scenarioPurchaseQualifyingDebtPctNew',d.purchaseQualifyingPct);await setControl(page,'scenarioPurchaseHraYearsNew',d.purchaseHraYears);
  }
  await settle(page);
}

async function enterFreshCommon(page,d){
  await setControl(page,'scenarioStartMonthFresh',d.startMonth);await setControl(page,'scenarioStartYearFresh',d.startYear);await setControl(page,'scenarioStartPortfolioFresh',d.portfolio);await setControl(page,'scenarioStartSavingsFresh',d.savings);await setControl(page,'scenarioStartDebtFresh',d.debt);await setControl(page,'scenarioCommonMonthlyInvestmentFresh',d.commonMonthly);await setControl(page,'scenarioDebtFallbackFresh',d.fallback);
  await setControl(page,'scenarioBox3ModeFresh','current');await setControl(page,'scenarioTaxPartnersFresh',d.taxPartners);await setControl(page,'scenarioBox3PaySourceFresh',d.paySource);await setControl(page,'scenarioSavingsReturnFresh',d.savingsReturn);await setControl(page,'scenarioDebtInterestFresh',d.debtInterest);await setControl(page,'scenarioDebtRepaymentFresh',d.debtRepayment);await setControl(page,'scenarioDebtRepaymentSourceFresh',d.debtRepaymentSource);
  await setControl(page,'scenarioFirstJan1PortfolioFresh',d.portfolio);await setControl(page,'scenarioFirstJan1SavingsFresh',d.savings);await setControl(page,'scenarioFirstJan1DebtFresh',d.debt);
  await setControl(page,'scenarioMortgageBalanceFresh',d.mortgage.balance);await setControl(page,'scenarioMortgageRateFresh',d.mortgage.rate);await setControl(page,'scenarioMortgageYearsFresh',d.mortgage.years);await setControl(page,'scenarioMortgageMethodFresh',d.mortgage.type);
  await setControl(page,'scenarioTaxTreatmentFresh','auto');await setControl(page,'scenarioIncomeFresh',d.income);await setControl(page,'scenarioWozFresh',d.woz);await setControl(page,'scenarioHraYearsFresh',d.hraYears);await setControl(page,'scenarioQualifyingDebtFresh',d.qualifyingPct);
  await settle(page);
}

async function snapshot(page){
  return page.evaluate(()=>{
    const clean=value=>JSON.parse(JSON.stringify(value));
    const config=clean(window.__DIMP_ACTIVE_SCENARIO_CONFIG||{});delete config.inputSource;
    const canonical=clean(window.__DIMP_CANONICAL_COMPARISON||{});
    const rerun=window.ScenarioCore.runScenario(clean(window.__DIMP_ACTIVE_SCENARIO_CONFIG||{}));
    const ledgers=clean(rerun.stage91Ledgers||[]);
    const values={};
    document.querySelectorAll('#tab-scenarios input,#tab-scenarios select').forEach(el=>{
      if(!el.id||el.name==='scenarioDataSource'||el.disabled||el.closest('.hidden'))return;
      values[el.id]=(el.type==='checkbox'||el.type==='radio')?Boolean(el.checked):String(el.value??'');
    });
    const provenance={};document.querySelectorAll('.scenario-source-tag[data-source-for]').forEach(el=>{if(!el.closest('.hidden'))provenance[el.dataset.sourceFor]=String(el.textContent||'').trim();});
    const stored=JSON.parse(localStorage.getItem(window.Stage91Remediation.SNAPSHOT_KEY)||'null');
    return{config,canonical,ledgers,values,provenance,stored};
  });
}

function assertProvenance(snap,route,id){
  const labels=Object.values(snap.provenance).filter(Boolean);
  if(route==='imported')assert.ok(labels.some(x=>/Imported snapshot|Planner phases vary/i.test(x)),`${id}: imported provenance missing`);
  else assert.ok(labels.some(x=>/Entered here|Calculator assumption/i.test(x)),`${id}: fresh provenance missing`);
}
function assertInputParity(imported,fresh,id){
  const commonIds=['scenarioStartMonthFresh','scenarioStartYearFresh','scenarioStartPortfolioFresh','scenarioStartSavingsFresh','scenarioStartDebtFresh','scenarioCommonMonthlyInvestmentFresh','scenarioDebtFallbackFresh','scenarioBox3ModeFresh','scenarioTaxPartnersFresh','scenarioBox3PaySourceFresh','scenarioSavingsReturnFresh','scenarioDebtInterestFresh','scenarioDebtRepaymentFresh','scenarioDebtRepaymentSourceFresh','scenarioFirstJan1PortfolioFresh','scenarioFirstJan1SavingsFresh','scenarioFirstJan1DebtFresh','scenarioMortgageBalanceFresh','scenarioMortgageRateFresh','scenarioMortgageYearsFresh','scenarioMortgageMethodFresh','scenarioTaxTreatmentFresh','scenarioIncomeFresh','scenarioWozFresh','scenarioHraYearsFresh','scenarioQualifyingDebtFresh'];
  for(const field of commonIds)assert.equal(fresh.values[field],imported.values[field],`${id}: input ${field} differs`);
}

async function runCase(page,d,viewportName){
  const label=`${viewportName}/${d.id}`;
  await page.evaluate(()=>localStorage.clear());await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.Stage91Remediation&&document.getElementById('scenarioCommonMonthlyInvestmentFresh'));
  await enterPlanner(page,d);

  await page.locator('.tab[data-tab="scenarios"]').click();await setControl(page,'comparisonType',d.mode);await page.locator('#scenarioSourceImported').check();await settle(page);await enterScenarioOwned(page,d);await settle(page);
  const imported=await snapshot(page);
  assert.equal(imported.canonical.valid,true,`${label}: imported invalid: ${imported.canonical.reason||''}`);
  assert.equal(imported.config.commonMonthlyInvestment,d.commonMonthly,`${label}: common monthly import failed`);
  assert.equal(imported.config.box3.debtFallbackDestination,d.fallback,`${label}: fallback import failed`);
  assertProvenance(imported,'imported',label);assert.ok(imported.stored?.canonical,`${label}: stored canonical missing`);

  const saved=JSON.parse(JSON.stringify(imported));await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.Stage91Remediation&&window.__DIMP_CANONICAL_COMPARISON?.valid===true);await settle(page);
  const reloaded=await snapshot(page);
  assert.deepEqual(reloaded.config,saved.config,`${label}: config changed on reload`);assert.deepEqual(reloaded.canonical,saved.canonical,`${label}: result changed on reload`);assert.deepEqual(reloaded.provenance,saved.provenance,`${label}: provenance changed on reload`);

  const frozen=await page.locator('#scenarioStartPortfolioFresh').inputValue();await setControl(page,'startPortfolio',d.portfolio+9999);await page.locator('.tab[data-tab="scenarios"]').click();assert.equal(await page.locator('#scenarioStartPortfolioFresh').inputValue(),frozen,`${label}: snapshot mutated without Refresh`);
  await page.locator('#scenarioRefreshImport').click();await settle(page);assert.equal(await page.locator('#scenarioStartPortfolioFresh').inputValue(),String(d.portfolio+9999),`${label}: explicit Refresh failed`);
  await setControl(page,'startPortfolio',d.portfolio);await page.locator('.tab[data-tab="scenarios"]').click();await page.locator('#scenarioRefreshImport').click();await settle(page);await enterScenarioOwned(page,d);const importedBaseline=await snapshot(page);

  await page.locator('#scenarioSourceFresh').check();await settle(page);assert.equal(await page.locator('#scenarioStartPortfolioFresh').inputValue(),'',`${label}: Fresh retained imported portfolio`);
  await enterFreshCommon(page,d);await enterScenarioOwned(page,d);await settle(page);const fresh=await snapshot(page);
  assert.equal(fresh.canonical.valid,true,`${label}: fresh invalid: ${fresh.canonical.reason||''}`);assertProvenance(fresh,'fresh',label);
  assert.deepEqual(fresh.config,importedBaseline.config,`${label}: active config differs`);assert.deepEqual(fresh.canonical,importedBaseline.canonical,`${label}: canonical differs`);assert.deepEqual(fresh.ledgers,importedBaseline.ledgers,`${label}: ledgers differ`);assertInputParity(importedBaseline,fresh,label);

  await setControl(page,'startPortfolio',d.portfolio+54321);await settle(page);const afterHidden=await snapshot(page);
  assert.deepEqual(afterHidden.config,fresh.config,`${label}: Fresh read planner value`);assert.deepEqual(afterHidden.canonical,fresh.canonical,`${label}: Fresh result changed after planner edit`);
  return{viewport:viewportName,id:d.id,mode:d.mode,match:true,reload:true,refresh:true,freshIsolated:true};
}

await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=`http://127.0.0.1:${server.address().port}/`,browser=await chromium.launch({headless:true}),results=[],errors=[];
try{
  for(const vp of VIEWPORTS){
    const context=await browser.newContext(vp.options),page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(`${vp.name}: ${String(error?.stack||error)}`));await page.route(/^https:\/\//,route=>route.abort());await page.goto(url,{waitUntil:'domcontentloaded'});
    for(const mode of MODES)for(let index=0;index<10;index++)results.push(await runCase(page,dataset(mode,index),vp.name));
    await context.close();
  }
  assert.equal(errors.length,0,`Browser page errors:\n${errors.join('\n\n')}`);
  const desktop=results.filter(x=>x.viewport==='desktop'),mobile=results.filter(x=>x.viewport==='mobile');assert.equal(desktop.length,50);assert.equal(mobile.length,50);assert.equal(results.filter(x=>x.match).length,100);
  console.log(JSON.stringify({stage:'R6.6 Stage 9.1 genuine browser parity',datasets:50,modes:Object.fromEntries(MODES.map(mode=>[mode,desktop.filter(x=>x.mode===mode).length])),desktopExactMatches:50,mobileExactMatches:50,totalRoutePairs:100,browserErrors:0,saveReload:true,explicitRefresh:true,freshIsolation:true},null,2));
  console.log('Stage 9.1: 50 imported and 50 fresh datasets match exactly on desktop and mobile.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
