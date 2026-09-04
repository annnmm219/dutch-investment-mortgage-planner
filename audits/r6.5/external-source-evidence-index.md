# External source-evidence index

This index was supplied with the external audit bundle. It is preserved as provenance, not treated as a substitute for reproduction against the tagged R6.5 source.

The audit identified these code areas:

- `finance-core.js`
  - mortgage annuity and linear schedules;
  - investment-flow compounding;
  - own-home tax bridge;
  - EWF and tax helpers.
- `scenario-engine.js`
  - Buy/Rent and other decision scenarios;
  - cash-flow comparison;
  - browser-to-domain configuration adapter.
- `purchase-rules.js`
  - buyer status, transfer tax, NHG and purchase rules.
- `purchase-costs.js`
  - purchase-cost UI and derived costs.
- `box3-household.js`
  - household Box 3 defaults and calculation helpers.
- `next-euro.js`
  - marginal next-euro comparison logic.
- `app-state.js`
  - state storage and input propagation.
- `output-integrity.js`
  - result and export transformations.
- `logic-integrity-ui.js`
  - HRA eligibility/term guards and UI consistency.
- `view-density.js`
  - scenario/output presentation and derived UI.
- `scripts/browser-responsiveness-smoke.mjs`
  - browser responsiveness smoke coverage.
- `tests/*.test.js`
  - mortgage, scenario, purchase, Box 3 and reconciliation tests.

The supplied audit asserted these implementation themes:

1. Mortgage annuity and linear mathematics reconcile correctly.
2. Non-mortgage annual percentages are converted using division by 12 in material model paths.
3. Scenario calculation can consume purchase-cost/state inputs originating outside the scenario itself.
4. Own-home tax treatment is simplified into an effective single-rate bridge.
5. Flat portfolio-tax assumptions are used in places where Dutch Box 3 terminology may imply more precision.
6. Export integrity needs stronger field-level reconciliation.
7. Existing tests demonstrate internal consistency, but not full legal or economic semantic correctness.

Theme 5 conflicts with the tagged R6.5 mixed-asset Box 3 implementation and is therefore rejected in `finding-adjudication.md`. Theme 2, theme 3, theme 4 and theme 6 are accepted for R6.6 work after source reproduction.
