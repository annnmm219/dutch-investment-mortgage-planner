# R6.6 Stage 7: validation, saved-state migration and browser reproducibility

**Stage status:** complete and pushed
**Branch:** `r6-6-decision-integrity`  
**Stage 6 baseline:** `6708c7cedd3eb6c603549184e5c1db9eab8372d2`  
**Public `main`:** unchanged

## Delivered controls

- Required numeric browser inputs now distinguish blank, invalid, out-of-range and explicit zero values.
- The main plan, scenario comparison and Next Euro surfaces stop before calculation when a required input is invalid.
- Blocked surfaces publish canonical unavailable results, clear stale figures and export blank numeric fields rather than false zeroes.
- Optional values remain optional only where the model defines a fallback or a separate conditional gate.
- Invalid fields receive `aria-invalid="true"` and a visible error treatment.

## Saved-state migration

The browser snapshot contract is now `dimp.planner-state.v2`, schema 2. Schema 1 snapshots migrate in place. The migration:

- preserves explicit zeroes and checkbox false values;
- maps the former `grossIncome` snapshot to the visible `grossAnnualIncome` control;
- validates control-key and entry shapes before replay;
- drops malformed or oversized entries;
- rejects unknown future schemas rather than guessing.

## Reproducible browser suite

Playwright is pinned at `1.55.0` in `devDependencies` and locked by `package-lock.json`. The local and CI contract is:

```bash
npm ci
npx playwright install chromium
npm run test:e2e
```

`test:e2e` runs the existing responsiveness smoke test and the Stage 7 invalid-input/migration browser contract.

## Verification

| Gate | Result |
|---|---:|
| Node tests | 224 / 224 passed |
| Deterministic scenario reconciliation | 50 / 50 passed |
| Stage 6 to Stage 7 numerical record changes | 0 |
| Scenario leader changes | 0 |
| Browser contracts | 2 / 2 passed |
| Chromium page errors | 0 |
| JavaScript syntax | passed |
| Diff check | passed |

Stage 7 changes browser boundary behavior only when inputs are missing or invalid. Valid financial inputs produce the same numerical records as Stage 6.
