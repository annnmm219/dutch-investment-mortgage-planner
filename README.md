# Dutch Investment & Mortgage Planner

A static, browser-based planner for comparing Dutch mortgage, investment, Box 3, purchase-cost, and household strategy choices.

The project is designed for **scenario planning**. It is not mortgage underwriting, a tax return, or personal financial advice.

## Current release: R6.5 Interface Simplification

R6.5 is the final interface pass before another independent logic and fact review. It does **not** change the financial formulas introduced and tested through R6.4.2.

The release removes the global Standard/Advanced mode and replaces it with one interface plus locally collapsed assumptions. Common inputs remain visible; technical settings stay beside the calculation they affect.

### What changed in R6.5

- Removed the global `Standard | Advanced` switch.
- Removed the global “Advanced settings are affecting this plan” banner.
- Reduced browser persistence to a subtle status plus **Start fresh**.
- Added local folds for:
  - Advanced Box 3 assumptions
  - Advanced mortgage and tax assumptions
  - Advanced scenario assumptions
  - Advanced Next € assumptions
  - methodology and calculation explanations
- Kept one expected investment-return assumption for the full plan.
- Scenario comparisons inherit the Investment-tab return unless the user explicitly enables a local override.
- Kept all 1 to 6 phases and all five comparison types available in the same interface.
- Replaced successful affordability callouts with a compact status while keeping actual failures visible.
- Moved non-critical methodology, caveats, and audit detail behind expandable sections.
- Preserved local storage, all financial settings, Hillen and scenario-WOZ controls, the assumption log, and CSV export.

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
- one expected annual investment return;
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

- investment return: **5%**;
- existing mortgage: **€300,000**, **4.00%**, **25 years**;
- selected mortgage structure: **annuity**;
- planned purchase: **€350,000** price, **€40,000** own savings, **€15,000** purchase costs;
- purchase term: **30 years**;
- gross employment income: **€60,000**;
- WOZ planning value: **€400,000**;
- owner costs: **€250/month VvE plus €1,500/year maintenance**, equal to **€375/month** before any custom additions;
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
- Fair-cash-flow equalisation between strategies
- Return sensitivity analysis
- Next € invest-versus-repay break-even analysis
- Browser-local save and restore
- Local assumption log and CSV export

## Important calculation conventions

### Mortgage-interest relief

The annual HRA/EWF/Hillen estimate is authoritative. Interest is aggregated by calendar year, the annual home-tax estimate is calculated once, and that amount is allocated across the monthly schedule.

Home ownership months are separate from mortgage-active months, so EWF/Hillen can continue after the mortgage balance reaches zero while the home remains owner-occupied.

The automatic deduction rate is a simplified planning proxy. It is not a full before-and-after Box 1 calculation.

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

Next € reruns the production Extra Repayment versus Invest scenario to estimate the nominal investment return at which the two uses of additional monthly cash break even.

It is not risk-adjusted. Extra repayment is comparatively certain; investment returns are volatile.

## Architecture

- `finance-core.js`: mortgage, HRA allocation, Box 3, household balances, investment flows, and combined-plan calculations
- `logic-integrity-ui.js`: model metadata and R6.3/R6.4 validity gates
- `box3-household.js`: browser adapter for savings and Box 3 debt
- `purchase-rules.js`: 2026 transfer-tax, NHG, and LTV planning rules
- `app.js`: main Investment and Mortgage interface
- `purchase-costs.js`: purchase-cost controls and adapters
- `scenario-engine.js`: five comparison strategies and scenario interface
- `next-euro.js`: marginal invest-versus-repay break-even solver
- `app-state.js`: browser-local persistence and input normalization
- `view-density.js`: R6.5 local interface folds, inherited scenario return, compact save status, and audit controls
- `view-density-state.js`: late-control restoration, Next € assumption controls, and Box 3 method column
- `output-integrity.js`: authoritative available/unavailable output semantics

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
11. `view-density-state.js`

## Verification

Run with Node 24 or newer:

```bash
npm test
npm run verify:50
```

R6.5 currently passes:

- **143 automated Node tests**;
- **50 of 50 deterministic scenario reconciliations**;
- a real Chromium smoke test covering initial load, inherited return, scenario rerendering, local assumption folds, and Mortgage-tab interaction.

The test suite covers mortgage identities, HRA allocation, EWF/Hillen, HRA expiry, mixed-asset Box 3, partial-year gates, dynamic household balances, cash conservation, purchase rules, all five scenario types, output availability, local persistence primitives, local assumption folds, and CSV escaping.

## Main limitations

- Investment, property, rent, and cost growth rates are assumptions, not forecasts.
- HRA is a planning approximation, not an aangifte calculation.
- Box 3 does not represent every asset, exemption, partner-allocation, or partial-foreign-taxpayer case.
- Most 2026 tax parameters are held constant in long-horizon sensitivity calculations unless the model contains a specific year path.
- Owner-cost inputs remain flat in nominal euros unless changed manually.
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

The next step is another independent logic and fact check, followed by controlled user testing if that review passes.

## Run locally

Keep the repository files together and open `index.html` in a modern browser, or serve the folder with any static HTTP server.

The application has no backend account and does not submit entered financial values to a planner server.
