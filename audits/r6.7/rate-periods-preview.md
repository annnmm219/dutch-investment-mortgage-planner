# Mortgage periods and investment conclusion preview

Development preview dated 23 October 2026. This is not the frozen R6.6 candidate.

The original mortgage comparison defaulted to the end of the investment phases (5 + 5 + 10 years). Investment results were collapsed under Scenarios. The preview defaults the Mortgage report to the full remaining repayment term, displays explicit endpoints and payment components, and places a visible Investment result beneath the investment assumptions.

Mortgage rate periods are optional and independent of investment phases. The first period uses the entered current rate for the remaining fixed period. The second uses an editable nominal annual rate. At the boundary, each mortgage type takes its actual outstanding balance, including extra repayments, and recalculates scheduled repayments over the remaining original term. Annuity uses a new annuity payment; linear uses remaining principal divided by remaining months. Repayment and HRA eligibility clocks do not restart. An extra repayment reduces term within a rate period; at the next reset, the remaining balance is recast over the original remaining term. This is the modeled lender convention.

Full-term mortgage reports assume no additional overpayments after the final entered investment phase. Investment contributions and the investment endpoint remain independent of the mortgage report selector. Scenarios and Next Euro continue to use their own single-rate assumptions; the main plan reset is not imported there.

Investment results use the existing canonical output, including before-tax fallback and unavailable states. The conclusion states its start/end dates, starting portfolio plus contributions, growth, total settled Box 3, and additional tax paid outside the modeled accounts where applicable. A portfolio figure is not total household wealth or a guaranteed future payout.

Validation: 308/308 Node tests pass, including 13 new tests covering independent 10-year balance/reset-payment values, linear/annuity parity between the combined and standalone engines, overpayments, zero rates, exact off-January reset dates, early payoff, HRA expiry, a synthetic 27-year investment reference, persistence and unfrozen identity. Legacy and Stage 10 50-case deterministic matrices pass, with no new leader or unexplained changes under their unchanged fixed-rate inputs.

Browser checks: rate reset and payment recalculation, both mortgage types, 30-year mortgage/27-year investment independence, a full multi-phase investment conclusion, and reload/persistence were exercised in the managed browser. A complete new desktop/mobile browser gate has not been run.

The prior frozen identity is preserved at audits/r6.6/frozen-release-identity.json. The active calculation identity is explicitly unfrozen. The statutory 2027 parameter and Box 3 legislative-timeline update remain outstanding; no policy verification date has been advanced. Keep PR 13 draft and unmerged.
