(function(root,factory){
  const identity=factory();
  if(typeof module==='object'&&module.exports)module.exports=identity;
  if(root)root.__DIMP_RELEASE_IDENTITY=identity;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
// GitHub Pages serves these files as-is, so this identity cannot stamp the deploying commit.
// calculationManifestSha is SHA-256 of "<file> <sha256>\n" lines for calculationManifestFiles, in that order.
// calculationSourceSha repeats that digest so existing export rows stay a verifiable fingerprint, not a git commit.
// frozenFromCommit is the main commit this manifest was frozen from.
const calculationManifestFiles=Object.freeze([
  'app-state.js',
  'app.js',
  'box1-2026.js',
  'box3-household.js',
  'finance-core.js',
  'next-euro.js',
  'policy-2026.js',
  'purchase-costs.js',
  'purchase-rules.js',
  'scenario-engine.js',
  'stage10-remediation.js',
  'stage9-1-remediation.js'
]);
const calculationManifestSha='727449b8e4a7ef1b35cc94260d5a2ca74725f73da702e617b5b62f02ec32ee3c';
return Object.freeze({
  release:'R6.6',
  stage:'Stage 10 remediation',
  calculationManifestFiles,
  calculationManifestSha,
  calculationSourceSha:calculationManifestSha,
  frozenFromCommit:'43fa347d122beaf34500189a4e4316f3ed7e5569',
  buildId:'R6.6-727449b8e4a7',
  frozenAt:'2026-11-10T10:13:20.000Z'
});
});
