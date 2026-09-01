# Dutch Investment & Mortgage Planner

A browser-based planning tool for comparing multi-stage investment contributions, Dutch mortgage repayment strategies, mortgage-interest tax relief, and Box 3 scenarios.

## Features

- 1 to 6 life phases with different investment contributions
- Monthly or yearly extra mortgage repayments
- Annual bonus / lump-sum allocation to investments, mortgage repayment, or a 50/50 split
- Linear and annuity mortgage assumptions
- Side-by-side linear vs annuity comparison
- Monthly or yearly mortgage payment schedule
- Dutch mortgage-interest deduction estimate, including an eigenwoningforfait approximation
- Current Box 3 planning proxy
- Proposed future actual-return / unrealized-gain Box 3 scenario
- Investment return scenarios and a combined investment / mortgage timeline

## Default values

All financial inputs shown when the page first opens are **illustrative examples**. They are not based on a specific person's finances and are not recommendations.

Tax parameters are separate from those example inputs. This version contains Dutch tax assumptions labeled for 2026 and a proposed future Box 3 regime. Tax law changes over time, so those parameters and legal-status notes should be reviewed before relying on the model.

## Run locally

No installation is required.

1. Download `index.html`.
2. Open it in a modern browser.
3. Change the inputs to your own assumptions.

The calculator is a static front-end page. It does not contain a backend or account system, and the calculator code does not submit entered financial values to a server.

## Publish with GitHub Pages

1. Create a GitHub repository.
2. Add `index.html` and this `README.md` to the repository root.
3. Commit the files to the default branch.
4. In the repository, open **Settings → Pages**.
5. Under **Build and deployment**, choose **Deploy from a branch**.
6. Select the default branch (normally `main`) and the `/ (root)` folder.
7. Save. GitHub will provide the public site address after deployment.

## Model notes

The app is intended for scenario planning, not tax filing or financial advice.

Important limitations include:

- Investment returns are assumptions, not forecasts.
- Box 3 treatment depends on the user's full tax position.
- Future Box 3 rules may change before implementation.
- Mortgage-interest deduction eligibility depends on the specific mortgage and home situation.
- Extra mortgage repayments can be treated differently by individual lenders.
- The annuity simulation assumes the scheduled annuity payment remains unchanged after an extra repayment, which generally shortens the payoff period rather than automatically lowering the contractual payment.

## Sources referenced in the calculator

- Belastingdienst
- Rijksoverheid
- WhatTheMortgage.com, used as a structural reference for mortgage presentation and comparison

See the **Model status and sources** section inside the calculator for the links used by the current version.

## Suggested repository name

`dutch-investment-mortgage-planner`
