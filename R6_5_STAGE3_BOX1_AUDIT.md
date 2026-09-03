# Stage 3 audit: bounded 2026 Box 1 own-home calculation

Date: 3 September 2026  
Target baseline: R6.5 (`ac8f029788ff8d1fc2baf09fbc89b848a28f7803`)

## Decision

The previous automatic mortgage-tax bridge is not retained as the default. It first netted eigenwoningforfait against qualifying interest and then multiplied that net amount by one selected percentage. That shortcut can produce the wrong magnitude and, for a high-income taxpayer with relatively low interest, the wrong sign.

Stage 3 introduces `box1-2026.js`, loaded immediately after `finance-core.js`, plus `box1-2026-ui.js` for disclosure and the annual browser trace. The core module decorates the existing mortgage and scenario paths, so Mortgage, Scenarios, Next Euro and the combined plan use one annual Box 1 bridge without rewriting mortgage amortisation, Box 3, HRA eligibility, EWF bands or the Hillen schedule.

## Supported automatic profile

Automatic mode is deliberately bounded to:

- tax year rules: 2026
- taxpayer below AOW age
- ordinary employment income entered as annual Box 1 income before own-home items
- one uncomplicated own-home allocation
- no Box 1 loss carryforward
- no other deductions subject to the high-income rate adjustment
- no mixed or transitional pre-2013 own-home debt unless modeled separately

Tax credits are excluded. The result is therefore an own-home tax-effect estimate, not a complete income-tax assessment or expected refund.

For projection years after 2026, the model holds the 2026 Box 1 brackets and EWF rules constant as a scenario assumption. The already-existing Hillen phase-down continues to vary by calendar year.

Unsupported API profiles return an explicit unavailable result through `ownHomeBox1Tax2026`. Exact decorated mortgage calculations reject unsupported profiles rather than silently applying the ordinary profile. Browser users are told to use the manual override when the automatic profile does not describe them.

## 2026 rules encoded

### Progressive Box 1 rates, below AOW age

- 35.75% through €38,883
- 37.56% from €38,883 through €78,426
- 49.50% above €78,426

### High-income own-home adjustment

- threshold: €78,426
- adjustment: 11.94 percentage points
- qualifying own-home deductions in the top bracket therefore have a maximum 37.56% rate effect
- statutory adjustment base is capped at the amount of qualifying own-home deductions in this bounded model

### Hillen

- 2026 relief: 71.867% of the positive difference between EWF and deductible own-home costs
- existing calendar-year phase-down remains authoritative in the planner

### EWF and eligibility

The existing `ewf2026`, HRA remaining-duration, qualifying-interest fraction and Hillen schedule functions are preserved. Stage 3 consumes their outputs rather than introducing a competing implementation.

## Annual formula

For each calendar year:

```text
gross own-home balance
  = eigenwoningforfait
  - qualifying mortgage interest
  - other qualifying own-home costs

Hillen deduction
  = max(0, gross own-home balance) × applicable Hillen percentage

net own-home income
  = gross own-home balance - Hillen deduction

taxable Box 1 income after own-home items
  = Box 1 income before own-home items + net own-home income

table tax effect
  = progressive 2026 Box 1 tax after own-home items
  - progressive 2026 Box 1 tax before own-home items

high-income adjustment base
  = min(
      qualifying own-home deductions,
      max(0, taxable income after own-home items
             + qualifying own-home deductions
             - €78,426)
    )

high-income adjustment
  = adjustment base × 11.94%

modeled tax benefit
  = tax before own-home items
  - table tax after own-home items
  - high-income adjustment
```

A positive result is a modeled tax reduction. A negative result is a modeled tax cost.

## Critical regression

Assumptions:

- Box 1 income before own-home items: €80,000
- EWF: €1,750
- qualifying own-home costs: €2,000

The old bridge treated the €250 net deduction as if it received a positive 37.56% effect and reported approximately **+€93.90**.

The rebuilt bridge calculates:

- table-tax reduction: €123.75
- high-income adjustment: €238.80
- net own-home effect: **−€115.05**

The sign is now correct: this is a modeled tax cost, not a benefit.

## Traceability added

Every annual automatic calculation exposes:

- gross and qualifying interest
- other qualifying own-home costs
- EWF
- Hillen deduction
- Box 1 income before and after own-home items
- table tax before and after
- high-income adjustment base and amount
- final tax benefit or cost

The browser adds a year-by-year Box 1 bridge under the Mortgage section. Monthly schedule allocations reconcile exactly to the annual amount.

## Regression coverage

`tests/box1-2026-stage3.test.js` covers:

1. all three 2026 brackets
2. the critical wrong-sign high-income case
3. a first-bracket deduction case
4. Hillen with a positive own-home balance
5. annual-to-monthly reconciliation
6. HRA remaining duration and qualifying debt share
7. unsupported-profile rejection
8. manual-mode backward compatibility
9. deterministic browser script order
10. browser scope and audit disclosure

## Primary sources

- Belastingdienst, 2026 Box 1 rates: https://www.belastingdienst.nl/wps/wcm/connect/nl/werk-en-inkomen/content/hoeveel-inkomstenbelasting-betalen
- Belastingdienst, high-income own-home deduction adjustment: https://www.belastingdienst.nl/wps/wcm/connect/nl/koopwoning/content/tariefsaanpassing-eigen-woning
- Belastingdienst, Hillen relief: https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/prive/woning/eigenwoningforfait/geen_of_een_kleine_eigenwoningschuld/
- Wet inkomstenbelasting 2001, article 2.10: https://wetten.overheid.nl/BWBR0011353/2026-01-01

## Remaining boundary

Stage 3 fixes the own-home Box 1 bridge. It does not certify the full planner as a tax-return calculator. Tax credits, AOW profiles, complex partner allocations, Box 1 losses and other rate-adjusted deductions remain outside the automatic calculation and should be addressed only through a later explicitly scoped stage.
