'use strict';

const assert=require('node:assert/strict');
const FC=require('../finance-core.js');
const LI=require('../logic-integrity-ui.js');
LI.decorateFinanceCore(FC);
const SC=require('../scenario-engine.js');
LI.decorateScenarioCore(SC);
const OI=require('../output-integrity.js');

const MODES=['buy-rent','downpayment','mortgage-invest','linear-annuity','sell-rent'];
const RETURNS=[0,3,5,7,10,4,6,8,2,9];
const HORIZONS=[5,7,10,12,15,18,20,25,8,30];
const START_MONTHS=[1,7,1,4,1,10,1,6,1,9];
const BOX_MODES=['none','current','current','current','future','current','transition','current','none','current'];
const PAY_SOURCES=['savings','portfolio','external'];
const FALLBACKS=['invest','savings','consume'];

function close(a,b,tolerance=1e-6,message='values differ'){
  assert.ok(Number.isFinite(a),`${message}: first value is not finite`);
  assert.ok(Number.isFinite(b),`${message}: second value is not finite`);
  assert.ok(Math.abs(a-b)<=tolerance,`${message}: ${a} vs ${b}`);
}

function parseDisplayedMoney(text){
  const normalized=String(text).replace(/[€\s.]/g,'').replace(',','.');
  const value=Number(normalized);
  assert.ok(Number.isFinite(value),`displayed money is not numeric: ${text}`);
  return value;
}

function baseConfig(mode,index){
  const returnPct=RETURNS[index];
  const horizon=HORIZONS[index];
  const boxMode=BOX_MODES[index];
  const startMonth=(boxMode==='future'||boxMode==='transition')?1:START_MONTHS[index];
  const savings=130000+index*3500;
  const debt=index%4===0?12000:0;
  const rate=2.5+(index%6)*.45;
  const mortgageBalance=180000+index*17000;
  const years=20+(index%3)*5;
  const firstJan1={portfolio:35000+index*4000,savings,debt};
  return{
    mode,
    horizonYears:horizon,
    investmentReturnPct:returnPct,
    startYear:2026,
    startMonth,
    startPortfolio:firstJan1.portfolio,
    purchaseCosts:12000+index*250,
    mortgageType:index%2===0?'annuity':'linear',
    mortgage:{balance:mortgageBalance,ratePct:rate,years},
    tax:{
      enabled:index%5!==3,
      deductionRate:index%2===0?.3756:.3575,
      wozValue:320000+index*15000,
      hraRemainingMonths:Math.min(years*12,360),
      qualifyingInterestFraction:index%4===0?.8:1
    },
    box3:{
      mode:boxMode,
      taxPartners:index%3===0?2:1,
      paySource:PAY_SOURCES[index%PAY_SOURCES.length],
      currentTaxRate:.36,
      currentAllowance:59357,
      currentNotional:.06,
      currentSavingsNotional:.0128,
      currentDebtNotional:.027,
      currentDebtThreshold:3800,
      firstJan1Portfolio:firstJan1.portfolio,
      firstJan1Savings:firstJan1.savings,
      firstJan1Debt:firstJan1.debt,
      savings,
      debt,
      savingsReturnPct:1.75+(index%4)*.25,
      debtInterestPct:3.2+(index%3)*.4,
      debtMonthlyRepayment:debt?350+index*25:0,
      debtRepaymentSource:index%2===0?'external':'savings',
      debtFallbackDestination:FALLBACKS[index%FALLBACKS.length],
      futureStart:2028,
      futureTaxRate:.36,
      futureExempt:1800,
      futureLossThreshold:500
    },
    upfrontCashTreatment:index%2===0?'invest':'savings',
    homeGrowthPct:1+(index%5)*.5,
    rentGrowthPct:1.5+(index%4)*.5,
    sellingCostPct:1.5+(index%3)*.25,
    vveMonthly:150+index*15,
    maintenanceAnnual:1000+index*175,
    ownerTaxesAnnual:300+index*35,
    insuranceAnnual:180+index*15,
    groundLeaseAnnual:index%3===0?900:0,
    buyRent:{
      price:280000+index*18000,
      downPayment:35000+index*2500,
      monthlyRent:1200+index*85,
      mortgageRatePct:rate,
      mortgageYears:years,
      wozValue:270000+index*17500
    },
    downpayment:{
      price:300000+index*16000,
      downA:70000+index*2500,
      downB:25000+index*1000,
      mortgageRatePct:rate,
      mortgageYears:years,
      wozValue:290000+index*15000
    },
    mortgageInvest:{extraMonthly:200+index*75},
    sellRent:{
      homeValue:430000+index*22000,
      monthlyRent:1300+index*90,
      wozValue:400000+index*20000
    }
  };
}

function strategyIdentity(strategy,mode){
  const hasCommonHome=mode==='mortgage-invest'||mode==='linear-annuity';
  const expected=hasCommonHome
    ?strategy.financial-strategy.mortgage
    :strategy.financial+Number(strategy.equity||0);
  close(strategy.net,expected,1e-5,`${mode} strategy identity for ${strategy.name}`);
  for(const key of ['net','invest','savings','box3Debt','financial','mortgage','interest','mortTax','rent','owner','purchase','selling','box3','externalTax','externalDebtRepayment','box3DebtInterest']){
    assert.ok(Number.isFinite(Number(strategy[key])),`${mode} ${strategy.name} ${key} is not finite`);
  }
  assert.ok(strategy.invest>=-1e-8,`${mode} negative investment portfolio`);
  assert.ok(strategy.savings>=-1e-8,`${mode} negative savings`);
  assert.ok(strategy.box3Debt>=-1e-8,`${mode} negative Box 3 debt`);
  assert.ok(strategy.mortgage>=-1e-8,`${mode} negative mortgage`);
}

function verifyMortgageIdentity(config){
  const schedule=FC.mortgageSchedule({
    balance:config.mortgage.balance,
    annualRatePct:config.mortgage.ratePct,
    termYears:config.mortgage.years,
    type:config.mortgageType,
    months:config.horizonYears*12,
    extraMonthly:config.mortgageInvest.extraMonthly,
    startYear:config.startYear,
    startMonth:config.startMonth,
    tax:config.tax
  });
  close(schedule.initialBalance,schedule.balance+schedule.totalScheduledPrincipal+schedule.totalExtra,1e-5,'mortgage principal identity');
  close(schedule.totalTaxBenefit,schedule.rows.reduce((sum,row)=>sum+row.taxReturn,0),1e-8,'allocated HRA identity');
  schedule.rows.forEach(row=>{
    close(row.gross,row.principal+row.interest,1e-8,'gross payment identity');
    close(row.net,row.gross-row.taxReturn,1e-8,'net payment identity');
    assert.ok(row.balance>=-1e-8,'negative mortgage row balance');
  });
}

function verifyDebtFallback(config,index){
  const months=24;
  const startingDebt=1000+index*100;
  const monthly=500+index*10;
  const result=FC.simulateInvestmentFlows({
    initialPortfolio:10000,
    flows:Array(months).fill(0),
    annualReturnPct:0,
    startYear:2026,
    startMonth:1,
    box3Mode:'none',
    box3Savings:20000,
    box3Debt:startingDebt,
    savingsReturnPct:0,
    debtInterestPct:0,
    box3DebtMonthlyRepayment:monthly,
    debtRepaymentSource:index%2===0?'external':'savings',
    box3DebtFallbackDestination:FALLBACKS[index%FALLBACKS.length]
  });
  const accounted=result.totalDebtRepaid+result.box3DebtFallbackInvested+result.box3DebtFallbackSaved+result.box3DebtFallbackConsumed+result.box3DebtRepaymentShortfall;
  close(result.plannedBox3DebtRepayment,accounted,1e-8,'Box 3 debt repayment budget identity');
  close(result.box3DebtCashConservationDifference,0,1e-8,'Box 3 debt fallback conservation');
  assert.equal(result.box3Debt,0,'Box 3 debt should be repaid in fallback probe');
}

function verifyDisplay(result,config){
  const gap=result.A.net-result.B.net;
  const formatted=OI.formatMoney(Math.abs(gap));
  assert.equal(parseDisplayedMoney(formatted),Math.round(Math.abs(gap)),'displayed gap must match rounded calculation');
  const model=OI.outputModel({
    portfolio:result.A.invest,
    box3Tax:result.A.box3,
    totalTax:result.A.box3,
    householdComparableWealth:result.A.net,
    taxAdjustedComparableAvailable:true,
    taxStatus:'settled'
  },{box3Mode:config.box3.mode});
  const card=OI.scenarioCardModel({portfolio:result.A.invest,mortgage:result.A.mortgage,box3Tax:result.A.box3,unsettledTaxEstimate:result.A.unsettledBox3},true,config.box3.mode==='none');
  assert.equal(parseDisplayedMoney(model.headlineValue),Math.round(result.A.invest));
  assert.equal(parseDisplayedMoney(card.value),Math.round(result.A.invest));
  assert.doesNotMatch(card.sub,/undefined|null|NaN/);
}

function run(){
  const rows=[];
  let count=0;
  MODES.forEach(mode=>{
    for(let index=0;index<10;index++){
      const config=baseConfig(mode,index);
      const result=SC.runScenario(config);
      assert.equal(result.valid,true,`${mode} ${index+1} unexpectedly invalid: ${result.reason||''}`);
      strategyIdentity(result.A,mode);
      strategyIdentity(result.B,mode);
      assert.equal(result.cashA.length,config.horizonYears*12,`${mode} cashA horizon mismatch`);
      assert.equal(result.cashB.length,config.horizonYears*12,`${mode} cashB horizon mismatch`);
      assert.equal(result.budgetSeries.length,config.horizonYears*12,`${mode} budget horizon mismatch`);
      close(result.peakRequirement,Math.max(0,...result.budgetSeries),1e-8,`${mode} peak budget`);
      close(result.firstRequirement,result.budgetSeries[0]||0,1e-8,`${mode} first budget`);
      verifyMortgageIdentity(config);
      verifyDebtFallback(config,index);
      verifyDisplay(result,config);
      rows.push({
        id:`${mode}-${index+1}`,
        mode,
        years:config.horizonYears,
        returnPct:config.investmentReturnPct,
        box3:config.box3.mode,
        winner:Math.abs(result.A.net-result.B.net)<1?'Tie':result.A.net>result.B.net?result.A.name:result.B.name,
        gap:Math.round(Math.abs(result.A.net-result.B.net)),
        reconciled:true
      });
      count++;
    }
  });
  assert.equal(count,50,'exactly 50 scenarios must run');
  const byMode=Object.fromEntries(MODES.map(mode=>[mode,rows.filter(row=>row.mode===mode).length]));
  console.log(JSON.stringify({release:'R6.4.1',scenarios:count,reconciled:rows.filter(row=>row.reconciled).length,byMode,failures:0},null,2));
  console.log('R6.4.1: 50/50 scenario calculations and displayed rounded values reconciled.');
  return rows;
}

if(require.main===module)run();
module.exports={MODES,baseConfig,run};
