'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const path=require('node:path');
const {readFile,stat}=require('node:fs/promises');
const {chromium}=require('playwright');

const ROOT=path.resolve(__dirname,'..');
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};

function serve(){
  const server=http.createServer(async(req,res)=>{
    try{
      const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
      const rel=pathname==='/'?'index.html':pathname.replace(/^\/+/,'');
      const file=path.resolve(ROOT,rel);
      if(!file.startsWith(ROOT+path.sep))throw new Error('outside');
      const info=await stat(file);
      if(!info.isFile())throw new Error('missing');
      res.writeHead(200,{'content-type':TYPES[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});
      res.end(await readFile(file));
    }catch{
      res.writeHead(404);res.end('Not found');
    }
  });
  return new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(server)));
}

async function openPage(browser,url){
  const page=await browser.newPage();
  page.setDefaultTimeout(20000);
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.Stage10Remediation&&window.PlannerState&&document.getElementById('scenarioPropertyUseNew'));
  return page;
}

const settle=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));

async function show(page,id){
  await page.evaluate(field=>{
    const el=document.getElementById(field);
    const panel=el?.closest('.panel');
    if(panel&&!panel.classList.contains('active'))document.querySelector(`.tab[data-tab="${panel.id.slice(4)}"]`)?.click();
    for(let node=el;node;node=node.parentElement)if(node.tagName==='DETAILS')node.open=true;
  },id);
}

async function setField(page,id,value){
  await show(page,id);
  const el=page.locator(`#${id}`);
  const tag=await el.evaluate(node=>node.tagName.toLowerCase());
  const type=await el.getAttribute('type');
  if(type==='checkbox'){if(value)await el.check();else await el.uncheck();}
  else if(tag==='select')await el.selectOption(String(value));
  else await el.fill(String(value));
  await settle(page);
}

async function prepareSecondHome(page){
  await page.locator('.tab[data-tab="scenarios"]').click();
  await show(page,'scenarioPropertyUseNew');
  await setField(page,'comparisonType','buy-rent');
  await setField(page,'scenarioPropertyUseNew','non-main');
  await page.evaluate(()=>{const box=document.getElementById('scenarioBox3ModeFresh');if(box)box.value='current';});
  await setField(page,'scenarioPropertyUsePatternNew','own-holiday');
  await setField(page,'scenarioPropertyPrivateUseDaysNew',0);
  await setField(page,'scenarioPropertyRentalIncomeNew',0);
}

test('B4a shows the prior-year WOZ field for a P1 pattern when the old days field is 0',async()=>{
  const server=await serve();
  const browser=await chromium.launch({headless:true});
  try{
    const page=await openPage(browser,`http://127.0.0.1:${server.address().port}/`);
    await prepareSecondHome(page);
    await setField(page,'scenarioDaysLetNew',122);
    await setField(page,'scenarioBuildingDaysNew',0);
    const state=await page.evaluate(()=>{
      const shown=id=>{const el=document.getElementById(id);if(!el)return false;const style=getComputedStyle(el);return style.display!=='none'&&style.visibility!=='hidden'&&!el.closest('.hidden')&&!el.closest('details:not([open])');};
      return{
        wozShown:shown('scenarioPropertyPrivateUseWozNew'),
        oldShown:shown('scenarioPropertyPrivateUseDaysNew'),
        wozValue:document.getElementById('scenarioPropertyPrivateUseWozNew')?.value,
        readout:document.getElementById('scenarioOwnUseDaysReadout')?.value
      };
    });
    assert.equal(state.readout,'243');
    assert.equal(state.wozShown,true,'prior-year WOZ stays hidden while the old days field is 0');
    assert.equal(state.oldShown,false,'the old private-use days field stays on screen after a pattern is chosen');
    assert.notEqual(state.wozValue,'0','sync forces the prior-year WOZ back to 0');
  }finally{
    await browser.close();
    server.close();
  }
});

test('B4a S1 S2 and S3 own-use additions are on the page with the old days field at 0',async()=>{
  const server=await serve();
  const browser=await chromium.launch({headless:true});
  const cases=[
    {name:'S1',daysLet:122,building:0,woz:237000,readout:'243',addition:7983.85},
    {name:'S2',daysLet:122,building:0,woz:300000,readout:'243',addition:10106.14},
    {name:'S3',daysLet:0,building:60,woz:300000,readout:'305',addition:12684.66}
  ];
  try{
    const page=await openPage(browser,`http://127.0.0.1:${server.address().port}/`);
    for(const item of cases){
      await prepareSecondHome(page);
      await setField(page,'scenarioDaysLetNew',item.daysLet);
      await setField(page,'scenarioBuildingDaysNew',item.building);
      await page.evaluate(value=>{
        const el=document.getElementById('scenarioPropertyPrivateUseWozNew');
        el.value=String(value);
        el.dispatchEvent(new Event('input',{bubbles:true}));
        el.dispatchEvent(new Event('change',{bubbles:true}));
      },item.woz);
      await settle(page);
      const seen=await page.evaluate(()=>{
        const rules={
          propertyUse:'non-main',
          propertyUsePattern:document.getElementById('scenarioPropertyUsePatternNew')?.value,
          daysLet:Number(document.getElementById('scenarioDaysLetNew')?.value||0),
          buildingDays:Number(document.getElementById('scenarioBuildingDaysNew')?.value||0),
          privateUseDays:Number(document.getElementById('scenarioPropertyPrivateUseDaysNew')?.value||0),
          privateUseWozValue:Number(document.getElementById('scenarioPropertyPrivateUseWozNew')?.value||0),
          grossRentalIncomeAnnual:0,
          ownedAllCalendarYear:true
        };
        const schedule=window.Stage10Remediation.propertyIncomeSchedule({mode:'buy-rent',startYear:2026,startMonth:1,homeGrowthPct:0,purchaseRules:rules},12);
        return{readout:document.getElementById('scenarioOwnUseDaysReadout')?.value,addition:schedule.ownUseByYear[2026],profile:schedule.profile.profile};
      });
      assert.equal(seen.readout,item.readout,item.name);
      assert.equal(seen.profile,'p1',item.name);
      assert.ok(Math.abs(seen.addition-item.addition)<0.02,`${item.name} addition ${seen.addition}`);
    }
  }finally{
    await browser.close();
    server.close();
  }
});

test('R1 Mortgage tab has no offer-date field and does not say the NHG check failed',async()=>{
  const server=await serve();
  const browser=await chromium.launch({headless:true});
  try{
    const page=await openPage(browser,`http://127.0.0.1:${server.address().port}/`);
    await page.locator('.tab[data-tab="mortgage"]').click();
    await setField(page,'mortgageMode','purchase');
    await setField(page,'purchaseNhgMode','standard');
    for(const price of [400000,485000]){
      await setField(page,'housePrice',price);
      const status=await page.locator('#purchaseRuleStatus').innerText();
      assert.equal(await page.locator('#purchaseBindingOfferDate').count(),0,`offer date still on the Mortgage tab at €${price}`);
      assert.doesNotMatch(status,/does not pass/i,`€${price}: ${status}`);
      assert.match(status,/unavailable here/i);
    }
    assert.equal(await page.locator('#scenarioBindingOfferDateNew').count(),1);
    const fold=await page.locator('#purchaseCostDetails').innerText();
    assert.match(fold,/only one confirmed change is included/);
  }finally{
    await browser.close();
    server.close();
  }
});

test('B2 shows net interest as unavailable in 2027 and the visible taxable-pay field confirms a result',async()=>{
  const server=await serve();
  const browser=await chromium.launch({headless:true});
  try{
    const page=await openPage(browser,`http://127.0.0.1:${server.address().port}/`);
    await page.locator('.tab[data-tab="mortgage"]').click();
    await setField(page,'startYear',2027);
    await setField(page,'use30Ruling',true);
    const blocked=await page.evaluate(()=>({
      net:document.getElementById('mNetInterest')?.textContent,
      benefit:document.getElementById('mTaxBenefit')?.textContent,
      label:document.querySelector('label[for="grossAnnualIncome"]')?.textContent
    }));
    assert.equal(blocked.label,'Taxable yearly pay');
    assert.equal(blocked.benefit,'unavailable');
    assert.equal(blocked.net,'unavailable');
    await setField(page,'grossAnnualIncome',80000);
    const confirmed=await page.evaluate(()=>({
      net:document.getElementById('mNetInterest')?.textContent,
      benefit:document.getElementById('mTaxBenefit')?.textContent,
      gross:document.getElementById('mGrossInterest')?.textContent
    }));
    assert.notEqual(confirmed.benefit,'unavailable');
    assert.match(confirmed.benefit,/€/);
    assert.notEqual(confirmed.net,'unavailable');
    assert.notEqual(confirmed.net,confirmed.gross);
  }finally{
    await browser.close();
    server.close();
  }
});
