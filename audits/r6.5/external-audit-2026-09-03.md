# External audit supplied for the R6.5 review

**Source:** User-supplied audit bundle, received 3 September 2026  
**Original extracted report SHA-256:** `60f1b92ce458dcd73e6e594bc08ca4fc13425d327d734577de275b49ffe00276`  
**Bundle SHA-256:** `758b8e1e7b6fb250fb34de8ad1d39c6c78c3d2add0f94617b7f07b5d386fe50d`

This file preserves the substance and organization of the supplied audit for repository traceability. The original upload remains the audit authority for exact wording. Findings were not silently corrected here. The separate `finding-adjudication.md` records which claims were accepted, narrowed, or rejected after checking the tagged R6.5 source.

## Executive verdict from the supplied audit

- The mortgage amortisation engine is described as sound.
- The wider decision model is described as not yet reliable enough for a strong “which option is better?” conclusion.
- The audit recommends private or controlled testing rather than broad decision-support positioning.
- Its highest-priority concerns are annual-rate semantics, cross-tab purchase costs, the Box 1 own-home tax bridge, Box 3 representation, financing identity, export integrity, validation, and result disclosures.

## Highest-priority findings as supplied

1. **Annual-return semantics:** investment, appreciation and inflation assumptions are divided by 12 and compounded monthly even though users are likely to read them as effective annual rates.
2. **Scenario isolation:** purchase scenarios can consume purchase costs or status originating in the separate Mortgage tab.
3. **Box 1 own-home tax:** mortgage interest, EWF and Hillen are compressed into one effective rate, which can be unreliable near income-bracket and high-income deduction boundaries.
4. **Box 3 representation:** the audit claims that a flat investment-tax drag is presented as Dutch Box 3.
5. **Financing identity:** Buy-versus-Rent should show that price plus costs is financed by mortgage proceeds plus buyer cash, and that both strategies receive equal external capital.
6. **CSV integrity:** before-Box-3 and after-Box-3 labels can point to the same value.
7. **Browser-test packaging:** CI provisions browser tooling, but `package.json` does not reproduce the complete browser test path.

## Supplied numerical examples

### Mortgage algebra

The audit reports that the following independent mortgage cases match at cent precision:

- €350,000 annuity mortgage, 4%, 30 years: monthly payment €1,670.95 and total interest €251,543.27.
- €350,000 linear mortgage, 4%, 30 years: first payment €2,138.89, last payment €975.46 and total interest €210,583.33.
- €120,000, 0%, 10 years: €1,000 monthly payment and zero interest.
- €250,000, 10%, 30 years: €2,193.93 monthly payment and €539,814.41 total interest.
- €12,000, 5%, one year: €1,027.29 monthly payment and €327.48 total interest.

### Investment-return semantic example

For €100,000, 7% and 30 years with no contributions, tax or fees:

```text
Effective-annual interpretation: €761,225.50
Annual/12 compounded monthly:    €811,649.75
Difference:                       €50,424.24
```

The audit classifies this as a model-definition defect rather than rounding.

### High-income own-home boundary example

For deductible interest of €2,000, EWF of €1,750, a 49.5% top marginal rate and a 37.56% deduction limitation, the supplied simplified separated bridge produces an estimated €115.05 cost while the one-rate net approach produces an estimated €93.90 benefit. The audit uses this example to show that one universal rate can reverse the sign.

## Supplied formula conclusions

| Component | Supplied verdict |
|---|---|
| Annuity and linear mortgage mathematics | Correct |
| Mortgage nominal annual rate divided by 12 | Correct contractual convention |
| Mortgage prepayment algebra | Correct, timing should be explicit |
| Effective annual investment return divided by 12 | Defect |
| Home appreciation and inflation divided by 12 | Defect or ambiguity |
| Purchase costs originating outside the active scenario | High-severity defect |
| One-rate mortgage-interest/EWF bridge | Incomplete or defective at boundaries |
| Homeowner and renter terminal-wealth structure | Generally sound if cash is matched |

## Supplied Dutch-law themes

The audit states that a dated policy layer should cover:

- 2026 Box 1 brackets and rates;
- the maximum own-home deduction rate;
- EWF bands and the high-value threshold;
- the Hillen phase-out;
- Box 3 tax rate, allowance, deemed-return percentages and debt threshold;
- transfer-tax rates and starter-exemption ceiling;
- NHG limits, energy uplift and fee;
- provisional versus final status and source metadata.

It also stresses that mortgage-interest eligibility, fiscal-partner allocation, transitional mortgage history, lender prepayment terms, actual WOZ, full NHG eligibility and future law are circumstance-dependent.

## Supplied correction priorities

### Must fix before broad decision testing

1. Correct effective-annual rate conversion.
2. Isolate purchase scenarios from the Mortgage tab.
3. Add a complete purchase-financing identity.
4. Rebuild or explicitly narrow the own-home tax calculation.
5. Correct the Box 3 representation or terminology.
6. Repair before/after Box 3 export fields.
7. Add systematic invalid and non-finite input handling.
8. Show tax year and verification date beside results.
9. Replace unconditional winner language with assumption-dependent comparison language.

### Later recommendations

- Centralise annual policy values.
- Add sensitivity and stress testing.
- Complete mobile, keyboard and accessibility testing.
- Make the full local browser-test path reproducible.
- Consider Monte Carlo, rate resets, fiscal-partner allocation, transitional mortgage history, liquidity constraints and property-condition modelling only after the core decision contract is reliable.

## Supplied test recommendations

The audit proposes:

- golden mortgage and prepayment vectors;
- an effective-annual conversion invariant;
- beginning/end-of-month contribution timing tests;
- Box 1, EWF, Hillen and eligibility boundary cases;
- 2026 transfer-tax and starter-exemption boundaries;
- mixed-asset Box 3 cases;
- scenario-isolation mutation tests;
- equal-external-cash-flow invariants;
- screen/export reconciliation;
- Chromium, Firefox and WebKit coverage at mobile, tablet, desktop and zoomed viewports.

## Important provenance limitation

The supplied audit did not identify the R6.5 commit hash in its report, and some claims conflict with the current tagged source. In particular, the R6.5 engine already contains mixed-asset Box 3 logic and 2026 EWF bands. Those conflicts are recorded rather than erased in `finding-adjudication.md`.
