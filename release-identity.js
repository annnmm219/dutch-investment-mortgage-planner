(function(root,factory){
  const identity=factory();
  if(typeof module==='object'&&module.exports)module.exports=identity;
  if(root)root.__DIMP_RELEASE_IDENTITY=identity;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
return Object.freeze({
  release:'R6.6',
  stage:'Stage 10 remediation',
  calculationSourceSha:null,
  buildId:'UNFROZEN',
  frozenAt:null
});
});
