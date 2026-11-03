import http from 'node:http';
import path from 'node:path';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};
const APP_KEY=/^(?:dimp|dutch-investment-mortgage-planner)/;
const CONFIRM='Start fresh? This deletes everything this planner saved in this browser and restores the example values.';
const BORROWING_NOTICE='This planner does not check how much a lender would let you borrow. It does not apply Nibud income limits (LTI) or a lender\'s own assessment. For your maximum mortgage, ask a lender or an AFM-licensed mortgage adviser.';
const MARKERS=['6.41','6,41','86421','86.421','273641','273.641','13579','13.579','417111','417.111','388222','388.222','19483','19.483'];

const server=http.createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
    const relative=pathname==='/'?'index.html':pathname.replace(/^\/+/,'');
    const file=path.resolve(ROOT,relative);
    if(!file.startsWith(ROOT+path.sep))throw new Error('Invalid path');
    const info=await stat(file);
    if(!info.isFile())throw new Error('Not a file');
    res.writeHead(200,{'content-type':TYPES[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});
    res.end(await readFile(file));
  }catch(_error){
    res.writeHead(404,{'content-type':'text/plain; charset=utf-8'});
    res.end('Not found');
  }
});

await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const {port}=server.address();
const browser=await chromium.launch({headless:true});
const context=await browser.newContext();
const page=await context.newPage();
const pageErrors=[];
page.on('pageerror',error=>pageErrors.push(String(error?.stack||error)));
await page.route(/^https:\/\//,route=>route.abort());
page.setDefaultTimeout(20000);

async function fillAndInput(selector,value){
  const field=page.locator(selector);
  await field.fill(String(value));
  await field.dispatchEvent('input');
  await field.dispatchEvent('change');
}

try{
  await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'load'});
  await page.waitForFunction(()=>document.getElementById('modelVersion')?.textContent?.includes('R6.6')&&document.getElementById('grossAnnualIncome')&&document.getElementById('decisionEngine'));

  await fillAndInput('#annualReturn','6.41');
  const phaseInvest=page.locator('#phaseList [data-field="monthlyInvest"]').first();
  await phaseInvest.fill('13579');
  await phaseInvest.dispatchEvent('input');
  await phaseInvest.dispatchEvent('change');
  await page.locator('.tab[data-tab="mortgage"]').click();
  await fillAndInput('#grossAnnualIncome','86421');
  await fillAndInput('#mortBalance','273641');
  await page.locator('.tab[data-tab="scenarios"]').click();

  const purchaseNotice=await page.evaluate(expected=>{
    const el=document.getElementById('scenarioPurchaseBorrowingNotice');
    if(!el)return{missing:true};
    const style=getComputedStyle(el);
    return{
      text:el.textContent,
      hidden:el.classList.contains('hidden'),
      display:style.display,
      inDetails:Boolean(el.closest('details')),
      panelShown:getComputedStyle(document.getElementById('tab-scenarios')).display!=='none',
      nextToFunding:el.nextElementSibling?.id==='scenarioFundingDetailsNew',
      expected
    };
  },BORROWING_NOTICE);
  if(purchaseNotice.missing||purchaseNotice.text!==BORROWING_NOTICE||purchaseNotice.hidden||purchaseNotice.display==='none'||purchaseNotice.inDetails||!purchaseNotice.panelShown||!purchaseNotice.nextToFunding){
    throw new Error(`Scenario purchase borrowing notice is not visible beside the purchase result: ${JSON.stringify(purchaseNotice)}`);
  }

  await page.locator('#scenarioSourceFresh').check();
  await fillAndInput('#scenarioBuyPriceNew','417111');
  const firstSnapshot=await page.waitForFunction(()=>{
    const raw=localStorage.getItem('dimp.stage91.scenario-state.v1');
    return raw&&raw.includes('417111')?raw:null;
  });
  const firstSnapshotText=await firstSnapshot.jsonValue();

  await page.selectOption('#comparisonType','downpayment');
  await fillAndInput('#scenarioDpPriceNew','388222');
  await page.locator('#scenarioPurchaseRulesNew > summary').click();
  await fillAndInput('#scenarioDeductibleFinancingCostsNew','19483');

  await page.waitForFunction(previous=>{
    const scenario=localStorage.getItem('dimp.stage91.scenario-state.v1');
    const stage10=localStorage.getItem('dimp.stage10.scenario-state.v1');
    const main=localStorage.getItem('dutch-investment-mortgage-planner:r6');
    return Boolean(scenario&&scenario!==previous&&scenario.includes('417111')&&scenario.includes('388222')&&stage10&&stage10.includes('19483')&&main&&main.includes('86421')&&main.includes('273641')&&main.includes('6.41'));
  },firstSnapshotText);

  const before=await page.evaluate(()=>({
    keys:Object.keys(localStorage),
    scenario:localStorage.getItem('dimp.stage91.scenario-state.v1'),
    stage10:localStorage.getItem('dimp.stage10.scenario-state.v1')
  }));
  const snapshotKeys=before.keys.filter(key=>key==='dimp.stage91.scenario-state.v1'||key==='dimp.stage10.scenario-state.v1');
  if(snapshotKeys.length<2)throw new Error(`Expected two scenario snapshot keys before reset, found ${JSON.stringify(before.keys)}`);

  page.once('dialog',dialog=>{
    if(dialog.message()!==CONFIRM)throw new Error(`Unexpected confirm: ${dialog.message()}`);
    return dialog.accept();
  });
  if((await page.locator('#plannerReset').textContent())!=='Start fresh')throw new Error('Reset button is not labelled Start fresh');
  await Promise.all([
    page.waitForNavigation({waitUntil:'load'}),
    page.locator('#plannerReset').click()
  ]);
  await page.reload({waitUntil:'load'});
  await page.waitForFunction(()=>document.getElementById('modelVersion')?.textContent?.includes('R6.6')&&document.getElementById('decisionEngine')&&document.getElementById('annualReturn'));
  await page.waitForTimeout(750);

  const after=await page.evaluate(async()=>{
    const local={};
    for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);local[key]=localStorage.getItem(key);}
    const session={};
    for(let i=0;i<sessionStorage.length;i++){const key=sessionStorage.key(i);session[key]=sessionStorage.getItem(key);}
    const databases=indexedDB.databases? (await indexedDB.databases()).map(db=>db.name).filter(Boolean):[];
    const cacheNames=window.caches?.keys? await caches.keys():[];
    const inputs=[...document.querySelectorAll('input,textarea,select')].map(el=>({
      id:el.id||el.name||'',
      value:(el.type==='checkbox'||el.type==='radio')?String(el.checked):String(el.value??'')
    }));
    return{local,session,databases,cacheNames,inputs,text:document.body.innerText,annualReturn:document.getElementById('annualReturn')?.value,mortBalance:document.getElementById('mortBalance')?.value,income:document.getElementById('grossAnnualIncome')?.value};
  });

  const appKeys=Object.keys(after.local).filter(key=>APP_KEY.test(key));
  if(appKeys.length||Object.keys(after.local).length)throw new Error(`App storage remained after Start fresh and reload: ${JSON.stringify(after.local)}`);
  if(Object.keys(after.session).length)throw new Error(`sessionStorage remained: ${JSON.stringify(after.session)}`);
  if(after.databases.length)throw new Error(`IndexedDB remained: ${JSON.stringify(after.databases)}`);
  if(after.cacheNames.length)throw new Error(`Cache storage remained: ${JSON.stringify(after.cacheNames)}`);
  const inputBlob=after.inputs.map(item=>`${item.id}=${item.value}`).join('\n');
  const leaked=MARKERS.filter(marker=>inputBlob.includes(marker)||after.text.includes(marker));
  if(leaked.length)throw new Error(`Personal values remained in inputs or the page: ${leaked.join(', ')}`);
  if(after.annualReturn!=='5'||after.mortBalance!=='300000'||after.income!=='60000')throw new Error(`Example values were not restored: ${JSON.stringify({annualReturn:after.annualReturn,mortBalance:after.mortBalance,income:after.income})}`);
  if(pageErrors.length)throw new Error(`Browser page errors:\n${pageErrors.join('\n\n')}`);
  console.log(JSON.stringify({resetClearsBrowserStorage:true,scenarioSnapshotsBeforeReset:snapshotKeys,personalValuesAbsent:MARKERS,exampleValuesRestored:true,pageErrors:0},null,2));
  console.log('Start fresh browser storage contract passed.');
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
