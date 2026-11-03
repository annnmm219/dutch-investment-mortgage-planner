# R6.5 audit baseline

This directory freezes the evidence used to begin **R6.6 Decision Integrity**.

## Stage 0 status

**Complete.** No financial formula, tax rule, amortisation rule, scenario rule, or public R6.5 file was changed.

- Node regression suite: **143 passed, 0 failed**
- Deterministic scenario reconciliation: **50 of 50 passed**
- Runtime used for the baseline capture: **Node v24.19.0**
- Generated evidence commit on the R6.6 branch: `b1c9d6ff63d482bd20ee6b2cb812d0ffad1ec2f3` and subsequent manifest refresh

## Baseline

- Release: `R6.5 Interface Simplification`
- Baseline commit: `ac8f029788ff8d1fc2baf09fbc89b848a28f7803`
- Baseline tag: `r6.5-audit-baseline`
- R6.6 working branch: `r6-6-decision-integrity`
- Baseline date: 3 September 2026

The annotated tag resolves to the exact R6.5 release commit above. Audit documents and generated reference outputs belong on the R6.6 branch and do not change the tagged baseline.

## Source audit provenance

The external audit supplied for this review was preserved from these uploaded files:

| File | SHA-256 |
|---|---|
| `Pasted markdown(1).md` | `94fdf7cfef6a16c30b08c1abad9ee9228f664cb13740ac2428a6a216e9b4b4c3` |
| `dutch-investment-mortgage-planner-complete-audit.zip` | `758b8e1e7b6fb250fb34de8ad1d39c6c78c3d2add0f94617b7f07b5d386fe50d` |
| Extracted `00_COMPLETE_AUDIT_REPORT.md` | `60f1b92ce458dcd73e6e594bc08ca4fc13425d327d734577de275b49ffe00276` |
| Extracted `08_source_evidence_index.md` | `4049bf680ac7e3db07de9f14017c265f2ecb6ce0fbaf3f6b1f3b77dcfff83fc2` |
| Extracted `09_independent_test_cases.csv` | `6e6999d1f81c64dd45fb08e878dd1333dce650b347d27ab7caaffa8702cda0c2` |

`external-audit-2026-09-03.md` preserves a source-derived repository record. `finding-adjudication.md` records which findings were accepted, narrowed, or rejected after checking the tagged R6.5 source. The original upload hashes remain the provenance authority for exact source wording.

## Generated baseline evidence

- `baseline-test-output.txt`, complete Node regression output;
- `baseline-50-scenario-output.txt`, the deterministic 50-case reconciliation result;
- `reference-cases.json`, five representative R6.5 cases;
- `baseline-manifest.json`, commit, tag, runtime and pass/fail summary;
- `capture-reference-cases.js`, the deterministic generator for the five cases.

The five captured cases are:

1. investment without Box 3;
2. investment under the current Box 3 model;
3. Buy versus Rent;
4. Extra Repayment versus Invest;
5. Linear versus Annuity.

These are deliberately R6.5 outputs. They are comparison evidence, not golden expected values for R6.6. Stage 2 will legitimately change investment-sensitive results when annual-rate semantics are corrected.

## Scope freeze

Until the R6.6 audit sequence is complete, do not add:

- new scenario types;
- Nibud or lender affordability;
- Monte Carlo forecasting;
- additional tax categories;
- another Standard/Advanced interface split;
- unrelated visual redesign.

R6.6 is limited to confirmed decision-integrity work: rate semantics, purchase-scenario isolation, the bounded Box 1 own-home bridge, economic consistency, canonical results and exports, validation, state migration, and reproducible browser testing.
