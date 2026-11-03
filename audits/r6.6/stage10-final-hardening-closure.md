# R6.6 Stage 10 — Final Hardening Closure

**Closure date:** 15 September 2026  
**Calculation source:** `a4377ce1050277b5ce13b97779c4af27ede94f65`  
**Build ID:** `R6.6-stage10-a4377ce1`  
**Freeze / dependency-hardening commit:** `56ef36e47ef8036432a71503f8b11e762d1e12d7`  
**Final evidence head:** `3f1e6fffe30453b0486b5d0e01425151e2357b3b`  
**Verdict:** `PASS_TECHNICAL_HARDENING_PENDING_PERSONA_AND_OWNER_ACCEPTANCE`  
**Merge authorization:** No.

## 1. Closure conclusion

Stage 10 technical remediation and hardening are complete.

The original audit findings F-01 through F-06 remain closed. The second-audit hardening items F-07, F-10 and F-11 are also closed:

- **F-07:** Playwright upgraded to 1.63.0, lockfile regenerated without the environment-specific extraneous path, `npm audit --audit-level=high` returns zero vulnerabilities, and the browser workflow enforces that audit gate.
- **F-10:** the non-main-property rental input is defined as annual basic rent / pacht received, excluding service charges.
- **F-11:** R6.6 explicitly supports the existing-home NHG purchase route and blocks new-build scenarios instead of applying the existing-home rule set.

F-08 and F-09 remain accepted disclosed limitations.

No technical Stage 10 release blocker remains. Public release is still gated by persona acceptance testing, owner manual UX testing and explicit repository-owner merge authorization.

## 2. Frozen release identity

`release-identity.js` identifies:

- calculation source: `a4377ce1050277b5ce13b97779c4af27ede94f65`
- build ID: `R6.6-stage10-a4377ce1`

The later dependency, test and workflow-hardening commits do not alter calculation logic. The final browser/Finance evidence was run with the frozen calculation identity intact.

## 3. Final Finance evidence

GitHub Actions Finance workflow run `34948639673` passed:

- **286 / 286 tests**
- **0 failures**
- legacy deterministic matrix: **50 / 50**
- Stage 9 Imported-vs-Fresh: **50 exact pairs**
- Stage 9.1 deterministic matrix: **50 / 50**
- Stage 10 deterministic matrix: **50 / 50**
- Stage 10 explained tax-effect changes: **19**
- comparable-wealth changes: **14**
- leader changes: **0**
- unexplained changes: **0**

The Finance suite includes explicit regression coverage for F-07, F-10 and F-11.

## 4. Final browser evidence

GitHub Actions browser workflow run `34948639790` passed after the CI timeout was increased from 30 to 60 minutes. The prior cancelled run had reached the matrix timeout rather than a product assertion failure.

Final Stage 10 genuine browser parity:

- desktop exact pairs: **50 / 50**
- mobile exact pairs: **50 / 50**
- Buy vs Rent: 10 per viewport
- Down Payment: 10 per viewport
- Mortgage vs Invest: 10 per viewport
- Linear vs Annuity: 10 per viewport
- Sell vs Rent: 10 per viewport
- save/reload: passed
- explicit Refresh: passed
- Fresh isolation: passed
- property classification: passed
- current-law non-main-property return: passed
- proposed/transition non-main-property block: passed
- exact NHG caps: passed
- deductible-cost path: passed
- F-10 rental-input definition: passed
- F-11 existing-home scope: passed
- F-11 new-build block: passed
- export identity: passed
- browser errors: **0**

Dependency/security gate in the same browser workflow:

- `npm ci`: passed
- `npm audit --audit-level=high`: **0 vulnerabilities**

Retained browser transcript:

- artifact ID: `10389725361`
- name: `stage91-browser-test-ea4c3bd00b2f878ba6664cc9afb759c2c5bd3396`
- SHA-256: `70595f1534d9811863cca79bb87418686866972b3de78d9af7f887bfe63c8153`

## 5. Finding status

| Finding | Final status |
| --- | --- |
| F-01 | CLOSED_REMEDIATED |
| F-02 | CLOSED_REMEDIATED |
| F-03 | CLOSED_REMEDIATED |
| F-04 | CLOSED_REMEDIATED |
| F-05 | CLOSED_REMEDIATED |
| F-06 | CLOSED_REMEDIATED |
| F-07 | CLOSED_REMEDIATED |
| F-08 | ACCEPTABLE_WITH_DISCLOSURE |
| F-09 | ACCEPTABLE_WITH_DISCLOSURE |
| F-10 | CLOSED_REMEDIATED |
| F-11 | CLOSED_REMEDIATED |

## 6. Remaining release gate

The project now moves from technical correctness/hardening to **acceptance testing**.

The next gate is:

1. convert the supplied Netherlands financial personas into household-level calculator fixtures, keeping persona facts separate from test-only assumptions;
2. run representative decision journeys and record confusing, unsupported or unreasonable outcomes;
3. perform owner manual UX testing on the release candidate;
4. fix only genuine release blockers;
5. final release checklist;
6. merge PR #13 only after explicit repository-owner authorization.

PR #13 must remain **draft and unmerged** until that acceptance gate is complete.
