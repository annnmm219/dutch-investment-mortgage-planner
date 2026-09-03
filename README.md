# Dutch Investment & Mortgage Planner

A static, browser-based planner for comparing Dutch mortgage, investment, Box 3, purchase-cost, and household strategy choices.

The project is designed for **scenario planning**. It is not mortgage underwriting, a tax return, or personal financial advice.

## Current release candidate: R6.6 Decision Integrity

R6.6 completes the controlled decision-integrity review across inputs, calculations, comparison economics, tax boundaries, displayed outputs, exports, browser state and primary-source facts.

The public site remains on R6.5 until the release candidate is explicitly authorized for merge.

### What changed in R6.6

- Declared and enforced effective versus nominal annual-rate conventions.
- Made purchase inputs and complete sources-and-uses ledgers local to each purchase strategy.
- Replaced the compressed mortgage-tax proxy with a bounded progressive 2026 Box 1 bridge.
- Reconciled principal, equity, purchase and sale costs, owner costs, Box 3 balances, and dated external cash flows.
- Routed cards, tables and CSV exports through versioned canonical result records.
- Added strict browser validation and schema 1 to 2 saved-state migration.
- Pinned the browser test runtime and added reproducible Chromium contracts.
- Completed the final logic and primary-source audit, including formal adjudication of the published Hillen example conflict.

## Main workflow

### Investment

Set:

- plan start month and year;
- starting investment portfolio;
- savings and other household balances;
- 1 to 6 life phases;
- monthly investment per phase;
- monthly extra mortgage repayment per phase;
- annual bonus or lump sum and its destination;
- one expected effective annual investment return;
- Box 3 on or off and the fiscal-partner count.

Detailed Box 3 regimes, payment source, January 1 snapshots, debt, actual savings and debt rates, statutory parameters, and proposed-regime assumptions remain available in **Advanced Box 3 assumptions**.

### Mortgage

Use either:

- an existing mortgage; or
- a planned main-residence purchase.

The planner calculates annuity and linear structures, mortgage-interest relief after EWF/Hillen, remaining HRA eligibility, extra repayments, purchase costs, NHG/LTV planning checks, and the mortgage schedule.

Detailed HRA eligibility, qualifying debt share, manual deduction rate, Hillen override, post-payoff cash destination, reporting horizon, and specialist purchase assumptions remain in **Advanced mortgage and tax assumptions** or **Purchase costs and rules**.

### Scenarios

Choose one comparison:

1. Buy versus Rent
2. Larger versus Smaller Down Payment
3. Extra Mortgage Repayment versus Invest
4. Linear versus Annuity
5. Keep Home versus Sell and Rent

The scenario uses the Investment-tab return by default. A different comparison return can be enabled explicitly.

Owner-cost detail, scenario-specific WOZ, mortgage-method override, unused-purchase-cash treatment, and audit controls remain locally expandable.

## Default example values

A clean browser starts with illustrative examples, not personal recommendations:

- effective annual investment return: **5%**;
- existing mortgage: **€300,000**, **4.00%**, **25 years**;
- selected mortgage structure: **annuity**;
- planned purchase: **€350,000** price, **€40,000** own savings, **€15,000** purchase costs;
- purchase term: **30 years**;
- gross employment income: **€60,000**;
- WOZ planning value: **€400,000**;
- owner costs: **€250/month VvE plus €1,500/year maintenance**, equal to **€375/month** initially, with an editable **2% effective annual owner-cost growth** assumption;
- expected savings yield: **2% effective annually** and Box 3 debt interest: **4% nominal annually**, both illustrative household assumptions kept separate from statutory deemed percentages;
- Box 3: **2026 current-rules planning path**, one taxpayer, tax paid from savings.

The application restores the previous plan from browser `localStorage`. A restored value is therefore not necessarily a default. **Start fresh** clears the local snapshot and reloads the illustrative examples.

## Calculation capabilities

- One shared financial engine
- 1 to 6 investment and repayment phases
- Annuity and linear mortgage schedules
- Monthly extra repayments and annual lump sums
- Cash conservation after mortgage or Box 3 debt payoff
- Annual HRA/EWF/Hillen calculation allocated back to schedule rows
- Remaining HRA eligibility and qualifying Box 1 debt share
- Year-specific Hillen path from 2026 through its phase-out
- 2026 mixed-asset Box 3 estimate across investments, savings, and Box 3 debt
- Dynamic household savings and Box 3 debt balances
- Box 3 tax paid from savings, investment portfolio, or external cash flow
- Nullable January 1 snapshot gate for mid-year plans
- Current-law incomplete-year and proposed-regime availability handling
- 2026 transfer-tax, NHG, and LTV planning checks
- Fair-cash-flow equalisation between strategies, including dated external-cash opportunity costs
- Return sensitivity analysis
- Next € invest-versus-repay break-even analysis
- Browser-local save and restore
- Local assumption log and CSV export

## Important calculation conventions

### Annual-rate semantics

Investment return, savings yield, home-value growth, rent growth and owner-cost growth are effective annual assumptions. The engine converts each one with `(1 + annualRate)^(1/12) - 1`, so twelve monthly periods reproduce the entered annual rate. Recurring contributions are added at month end after that month's growth.

Mortgage interest and Box 3 debt interest remain nominal annual contractual rates divided by 12. Box 3 deemed percentages remain annual statutory tax factors rather than monthly compounding rates.

### Purchase-scenario funding

Buy-versus-rent and down-payment comparisons own their property price, other purchase costs, appraisal, transfer-tax treatment, NHG choice, mortgage method, nominal mortgage rate, term, WOZ proxy and local mortgage-tax assumption. They do not import those values from the Mortgage tab.

The public scenario path recalculates 2026 transfer tax and any eligible NHG fee from the active scenario. Starter treatment requires age 18–34, main-residence use, an unused exemption and a full property value within the 2026 ceiling. An ineligible starter selection falls back to the applicable ordinary rate and is disclosed.

Every purchase strategy must satisfy `property price + purchase costs = mortgage proceeds + buyer cash`. Buyer cash includes both the amount applied to the price and the cash used for purchase costs. Unfunded, NHG-ineligible or internally inconsistent purchases are rejected instead of silently capped or balanced with an unexplained source.

### Mortgage-interest relief

The annual HRA/EWF/Hillen estimate is authoritative. Interest is aggregated by calendar year, the annual home-tax estimate is calculated once, and that amount is allocated across the monthly schedule.

Home ownership months are separate from mortgage-active months, so EWF/Hillen can continue after the mortgage balance reaches zero while the home remains owner-occupied.

Automatic mode uses the bounded 2026 progressive Box 1 before-and-after bridge documented in `audits/r6.6/stage4-delivery-note.md`. It remains a planning calculation for the supported profile, not a full income-tax return.

For a new purchase mortgage above 30 years, modeled HRA is blocked rather than automatically granted for the first 30 years.

### Box 3

The current-rules estimate uses separate deemed-return inputs for:

- bank deposits;
- investments and other assets;
- deductible Box 3 debt.

It also includes the debt threshold, tax-free wealth allowance, and the lower of the deemed method and modeled actual-return rebuttal for complete calendar years.

A plan starting after January requires a complete historical January 1 snapshot or an explicit assumption that plan-start balances equal January 1 balances. Blank and zero are different states.

A final incomplete current-law year can remain unsettled. An incomplete proposed actual-return year is treated as not estimable rather than as zero tax.

The proposed future regime is a legislative scenario, not enacted law or a future tax-return engine.

### Strategy comparisons

Both strategies use the same required monthly capacity. The cheaper strategy invests the difference. Purchase cash must be funded from entered balances; the engine does not create free external capital.

Comparable wealth definitions vary by decision because some assets are common to both paths. Each result explains what is included, and the detailed method remains available under **How this comparison works**.

### Next €

Next € reruns the production Extra Repayment versus Invest scenario to estimate the effective annual investment return at which the two uses of additional monthly cash break even.

It is not risk-adjusted. Extra repayment is comparatively certain; investment returns are volatile.

### Canonical results and exports

The R6.6 audit branch creates versioned canonical records for the main plan, decision comparison and Next Euro calculation. Headline cards, result tables, charts, the local audit log and CSV export consume those records rather than selecting raw calculation fields independently.

Before-Box-3 values come from a separate no-Box-3 counterfactual run. After-Box-3 values come from the selected tax run. If a tax-adjusted result is unavailable, its numeric export cell remains blank and the status and reason stay explicit.

## Architecture

- `finance-core.js`: mortgage, HRA allocation, Box 3, household balances, investment flows, and combined-plan calculations
- `logic-integrity-ui.js`: model metadata and R6.3/R6.4 validity gates
- `box3-household.js`: browser adapter for savings and Box 3 debt
- `purchase-rules.js`: 2026 transfer-tax, NHG, and LTV planning rules
- `input-integrity.js`: strict browser input validation and unavailable-result gating
- `app.js`: main Investment and Mortgage interface
- `purchase-costs.js`: purchase-cost controls and adapters
- `scenario-engine.js`: five comparison strategies and scenario interface
- `next-euro.js`: marginal invest-versus-repay break-even solver
- `app-state.js`: browser-local persistence and input normalization
- `view-density.js`: R6.5 local interface folds, inherited scenario return, compact save status, and audit controls
- `view-density-state.js`: late-control restoration, Next € assumption controls, and Box 3 method column
- `output-integrity.js`: versioned canonical results, available/unavailable semantics, display adapters, and export rows

The deterministic browser load order is:

1. `model-contract.js`
2. `policy-2026.js`
3. `finance-core.js`
4. `box1-2026.js`
5. `logic-integrity-ui.js`
6. `box3-household.js`
7. `policy-ui.js`
8. `purchase-rules.js`
9. `output-integrity.js`
10. `input-integrity.js`
11. `app.js`
12. `purchase-costs.js`
13. `scenario-engine.js`
14. `box1-2026-ui.js`
15. `next-euro.js`
16. `app-state.js`
17. `view-density.js`
18. `view-density-state.js`

## Verification

Run with Node 24 or newer:

```bash
npm ci
npm test
npm run verify:50
npx playwright install chromium
npm run test:e2e
```

The R6.6 release candidate passes:

- **232 automated Node tests**;
- **50 of 50 deterministic scenario reconciliations**;
- both pinned Chromium browser contracts;
- exact Stage 7 to Stage 8 financial-result parity across the 50-scenario matrix, with no leader changes.

The test suite covers mortgage identities, HRA allocation, EWF/Hillen, HRA expiry, mixed-asset Box 3, partial-year gates, dynamic household balances, cash conservation, purchase rules, all five scenario types, canonical output availability, screen/export field identity, local persistence primitives, local assumption folds, and CSV escaping.

## Main limitations

- Investment, property, rent, and cost growth rates are assumptions, not forecasts.
- HRA is a planning approximation, not an aangifte calculation.
- Box 3 does not represent every asset, exemption, partner-allocation, or partial-foreign-taxpayer case.
- Most 2026 tax parameters are held constant in long-horizon sensitivity calculations unless the model contains a specific year path.
- Results are nominal euros and are not inflation-adjusted real purchasing power.
- Owner-cost inputs escalate at the entered effective annual rate; a 0% rate keeps them flat in nominal euros.
- Investment returns are uncertain and can be sequence-dependent. Mortgage repayment savings are contractual within the entered mortgage assumptions, but lender conditions can differ.
- Liquidity is not assigned a monetary value. Home equity and repaid debt can be less accessible than investments or cash.
- Purchase financing costs with possible first-year deductibility are not fully modeled.
- The planner does not calculate official Nibud/LTI borrowing capacity or lender acceptance.
- Mortgage product behavior after extra repayment may differ by lender.
- Local browser persistence is device-specific and is not cloud storage.

## Revision sequence

- R1 Runtime integrity: complete
- R2 HRA reconciliation: complete
- R3 Household balance sheet: complete
- R4 Scenario realism: complete
- R5 Next € optimizer: complete
- R6 Product hardening: complete
- R6.3 Logic integrity: complete
- R6.4 Public-beta calculation gates: complete
- R6.4.1 Output integrity and 50-scenario reconciliation: complete
- R6.4.2 Browser responsiveness hotfix: complete
- **R6.5 Interface simplification: complete**
- **R6.6 Decision integrity, Stages 1 through 8: complete on the controlled audit branch**

The next controlled checkpoint is release authorization: merge draft PR #13, verify GitHub workflows and wait for the public deployment before testing.

## Run locally

Keep the repository files together and open `index.html` in a modern browser, or serve the folder with any static HTTP server.

The application has no backend account and does not submit entered financial values to a planner server.
