---
name: project-docs
description: "Guidelines and templates for writing human-facing subproject READMEs and maintaining the 4-tier project documentation architecture."
---

# Project Docs (4-Tier Documentation Architecture)

This skill defines the information architecture, content boundaries, and drafting guidelines for documentation across the **100 Apps Challenge**.

It ensures that subproject documentation is optimized for its intended audience, completely decouples static presentation from dynamic task tracking, and keeps AI agent contexts clean and noise-free.

---

## 1. The 4-Tier Document Taxonomy (四位一體文件分工體系)

Every piece of information in this repository belongs to exactly one tier. Never duplicate content across tiers:

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. Public Showcase: apps/<id>/README.md                                │
│    Audience: Human GitHub readers (Users, Evaluators & Developers)     │
│    Purpose: Product pitch, visual tour, user guide & developer setup   │
├────────────────────────────────────────────────────────────────────────┤
│ 2. Dynamic Task Tracker: GitHub Projects & Issues                      │
│    Audience: Driving Developer & AI Agents                             │
│    Purpose: Active sprint tasks, triage state machine, blockers, PRs   │
├────────────────────────────────────────────────────────────────────────┤
│ 3. Repo Architecture Knowledge: GLOSSARY.md & docs/adr/                │
│    Audience: AI Agents & Software Architects                           │
│    Purpose: Domain terminology, architecture invariants, ADR decisions │
├────────────────────────────────────────────────────────────────────────┤
│ 4. Personal Cognitive Second Brain: Obsidian Notes                     │
│    Audience: The Human Creator (Personal learning & retrospective)     │
│    Purpose: In-depth technical insights, mental models, tool evaluation│
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Content Boundaries & Rules

| Tier | File / Platform | MUST Include | NEVER Include (Anti-Patterns) |
| :--- | :--- | :--- | :--- |
| **Tier 1: Showcase** | `apps/<id>/README.md` | • One-line Value Proposition<br>• Core pain points solved<br>• User Guide with shortcuts table<br>• Tech stack & 5-layer architecture<br>• Dev setup (`pnpm dev`, `pnpm build`) | ❌ Daily commit history or 工作快照 tables<br>❌ Granular bug-fix changelogs<br>❌ Dynamic TODOs or sprint tickets |
| **Tier 2: Tasks** | **GitHub Projects & Issues** | • Active and upcoming feature tickets<br>• `app-<NNN>` & `triage: ready-for-agent` labels<br>• Acceptance Criteria & blocking edges<br>• Closed issues & linked PR history | ❌ Static architecture tutorials<br>❌ Broad conceptual study notes |
| **Tier 3: Domain** | `GLOSSARY.md` & `docs/adr/` | • Canonical domain vocabulary<br>• Hard-to-reverse ADR design decisions<br>• Invariant module seams and contracts | ❌ Transient sprint tickets or daily logs<br>❌ Marketing copy |
| **Tier 4: Personal** | **Obsidian Notes** | • Deep-dive learning notes & algorithms<br>• Multi-agent collaboration reflections<br>• Bidirectional links (`[[Topic]]`) across apps | ❌ Duplicate task checklists (use GitHub Projects) |

---

## 3. Subproject `README.md` Specification

When authoring or refactoring an application's `README.md` under `apps/<id>-<app-name>/`, adhere strictly to the following structure:

### Structure:
1. **Hero Section**:
   - App Title (`# <ID> - <App Name>`)
   - High-impact summary / pitch (What makes this tool unique?).
   - Key highlight badges or live links.
2. **Pain Points & Value Proposition (核心痛點與價值)**:
   - 3–4 concise bullet points explaining what existing tools lack and how this app solves it.
3. **User Guide (使用者指南)**:
   - Key workflows (e.g. Brainstorming, Flowcharting, Exporting).
   - Core Keyboard Shortcuts Table (clean reference for human users).
4. **Developer Guide (開發者指南)**:
   - Core Tech Stack list (React version, state management, canvas engine, etc.).
   - Architecture Overview (5-Layer Bottom-Up modular diagram or bullet structure).
   - Getting Started (prerequisites, `pnpm install`, `pnpm dev`, `pnpm build`, test commands).

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
