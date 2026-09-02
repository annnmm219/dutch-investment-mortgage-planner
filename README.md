# Dutch Investment & Mortgage Planner

A static browser planner for comparing Dutch mortgage, investment, Box 3, purchase-cost, and household strategy choices.

The project is designed for **scenario planning**, not mortgage underwriting, tax filing, or personal financial advice.

## Current release candidate: R6.4 Public Beta Gate

R6.4 is a bounded correctness and test-readiness release on top of the tested R6.3 calculation kernel. It does not add an affordability engine, Monte Carlo simulation, another tax category, or a second simplified calculation path.

### R6.4 public-beta gates

- A plan starting after January requires an explicit historical **1 January Box 3 snapshot** for investments, savings and Box 3 debt.
- Zero remains a valid January 1 value, but blank and zero are no longer treated as the same thing.
- A user may explicitly confirm the simplifying assumption that plan-start balances equal the January 1 balances.
- Mid-year purchase strategies use one common historical January 1 snapshot before down payment and purchase costs are applied.
- Proposed actual-return Box 3 is marked **not estimable** for incomplete calendar years. Unknown tax is not displayed or treated as €0.
- A new purchase mortgage with a contractual term above 30 years cannot receive modeled mortgage-interest relief. Gross mortgage calculation remains available with relief switched off.
- `MODEL_META` supplies the R6.4 public version and persistence-schema marker.

## One engine, two densities

The browser has one financial engine and one page. **Standard** and **Advanced** change only which controls are visible.

### Standard

Standard is the default. It keeps the common planning path visible:

- plan date, starting investments and savings;
- expected investment return;
- one to three visible phases with monthly investing, monthly extra repayment and annual bonus allocation;
- light Box 3 on/off control, fiscal-partner count, income, 30% ruling input, HRA on/off and WOZ;
- existing mortgage or main-residence purchase inputs;
- normal 2% or starter transfer-tax treatment and standard NHG yes/no;
- annuity versus linear;
- one combined monthly owner-cost input;
- Buy versus Rent, Repay versus Invest with Next €, and Linear versus Annuity;
- result cards, mortgage schedule and affordability warning.

### Advanced

Advanced exposes the same stored values and calculation path, including:

- additional phases and annual bonus month;
- full Box 1 eligibility controls, manual deduction rate, remaining HRA period and qualifying loan share;
- post-payoff cash destination and mortgage report horizon;
- Box 3 payment source, debt ledger, statutory parameters, January 1 snapshot, year audit and proposed regime;
- full transfer-tax, appraisal, NHG and purchase-cost details;
- detailed VvE, maintenance, OZB, insurance and erfpacht inputs;
- larger-versus-smaller down payment, keep-versus-sell, and return sensitivity.

Switching views does not reset or rewrite any financial control. The selected view is stored in the existing local browser snapshot. If a hidden Advanced control differs from its safe default, Standard displays a visible summary chip and a link back to Advanced rather than silently hiding the active assumption.

The Standard view retains short model-boundary notes for:

- EWF continuing after mortgage payoff while the user still owns and occupies the home;
- an incomplete final Box 3 year remaining unsettled;
- funded cash being required at closing;
- Next € being a nominal, non-risk-adjusted break-even result.

There is no `index-advanced.html` and no second formula path.

## Stage 0: R7 affordability prototype quarantined

The experimental R7 income-based affordability work is preserved on:

```text
archive/r7-affordability-prototype
```

It is intentionally excluded from `main` and GitHub Pages. The prototype used a reconstructed financing-load table that did not sufficiently match the complete official 2026 Dutch tables. Its code shape may be reused later, but the table, tests and gross-income semantics must be rebuilt from primary sources before any affordability release.

## Main capabilities

- One financial engine with persistent Standard and Advanced UI densities
- 1 to 6 investment and repayment phases
- Annuity and Linear mortgage schedules with extra repayments
- 2026 HRA planning estimate after eigenwoningforfait and year-specific Hillen treatment
- Remaining HRA eligibility and qualifying Box 1 debt share
- Annual HRA calculation allocated back to monthly schedule rows so totals reconcile
- 2026 mixed-asset Box 3 estimate across investments, savings and Box 3 debt
- Dynamic savings and Box 3 debt balances
- Box 3 tax paid from savings, investments, or external cash flow
- 2026 transfer-tax, NHG planning, and LTV checks
- Five scenario comparisons: Buy vs Rent, larger vs smaller down payment, extra mortgage repayment vs invest, Linear vs Annuity, Keep vs Sell + Rent
- Fair-cash-flow equalisation across strategies
- Return sensitivity analysis
- Next € invest-vs-repay break-even analysis
- Browser-local save and restore plus one-click reset
- Dependency-free Node regression suite and GitHub Actions CI

## Architecture

`finance-core.js` is the shared calculation kernel for mortgage amortisation, HRA allocation, Box 3, household balances, investment growth, cash-flow equalisation, and combined-plan simulation.

`logic-integrity-ui.js` contains the R6.3/R6.4 boundary controls. R6.4 adds public model metadata, the nullable January 1 snapshot gate, proposed partial-year tax gate, and new-purchase HRA term gate. It decorates the existing shared functions rather than creating another finance engine.

`box3-household.js` is the browser adapter for the household savings and Box 3 debt ledger. It does not contain a second Box 3 formula.

`purchase-rules.js` contains pure 2026 Dutch purchase-rule calculations for transfer tax, simplified NHG checks and fees, and LTV.

`scenario-engine.js` contains the pure five-way scenario engine plus its browser UI. Household balances are passed into the same FinanceCore functions used by the main plan.

`next-euro.js` repeatedly runs the production Extra Repayment vs Invest scenario to solve for the approximate nominal break-even investment return.

`app-state.js` stores editable controls in `localStorage`, restores them on refresh, preserves selected mortgage method and active tab, and provides reset-to-examples behavior. It contains no financial formulas.

`view-density.js` is the visibility and proxy-control layer. It adds the Standard/Advanced switch, Standard light controls, active-Advanced-value chips, and visibility rules. It does not calculate a mortgage, tax amount, investment return or scenario result.

The deterministic browser load order is:

1. `finance-core.js`
2. `logic-integrity-ui.js`
3. `box3-household.js`
4. `purchase-rules.js`
5. `app.js`
6. `purchase-costs.js`
7. `scenario-engine.js`
8. `next-euro.js`
9. `app-state.js`
10. `view-density.js`

## HRA treatment

The annual HRA/EWF/Hillen estimate is authoritative. Mortgage interest is aggregated per calendar year, one annual estimate is calculated, and it is allocated back across schedule rows.

R6.3 separated:

- home ownership months, which determine whether EWF continues;
- deductible-interest months, which are limited by remaining HRA eligibility and qualifying Box 1 debt;
- mortgage balance, which may reach zero while owner-home taxation continues.

Hillen uses a year-specific planning series from 2026 and reaches zero from 2041. The automatic deduction rate remains a planning approximation, not a complete Box 1 tax-delta calculation.

For a new purchase mortgage above 30 years, R6.4 excludes modeled HRA rather than assuming that the first 30 years of a longer contractual amortisation automatically qualify.

## Box 3 treatment

The current-rules model uses separate deemed-return percentages for:

- bank deposits;
- investments and other assets;
- Box 3 debt.

It also models the debt threshold, tax-free wealth allowance, and the lower-of deemed-versus-modeled-actual-return comparison for complete calendar years.

For a current-law plan that starts after January, the actual-return rebuttal is not used unless complete year data is available. R6.4 additionally requires a complete historical January 1 snapshot or an explicit plan-start-balance assumption.

A final incomplete current-law year may be shown as an unsettled estimate. A partial year under the proposed actual-return regime is not assigned a euro estimate because the required calendar-year return data is incomplete.

The proposed future regime remains a restricted legislative scenario. It is not enacted law and is not a full future tax-return engine.

## Cash conservation

Mortgage-directed cash is never silently discarded.

When a monthly extra repayment or mortgage-directed bonus exceeds the remaining mortgage, the unused amount follows the selected destination:

- investments;
- savings;
- stop allocating / spending.

The scenario engine also rejects a purchase comparison when the entered starting savings cannot fund the required upfront cash. It does not inject free outside capital.

## Scenario timing convention

A purchase occurs at the selected scenario start after the historical January 1 Box 3 snapshot. For a mid-year Buy vs Rent or Down Payment comparison, both strategies therefore use the same January 1 household position. Their balances diverge only when the purchase cash event occurs.

## Next € optimizer

Next € answers:

> If I have another €X per month, should I invest it or repay my mortgage?

It reports:

- approximate nominal break-even investment return before modeled Box 3;
- which strategy leads at the entered return;
- modeled end-of-horizon difference;
- quick comparisons for €250, €500 and €1,000 per month.

The result is not risk-adjusted. Extra mortgage repayment is comparatively certain, while investment returns are volatile and may underperform the break-even percentage.

## Purchase rules

The purchase module includes planning checks for:

- 2026 starter exemption value cap of €555,000;
- 2% main-residence transfer tax;
- 8% residential property not used as the main residence;
- standard NHG planning limit €470,000;
- energy-enhanced NHG planning limit €498,200;
- 0.4% NHG fee;
- normal 100% LTV warning.

The starter selector does not establish all personal eligibility conditions. NHG and LTV checks do not replace lender underwriting. The planner does not calculate Nibud/LTI borrowing capacity.

## Tests

Run the full suite with Node 24 or newer:

```bash
npm test
```

The suite covers:

- mortgage amortisation identities;
- HRA, EWF and Hillen reconciliation;
- HRA expiry and qualifying debt share;
- mixed-asset Box 3;
- dynamic household savings and debt;
- incomplete-year Box 3 handling;
- mortgage cash-conservation invariants;
- 2026 purchase rules;
- external amortisation sanity references;
- five hand-worked scenario comparisons;
- purchase-cash and Box 3 coupling;
- owner-cost cash flows;
- Next € break-even behavior;
- deterministic browser load order;
- browser-local state serialization and restore primitives;
- R6.4 January 1, partial-year proposed-tax, common-snapshot and long-purchase-term gates;
- Standard being the default view;
- persistence of the Advanced view selection;
- view changes preserving underlying values;
- warning chips for non-default hidden assumptions;
- one-page, one-engine density rules.

GitHub Actions runs the same suite on pushes to `main` and pull requests.

## Main limitations

- Investment and property returns are assumptions, not forecasts.
- HRA is a planning approximation, not an aangifte calculation.
- Box 3 is not a complete tax-return engine and does not model every asset category, exemption, fiscal-partner allocation, or eligible partial-foreign-taxpayer case.
- Box 3 debt interest is modeled as a household cash expense; there is no full disposable-income budget.
- Owner-cost inputs are planning assumptions and remain flat unless changed manually.
- Proposed future Box 3 legislation may change.
- The planner does not calculate official Nibud/LTI borrowing capacity or lender acceptance.
- Extra repayment treatment may differ by lender.
- Local browser persistence is device-specific and is not a cloud backup.

## Revision sequence

- **R1 Runtime integrity: complete**
- **R2 HRA reconciliation: complete**
- **R3 Household balance sheet: complete**
- **R4 Scenario realism: complete**
- **R5 Next € optimizer: complete**
- **R6 Product hardening: complete**
- **R6.3 Logic integrity: complete**
- **R6.4 Public Beta Gate and view density: release candidate**

The intended next step after R6.4 passes its release gate is controlled user testing before broader functionality is considered.

## Run locally

Keep these files together and open `index.html` in a modern browser:

- `index.html`
- `styles.css`
- `finance-core.js`
- `logic-integrity-ui.js`
- `box3-household.js`
- `purchase-rules.js`
- `app.js`
- `purchase-costs.js`
- `scenario-engine.js`
- `next-euro.js`
- `app-state.js`
- `view-density.js`

The app has no backend or account system and does not submit entered financial values to a planner server.