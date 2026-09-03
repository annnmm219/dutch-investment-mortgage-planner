# R6.6 Stage 2 delivery note

The first delivery attempt stopped before committing Stage 2 because the verification gate exposed three test-harness issues:

1. The generated Stage 2 test file contained an unintended leading backslash from the Python raw-string fixture.
2. One savings test still expected nominal annual divided-by-12 compounding rather than the newly activated effective annual yield.
3. One interface-integrity assertion still expected the old Next Euro label.

These were verification and expectation defects, not accepted product output. The workflow committed no Stage 2 calculation source while the suite was failing.

The corrected gate then completed successfully and committed the verified Stage 2 implementation only after:

- 162 of 162 Node tests passed;
- 50 of 50 deterministic scenarios reconciled;
- all 50 deterministic scenarios were compared with Stage 1 values;
- no scenario leader changed in that deterministic set;
- the Chromium responsiveness smoke test passed;
- mortgage payment and total-interest controls remained unchanged;
- the public `main` branch remained at the frozen R6.5 commit.

Stage 2 intentionally changes non-mortgage projection results because investment return, savings yield, home-value growth and rent growth now use effective annual semantics. Mortgage interest remains a nominal annual contractual rate divided by 12.
