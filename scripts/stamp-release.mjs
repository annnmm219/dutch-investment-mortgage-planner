import {readFileSync,writeFileSync} from 'node:fs';
const date=process.argv[2];
if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')){
  console.error('Usage: npm run stamp-release -- YYYY-MM-DD');
  process.exit(1);
}
const file='output-integrity.js';
const source=readFileSync(file,'utf8');
const next=source.replace(/patched:(?:null|'[^']*')/,`patched:'${date}'`);
if(next===source||!next.includes(`patched:'${date}'`)){
  console.error('Could not set RELEASE_META.patched in output-integrity.js');
  process.exit(1);
}
writeFileSync(file,next);
const months=['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const [year,month,day]=date.split('-');
const label=`patched ${Number(day)} ${months[Number(month)]} ${year}`;
const htmlFile='index.html';
const html=readFileSync(htmlFile,'utf8').replace(/patched (?:not yet deployed|\d{1,2} [A-Z][a-z]{2} \d{4})/,label);
writeFileSync(htmlFile,html);
console.log(`Stamped patch date ${date}. Footer and CSV both read RELEASE_META.patched.`);
