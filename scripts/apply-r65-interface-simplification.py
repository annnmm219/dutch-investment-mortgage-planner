from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: str, old: str, new: str, label: str) -> None:
    file = ROOT / path
    text = file.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match in {path}, found {count}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


# R6.5 is a presentation-only release. Update active runtime and test identities,
# but do not rewrite historical Markdown release notes.
text_extensions = {".js", ".html", ".json", ".yml", ".yaml"}
updated = []
for file in ROOT.rglob("*"):
    if not file.is_file() or ".git" in file.parts or "node_modules" in file.parts:
        continue
    if file.suffix.lower() not in text_extensions:
        continue
    text = file.read_text(encoding="utf-8")
    revised = text.replace("R6.4.2", "R6.5")
    if revised != text:
        file.write_text(revised, encoding="utf-8")
        updated.append(str(file.relative_to(ROOT)))

# Give the two public metadata objects the release name used in the interface.
for relative in ("logic-integrity-ui.js", "output-integrity.js"):
    file = ROOT / relative
    text = file.read_text(encoding="utf-8")
    revised = text.replace("releaseName:'Output Integrity'", "releaseName:'Interface Simplification'")
    if revised != text:
        file.write_text(revised, encoding="utf-8")
        if relative not in updated:
            updated.append(relative)

# The visible Box 3 switch must be created while the original tax card still
# owns the underlying fields. The local advanced fold may move them afterward.
replace_once(
    "view-density.js",
    "injectStyle();compactSaveBar();simplifyStaticCopy();ensurePlanTiming();ensureBox3Advanced();ensureBox3Simple();ensureJan1Gate();",
    "injectStyle();compactSaveBar();simplifyStaticCopy();ensurePlanTiming();ensureBox3Simple();ensureBox3Advanced();ensureJan1Gate();",
    "Box 3 simple-control ordering",
)
replace_once(
    "view-density.js",
    "const mode=$('box3Mode'),card=mode?.closest('.card');",
    "const mode=$('box3Mode'),card=$('sBox3')?.closest('.card')||mode?.closest('.card');",
    "Box 3 tax-card fallback",
)

print("R6.5 interface release patch applied.")
print("Updated tracked files:")
for path in sorted(updated):
    print(f"- {path}")
