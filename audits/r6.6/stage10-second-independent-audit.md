# R6.6 Stage 10 — Second Independent Audit

**Audit date:** 14 September 2026  
**First-audit candidate:** `caa998f47346270c886606a3f0dc852a0864eaf8`  
**Frozen calculation source:** `31c08ffea3cb94e66692ad4c9505b2b7b8778e61`  
**Freeze metadata commit:** `bd262a5dd93e9bea3075d3c22647751c975cf290`  
**Build ID:** `R6.6-stage10-31c08ffe`  
**Verdict:** `PASS_ORIGINAL_SIX_REMEDIATIONS_PUBLIC_RELEASE_HARDENING_PENDING`  
**Merge authorization:** No.

## 1. Executive conclusion

The six release blockers / major findings from the first Stage 10 independent audit (F-01 through F-06) are **closed as remediated** on the frozen R6.6 calculation source.

The independent re-audit did not find a new arithmetic, state-integrity, or legal-model defect in those six remediation paths. The frozen build passes the complete Finance regression suite and the genuine browser parity matrix.

However, this is **not yet a public-release sign-off**. The re-audit identified two new public-facing scope/input-definition issues:

- **F-10 — Box 3 rental-input definition:** the UI says “gross annual rent / pacht income”, while the Dutch actual-return method uses received basic rent (`kale huur`), excluding service charges.
- **F-11 — NHG purchase scope:** the implemented 2026 a–g / a–h cap structure is the existing-home NHG rule. The public flow does not yet explicitly state/block new-build purchases or model the separate new-build item structure.

F-07 dependency hygiene also remains open; F-08 and F-09 remain accepted disclosed limitations.

PR #13 must therefore remain **draft and unmerged**.

## 2. Frozen release identity and evidence

R6.6 now carries an immutable calculation identity:

- Calculation source: `31c08ffea3cb94e66692ad4c9505b2b7b8778e61`
- Build ID: `R6.6-stage10-31c08ffe`
- Freeze metadata commit: `bd262a5dd93e9bea3075d3c22647751c975cf290`

`release-identity.js` supplies the frozen source identity, and Stage 10 prepends the exact calculation-source commit and build identity to canonical exported calculation evidence.

The freeze metadata commit does not alter calculation logic.

### Finance gate

Workflow run `34901331827` passed on the freeze head:

- **277 / 277 tests passed**
- **0 failures**
- Legacy deterministic matrix: **50 / 50 reconciled**
- Stage 9 Imported-vs-Fresh matrix: **50 exact pairs**
- Stage 9.1 deterministic matrix: **50 / 50**
- Stage 10 deterministic matrix: **50 / 50**
- Stage 10 explained tax-effect changes: **19**
- Stage 10 comparable-wealth changes: **14**
- Stage 10 leader changes: **0**
- Stage 10 unexplained changes: **0**

### Browser gate

Workflow run `34901331748` passed on the exact freeze head. GitHub Actions checked out PR merge commit `e19e6898ffa572696164d5794f924cf55bad1d64`, containing frozen head `bd262a5dd93e9bea3075d3c22647751c975cf290` over unchanged base `ac8f029788ff8d1fc2baf09fbc89b848a28f7803`.

Stage 10 genuine browser parity:

- desktop exact pairs: **50 / 50**
- mobile exact pairs: **50 / 50**
- Buy vs Rent: 10 per viewport
- Down Payment: 10 per viewport
- Mortgage vs Invest: 10 per viewport
- Linear vs Annuity: 10 per viewport
- Sell vs Rent: 10 per viewport
- save/reload: passed
- explicit Refresh: passed
- Fresh isolation: passed
- property classification: passed
- current-law non-main-property return: passed
- proposed/transition non-main-property block: passed
- exact NHG caps: passed
- deductible-cost path: passed
- export identity: passed
- browser errors: **0**

Retained browser transcript artifact:

- Artifact ID: `10372065651`
- Name: `stage91-browser-test-e19e6898ffa572696164d5794f924cf55bad1d64`
- SHA-256: `75bc8dcf118ee15de183c29cd0ce1e6cbeaf55b51591bd5af11a8aeedda60e58`

## 3. Re-audit of original Stage 10 findings

### F-01 — Current Box 3 / non-main property — CLOSED_REMEDIATED

The current-law non-main-property path now:

- includes received rental/pacht income as economic cash inflow;
- includes that income in current-law actual-return testing;
- includes the 2026 private-use addition using the fixed 5.06% route and private-use-day fraction;
- requires the relevant prior-year WOZ when private use is positive;
- exposes rental income, own-use addition and total property direct return in annual audit buckets;
- prevents non-main property from receiving Box 1 mortgage relief.

This closes the calculation defect found in the first audit.

**Primary-source basis:** Belastingdienst, “Wat is mijn werkelijk rendement?” and official actual-return examples for a rented second home / holiday home.

### F-02 — Proposed/transition Box 3 / non-main property — CLOSED_REMEDIATED

R6.6 no longer applies the generic proposed accrual model to non-main real estate. Future and Transition Box 3 modes are explicitly unavailable for tax-adjusted non-main-property comparisons.

That conservative block is appropriate because the current bill uses a real-estate-specific treatment for direct return and value development. R6.6 does not pretend that the bill is already final law.

**Primary-source basis:** Rijksoverheid and parliamentary material for the Wet werkelijk rendement box 3 proposal and its intended 2028 start.

### F-03 — NHG 2026 exact cap logic — CLOSED_REMEDIATED

For the supported existing-home purchase route, the Stage 10 exact NHG check separately enforces:

- official non-energy cost stack a–g ≤ €470,000;
- total a–h including qualifying energy measures ≤ €498,200;
- the related standard and energy loan limits;
- energy expenditure support for the enhanced route.

The standalone Mortgage-tab purchase surface is fail-safe: without the exact official cost-stack inputs it does not present an NHG eligibility pass or charge an NHG fee.

**Primary-source basis:** NHG Voorwaarden & Normen 2026, C.2.1.

### F-04 — Property classification — CLOSED_REMEDIATED

Property income-tax classification is now explicit:

- main residence / own home → Box 1 route where eligible;
- non-main property / other real estate → Box 3 route.

Manual transfer-tax selection no longer determines Box 1 versus Box 3 classification.

**Primary-source basis:** Belastingdienst own-home definition, second-home Box 3 guidance, and 2026 transfer-tax rules.

### F-05 — Box 1 erfpacht / financing costs — CLOSED_REMEDIATED

The annual Box 1 bridge now receives:

- periodic erfpacht when the itemized owner-cost route is active;
- the user-classified deductible mortgage-financing-cost subset in the purchase year;
- calculated NHG fee only to the Box 1 qualifying-debt share.

A hidden ground-lease amount in combined-total owner-cost mode is not silently deducted.

**Primary-source basis:** Belastingdienst deductible own-home costs guidance, including financing costs, mortgage-deed/valuation/NHG costs and periodic erfpacht, limited to costs relating to the `eigenwoningschuld`.

### F-06 — Immutable release identity — CLOSED_REMEDIATED

Exports and calculation evidence now carry the immutable calculation-source SHA and build ID. The exact frozen build passed both Finance and browser gates.

This removes the prior ambiguity where an exported result could identify only “R6.6” rather than the exact source used to calculate it.

## 4. New findings from the second audit

### F-10 — Rental-input definition — MAJOR / OPEN / PUBLIC-RELEASE BLOCKER

The implementation currently labels the non-main-property input as **“Gross annual rent / pacht income.”**

For the Dutch current-law actual-return route, Belastingdienst examples use the received **basic rent (`kale huur`)**, with service charges excluded. Leaving “gross rent” in the UI creates a plausible data-entry error even though the tax engine itself is functioning as designed.

**Required remediation before public release:**

- rename the field to something equivalent to **“Annual basic rent / pacht received (excluding service charges)”**;
- state explicitly that service charges are excluded;
- keep the existing disclosure that ordinary property operating / maintenance costs are not deducted from current-law actual Box 3 return.

This finding does **not** reopen F-01; it is an input-definition / disclosure defect.

### F-11 — Existing-home NHG scope — MAJOR / OPEN / PUBLIC-RELEASE BLOCKER

The exact NHG cap logic implemented in F-03 follows the 2026 **existing-home purchase** structure in NHG C.2.1.

NHG has a separate 2026 new-build structure in C.2.2, including a different item grouping for the €470,000 and €498,200 tests. The calculator currently has no explicit new-build mode and no clear existing-home-only warning.

**Required remediation before public release:**

Either:

1. explicitly scope/block the existing purchase/NHG route as **existing-home only**, or
2. implement a separate new-build flow using NHG C.2.2 and the associated new-build purchase-tax/VAT treatment.

This finding does **not** reopen F-03; the existing-home calculation tested under F-03 is correct.

## 5. Remaining non-blocking / accepted findings

### F-07 — Dependency hygiene — OPEN / MEDIUM

Playwright remains a development-only dependency, but the current clean CI install reports one high-severity advisory and the lockfile retains an extraneous absolute-path Playwright-core record.

This does not change static production calculator arithmetic, but it should be cleaned before a security-clean repository sign-off.

### F-08 — Box 3 tax-payment timing — ACCEPTED

The model deterministically settles Box 3 at calendar year-end rather than reproducing the timing of every real assessment/payment. This remains acceptable with disclosure.

### F-09 — Next Euro numerical crossing search — ACCEPTED

The 0.1 percentage-point scan plus refinement is a numerical search, not a mathematical proof that arbitrarily close multiple roots cannot exist. This remains acceptable with disclosure.

## 6. Primary-source fact check retained

The second audit rechecked the statutory/policy assumptions materially touched by Stage 10. No new contradiction was found in the implemented calculations.

Key retained 2026 values include:

- current Box 3 tax rate: 36%;
- heffingsvrij vermogen: €59,357 per person;
- provisional savings return: 1.28%;
- other-assets return: 6.00%;
- provisional debt return: 2.70%;
- 2026 main-residence transfer tax: 2%;
- 2026 residential non-main transfer tax: 8%;
- standard NHG limit: €470,000;
- energy NHG ceiling: €498,200;
- NHG fee: 0.4%.

Primary sources used include:

- Belastingdienst — Box 3 actual return and examples: https://www.belastingdienst.nl/wps/wcm/connect/nl/box-3/content/wat-is-mijn-werkelijk-rendement
- Belastingdienst — deductible costs for the own home / mortgage
- Belastingdienst — 2026 provisional-assessment rates and credits
- Belastingdienst — transfer-tax and starter-exemption guidance
- NHG — Voorwaarden & Normen 2026, C.2.1 and C.2.2: https://www.nhg.nl/voorwaarden-en-normen/
- Rijksoverheid / parliamentary material — Wet werkelijk rendement box 3 proposal

## 7. Final second-audit verdict

**The six original Stage 10 findings F-01 through F-06 are closed.**

The frozen R6.6 calculation source is internally reconciled, passes 277/277 Finance tests, passes the 50-scenario Stage 10 impact matrix with zero leader or unexplained changes, and passes 50 desktop + 50 mobile genuine browser parity pairs with zero browser errors.

However, **public release remains blocked by F-10 and F-11**, and F-07 remains an open dependency-hygiene item.

Recommended next sequence:

1. remediate F-10 and F-11;
2. rerun focused + full gates;
3. clean/re-audit F-07;
4. persona acceptance testing and owner manual UX testing;
5. final release sign-off;
6. merge PR #13 only with explicit repository-owner authorization.
