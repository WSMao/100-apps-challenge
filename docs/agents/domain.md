# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Layout: Multi-context (100 Apps Architecture)

This repository is organized as a multi-app monorepo (`apps/001-*`, `apps/002-*`, `apps/003-*`):

```
/
├── GLOSSARY-MAP.md                       ← Root index pointing to per-app glossaries
├── docs/adr/                             ← Repo-wide global architecture decisions
└── apps/
    ├── 001-.../
    │   ├── GLOSSARY.md                  ← App-specific domain terminology
    │   └── docs/adr/                    ← App-specific ADRs
    └── 003-Creative-Neuro/
        ├── GLOSSARY.md
        └── docs/adr/
```

## Before exploring, read these

- **`GLOSSARY-MAP.md`** at the repo root (finds the relevant subproject glossary).
- **`apps/<app-id>/GLOSSARY.md`**: Read the glossary for the subproject being touched.
- **`docs/adr/`** and **`apps/<app-id>/docs/adr/`**: Read ADRs that touch the area you are about to work in.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily as decisions or terms get resolved.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in the relevant glossary. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding.

