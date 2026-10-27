# R6.6 Stage 3 delivery note

**Clean Stage 1 commit:** `fee582d39a73623d1810433b952d757c61cba21d`  
**Clean Stage 2 commit:** `9a9df1216879a09378db6e449dd5e07c2f85dc54`  
**Clean Stage 3 calculation and evidence commit:** `ba0ba600fb8451f8405eca69de6f5803c8706619`

Stage 3 was accepted only after the complete scenario-local purchase-rule gate passed.

- 178 of 178 Node tests passed.
- 50 of 50 deterministic scenarios reconciled.
- No control-scenario value or leader changed because the prior control totals were decomposed into 2% transfer tax plus residual other costs.
- A €600,000 main-residence purchase produces €12,000 transfer tax.
- Starter age, residence, prior-use and €555,000 ceiling conditions were tested.
- NHG fees recalculate by strategy mortgage amount.
- Purchase sources and uses reconcile to zero.
- Mortgage-tab purchase and tax mutations do not change the active purchase scenario.
- Chromium responsiveness passed.
- Public `main` remains on frozen R6.5.

## Delivery controls

The Stage 3 build gate stopped on intermediate patch-generation and test-fixture failures before any generated product source was accepted. The verified implementation was retained only after the patch applied cleanly, all regression and reconciliation checks passed, and the real-browser isolation test proved that changing Mortgage-tab purchase and tax values does not change an active Buy-versus-Rent or Down-Payment scenario.

A repository audit then found generated Playwright dependencies in the intermediate branch history. The staged branch was rebuilt from clean Stage 1 and Stage 2 trees, with the final Stage 3 tree applied as a single clean commit. The one-time Stage 0 capture workflow was retired after it attempted to refresh frozen R6.5 evidence against later-stage code. The original R6.5 baseline evidence was restored byte-for-byte.

`.gitignore` now excludes:

- `node_modules/`
- `playwright-report/`
- `test-results/`

After cleanup:

- the pull request contains three intentional calculation-stage commits, plus this documentation-only update;
- the pull request contains 58 intentional changed files rather than 516 generated-file changes;
- the normal Finance regression workflow passed after cleanup;
- the Chromium responsiveness workflow passed after cleanup;
- the R6.5 baseline manifest remains 143 tests and 50 reconciled scenarios;
- Stage 3 product calculations and evidence remain unchanged.

The bounded Box 1 own-home tax bridge remains Stage 4 and was not activated here.
