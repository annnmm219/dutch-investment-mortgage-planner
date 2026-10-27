# R6.6 Stage 5: economic consistency

**Stage status:** complete and verified  
**Stage 4 input:** `9e0aa5c52eadc71a8384486ea4956472a00f2462`  
**Branch:** `r6-6-decision-integrity`  
**Public `main`:** unchanged during Stage 5

## Purpose

Stage 5 makes the strategy comparisons economically consistent without extending the calculator into lender affordability, Monte Carlo forecasting or personal financial advice.

The stage corrects three bounded issues:

1. owner-only costs now escalate from their entered starting amounts using one explicit effective annual owner-cost growth assumption;
2. expected household savings yield and contractual Box 3 debt interest are visibly and numerically separate from statutory Box 3 deemed-return percentages;
3. external tax, Box 3 debt interest, external debt repayment and funded shortfalls are recorded by month and carried to the comparison horizon at the selected effective annual investment return.

## Owner-cost escalation

VVE or service charges, maintenance, owner taxes, homeowner insurance and ground lease use the same monthly equivalent of the entered effective annual owner-cost growth rate:

`monthly growth = (1 + effective annual growth)^(1/12) - 1`

The browser default is an editable 2% planning assumption. It is not a forecast. A 0% input reproduces the fixed nominal costs used before Stage 5. The five component totals still add exactly to the reported owner-cost total.

## Dated external cash flows

The previous comparison subtracted cumulative external cash at the horizon without regard to payment date. That treated an outflow in the first year as economically identical to an outflow in the last month.

Stage 5 records each external outflow in its payment month. Its horizon value is:

`outflow × (1 + monthly investment return)^(months remaining)`

The terminal sum is exposed as `externalCashFlowFutureValue`. An incomplete final-year Box 3 estimate remains a terminal liability and is not backdated.

This is an opportunity-cost convention for fair strategy comparison, not a claim that the outflow was literally invested. The same entered effective annual investment return drives both the investment projection and this comparison convention.

## Principal and equity

Mortgage and Box 3 debt principal remain balance-sheet transfers:

- mortgage principal reduces the mortgage and increases home equity;
- Box 3 debt principal reduces the debt balance;
- principal is not labeled or counted as an economic expense;
- interest, tax and owner-only costs remain expenses;
- external principal funding still has a dated opportunity cost because the cash is no longer available elsewhere.

A dedicated zero-return purchase test proves that a fully cash-funded home and retained cash have equal wealth when price, costs, rent, growth and tax are all zero.

## Actual rates versus statutory deemed rates

The browser now uses separate editable planning defaults:

| Input | Stage 5 default | Meaning |
|---|---:|---|
| Expected effective annual savings yield | 2.00% | Household projection assumption |
| Nominal annual Box 3 debt interest | 4.00% | Household contractual assumption |
| 2026 deemed return on bank deposits | 1.28% | Provisional statutory tax parameter |
| 2026 deemed return on Box 3 debt | 2.70% | Provisional statutory tax parameter |

The 2% and 4% values are illustrative user-editable assumptions, not sourced legal constants. The 1.28% and 2.70% values remain in the dated 2026 policy registry and are used only by the deemed-return calculation.

## Deterministic impact

The reproducible capture script compares Stage 5 with the Stage 4 evidence head across the existing 50-scenario matrix.

| Gate | Result |
|---|---:|
| Scenarios reconciled | 50 / 50 |
| Scenarios changing numerically | 35 |
| Scenario leaders changing | 0 |
| Mortgage balance changes | 0 |
| Gross mortgage interest changes | 0 |
| Box 1 own-home effect changes | 0 |
| Purchase-cost changes | 0 |
| Selling-cost changes | 0 |
| Home-equity changes | 0 |

Owner-cost escalation changes cash available for investment and can therefore change downstream Box 3 tax. Dated external-cash valuation changes comparable wealth only where an external outflow exists and the investment return is non-zero. These are intended Stage 5 effects.

The largest absolute changes in this deliberately broad matrix are €153,365.74 for Strategy A and €616,347.57 for Strategy B. They occur in long-horizon stress cases where recurring owner costs compound for decades or early external cash flows are carried at high assumed returns. They are not representative forecasts and no leader changes.

## Verification

- 208 of 208 Node tests pass;
- 50 of 50 deterministic scenarios reconcile;
- owner-cost month 13 reproduces exactly one entered annual growth step;
- zero owner-cost growth preserves the prior fixed-cost convention;
- earlier external outflows have a larger horizon value than later equal outflows;
- principal and equity identities remain intact;
- actual household rates differ from statutory deemed rates by construction;
- `git diff --check` passes.

The local Chromium executable was unavailable in the work environment. The unchanged GitHub browser-responsiveness workflow remains the authoritative browser gate for the pushed checkpoint.

## Reproducibility

`audits/r6.6/capture-stage5-results.js` accepts a repository root and implementation label. It captures the 50 deterministic scenario results plus canonical owner-cost and dated-external-cash probes. It can be run against the Stage 4 commit and the Stage 5 tree to reproduce the reported comparison.

## Boundaries retained

- Results remain nominal, not inflation-adjusted or expressed in real euros.
- Liquidity is disclosed conceptually but is not assigned a euro utility value.
- Mortgage prepayment is modeled as a certain contractual saving within the entered assumptions; investment returns remain uncertain.
- Rent, owner costs and property growth are independent user assumptions.
- Affordability remains a planning budget check, not lender approval.
- The Box 3 calculation remains the documented planning model, not a tax return.
- Stage 4's statutory-ceiling interpretation and professional-review warning remain unchanged.

The next controlled checkpoint is Stage 6: canonical results and exports.
