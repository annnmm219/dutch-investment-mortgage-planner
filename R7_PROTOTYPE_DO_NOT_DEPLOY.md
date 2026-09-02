# Archived R7 affordability prototype

This branch preserves the experimental R7 income-based affordability work separately from the live planner.

## Status

**Do not merge or deploy this branch.**

The prototype used a compact reconstructed financing-load table rather than the complete official 2026 Dutch tables. Its internal tests showed that the code reproduced that reconstruction, but external verification found material differences from the official financing-load percentages. The prototype can therefore overstate indicative borrowing capacity.

The stable public baseline remains the R6.3 calculation kernel while R6.4 closes the remaining public-beta correctness gates.

## Reuse policy

The following may be reused later:

- the pure-module architecture;
- deterministic browser integration;
- input and disclosure patterns;
- the short-fixed-period test-rate concept.

The following must be replaced before any future affordability release:

- the reconstructed woonquote table;
- tests that restate the reconstructed values;
- one-table treatment across age and deductibility cases;
- silent reuse of the HRA taxable-income proxy as lender gross income.

Any future affordability version must be rebuilt from the official 2026 tables and validated through external golden cases before deployment.
