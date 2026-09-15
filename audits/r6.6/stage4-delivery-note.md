# R6.6 Stage 4 delivery note

**Stage 3 final head:** `faaf18d31b561d8bba974158431d9219d6c349e8`  
**Stage 4 calculation and evidence head:** `a774ac1a69752eed0e7680abca66b81938e23a5c`  
**Public R6.5 baseline:** `ac8f029788ff8d1fc2baf09fbc89b848a28f7803`

Stage 4 replaces the automatic one-rate mortgage-tax bridge with a bounded 2026 Box 1 own-home calculation for a taxpayer below AOW age with ordinary employment income.

The automatic path now:

- calculates progressive 2026 Box 1 tax before own-home items;
- calculates eigenwoningforfait separately;
- calculates qualifying mortgage interest and other qualifying own-home costs separately;
- applies the remaining HRA duration and qualifying Box 1 debt share;
- calculates the Hillen deduction separately when EWF exceeds qualifying costs;
- recalculates progressive Box 1 tax after own-home items;
- applies the 11.94 percentage-point high-income adjustment, subject to the statutory ceiling;
- reports a positive modeled tax reduction or a negative modeled tax cost;
- exposes the annual calculation trace and allocates the exact annual result back to monthly schedule rows.

The same annual result is used by:

- the Mortgage headline and schedule;
- the combined Investment and Mortgage plan;
- Buy versus Rent and the other Scenario comparisons;
- Next Euro repay-versus-invest calculations.

Manual percentage mode remains available as an explicit assumption. It is no longer described as the automatic Dutch Box 1 result.

## Supported automatic profile

The automatic calculation is deliberately limited to:

- 2026 rules;
- a taxpayer below AOW age;
- ordinary employment income;
- no Box 1 loss carryforward;
- no other deductions subject to the high-income rate adjustment;
- no complex fiscal-partner allocation;
- no mixed or transitional pre-2013 own-home debt.

Tax credits are excluded. The visible gross-employment-income input is converted into an estimated income before own-home items, including the selected 30% ruling assumption. The user's jaaropgaaf and actual tax return remain authoritative.

For projection years after 2026, the planner holds the 2026 Box 1 brackets and EWF rules constant as a scenario assumption. The existing Hillen phase-down still changes by calendar year.

Unsupported programmatic profiles are rejected rather than silently passed through the ordinary profile. The browser explains the boundary and preserves manual mode for a user-supplied rate.

## Critical correction

Test case:

- Box 1 income before own-home items: €80,000;
- EWF: €1,750;
- qualifying own-home costs: €2,000.

The previous compressed bridge netted EWF and deductible costs first and applied 37.56% to the €250 balance. It therefore reported approximately **€93.90 benefit**.

The rebuilt bridge calculates:

- progressive table-tax reduction: €123.75;
- high-income adjustment: €238.80;
- net own-home effect: **€115.05 tax cost**.

The prior result had the wrong sign.

## 2026 parameters

The dated policy registry contains:

- Box 1 rates of 35.75%, 37.56% and 49.50%;
- thresholds of €38,883 and €78,426;
- maximum own-home deduction rate of 37.56%;
- high-income adjustment of 11.94%;
- 2026 Hillen relief of 71.867%;
- the existing 2026 EWF bands and €1,350,000 high-value threshold.

`box1-2026.js` consumes the policy registry instead of duplicating these statutory constants.

## Official-source inconsistency

Article 2.10(2) of the 2026 Income Tax Act states that the rate-adjustment base is the excess over the highest-bracket threshold, **capped at the total qualifying deductions**. The legislative explanation uses the same ceiling.

The Belastingdienst's current 2026 Hillen example calculates:

```text
€80,141 taxable income
+ €3,500 own-home costs
- €78,426 threshold
= €5,215 adjustment base
```

It then states that the adjustment applies to €5,215, even though the example contains only €3,500 of qualifying own-home costs. That sentence does not apply the statutory ceiling. Vereniging Eigen Huis describes the adjustment as applying to the mortgage interest actually deducted and states that the Hillen deduction itself is outside the correction.

The implementation follows the statutory ceiling. A dedicated regression test locks the example to a €3,500 adjustment base and a €417.90 adjustment, not an uncapped €5,215 base.

This disagreement between an official explanatory webpage and the statutory text is recorded as an unresolved source-quality issue. It does not affect the critical wrong-sign case above because that case has no Hillen deduction and the adjustment base already equals the €2,000 qualifying-cost ceiling.

## Verification

Final Stage 4 gate at `a774ac1a69752eed0e7680abca66b81938e23a5c`:

- **201 of 201 Node tests passed** on Node 24.19.0;
- **50 of 50 deterministic scenarios reconciled**;
- Stage 4 before-and-after matrix: **25 numerical changes**;
- mortgage Box 1 effect changed in **26 strategy results**;
- **25 control scenarios remained unchanged**;
- **0 scenario leaders changed**;
- mortgage balances, gross interest, purchase costs, selling costs and sources-and-uses identities remained unchanged;
- combined plan, Mortgage, Scenarios and Next Euro parity passed;
- browser automatic and manual HRA context tests passed;
- Chromium responsiveness passed;
- browser page errors: **0**;
- public `main` remains unchanged on R6.5.

## Remaining risks

Stage 4 does not make the planner a tax-return calculator. The following remain outside the automatic result:

- tax credits and their income-dependent changes;
- exact taxable income from a jaaropgaaf or full return;
- AOW profiles;
- Box 1 losses;
- multiple categories of rate-adjusted deductions;
- complex partner allocations;
- mortgage tranches with different eligibility histories, purposes, rates or terms;
- automatic inclusion of deductible financing costs and periodic erfpacht payments in the browser input flow;
- professional validation of representative cases against Dutch tax software or a tax adviser.

Stage 5 should proceed to economic consistency only after these boundaries remain visible and the Stage 4 evidence is retained unchanged.

## Primary references

- Belastingdienst, Box 1 rates 2026: https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/prive/inkomstenbelasting/heffingskortingen_boxen_tarieven/boxen_en_tarieven/box_1/box_1
- Belastingdienst, high-income own-home adjustment: https://www.belastingdienst.nl/wps/wcm/connect/nl/koopwoning/content/tariefsaanpassing-eigen-woning
- Belastingdienst, Hillen 2026 example: https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/prive/woning/eigenwoningforfait/geen_of_een_kleine_eigenwoningschuld/
- Income Tax Act 2001, Article 2.10, version from 1 January 2026: https://wetten.overheid.nl/BWBR0011353/2026-01-01#Hoofdstuk2_Afdeling2.3_Artikel2.10
- Legislative explanation of the rate-adjustment ceiling: https://zoek.officielebekendmakingen.nl/kst-33756-3.html
- Vereniging Eigen Huis, no or small mortgage debt: https://www.eigenhuis.nl/financien-regelen/belastingen/geen-of-kleine-hypotheekschuld
