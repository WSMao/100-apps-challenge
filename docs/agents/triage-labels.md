# Triage Labels

The five canonical triage states, mapped to their GitHub labels:

| State | Role | Meaning |
| :--- | :--- | :--- |
| `needs-triage` | Initial | Needs review by maintainer or `/triage` skill |
| `needs-info` | Waiting | Awaiting additional context or reproduction steps |
| `ready-for-agent` | Ready | Actionable, well-specified brief ready for AFK AI agent |
| `ready-for-human` | Ready | Requires human intervention, credentials, or high-risk decision |
| `wontfix` | Terminal | Will not be worked on |

## Usage with GitHub

- Issues that need triage should carry `needs-triage`.
- When an agent is ready to pick up work, it queries for open issues with label `ready-for-agent`:
  ```bash
  gh issue list --state open --label "ready-for-agent"
  ```
- Issues requiring human intervention are marked `ready-for-human`.
