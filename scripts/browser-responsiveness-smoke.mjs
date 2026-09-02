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

  const charts=new Map();
  class ChartStub{
    constructor(context,config={}){
      this.context=context;
      this.data=config.data||{datasets:[]};
      this.options=config.options||{};
      const canvas=context?.canvas||context;
      if(canvas)charts.set(canvas,this);
      if(canvas?.id)charts.set(canvas.id,this);
    }
    update(){}
    destroy(){}
    resize(){}
    static getChart(target){return charts.get(target)||charts.get(target?.id)||null;}
  }
  window.Chart=ChartStub;
  if(window.HTMLCanvasElement){
    window.HTMLCanvasElement.prototype.getContext=function(){return{canvas:this};};
  }
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
      returnLabel:document.querySelector('[data-r65-role="scenario-return-label"]')?.textContent||''
    }),100))),
    delay(5000).then(()=>{throw new Error(`${label}: browser main thread did not answer within 5 seconds`);})
  ]);
  if(!result.version.includes('R6.5'))throw new Error(`${label}: wrong model version: ${result.version}`);
  if(result.phases<1)throw new Error(`${label}: phase UI did not initialize`);
  if(result.callbacks>1000)throw new Error(`${label}: excessive MutationObserver callbacks (${result.callbacks})`);
  if(result.globalSwitchVisible||result.globalBannerVisible)throw new Error(`${label}: obsolete global density UI is visible`);
  if(!result.box3Fold||!result.mortgageFold||!result.scenarioFold||!result.howFold)throw new Error(`${label}: one or more local assumption folds are missing`);
  return result;
}

try{
  await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'domcontentloaded',timeout:15000});
  await page.waitForFunction(()=>document.getElementById('phaseList')?.children.length>=1&&document.getElementById('r65ScenarioAdvanced'));
  await delay(750);
  const initial=await responsivePing('initial load');

  await page.locator('#annualReturn').fill('7');
  await page.locator('#annualReturn').dispatchEvent('input');
  await page.waitForFunction(()=>document.getElementById('scenarioReturnNew')?.value==='7');
  const inherited=await responsivePing('inherited investment return');
  if(!/7.*from Investment/i.test(inherited.returnLabel))throw new Error(`scenario return did not clearly inherit Investment: ${inherited.returnLabel}`);

  await page.locator('.tab[data-tab="scenarios"]').click();
  await page.selectOption('#comparisonType','mortgage-invest');
  await delay(500);
  const scenario=await responsivePing('scenario rerender');

  await page.locator('#r65ScenarioAdvanced > summary').click();
  await page.locator('#r65ScenarioHow > summary').click();
  await page.locator('[data-r65-role="owner-total"]').fill('491.33');
  await page.locator('[data-r65-role="owner-total"]').dispatchEvent('input');
  await delay(500);
  const localFolds=await responsivePing('local advanced folds');

  await page.locator('.tab[data-tab="mortgage"]').click();
  await page.locator('#r65MortgageAdvanced > summary').click();
  await delay(300);
  const mortgage=await responsivePing('mortgage assumptions fold');

  if(pageErrors.length)throw new Error(`Browser page errors:\n${pageErrors.join('\n\n')}`);
  console.log(JSON.stringify({release:'R6.5',responsive:true,initial,inherited,scenario,localFolds,mortgage,pageErrors:0},null,2));
  console.log('R6.5 Chromium interface and responsiveness smoke test passed.');
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
