---
name: project-docs
description: "Guidelines and templates for writing human-facing subproject READMEs and maintaining the 5-tier project documentation architecture."
---

# Project Docs (5-Tier Documentation Architecture)

This skill defines the information architecture, content boundaries, and drafting guidelines for documentation across the **100 Apps Challenge**.

It ensures that subproject documentation is optimized for its intended audience, completely decouples static presentation from dynamic task tracking, and keeps AI agent contexts clean and noise-free.

---

## 1. The 5-Tier Documentation Taxonomy

Every piece of information in this repository belongs to exactly one tier. Never duplicate content across tiers:

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. Personal Cognitive Second Brain: Obsidian Notes                     │
│    Audience: The Human Creator (Personal learning & exploration)       │
│    Purpose: Technical notes, unconfirmed app ideas, daily work logs    │
├────────────────────────────────────────────────────────────────────────┤
│ 2. Client & Product Spec: apps/<id>-<app-name>/docs/PRD.md             │
│    Audience: Clients, PMs & Product Developers                         │
│    Purpose: Confirmed product specs & phased User Stories (`/to-prd`)  │
├────────────────────────────────────────────────────────────────────────┤
│ 3. Dynamic Task Tracker: GitHub Issues                                 │
│    Audience: Driving Developer & AI Agents                             │
│    Purpose: Bugs, requirement changes, `/to-tickets` sub-issues (Close)│
├────────────────────────────────────────────────────────────────────────┤
│ 4. Repo Architecture Knowledge: GLOSSARY.md & docs/adr/                │
│    Audience: Developers & AI Agents (`/domain-modeling`, `/grill-with-docs`)│
│    Purpose: Domain terminology, invariant contracts & ADR decisions    │
├────────────────────────────────────────────────────────────────────────┤
│ 5. Public Showcase: apps/<id>-<app-name>/README.md                     │
│    Audience: Human GitHub readers (Users, Evaluators & Developers)     │
│    Purpose: Product pitch, visual tour, user guide & developer setup   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Content Boundaries & Rules

| Tier | File / Platform | MUST Include | NEVER Include (Anti-Patterns) |
| :--- | :--- | :--- | :--- |
| **Tier 1: Personal** | **Obsidian Notes** | • Deep-dive technical notes & algorithms<br>• Unconfirmed project ideas & exploration<br>• Daily work logs & reflections (`/to-obsidian-note`) | ❌ Duplicate confirmed task checklists (use GitHub Issues) |
| **Tier 2: PRD** | `apps/<id>-<app-name>/docs/PRD.md` | • Product Vision & Problem Statement<br>• Phased User Stories (categorized numbered checkboxes via `/to-prd`)<br>• Confirmed scope & testing/interface decisions | ❌ Unconfirmed brainstorms (use Obsidian)<br>• Daily progress logs or hardcoded code snippets |
| **Tier 3: Tasks** | **GitHub Issues** | • Open bugs & client requirement changes<br>• Feature tickets & sub-issues (`/to-tickets`)<br>• `app-<NNN>` & triage labels; goal is to Close | ❌ Static architecture tutorials<br>• Broad conceptual study notes |
| **Tier 4: Domain** | `GLOSSARY.md` & `docs/adr/` | • Canonical domain vocabulary<br>• Hard-to-reverse ADR design decisions<br>• Invariant module seams (`/domain-modeling`, `/grill-with-docs`) | ❌ Transient sprint tickets or daily logs<br>• Marketing copy |
| **Tier 5: Showcase** | `apps/<id>-<app-name>/README.md` | • One-line Value Proposition<br>• Core pain points solved<br>• User Guide & Dev Guide (Tech stack & architecture) | ❌ Daily commit history or work snapshot tables<br>• Granular bug-fix changelogs<br>• Dynamic TODOs or sprint tickets |

---

## 3. Subproject `README.md` Specification

When authoring or refactoring an application's `README.md` under `apps/<id>-<app-name>/`, adhere strictly to the following structure:

### Structure:
1. **Hero Section**:
   - App Title (`# <app-name>`)
   - High-impact summary / pitch (What makes this tool unique?).
   - Key highlight badges or live links.
2. **Pain Points & Value Proposition**:
   - 3–4 concise bullet points explaining what existing tools lack and how this app solves it.
3. **User Guide**:
   - Key workflows.
4. **Developer Guide**:
   - Core Tech Stack list.
   - Architecture Overview (Bottom-Up modular diagram or bullet structure).
   - Getting Started (prerequisites, installation, configuration, build, test commands).

---

## 4. Workflows

### Refactoring an existing `README.md`:
1. Strip out any legacy `## 📋工作快照` or daily commit tables.
2. Check `git log` and closed issues to ensure historical work is preserved in git history.
3. Organize the remaining content into the standardized **User Guide** and **Developer Guide** sections.
4. Verify all internal file links use the `file://` scheme where applicable.

### Creating a new subproject `README.md`:
Copy and populate the template at:
👉 `resources/app-readme-template.md`

