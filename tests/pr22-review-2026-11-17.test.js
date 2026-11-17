'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const PR=require('../purchase-rules.js');
const S10=require('../stage10-remediation.js');
const State=require('../app-state.js');

const root=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

test('F1 starter with undetermined erfpacht uses 2% of the price, not €0',()=>{
  const result=PR.calculatePurchase2026({
    housePrice:550000,
    ownSavings:0,
    baseCosts:0,
    transferTaxMode:'starter',
    appraisedValue:550000,
    nhgMode:'none',
    acquisitionYear:2026,
    yearlyCanon:2000,
    groundRentPerpetual:'dont-know'
  });
  assert.equal(result.transferTax.starterEligible,false);
  assert.equal(Math.round(result.transferTax.amount),11000);
  assert.match(result.transferTax.erfpachtNote||result.transferTax.warning||'',/standard 2% transfer tax/);
});

test('B1 blank age, out-of-range shares and undetermined canon do not grant a starter share of 0%',()=>{
  const blank=PR.jointAcquisitionTax({
    propertyValue:500000,
    buyers:[{share:50,age:'',mainHome:true},{share:50,age:40,mainHome:true}]
  });
  assert.equal(blank.available,false);
  assert.match(blank.line,/Enter an age to check the starter exemption|can't work out transfer tax/);

  const shares=PR.jointAcquisitionTax({
    propertyValue:500000,
    buyers:[{share:120,age:40,mainHome:true},{share:-20,age:40,mainHome:true}]
  });
  assert.equal(shares.available,false);
  assert.match(shares.line,/0% to 100%|add up to 100%/);

  const undetermined=PR.jointAcquisitionTax({
    propertyValue:500000,
    undetermined:true,
    buyers:[{share:50,age:30,mainHome:true,usedBefore:false},{share:50,age:30,mainHome:true,usedBefore:false}]
  });
  assert.equal(undetermined.available,true);
  assert.equal(Math.round(undetermined.amount),10000);
  assert.match(undetermined.line,/standard 2%|undetermined|ground rent/i);
});

test('B1 J8 UI shows a manual notary field and no automatic amount',()=>{
  assert.equal(typeof PR.mortgageTabTransfer,'function');
  const j8=PR.mortgageTabTransfer({housePrice:500000,transferTaxMode:'main',buying:'three',acquisitionYear:2026});
  assert.equal(j8.automatic,false);
  assert.equal(j8.amount,null);
  assert.equal(j8.manual,true);
  assert.equal(j8.label,'Transfer tax from your notary, €');
  assert.match(j8.line,/can't work out transfer tax/);
  const costs=read('purchase-costs.js');
  assert.match(costs,/Transfer tax from your notary, €/);
  assert.doesNotMatch(costs,/\|\|30/);
  assert.doesNotMatch(costs,/\|\|50/);
  assert.match(read('stage10-remediation.js'),/Buying alone or with someone\?/);
  assert.match(read('scenario-engine.js'),/scenarioBuyingWithNew|buyingWith/);
});

test('B4 a July start, 2028, fixed-term and rent with 300 own-use days are out of scope',()=>{
  const july=S10.propertyIncomeSchedule({
    startYear:2026,startMonth:7,homeGrowthPct:0,mode:'buy-rent',
    purchaseRules:{propertyUse:'non-main',privateUseDays:365,privateUseWozValue:300000,grossRentalIncomeAnnual:0}
  },6);
  assert.equal(july.profile.profile,'out-of-scope');
  assert.ok(!july.ownUseByYear[2026],`July own-use addition was ${july.ownUseByYear[2026]}`);
  assert.match(july.profile.message,/can't estimate Box 3 tax/);

  const year2028=S10.propertyIncomeSchedule({
    startYear:2028,startMonth:1,homeGrowthPct:0,mode:'buy-rent',
    purchaseRules:{propertyUse:'non-main',propertyUsePattern:'own-holiday',privateUseDays:365,privateUseWozValue:300000,ownedAllCalendarYear:true,grossRentalIncomeAnnual:0}
  },12);
  assert.equal(year2028.profile.profile,'out-of-scope');

  const fixed=S10.secondHomeProfile({
    propertyUsePattern:'long-term',fixedTermLease:true,grossRentalIncomeAnnual:12600,privateUseDays:0
  },{startYear:2026,startMonth:1});
  assert.equal(fixed.profile,'out-of-scope');

  const related=S10.secondHomeProfile({
    propertyUsePattern:'long-term',relatedPartyRent:true,grossRentalIncomeAnnual:12600,privateUseDays:0
  },{startYear:2026,startMonth:1});
  assert.equal(related.profile,'out-of-scope');

  const rent300=S10.secondHomeProfile({
    grossRentalIncomeAnnual:20000,privateUseDays:300,daysLet:0
  },{startYear:2026,startMonth:1});
  assert.notEqual(rent300.profile,'legacy');

  const stage10=read('stage10-remediation.js');
  assert.match(stage10,/scenarioPropertyUsePatternNew/);
  assert.match(stage10,/Let long-term to one tenant \(with rent protection\)/);
  assert.match(stage10,/LEEGWAARDE_LINE|leegwaarderatio/);
  assert.match(read('scenario-engine.js'),/relatedPartyRent/);
});

test('B2 E6/E7 UI keeps 2027 ruling pay unavailable instead of using gross as taxable',()=>{
  assert.equal(typeof State.rulingPayState,'function');
  const e6=State.rulingPayState({startYear:2027,use30Ruling:true,grossIncome:100000,taxablePay:null});
  assert.equal(e6.available,false);
  assert.equal(e6.taxable,null);
  assert.match(e6.line,/30% ruling: we can only convert your pay for 2026/);
  assert.equal(e6.inputLabel,'Taxable yearly pay');
  const e7=State.rulingPayState({startYear:2028,use30Ruling:true,grossIncome:80000,saved:true,taxablePay:''});
  assert.equal(e7.available,false);
  assert.match(e7.line,/30% ruling: we can only convert your pay for 2026/);
  const confirmed=State.rulingPayState({startYear:2027,use30Ruling:true,grossIncome:100000,taxablePay:70000,confirmed:true});
  assert.equal(confirmed.available,true);
  assert.equal(confirmed.taxable,70000);
});
