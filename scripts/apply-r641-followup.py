from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

def patch(path,old,new,label):
    file=ROOT/path
    text=file.read_text(encoding='utf-8')
    count=text.count(old)
    if count!=1:
        raise RuntimeError(f'{label}: expected one match, found {count}')
    file.write_text(text.replace(old,new,1),encoding='utf-8')

patch(
    Path('output-integrity.js'),
    "function finiteOrNull(value){\n  const number=Number(value);\n  return Number.isFinite(number)?number:null;\n}",
    "function finiteOrNull(value){\n  if(value===null||value===undefined||value==='')return null;\n  const number=Number(value);\n  return Number.isFinite(number)?number:null;\n}",
    'null-aware money formatting'
)

path=ROOT/'tests/r64-public-beta-gate.test.js'
text=path.read_text(encoding='utf-8')
text=text.replace("assert.equal(Gate.MODEL_META.version,'R6.4');","assert.equal(Gate.MODEL_META.version,'R6.4.1');")
text=text.replace("assert.equal(Gate.MODEL_META.releaseName,'Public Beta Gate');","assert.equal(Gate.MODEL_META.releaseName,'Output Integrity');")
path.write_text(text,encoding='utf-8')

path=ROOT/'tests/scenario-r4-ui.test.js'
text=path.read_text(encoding='utf-8')
text=text.replace("assert.match(gate,/version:'R6\\.4'/);","assert.match(gate,/version:'R6\\.4\\.1'/);")
path.write_text(text,encoding='utf-8')

print('R6.4.1 follow-up patch applied successfully.')
