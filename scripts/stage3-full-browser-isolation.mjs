
import http from 'node:http';
import path from 'node:path';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
const server=http.createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname),relative=pathname==='/'?'index.html':pathname.replace(/^\/+/,''),file=path.resolve(ROOT,relative);if(!file.startsWith(ROOT+path.sep))throw new Error('bad path');const info=await stat(file);if(!info.isFile())throw new Error('not file');res.writeHead(200,{'content-type':TYPES[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});res.end(await readFile(file));}catch{res.writeHead(404);res.end('Not found');}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const {port}=server.address(),browser=await chromium.launch({headless:true}),context=await browser.newContext();
await context.addInitScript(()=>{const charts=new Map();class ChartStub{constructor(ctx,config={}){this.data=config.data||{datasets:[]};const canvas=ctx?.canvas||ctx;if(canvas)charts.set(canvas,this);}update(){}destroy(){}static getChart(target){return charts.get(target)||null;}}window.Chart=ChartStub;if(window.HTMLCanvasElement)window.HTMLCanvasElement.prototype.getContext=function(){return{canvas:this};};});
const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(String(error?.stack||error)));await page.route(/^https:\/\//,route=>route.abort());page.setDefaultTimeout(15000);
const set=async(id,value)=>page.evaluate(({id,value})=>{const el=document.getElementById(id);if(!el)throw new Error(`Missing ${id}`);if(el.type==='checkbox')el.checked=Boolean(value);else el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},{id,value});
const snapshot=()=>page.evaluate(()=>({verdict:document.getElementById('scenarioVerdictNew')?.textContent||'',a:document.getElementById('strategyAResultNew')?.textContent||'',b:document.getElementById('strategyBResultNew')?.textContent||'',funding:document.getElementById('scenarioFundingDetailsNew')?.textContent||'',rule:document.getElementById('scenarioPurchaseRuleStatusNew')?.textContent||''}));
try{
  await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.getElementById('scenarioPurchaseRulesNew')&&document.getElementById('scenarioBuyCostsNew'));
  await page.locator('.tab[data-tab="scenarios"]').click();
  await set('box3Mode','none');await set('box3Savings',180000);await set('comparisonType','buy-rent');await set('scenarioBuyPriceNew',600000);await set('scenarioDownPaymentNew',60000);await set('scenarioRentNew',2200);await set('scenarioBuyCostsNew',8000);await set('scenarioPurchaseAppraisedValueNew',600000);await set('scenarioTransferTaxModeNew','main');await set('scenarioPurchaseNhgModeNew','none');await set('scenarioBuyMortgageTypeNew','annuity');await new Promise(resolve=>setTimeout(resolve,500));
  const before=await snapshot();
  if(!before.rule.includes('€12.000')||!before.rule.includes('€20.000'))throw new Error(`Local purchase calculation missing: ${before.rule}`);
  if(!before.funding.includes('€600.000')||!before.funding.includes('€540.000')||!before.funding.includes('€80.000'))throw new Error(`Funding identity missing: ${before.funding}`);
  for(const [id,value] of [['housePrice',800000],['ownSavings',300000],['purchaseCosts',999999],['purchaseTransferTaxMode','starter'],['purchaseNhgMode','energy'],['mortBalance',999999],['mortRate',19],['mortYears',40],['wozValue',100000],['manualDeduction',1],['deductionMode','manual'],['grossIncome',0]])await set(id,value);
  await new Promise(resolve=>setTimeout(resolve,600));
  const after=await snapshot();
  for(const key of ['verdict','a','b','funding','rule'])if(after[key]!==before[key])throw new Error(`Mortgage-tab mutation changed ${key}\nBEFORE: ${before[key]}\nAFTER: ${after[key]}`);
  await set('comparisonType','downpayment');await set('scenarioDpPriceNew',470000);await set('scenarioDownANew',70000);await set('scenarioDownBNew',30000);await set('scenarioDpCostsNew',5000);await set('scenarioPurchaseAppraisedValueNew',470000);await set('scenarioPurchaseNhgModeNew','standard');await new Promise(resolve=>setTimeout(resolve,500));
  const down=await snapshot();if(!down.funding.includes('Larger down payment')||!down.funding.includes('Smaller down payment'))throw new Error(`Down-payment identities missing: ${down.funding}`);
  if(errors.length)throw new Error(errors.join('\n\n'));
  console.log(JSON.stringify({stage:'R6.6 Stage 3',browserPurchaseIsolation:true,before,after,down,pageErrors:0},null,2));
  console.log('R6.6 Stage 3 full purchase-rule browser isolation passed.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
