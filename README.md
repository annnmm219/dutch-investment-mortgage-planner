# Dutch Investment & Mortgage Planner

A browser-based planning tool for comparing multi-stage investing, Dutch mortgage repayment strategies, mortgage-interest tax relief, Box 3, home-purchase rules, and household strategy choices.

## Current model

The planner is a static browser app with a shared calculation kernel. It is intended for scenario planning, not mortgage underwriting, tax filing, or financial advice.

### Main capabilities

- 1 to 6 investment / repayment phases
- Annuity and Linear mortgage schedules with extra repayments
- 2026 HRA estimate after eigenwoningforfait / Hillen approximation
- Annual HRA calculation allocated back to monthly rows so the schedule reconciles exactly
- 2026 mixed-asset Box 3 estimate with investments, bank deposits, Box 3 debt, debt threshold, tax-free wealth allowance, and modeled actual-return rebuttal
- Dynamic savings and Box 3 debt balances
- Rule-driven 2026 transfer tax, NHG planning check, and LTV warning
- Five strategy comparisons: Buy vs Rent, larger vs smaller down payment, extra mortgage repayment vs invest, Linear vs Annuity, and Keep vs Sell + Rent
- Fair-cash-flow equalisation and return sensitivity
- Dependency-free Node regression tests and GitHub Actions CI

## Architecture

`finance-core.js` is the single source of truth for shared financial calculations. It contains mortgage amortisation, annual HRA allocation, Box 3 calculations, household savings / Box 3 debt ledgers, investment growth, cash-flow equalisation, and the combined plan simulation.

`box3-household.js` is a browser adapter. It supplies household balance inputs to the shared core and renders the ending household financial balances. It does not contain a second Box 3 formula.

`purchase-rules.js` contains pure 2026 Dutch purchase-rule calculations for transfer tax, simplified NHG checks/fees, and LTV.

`app.js` owns the main planner UI. `scenario-engine.js` owns the five decision comparisons but delegates mortgage and investment/tax calculations to `finance-core.js`. `purchase-costs.js` owns the purchase-cost UI.

The deterministic browser load order is:

1. `finance-core.js`
2. `box3-household.js`
3. `purchase-rules.js`
4. `app.js`
5. `purchase-costs.js`
6. `scenario-engine.js`

## R3 household balance sheet

R3 changes savings and Box 3 debt from frozen tax-context numbers into evolving balances.

### Savings

Starting savings now:

- earn the entered savings-interest rate monthly
- carry forward into the next calendar year's Jan 1 Box 3 balance
- fall when Box 3 tax is paid from savings
- fall when Box 3 debt repayment is explicitly funded from savings

### Box 3 debt

Starting Box 3 debt now:

- incurs the entered modeled interest for the actual-return calculation
- can be reduced by an optional monthly repayment
- carries the resulting balance into the next calendar year's Jan 1 Box 3 calculation

Debt repayment can be funded from **Savings / cash** or treated as **External cash flow**. External repayment is tracked rather than silently creating wealth in the calculation output.

The owner-occupied home mortgage remains separate. It is not automatically classified as Box 3 debt.

### Box 3 tax payment source

The browser now defaults Box 3 payment to **Savings / cash** and supports:

- Savings / cash
- Investment portfolio
- External cash flow

If the selected modeled balance cannot cover the full tax charge, the remainder is recorded as external cash flow rather than disappearing.

The planner reports:

- ending investment portfolio
- ending savings / cash
- ending Box 3 debt
- net financial assets = portfolio + savings - Box 3 debt
- Box 3 tax paid externally

For a plan starting after January, the existing first-Jan-1 investment override remains available, and R3 adds optional first-Jan-1 savings and Box 3 debt overrides.

## Important R3 boundary

R3 fixes the household balance ledger, but the five decision scenarios still treat their decision-specific upfront cash using the existing scenario structure. Fully coupling Buy-vs-Rent / down-payment purchase cash events to the common household ledger is deliberately reserved for **R4**, where those scenarios will be revalidated together rather than partially changing their accounting in this release.

This keeps R3 focused and prevents a purchase-scenario change from being mixed into the balance-sheet refactor.

## HRA treatment

R2 made the annual HRA/EWF/Hillen estimate authoritative. Interest is aggregated by calendar year over active mortgage months, one annual estimate is calculated, and that exact amount is allocated back to schedule rows. Monthly values are therefore **allocated tax benefit**, not predictions of monthly Belastingdienst payments.

The deduction rate remains a planning approximation rather than a complete Box 1 income-tax engine.

## Box 3 notes

The current-rules model uses separate deemed-return percentages for bank deposits, investments / other assets, and Box 3 debt. The deemed method applies the per-person debt threshold and tax-free wealth allowance. The modeled actual-return rebuttal uses investment gain + savings interest - Box 3 debt interest and does not apply the ordinary tax-free wealth allowance.

The proposed future actual-return regime remains a planning scenario only. It is not presented as enacted law.

## Purchase rules

The current purchase module includes:

- 2026 starter exemption value cap of €555,000
- 2% main-residence transfer tax
- 8% residential property not used as the main residence
- standard NHG planning limit €470,000
- energy-enhanced NHG planning limit €498,200
- 0.4% NHG fee
- normal 100% LTV planning warning

The starter selector does not establish every personal eligibility condition, and the NHG check is not lender underwriting.

## Tests

Run all tests with Node 20+:

```bash
npm test
```

The suite covers:

- mortgage amortisation identities
- HRA/EWF/Hillen and annual/monthly reconciliation
- current and proposed Box 3 calculations
- mixed-asset Box 3
- dynamic savings compounding
- dynamic Box 3 debt repayment
- Jan 1 balance carry-forward
- savings-funded Box 3 tax
- tax-payment shortfalls
- mid-year Jan 1 overrides for investments, savings, and debt
- purchase rules / NHG / LTV
- five hand-worked strategy comparisons
- browser dependency/bootstrap integrity
- external mortgage sanity references

GitHub Actions runs the same suite automatically on pushes to `main` and pull requests.

## Main limitations

- Investment and property returns are assumptions, not forecasts.
- HRA is a planning approximation, not an aangifte calculation.
- Box 3 is not a complete tax-return engine and does not model every asset category, exemption, or fiscal-partner allocation choice.
- Box 3 debt interest is modeled as an external household cash expense; R3 does not build a full salary/disposable-income budget.
- Scenario-specific house-purchase cash events are not yet fully coupled to the common savings ledger. That is R4.
- Proposed future Box 3 legislation may change.
- The planner does not calculate Nibud/LTI borrowing capacity or lender acceptance.
- Extra mortgage repayment rules can vary by lender.

## External sanity references

Mortgage presentation and schedule structure were cross-checked against WhatTheMortgage.com. Standard amortisation was also checked against the public mortgagecalc.nl example for a €320,000 / 30-year / 4.37% mortgage.

Those sites are sanity references, not legal authorities. Dutch rule parameters are based on Belastingdienst, Rijksoverheid, and NHG sources referenced inside the calculator.

## Revision sequence

- **R1 Runtime integrity — complete:** deterministic module order, no runtime dependency injection, visible calculation-build marker, bootstrap regression tests.
- **R2 HRA reconciliation — complete:** annual HRA/EWF/Hillen is authoritative and reconciles exactly to monthly schedule allocations.
- **R3 Household balance sheet — complete:** dynamic savings and Box 3 debt balances, explicit debt-repayment source, explicit Box 3 tax-payment accounting, and Jan 1 carry-forward.
- **R4 Scenario realism — next:** couple household cash events to Buy/Rent and down-payment decisions, improve owner-cost inputs and assumption framing, then revalidate all five comparisons.
- **R5 Next € optimizer:** calculate the investment return required to beat extra mortgage repayment for a marginal monthly amount.
- **R6 Product hardening:** persistence, reset, methodology/version visibility, and broader golden-case/UI tests before external user testing.

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

The app has no backend or account system and does not submit entered financial values to a planner server.
