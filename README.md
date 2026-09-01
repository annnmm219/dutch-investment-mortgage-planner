# Dutch Investment & Mortgage Planner

A static browser planner for exploring Dutch mortgage, investment, Box 3, purchase-cost, and household strategy choices.

The project is designed for **scenario planning**, not mortgage underwriting, tax filing, or financial advice.

## Current model

The calculator includes:

- 1 to 6 investment / repayment phases
- Annuity and Linear mortgage schedules with extra repayments
- 2026 HRA planning estimate with eigenwoningforfait and year-specific Hillen phase-out
- explicit remaining HRA eligibility and qualifying Box 1 mortgage share
- annual HRA calculation allocated back to schedule rows so totals reconcile
- 2026 mixed-asset Box 3 across investments, savings / bank deposits, and Box 3 debt
- dynamic savings and Box 3 debt balances
- Box 3 tax paid from savings, investments, or external cash flow
- 2026 transfer-tax, NHG planning, and LTV checks
- five strategy comparisons
- fair monthly cash-flow equalisation
- return sensitivity analysis
- **Next €** invest-vs-repay break-even analysis
- browser-local save / restore and reset
- dependency-free Node regression tests and GitHub Actions CI

## Architecture

`finance-core.js` is the shared calculation kernel. Mortgage amortisation, HRA/EWF/Hillen, Box 3, household balances, investment growth, cash-flow equalisation, and the combined plan all use this core.

`box3-household.js` adapts the household savings / Box 3 debt inputs to the shared core. It does not contain a second tax engine.

`purchase-rules.js` contains pure 2026 purchase-rule calculations for transfer tax, simplified NHG checks / fees, and LTV.

`scenario-engine.js` contains the pure five-way strategy engine plus its browser UI.

`next-euro.js` repeatedly runs the production Repay Mortgage vs Invest scenario to find the approximate investment-return crossover.

`app-state.js` handles browser-local persistence and UX adaptation. It contains no financial formulas.

The browser dependency order remains deterministic:

1. `finance-core.js`
2. `box3-household.js`
3. `purchase-rules.js`
4. `app.js`
5. `purchase-costs.js`
6. `scenario-engine.js`
7. `next-euro.js`
8. `app-state.js`

## R6.3 logic integrity

R6.3 is a bounded correctness release based on an independent source-code and financial-logic audit. It adds no new product category.

### Box 1 / mortgage corrections

- EWF is tied to modeled owner-occupied months rather than a positive mortgage balance, so it continues after mortgage payoff.
- Hillen relief is calendar-year specific: 71.867% in 2026, reduced by 4.8 percentage points per year, and zero from 2041.
- The user can specify remaining HRA eligibility in years/months and the percentage of the mortgage that qualifies as Box 1 owner-occupied-home debt.
- Gross mortgage interest continues after HRA eligibility expires, while deductible interest stops.
- Planned mortgage-directed cash that cannot be applied because the mortgage is repaid or the requested payment exceeds the remaining balance is redirected to investments, savings, or consumption according to the selected fallback. It is never silently discarded.

### Box 3 calendar corrections

- For a current-law plan that starts after January, the first partial calendar year does not use the actual-return rebuttal because the planner lacks the earlier months' return data. It uses the deemed estimate only.
- A final partial calendar year is shown as **unsettled** rather than withdrawn as if the calendar year were complete.
- In the proposed future-law scenario, the annual exempt result is deducted before prior losses are consumed.

### Scenario safeguards

- Buy / down-payment comparisons are unavailable when starting savings cannot fully fund the required upfront cash. The planner no longer treats missing upfront cash as free external capital.
- A sale comparison is unavailable when sale proceeds cannot repay the mortgage and selling costs unless that funding is modeled elsewhere.
- New purchase scenarios default their mortgage-tax WOZ planning input to the scenario property rather than an unrelated main-tab property value.
- Repay-vs-invest keeps the same monthly cash capacity after early payoff by investing the amount that can no longer be applied to the mortgage.

### Next € disclosure

The break-even percentage is explicitly labeled as **not risk-adjusted**. Extra mortgage repayment is comparatively certain, while investment returns are uncertain and can underperform the modeled crossover.

## HRA treatment

The annual home-related Box 1 estimate is authoritative. The model separates:

- owner-occupied months, which determine EWF;
- deductible mortgage interest, which depends on the remaining HRA period and qualifying debt share.

The annual result is allocated back to schedule rows so monthly and yearly schedule totals reconcile exactly with the headline amount.

The automatic deduction rate remains a deliberately rough planning proxy rather than a complete Box 1 tax-delta calculation.

## Box 3 treatment

The 2026 deemed model separately uses bank deposits, investments / other assets, and deductible Box 3 debt, including the debt threshold and tax-free wealth allowance.

Complete current-law calendar years compare the deemed result with the modeled actual-return rebuttal. Partial years are handled conservatively as described in R6.3.

The proposed future actual-return regime remains a legislative scenario, not enacted law.

## Scenario accounting

Strategy comparisons use the same required monthly cash capacity. The cheaper strategy invests the difference.

Household savings and Box 3 debt evolve through time, and purchase/down-payment scenarios consume the same starting-savings balance used by the household ledger.

For Linear vs Annuity and Repay vs Invest, the home is common to both sides and excluded from the comparison. The relevant net position is financial assets minus remaining debts.

## Purchase rules

The purchase module includes planning checks for:

- 2026 starter exemption value cap of €555,000
- 2% main-residence transfer tax
- 8% residential property not used as the main residence
- standard NHG planning limit €470,000
- energy-enhanced NHG planning limit €498,200
- 0.4% NHG fee
- normal 100% LTV warning

These checks do not replace lender underwriting or an official eligibility decision.

## Tests

Run the suite with Node 24+:

```bash
npm test
```

The tests cover standard mortgage identities, HRA/EWF/Hillen reconciliation, mixed-asset Box 3, household ledgers, purchase rules, five hand-worked strategy comparisons, Next € crossover behavior, deterministic browser bootstrap, local persistence primitives, and R6.3 adversarial boundary cases.

R6.3 specifically adds regression coverage for:

- January mortgage payoff with full-year EWF/Hillen
- Hillen phase-out through 2041
- HRA expiry before mortgage maturity
- mid-year current Box 3 without an incomplete actual-return rebuttal
- unsettled partial final Box 3 year
- future-law exemption-before-loss ordering
- oversized mortgage bonuses and post-payoff cash conservation
- early-payoff Repay-vs-Invest conservation
- insufficient upfront cash
- scenario-specific purchase WOZ

GitHub Actions runs the same suite on pushes to `main` and pull requests.

## Main limitations

- The planner does not calculate official Nibud/LTI borrowing capacity or lender acceptance.
- HRA is still a planning approximation, not a full Dutch Box 1 tax return.
- Box 3 does not model every asset class, exemption, fiscal-partner allocation, or special taxpayer status.
- The 30% ruling convenience control affects the Box 1 income estimate only. It does not determine transitional partial-foreign-taxpayer Box 3 treatment.
- Owner-cost inputs are currently flat nominal planning assumptions while rent and home values can grow.
- Deductible purchase-financing costs are not yet modeled separately from non-deductible acquisition costs.
- The proposed future Box 3 regime is narrower than the full legislative proposal and may change before enactment.
- Extra mortgage repayment currently keeps the scheduled annuity amount unchanged and shortens the modeled term. Individual lenders may recalculate payments differently.
- Investment returns are assumptions, not forecasts, and the Next € crossover is not a certainty-equivalent or risk-adjusted return.
- Local browser persistence is device/browser-specific and is not a backup service.

## External sanity references

Mortgage presentation and schedule structure were cross-checked against WhatTheMortgage.com. Standard amortisation was also checked against a public mortgagecalc.nl example.

Those sites are sanity references, not legal authorities. Dutch tax parameters are based on Belastingdienst, Rijksoverheid, and NHG sources referenced inside the calculator.

## Revision sequence

- **R1 Runtime integrity, complete**
- **R2 HRA reconciliation, complete**
- **R3 Household balance sheet, complete**
- **R4 Scenario realism, complete**
- **R5 Next € optimizer, complete**
- **R6 Product hardening, complete**
- **R6.3 Logic integrity, current correction release**

After R6.3, the intended next step is controlled user testing before broader functionality is added.

## Run locally

Keep these files together and open `index.html` in a modern browser:

- `index.html`
- `styles.css`
- `finance-core.js`
- `box3-household.js`
- `purchase-rules.js`
- `app.js`
- `purchase-costs.js`
- `scenario-engine.js`
- `next-euro.js`
- `app-state.js`

The app has no backend account system and does not submit entered financial values to a planner server.
