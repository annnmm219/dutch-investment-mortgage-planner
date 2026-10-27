# R6.6 Stage 8: final logic, fact and release audit

**Stage status:** complete and verified locally  
**Stage 7 evidence head:** `dce95f6b23b0052be2ba7233bc22a6cdf68705c3`  
**Branch:** `r6-6-decision-integrity`  
**Public `main`:** unchanged until explicit merge authorization

## Verdict

The Stage 8 review found no new calculation defect. The five decision modes retain consistent starting capital, dated cash-flow equalisation, debt and equity treatment, purchase and sale costs, Box 1 treatment, and Box 3 payment-source accounting.

The branch is promoted from an R6.5-labelled audit build to the R6.6 Decision Integrity release candidate. This changes release metadata and browser cache keys, not financial results.

## Final verification

| Gate | Result |
|---|---:|
| Node tests | 232 / 232 passed |
| Deterministic scenario reconciliation | 50 / 50 passed |
| Stage 7 to Stage 8 numerical changes | 0 |
| Scenario leader changes | 0 |
| Chromium browser contracts | 2 / 2 passed |
| Browser page errors | 0 |
| JavaScript syntax and diff checks | passed |

## Primary-source verification

| Area | Verified 2026 treatment | Status |
|---|---|---|
| Box 1 | 35.75%, 37.56% and 49.50% brackets; €38,883 and €78,426 thresholds | Final |
| Own-home rate adjustment | 11.94 percentage points; maximum effective deduction rate 37.56% | Final |
| EWF and Hillen | Published 2026 EWF bands; Hillen relief 71.867%, ending in 2041 | Final |
| Box 3 current law | 36% tax; €59,357 allowance; 6.00% investments; 1.28% savings; 2.70% debt; €3,800 debt threshold | Investment rate, tax, allowance and threshold final; savings and debt rates provisional |
| Transfer tax | 2% main residence, 8% other residential property, 10.4% other real estate; €555,000 starter ceiling | Final |
| NHG | €470,000 standard limit, €498,200 energy limit, 0.4% fee | Final |
| LTV | Standard mortgage limit of 100% of appraised home value | Final planning guardrail |
| Future Box 3 | 36%, €1,800 exempt result and €500 loss threshold in the Tweede Kamer text | Proposed, not enacted |

## Hillen conflict adjudication

The Belastingdienst example remains inconsistent with the statutory mechanism. Its high-income Hillen example uses a €5,215 rate-adjustment base despite only €3,500 of qualifying own-home costs.

The legislative explanation states that the adjustment base cannot exceed the total own-home costs deducted. The implementation therefore keeps the €3,500 ceiling and a €417.90 adjustment. This is a confirmed legal-hierarchy decision, but the source inconsistency remains disclosed for professional review.

The separate wrong-sign case remains unchanged:

- Box 1 income before own-home items: €80,000;
- EWF: €1,750;
- qualifying own-home costs: €2,000;
- table-tax reduction: €123.75;
- high-income adjustment: €238.80;
- final effect: €115.05 tax cost.

## Future Box 3 status

The Tweede Kamer passed bill 36.748 on 12 February 2026, but the Eerste Kamer had not voted on the bill by 3 September 2026 and was awaiting announced novelles. The calculator therefore correctly describes this path as a proposed scenario and does not present it as enacted law.

## Logic review

- Mortgage principal always changes the balance sheet and is not treated as an economic expense.
- Purchase costs and selling costs are charged once.
- Each purchase strategy has its own sources-and-uses ledger.
- Monthly cost differences use a common required budget and invest only the cheaper strategy's difference.
- External Box 3 tax and debt payments carry a dated terminal-value cost.
- Portfolio, savings and external tax payment sources affect only their selected balance or external cash flow.
- Current-law Box 3 uses the 1 January snapshot and blocks missing mid-year snapshots.
- Incomplete proposed-regime years remain unavailable rather than displaying zero tax.
- Annual Box 1 calculations reconcile exactly to their monthly allocations across Mortgage, combined plan, Scenarios and Next Euro.
- Canonical records remain the sole source for cards, tables and CSV exports.

## Release boundaries

R6.6 remains a scenario planner. It is not:

- mortgage underwriting or an official borrowing-capacity calculation;
- a tax-return calculator;
- a complete model of fiscal-partner allocation, transitional debt or every Box 3 asset;
- a forecast of future Dutch law;
- personal financial advice.

## Primary references

- Belastingdienst, 2026 Box 1 rates: https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/prive/inkomstenbelasting/heffingskortingen_boxen_tarieven/boxen_en_tarieven/box_1/box_1
- Belastingdienst, own-home rate adjustment: https://www.belastingdienst.nl/wps/wcm/connect/nl/koopwoning/content/tariefsaanpassing-eigen-woning
- Belastingdienst, EWF and Hillen: https://www.belastingdienst.nl/wps/wcm/connect/nl/koopwoning/content/hoe-werkt-eigenwoningforfait
- Belastingdienst, current-law Box 3 for 2026: https://www.belastingdienst.nl/wps/wcm/connect/nl/box-3/content/berekening-box-3-inkomen-2026
- Belastingdienst, transfer tax and starter exemption: https://www.belastingdienst.nl/wps/wcm/connect/nl/koopwoning/content/overdrachtsbelasting-betalen-bij-koop-huis
- NHG, 2026 limits and fee: https://www.nhg.nl/het-product-nhg/een-hypotheek-met-nhg/
- Rijksoverheid, mortgage LTV: https://www.rijksoverheid.nl/vraag-en-antwoord/huis-kopen/maximaal-bedrag-lenen-koopwoning
- Rijksoverheid, mortgage-interest deduction: https://www.rijksoverheid.nl/vraag-en-antwoord/huis-kopen/hypotheekrenteaftrek
- Legislative explanation of the own-home adjustment ceiling: https://zoek.officielebekendmakingen.nl/kst-33756-3.html
- Eerste Kamer, status of bill 36.748: https://www.eerstekamer.nl/wetsvoorstel/36748_wet_werkelijk_rendement_box
