from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: str, old: str, new: str, label: str) -> None:
    file = ROOT / path
    text = file.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match in {path}, found {count}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


replace_once(
    "app-state.js",
    "  function refreshUx(){simplifyHousehold();simplifyPhasesToMonthly();explainIncomeAndDeduction();scenarioAssumptions();reframeNextEuro();reframeComparableWealth();updateMortgageReporting();}\n",
    "  let uxRefreshing=false;\n"
    "  function refreshUx(){\n"
    "    if(uxRefreshing)return;\n"
    "    uxRefreshing=true;\n"
    "    try{simplifyHousehold();simplifyPhasesToMonthly();explainIncomeAndDeduction();scenarioAssumptions();reframeNextEuro();reframeComparableWealth();updateMortgageReporting();}\n"
    "    finally{uxRefreshing=false;}\n"
    "  }\n",
    "refresh reentrancy guard",
)

replace_once(
    "app-state.js",
    "  restore();refreshUx();\n  const uxObserver=new MutationObserver(()=>refreshUx());['phaseList','strategyAResultNew','strategyBResultNew','scenarioVerdictNew'].forEach(id=>{const el=$(id);if(el)uxObserver.observe(el,{childList:true,subtree:true});});\n",
    "  restore();refreshUx();\n"
    "  const uxTargetIds=['phaseList','strategyAResultNew','strategyBResultNew','scenarioVerdictNew'];\n"
    "  let uxObserver=null,uxObserverQueued=false;\n"
    "  function observeUxTargets(){\n"
    "    if(!uxObserver)return;\n"
    "    uxTargetIds.forEach(id=>{const el=$(id);if(el)uxObserver.observe(el,{childList:true,subtree:true});});\n"
    "  }\n"
    "  function refreshUxFromMutation(){\n"
    "    if(uxObserverQueued)return;\n"
    "    uxObserverQueued=true;\n"
    "    const run=()=>{\n"
    "      uxObserverQueued=false;\n"
    "      uxObserver.disconnect();\n"
    "      try{refreshUx();}\n"
    "      finally{observeUxTargets();}\n"
    "    };\n"
    "    if(typeof requestAnimationFrame==='function')requestAnimationFrame(run);else setTimeout(run,0);\n"
    "  }\n"
    "  uxObserver=new MutationObserver(refreshUxFromMutation);\n"
    "  observeUxTargets();\n",
    "self-mutation-safe observer",
)

# A new query-string version is required so browsers do not reuse the hanging R6.4.1 assets.
text_extensions = {".js", ".html", ".md", ".json", ".yml", ".yaml"}
for file in ROOT.rglob("*"):
    if not file.is_file() or ".git" in file.parts or file.suffix.lower() not in text_extensions:
        continue
    text = file.read_text(encoding="utf-8")
    revised = text.replace("R6.4.1", "R6.4.2").replace(r"R6\.4\.1", r"R6\.4\.2")
    if revised != text:
        file.write_text(revised, encoding="utf-8")

# Add a source-level regression test for the loop that made Chromium report that the page was not responding.
test_file = ROOT / "tests" / "r642-responsiveness.test.js"
test_file.write_text(
    r"""'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.resolve(__dirname,'..','app-state.js'),'utf8');

test('UX mutation observer disconnects while refresh mutates observed result trees',()=>{
  assert.match(source,/uxObserver\.disconnect\(\)/);
  assert.match(source,/finally\{observeUxTargets\(\);\}/);
  assert.match(source,/new MutationObserver\(refreshUxFromMutation\)/);
  assert.doesNotMatch(source,/new MutationObserver\(\(\)=>refreshUx\(\)\)/);
});

test('UX refresh has a reentrancy guard for nested input events',()=>{
  assert.match(source,/let uxRefreshing=false/);
  assert.match(source,/if\(uxRefreshing\)return/);
  assert.match(source,/finally\{uxRefreshing=false;\}/);
});
""",
    encoding="utf-8",
)

print("R6.4.2 responsiveness hotfix applied.")
