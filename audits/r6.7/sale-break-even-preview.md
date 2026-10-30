# Home sale break-even preview

Development preview dated 27 October 2026, based on `f3231c972c54b8e1440fddce5e029d80acd11e4f` from `r6-7-rate-periods-preview`. This is an addition to the development branch, not the frozen R6.6 calculation candidate. The existing PR 13 release gate remains in force.

## User-visible purpose

The new sixth decision in Scenarios is **Home sale: break-even vs renting**. It answers the sale price required to finish ahead of comparable renting after a stated ownership period. It distinguishes:

- money released after selling costs and mortgage repayment;
- the ownership cash result after recovering all cash contributed;
- the advantage or disadvantage against comparable rent;
- the optional terminal wealth comparison against renting and investing.

The endpoint is after the scheduled mortgage payment in the selected sale month. The holding period, original mortgage term and mortgage fixed-rate period are separate inputs. Monetary results are nominal euros.

## Accounting identity

Let `C` be cash contributed from purchase through sale after housing tax effects, `B` the outstanding mortgage, `F` fixed selling costs, `s` the percentage selling cost as a fraction, and `R` comparable rent over the same period. Then:

```
net sale proceeds = (1 - s) * sale price - F - B
ownership cash result = net sale proceeds - C
advantage against renting = ownership cash result + R
rent-parity sale price = (B + C + F - R) / (1 - s)
cash-recovery sale price = (B + C + F) / (1 - s)
debt-clearance sale price = (B + F) / (1 - s)
```

Principal repayments reduce remaining debt by the same amount. They must not become a second economic expense. Financed purchase costs reduce initial buyer cash and increase original debt, with an explicit sources-and-uses reconciliation. Later borrowing is outside this scenario's original-purchase model.

If the mathematical rent-parity threshold is below zero, every nonnegative selling price meets the rent comparison. This does not eliminate any cash required to repay a mortgage shortfall. A positive amount of cash released at sale does not by itself establish a profit.

## Shared calculations

`sale-break-even.js` delegates mortgage amortization to `FinanceCore.mortgageSchedule`, including rate resets and extra payments. It uses the same Box 1 implementation as the browser, including in the CommonJS entry point. Each annual sale horizon reallocates annual mortgage tax independently, so tax attributed to an earlier hypothetical sale does not depend on months after that sale.

Mortgage extras are actual payments clipped to remaining principal. Monthly extras, calendar-month annual extras and explicitly dated extra-payment arrays are supported by the core. Unused planned extra payments are not counted as ownership expenses.

Rent and non-mortgage ownership costs grow at effective annual rates converted to monthly growth. The first month's amount equals the entered starting amount. A maintenance item already included in VvE/service charges must not be entered twice.

The investment comparison delegates to `FinanceCore.simulateInvestmentFlows` and equalizes both alternatives' monthly budgets. The renter retains the cash that the buyer used at acquisition. Each alternative invests its own monthly surplus. Shared other investments, retained savings, debt and ordinary monthly investment contributions affect both alternatives and the nonlinear Box 3 calculation. Avoided rent is not added again to these terminal wealth results.

The sale scenario supplies explicit January 1 snapshots to the shared investment gate. Its own inputs remain authoritative even when the main planner has blank or conflicting snapshot fields. The normal snapshot-completeness and partial-year availability checks still apply.

## Inputs and scope

The scenario begins at original purchase. Original purchase price, down payment, loan term and date must be supplied. Importing an existing mortgage copies clearly labeled assumptions without inferring original facts from a current balance or remaining term. Imported data is a snapshot; later edits elsewhere do not silently change the scenario.

Acquisition costs are an entered total, including any transfer tax, notary, financing, NHG and other applicable costs. This scenario does not independently determine purchase-tax exemptions or lending eligibility. The original purchase-cost and rules tools remain available for those estimates.

The tax figure is a signed, housing-related net tax effect, not a user's entire income-tax refund. The automatic estimate uses the existing bounded 2026 Box 1 model, including its profile limitations. Historical tax rules are not reconstructed. A dated manual adjustment is possible; its investment timing assumption must be visible. Cash released at sale excludes tax refunds paid later, while the economic comparison can attribute a modeled tax effect to the ownership period.

Investment returns are assumptions. The optional Box 3 path retains the existing policy parameters and availability rules. Missing January 1 information for a midyear start, or unavailable tax-adjusted results, must not be converted into a falsely precise after-tax comparison. The basic housing-cost comparison remains separately identifiable.

This feature does not alter statutory values, the policy verification date, the public-site release, or the frozen R6.6 identity. Future law is not inferred from a changed software date.

## Independent numerical reference

For a purchase at EUR 350,000, EUR 50,000 down payment, EUR 300,000 mortgage, EUR 10,000 acquisition costs, EUR 30,000 principal repaid, EUR 50,000 interest, EUR 15,000 ownership expenses, EUR 15,000 net housing tax benefit, and EUR 90,000 comparable rent:

- remaining debt: EUR 270,000;
- net cash contributed: EUR 140,000;
- selling costs: EUR 3,000 plus 1.5% of selling price;
- rent-parity sale price: EUR 327,918.7817258883;
- full cash-recovery sale price: EUR 419,289.34010152286;
- at a EUR 350,000 sale: EUR 71,750 released, EUR 68,250 net ownership cost, EUR 21,750 advantage against renting.

These are synthetic acceptance figures, not the user's personal finances.

## Validation

Verified on 27 October 2026:

- **346 passing test cases across 44 files, zero failures.** Each file ran in its own fresh Node process. The total combines the complete suite with targeted reruns after the final date and explicit-snapshot fixes.
- **38 new sale-scenario cases** cover the independent cash ledger, principal neutrality, purchase funding, zero-interest and standard amortization, rate resets, extras, payoff, dated renovation and tax effects, zero-return investment parity, equal budgets, Box 1 boundaries, Box 3 availability, and browser/Node parity. Browser-specific regressions cover inherited housing-tax context and blank or conflicting main-planner January 1 inputs.
- The existing **50-scenario financial reconciliation** and **50-scenario Stage 10 reconciliation** report no failed cases, leader mismatches or unexplained differences.
- Syntax checks and `git diff --check` pass.
- Desktop Chromium interaction checks confirm: the new selector and separate input panel; correct default cash results; a negative sale settlement; zero-return investment parity; unavailable investment results when January 1 inputs are missing; successful investment calculation after entering those snapshots; invalid-input clearing; rate resets; original-fact safeguards when importing an existing mortgage; saved-state restoration; and switching to a valid existing buy-versus-rent comparison and back.
- The scenario CSV and combined assumption CSV were downloaded and parsed. Both contain the displayed scenario's source inputs, exact unrounded thresholds, dated period, investment results and current build identity.
- `scripts/sale-break-even-browser-contract.mjs` is registered in browser CI for desktop (1440 px) and mobile (390 px). It checks displayed numerical results, invalid-input clearing, zero-return parity, explicit midyear snapshots, persistence, scenario switching, horizontal overflow and browser errors.

The first browser CI attempt stopped at the older smoke test's hardcoded R6.6 footer assertion. That assertion now compares the complete visible label, runtime model metadata and release identity with the checked-in release metadata. Existing behavioral checks remain enabled.

The default January 2026 illustrative case shows a rent-parity price of EUR 331,030, a cash-recovery price of EUR 422,401, and EUR 70,407 cash released with EUR 18,686 advantage over renting at a EUR 350,000 sale after 60 months. These displayed values are rounded; threshold displays round upward to whole euros. The investment case starting March 2026 at a 5% return with January 1 portfolio/savings/debt of EUR 0 / 60,000 / 0 shows an investment-parity price of EUR 345,642 and EUR 4,293 advantage at the same sale price.

The repository's full browser CI matrix remains a separate pull-request check. This local evidence does not claim a completed mobile-browser matrix, release freeze, approval of PR 13, or public deployment.
