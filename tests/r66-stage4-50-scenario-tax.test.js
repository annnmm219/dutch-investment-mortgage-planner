'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const Box1=require('../box1-2026.js');
const SC=require('../scenario-engine.js');
Box1.decorateScenarioCore(SC);
const {MODES,baseConfig}=require('../scripts/verify-50-scenarios.js');

const INCOMES=[30000,45000,60000,80000,100000,38000,70000,85000,55000,120000];
const close=(a,b,tolerance=1e-6,message='values differ')=>{
  assert.ok(Number.isFinite(Number(a)),`${message}: first value is not finite`);
  assert.ok(Number.isFinite(Number(b)),`${message}: second value is not finite`);
  assert.ok(Math.abs(Number(a)-Number(b))<=tolerance,`${message}: ${a} vs ${b}`);
};
const leader=result=>{
  const difference=result.A.net-result.B.net;
  return Math.abs(difference)<1?'Tie':difference>0?result.A.name:result.B.name;
};
const clone=value=>JSON.parse(JSON.stringify(value));

function legacyConfig(mode,index){
  const config=clone(baseConfig(mode,index));
  config.tax={...config.tax,calculationMode:'manual-rate'};
  return config;
}

function automaticConfig(mode,index){
  const config=clone(baseConfig(mode,index));
  config.tax={
    ...config.tax,
    calculationMode:'box1-2026',
    box1IncomeBeforeOwnHome:INCOMES[index],
    box1Profile:Box1.PROFILE
  };
  return config;
}

test('Stage 4 50-scenario matrix changes only Box 1-sensitive economics',()=>{
  const rows=[];
  let numericalChanges=0,leaderChanges=0,taxEffectChanges=0;

  MODES.forEach(mode=>{
    for(let index=0;index<10;index++){
      const before=SC.runScenario(legacyConfig(mode,index));
      const after=SC.runScenario(automaticConfig(mode,index));
      assert.equal(before.valid,true,`${mode}-${index+1} legacy comparison invalid`);
      assert.equal(after.valid,true,`${mode}-${index+1} automatic comparison invalid`);

      const deltaA=after.A.net-before.A.net;
      const deltaB=after.B.net-before.B.net;
      const taxDeltaA=after.A.mortTax-before.A.mortTax;
      const taxDeltaB=after.B.mortTax-before.B.mortTax;
      const changed=Math.abs(deltaA)>1e-6||Math.abs(deltaB)>1e-6;
      const taxChanged=Math.abs(taxDeltaA)>1e-6||Math.abs(taxDeltaB)>1e-6;
      const beforeLeader=leader(before),afterLeader=leader(after);
      if(changed)numericalChanges++;
      if(taxChanged)taxEffectChanges++;
      if(beforeLeader!==afterLeader)leaderChanges++;

      for(const strategy of ['A','B']){
        close(after[strategy].mortgage,before[strategy].mortgage,1e-6,`${mode}-${index+1} ${strategy} mortgage balance`);
        close(after[strategy].interest,before[strategy].interest,1e-6,`${mode}-${index+1} ${strategy} gross mortgage interest`);
        close(after[strategy].purchase,before[strategy].purchase,1e-6,`${mode}-${index+1} ${strategy} purchase costs`);
        close(after[strategy].selling,before[strategy].selling,1e-6,`${mode}-${index+1} ${strategy} selling costs`);
      }

      if(after.sourcesAndUses){
        for(const strategy of ['A','B']){
          const beforeFunding=before.sourcesAndUses?.[strategy];
          const afterFunding=after.sourcesAndUses?.[strategy];
          if(!afterFunding&&!beforeFunding)continue;
          assert.ok(afterFunding&&beforeFunding,`${mode}-${index+1} ${strategy} funding object changed availability`);
          for(const field of ['propertyPrice','transactionCosts','totalUses','mortgageProceeds','totalBuyerCash','totalSources','identityDifference','shortfall']){
            close(afterFunding[field],beforeFunding[field],1e-6,`${mode}-${index+1} ${strategy} funding ${field}`);
          }
          close(afterFunding.identityDifference,0,1e-6,`${mode}-${index+1} ${strategy} sources-and-uses identity`);
        }
      }

      rows.push({
        id:`${mode}-${index+1}`,
        income:INCOMES[index],
        taxEnabled:automaticConfig(mode,index).tax.enabled,
        beforeLeader,
        afterLeader,
        deltaA:Number(deltaA.toFixed(6)),
        deltaB:Number(deltaB.toFixed(6)),
        taxDeltaA:Number(taxDeltaA.toFixed(6)),
        taxDeltaB:Number(taxDeltaB.toFixed(6))
      });
    }
  });

  assert.equal(rows.length,50);
  assert.ok(numericalChanges>0,'the rebuilt Box 1 bridge must change at least one modeled result');
  assert.ok(taxEffectChanges>0,'the rebuilt Box 1 bridge must change at least one mortgage tax effect');
  assert.ok(numericalChanges<50,'tax-disabled controls should remain unchanged');

  console.log(JSON.stringify({
    stage:'R6.6 Stage 4',
    scenarios:rows.length,
    numericalChanges,
    taxEffectChanges,
    leaderChanges,
    unchanged:rows.length-numericalChanges,
    changedLeaderIds:rows.filter(row=>row.beforeLeader!==row.afterLeader).map(row=>row.id)
  },null,2));
});
