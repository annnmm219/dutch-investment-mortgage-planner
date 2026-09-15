# R6.6 Stage 9: standalone Scenario onboarding

**Stage status:** complete and verified locally  
**Stage 8 local head:** `023eee8`  
**Stage 8 GitHub evidence head:** `69a44762eb9d7bf55990ba7666fe3d1223a63043`  
**Branch:** `r6-6-decision-integrity`  
**Public `main`:** unchanged until explicit merge authorization

## Outcome

Scenarios no longer silently reads whichever values happen to be present in Investment and Mortgage. The user must choose one of two explicit routes before a result is available:

1. **Use my existing planner data** copies relevant values into a visible snapshot. The snapshot remains stable when another tab changes and is updated only through **Refresh imported data**.
2. **Start a fresh comparison** clears personal fields and uses only values entered inside Scenarios.

All personal inputs used by a valid comparison are shown inside Scenarios. Purchase-specific inputs remain owned by the purchase comparison because an existing mortgage cannot safely supply a proposed purchase price, buyer cash, transfer-tax eligibility or NHG choice.

## Usability boundary

- Owner costs are entered as a single monthly total by default.
- The included categories are named directly beneath the total: VvE or service charges, maintenance, owner taxes, building insurance and ground lease.
- An inline optional breakdown switches to itemized inputs without silently redistributing the total.
- The maximum comfortable housing cost is optional.
- Its warning compares the two strategies' starting housing requirements only.
- The optional limit affects feasibility messaging, never modeled wealth.
- The input review identifies the source and the principal financial assumptions before results.

## Source ownership

| Input group | Imported route | Fresh route |
|---|---|---|
| Plan start, investments, savings and Box 3 debt | Copied snapshot | Entered in Scenarios |
| Existing mortgage and own-home tax | Copied snapshot for non-purchase decisions | Entered in Scenarios |
| Purchase price, purchase mortgage and purchase rules | Entered in Scenarios | Entered in Scenarios |
| Owner costs and comfortable housing limit | Entered in Scenarios | Entered in Scenarios |

Next Euro now consumes the active, validated Scenario configuration. It cannot silently fall back to newer Investment or Mortgage values after a snapshot has been created.

## 50 plus 50 comparison method

The verifier creates 50 deterministic datasets, ten for each of the five comparison modes. Every dataset is calculated twice:

- once through the imported-data route;
- once through the independent fresh-data route.

The verifier deep-compares the complete canonical result for each matching pair. This is 100 calculations and 50 pair comparisons, not 100 unrelated examples.

| Gate | Result |
|---|---:|
| Imported calculations | 50 / 50 completed |
| Fresh calculations | 50 / 50 completed |
| Exact matching pairs | 50 / 50 |
| Mismatches | 0 |
| Modes covered | 5 |
| Node tests | 239 / 239 passed |
| Existing deterministic reconciliation | 50 / 50 passed |
| Chromium browser contracts | 3 / 3 passed |
| Browser page errors | 0 |
| JavaScript syntax and diff checks | passed |

The browser contract separately verifies that no source is preselected, imported values are copied, the snapshot is stable, refresh is explicit, and fresh inputs remain independent of later Investment-tab edits.

## Release status

Stage 9 is ready for branch testing after publication and successful GitHub workflows. Draft PR #13 must remain open and unmerged until the user authorizes release. The public R6.5 site is therefore not the Stage 9 test target.
