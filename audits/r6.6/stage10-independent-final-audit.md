# R6.6 Stage 10 — Independent Final Audit

**Audit status: FAIL — not release ready**  
**Frozen calculation candidate audited:** `caa998f47346270c886606a3f0dc852a0864eaf8`  
**Audit date:** 2026-09-10  
**PR:** #13 `r6-6-decision-integrity`  

This audit is deliberately adversarial. It does not treat Stage 9.1 engineering-green evidence as proof of legal or model completeness. The purpose is to identify defects that can survive a consistent regression suite because the suite and implementation share the same assumptions.

## Executive conclusion

Stage 9.1 is technically well-regressed, but the frozen candidate is **not suitable for final public release as a decision-grade Dutch tax/planning calculator**. The audit found **six release blockers / major release findings**, plus two accepted/minor limitations and one repository-hygiene finding.

The most important failures are concentrated in non-main-residence property and tax interactions, NHG eligibility boundaries, and release traceability. These are not contradictions of the 258 passing tests or 100 browser parity pairs. Those tests prove internal consistency and state integrity. They do not prove that every legal rule represented by the model is complete.

## Release blockers and major findings

### F-01 — BLOCKER — 2026 current Box 3 actual return for non-main property is incomplete

**Affected:** `stage9-1-remediation.js`, non-main-residence purchase scenarios using current 2026 Box 3 and the actual-return / tegenbewijs comparison.

The Stage 9.1 property bridge adds the property's value change to `marketGain` and property mortgage interest to Box 3 debt interest. It does **not** model:

- rental income when the property is rented; or
- the 2026 own-use addition (`bijtelling eigen gebruik`) when a second home / other immovable property is available for private use.

From 2026 these components are part of actual return for immovable property. Omitting them can understate the actual-return tax. Because the calculator selects the lower of deemed-return tax and actual-return tax, this can create an artificially low Box 3 charge and can affect a scenario outcome.

**Required remediation:** either fully model the applicable 2026 direct property return components, including use/rental status and the official own-use route, or make current-law tax-adjusted non-main-property scenarios unavailable until those inputs are supplied.

**Status:** OPEN — release blocker.

### F-02 — BLOCKER — Proposed future Box 3 treatment taxes non-main property appreciation on the wrong basis

**Affected:** `stage9-1-remediation.js`, `future` and `transition` Box 3 modes for non-main real estate.

The Stage 9.1 property bridge sends annual modeled property appreciation into the generic proposed actual-return calculation. The current bill does not use ordinary annual accrual taxation for real-estate capital appreciation. Real estate is in the capital-gains branch, with gain generally recognized on realization, while the proposal also contains a separate real-estate direct-return / vastgoedbijtelling structure.

Therefore the current future/transition non-main-property path is structurally inconsistent with the bill it purports to model.

**Required remediation:** implement a real-estate-specific proposed-law path consistent with the current bill, or explicitly disable proposed/transition Box 3 for non-main-property scenarios.

**Status:** OPEN — release blocker.

### F-03 — BLOCKER — Enhanced NHG eligibility can return a false positive

**Affected:** `stage9-1-remediation.js` `nhg2026()` / purchase funding.

The current enhanced NHG check tests the combined €498,200 limit and whether entered qualifying energy expenditure covers the amount above €470,000. It does not enforce the official 2026 condition that the **non-energy cost stack remains within €470,000** and only qualifying energy-saving measures may lift the total to €498,200.

A property / base cost position already above €470,000 can therefore be accepted when enough energy expenditure is entered, even though the energy expenditure cannot retroactively make the non-energy part eligible.

**Required remediation:** separate the NHG `a–g` non-energy amount from item `h` qualifying energy measures. Require `a–g <= €470,000`, `a–h <= €498,200`, and retain the applicable financing/LTV checks.

**Status:** OPEN — release blocker.

### F-04 — BLOCKER — Manual transfer-tax mode is incorrectly used as a main-residence classification

**Affected:** `stage9-1-remediation.js` `isNonMain()` and all purchase tax routing.

The code currently infers non-main-residence status primarily from `transferTaxMode` (`other-home` / `other-real-estate`) or a starter-residence flag. `manual` transfer-tax mode therefore falls through as if the property were a main residence.

Transfer-tax calculation and income-tax / Box 3 classification are separate legal questions. A user may need a manual transfer-tax amount for a non-main property. Under the current design such a user can incorrectly receive owner-occupied Box 1 handling and omit the property from Box 3.

**Required remediation:** introduce an independent, explicit property-use / owner-occupied-main-residence field. Use it for Box 1 and Box 3 classification. Keep transfer-tax mode responsible only for transfer-tax calculation.

**Status:** OPEN — release blocker.

### F-05 — MAJOR / RELEASE BLOCKER — Exposed erfpacht and qualifying purchase-financing costs are not routed into Box 1 deductions

**Affected:** `scenario-engine.js`, Box 1 integration.

The Box 1 engine supports `additionalDeductibleOwnHomeCosts`, but the Scenario layer does not pass the exposed `groundLeaseAnnual` / erfpacht input into that tax calculation. It also does not distinguish the deductible portion of purchase financing costs. Under Dutch rules, periodic erfpacht payments can be deductible, and qualifying financing costs can include mortgage advice/intermediary costs, mortgage-deed notary costs, valuation costs for the mortgage/NHG, and NHG costs.

The calculator currently includes these amounts only as cash costs. For affected users this understates Box 1 relief and can bias tax-adjusted strategy comparisons.

**Required remediation:** add explicit deductible-cost classification rather than assuming all purchase costs are deductible. Pass periodic deductible erfpacht and the explicitly identified qualifying one-time financing costs through the annual Box 1 bridge. Alternatively, block the tax-adjusted comparison when such costs are present but unclassified.

**Status:** OPEN — release blocker for decision-grade release.

### F-06 — RELEASE GOVERNANCE BLOCKER — User exports/calculation evidence do not identify the exact source commit

**Affected:** `output-integrity.js`, `stage9-1-quality.js`, deployment/release process.

Exports include the R6.6 label, rule year and generated timestamp, but not the exact Git commit / immutable build identity. This fails the previously locked release requirement that calculation evidence identify the exact candidate that produced it.

A commit cannot safely embed its own resulting SHA in committed source because changing the content changes the SHA.

**Required remediation:** inject immutable release identity at build/deploy time (for example from `GITHUB_SHA`) or publish an immutable release artifact manifest and have exports include that build identity. The final release audit must be tied to the same immutable identity.

**Status:** OPEN — release governance blocker.

## Additional findings / limitations

### F-07 — MEDIUM hygiene — development dependency / lockfile cleanup

The repository pins Playwright 1.55.0 and CI reports one high-severity advisory in the development dependency tree. The static public calculator does not ship Playwright, so this is not evidence of a production-browser vulnerability. The lockfile also contains an extraneous absolute-path Playwright Core entry from a development runtime.

**Required before security-clean sign-off:** regenerate the lockfile in a clean environment, upgrade/re-audit the test dependency as appropriate, and confirm `npm audit` disposition.

**Status:** OPEN — repository/security hygiene, not a calculation blocker.

### F-08 — ACCEPTED MODEL LIMITATION — Box 3 tax-payment timing

The model settles a complete calendar year's Box 3 charge at the end of that modeled calendar year. This gives a clear deterministic cash-flow convention and is explicitly documented, but it is not intended to reproduce the actual timing of every provisional/final Dutch income-tax assessment.

**Required:** retain the disclosure. Do not describe modeled payment timing as statutory payment timing.

**Status:** acceptable planning limitation if disclosure remains visible.

### F-09 — MINOR NUMERICAL LIMITATION — Next Euro crossing search is a numerical scan, not a proof of every root

The Stage 9.1 break-even search scans the return range in 0.1 percentage-point increments and refines detected sign changes. This is substantially stronger than the previous endpoint-only search, but two very close roots within one scan interval could theoretically be missed if the interval endpoints have the same sign.

**Required:** describe this as a numerical search. Optional later hardening can use adaptive subdivision / monotonicity diagnostics.

**Status:** minor, not a release blocker.

## Findings closed by this independent audit

### C-01 — CLOSED — 2026 Box 1 rates and own-home high-income adjustment

The current 2026 rates and 11.94 percentage-point own-home adjustment used by the code align with current Belastingdienst material.

### C-02 — CLOSED — Hillen 2026 rate and former Article 2.10 interpretation conflict

The current Belastingdienst example explicitly limits the high-income adjustment base to deductible own-home costs when the threshold overlap is larger. This now agrees with the implementation's statutory ceiling. The previously recorded source conflict is no longer an unresolved release issue.

### C-03 — CLOSED — 2026 current Box 3 headline parameters

The code's 36% tax rate, €59,357 per-person allowance, 6.00% other-assets factor, 1.28% provisional savings factor, 2.70% provisional debt factor and €3,800 per-person debt threshold match the current published 2026 structure. The 6.00% / €59,357 values reflect the adopted parliamentary change rather than the earlier Budget Day proposal.

### C-04 — CLOSED — 2026 transfer-tax headline rates / starter ceiling

2% main residence, 8% other residential property, 10.4% other real estate, and €555,000 starter ceiling are aligned with current 2026 rules.

### C-05 — CLOSED — Stage 9.1 state and browser parity

The engineering evidence remains valid: 258/258 Node tests and the full real-browser Imported/Fresh parity matrix passed on the engineering-green implementation, including desktop/mobile, save/reload, explicit Refresh and Fresh isolation.

### C-06 — CLOSED — CSV injection / accessibility table / third-party browser integrity

Stage 9.1 contains spreadsheet-formula neutralization, a text/table alternative for the main chart, and explicit integrity controls for the external Chart.js asset. No new blocker was found in these areas.

## Release decision

**DO NOT MERGE PR #13.**

The candidate remains a strong engineering baseline but is not yet final-release ready. The correct next phase is a focused **Stage 10 remediation** of F-01 through F-06, followed by:

1. targeted regression tests for every blocker;
2. full 258+ Node suite;
3. remediated deterministic 50-scenario matrix with explained changes and leader-change review;
4. full 50 desktop + 50 mobile browser parity matrix;
5. re-run of the independent legal/fact audit against the exact remediated candidate;
6. manual user UX test;
7. final immutable release identity and sign-off;
8. explicit merge authorization from the repository owner.

Until those steps are complete, PR #13 must remain draft and `main` must remain unchanged.
