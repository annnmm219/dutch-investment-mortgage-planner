# R6.6 Stage 2: effective annual rate semantics

**Stage status:** complete and verified  
**Branch:** `r6-6-decision-integrity`  
**Stage 1 input:** `b07a8c4e168a5a545084806a04171d7bf18714c0`  
**Public `main`:** unchanged during Stage 2

## Purpose

Stage 2 activates the rate contract defined in Stage 1. Investment return, savings yield, home-value growth and rent growth are now interpreted as effective annual assumptions.

The monthly conversion is:

`monthlyRate = (1 + annualEffectiveRate)^(1/12) - 1`

Mortgage interest remains a nominal annual contractual rate divided by 12. Box 3 debt interest is also treated as a nominal annual contractual rate divided by 12. Statutory Box 3 deemed percentages remain annual tax factors and are never monthly compounding inputs.

The timing convention is unchanged: growth applies to the opening balance, then recurring investment contributions are added at month end.

## Canonical proof cases

| Probe | Stage 1 result | Stage 2 result | Change | Effective-annual target |
|---|---:|---:|---:|---:|
| €100,000 invested at 7% for 30 years | €811,649.75 | €761,225.50 | -€50,424.24 | €761,225.50 |
| €100,000 savings at 2% for 12 months | €102,018.44 | €102,000.00 | -€18.44 | €102,000.00 |
| €100,000 home at 2% for 30 years | €182,120.90 | €181,136.16 | -€984.74 | €181,136.16 |
| €1,000 rent after one year at 3% | €1,030.42 | €1,030.00 | -€0.42 | €1,030.00 |
| Next € break-even against a 4% nominal mortgage | 4.0000% | 4.0741% | +0.0742 pp | 4.0742% |
| €350,000 mortgage first scheduled payment | €1,670.95 | €1,670.95 | +€0.00 | unchanged |
| €350,000 mortgage total interest | €251,543.27 | €251,543.27 | +€0.00 | unchanged |

## Fifty-scenario impact

- Deterministic scenarios compared: **50**
- Scenarios with a numerical result change: **50**
- Scenario leader changes: **0**
- Maximum absolute Strategy A wealth change: **€136,064.43**
- Maximum absolute Strategy B wealth change: **€470,917.64**
- Maximum absolute change in the A-minus-B comparison gap: **€338,787.30**

No scenario leader changed in the 50 deterministic reconciliation cases.

The complete before-and-after scenario ledger is stored in `stage2-delta.json`.

## Controls and exclusions

- Mortgage amortisation remains unchanged. The 4% mortgage input still means a nominal annual contractual rate divided by 12.
- Monthly contribution timing remains end of month.
- Box 3 tax architecture, January 1 safeguards, EWF bands, Hillen and HRA eligibility are unchanged.
- Owner-cost growth is not introduced here. It remains Stage 5 work.
- The R6.5 baseline contains no inflation input or executable inflation conversion, so Stage 2 has no inflation site to modify.
- Stage 3 purchase-scenario isolation is not activated.
- The public `main` branch remains at the frozen R6.5 release.
