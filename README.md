# Dutch Investment & Mortgage Planner

A browser-based planning tool for comparing multi-stage investment contributions, Dutch mortgage repayment strategies, mortgage-interest tax relief, Box 3 scenarios, and household strategy choices.

## Features

- 1 to 6 life phases with different investment contributions
- Monthly or yearly recurring extra mortgage repayments
- Annual bonus / lump-sum allocation to investments, mortgage repayment, or a 50/50 split
- Existing-mortgage mode and home-purchase planning mode
- Editable home-purchase cost breakdown, including transfer tax, notary, valuation, mortgage advice, inspection, bank guarantee, NHG, purchase agent, and other costs
- Home-purchase summary with savings after costs, required mortgage, loan-to-price ratio, and purchase-cost shortfall
- Side-by-side Linear vs Annuity comparison; click either method to use it in the combined plan and schedule
- Monthly or yearly mortgage payment schedule
- Dutch mortgage-interest deduction estimate, including an eigenwoningforfait approximation
- Current 2026 Box 3 investment-only estimate
- Transition scenario from current rules to a proposed future actual-return / unrealized-gain regime
- Clear Portfolio before Box 3 / cumulative Box 3 tax / Portfolio after Box 3 flow with a year-by-year breakdown
- Scenario decision engine for Buy vs Rent, larger vs smaller down payment, mortgage repayment vs investing, Linear vs Annuity, and Keep vs Sell + Rent
- Explicit monthly housing + investing budget check in Scenarios; the comparison flags strategies that exceed the entered cash-flow capacity
- Return sensitivity and approximate crossover analysis, including optional high-return stress cases such as 12–14%
- Combined investment / mortgage timeline

## Cash-flow treatment

The main Investment plan uses the contribution and mortgage-overpayment amounts exactly as entered. It does not ask for a separate monthly-surplus figure.

In Scenarios, the **Monthly housing + investing budget** is an affordability constraint used only to check whether the compared strategies fit the entered cash-flow capacity. Strategy comparisons still isolate the financial effect of the decision itself: any surplus that is common to both strategies is excluded rather than giving both sides an identical extra investment stream.

## Default values

All financial inputs shown when the page first opens are **illustrative examples**. They are not based on a specific person's finances and are not recommendations.

Tax parameters are separate from those example inputs. This version contains Dutch tax assumptions labeled for 2026 and a proposed future Box 3 regime. Tax law changes over time, so those parameters and legal-status notes should be reviewed before relying on the model.

## Run locally

No installation is required.

1. Download `index.html`, `styles.css`, `app.js`, `purchase-costs.js`, and `scenario-engine.js` into the same folder.
2. Open `index.html` in a modern browser.
3. Change the inputs to your own assumptions.

The calculator is a static front-end page. It does not contain a backend or account system, and the calculator code does not submit entered financial values to a server.

## Publish with GitHub Pages

1. Put the HTML, CSS, JavaScript files, and this `README.md` in the repository root.
2. Commit the files to the default branch.
3. In the repository, open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select the default branch (normally `main`) and the `/ (root)` folder.
6. Save. GitHub will provide the public site address after deployment.

## Model notes

The app is intended for scenario planning, not tax filing, mortgage underwriting, or financial advice.

Important limitations include:

- Investment returns are assumptions, not forecasts.
- The Scenario cash-flow check validates entered planning capacity; it does not calculate disposable income from salary, Box 1 tax, benefits, or living expenses.
- Box 3 treatment depends on the user's full tax position and this version remains focused on ordinary investments rather than a complete mixed-asset Box 3 return.
- Future Box 3 rules may change before implementation.
- The “2026 rules for the whole plan” option intentionally holds editable 2026 parameters constant as a sensitivity case; it is not a forecast of future Dutch tax law.
- The proposed future Box 3 regime is a scenario, not enacted law.
- Mortgage-interest deduction eligibility depends on the specific mortgage and home situation.
- Purchase costs are editable because they vary by buyer and transaction.
- The planner does not determine official mortgage affordability, Nibud LTI limits, lender acceptance, or final NHG eligibility.
- Extra mortgage repayments can be treated differently by individual lenders.
- The annuity simulation assumes the scheduled annuity payment remains unchanged after an extra repayment, which generally shortens the payoff period rather than automatically lowering the contractual payment.

## Sources referenced in the calculator

- Belastingdienst
- Rijksoverheid
- WhatTheMortgage.com, used as a structural reference for purchase inputs, mortgage presentation, and Linear/Annuity comparison. The calculator uses its own implementation.

See the **Model status and sources** section inside the calculator for the links used by the current version.