(function(root,factory){
  const identity=factory();
  if(typeof module==='object'&&module.exports)module.exports=identity;
  if(root)root.__DIMP_RELEASE_IDENTITY=identity;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
return Object.freeze({
  release:'R6.7 preview',
  stage:'Mortgage rate periods and result clarity development preview',
  calculationSourceSha:null,
  baselineCalculationSourceSha:'a4377ce1050277b5ce13b97779c4af27ede94f65',
  buildId:'R6.7-rate-periods-preview-20261023',
  frozenAt:null
});
});
