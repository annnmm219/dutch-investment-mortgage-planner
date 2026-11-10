'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const PR=require('../purchase-rules.js');
const S10=require('../stage10-remediation.js');
const State=require('../app-state.js');
const Policy=require('../policy-2026.js');

const ROOT=path.join(__dirname,'..');
const NOTE_2026='Includes 17 × your yearly ground rent in the value test (€555,000 limit in 2026).';
const NOTE_2027='Includes 17 × your yearly ground rent in the value test (€615,000 limit for transfers from 1 Jan 2027).';
const UNDETERMINED='We can\'t tell whether the starter exemption applies, because it depends on the ground rent (erfpacht) details. This estimate uses the standard 2% transfer tax. Your notary can confirm.';
const NHG_WARNING='Your cost total is lower than the purchase price or appraisal, so the NHG check can\'t run. Enter the full cost total to see the NHG estimate.';

function starterPurchase(overrides={}){
  return S10.calculateScenarioPurchase2026({
    purchaseType:'existing-home',
    housePrice:550000,
    appraisedValue:550000,
    downPayment:200000,
    availableSavings:400000,
    baseCosts:0,
    transferTaxMode:'starter',
    buyerAge:30,
    starterMainResidence:true,
    starterExemptionUnused:true,
    nhgMode:'none',
    acquisitionYear:2026,
    yearlyCanon:2000,
    groundRentBoughtOff:false,
    groundRentPerpetual:'yes',
    ...overrides
  });
}

test('erfpacht 17x pushes a 2026 transfer over the €555,000 starter ceiling',()=>{
  const result=starterPurchase();
  assert.equal(result.transferTax.starterEligibility.eligible,false);
  assert.equal(result.transferTax.starterEligibility.starterLimit,555000);
  assert.equal(result.transferTax.starterEligibility.propertyValue,584000);
  assert.ok(result.transferTax.amount>0);
  assert.equal(result.transferTax.erfpachtNote,'');
});

test('unconfirmed perpetual ground rent does not auto-award the starter exemption',()=>{
  for(const perpetual of ['no','dont-know']){
    const result=starterPurchase({groundRentPerpetual:perpetual});
    assert.equal(result.transferTax.starterEligibility.undetermined,true);
    assert.equal(result.transferTax.starterEligibility.eligible,false);
    assert.equal(result.transferTax.amount,11000);
    assert.equal(result.transferTax.erfpachtNote,UNDETERMINED);
    assert.equal(result.transferTax.warning,UNDETERMINED);
    assert.ok(result.warnings.includes(UNDETERMINED));
  }
});

test('a notary capitalised amount replaces 17 times the yearly ground rent',()=>{
  const notary=starterPurchase({notaryCapitalisedCanon:4000});
  assert.equal(notary.transferTax.starterEligibility.eligible,true);
  assert.equal(notary.transferTax.starterEligibility.propertyValue,554000);
  assert.equal(notary.transferTax.amount,0);
  assert.equal(notary.transferTax.erfpachtNote,'');
  const seventeen=starterPurchase();
  assert.equal(seventeen.transferTax.starterEligibility.propertyValue,584000);
  assert.equal(seventeen.transferTax.starterEligibility.eligible,false);
});

test('an optional unencumbered value caps price plus capitalised canon',()=>{
  const capped=PR.applyStarterWithErfpacht({
    price:540000,appraisal:540000,buyerAge:30,yearlyCanon:2000,perpetual:'yes',acquisitionYear:2026,unencumberedValue:550000
  });
  assert.equal(capped.tested.uncapped,574000);
  assert.equal(capped.tested.value,550000);
  assert.equal(capped.eligible,true);
  assert.equal(capped.starterLimit,555000);
  const open=PR.applyStarterWithErfpacht({
    price:540000,appraisal:540000,buyerAge:30,yearlyCanon:2000,perpetual:'yes',acquisitionYear:2026
  });
  assert.equal(open.tested.value,574000);
  assert.equal(open.eligible,false);
});

test('31 Dec 2026 uses €555,000 and the 2026 note; 1 Jan 2027 uses €615,000 and the 2027 note',()=>{
  const within={housePrice:520000,appraisedValue:520000,yearlyCanon:1000};
  const on2026=starterPurchase({...within,notaryTransferDate:'2026-12-31',acquisitionYear:2026});
  assert.equal(on2026.transferTax.starterEligibility.starterLimit,555000);
  assert.equal(on2026.transferTax.starterEligibility.eligible,true);
  assert.equal(on2026.transferTax.starterEligibility.propertyValue,537000);
  assert.equal(on2026.transferTax.erfpachtNote,NOTE_2026);
  const on2027=starterPurchase({...within,notaryTransferDate:'2027-01-01',acquisitionYear:2026});
  assert.equal(on2027.transferTax.starterEligibility.starterLimit,615000);
  assert.equal(on2027.transferTax.starterEligibility.eligible,true);
  assert.equal(on2027.transferTax.erfpachtNote,NOTE_2027);
});

test('a 2026 purchase year with a 2027 notary transfer uses the €615,000 ceiling',()=>{
  const result=starterPurchase({
    housePrice:580000,appraisedValue:580000,acquisitionYear:2026,notaryTransferDate:'2027-01-01'
  });
  assert.equal(result.transferTax.starterEligibility.acquisitionYear,2027);
  assert.equal(result.transferTax.starterEligibility.starterLimit,615000);
  assert.equal(result.transferTax.starterEligibility.propertyValue,614000);
  assert.equal(result.transferTax.starterEligibility.eligible,true);
  assert.equal(result.transferTax.erfpachtNote,NOTE_2027);
  assert.equal(PR.starterLimitForAcquisitionYear(2026),555000);
  assert.equal(PR.transferYear({notaryTransferDate:'',acquisitionYear:2026}),2026);
});

test('manual transfer tax still overrides an undetermined erfpacht estimate',()=>{
  const result=starterPurchase({transferTaxMode:'manual',manualTransferTax:1234,groundRentPerpetual:'dont-know'});
  assert.equal(result.transferTax.amount,1234);
  assert.equal(result.transferTax.mode,'manual');
  assert.equal(result.transferTax.erfpachtNote,'');
});

test('erfpacht and NHG notes and the new input labels are exact',()=>{
  assert.equal(PR.ERFPACHT_INCLUDED_NOTE_2026,NOTE_2026);
  assert.equal(PR.ERFPACHT_INCLUDED_NOTE_FROM_2027,NOTE_2027);
  assert.equal(PR.ERFPACHT_STARTER_UNDETERMINED_NOTE,UNDETERMINED);
  assert.equal(S10.NHG_COST_STACK_BELOW_REFERENCE_WARNING,NHG_WARNING);
  const engine=fs.readFileSync(path.join(ROOT,'scenario-engine.js'),'utf8');
  const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  for(const label of [
    'Yearly ground rent (canon), €',
    'Ground rent bought off?',
    'Perpetual and not tied to anyone\'s lifetime?',
    'Capitalised ground rent from your notary, €',
    'Notary transfer date (levering)'
  ])assert.ok(engine.includes(`>${label}<`),label);
  assert.match(engine,/>don't know</);
  assert.ok(html.includes('Proposed regime, not law. The Wet werkelijk rendement box 3 (36748) passed the Tweede Kamer (12 Feb 2026).'));
  assert.ok(html.includes('Figures as of 10 Nov 2026.'));
  assert.ok(html.includes('Rules for 2027 and later are not yet included'));
});

test('30% ruling keeps the €78,600 cap and applies the 2026 salary threshold',()=>{
  assert.equal(Policy.VALUES.thirtyPercentRuling.maxTaxFreeAllowance,78600);
  assert.equal(Policy.VALUES.thirtyPercentRuling.taxableSalaryThreshold,48013);
  assert.equal(Policy.VALUES.thirtyPercentRuling.taxableSalaryThresholdUnder30Masters,36497);
  assert.equal(State.estimateTaxableIncome2026({grossIncome:48013,use30Ruling:true}),48013);
  assert.equal(State.estimateTaxableIncome2026({grossIncome:50000,use30Ruling:true}),48014);
  assert.equal(State.estimateTaxableIncome2026({grossIncome:60000,use30Ruling:true}),48014);
  assert.equal(State.estimateTaxableIncome2026({grossIncome:50000,use30Ruling:true,under30WithMasters:true}),36498);
  assert.equal(State.estimateTaxableIncome2026({grossIncome:36497,use30Ruling:true,under30WithMasters:true}),36497);
  assert.equal(State.estimateTaxableIncome2026({grossIncome:84000,use30Ruling:true}),58800);
  assert.equal(State.estimateTaxableIncome2026({grossIncome:300000,use30Ruling:true}),221400);
  assert.equal(Policy.THIRTY_PERCENT_RULING_NOTICE,'In 2026 the ruling applies only if taxable salary after the tax-free allowance is more than €48,013, or more than €36,497 if you are under 30 and have a Dutch or equivalent foreign master\'s. Below the applicable amount, the planner applies no reduction. If a full 30% would take taxable salary to or below that amount, only the part that leaves taxable salary just above the threshold counts. Your jaaropgaaf remains authoritative.');
  assert.equal(Policy.VALUES.futureBox3Proposal.exempt,1800);
  assert.equal(Policy.VALUES.futureBox3Proposal.taxRate,.36);
  assert.equal(Policy.LAST_VERIFIED_AT,'2026-10-27');
});
