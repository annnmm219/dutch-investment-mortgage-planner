import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
const server=http.createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname),relative=pathname==='/'?'index.html':pathname.replace(/^\/+/,''),file=path.resolve(ROOT,relative);if(!file.startsWith(ROOT+path.sep))throw new Error('invalid');const info=await stat(file);if(!info.isFile())throw new Error('not file');res.writeHead(200,{'content-type':TYPES[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});res.end(await readFile(file));}catch{res.writeHead(404);res.end('Not found');}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
page.on('pageerror',error=>errors.push(String(error?.stack||error)));
await page.route(/^https:\/\//,route=>route.abort());page.setDefaultTimeout(15000);
const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
async function state(label){const x=await page.evaluate(()=>({active:document.querySelector('.compare-card.active[data-mort-type]')?.dataset.mortType||null,linearPressed:document.getElementById('linearCompare')?.getAttribute('aria-pressed'),annuityPressed:document.getElementById('annuityCompare')?.getAttribute('aria-pressed'),stable:localStorage.getItem(window.Stage91Quality?.MORTGAGE_TYPE_KEY||'dimp.stage91.main-mortgage-type.v1'),saved:JSON.parse(localStorage.getItem('dutch-investment-mortgage-planner:r6')||'null')?.meta?.mortgageType||null,source:document.querySelector('input[name="scenarioDataSource"]:checked')?.value||null,mode:document.getElementById('comparisonType')?.value||null,scenario:document.getElementById('scenarioMortgageMethodFresh')?.value||null,config:window.__DIMP_ACTIVE_SCENARIO_CONFIG?.mortgageType||null,valid:window.__DIMP_CANONICAL_COMPARISON?.valid??null,reason:window.__DIMP_CANONICAL_COMPARISON?.reason||null}));console.log(label,JSON.stringify(x));return x;}
async function activeIds(){return page.evaluate(()=>Array.from(document.querySelectorAll('#tab-scenarios input,#tab-scenarios select')).filter(el=>{if(!el.id||el.name==='scenarioDataSource'||el.disabled||el.closest('.hidden'))return false;const cs=getComputedStyle(el);return cs.display!=='none'&&cs.visibility!=='hidden';}).map(el=>el.id).sort());}
async function fill(id,value){const el=page.locator(`#${id}`);await el.fill(String(value));await el.dispatchEvent('input');await el.dispatchEvent('change');await settle();}
try{
  const url=`http://127.0.0.1:${server.address().port}/`;
  await page.goto(url,{waitUntil:'domcontentloaded'});await page.evaluate(()=>localStorage.clear());await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.Stage91Quality&&document.getElementById('scenarioSourceImported'));
  await page.locator('.tab[data-tab="mortgage"]').click();await page.locator('#linearCompare').click();await settle();
  let s=await state('after-select-linear');assert.equal(s.active,'linear','Linear Mortgage card did not become active');

  await page.locator('.tab[data-tab="scenarios"]').click();await page.locator('#comparisonType').selectOption('mortgage-invest');await settle();await page.locator('#scenarioSourceImported').check();await settle();
  await fill('scenarioHorizonNew',4);await fill('scenarioReturnNew',3.05);await fill('scenarioOwnerTotalNew',345);await fill('scenarioExtraMonthlyNew',290);
  s=await state('after-mortgage-invest-import');assert.equal(s.mode,'mortgage-invest');assert.equal(s.scenario,'linear','Mortgage-invest import did not copy Linear');

  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.Stage91Quality&&document.querySelector('input[name="scenarioDataSource"]:checked')?.value==='imported');await settle();
  s=await state('after-reload');assert.equal(s.active,'linear','Main Mortgage method drifted after reload');assert.equal(s.scenario,'linear','Scenario mortgage method drifted after reload');
  await page.locator('.tab[data-tab="scenarios"]').click();await page.locator('#scenarioRefreshImport').click();await settle();
  s=await state('after-first-refresh');assert.equal(s.scenario,'linear','Explicit Refresh imported a different mortgage method after reload');

  await page.locator('.tab[data-tab="investment"]').click();await page.locator('#startPortfolio').fill('99999');await settle();
  s=await state('after-portfolio-edit');assert.equal(s.active,'linear','Portfolio edit changed the main Mortgage method');assert.equal(s.stable,'linear','Portfolio edit overwrote the stable Mortgage method');
  await page.locator('.tab[data-tab="scenarios"]').click();await page.locator('#scenarioRefreshImport').click();await settle();
  s=await state('after-second-refresh');assert.equal(s.scenario,'linear','Refresh after a planner edit imported a different mortgage method');

  await fill('scenarioReturnNew',3.05);await fill('scenarioOwnerTotalNew',345);await fill('scenarioExtraMonthlyNew',290);
  s=await state('after-owned-edits');assert.equal(s.scenario,'linear','Scenario-owned edits changed imported mortgage method');if(s.config!==null)assert.equal(s.config,'linear','Scenario-owned edits produced a non-Linear active config');

  await page.locator('.tab[data-tab="investment"]').click();await page.locator('#startPortfolio').fill('0');await settle();
  s=await state('after-portfolio-reset');assert.equal(s.active,'linear','Resetting a planner value changed the main Mortgage method');assert.equal(s.stable,'linear','Resetting a planner value overwrote the stable Mortgage method');
  await page.locator('.tab[data-tab="scenarios"]').click();await page.locator('#scenarioRefreshImport').click();await settle();
  s=await state('after-third-refresh');assert.equal(s.scenario,'linear','Second explicit Refresh imported a different mortgage method');if(s.config!==null)assert.equal(s.config,'linear','Second explicit Refresh produced a non-Linear active config');

  const importedIds=await activeIds();await page.locator('#scenarioSourceFresh').check();await settle();const freshIds=await activeIds();
  const onlyImported=importedIds.filter(id=>!freshIds.includes(id)),onlyFresh=freshIds.filter(id=>!importedIds.includes(id));
  console.log('active-input-set-diff',JSON.stringify({onlyImported,onlyFresh,importedCount:importedIds.length,freshCount:freshIds.length}));
  if(onlyImported.length||onlyFresh.length)throw new Error(`Active input set differs by route: ${JSON.stringify({onlyImported,onlyFresh})}`);

  if(errors.length)throw new Error(`Browser page errors:\n${errors.join('\n\n')}`);
  console.log(JSON.stringify({stage:'R6.6 Stage 9.1',mode:'mortgage-invest',mortgageMethod:'linear',initialImport:true,reloadPreserved:true,refreshAfterPlannerEdits:true,activeInputSetsMatch:true,pageErrors:0},null,2));
  console.log('Stage 9.1 mortgage-invest method and active-input contract passed.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
