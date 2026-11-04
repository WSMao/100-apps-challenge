# Issue tracker: README.md (Transitioning to Jira)

Issues and specs for this repo are currently tracked via subproject `README.md` work snapshot tables and local ticket files (`.scratch/<app-or-feature>/`), with the objective of transitioning to Jira.

## Conventions

- **Current (Local / README.md)**:
  - Feature specs and tickets live in `.scratch/<effort>/` or the active subproject `apps/<app-id>/README.md`.
  - Ticket specification format follows Jira-ready standards:
    - **Summary**: Concise title with category/app prefix (e.g. `[003-Neuro] Feature: ...`)
    - **Status / Label**: Canonical triage labels (e.g., `ready-for-agent`)
    - **Description & Acceptance Criteria**: Unambiguous checklist / Gherkin acceptance criteria
- **Target (Jira)**:
  - When creating a ticket, format the content as a Jira-ready ticket block (Issue Type, Summary, Description, Acceptance Criteria, Labels) so it can be pasted into Jira or managed via future Jira CLI integration.

## When a skill says "publish to the issue tracker"

1. Format the ticket with Jira-ready fields (Summary, Description, Acceptance Criteria, Label).
2. Save it to `.scratch/<feature-slug>/issues/<NN>-<slug>.md` (creating directories if needed).
3. If related to an active subproject, log a line in `apps/<app-id>/README.md` work snapshot table.

## When a skill says "fetch the relevant ticket"

Read the ticket file from `.scratch/` or the task description provided by the user from Jira.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a file with one **child** file per ticket:

- **Map**: `.scratch/<effort>/map.md` (the Notes / Decisions-so-far / Fog body).
- **Child ticket**: `.scratch/<effort>/issues/NN-<slug>.md`, numbered from `01`, with the question in the body. A `Type:` line records the ticket type (`research`/`prototype`/`grilling`/`task`); a `Status:` line records `claimed`/`resolved`.
- **Blocking**: a `Blocked by: NN, NN` line near the top. A ticket is unblocked when every file it lists is `resolved`.
- **Frontier**: scan `.scratch/<effort>/issues/` for files that are open, unblocked, and unclaimed; first by number wins.
- **Claim**: set `Status: claimed` and save before any work.
- **Resolve**: append the answer under an `## Answer` heading, set `Status: resolved`, then append a context pointer (gist + link) to the map's Decisions-so-far in `map.md`.

