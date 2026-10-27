'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Policy=require('../policy-2026.js');
const FC=require('../finance-core.js');
const PR=require('../purchase-rules.js');
const State=require('../app-state.js');

const ROOT=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');

const LICENSE_TEXT=`Copyright © 2026 An Tu. All rights reserved.

This software and its source code, documentation and content are proprietary. You may not copy, modify, distribute, sublicense, sell or use any part of it, except as needed to view or run the published web app or as allowed by mandatory law, without the copyright holder's prior written permission. A public repository does not grant an open-source licence.

NO WARRANTY. The software is provided "as is" and "as available", without warranty of any kind, express or implied, including accuracy, fitness for a particular purpose and non-infringement. To the fullest extent permitted by law, the copyright holder is not liable for any loss or damage arising from its use.

NOT FINANCIAL ADVICE. The software produces simplified planning estimates. It is not financial, tax, investment or mortgage advice within the meaning of the Dutch Financial Supervision Act (Wft), and it does not assess what a lender would let you borrow. Tax rules are simplified and dated. Consult an AFM-licensed adviser or the Belastingdienst before making decisions.
`;

const FOOTER_LINE='© 2026 An Tu. All rights reserved. Provided as is, without warranty. Planning estimates only, not financial, tax or mortgage advice.';
const BORROWING_NOTICE='This planner does not check how much a lender would let you borrow. It does not apply Nibud income limits (LTI) or a lender\'s own assessment. For your maximum mortgage, ask a lender or an AFM-licensed mortgage adviser.';
const HEADER_NOTICE='Planning estimates only, not financial, tax or mortgage advice. Rules simplified, as of 27 Oct 2026.';
const RESULT_NOTICE='Estimate based on your assumptions and simplified 2026 rules. Not a recommendation or a tax calculation.';
const FUTURE_WARNING='Proposed regime, not law. The Wet werkelijk rendement box 3 passed the Tweede Kamer (Feb 2026). The Eerste Kamer has not voted, and a pending amendment (novelle) would lower the tax-free result to €1,000 and tax shares and bonds only when sold. This scenario taxes yearly growth and may not match the final law. Figures as of 27 Oct 2026.';

function withoutDetails(html){
  let out='',i=0,depth=0;
  const lower=html.toLowerCase();
  while(i<html.length){
    if(lower.startsWith('<details',i)&&/[\s>/]/.test(html[i+8]||'>')){depth++;i+=8;continue;}
    if(depth&&lower.startsWith('</details>',i)){depth--;i+=10;continue;}
    if(!depth)out+=html[i];
    i++;
  }
  return out;
}

function walk(dir,acc=[]){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(entry.name==='node_modules'||entry.name==='.git')continue;
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())walk(full,acc);
    else if(/\.(html|css|js|mjs)$/.test(entry.name))acc.push(full);
  }
  return acc;
}

function externalAssetRefs(file,source){
  const refs=[];
  const consider=url=>{
    if(!/^https?:\/\//i.test(url))return;
    if(/localhost|127\.0\.0\.1|w3\.org/i.test(url))return;
    refs.push(`${path.relative(ROOT,file)} -> ${url}`);
  };
  if(file.endsWith('.html')){
    for(const match of source.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi))consider(match[1]);
    for(const match of source.matchAll(/<link\b[^>]*>/gi)){
      const href=/href\s*=\s*["']([^"']+)["']/i.exec(match[0]);
      const rel=/rel\s*=\s*["']([^"']+)["']/i.exec(match[0]);
      if(href&&/stylesheet|preload|icon|font|manifest/i.test(rel?.[1]||''))consider(href[1]);
    }
    for(const match of source.matchAll(/<(?:img|video|audio|source|iframe)\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi))consider(match[1]);
  }
  if(file.endsWith('.css')||file.endsWith('.html')){
    for(const match of source.matchAll(/url\(\s*["']?(https?:\/\/[^"')\s]+)/gi))consider(match[1]);
    for(const match of source.matchAll(/@import\s+["'](https?:\/\/[^"']+)/gi))consider(match[1]);
  }
  if(/\.(js|mjs)$/.test(file)){
    for(const match of source.matchAll(/(?:import\s*\(\s*|new\s+(?:Shared)?Worker\s*\(\s*)["'](https?:\/\/[^"']+)/g))consider(match[1]);
    for(const match of source.matchAll(/\.src\s*=\s*["'](https?:\/\/[^"']+)/g))consider(match[1]);
    for(const match of source.matchAll(/<script\b[^>]*\bsrc\s*=\s*["'](https?:\/\/[^"']+)/gi))consider(match[1]);
    for(const match of source.matchAll(/<link\b[^>]*href\s*=\s*["'](https?:\/\/[^"']+)["'][^>]*rel\s*=\s*["'](?:stylesheet|preload|font)/gi))consider(match[1]);
  }
  return refs;
}

function writtenStorageKeys(){
  const keys=new Set();
  for(const file of walk(ROOT)){
    const source=fs.readFileSync(file,'utf8');
    const constants=new Map();
    for(const match of source.matchAll(/const\s+([A-Z0-9_]+)\s*=\s*(['"])([^'"]+)\2/g))constants.set(match[1],match[3]);
    for(const match of source.matchAll(/(?:localStorage|\bstorage)\.setItem\(\s*(['"])([^'"]+)\1/g))keys.add(match[2]);
    for(const match of source.matchAll(/(?:localStorage|\bstorage)\.setItem\(\s*([A-Z0-9_]+)/g)){
      if(constants.has(match[1]))keys.add(constants.get(match[1]));
    }
  }
  return [...keys];
}

function memoryStorage(keys){
  const data=new Map(keys.map(key=>[key,'saved']));
  return {
    get length(){return data.size;},
    key(index){return [...data.keys()][index]??null;},
    getItem(key){return data.has(key)?data.get(key):null;},
    setItem(key,value){data.set(key,String(value));},
    removeItem(key){data.delete(key);}
  };
}

function ageInDays(iso,now=new Date()){
  const verified=Date.parse(`${iso}T00:00:00Z`);
  const today=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate());
  return (today-verified)/86400000;
}

test('published page makes no external asset request',()=>{
  const refs=walk(ROOT).flatMap(file=>externalAssetRefs(file,fs.readFileSync(file,'utf8')));
  assert.deepEqual(refs,[]);
});

test('policy verification age stays inside the single 365-day constant',()=>{
  assert.equal(Policy.MAX_POLICY_VERIFIED_AGE_DAYS,365);
  assert.ok(ageInDays(Policy.LAST_VERIFIED_AT)<=Policy.MAX_POLICY_VERIFIED_AGE_DAYS);
  Policy.ITEMS.forEach(item=>{
    assert.equal(item.lastVerifiedAt,Policy.LAST_VERIFIED_AT);
    assert.ok(ageInDays(item.lastVerifiedAt)<=Policy.MAX_POLICY_VERIFIED_AGE_DAYS,item.key);
  });
  Object.values(Policy.SOURCES).forEach(source=>{
    assert.ok(ageInDays(source.lastVerifiedAt)<=Policy.MAX_POLICY_VERIFIED_AGE_DAYS,source.sourceTitle);
  });
});

test('LICENSE, copyright footer and borrowing notice are present and outside any fold',()=>{
  assert.equal(read('LICENSE'),LICENSE_TEXT);
  assert.equal(require('../package.json').license,'UNLICENSED');
  const html=read('index.html');
  const visible=withoutDetails(html);
  assert.match(visible,new RegExp(FOOTER_LINE.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(visible,/released 3 Sep 2026/);
  assert.match(visible,/Rules verified 27 Oct 2026/);
  assert.match(visible,new RegExp(BORROWING_NOTICE.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(visible,new RegExp(HEADER_NOTICE.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.equal([...visible.matchAll(new RegExp(RESULT_NOTICE.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'))].length,2);
  assert.doesNotMatch(html,/ANTU Group/);
  assert.doesNotMatch(read('LICENSE'),/ANTU Group/);
  const borrowingAt=html.indexOf('id="borrowingCapacityNotice"');
  const scheduleAt=html.indexOf('<summary>Mortgage payment schedule</summary>');
  assert.ok(borrowingAt>0&&borrowingAt<scheduleAt);
});

test('approved not-advice, proposed-regime and source label copy is exact',()=>{
  const html=read('index.html');
  assert.match(html,/id="headerNotAdvice"/);
  assert.match(html,/<strong>What this tool is\.<\/strong> This planner is a general calculation model\./);
  assert.match(html,/id="futureLawWarning"[\s\S]*Proposed regime, not law\./);
  assert.ok(html.includes(FUTURE_WARNING.replace('Proposed regime, not law. ','Proposed regime, not law.</strong> ')));
  assert.match(html,/<a href="https:\/\/www\.afm\.nl\/nl-nl\/sector\/registers">https:\/\/www\.afm\.nl\/nl-nl\/sector\/registers<\/a>/);
  assert.match(html,/<a href="https:\/\/whathemortgage\.com\/"[^>]*>whathemortgage\.com<\/a>/);
  assert.doesNotMatch(html,/WhatTheMortgage/);
  assert.match(read('scenario-engine.js'),/id="scenarioResultDisclaimer">Estimate based on your assumptions and simplified 2026 rules\. Not a recommendation or a tax calculation\./);
  assert.match(read('next-euro.js'),/id="nextEuroResultDisclaimer">Estimate based on your assumptions and simplified 2026 rules\. Not a recommendation or a tax calculation\./);
  const state=read('app-state.js');
  assert.match(state,/<strong>Saved in this browser only:<\/strong> your inputs stay on this device \(localStorage\) and are not sent to us or to any third party\. Our web host sees standard request logs \(e\.g\. IP address\)\./);
  assert.match(state,/<strong>Data handling\.<\/strong> There is no account and no planner server\. Your inputs are stored only in this browser's localStorage so they survive a refresh, and they are never uploaded\. "Reset examples" deletes them\. You can also clear site data in your browser\. All code, including the chart library, is served from this site\. No third-party requests, analytics or tracking cookies\. Our web host keeps standard request logs \(e\.g\. IP address\)\./);
});

test('Reset examples clears every planner storage key the source writes',()=>{
  const keys=writtenStorageKeys();
  assert.ok(keys.includes('dutch-investment-mortgage-planner:r6'));
  assert.ok(keys.includes('dimp.stage91.scenario-state.v1'));
  assert.ok(keys.includes('dimp.stage91.main-mortgage-type.v1'));
  assert.ok(keys.includes('dimp.stage10.scenario-state.v1'));
  assert.ok(keys.includes('dimp-model-meta'));
  assert.ok(keys.includes('dimp-r64-jan1-confirmed'));
  keys.forEach(key=>assert.match(key,State.PLANNER_STORAGE_KEY_PATTERN,key));
  const storage=memoryStorage([...keys,'unrelated-app']);
  State.clearPlannerStorage(storage);
  keys.forEach(key=>assert.equal(storage.getItem(key),null,key));
  assert.equal(storage.getItem('unrelated-app'),'saved');
  assert.match(read('app-state.js'),/function safeRemove\(\)\{if\(!storageWorks\)return;try\{clearPlannerStorage\(storage\);\}/);
});

test('starter exemption uses €555,000 through 2026 and €615,000 from January 2027',()=>{
  assert.equal(PR.starterLimitForAcquisitionYear(),555000);
  assert.equal(PR.starterLimitForAcquisitionYear(2026),555000);
  assert.equal(PR.starterLimitForAcquisitionYear(2027),615000);
  assert.equal(PR.transferTax2026({propertyValue:555000,mode:'starter'}).starterEligible,true);
  assert.equal(PR.transferTax2026({propertyValue:555001,mode:'starter'}).starterEligible,false);
  assert.match(PR.transferTax2026({propertyValue:555001,mode:'starter'}).warning,/€555,000 in 2026/);
  assert.equal(PR.transferTax2026({propertyValue:615000,mode:'starter',acquisitionYear:2026}).starterEligible,false);
  const from2027=PR.transferTax2026({propertyValue:615000,mode:'starter',acquisitionYear:2027});
  assert.equal(from2027.amount,0);
  assert.equal(from2027.starterEligible,true);
  const above2027=PR.transferTax2026({propertyValue:615001,mode:'starter',acquisitionYear:2027});
  assert.equal(above2027.starterEligible,false);
  assert.match(above2027.warning,/€615,000 in 2027/);
  assert.doesNotMatch(above2027.warning,/2026/);
  assert.equal(PR.starterEligibility2026({buyerAge:30,mainResidence:true,exemptionUnused:true,propertyValue:555000}).eligible,true);
  assert.equal(PR.starterEligibility2026({buyerAge:30,mainResidence:true,exemptionUnused:true,propertyValue:615000,acquisitionYear:2027}).eligible,true);
  assert.equal(PR.starterEligibility2026({buyerAge:30,mainResidence:true,exemptionUnused:true,propertyValue:615001,acquisitionYear:2027}).eligible,false);
  assert.equal(Policy.VALUES.transferTax.starterExemptionValueLimit,555000);
  assert.equal(Policy.VALUES.transferTax.starterExemptionValueLimitFrom2027,615000);
  assert.match(Policy.SOURCES.starterExemption2027.sourceUrl,/stcrt-2025-40375/);
});

test('Box 3 provisional rates, Hillen planning series and proposed regime defaults stay put',()=>{
  assert.equal(Policy.getItem('box3.savingsDeemedRate').status,'provisional');
  assert.equal(Policy.getItem('box3.debtDeemedRate').status,'provisional');
  assert.match(Policy.getItem('box3.savingsDeemedRate').notes,/Recheck in Q1 2027/);
  assert.match(Policy.getItem('box3.debtDeemedRate').notes,/Recheck in Q1 2027/);
  assert.equal(Policy.getItem('hillen.planningAnnualReductionAfter2026').status,'planning-series');
  assert.equal(Policy.VALUES.box3.savingsDeemedRate,.0128);
  assert.equal(Policy.VALUES.box3.debtDeemedRate,.027);
  assert.equal(Policy.VALUES.futureBox3Proposal.taxRate,.36);
  assert.equal(Policy.VALUES.futureBox3Proposal.exempt,1800);
  assert.equal(Policy.VALUES.futureBox3Proposal.alternativeExempt,1000);
  assert.equal(Policy.VALUES.futureBox3Proposal.lossThreshold,500);
  assert.equal(Policy.VALUES.futureBox3Proposal.startYear,2028);
  assert.equal(Policy.VALUES.futureBox3Proposal.status,'proposed');
  assert.equal(FC.appliedOwnHomeDeductionRate({grossIncome:60000}),Policy.VALUES.box1.ownHomeDeductionMaxRate);
  assert.equal(String(FC.appliedOwnHomeDeductionRate({grossIncome:30000})*100),'35.75');
  const state=read('app-state.js');
  assert.match(state,/if\(auto&&FC\)\{const income=parseFlexibleNumber\(\$\('grossIncome'\)\?\.value\)\|\|0;manual\.value=String\(FC\.appliedOwnHomeDeductionRate\(\{mode:'auto',grossIncome:income\}\)\*100\);\}/);
  assert.match(state,/manualRate\|\|window\.Policy2026\.VALUES\.box1\.ownHomeDeductionMaxRate\*100/);
  assert.match(read('index.html'),/id="futureExemptAltPreset"/);
  assert.match(read('index.html'),/value="1800"/);
});
