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

`finance-core.js` is the single source of truth for mortgage amortisation, annual HRA allocation, Box 3 calculations, household savings / Box 3 debt ledgers, investment growth, cash-flow equalisation, and the combined plan simulation.

`box3-household.js` is the browser adapter for the dynamic household balances and R4 default framing. It does not contain a second Box 3 formula.

`purchase-rules.js` contains pure 2026 Dutch purchase-rule calculations for transfer tax, simplified NHG checks/fees, and LTV.

`scenario-engine.js` contains the pure five-way scenario engine plus its browser UI. R4 passes the household savings / Box 3 debt settings explicitly into the shared finance core so purchase decisions and Box 3 cannot drift apart.

The deterministic browser load order remains:

1. `finance-core.js`
2. `box3-household.js`
3. `purchase-rules.js`
4. `app.js`
5. `purchase-costs.js`
6. `scenario-engine.js`

## R4 scenario realism

R4 connects the scenario decisions to the R3 household balance sheet.

### Purchase cash

Buy vs Rent and Down Payment no longer have a separate standalone cash pot in the browser.

They use **Investment → Household financial balances → Starting savings / bank deposits** as their starting cash balance.

For Buy vs Rent:

- the buyer spends down payment + purchase costs from that starting savings
- the renter does not spend that purchase cash
- any uncovered buyer amount is recorded as external upfront cash
- unused cash can either be **invested** or **kept in savings**
- the resulting financial balances feed the same Box 3 engine as the main plan

For Down Payment:

- both strategies start with the same household savings
- each strategy draws its own purchase costs + down payment
- the remaining cash is invested or kept in savings according to the same selector
- the resulting Box 3 exposure therefore changes with the chosen down payment

The pure scenario API retains an optional `cash` input for backwards-compatible tests and programmatic use. In the browser, the common household savings balance is the source of truth.

### Household balances in all five scenarios

Mortgage-vs-Invest, Linear-vs-Annuity and Keep-vs-Sell also carry:

- investment portfolio
- savings / cash
- Box 3 debt
- Box 3 tax-payment source
- Box 3 debt repayment
- external Box 3 tax / debt cash flows

Comparable wealth for mortgage-structure decisions is based on household financial wealth minus the remaining Box 1 mortgage, with the common home value excluded.

### Owner-only costs

Scenario assumptions now include:

- VVE / service charges
- maintenance
- OZB / owner municipal taxes
- homeowner building insurance
- ground lease / erfpacht

These costs are included in owner cash flows and the monthly affordability check. They remain editable planning inputs; the new categories default to €0 rather than pretending one amount fits every property.

### Return framing

R4 changes the untouched illustrative browser default from **7% to 5%**.

The normal Scenario sensitivity range now defaults to **2–10%**. Users can still enter 12–14%, but the UI labels those levels as optimistic stress cases rather than a base planning assumption.

The untouched Box 3 browser default is now **2026 current rules** rather than the proposed-transition path. The proposed future regime remains available as a legislative scenario.

## R3 household balance sheet

Savings and Box 3 debt are real evolving balances:

- savings compounds at the entered rate
- savings can fund Box 3 tax
- Box 3 debt can be repaid
- debt repayment can come from savings or external cash flow
- next-year Jan 1 Box 3 values use the evolved balances
- mid-year first-Jan-1 overrides are available for portfolio, savings and debt

The owner-occupied mortgage remains separate from Box 3 debt.

## HRA treatment

The annual HRA/EWF/Hillen estimate is authoritative. Interest is aggregated by calendar year over active mortgage months, one annual estimate is calculated, and that exact amount is allocated back to schedule rows.

Monthly values are **allocated tax benefit**, not predictions of monthly Belastingdienst payments.

The deduction rate remains a planning approximation rather than a complete Box 1 income-tax engine.

## Box 3 notes

The current-rules model uses separate deemed-return percentages for bank deposits, investments / other assets, and Box 3 debt.

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

The suite covers mortgage identities, HRA reconciliation, mixed-asset Box 3, dynamic household balances, Dutch purchase rules, five hand-worked strategy comparisons, R4 purchase-cash / Box 3 coupling, owner-cost cash flows, browser bootstrap integrity, and external mortgage sanity references.

GitHub Actions runs the suite automatically on pushes to `main` and pull requests.

## Main limitations

- Investment and property returns are assumptions, not forecasts.
- HRA is a planning approximation, not an aangifte calculation.
- Box 3 is not a complete tax-return engine and does not model every asset category, exemption, or fiscal-partner allocation choice.
- Box 3 debt interest is modeled as an external household cash expense; there is no full salary/disposable-income budget.
- Scenario purchase events occur at the scenario start. For plans starting after January, use the Jan 1 overrides when first-year Box 3 needs a different reference balance.
- Owner-cost inputs are planning assumptions, not automatically sourced municipal or insurance quotes.
- Proposed future Box 3 legislation may change.
- The planner does not calculate Nibud/LTI borrowing capacity or lender acceptance.
- Extra mortgage repayment rules can vary by lender.

## External sanity references

Mortgage presentation and schedule structure were cross-checked against WhatTheMortgage.com. Standard amortisation was also checked against the public mortgagecalc.nl example for a €320,000 / 30-year / 4.37% mortgage.

Those sites are sanity references, not legal authorities. Dutch rule parameters are based on Belastingdienst, Rijksoverheid, and NHG sources referenced inside the calculator.

## Revision sequence

- **R1 Runtime integrity — complete**
- **R2 HRA reconciliation — complete**
- **R3 Household balance sheet — complete**
- **R4 Scenario realism — complete**
- **R5 Next € optimizer — next**
- **R6 Product hardening — after R5**

After R6, the intended next step is real-user testing before adding broader functionality.

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
