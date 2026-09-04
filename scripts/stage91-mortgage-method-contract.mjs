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
try{
  const url=`http://127.0.0.1:${server.address().port}/`;
  await page.goto(url,{waitUntil:'domcontentloaded'});await page.evaluate(()=>localStorage.clear());await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.Stage91Quality&&document.getElementById('scenarioSourceImported'));
  await page.locator('.tab[data-tab="mortgage"]').click();await page.locator('#linearCompare').click();await settle();
  assert.equal(await page.locator('#linearCompare').getAttribute('aria-pressed'),'true','Linear Mortgage card did not become active');
  await page.locator('.tab[data-tab="scenarios"]').click();await page.locator('#scenarioSourceImported').check();await settle();
  assert.equal(await page.locator('#scenarioMortgageMethodFresh').inputValue(),'linear','Initial Scenario import did not copy Linear');
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.Stage91Quality&&window.__DIMP_CANONICAL_COMPARISON);await settle();
  assert.equal(await page.locator('#linearCompare').getAttribute('aria-pressed'),'true','Main Mortgage method drifted after reload');
  await page.locator('.tab[data-tab="scenarios"]').click();await page.locator('#scenarioRefreshImport').click();await settle();
  assert.equal(await page.locator('#scenarioMortgageMethodFresh').inputValue(),'linear','Explicit Refresh imported a different mortgage method after reload');
  if(errors.length)throw new Error(`Browser page errors:\n${errors.join('\n\n')}`);
  console.log(JSON.stringify({stage:'R6.6 Stage 9.1',mortgageMethod:'linear',initialImport:true,reloadPreserved:true,refreshPreserved:true,pageErrors:0},null,2));
  console.log('Stage 9.1 mortgage-method import persistence contract passed.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
