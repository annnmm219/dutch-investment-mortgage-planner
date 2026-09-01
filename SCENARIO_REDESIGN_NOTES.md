# Scenario redesign

This checkpoint documents the new Scenario decision-engine design before deployment.

## Core principle
Every comparison starts from the same initial wealth and equalizes monthly housing/investment cash-flow capacity. The strategy with lower housing cash outflow automatically invests the difference.

## Comparisons
- Buy a home vs Rent + invest
- Larger down payment vs Smaller down payment + invest
- Extra mortgage repayment vs Invest
- Linear vs Annuity + invest cash-flow difference
- Keep home vs Sell now + rent/invest

## Shared assumptions
Investment return, horizon, home-value growth, rent growth, VVE/service charges, other maintenance, selling costs, selected Box 3 regime and mortgage-interest deduction.

## Results
Two-strategy final wealth comparison, driver breakdown, and investment-return sensitivity with approximate crossover.
