'use strict';

const {RELEASE_META,releaseStampStatus}=require('../output-integrity.js');
const base=process.env.GITHUB_BASE_REF||'';
const ref=process.env.GITHUB_REF||'';
const releaseBuild=base==='main'||ref==='refs/heads/main';
if(!releaseBuild){
  console.log(`release-stamp-guard: skipped (GITHUB_BASE_REF=${base||'unset'}, GITHUB_REF=${ref||'unset'}).`);
  process.exit(0);
}
const status=releaseStampStatus({patched:RELEASE_META.patched,releaseBuild:true});
if(!status.ok){
  console.error(status.reason);
  process.exit(1);
}
console.log(`release-stamp-guard: patched ${status.patched}.`);
