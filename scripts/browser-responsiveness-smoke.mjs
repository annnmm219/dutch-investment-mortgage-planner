import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import OutputIntegrity from '../output-integrity.js';
import releaseIdentity from '../release-identity.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};
const expectedModelMeta=OutputIntegrity.RELEASE_META;
const expectedReleaseLabel=OutputIntegrity.releaseLabel(expectedModelMeta);
assert.equal(expectedModelMeta.version,releaseIdentity.release,'Checked-in release metadata disagrees with the release identity');

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
const externalRequests=[];
page.on('pageerror',error=>pageErrors.push(String(error?.stack||error)));
page.on('request',request=>{
  let host='';
  try{host=new URL(request.url()).hostname;}catch{host='';}
  if(host&&host!=='127.0.0.1'&&host!=='localhost')externalRequests.push(request.url());
});
await page.route(/^https:\/\//,route=>route.abort());
page.setDefaultTimeout(15000);

async function responsivePing(label){
  const result=await Promise.race([
    page.evaluate(()=>new Promise(resolve=>setTimeout(()=>resolve({
      version:document.getElementById('modelVersion')?.textContent||'',
      documentVersion:document.documentElement.dataset.modelVersion||'',
      modelMeta:window.MODEL_META||null,
      outputMeta:window.OutputIntegrity?.RELEASE_META||null,
      releaseIdentity:window.__DIMP_RELEASE_IDENTITY||null,
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
  assert.equal(result.version,expectedReleaseLabel,`${label}: visible release label differs from checked-in metadata`);
  assert.equal(result.documentVersion,expectedModelMeta.version,`${label}: document model version differs from checked-in metadata`);
  assert.deepEqual(result.modelMeta,expectedModelMeta,`${label}: runtime model metadata differs from checked-in metadata`);
  assert.deepEqual(result.outputMeta,expectedModelMeta,`${label}: runtime output metadata differs from checked-in metadata`);
  assert.deepEqual(result.releaseIdentity,releaseIdentity,`${label}: runtime release identity differs from the checked-in identity`);
  if(result.phases<1)throw new Error(`${label}: phase UI did not initialize`);
  if(result.callbacks>1000)throw new Error(`${label}: excessive MutationObserver callbacks (${result.callbacks})`);
  if(result.globalSwitchVisible||result.globalBannerVisible)throw new Error(`${label}: obsolete global density UI is visible`);
  if(!result.box3Fold||!result.mortgageFold||!result.scenarioFold||!result.howFold)throw new Error(`${label}: one or more local assumption folds are missing`);
  return result;
}

const HEADER_LINE='Planning estimates only, not financial, tax or mortgage advice. Your financial inputs are calculated and saved locally in your browser.';
const HEADER_DETAILS='Rules simplified, as of 27 Oct 2026. Your inputs are stored in this browser\'s localStorage and are not sent to us or to any third party. Our web host sees standard request logs (e.g. IP address). "Start fresh" deletes everything this planner saved in this browser.';
const FOOTER_RULES='2026 rules, verified 27 Oct 2026';

async function assertHeaderVisible(label){
  const result=await page.evaluate(({line,details,footer})=>{
    const shown=(el,box)=>{
      const style=getComputedStyle(el);
      const api=typeof el.checkVisibility==='function'?el.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}):true;
      return style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)>0&&box.width>0&&box.height>0&&api;
    };
    const trust=document.getElementById('headerTrustLine');
    const button=document.getElementById('headerTrustInfo');
    const panel=document.getElementById('headerTrustPanel');
    const rules=document.getElementById('modelVersion');
    const status=document.getElementById('plannerSaveStatus');
    if(!trust||!button||!panel||!rules||!status)return{ok:false,reason:'missing'};
    rules.scrollIntoView({block:'center'});
    const trustBox=trust.getBoundingClientRect(),buttonBox=button.getBoundingClientRect(),rulesBox=rules.getBoundingClientRect();
    const trustText=(trust.textContent||'').replace(/\s+/g,' ').trim();
    const panelText=(panel.textContent||'').replace(/\s+/g,' ').trim();
    const statusText=(status.textContent||'').replace(/\s+/g,' ').trim();
    const sameLine=button.parentElement?.id==='headerNotAdvice'&&buttonBox.bottom>trustBox.top&&buttonBox.top<trustBox.bottom+buttonBox.height;
    return{
      ok:shown(trust,trustBox)&&trustText===line&&shown(button,buttonBox)&&buttonBox.width>=24&&buttonBox.height>=24&&sameLine&&panelText===details&&panel.getAttribute('aria-hidden')!=='true'&&getComputedStyle(panel).display!=='none'&&button.getAttribute('aria-expanded')==='false'&&!button.hasAttribute('title')&&!panel.hasAttribute('title')&&(rules.textContent||'').includes(footer)&&shown(rules,rulesBox)&&statusText==='Example values'&&!/saved/i.test(statusText),
      trustText,panelText,buttonBox:{width:buttonBox.width,height:buttonBox.height},expanded:button.getAttribute('aria-expanded'),status:statusText,footer:(rules.textContent||'').trim(),rulesBox:{width:rulesBox.width,height:rulesBox.height}
    };
  },{line:HEADER_LINE,details:HEADER_DETAILS,footer:FOOTER_RULES});
  if(!result.ok)throw new Error(`${label}: header is not visible as approved: ${JSON.stringify(result)}`);
  const snapshot=await page.locator('header').ariaSnapshot();
  if(!snapshot.includes('Rules simplified, as of 27 Oct 2026.'))throw new Error(`${label}: info text is missing from the accessibility tree: ${snapshot}`);
  if(!snapshot.includes('not sent to us or to any third party'))throw new Error(`${label}: privacy detail is missing from the accessibility tree: ${snapshot}`);
}

async function exerciseHeaderInfo(label){
  const button=page.locator('#headerTrustInfo');
  const panel=page.locator('#headerTrustPanel');
  await button.hover();
  if(await button.getAttribute('aria-expanded')!=='false')throw new Error(`${label}: info opened on hover`);
  await button.click();
  if(await button.getAttribute('aria-expanded')!=='true')throw new Error(`${label}: click did not open the info panel`);
  const opened=await panel.evaluate(el=>{
    const style=getComputedStyle(el),box=el.getBoundingClientRect();
    const api=typeof el.checkVisibility==='function'?el.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}):true;
    return style.display!=='none'&&style.visibility!=='hidden'&&box.height>8&&api&&el.classList.contains('is-open');
  });
  if(!opened)throw new Error(`${label}: opened info panel is not visible`);
  if((await panel.textContent()).replace(/\s+/g,' ').trim()!==HEADER_DETAILS)throw new Error(`${label}: opened info panel text changed`);
  await page.keyboard.press('Escape');
  if(await button.getAttribute('aria-expanded')!=='false')throw new Error(`${label}: Escape did not close the info panel`);
  if(await page.evaluate(()=>document.activeElement?.id)!=='headerTrustInfo')throw new Error(`${label}: Escape did not return focus to the info button`);
  await page.keyboard.press('Enter');
  if(await button.getAttribute('aria-expanded')!=='true')throw new Error(`${label}: Enter did not open the info panel`);
  await page.keyboard.press('Escape');
  await page.keyboard.press(' ');
  if(await button.getAttribute('aria-expanded')!=='true')throw new Error(`${label}: Space did not open the info panel`);
  await page.keyboard.press('Escape');
}

async function assertSavedStatus(label){
  await page.waitForFunction(()=>document.getElementById('plannerSaveStatus')?.dataset.saveState==='saved');
  const status=page.locator('#plannerSaveStatus');
  const visible=await status.locator('[aria-hidden="true"]').textContent();
  if(visible!=='✓ Saved')throw new Error(`${label}: visible save status is ${JSON.stringify(visible)}`);
  const name=await status.evaluate(el=>{
    const hidden=[...el.querySelectorAll('[aria-hidden="true"]')].map(node=>node.textContent).join('');
    const accessible=[...el.childNodes].filter(node=>!(node instanceof Element)||node.getAttribute('aria-hidden')!=='true').map(node=>node.textContent||'').join('').replace(/\s+/g,' ').trim();
    return{accessible,hidden,label:el.getAttribute('aria-label'),title:el.querySelector('[aria-hidden="true"]')?.title||''};
  });
  if(name.accessible!=='Saved in this browser')throw new Error(`${label}: save accessible text is ${JSON.stringify(name)}`);
  if(name.label)throw new Error(`${label}: save status must not use an aria-label`);
  if(!/^\d{2}:\d{2}$/.test(name.title))throw new Error(`${label}: save time tooltip missing: ${JSON.stringify(name)}`);
  await page.getByRole('status',{name:'Saved in this browser'}).waitFor();
}

try{
  await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'domcontentloaded',timeout:15000});
  await page.waitForFunction(()=>document.getElementById('phaseList')?.children.length>=1&&document.getElementById('r65ScenarioAdvanced')&&document.getElementById('plannerStorageBar'));
  await delay(750);
  await page.setViewportSize({width:1280,height:800});
  await assertHeaderVisible('desktop');
  await exerciseHeaderInfo('desktop');
  await page.setViewportSize({width:390,height:844});
  await assertHeaderVisible('mobile');
  await exerciseHeaderInfo('mobile');
  await page.setViewportSize({width:1280,height:800});
  const initial=await responsivePing('initial load');

  await page.locator('#annualReturn').fill('7');
  await page.locator('#annualReturn').dispatchEvent('input');
  await assertSavedStatus('after save');
  await page.setViewportSize({width:390,height:844});
  await assertSavedStatus('after save mobile');
  await page.setViewportSize({width:1280,height:800});
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
  if(externalRequests.length)throw new Error(`Third-party requests:\n${externalRequests.join('\n')}`);
  await page.evaluate(()=>localStorage.setItem('dutch-investment-mortgage-planner:r6',JSON.stringify({kind:'dimp.planner-state.v2',schema:2,savedAt:'2026-10-27T12:00:00.000Z',controls:{},meta:{}})));
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.getElementById('plannerSaveStatus')?.textContent==='Previous plan restored');
  const restored=await page.locator('#plannerSaveStatus').textContent();
  if(/✓ Saved|Saved in this browser/.test(restored||''))throw new Error(`Restored plan was labelled saved: ${restored}`);
  console.log(JSON.stringify({release:expectedModelMeta.version,responsive:true,initial,beforeImport,imported,scenario,localFolds,mortgage,pageErrors:0,externalRequests:0},null,2));
  console.log(`${expectedModelMeta.version} Chromium interface and responsiveness smoke test passed.`);
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
