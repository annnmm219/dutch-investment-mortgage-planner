# R6.5 external-audit adjudication

**Baseline:** `ac8f029788ff8d1fc2baf09fbc89b848a28f7803`  
**Decision:** Use the audit as a challenge document, not as an unquestioned source of truth.

The external audit correctly identified several decision-layer risks, but it also described parts of an older or different implementation. The R6.6 scope therefore includes only findings confirmed against the tagged R6.5 source.

## Accepted findings

| ID | Finding | R6.5 evidence | R6.6 disposition |
|---|---|---|---|
| A1 | Effective annual investment and growth assumptions are divided by 12 before monthly compounding | `finance-core.js` uses `/100/12` for investment and savings growth; `scenario-engine.js` uses `/100/12` for rent and home growth | Correct in Stage 2; mortgage contractual interest remains nominal divided by 12 |
| A2 | Buy-versus-Rent and Down-payment scenarios can consume the Mortgage tab's purchase-cost total | Browser scenario configuration reads the shared `purchaseCosts` value while the scenario owns a separate price and down payment | Isolate purchase scenarios in Stage 3 |
| A3 | The Box 1 own-home bridge compresses interest, EWF and Hillen into one rate | `mortgageTaxBenefit()` applies one deduction-rate proxy to the net own-home amount | Replace with a bounded 2026 before/after tax delta in Stage 4 |
| A4 | Export semantics do not contain distinct canonical before-Box-3 and after-Box-3 balances | `output-integrity.js` can export the same portfolio field under both labels | Repair canonical results and exports in Stage 6 |
| A5 | Required inputs can become zero through permissive numeric coercion | Core helpers frequently use `Number(value) || 0` or non-negative fallbacks | Add explicit validation contracts in Stages 1 and 7 |
| A6 | The normal package contract does not reproduce the browser suite | `package.json` lacks a pinned Playwright development dependency and `test:e2e` script | Repair in Stage 7 |
| A7 | Annual Dutch policy values need one dated configuration | 2026 values are distributed across calculation and UI modules | Centralise in Stage 1 |
| A8 | Result wording can imply certainty | Some scenario conclusions use winner/lead language without putting the assumption dependency first | Reframe in Stage 6 |

## Accepted with a narrower interpretation

| ID | Audit claim | R6.5 reality | R6.6 treatment |
|---|---|---|---|
| N1 | The purchase comparison lacks a financing identity | The current scenario already deducts down payment and purchase costs from starting savings and rejects an unfunded purchase. The weakness is that this identity is not displayed and can be undermined by stale cross-tab costs | Preserve the existing funding logic, make purchase costs scenario-specific, expose sources and uses, and add cent-precision invariants |
| N2 | EWF is a flat 0.35% model | R6.5 already implements the 2026 EWF bands, including the high-value tail above €1.35 million | Preserve the existing bands; centralise them and improve the Box 1 tax bridge |
| N3 | Before tax minus cumulative tax should equal after tax | This is not generally true when tax is paid annually, from savings, or externally, because tax withdrawals also change later compounding | Use payment-source and monthly-ledger identities rather than this simplistic invariant |
| N4 | Box 3 needs stronger representation | R6.5 already has a mixed-asset current-law structure, but it remains a planning model and its actual-rate inputs and long-horizon assumptions need clearer treatment | Preserve the current engine; improve policy metadata, validation, rate semantics, canonical outputs, and independent fixtures |

## Rejected findings

| ID | Rejected claim | Reason |
|---|---|---|
| R1 | The current application applies only a flat portfolio-tax drag and therefore does not calculate Dutch Box 3 | R6.5 distinguishes savings, investments, Box 3 debt, the debt threshold, tax-free allowance, fiscal partners, deemed return, modeled actual-return rebuttal, current/proposed regimes, and settled/unsettled years |
| R2 | The current EWF implementation is universally 0.35% | `ewf2026()` already contains the 2026 lower bands, ordinary 0.35% band, and high-value formula |
| R3 | The mortgage amortisation engine needs a rewrite | Independent and repository tests support the annuity, linear, payment, principal and interest identities. R6.6 must preserve this engine unless a specific regression is reproduced |

## R6.6 in scope

1. Explicit nominal/effective rate contracts and transaction timing.
2. Effective-annual conversion for investment, savings, rent, home growth and owner-cost growth.
3. Scenario-local purchase costs and a complete financing identity.
4. A bounded 2026 Box 1 own-home tax delta for the supported profile.
5. Owner-cost growth, actual-rate separation, and dated external cash flows.
6. One canonical result object for cards, tables, charts and exports.
7. Strict validation, saved-state migration and reproducible browser tests.
8. Final logic and primary-source fact audit.

## Explicitly out of scope

- Nibud/LTI or lender approval;
- Monte Carlo forecasting;
- complete Dutch income-tax filing;
- AOW-age profiles;
- full fiscal-partner optimisation;
- complete transitional mortgage-history reconstruction;
- lender-specific prepayment penalties;
- predictions of future Dutch law;
- additional product or interface densities.

## Control rule

No audit claim becomes a code change until it is reproduced against the tagged R6.5 source or supported by a primary legal source. Every result-changing stage must report changed outputs and any changed scenario leader before merge.
