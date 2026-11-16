'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
require('../box1-2026.js');
require('../logic-integrity-ui.js');
const FC=require('../finance-core.js');
const PR=require('../purchase-rules.js');
const SC=require('../scenario-engine.js');
const NE=require('../next-euro.js');
const S91=require('../stage9-1-remediation.js');
const S10=require('../stage10-remediation.js');
const State=require('../app-state.js');
const OI=require('../output-integrity.js');
const Box1=require('../box1-2026.js');

function close(actual,expected,tolerance=0.02,message=''){
  assert.ok(Math.abs(actual-expected)<=tolerance,`${message} expected ${expected}, got ${actual}`);
}

function box3(extra={}){
  return {mode:'current',taxPartners:1,paySource:'external',currentTaxRate:.36,currentAllowance:59357,currentNotional:.06,currentSavingsNotional:.0128,currentDebtNotional:.027,currentDebtThreshold:3800,savings:0,debt:0,savingsReturnPct:2,debtInterestPct:0,debtMonthlyRepayment:0,debtRepaymentSource:'external',debtFallbackDestination:'invest',futureStart:2029,futureTaxRate:.36,futureExempt:1800,futureLossThreshold:500,...extra};
}

test('A1 Next € headline, €500 row and CSV share one break-even for every override',()=>{
  const config={
    mode:'mortgage-invest',horizonYears:10,investmentReturnPct:5,startYear:2026,startMonth:1,startPortfolio:0,
    mortgageType:'annuity',mortgage:{balance:300000,ratePct:4,years:25},
    tax:{enabled:true,calculationMode:'box1-2026',box1IncomeBeforeOwnHome:60000,wozValue:400000,hraRemainingMonths:300,qualifyingInterestFraction:1},
    box3:box3({mode:'current',savings:0,firstJan1Portfolio:0}),
    mortgageInvest:{extraMonthly:500},commonMonthlyInvestment:0,vveMonthly:0,maintenanceAnnual:0,ownerTaxesAnnual:0,insuranceAnnual:0,groundLeaseAnnual:0
  };
  const effective=(Math.pow(1+.04/12,12)-1)*100;
  for(const hraTreatment of ['planner','on','off']){
    for(const box3Treatment of ['planner','current','none']){
      const analysis=NE.analyseNextEuro(config,{amount:500,years:10,assumedReturnPct:5,hraTreatment,box3Treatment,quickAmounts:[250,500,1000]});
      const canonical=OI.canonicalNextEuroResult(analysis);
      const row=analysis.quick.find(item=>item.amount===500);
      close(analysis.main.breakEven,row.breakEven,1e-9,`${hraTreatment}/${box3Treatment}`);
      close(canonical.breakEvenReturnPct,analysis.main.breakEven,1e-9,`${hraTreatment}/${box3Treatment} csv`);
      assert.equal(analysis.leaderRanges,analysis.main.leaderRanges);
    }
  }
  const off=NE.analyseNextEuro(config,{amount:500,years:10,hraTreatment:'off',box3Treatment:'none',quickAmounts:[500]});
  close(off.main.breakEven,effective,.02,'ignore HRA and Box 3');
});

test('A2 LTV uses the appraisal and reports the cash gap',()=>{
  const ltv=PR.ltv2026({mortgageAmount:558000,appraisedValue:520000});
  close(ltv.percentage,107.3076923,.001);
  assert.equal(ltv.cashGap,38000);
  assert.equal(ltv.ownFundsNeeded,38000);
});

test('A3 and T2-2 manual 0% deduction is not replaced by 37.56%',()=>{
  assert.equal(State.manualDeductionPercent('0'),0);
  assert.equal(State.manualDeductionPercent(''),37.56);
  const schedule=FC.mortgageSchedule({balance:300000,annualRatePct:4,termYears:25,type:'annuity',months:12,startYear:2026,startMonth:1,tax:{enabled:true,calculationMode:'manual-rate',deductionRate:0,wozValue:400000,hraRemainingMonths:300,qualifyingInterestFraction:1}});
  assert.equal(schedule.totalTaxBenefit,0);
});

test('A4 transfer tax uses one capitalised value on every rate and both routes',()=>{
  const shared={housePrice:550000,appraisedValue:550000,price:550000,appraisal:550000,yearlyCanon:2000,groundRentPerpetual:'yes',groundRentBoughtOff:false,buyerAge:30,starterMainResidence:true,starterExemptionUnused:true,nhgMode:'none',acquisitionYear:2026,downPayment:200000,availableSavings:400000,baseCosts:0,ownSavings:400000};
  for(const mode of ['starter','main','other-home']){
    const scenario=S10.calculateScenarioPurchase2026({...shared,transferTaxMode:mode,purchaseType:'existing-home'});
    const mortgage=PR.calculatePurchase2026({...shared,transferTaxMode:mode});
    assert.equal(scenario.transferTaxBase,584000,mode);
    assert.equal(mortgage.transferTaxBase,584000,mode);
    assert.equal(scenario.transferTax.amount,mortgage.transferTax.amount,mode);
  }
  assert.equal(S10.calculateScenarioPurchase2026({...shared,transferTaxMode:'other-home',purchaseType:'existing-home'}).transferTax.amount,46720);
  assert.equal(S10.calculateScenarioPurchase2026({...shared,transferTaxMode:'main',purchaseType:'existing-home'}).transferTax.amount,11680);
});

test('B5 keeps 8% in 2027 and shows the not-law note',()=>{
  const note=PR.residentialNonMainProposalNote({transferTaxMode:'other-home',notaryTransferDate:'2027-01-15',acquisitionYear:2026});
  assert.equal(note,PR.TRANSFER_2027_NOTE);
  assert.equal(PR.residentialNonMainProposalNote({transferTaxMode:'other-home',notaryTransferDate:'2026-12-15'}), '');
  assert.equal(PR.residentialNonMainProposalNote({transferTaxMode:'main',notaryTransferDate:'2027-06-01'}), '');
  const taxed=PR.transferTax2026({propertyValue:400000,mode:'other-home',acquisitionYear:2027});
  assert.equal(taxed.amount,32000);
  const erfpacht=S10.calculateScenarioPurchase2026({purchaseType:'existing-home',housePrice:550000,appraisedValue:550000,yearlyCanon:2000,groundRentPerpetual:'yes',transferTaxMode:'other-home',notaryTransferDate:'2027-03-01',nhgMode:'none',downPayment:100000,availableSavings:400000,baseCosts:0});
  assert.equal(erfpacht.transferTax.amount,46720);
  assert.equal(erfpacht.transferTax.proposalNote,PR.TRANSFER_2027_NOTE);
});

test('joint buyers J1–J8 use per-share rates and do not invent a third-buyer figure',()=>{
  const j1=PR.jointAcquisitionTax({propertyValue:500000,buyers:[{share:50,age:30,mainHome:true},{share:50,age:40,mainHome:true}]});
  assert.equal(j1.amount,5000);
  const j2=PR.jointAcquisitionTax({propertyValue:500000,buyers:[{share:50,age:30,mainHome:true},{share:50,age:32,mainHome:true}]});
  assert.equal(j2.amount,0);
  const j3=PR.jointAcquisitionTax({propertyValue:600000,buyers:[{share:50,age:30,mainHome:true},{share:50,age:33,mainHome:true}]});
  assert.equal(j3.amount,12000);
  const j4=PR.jointAcquisitionTax({propertyValue:600000,notaryTransferDate:'2027-01-15',buyers:[{share:50,age:30,mainHome:true},{share:50,age:40,mainHome:true}]});
  assert.equal(j4.amount,6000);
  const j5=PR.jointAcquisitionTax({propertyValue:500000,buyers:[{share:30,age:30,mainHome:true},{share:70,age:40,mainHome:true}]});
  assert.equal(j5.amount,7000);
  const j6=PR.jointAcquisitionTax({propertyValue:500000,buyers:[{share:50,age:30,mainHome:true},{share:50,age:40,mainHome:false}]});
  assert.equal(j6.amount,20000);
  const j7=PR.jointAcquisitionTax({propertyValue:555000,buyers:[{share:50,age:30,mainHome:true},{share:50,age:31,mainHome:true}]});
  assert.equal(j7.amount,0);
  const j8=PR.jointAcquisitionTax({propertyValue:500000,buyerCount:3});
  assert.equal(j8.available,false);
  assert.equal(j8.line,PR.JOINT_UNAVAILABLE);
  assert.equal(j8.line.includes('lender')||j8.line.includes('adviser'),false);
});

test('NHG non-main, 2026/2027 tables and the €480,000 case',()=>{
  const blocked=S10.nhg2026Exact({purchasePrice:300000,appraisedValue:300000,mortgageAmount:250000,mode:'standard',nonEnergyCostStack:300000,propertyUse:'non-main'});
  assert.equal(blocked.eligible,false);
  assert.equal(blocked.fee,0);
  assert.equal(blocked.code,'nhg-non-main');
  const pass=S10.nhg2026Exact({purchasePrice:400000,appraisedValue:400000,mortgageAmount:300000,mode:'standard',nonEnergyCostStack:410000,propertyUse:'main-residence',offerDate:'2026-06-01'});
  assert.equal(pass.eligible,true);
  assert.equal(pass.fee,1200);
  const y2026=S10.nhg2026Exact({purchasePrice:480000,appraisedValue:480000,mortgageAmount:480000,mode:'standard',nonEnergyCostStack:480000,propertyUse:'main-residence',offerDate:'2026-06-01'});
  const y2027=S10.nhg2026Exact({purchasePrice:480000,appraisedValue:480000,mortgageAmount:480000,mode:'standard',nonEnergyCostStack:480000,propertyUse:'main-residence',offerDate:'2027-02-01'});
  assert.equal(y2026.eligible,false);
  assert.equal(y2027.eligible,true);
  assert.equal(y2027.fee,1920);
  const order=S10.nhg2026Exact({purchasePrice:400000,appraisedValue:400000,mortgageAmount:300000,mode:'standard',nonEnergyCostStack:400000,propertyUse:'main-residence',offerDate:'2027-02-20',notaryTransferDate:'2027-01-31'});
  assert.equal(order.code,'nhg-date-order');
  assert.equal(order.eligible,false);
});

test('T3-6 to T3-8 January purchase and sale use the 1 January balances',()=>{
  function run(mode,extra){
    return SC.runScenario({
      mode,horizonYears:1,startYear:2026,startMonth:1,investmentReturnPct:7,startPortfolio:100000,
      mortgage:{balance:100000,ratePct:4,years:20},mortgageType:'annuity',
      tax:{enabled:true,calculationMode:'manual-rate',deductionRate:.3756,wozValue:300000,hraRemainingMonths:360,qualifyingInterestFraction:1},
      box3:box3({savings:100000}),
      purchaseRules:{enabled:true,propertyUse:'main-residence',transferTaxMode:'main',appraisedValue:300000,nhgMode:'none',hraRemainingMonths:360,qualifyingInterestFraction:1},
      upfrontCashTreatment:'savings',homeGrowthPct:0,rentGrowthPct:0,sellingCostPct:0,ownerCostMode:'total',ownerCostTotalMonthly:0,
      buyRent:{price:300000,purchaseCosts:0,cash:100000,downPayment:50000,monthlyRent:1500,mortgageRatePct:4,mortgageYears:30,mortgageType:'annuity',wozValue:300000},
      sellRent:{homeValue:150000,monthlyRent:1000,wozValue:150000},
      ...extra
    });
  }
  const buy=run('buy-rent');
  close(buy.A.box3,1842.99,.02,'buyer');
  close(buy.B.box3,1842.99,.02,'renter');
  assert.equal(buy.A.box3Years[2026].jan1Savings,100000);
  assert.equal(buy.A.box3Years[2026].jan1Portfolio,100000);
  const sale=run('sell-rent');
  close(sale.B.box3,1842.99,.02,'sale');
  assert.equal(sale.B.box3Years[2026].jan1Portfolio,100000);
  assert.ok(sale.B.box3Years[2026].jan1Portfolio<150000);
});

test('T4-2 private-use addition is €10,106.14 and T4-1 overlap is blocked',()=>{
  close(S10.privateUseAddition({woz:300000,ownUseDays:243,year:2026}),10106.14,.005);
  close(S10.privateUseAddition({woz:237000,ownUseDays:243,year:2026}),7983.85,.02);
  close(S10.privateUseAddition({woz:300000,ownUseDays:305,year:2026}),12684.66,.02);
  const blocked=S10.secondHomeProfile({grossRentalIncomeAnnual:20000,privateUseDays:365,daysLet:0},{startYear:2026,startMonth:1});
  assert.equal(blocked.profile,'blocked');
  assert.match(blocked.message,/A day counts either as rented out/);
  const deemed=FC.box3TaxForYear({regime:'current',jan1Portfolio:300000,jan1Savings:0,jan1Debt:200000,allowActualRebuttal:false,taxPartners:1});
  close(deemed.tax,1957.95,.02,'T4-3 deemed');
});

test('T5 low-income guard withholds automatic relief at €29,736',()=>{
  const low=Box1.ownHomeBox1Tax2026({box1IncomeBeforeOwnHome:25000,ewfIncome:1400,deductibleOwnHomeCosts:12000});
  assert.equal(low.withheld,true);
  assert.equal(low.taxBenefit,null);
  const shown=Box1.ownHomeBox1Tax2026({box1IncomeBeforeOwnHome:50000,ewfIncome:1400,deductibleOwnHomeCosts:12000});
  close(shown.taxBenefit,3981.36,.02);
  const edge=Box1.ownHomeBox1Tax2026({box1IncomeBeforeOwnHome:40336,ewfIncome:1400,deductibleOwnHomeCosts:12000});
  assert.equal(edge.withheld,true);
  const above=Box1.ownHomeBox1Tax2026({box1IncomeBeforeOwnHome:41000,ewfIncome:1400,deductibleOwnHomeCosts:12000});
  assert.equal(above.withheld,undefined);
  assert.ok(above.taxBenefit>0);
  const an=Box1.ownHomeBox1Tax2026({box1IncomeBeforeOwnHome:60000,ewfIncome:0,deductibleOwnHomeCosts:10000});
  close(an.taxBenefit,3756,.02);
});

test('30% ruling converts 2026 pay and refuses 2027 conversion',()=>{
  assert.equal(State.estimateTaxableIncome2026({grossIncome:100000,use30Ruling:true,startYear:2026}),70000);
  assert.equal(State.estimateTaxableIncome2026({grossIncome:50000,use30Ruling:true}),48014);
  assert.equal(State.estimateTaxableIncome2026({grossIncome:300000,use30Ruling:true}),221400);
  const later=State.estimateTaxableIncome2026({grossIncome:100000,use30Ruling:true,startYear:2027});
  assert.equal(later.available,false);
  assert.match(later.line,/we can only convert your pay for 2026/);
});

test('release rows label the manifest as a digest and do not invent a deploy commit',()=>{
  const rows=S10.releaseIdentityRows(require('../release-identity.js'));
  assert.equal(rows.some(row=>row[1]==='Calculation source commit'),false);
  assert.equal(rows.some(row=>row[1]==='Deployed commit'),false);
  const digest=rows.find(row=>String(row[1]).includes('SHA-256'));
  assert.equal(digest[2].length,64);
  assert.match(digest[1],/not a Git commit/);
});

test('verbatim launch strings are present',()=>{
  const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  assert.match(html,/2026 rules, then proposed new rules \(not law\)/);
  assert.match(html,/Assumed start year of the proposed rules/);
  assert.match(html,/For 2027, only two confirmed changes are included/);
  assert.match(html,/GitHub records the IP address of every visitor for security/);
  assert.doesNotMatch(html,/GDPR-compliant|anonymous|no data leaves/i);
});
