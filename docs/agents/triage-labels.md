# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the label strings used in our GitHub repository:

| Canonical Role | Label in our tracker | Meaning |
| :--- | :--- | :--- |
| `needs-triage` | `triage: needs-triage` | Needs review by maintainer or `/triage` skill |
| `needs-info` | `triage: needs-info` | Awaiting additional context or reproduction steps |
| `ready-for-agent` | `triage: ready-for-agent` | Actionable, well-specified brief ready for AFK AI agent |
| `ready-for-human` | `triage: ready-for-human` | Requires human intervention, credentials, or high-risk decision |
| `wontfix` | `wontfix` | Will not be worked on (uses GitHub's default `wontfix` label) |

## Usage with GitHub

- When an agent is ready to pick up work for a subproject (e.g., `003`), it queries for open issues carrying both that subproject's label and `triage: ready-for-agent`:
  ```bash
  gh issue list --state open --label "app-003" --label "triage: ready-for-agent"
  ```
- Issues requiring human intervention are marked `triage: ready-for-human`.
- Untriaged incoming requests/bugs carry `triage: needs-triage`.
