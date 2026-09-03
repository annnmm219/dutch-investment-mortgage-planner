# R6.6 Stage 3 delivery note

**Verified implementation commit:** `bb3360b6487aa59665a38bdb61a2f52a6e0561e6`  
**Final cleaned Stage 3 branch head:** `05e6cab6f8643b8b9446b2b4ad218e6a9b9936ff`

Stage 3 was committed only after the complete scenario-local purchase-rule gate passed.

- 178 of 178 Node tests passed.
- 50 of 50 deterministic scenarios reconciled.
- No control-scenario value or leader changed because their prior total costs were decomposed into 2% transfer tax plus residual other costs.
- A €600,000 main-residence purchase produces €12,000 transfer tax.
- Starter age, residence, prior-use and €555,000 ceiling conditions were tested.
- NHG fees recalculate by strategy mortgage amount.
- Purchase sources and uses reconcile to zero.
- Mortgage-tab purchase and tax mutations do not change the active purchase scenario.
- Chromium responsiveness passed.
- Public `main` remains on frozen R6.5.

## Delivery controls

The Stage 3 build gate stopped on intermediate patch-generation and test-fixture failures before any generated product source was committed. The accepted implementation was produced only after the patch applied cleanly, all regression and reconciliation checks passed, and the real-browser isolation test proved that changing Mortgage-tab purchase and tax values does not change an active Buy-versus-Rent or Down-Payment scenario.

A later audit of the draft pull request found that a workflow installation had accidentally committed the local `node_modules` directory. This was a repository-hygiene defect, not a calculation defect. The complete generated dependency tree was removed in commit `05e6cab6f8643b8b9446b2b4ad218e6a9b9936ff`, and `.gitignore` now excludes:

- `node_modules/`
- `playwright-report/`
- `test-results/`

After cleanup:

- the pull request fell from 516 changed files to 59 intentional files;
- the normal Finance regression workflow passed again;
- the Chromium responsiveness workflow passed again;
- the Stage 3 calculation implementation and evidence remained unchanged.

The bounded Box 1 own-home tax bridge remains Stage 4 and was not activated here.
