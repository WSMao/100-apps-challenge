---
name: to-prd
description: "Synthesize the current conversation and codebase understanding into a phased Product Requirement Doc (PRD) saved to the app's docs/PRD.md without publishing to GitHub Issues. Extends /to-spec for any unspecified sections."
disable-model-invocation: true
---

# To PRD

This skill synthesizes the current conversation, user requirements, and codebase understanding into a **Product Requirement Document (PRD)** stored locally at `apps/<id>-<app-name>/docs/PRD.md`.

**Key rule:** Write to `apps/<id>-<app-name>/docs/PRD.md` only. Do **NOT** automatically create or publish a GitHub Issue.

For any rules or sections not explicitly specified below, follow the conventions of the **`/to-spec`** skill.

---

## Process

1. **Explore context first**:
   - Read the target app's `GLOSSARY.md` and `docs/adr/` (if present) and use the canonical domain vocabulary throughout the PRD.
   - Explore the existing codebase (if any) to understand current capabilities, constraints, and testing seams.
2. **Synthesize without interviewing**:
   - Like `/to-spec`, do NOT run a multi-turn interview here; synthesize what is already known from the conversation and codebase. (If critical requirements are still ambiguous, recommend `/grill-with-docs` first.)
3. **Draft and save to `apps/<id>-<app-name>/docs/PRD.md`**:
   - Use the template below.
   - Stop after writing `docs/PRD.md` so the human can review it before any GitHub Issues are created.

---

## PRD Template

```markdown
# <App Name> (<id>) — Product Requirement Document (PRD)

## Vision

A clear, inspiring statement of the product's long-term vision, target users, and core value proposition.

## Problem Statement

The problem that the user is facing, from the user's perspective.

## Solution

A concise summary of the solution from the user's perspective (avoid duplicating the detailed User Stories list).

## User Stories

Organize stories by **Phase** (e.g. `Phase 1: MVP`, `Phase 2: Expansion`), and within each phase group them by **functional category**.

Formatting rules (strict):
- Every story MUST use a **numbered checkbox list**: `1. [ ] As a <actor>, I want <feature>, so that <benefit>`
- Numbering **restarts at `1` inside every functional category**.

### Phase 1: <Phase Name>

#### <Category A>
1. [ ] As a <actor>, I want <feature>, so that <benefit>
2. [ ] As a <actor>, I want <feature>, so that <benefit>

#### <Category B>
1. [ ] As a <actor>, I want <feature>, so that <benefit>

### Phase 2: <Phase Name> (Planned)

#### <Category C>
1. [ ] As a <actor>, I want <feature>, so that <benefit>

## Implementation Decisions

(Follow `/to-spec` rules: describe module responsibilities, interfaces, schema/API contracts, and architectural decisions without hardcoded file paths or code snippets unless capturing a prototype state machine/schema.)

## Testing Decisions

(Follow `/to-spec` rules: test external behavior via public seams, specify which modules/layers are tested, and reference prior art in the codebase.)

## Out of Scope

Items explicitly excluded from the current active phase.

## Further Notes

Any open review items, links to related Glossary/ADRs, or notes before converting phases into GitHub Issues.
```
