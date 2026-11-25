---
name: check-prd
description: "Verify User Stories in docs/PRD.md against the latest code and test flow, run missing tests first, update checkboxes ([x]/[ ]) strictly based on observed evidence, and output a verification report."
disable-model-invocation: true
---

# Check PRD

This skill audits and updates the progress checkboxes of User Stories in `apps/<id>-<app-name>/docs/PRD.md` based strictly on **freshly executed test evidence** against the latest codebase.

---

## Core Rules

1. **Test Before Checking**:
   - Never rely on memory, stale test runs, or assumptions.
   - If the latest code has not been tested yet, run the relevant test suites **first** before evaluating any User Story.
2. **Follow `rules.md` Testing Standards (Section 9)**:
   - Match each User Story to its required verification layer (e.g. pure logic → Unit/Engine tests; store/state → Domain/State Machine tests; UI interactions, gestures, focus/IME, layering, or visual layout → real browser E2E / CDP tests).
   - **Never** mark a UI or interactive User Story `[x]` based solely on unit tests or static code inspection.
3. **Strict Checkbox Policy**:
   - **Verified Pass**: Latest test flow covering the story's observable behavior ran and passed → mark `[x]`.
   - **Failed / Regressed**: Test failed → ensure `[ ]` (uncheck if previously `[x]`).
   - **Unconfirmed / Ambiguous / Blocked**: No test coverage, skipped assertions, or environment blocked → **MUST NOT mark `[x]`** (leave or revert to `[ ]`) and report the exact gap.

---

## Process

1. **Locate PRD & Test Suites**:
   - Read `apps/<id>-<app-name>/docs/PRD.md` (or `docs/*-PRD.md` if migrating).
   - Inspect `package.json` and `tests/` to identify all available test commands (`test:unit`, `test:engine`, `test:domain`, `test:e2e`, etc.).
2. **Verify Latest Test Execution**:
   - Check `git status` / recent changes and determine which test suites need to be executed on the current codebase.
   - Run the required test commands and capture exact pass/fail counts and any skipped/blocked suites.
3. **Map Evidence to Each User Story**:
   - Cross-reference each User Story in `docs/PRD.md` with actual test files and observed test results.
   - Determine the verified status (`[x]` vs `[ ]`) for every story without guessing.
4. **Update `docs/PRD.md`**:
   - Update only the checkboxes (`[ ]` ↔ `[x]`) in `docs/PRD.md`. Do not rewrite story text unless explicitly requested.
5. **Output Verification Report**:
   - Present a concise report containing:
     1. **Test Execution Summary**: exact commands run, pass/fail/skip counts, and any environment blockers.
     2. **Newly Checked (`[ ]` → `[x]`)**: stories verified by passing tests and which suite/test covers them.
     3. **Unchecked (`[x]` → `[ ]`)**: stories reverted due to failure or lack of valid verification.
     4. **Unconfirmed / Blocked Stories**: stories left as `[ ]` with the specific reason (e.g. missing E2E test, browser connection unavailable, feature not implemented).
