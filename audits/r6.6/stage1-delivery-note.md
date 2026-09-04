# R6.6 Stage 1 delivery note

The first delivery attempt exposed two non-financial pipeline defects before Stage 1 was accepted:

1. A dynamic English NHG warning used Dutch thousands punctuation (`€470.000`) while the established English regression expected `€470,000`. The policy value was correct; the presentation locale was corrected.
2. The one-shot build could not remove its locally modified patch script. The cleanup command was hardened and rerun.

The final gate also enabled shell `pipefail`, so a failing test behind `tee` cannot be masked. The accepted Stage 1 commit was produced only after:

- 154 of 154 Node tests passed;
- 50 of 50 deterministic scenarios reconciled;
- all five R6.5 reference cases remained byte-for-byte identical;
- the Chromium responsiveness smoke test passed;
- the public `main` branch remained unchanged.

Neither intermediate issue affected a financial formula or a released public calculation.
