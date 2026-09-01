# Dutch Investment & Mortgage Planner

A browser-based planning tool for comparing multi-stage investment contributions, Dutch mortgage repayment strategies, mortgage-interest tax relief, Box 3 scenarios, and household strategy choices.

## Features

- 1 to 6 life phases with different investment contributions
- Monthly or yearly recurring extra mortgage repayments
- Annual bonus / lump-sum allocation to investments, mortgage repayment, or a 50/50 split
- Existing-mortgage mode and home-purchase planning mode
- Rule-driven 2026 purchase costs with editable non-tax fees
- Automatic 2026 transfer-tax treatment: starter exemption, 2% main residence, 8% non-main-residence home, or manual override
- 2026 NHG planning check with €470,000 standard limit, €498,200 energy-enhanced limit, and 0.4% fee
- 100% LTV planning guardrail using an entered market/appraised value
- Side-by-side Linear vs Annuity comparison
- Monthly or yearly mortgage payment schedule
- Dutch mortgage-interest deduction estimate with eigenwoningforfait / Hillen approximation
- Annual HRA/EWF/Hillen calculation allocated back to monthly schedule rows so schedule totals reconcile exactly
- Current 2026 Box 3 mixed-asset estimate using investments, bank deposits and Box 3 debt, including the modeled actual-return rebuttal
- Separate 2026 deemed-return parameters for bank deposits, investments / other assets and Box 3 debt, including the per-person debt threshold
- Transition scenario from current rules to a proposed future actual-return / unrealized-gain regime
- Portfolio before Box 3 / cumulative Box 3 tax / portfolio after Box 3 flow with year-by-year breakdown
- Scenario decision engine for Buy vs Rent, larger vs smaller down payment, mortgage repayment vs investing, Linear vs Annuity, and Keep vs Sell + Rent
- Monthly housing + investing affordability check in Scenarios
- Return sensitivity and approximate crossover analysis

## Calculation architecture

`finance-core.js` is the single source of truth for shared financial calculations. It contains pure calculation functions for mortgage amortisation, extra repayments, 2026 eigenwoningforfait, mortgage-interest tax benefit / Hillen approximation, annual mortgage-tax allocation, current and proposed Box 3, the mid-year first-Jan-1 portfolio override, investment growth, cash-flow equalisation, and the combined Investment + Mortgage simulation.

For HRA, R2 makes the annual calculation authoritative. Interest is aggregated per calendar year over active mortgage months, the annual HRA/EWF/Hillen result is calculated once, and that exact result is allocated back across those monthly rows. The allocation is proportional to monthly interest when interest exists, with the final row absorbing any floating-point remainder. The displayed monthly values are therefore allocations of the annual estimate, not separate monthly tax-return calculations.

The current Box 3 function accepts three household categories: the modeled investment portfolio, bank deposits, and Box 3 debt. For the 2026 deemed method it applies separate category percentages, the Box 3 debt threshold and the tax-free wealth allowance. For the actual-return rebuttal it combines modeled investment growth, savings interest and Box 3 debt interest and compares that result with the deemed calculation.

`box3-household.js` is the browser context adapter. It renders the additional savings/debt inputs and injects those values into the same `finance-core.js` methods used by the main plan and Scenario engine. It does not contain a second tax formula.

`purchase-rules.js` is a separate pure 2026 Dutch purchase-rule module. It calculates transfer tax, simplified NHG eligibility/fee, LTV, and the combined purchase-cost result.

`app.js` is responsible for the main planner UI and delegates financial calculations to `finance-core.js`.

`scenario-engine.js` has a pure, Node-testable scenario layer plus the browser UI. The five scenario types all assemble their outcomes from the shared functions in `finance-core.js`, including the reconciled mortgage-tax cash flows.

`purchase-costs.js` renders the purchase-rule controls and editable fee lines and delegates rule calculations to `purchase-rules.js`. It does not load dependency scripts at runtime.

### Deterministic browser bootstrap

R1 makes the browser dependency order explicit in `index.html`:

1. `finance-core.js`
2. `box3-household.js`
3. `purchase-rules.js`
4. `app.js`
5. `purchase-costs.js`
6. `scenario-engine.js`

No application module dynamically injects another dependency script. Required dependencies fail fast when the declared order is broken. The public page also shows a small calculation-build marker so a downloaded archive and the deployed Pages build can be compared visibly.

## Regression and scenario validation tests

The dependency-free Node test suite covers low-level financial formulas, end-to-end strategy assembly, 2026 purchase rules, mixed-asset Box 3, annual-vs-monthly HRA reconciliation, browser bootstrap integrity, and external sanity checks.

`tests/finance-core.test.js` covers mortgage, HRA/EWF/Hillen, annual HRA allocation, zero-interest Hillen reconciliation, main-plan schedule reconciliation, Box 3 parity, mid-year starts, and cash-flow equalisation.

`tests/box3-household.test.js` covers:

- mixed 2026 deemed-return calculations across savings, investments and Box 3 debt
- the €3,800 per-person 2026 debt threshold
- mixed-asset actual-return rebuttal treatment
- proposed actual-return treatment with savings interest and debt interest
- injection of the same household Box 3 context into the shared investment-flow calculation path

`tests/scenario-engine.test.js` validates Buy vs Rent, larger vs smaller down payment, extra mortgage repayment vs invest, Linear vs Annuity, Keep vs Sell + Rent, and transaction-cost treatment with hand-worked cases.

`tests/purchase-rules.test.js` validates:

- 0% / 2% / 8% 2026 residential transfer-tax treatments
- the €555,000 starter-exemption value cap
- €470,000 standard NHG and €498,200 energy-enhanced NHG planning limits
- the 0.4% NHG fee
- the normal 100% LTV guardrail
- the default €350,000 purchase-cost case
- NHG fee / mortgage circularity
- mortgage amortisation against the displayed mortgagecalc.nl 2026 example
- WhatTheMortgage-style Gross = Principal + Interest and Net = Gross - allocated tax benefit schedule identities

`tests/runtime-integrity.test.js` validates the declared browser script order, required local modules, absence of dynamic dependency injection/polling, fail-fast dependency checks, the visible calculation-build marker, static mixed-asset Box 3 copy, and the R2 allocation wording.

Run all tests locally with Node 20+:

```bash
npm test
```

GitHub Actions runs the same suite automatically on pushes to `main` and on pull requests.

## Scenario cash-flow treatment

Scenario comparisons use the same starting wealth and equalise monthly cash-flow capacity. The lower-cash-outflow strategy invests the difference.

The **Monthly housing + investing budget** is an affordability warning only. It does not alter Box 3 or create extra investment returns common to both strategies.

The added Box 3 savings and debt balances are tax-context inputs. They are not automatically included in the Scenario cards as strategy wealth, because they are common household balances rather than a consequence of the decision being compared.

## Default values

All financial inputs shown when the page first opens are **illustrative examples**. They are not based on a specific person's finances and are not recommendations.

Tax parameters are separate from those example inputs. This version contains Dutch tax assumptions labeled for 2026 and a proposed future Box 3 regime. Tax law changes over time, so those parameters and legal-status notes should be reviewed before relying on the model.

The default actual savings-interest and Box 3 debt-interest percentages are planning placeholders. They should be changed when the user wants the actual-return rebuttal or proposed future regime to reflect a particular household situation.

## Run locally

No installation is required to use the calculator.

1. Download `index.html`, `styles.css`, `finance-core.js`, `box3-household.js`, `purchase-rules.js`, `app.js`, `purchase-costs.js`, and `scenario-engine.js` into the same folder.
2. Open `index.html` in a modern browser.
3. Change the inputs to your own assumptions.

The calculator is a static front-end page. It does not contain a backend or account system, and the calculator code does not submit entered financial values to a server.

## Model notes

The app is intended for scenario planning, not tax filing, mortgage underwriting, or financial advice.

Important limitations include:

- Investment returns are assumptions, not forecasts.
- The HRA model still uses a simplified planning deduction rate rather than a full Box 1 income-tax calculation. Monthly schedule values are allocations of the annual estimate, not predictions of monthly Belastingdienst payments.
- The Box 3 model now includes bank deposits, the modeled investment portfolio and Box 3 debt, but it is still not a full Dutch tax-return engine. It does not yet model every possible Box 3 asset class, exemption or allocation choice between fiscal partners.
- The additional savings and Box 3 debt balances are held constant as Jan 1 planning values across the plan. They do not automatically change when cash is used for a home purchase, a down payment or another Scenario decision.
- For a plan that starts after January, `firstJan1Portfolio` corrects the investment value used by the deemed method, but the modeled actual-return calculation still covers only the portion of the year simulated by the planner.
- Future Box 3 rules may change before implementation.
- The proposed future Box 3 regime is a scenario, not enacted law.
- Mortgage-interest deduction eligibility depends on the specific mortgage and home situation.
- The starter-exemption selector assumes the user meets the age, prior-use and main-residence conditions; the planner automatically enforces only the €555,000 value cap.
- The NHG check is deliberately simplified and does not replace the full NHG conditions, valuation, lender acceptance or income test.
- The planner does not determine official mortgage affordability or Nibud/LTI borrowing capacity.
- Dutch mortgages are generally limited to 100% of market value; specific exceptions, including qualifying energy measures, require separate eligibility checks.
- Extra mortgage repayments can be treated differently by individual lenders.

## External sanity references

The mortgage presentation and schedule structure was cross-checked against WhatTheMortgage.com. The standard amortisation engine was also checked against the public 2026 example displayed by mortgagecalc.nl: its rounded €1,597 annuity and €2,054 linear month-one payments for a €320,000 / 30-year example are reproduced by the standard 4.37% amortisation formulas used by this planner.

These sites are sanity references, not legal authorities. 2026 Dutch rule parameters are taken from Belastingdienst, Rijksoverheid and NHG sources.

## Revision sequence

- **R1 Runtime integrity — complete:** deterministic module order, no runtime dependency injection, visible calculation-build marker, bootstrap regression tests.
- **R2 HRA reconciliation — complete:** annual HRA/EWF/Hillen is authoritative and reconciles exactly to monthly schedule allocations.
- **R3 Household balance sheet — next:** dynamic savings and Box 3 debt balances plus explicit tax-payment accounting.
- **R4 Scenario realism:** connect household cash events to scenarios, improve owner-cost inputs and assumption framing, then revalidate all five comparisons.
- **R5 Next € optimizer:** calculate the investment return required to beat extra mortgage repayment for a marginal monthly amount.
- **R6 Product hardening:** persistence, reset, methodology/version visibility, and broader golden-case/UI tests before external user testing.

## Sources referenced in the calculator

- Belastingdienst
- Rijksoverheid
- NHG
- WhatTheMortgage.com
- mortgagecalc.nl

See the **Model status and sources** section inside the calculator for the links used by the current version.
