import http from 'node:http';
import path from 'node:path';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};
const STORAGE_KEY='dutch-investment-mortgage-planner:r6';

const server=http.createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
    const relative=pathname==='/'?'index.html':pathname.replace(/^\/+/, '');
    const file=path.resolve(ROOT,relative);
    if(!file.startsWith(ROOT+path.sep))throw new Error('Invalid path');
    const info=await stat(file);if(!info.isFile())throw new Error('Not a file');
    res.writeHead(200,{'content-type':TYPES[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});
    res.end(await readFile(file));
  }catch(_error){res.writeHead(404,{'content-type':'text/plain; charset=utf-8'});res.end('Not found');}
});

await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const {port}=server.address(),browser=await chromium.launch({headless:true}),context=await browser.newContext();
await context.addInitScript(()=>{
  class ChartStub{constructor(context,config={}){this.data=config.data||{datasets:[]};this.options=config.options||{};ChartStub.instance=this;}update(){}static getChart(){return ChartStub.instance;}}
  window.Chart=ChartStub;
  if(window.HTMLCanvasElement)window.HTMLCanvasElement.prototype.getContext=function(){return{canvas:this};};
});
const page=await context.newPage(),pageErrors=[];
page.on('pageerror',error=>pageErrors.push(String(error?.stack||error)));
await page.route(/^https:\/\//,route=>route.abort());
page.setDefaultTimeout(15000);

async function fillAndInput(selector,value){const field=page.locator(selector);await field.fill(value);await field.dispatchEvent('input');}
async function waitMain(status){await page.waitForFunction(expected=>window.__DIMP_CANONICAL_RESULT?.status===expected,status);}

try{
  await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__DIMP_CANONICAL_RESULT?.kind==='dimp.canonical-plan-result.v1'&&document.getElementById('decisionEngine'));

  await fillAndInput('#annualReturn','');
  await waitMain('invalid-input');
  const blank=await page.evaluate(()=>({available:window.__DIMP_CANONICAL_RESULT.available,value:document.getElementById('sPortfolio').textContent,scenarioCard:document.querySelector('#scenarioCards .val')?.textContent,invalid:document.getElementById('annualReturn').getAttribute('aria-invalid'),validation:document.getElementById('validation').textContent}));
  if(blank.available!==false||blank.value!=='Unavailable'||blank.scenarioCard!=='Unavailable'||blank.invalid!=='true'||!/required/i.test(blank.validation))throw new Error(`blank required input was not blocked: ${JSON.stringify(blank)}`);

  await fillAndInput('#annualReturn','0');
  await page.waitForFunction(()=>window.__DIMP_CANONICAL_RESULT?.available===true);
  if(await page.locator('#annualReturn').getAttribute('aria-invalid'))throw new Error('explicit zero remained invalid');

  await fillAndInput('#annualReturn','31');
  await waitMain('invalid-input');
  if(!/no more than 30/i.test(await page.locator('#validation').textContent()))throw new Error('out-of-range value was not explained');
  await fillAndInput('#annualReturn','5');
  await page.waitForFunction(()=>window.__DIMP_CANONICAL_RESULT?.available===true);

  await page.locator('.tab[data-tab="scenarios"]').click();
  await page.locator('#scenarioSourceFresh').check();
  await page.evaluate(()=>{
    const values={scenarioStartPortfolioFresh:'50000',scenarioStartSavingsFresh:'100000',scenarioStartDebtFresh:'0',scenarioIncomeFresh:'60000',scenarioWozFresh:'350000',scenarioOwnerTotalNew:'350',scenarioBuyPriceNew:'350000',scenarioBuyCostsNew:'8000',scenarioDownPaymentNew:'35000',scenarioRentNew:'1600',scenarioBuyRateNew:'4',scenarioBuyYearsNew:'30',scenarioCommonMonthlyInvestmentFresh:'0',scenarioDebtFallbackFresh:'invest',scenarioPurchaseQualifyingDebtPctNew:'100',scenarioPurchaseHraYearsNew:'30'};
    for(const [id,value] of Object.entries(values)){const el=document.getElementById(id);el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}
  });
  await fillAndInput('#scenarioBuyPriceNew','');
  await page.waitForFunction(()=>window.__DIMP_CANONICAL_COMPARISON?.status==='invalid-input');
  if(!/required/i.test(await page.locator('#scenarioVerdictNew').textContent()))throw new Error('scenario invalid-input reason was not rendered');
  await fillAndInput('#scenarioBuyPriceNew','350000');
  await page.waitForFunction(()=>window.__DIMP_CANONICAL_COMPARISON?.valid===true);

  await page.selectOption('#comparisonType','mortgage-invest');
  await fillAndInput('#nextEuroAmount','');
  await page.waitForFunction(()=>window.__DIMP_CANONICAL_NEXT_EURO?.valid===false);
  if((await page.locator('#nextEuroDifference').textContent())!=='Unavailable')throw new Error('Next Euro retained a stale result');

  await page.evaluate(key=>{
    localStorage.setItem(key,JSON.stringify({schema:1,savedAt:'2026-09-01T00:00:00.000Z',controls:{'id:annualReturn':{kind:'value',value:'6'},'id:grossIncome':{kind:'value',value:'80000'}},meta:{activeTab:'mortgage',mortgageType:'linear'}}));
  },STORAGE_KEY);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(key=>{
    const saved=JSON.parse(localStorage.getItem(key)||'null');
    return document.getElementById('annualReturn')?.value==='6'&&document.getElementById('grossAnnualIncome')?.value==='80000'&&saved?.schema===2;
  },STORAGE_KEY);
  const migration=await page.evaluate(key=>({annualReturn:document.getElementById('annualReturn').value,grossAnnualIncome:document.getElementById('grossAnnualIncome').value,state:JSON.parse(localStorage.getItem(key)),status:document.getElementById('plannerSaveStatus').textContent}),STORAGE_KEY);
  if(migration.annualReturn!=='6'||migration.grossAnnualIncome!=='80000'||migration.state.schema!==2||migration.state.kind!=='dimp.planner-state.v2')throw new Error(`schema 1 migration failed: ${JSON.stringify(migration)}`);
  if(pageErrors.length)throw new Error(`Browser page errors:\n${pageErrors.join('\n\n')}`);
  console.log(JSON.stringify({stage:7,strictValidation:true,savedStateMigration:true,stage91RequiredScenarioInputs:true,localBrowserCommand:'npm run test:e2e',pageErrors:0},null,2));
  console.log('Stage 7 browser input and saved-state contracts passed.');
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
