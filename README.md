# Dutch Investment & Mortgage Planner

A browser-based planning tool for comparing multi-stage investment contributions, Dutch mortgage repayment strategies, mortgage-interest tax relief, Box 3 scenarios, and household strategy choices.

## Features

- 1 to 6 life phases with different investment contributions
- Monthly or yearly recurring extra mortgage repayments
- Annual bonus / lump-sum allocation to investments, mortgage repayment, or a 50/50 split
- Existing-mortgage mode and home-purchase planning mode
- Editable home-purchase cost breakdown
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

`finance-core.js` is the single source of truth for shared financial calculations. It contains pure calculation functions for:

- Linear and annuity mortgage amortisation
- recurring extra mortgage repayment
- 2026 eigenwoningforfait
- mortgage-interest tax-benefit / Hillen approximation
- current and proposed Box 3 yearly tax calculations
- the mid-year first-Jan-1 portfolio override
- investment growth with annual Box 3 charges
- equalised monthly cash flows between two strategies
- the main combined Investment + Mortgage simulation

`app.js` is responsible for the main planner UI and delegates financial calculations to `finance-core.js`.

`scenario-engine.js` is responsible for strategy-comparison UI and orchestration. It uses the same mortgage, tax, investment, and cash-flow functions from `finance-core.js` rather than maintaining a separate tax engine.

`purchase-costs.js` is UI-only. It builds the editable purchase-cost breakdown and synchronises the total purchase-cost input; it contains no mortgage, Box 3, or HRA calculation logic.

This separation is intentional so the Investment, Mortgage, and Scenario views cannot silently drift onto different versions of the same tax formula.

## Scenario cash-flow treatment

Scenario comparisons use the same starting wealth and equalise monthly cash-flow capacity. The lower-cash-outflow strategy invests the difference.

The **Monthly housing + investing budget** is an affordability warning only. It does not alter Box 3 or create extra investment returns common to both strategies.

## Default values

All financial inputs shown when the page first opens are **illustrative examples**. They are not based on a specific person's finances and are not recommendations.

Tax parameters are separate from those example inputs. This version contains Dutch tax assumptions labeled for 2026 and a proposed future Box 3 regime. Tax law changes over time, so those parameters and legal-status notes should be reviewed before relying on the model.

## Run locally

No installation is required.

1. Download `index.html`, `styles.css`, `finance-core.js`, `app.js`, `purchase-costs.js`, and `scenario-engine.js` into the same folder.
2. Open `index.html` in a modern browser.
3. Change the inputs to your own assumptions.

The calculator is a static front-end page. It does not contain a backend or account system, and the calculator code does not submit entered financial values to a server.

## Publish with GitHub Pages

1. Put the HTML, CSS, JavaScript files, and this `README.md` in the repository root.
2. Commit the files to the default branch.
3. In the repository, open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select the default branch (normally `main`) and the `/ (root)` folder.
6. Save.

## Model notes

The app is intended for scenario planning, not tax filing, mortgage underwriting, or financial advice.

Important limitations include:

- Investment returns are assumptions, not forecasts.
- Box 3 treatment depends on the user's complete tax position and this version remains focused on ordinary investments rather than a complete mixed-asset Box 3 return.
- Future Box 3 rules may change before implementation.
- The “2026 rules for the whole plan” option intentionally holds editable 2026 parameters constant as a sensitivity case; it is not a forecast of future Dutch tax law.
- The proposed future Box 3 regime is a scenario, not enacted law.
- Mortgage-interest deduction eligibility depends on the specific mortgage and home situation.
- Purchase costs are editable because they vary by buyer and transaction.
- The planner does not determine official mortgage affordability, Nibud LTI limits, lender acceptance, or final NHG eligibility.
- Extra mortgage repayments can be treated differently by individual lenders.
- The annuity simulation assumes the scheduled annuity payment remains unchanged after an extra repayment, generally shortening the payoff period rather than automatically lowering the contractual payment.

## Next engineering step

The next priority is regression testing of `finance-core.js` with hand-checked mortgage, HRA/EWF, Box 3, mid-year-start, and scenario-equalisation cases before adding further financial features.

## Sources referenced in the calculator

- Belastingdienst
- Rijksoverheid
- WhatTheMortgage.com, used as a structural reference for purchase inputs, mortgage presentation, and Linear/Annuity comparison. The calculator uses its own implementation.

See the **Model status and sources** section inside the calculator for the links used by the current version.
