# R6.6 Stage 1: model contract and dated policy structure

**Stage status:** complete and verified  
**Branch:** `r6-6-decision-integrity`  
**R6.5 baseline:** `ac8f029788ff8d1fc2baf09fbc89b848a28f7803`  
**Public `main`:** unchanged during Stage 1

## Purpose

Stage 1 creates the contract that later result-changing stages must follow. It does not activate the effective-annual return correction yet and does not change any financial formula intentionally.

The stage introduces:

- explicit annual-rate types and conversion functions;
- a locked transaction-timing convention;
- strict input schemas that distinguish missing, zero and invalid values;
- one dated 2026 Dutch policy registry with source metadata;
- runtime binding of visible 2026 defaults to that registry;
- regression tests proving that current R6.5 outputs remain unchanged.

## Rate contract

| Input | Contract | Activation |
|---|---|---|
| Mortgage interest | Nominal annual contractual rate divided by 12 | Existing engine |
| Investment return | Effective annual return, converted to a monthly equivalent | Stage 2 |
| Savings yield | Effective annual yield, converted to a monthly equivalent | Stage 2 |
| Home-value growth | Effective annual growth, converted to a monthly equivalent | Stage 2 |
| Rent growth | Effective annual growth, converted to a monthly equivalent | Stage 2 |
| Owner-cost growth | Effective annual growth | Stage 5 |
| Box 3 deemed percentages | Annual statutory factors, never monthly compounding rates | Current policy module |

The conversion functions are available in `model-contract.js`. Stage 1 deliberately leaves the R6.5 financial loops unchanged so output parity can be proved before Stage 2 changes the semantics.

## Transaction timing

The current and target model contract is:

1. Portfolio growth is applied to the opening monthly portfolio.
2. Monthly investment and investment-directed annual bonus are added at month end.
3. Mortgage interest is calculated on the opening mortgage balance.
4. Scheduled mortgage principal is applied after interest.
5. Extra repayment and mortgage-directed bonus are applied after scheduled principal.
6. Savings interest is credited on the opening savings balance before that month’s savings flow.
7. Box 3 debt interest is calculated before that month’s repayment.
8. Box 3 is settled only after a complete calendar year; incomplete final years stay unsettled.
9. Purchase cash is a time-zero event before recurring scenario cash flows are equalised.

## Strict input contract

`model-contract.js` defines strict schemas for:

- mortgage schedules;
- investment plans;
- Box 3 January 1 snapshots;
- purchase scenarios.

A blank required field is not zero. `NaN` and infinity are rejected. Explicit zero remains valid where the domain permits it.

Stage 1 introduces and tests this strict API. Migration of every legacy DOM and engine entry point to the strict boundary is scheduled for Stage 7, because enforcing it now would combine architecture work with user-visible behaviour changes.

## 2026 policy registry

`policy-2026.js` contains the values currently used by the planner for:

- Box 1 rates for taxpayers below AOW age;
- the maximum own-home deduction rate;
- maximum qualifying mortgage duration;
- eigenwoningforfait bands;
- Hillen relief and phase-out metadata;
- Box 3 tax rate, allowance, category percentages and debt threshold;
- transfer-tax rates and starter ceiling;
- NHG limits and fee;
- the standard 100% LTV planning guardrail.

Each policy item records:

- tax year;
- effective date;
- status: final, provisional or planning series;
- source title;
- official source URL;
- authority;
- last verification date.

The 2026 savings and Box 3 debt deemed percentages are marked `provisional`. The investment/other-assets percentage is marked `final`, consistent with the Belastingdienst status published for the 2026 provisional assessment.

## Policy sources

- Belastingdienst, Box 1 rates
- Rijksoverheid, mortgage-interest deduction
- Belastingdienst, eigenwoningforfait
- Belastingdienst, Wet Hillen
- Belastingdienst, 2026 Box 3 calculation
- Belastingdienst, transfer-tax rates
- Belastingdienst, starter exemption
- Nationale Hypotheek Garantie, 2026 limits and fee
- Rijksoverheid, maximum mortgage relative to property value

The exact URLs and verification dates are stored in `policy-2026.js`, not repeated as unstructured calculation constants.

## Explicit deferrals

Stage 1 does not yet:

- change investment, savings, rent or home-growth calculations to effective annual rates;
- rebuild the Box 1 own-home tax bridge;
- isolate purchase scenarios from Mortgage-tab purchase costs;
- add owner-cost growth;
- replace all legacy coercion such as `Number(value) || 0`;
- change the public R6.5 interface or release label.

Those items belong to Stages 2, 3, 4, 5 and 7 respectively.

## Stage 1 release gate

Stage 1 passes only when:

- the policy registry metadata validates;
- core and purchase-rule 2026 defaults resolve to the registry;
- the rate and timing contracts are tested;
- strict schemas distinguish missing values from explicit zero;
- the complete Node suite passes;
- all 50 deterministic scenarios reconcile;
- the five captured R6.5 reference cases are byte-for-byte unchanged;
- the Chromium responsiveness smoke test passes;
- `main` remains at the R6.5 release commit.
