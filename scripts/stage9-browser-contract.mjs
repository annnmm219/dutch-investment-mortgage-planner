import http from 'node:http';
import path from 'node:path';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json'};
const server=http.createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);const relative=pathname==='/'?'index.html':pathname.replace(/^\/+/, '');const file=path.resolve(ROOT,relative);if(!file.startsWith(ROOT+path.sep))throw new Error('Invalid path');const info=await stat(file);if(!info.isFile())throw new Error('Not a file');res.writeHead(200,{'content-type':TYPES[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});res.end(await readFile(file));}catch{res.writeHead(404);res.end('Not found');}});

await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true}),page=await browser.newPage(),errors=[];
page.on('pageerror',error=>errors.push(String(error?.stack||error)));
await page.route(/^https:\/\//,route=>route.abort());
page.setDefaultTimeout(15000);

async function value(selector){return page.locator(selector).inputValue()}
async function setValue(id,next){await page.evaluate(([fieldId,fieldValue])=>{const el=document.getElementById(fieldId);el.value=fieldValue;el.dispatchEvent(new Event('input',{bubbles:true}));},[id,next])}

try{
  await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.getElementById('scenarioSourceCard'));
  if(await page.locator('input[name="scenarioDataSource"]:checked').count())throw new Error('A scenario source was selected without user action');
  if(!/Choose whether/i.test(await page.locator('#scenarioVerdictNew').textContent()))throw new Error('Result was not locked before source selection');
  await page.locator('.tab[data-tab="scenarios"]').click();

  await setValue('annualReturn','6.5');
  await setValue('startPortfolio','123456');
  await setValue('box3Savings','45678');
  await setValue('mortBalance','234567');
  await setValue('mortRate','3.75');
  await page.locator('#scenarioSourceImported').check();
  await page.waitForFunction(()=>document.getElementById('scenarioStartPortfolioFresh')?.value==='123456');
  const imported={returnPct:await value('#scenarioReturnNew'),portfolio:await value('#scenarioStartPortfolioFresh'),savings:await value('#scenarioStartSavingsFresh'),mortgage:await value('#scenarioMortgageBalanceFresh'),rate:await value('#scenarioMortgageRateFresh')};
  if(JSON.stringify(imported)!==JSON.stringify({returnPct:'6.5',portfolio:'123456',savings:'45678',mortgage:'234567',rate:'3.75'}))throw new Error(`Imported values differ: ${JSON.stringify(imported)}`);

  await setValue('startPortfolio','999999');
  await setValue('mortBalance','888888');
  if(await value('#scenarioStartPortfolioFresh')!=='123456'||await value('#scenarioMortgageBalanceFresh')!=='234567')throw new Error('Imported snapshot changed after editing another tab');
  await page.locator('#scenarioRefreshImport').click();
  if(await value('#scenarioStartPortfolioFresh')!=='999999'||await value('#scenarioMortgageBalanceFresh')!=='888888')throw new Error('Explicit snapshot refresh did not copy current planner values');

  await page.locator('#scenarioSourceFresh').check();
  if(await value('#scenarioStartPortfolioFresh')!=='')throw new Error('Fresh scenario retained imported portfolio data');
  await page.locator('#scenarioStartPortfolioFresh').fill('70000');
  await setValue('startPortfolio','111111');
  if(await value('#scenarioStartPortfolioFresh')!=='70000')throw new Error('Fresh scenario changed after editing Investing');
  if(errors.length)throw new Error(`Browser page errors:\n${errors.join('\n\n')}`);
  console.log(JSON.stringify({stage:9,explicitSourceRequired:true,importSnapshotCopied:true,importSnapshotStable:true,explicitRefresh:true,freshIndependent:true,pageErrors:0},null,2));
  console.log('Stage 9 browser source-ownership contract passed.');
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
