# R6.4 Public Beta Gate

R6.4 is a bounded correctness release. It does not add affordability, Monte Carlo, additional tax categories, or a second simplified calculation engine.

## Release gates

1. A mid-year Box 3 calculation requires a complete 1 January portfolio, savings and Box 3 debt snapshot, unless the user explicitly confirms that plan-start balances should be used as the 1 January assumption.
2. Purchase strategies share one historical 1 January snapshot before down payment and purchase costs are applied.
3. Proposed actual-return Box 3 is marked not estimable for incomplete calendar years. Unknown tax is not displayed or treated as zero.
4. A new purchase mortgage with a contractual term above 30 years cannot receive modeled mortgage-interest relief. Gross mortgage calculations remain available with relief switched off.
5. `MODEL_META` is the public source for the R6.4 release identifier and persistence schema marker.

## Deliberately deferred

- Nibud/LTI affordability
- standard-versus-advanced presentation work
- Monte Carlo and risk-adjusted return modeling
- full Box 1 tax calculation
- mortgage tranche support

The archived R7 affordability prototype is intentionally kept on `archive/r7-affordability-prototype` and is not part of this release.
