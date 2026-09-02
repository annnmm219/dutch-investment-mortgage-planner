# Archived R7 affordability prototype

This branch preserves the experimental R7 income-based affordability work that was supplied as `dutch-investment-mortgage-planner-r7.zip` on 2 September 2026.

Original ZIP SHA-256:

`fd27119aa4059dc63ad172c8944190ec1febc8c1425fd62bb915c4940ba2653b`

## Status

This prototype is intentionally quarantined from `main` and GitHub Pages.

The reconstructed woonquote table in `nibud-affordability.js` does not match the official 2026 financing-load table closely enough for a maximum-mortgage output. Its tests prove internal consistency with that reconstructed table, not agreement with the official regulation.

The prototype must not be merged into the live planner. A future affordability feature, if user testing demonstrates demand, must be rebuilt from the official 2026 table structure and externally checked golden cases.

## Preserved files

- `nibud-affordability.js`
- `affordability-ui.js`
- `nibud-affordability.test.js`

The stable public baseline remains R6.3 until R6.4 passes its public-beta gate.
