(function(root,factory){
  const identity=factory();
  if(typeof module==='object'&&module.exports)module.exports=identity;
  if(root)root.__DIMP_RELEASE_IDENTITY=identity;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
return Object.freeze({
  release:'R6.6',
  stage:'Stage 10 remediation',
  calculationSourceSha:'a4377ce1050277b5ce13b97779c4af27ede94f65',
  buildId:'R6.6-stage10-a4377ce1',
  frozenAt:'2026-09-15T07:58:07.939Z'
});
});
