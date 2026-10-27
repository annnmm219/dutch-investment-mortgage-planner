# R6.6 Stage 3: scenario-local purchase rules and sources-and-uses

**Status:** complete and verified  
**Public main:** unchanged

## Correction

Buy versus Rent and Larger versus Smaller Down Payment now own their complete purchase input. The browser path derives 2026 transfer tax, starter treatment, NHG fee, total purchase costs and mortgage proceeds from the active scenario rather than the Mortgage tab.

Every purchasing strategy satisfies:

`property price + purchase costs = mortgage proceeds + buyer cash at closing`

Both strategies receive the same starting household cash before the time-zero purchase event.

## Independent rule probes

| Probe | Result |
|---|---:|
| €600,000 main-residence transfer tax | €12,000.00 |
| Other purchase costs | €8,000.00 |
| Total purchase costs | €20,000.00 |
| Mortgage proceeds | €540,000.00 |
| Buyer cash at closing | €80,000.00 |
| Sources-and-uses difference | €0.00 |

Starter eligibility was checked for age, main-residence use, prior exemption use and the €555,000 value ceiling. NHG fees were recalculated independently for the two down-payment strategies.

## Deterministic scenario impact

- Scenarios compared: **50**
- Scenarios with numerical changes: **0**
- Scenario leader changes: **0**
- Maximum absolute Strategy A change: **€0.00**
- Maximum absolute Strategy B change: **€0.00**
- Maximum absolute comparison-gap change: **€0.00**

No deterministic scenario leader changed.

The 50-case fixtures preserve their prior total purchase costs by separating the old total into the correct 2% transfer tax plus residual other costs. The purpose of Stage 3 is isolation and rule derivation, not changing those established control totals.

## Deliberate boundary

Stage 3 continues to use the existing local deduction-rate assumption for purchase mortgage tax. The bounded 2026 Box 1 own-home tax bridge remains Stage 4.
