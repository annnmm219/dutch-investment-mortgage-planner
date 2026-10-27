# R6.6 Stage 9.1 Engineering Green

Date: 2026-09-08
Branch: `r6-6-decision-integrity`
Engineering-green head: `86ac86ac399487b48b7912324ac477162eae8d48`
PR: #13

## Decision

**Stage 9.1 is engineering green.**

This status means the Stage 9.1 calculation, state-integrity, browser-parity and release-hardening gates all pass on the exact branch head above. It does **not** merge the draft PR and it does not replace the final independent logic and primary-source fact audit required before public release.

## Finance regression gate

GitHub Actions workflow: `Finance regression tests`, run 231.

- Node 24
- tests: **258**
- passed: **258**
- failed: **0**
- skipped: **0**
- cancelled: **0**

### Deterministic scenario evidence

Legacy R6.6 deterministic matrix:

- scenarios: **50**
- reconciled: **50**
- failures: **0**

Stage 9 imported-versus-fresh deterministic route matrix:

- matched datasets: **50**
- imported calculations: **50**
- fresh calculations: **50**
- total calculations: **100**
- equal pairs: **50**
- mismatches: **0**

Stage 9.1 remediated deterministic matrix:

- scenarios: **50**
- reconciled: **50**
- numerical changes: **4**
- changed IDs: `buy-rent-1`, `buy-rent-5`, `downpayment-1`, `downpayment-5`
- leader changes: **0**
- unexplained changes: **0**

The four numerical changes are the expected purchase-HRA corrections introduced by Stage 9.1. No decision leader changed.

## Browser engineering gate

GitHub Actions workflow: `Browser responsiveness`, run 127.

Legacy browser contracts:

- Chromium responsiveness: passed
- Stage 7 strict validation and saved-state migration: passed
- Stage 9 explicit source ownership, snapshot stability, Refresh and Fresh isolation: passed
- browser page errors: **0**

Focused mortgage-method regression contract:

- case: `mortgage-invest-2`
- imported mortgage method: Linear
- Fresh mortgage method: Linear
- active input sets: identical, **56 / 56**
- config parity: passed
- canonical-result parity: passed
- ledger parity: passed
- browser errors: **0**

### Genuine Stage 9.1 browser parity

The production UI was driven through both Scenario entry routes and compared after save/reload and explicit Refresh behavior.

- datasets per viewport: **50**
- desktop exact pairs: **50 / 50**
- mobile exact pairs: **50 / 50**
- total exact browser pairs: **100 / 100**
- modes: 10 each of Buy vs Rent, Down Payment, Mortgage vs Invest, Linear vs Annuity, Sell vs Rent
- save/reload preservation: passed
- explicit Refresh: passed
- Fresh isolation: passed
- browser errors: **0**

## Stage 9.1 remediation now covered

Engineering evidence covers the following Stage 9.1 changes and blockers:

1. common monthly investment contribution is explicit and conserved in Scenario calculations;
2. Box 3 debt-post-payoff destination is explicit and shared with Next Euro;
3. planned-purchase mortgage-interest relief uses explicit qualifying debt share and remaining HRA duration rather than assuming 100% / 30 years;
4. enhanced NHG requires sufficient qualifying energy expenditure;
5. non-main-residence purchase property/debt is represented in Box 3 and receives no Box 1 owner-occupied relief;
6. imported Scenario state is a frozen snapshot until explicit Refresh, and Fresh does not read hidden planner state;
7. imported mortgage method follows the authoritative Stage 9.1/live Mortgage selection instead of stale planner state;
8. active Scenario inputs, canonical results and calculation ledgers are route-parity tested in real Chromium on desktop and mobile;
9. CSV export neutralizes spreadsheet-formula injection prefixes;
10. a text/table alternative exists for the principal investment/mortgage chart;
11. local browser module order and third-party browser asset integrity are regression tested.

## Remaining boundaries

Engineering green is not the same as public-release approval. The following remain outside this gate:

- final independent logic audit;
- final independent Dutch law / primary-source fact audit;
- adjudication of any unresolved statutory-source conflicts recorded elsewhere in the R6.6 audit folder;
- final product/release decision and merge of PR #13.

CI also reports one high-severity advisory in the **development-only Playwright dependency tree**. Playwright is used only for CI/browser testing and is not shipped to users in this static application. This is therefore tracked as dependency hygiene rather than a Stage 9.1 calculation/browser-integrity blocker, but it should be upgraded or otherwise resolved before treating the repository itself as fully security-clean.

## Reproduction

From the repository root:

```bash
npm ci
npm test
npm run test:e2e
```

Expected engineering-green result:

- Finance tests: 258 / 258 pass
- Stage 9.1 deterministic matrix: 50 / 50 reconcile, 0 leader changes, 0 unexplained changes
- Stage 9.1 genuine browser parity: 50 / 50 desktop and 50 / 50 mobile exact pairs
- browser errors: 0
