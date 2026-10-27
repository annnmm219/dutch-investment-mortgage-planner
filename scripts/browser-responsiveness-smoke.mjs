import http from 'node:http';
import path from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};

function delay(ms){return new Promise(resolve=>setTimeout(resolve,ms));}

const server=http.createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
    const relative=pathname==='/'?'index.html':pathname.replace(/^\/+/, '');
    const file=path.resolve(ROOT,relative);
    if(!file.startsWith(ROOT+path.sep))throw new Error('Invalid path');
    const info=await stat(file);
    if(!info.isFile())throw new Error('Not a file');
    const body=await readFile(file);
    res.writeHead(200,{'content-type':TYPES[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});
    res.end(body);
  }catch(_error){
    res.writeHead(404,{'content-type':'text/plain; charset=utf-8'});
    res.end('Not found');
  }
});

await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const {port}=server.address();
const browser=await chromium.launch({headless:true});
const context=await browser.newContext();

await context.addInitScript(()=>{
  const NativeMutationObserver=window.MutationObserver;
  window.__r65MutationCallbacks=0;
  window.MutationObserver=class CountingMutationObserver extends NativeMutationObserver{
    constructor(callback){
      super((records,observer)=>{
        window.__r65MutationCallbacks++;
        return callback(records,observer);
      });
    }
  };

});

const page=await context.newPage();
const pageErrors=[];
page.on('pageerror',error=>pageErrors.push(String(error?.stack||error)));
await page.route(/^https:\/\//,route=>route.abort());
page.setDefaultTimeout(15000);

async function responsivePing(label){
  const result=await Promise.race([
    page.evaluate(()=>new Promise(resolve=>setTimeout(()=>resolve({
      version:document.getElementById('modelVersion')?.textContent||'',
      callbacks:window.__r65MutationCallbacks||0,
      phases:document.getElementById('phaseList')?.children.length||0,
      scenario:document.getElementById('comparisonType')?.value||'',
      globalSwitchVisible:Boolean(document.getElementById('viewDensityBar')&&getComputedStyle(document.getElementById('viewDensityBar')).display!=='none'),
      globalBannerVisible:Boolean(document.getElementById('advancedStateSummary')&&getComputedStyle(document.getElementById('advancedStateSummary')).display!=='none'),
      box3Fold:Boolean(document.getElementById('r65Box3Advanced')),
      mortgageFold:Boolean(document.getElementById('r65MortgageAdvanced')),
      scenarioFold:Boolean(document.getElementById('r65ScenarioAdvanced')),
      howFold:Boolean(document.getElementById('r65ScenarioHow')),
      saveText:document.getElementById('plannerSaveStatus')?.textContent||'',
      scenarioReturn:document.getElementById('scenarioReturnNew')?.value||'',
      sourceMode:document.querySelector('input[name="scenarioDataSource"]:checked')?.value||'',
      sourceStatus:document.getElementById('scenarioSourceStatus')?.textContent||''
    }),100))),
    delay(5000).then(()=>{throw new Error(`${label}: browser main thread did not answer within 5 seconds`);})
  ]);
  if(!result.version.includes('R6.6'))throw new Error(`${label}: wrong model version: ${result.version}`);
  if(result.phases<1)throw new Error(`${label}: phase UI did not initialize`);
  if(result.callbacks>1000)throw new Error(`${label}: excessive MutationObserver callbacks (${result.callbacks})`);
  if(result.globalSwitchVisible||result.globalBannerVisible)throw new Error(`${label}: obsolete global density UI is visible`);
  if(!result.box3Fold||!result.mortgageFold||!result.scenarioFold||!result.howFold)throw new Error(`${label}: one or more local assumption folds are missing`);
  return result;
}

const PRIVACY_SENTENCE='Saved in this browser only: your inputs stay on this device (localStorage) and are not sent to us or to any third party. Our web host sees standard request logs (e.g. IP address).';

async function assertPrivacySentenceVisible(label){
  const result=await page.evaluate(expected=>{
    const bar=document.getElementById('plannerStorageBar');
    const span=bar?.querySelector(':scope > span:first-child');
    if(!bar||!span)return{ok:false,reason:'missing'};
    const style=getComputedStyle(span);
    const box=span.getBoundingClientRect();
    let api=true;
    if(typeof span.checkVisibility==='function')api=span.checkVisibility({checkOpacity:true,checkVisibilityCSS:true});
    const shown=style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)>0&&box.width>0&&box.height>0&&api;
    return{ok:shown&&(span.textContent||'').replace(/\s+/g,' ').includes(expected),text:(span.textContent||'').replace(/\s+/g,' ').trim(),display:style.display,visibility:style.visibility,opacity:style.opacity,width:box.width,height:box.height,checkVisibility:api};
  },PRIVACY_SENTENCE);
  if(!result.ok)throw new Error(`${label}: privacy sentence is not visible: ${JSON.stringify(result)}`);
}

try{
  await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'domcontentloaded',timeout:15000});
  await page.waitForFunction(()=>document.getElementById('phaseList')?.children.length>=1&&document.getElementById('r65ScenarioAdvanced')&&document.getElementById('plannerStorageBar'));
  await delay(750);
  await page.setViewportSize({width:1280,height:800});
  await assertPrivacySentenceVisible('desktop');
  await page.setViewportSize({width:390,height:844});
  await assertPrivacySentenceVisible('mobile');
  await page.setViewportSize({width:1280,height:800});
  const initial=await responsivePing('initial load');

  await page.locator('#annualReturn').fill('7');
  await page.locator('#annualReturn').dispatchEvent('input');
  const beforeImport=await responsivePing('planner edit before scenario import');
  if(beforeImport.sourceMode)throw new Error(`scenario selected a data source silently: ${beforeImport.sourceMode}`);

  await page.locator('.tab[data-tab="scenarios"]').click();
  await page.locator('#scenarioSourceImported').check();
  await page.waitForFunction(()=>document.getElementById('scenarioReturnNew')?.value==='7');
  const imported=await responsivePing('explicit planner snapshot');
  if(imported.sourceMode!=='imported'||!/Existing data copied/i.test(imported.sourceStatus))throw new Error(`scenario import was not explicit: ${JSON.stringify(imported)}`);
  await page.selectOption('#comparisonType','mortgage-invest');
  await page.locator('#scenarioExtraMonthlyNew').fill('500');
  await page.locator('#scenarioOwnerTotalNew').fill('491.33');
  await delay(500);
  const scenario=await responsivePing('scenario rerender');

  await page.locator('#r65ScenarioAdvanced > summary').click();
  await page.locator('#r65ScenarioHow > summary').click();
  await delay(500);
  const localFolds=await responsivePing('local advanced folds');

  await page.locator('.tab[data-tab="mortgage"]').click();
  await page.locator('#r65MortgageAdvanced > summary').click();
  await delay(300);
  const mortgage=await responsivePing('mortgage assumptions fold');

  if(pageErrors.length)throw new Error(`Browser page errors:\n${pageErrors.join('\n\n')}`);
  console.log(JSON.stringify({release:'R6.6',responsive:true,initial,beforeImport,imported,scenario,localFolds,mortgage,pageErrors:0},null,2));
  console.log('R6.6 Chromium interface and responsiveness smoke test passed.');
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
