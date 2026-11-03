# R6.6 Stage 6: canonical results and exports

**Stage status:** complete and verified locally, not pushed

**Authoritative Stage 5 head:** `b332b805d09c7731d07a9bd891d37eb8ba55216a`

**Local Stage 5 comparison commit:** `b03347389d6bd4ff815b28e63b46940424763cb4` (same tree as the authoritative head)

**Branch:** `r6-6-decision-integrity`

**Public `main`:** unchanged during Stage 6

## Purpose

Stage 6 fixes the accepted output-integrity findings without changing the financial engine:

1. before-Box-3 and after-Box-3 values now have separate authoritative fields;
2. cards, result tables, charts, the audit log and CSV exports consume versioned canonical result records;
3. strategy conclusions put assumption dependence before the modeled outcome and avoid unconditional winner language.

## Canonical output contract

`output-integrity.js` now owns one versioned, typed result contract with three calculation variants:

| Variant | Canonical identifier | Consumers |
|---|---|---|
| Main plan | `dimp.canonical-plan-result.v1` | headline cards, Box 3 summary, year table, household summary, return cards, chart, audit log and CSV |
| Decision comparison | `dimp.canonical-comparison-result.v1` | strategy cards, sources-and-uses table, result breakdown, sensitivity table, verdict, audit log and CSV |
| Next Euro | `dimp.canonical-next-euro-result.v1` | break-even summary, quick-amount table, audit log and CSV |

Formatting happens after the canonical numeric record is created. The screen and export adapters therefore cannot independently choose a similarly named raw field.

## Before and after Box 3

The before-Box-3 portfolio is now produced by a separate run of the same plan with `box3Mode: none`. The after-Box-3 portfolio comes from the selected Box 3 run. The model does not reconstruct the before-tax value by adding cumulative tax back to the ending portfolio, because annual payment timing, lost compounding and payment source make that identity unreliable.

Equal before and after portfolio values can still be correct. The payment source determines which balance changes:

| Payment source | Portfolio effect | Savings effect | External effect |
|---|---|---|---|
| Investment portfolio | Settled tax withdrawals and lost future compounding reduce the portfolio | None from the tax payment itself | Only any shortfall |
| Savings / cash | Portfolio can remain equal to the no-Box-3 counterfactual | Settled tax withdrawals and lost savings yield reduce savings | Only any shortfall |
| External cash flow | Portfolio can remain equal | Savings can remain equal | Tax and its horizon opportunity cost are recorded separately |

The deterministic three-year production probe produced:

| Source | Portfolio before | Portfolio after | Savings before | Savings after | Tax field | Horizon external outflow |
|---|---:|---:|---:|---:|---:|---:|
| Portfolio | €250,869.65 | €237,536.33 | n/a | n/a | €12,710.66 from portfolio | n/a |
| Savings | €250,869.65 | €250,869.65 | €53,060.40 | €39,967.17 | €12,845.71 from savings | n/a |
| External | €250,869.65 | €250,869.65 | €53,060.40 | €53,060.40 | €12,934.82 external tax | €13,561.08 |

Tax totals can differ slightly by source because each source changes later account returns and therefore can change a later actual-return Box 3 calculation.

## Unavailable results

If the selected Box 3 calculation is not estimable, the canonical record:

- keeps the separately calculated before-Box-3 projection available;
- sets tax-adjusted fields to `null`;
- renders those fields as `Unavailable` on screen;
- exports them as blank numeric cells with an explicit status and reason;
- blocks the tax-adjusted year table instead of displaying a false zero.

## Decision language

The decision verdict now begins with `Under the entered assumptions`. It reports which strategy has more modeled wealth and the amount at the selected horizon. It does not describe a strategy as a winner or as clearly ahead.

Next Euro uses `Higher modeled wealth at your return`, and the sensitivity table describes the strategy with higher modeled wealth only within the tested assumptions.

## Deterministic impact

Stage 6 is an output-contract change. Comparing the complete Stage 6 working tree with the exact Stage 5 tree produced:

| Gate | Result |
|---|---:|
| Scenarios compared | 50 / 50 |
| Scenarios changing numerically | 0 |
| Protected economic fields changing | 0 |
| Scenario leaders changing | 0 |
| Canonical payment-source and export checks | 17 / 17 passed |

The protected fields include final comparable wealth, investments, savings, Box 3 debt, home equity, mortgage balance, owner costs, gross interest, Box 1 effect, purchase costs, selling costs, external tax, external debt repayment, Box 3 debt interest and terminal value of dated external outflows.

## Verification

- 217 of 217 Node tests pass;
- 50 of 50 deterministic scenarios reconcile to the canonical displayed values;
- the selected production plan is unchanged when the canonical record is attached;
- portfolio, savings and external Box 3 payment-source identities pass;
- screen and CSV adapters use the same explicit canonical fields;
- unavailable tax-adjusted values remain blank rather than zero in CSV;
- forbidden winner and lead wording is absent from user-facing decision conclusions;
- JavaScript syntax checks and `git diff --check` pass.

The local Chromium executable is unavailable in this work environment. After an authorized push, the existing GitHub browser-responsiveness workflow remains the authoritative browser gate. Reproducible local browser packaging is part of Stage 7.

## Reproducibility

`audits/r6.6/capture-stage6-results.js` accepts a Stage 5 repository root and an optional Stage 6 repository root:

```bash
node audits/r6.6/capture-stage6-results.js /path/to/stage5 /path/to/stage6
```

It compares the 50-scenario matrix, checks all protected economic fields and leaders, and runs the canonical payment-source, export and wording probes. It exits nonzero if any gate fails.

## Boundaries retained

- Stage 6 does not change financial formulas, scenario leaders, policy values or public release identity.
- It does not reinterpret a legitimately equal portfolio balance as a defect when tax is paid from savings or externally.
- Strict input enforcement, saved-state migration and locally reproducible browser tests remain Stage 7 work.
- Final logic and primary-source review remain Stage 8 work.

The next controlled checkpoint is Stage 7: validation, state migration and reproducible browser tests.
