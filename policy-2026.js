(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.Policy2026=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';

function deepFreeze(value){
  if(!value||typeof value!=='object'||Object.isFrozen(value))return value;
  Object.getOwnPropertyNames(value).forEach(key=>deepFreeze(value[key]));
  return Object.freeze(value);
}

const TAX_YEAR=2026;
const EFFECTIVE_FROM='2026-01-01';
const LAST_VERIFIED_AT='2026-09-03';

const SOURCES=deepFreeze({
  box1Rates:{
    sourceTitle:'Box 1: uitleg en tarieven',
    sourceUrl:'https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/prive/inkomstenbelasting/heffingskortingen_boxen_tarieven/boxen_en_tarieven/box_1/box_1',
    authority:'Belastingdienst',
    lastVerifiedAt:LAST_VERIFIED_AT
  },
  mortgageInterestDeduction:{
    sourceTitle:'Heb ik recht op hypotheekrenteaftrek?',
    sourceUrl:'https://www.rijksoverheid.nl/vraag-en-antwoord/huis-kopen/hypotheekrenteaftrek',
    authority:'Rijksoverheid',
    lastVerifiedAt:LAST_VERIFIED_AT
  },
  eigenwoningforfait:{
    sourceTitle:'Eigenwoningforfait - wat is het en hoe bereken ik het?',
    sourceUrl:'https://www.belastingdienst.nl/wps/wcm/connect/nl/koopwoning/content/hoe-werkt-eigenwoningforfait',
    authority:'Belastingdienst',
    lastVerifiedAt:LAST_VERIFIED_AT
  },
  hillen:{
    sourceTitle:'Geen of een kleine eigenwoningschuld (Wet Hillen)',
    sourceUrl:'https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/prive/woning/eigenwoningforfait/geen_of_een_kleine_eigenwoningschuld/',
    authority:'Belastingdienst',
    lastVerifiedAt:LAST_VERIFIED_AT
  },
  box3:{
    sourceTitle:'Hoe is het box 3-inkomen op mijn voorlopige aanslag 2026 berekend?',
    sourceUrl:'https://www.belastingdienst.nl/wps/wcm/connect/nl/box-3/content/berekening-box-3-inkomen-2026',
    authority:'Belastingdienst',
    lastVerifiedAt:LAST_VERIFIED_AT
  },
  transferTax:{
    sourceTitle:'Het tarief van de overdrachtsbelasting',
    sourceUrl:'https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/prive/woning/overdrachtsbelasting/tarieven_overdrachtsbelasting/',
    authority:'Belastingdienst',
    lastVerifiedAt:LAST_VERIFIED_AT
  },
  starterExemption:{
    sourceTitle:'Wanneer kunt u de startersvrijstelling krijgen (overdrachtsbelasting)?',
    sourceUrl:'https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/prive/woning/overdrachtsbelasting/startersvrijstelling/startersvrijstelling',
    authority:'Belastingdienst',
    lastVerifiedAt:LAST_VERIFIED_AT
  },
  nhg:{
    sourceTitle:'NHG-grens in 2026 vastgesteld op € 470.000',
    sourceUrl:'https://www.nhg.nl/nhg-actueel/nhg-grens-in-2026-vastgesteld-op-470000/',
    authority:'Nationale Hypotheek Garantie',
    lastVerifiedAt:LAST_VERIFIED_AT
  },
  ltv:{
    sourceTitle:'Hoeveel kan ik maximaal lenen voor mijn koopwoning?',
    sourceUrl:'https://www.rijksoverheid.nl/vraag-en-antwoord/huis-kopen/maximaal-bedrag-lenen-koopwoning',
    authority:'Rijksoverheid',
    lastVerifiedAt:LAST_VERIFIED_AT
  }
});

const VALUES=deepFreeze({
  taxYear:TAX_YEAR,
  box1:{
    preAowBrackets:[
      {lower:0,upper:38883,rate:.3575},
      {lower:38883,upper:78426,rate:.3756},
      {lower:78426,upper:null,rate:.495}
    ],
    ownHomeDeductionMaxRate:.3756
  },
  ownHome:{
    maximumQualifyingMortgageMonths:360
  },
  eigenwoningforfait:{
    rateBands:[
      {lower:0,upper:12500,rate:0},
      {lower:12500,upper:25000,rate:.001},
      {lower:25000,upper:50000,rate:.002},
      {lower:50000,upper:75000,rate:.0025},
      {lower:75000,upper:1350000,rate:.0035}
    ],
    highValueThreshold:1350000,
    highValueBase:4725,
    highValueExcessRate:.0235
  },
  hillen:{
    phaseOutStartYear:2019,
    legacyPhaseOutYears:30,
    relief2026:.71867,
    planningAnnualReductionAfter2026:.048,
    zeroFromYear:2041
  },
  box3:{
    taxRate:.36,
    allowancePerPerson:59357,
    investmentDeemedRate:.06,
    savingsDeemedRate:.0128,
    debtDeemedRate:.027,
    debtThresholdPerPerson:3800
  },
  transferTax:{
    mainResidenceRate:.02,
    otherResidenceRate:.08,
    otherRealEstateRate:.104,
    starterExemptionValueLimit:555000,
    starterMinimumAge:18,
    starterMaximumAge:34
  },
  nhg:{
    standardLimit:470000,
    energyLimit:498200,
    feeRate:.004
  },
  ltv:{
    standardLimit:1
  }
});

function item(key,value,status,sourceKey,notes=''){
  return deepFreeze({
    key,
    value,
    taxYear:TAX_YEAR,
    effectiveFrom:EFFECTIVE_FROM,
    status,
    sourceKey,
    sourceTitle:SOURCES[sourceKey].sourceTitle,
    sourceUrl:SOURCES[sourceKey].sourceUrl,
    authority:SOURCES[sourceKey].authority,
    lastVerifiedAt:SOURCES[sourceKey].lastVerifiedAt,
    notes
  });
}

const ITEMS=deepFreeze([
  item('box1.preAowBrackets',VALUES.box1.preAowBrackets,'final','box1Rates'),
  item('box1.ownHomeDeductionMaxRate',VALUES.box1.ownHomeDeductionMaxRate,'final','mortgageInterestDeduction'),
  item('ownHome.maximumQualifyingMortgageMonths',VALUES.ownHome.maximumQualifyingMortgageMonths,'final','mortgageInterestDeduction'),
  item('eigenwoningforfait.rateBands',VALUES.eigenwoningforfait.rateBands,'final','eigenwoningforfait'),
  item('eigenwoningforfait.highValueThreshold',VALUES.eigenwoningforfait.highValueThreshold,'final','eigenwoningforfait'),
  item('eigenwoningforfait.highValueBase',VALUES.eigenwoningforfait.highValueBase,'final','eigenwoningforfait'),
  item('eigenwoningforfait.highValueExcessRate',VALUES.eigenwoningforfait.highValueExcessRate,'final','eigenwoningforfait'),
  item('hillen.relief2026',VALUES.hillen.relief2026,'final','hillen'),
  item('hillen.zeroFromYear',VALUES.hillen.zeroFromYear,'final','hillen'),
  item('hillen.planningAnnualReductionAfter2026',VALUES.hillen.planningAnnualReductionAfter2026,'planning-series','hillen','The current model continues the published phase-out direction as a 4.8 percentage-point annual planning series after 2026.'),
  item('box3.taxRate',VALUES.box3.taxRate,'final','box3'),
  item('box3.allowancePerPerson',VALUES.box3.allowancePerPerson,'final','box3'),
  item('box3.investmentDeemedRate',VALUES.box3.investmentDeemedRate,'final','box3'),
  item('box3.savingsDeemedRate',VALUES.box3.savingsDeemedRate,'provisional','box3','Belastingdienst states this percentage will be finalised in early 2027 for the definitive 2026 assessment.'),
  item('box3.debtDeemedRate',VALUES.box3.debtDeemedRate,'provisional','box3','Belastingdienst states this percentage will be finalised in early 2027 for the definitive 2026 assessment.'),
  item('box3.debtThresholdPerPerson',VALUES.box3.debtThresholdPerPerson,'final','box3'),
  item('transferTax.mainResidenceRate',VALUES.transferTax.mainResidenceRate,'final','transferTax'),
  item('transferTax.otherResidenceRate',VALUES.transferTax.otherResidenceRate,'final','transferTax'),
  item('transferTax.otherRealEstateRate',VALUES.transferTax.otherRealEstateRate,'final','transferTax'),
  item('transferTax.starterExemptionValueLimit',VALUES.transferTax.starterExemptionValueLimit,'final','starterExemption'),
  item('transferTax.starterAgeRange',[VALUES.transferTax.starterMinimumAge,VALUES.transferTax.starterMaximumAge],'final','starterExemption'),
  item('nhg.standardLimit',VALUES.nhg.standardLimit,'final','nhg'),
  item('nhg.energyLimit',VALUES.nhg.energyLimit,'final','nhg'),
  item('nhg.feeRate',VALUES.nhg.feeRate,'final','nhg'),
  item('ltv.standardLimit',VALUES.ltv.standardLimit,'final','ltv')
]);

const ITEM_BY_KEY=deepFreeze(Object.fromEntries(ITEMS.map(entry=>[entry.key,entry])));

function getValue(path){
  const keys=String(path).split('.');
  let cursor=VALUES;
  for(const key of keys){
    if(cursor==null||!Object.prototype.hasOwnProperty.call(cursor,key))throw new RangeError(`Unknown 2026 policy value: ${path}`);
    cursor=cursor[key];
  }
  return cursor;
}

function getItem(key){
  const entry=ITEM_BY_KEY[key];
  if(!entry)throw new RangeError(`Unknown 2026 policy item: ${key}`);
  return entry;
}

function validateMetadata(items=ITEMS){
  const errors=[];
  items.forEach((entry,index)=>{
    const prefix=entry?.key||`item[${index}]`;
    if(entry?.taxYear!==TAX_YEAR)errors.push(`${prefix}: taxYear must be ${TAX_YEAR}`);
    if(entry?.effectiveFrom!==EFFECTIVE_FROM)errors.push(`${prefix}: effectiveFrom must be ${EFFECTIVE_FROM}`);
    if(!['final','provisional','planning-series'].includes(entry?.status))errors.push(`${prefix}: invalid status`);
    if(!/^https:\/\//.test(entry?.sourceUrl||''))errors.push(`${prefix}: missing official HTTPS source URL`);
    if(!entry?.sourceTitle)errors.push(`${prefix}: missing source title`);
    if(!entry?.authority)errors.push(`${prefix}: missing authority`);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(entry?.lastVerifiedAt||''))errors.push(`${prefix}: invalid verification date`);
  });
  return{valid:errors.length===0,errors};
}

return{
  TAX_YEAR,
  EFFECTIVE_FROM,
  LAST_VERIFIED_AT,
  SOURCES,
  VALUES,
  ITEMS,
  ITEM_BY_KEY,
  getValue,
  getItem,
  validateMetadata
};
});
