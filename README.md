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
- Current 2026 Box 3 investment-only estimate, including the modeled actual-return rebuttal
- Transition scenario from current rules to a proposed future actual-return / unrealized-gain regime
- Portfolio before Box 3 / cumulative Box 3 tax / portfolio after Box 3 flow with year-by-year breakdown
- Scenario decision engine for Buy vs Rent, larger vs smaller down payment, mortgage repayment vs investing, Linear vs Annuity, and Keep vs Sell + Rent
- Monthly housing + investing affordability check in Scenarios
- Return sensitivity and approximate crossover analysis

## Calculation architecture

`finance-core.js` is the single source of truth for shared financial calculations. It contains pure calculation functions for mortgage amortisation, extra repayments, 2026 eigenwoningforfait, mortgage-interest tax benefit / Hillen approximation, current and proposed Box 3, the mid-year first-Jan-1 portfolio override, investment growth, cash-flow equalisation, and the combined Investment + Mortgage simulation.

`purchase-rules.js` is a separate pure 2026 Dutch purchase-rule module. It calculates transfer tax, simplified NHG eligibility/fee, LTV, and the combined purchase-cost result.

`app.js` is responsible for the main planner UI and delegates financial calculations to `finance-core.js`.

`scenario-engine.js` has a pure, Node-testable scenario layer plus the browser UI. The five scenario types all assemble their outcomes from the shared functions in `finance-core.js`, so the same production path can be exercised in automated tests.

`purchase-costs.js` is UI-only. It renders the purchase-rule controls and editable fee lines, then delegates rule calculations to `purchase-rules.js`.

## Regression and scenario validation tests

The dependency-free Node test suite covers low-level financial formulas, end-to-end strategy assembly, 2026 purchase rules, and external sanity checks.

`tests/finance-core.test.js` covers mortgage, HRA/EWF/Hillen, Box 3, mid-year starts, and cash-flow equalisation.

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
- WhatTheMortgage-style Gross = Principal + Interest and Net = Gross - Tax Return schedule identities

Run all tests locally with Node 20+:

```bash
npm test
```

GitHub Actions runs the same suite automatically on pushes to `main` and on pull requests.

## Scenario cash-flow treatment

Scenario comparisons use the same starting wealth and equalise monthly cash-flow capacity. The lower-cash-outflow strategy invests the difference.

The **Monthly housing + investing budget** is an affordability warning only. It does not alter Box 3 or create extra investment returns common to both strategies.

## Default values

All financial inputs shown when the page first opens are **illustrative examples**. They are not based on a specific person's finances and are not recommendations.

Tax parameters are separate from those example inputs. This version contains Dutch tax assumptions labeled for 2026 and a proposed future Box 3 regime. Tax law changes over time, so those parameters and legal-status notes should be reviewed before relying on the model.

## Run locally

No installation is required to use the calculator.

1. Download `index.html`, `styles.css`, `finance-core.js`, `purchase-rules.js`, `app.js`, `purchase-costs.js`, and `scenario-engine.js` into the same folder.
2. Open `index.html` in a modern browser.
3. Change the inputs to your own assumptions.

The calculator is a static front-end page. It does not contain a backend or account system, and the calculator code does not submit entered financial values to a server.

## Model notes

The app is intended for scenario planning, not tax filing, mortgage underwriting, or financial advice.

Important limitations include:

- Investment returns are assumptions, not forecasts.
- Box 3 treatment depends on the user's complete tax position and this version remains focused on ordinary investments rather than a complete mixed-asset Box 3 return.
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

## Next product step

The next major model improvement is broader Box 3 household assets: separate savings/deposits, investments and Box 3 debt instead of the current investment-only treatment. After that, the highest-value decision feature is the marginal “next euro” invest-versus-repay comparison.

## Sources referenced in the calculator

- Belastingdienst
- Rijksoverheid
- NHG
- WhatTheMortgage.com
- mortgagecalc.nl

See the **Model status and sources** section inside the calculator for the links used by the current version.
