# Dutch Investment & Mortgage Planner

A static browser planner for comparing Dutch mortgage, investment, Box 3, purchase-cost, and household strategy choices.

The project is designed for **scenario planning**, not mortgage underwriting, tax filing, or financial advice.

## Current model

### Main capabilities

- 1 to 6 investment / repayment phases
- Annuity and Linear mortgage schedules with extra repayments
- 2026 HRA estimate after eigenwoningforfait / Hillen approximation
- Annual HRA calculation allocated back to monthly schedule rows so totals reconcile exactly
- 2026 mixed-asset Box 3 estimate across investments, savings / bank deposits, and Box 3 debt
- Dynamic savings and Box 3 debt balances
- Box 3 tax paid from savings, investments, or external cash flow
- 2026 transfer-tax, NHG planning, and LTV checks
- Five scenario comparisons: Buy vs Rent, larger vs smaller down payment, extra mortgage repayment vs invest, Linear vs Annuity, Keep vs Sell + Rent
- Fair-cash-flow equalisation across strategies
- Return sensitivity analysis
- **Next €** invest-vs-repay break-even analysis
- Browser-local save / restore and one-click reset
- Dependency-free Node regression suite and GitHub Actions CI

## Architecture

`finance-core.js` is the shared calculation kernel for mortgage amortisation, HRA allocation, Box 3, household balances, investment growth, cash-flow equalisation, and combined-plan simulation.

`box3-household.js` is the browser adapter for the dynamic household balance sheet and conservative default framing. It does not contain a second Box 3 formula.

`purchase-rules.js` contains pure 2026 Dutch purchase-rule calculations for transfer tax, simplified NHG checks / fees, and LTV.

`scenario-engine.js` contains the pure five-way scenario engine plus its browser UI. Household savings and Box 3 debt are passed into the same FinanceCore functions used by the main plan.

`next-euro.js` is a thin decision layer on top of `ScenarioCore.runScenario()`. It repeatedly runs the existing Extra Repayment vs Invest scenario at different investment returns to solve for the approximate break-even return.

`app-state.js` is the R6 browser-local state layer. It stores editable controls in `localStorage`, restores them on refresh, preserves the selected mortgage method and active tab, and provides a reset-to-examples action. It contains no financial formulas.

The deterministic browser load order is:

1. `finance-core.js`
2. `box3-household.js`
3. `purchase-rules.js`
4. `app.js`
5. `purchase-costs.js`
6. `scenario-engine.js`
7. `next-euro.js`
8. `app-state.js`

## R6 product hardening

R6 deliberately adds **no new financial model**.

It prepares the current calculation kernel for real-user testing by adding:

- browser-local autosave of editable planner inputs
- restoration after refresh
- persistence of phase controls that do not have normal HTML IDs
- persistence of selected mortgage structure and active tab
- one-click **Reset examples**
- explicit “stored only in this browser” privacy wording
- a visible methodology / model-boundary explanation
- static 5% investment-return default in HTML rather than relying on JavaScript to correct 7%
- static 2026-current Box 3 baseline rather than relying on JavaScript to replace the proposed-transition default
- static savings / cash Box 3 tax-payment default
- Node 24 CI with `actions/checkout@v5` and `actions/setup-node@v5`
- golden UI / runtime regression checks

The browser-local snapshot is not an account, cloud backup, or server-side profile. Reset clears that local snapshot and reloads the illustrative defaults.

## R5 Next € optimizer

R5 answers:

> If I have another €X per month, should I invest it or repay my mortgage?

Inputs:

- extra amount per month
- decision horizon
- assumed investment return

Outputs:

- approximate **break-even nominal investment return before Box 3**
- which strategy leads at the user's assumed return
- modeled end-of-horizon wealth difference
- quick comparisons for €250 / €500 / €1,000 per month

The optimizer does not use a shortcut such as `mortgage rate × (1 − deduction rate)`. It runs the same production mortgage-invest scenario used elsewhere in the planner.

This means the break-even reflects the entered mortgage, HRA/EWF/Hillen treatment, Box 3 settings, investments, savings, Box 3 debt, and selected horizon.

A 4% nominal mortgage with no HRA and no Box 3 breaks even at a 4% nominal investment-return input in this model because both rates are applied monthly from nominal annual inputs.

HRA generally lowers the investment return required to beat repayment because deductible mortgage interest reduces the effective mortgage cost. Box 3 generally pushes the required nominal investment return upward.

Break-even remains a model result, not a promised market return or a risk-adjusted guarantee.

## R4 scenario realism

R4 connected the five scenario comparisons to the household balance sheet.

Buy vs Rent and Down Payment use the household starting-savings balance rather than a separate scenario cash pot. Purchase costs and down payments therefore reduce financial assets before future Box 3 is calculated.

Unused upfront cash can be invested or retained in savings.

Owner-only scenario costs include editable:

- VVE / service charges
- maintenance
- OZB / owner municipal taxes
- homeowner building insurance
- ground lease / erfpacht

The normal scenario return range defaults to 2–10%. The untouched main investment default is 5%.

## R3 household balance sheet

Savings and Box 3 debt are evolving balances rather than frozen tax context:

- savings compounds at the entered rate
- savings can fund Box 3 tax
- Box 3 debt can be repaid
- repayment can come from savings or external cash flow
- future Jan 1 Box 3 values use the evolved balances
- optional first-Jan-1 overrides exist for portfolio, savings, and debt when a plan starts mid-year

The owner-occupied Box 1 mortgage remains separate from Box 3 debt.

## HRA treatment

The annual HRA/EWF/Hillen estimate is authoritative.

Mortgage interest is aggregated per calendar year across active mortgage months. One annual estimate is calculated and then allocated back across schedule rows so monthly / yearly schedule totals reconcile exactly with the headline benefit.

Schedule values are labeled **Allocated tax benefit**. They are not predictions of monthly Belastingdienst payments.

The deduction rate remains a planning approximation, not a complete Box 1 income-tax calculation.

## Box 3 notes

The 2026 current-rules model uses separate deemed-return percentages for:

- bank deposits
- investments / other assets
- Box 3 debt

It also models the 2026 debt threshold, tax-free wealth allowance, and the lower-of deemed-vs-modeled-actual-return comparison used by the planner.

The proposed future actual-return regime remains a planning scenario only. It is not presented as enacted law.

## Purchase rules

The purchase module includes planning checks for:

- 2026 starter exemption value cap of €555,000
- 2% main-residence transfer tax
- 8% residential property not used as the main residence
- standard NHG planning limit €470,000
- energy-enhanced NHG planning limit €498,200
- 0.4% NHG fee
- normal 100% LTV warning

The starter selector does not establish all personal eligibility conditions. The NHG and LTV checks do not replace lender underwriting.

## Tests

Run the full suite with Node 24+:

```bash
npm test
```

The suite covers:

- mortgage amortisation identities
- HRA / EWF / Hillen reconciliation
- mixed-asset Box 3
- dynamic household savings and debt
- 2026 purchase rules
- external mortgage sanity references
- five hand-worked scenario comparisons
- purchase-cash / Box 3 coupling
- owner-cost cash flows
- Next € break-even behavior
- deterministic browser load order
- R6 local-state serialization and restore primitives
- R6 static defaults, methodology wording, reset path, and Node 24 CI configuration

GitHub Actions runs the same suite on pushes to `main` and pull requests.

## Main limitations

- Investment and property returns are assumptions, not forecasts.
- HRA is a planning approximation, not an aangifte calculation.
- Box 3 is not a complete tax-return engine and does not model every asset category, exemption, or fiscal-partner allocation choice.
- Box 3 debt interest is modeled as an external household cash expense; there is no full salary / disposable-income budget.
- Scenario purchase events occur at the scenario start. For mid-year starts, use the Jan 1 overrides when first-year Box 3 needs a different reference balance.
- Owner-cost inputs are planning assumptions, not automatically sourced municipal or insurance quotes.
- Proposed future Box 3 legislation may change.
- The planner does not calculate official Nibud/LTI borrowing capacity or lender acceptance.
- Extra mortgage repayment rules can vary by lender.
- The Next € optimizer compares modeled wealth under entered assumptions; it does not convert investment risk into a guaranteed-equivalent return.
- Local browser persistence is device/browser-specific and is not a backup service.

## External sanity references

Mortgage presentation and schedule structure were cross-checked against WhatTheMortgage.com. Standard amortisation was also checked against the public mortgagecalc.nl example for a €320,000 / 30-year / 4.37% mortgage.

Those sites are sanity references, not legal authorities. Dutch rule parameters are based on Belastingdienst, Rijksoverheid, and NHG sources referenced inside the calculator.

## Revision sequence

- **R1 Runtime integrity — complete**
- **R2 HRA reconciliation — complete**
- **R3 Household balance sheet — complete**
- **R4 Scenario realism — complete**
- **R5 Next € optimizer — complete**
- **R6 Product hardening — complete**

The intended next step is **real-user testing** before adding broader functionality.

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

The app has no backend or account system and does not submit entered financial values to a planner server.
