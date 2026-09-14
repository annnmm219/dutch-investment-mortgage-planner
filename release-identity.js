(function(root,factory){
  const identity=factory();
  if(typeof module==='object'&&module.exports)module.exports=identity;
  if(root)root.__DIMP_RELEASE_IDENTITY=identity;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
return Object.freeze({
  release:'R6.6',
  stage:'Stage 10 remediation',
  calculationSourceSha:'31c08ffea3cb94e66692ad4c9505b2b7b8778e61',
  buildId:'R6.6-stage10-31c08ffe',
  frozenAt:'2026-09-14T21:38:00Z'
});
});
