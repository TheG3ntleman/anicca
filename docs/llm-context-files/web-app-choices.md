# Anicca

## What Anicca Is

Anicca is a personal system for **capturing, organizing, and understanding the evolution of a person's inner life over time**.

It begins with simple free-form logging: thoughts, observations, experiences, emotions, ideas, goals, decisions, conversations, frustrations, questions, and other things a person wants to remember or examine later.

The important point is that Anicca is **not intended to be just a journal**.

The journal-like capture interface is only the input layer. The longer-term goal is to build a system that can take many individual observations accumulated over weeks, months, and years and help reconstruct the larger structure behind them.

Anicca should eventually help answer questions such as:

- What have I been repeatedly thinking about?
- How has my view of a particular idea changed over time?
- Which problems or goals keep resurfacing?
- What events tend to precede particular moods, behaviors, or decisions?
- Which thoughts that seemed unrelated were actually part of the same underlying theme?
- What ideas did a current belief or project develop from?
- What have I forgotten that is relevant to what I am thinking about now?
- What patterns are present across long periods that are difficult to notice from individual journal entries?
- How has the structure of my priorities, interests, relationships, or beliefs changed?

In this sense, Anicca is closer to a **personal longitudinal knowledge and introspection system** than a conventional diary.

A useful conceptual pipeline is:

```text
Capture
   ↓
Accumulated personal history
   ↓
Representation
   ↓
Analysis
   ↓
Reflection
```

### Capture

The capture layer should make it extremely easy to record something at the moment it occurs.

The user should not have to decide in advance how an entry should be categorized or structured. Free-form input should be the default.

The system can later extract or infer structure.

### Representation

Over time, the raw observations may be connected to higher-level objects or concepts such as:

- people;
- ideas;
- projects;
- goals;
- beliefs;
- events;
- emotions;
- decisions;
- recurring themes.

The exact representation is intentionally not fixed yet.

Anicca should remain flexible enough to experiment with different ways of representing a person's history, including semantic, graph-based, temporal, and statistical representations.

### Analysis

The accumulated data can later support analysis such as:

- semantic search;
- embeddings and similarity;
- clustering;
- graph construction;
- temporal analysis;
- recurring-pattern detection;
- summarization;
- concept tracing;
- comparison across time periods;
- LLM-based interpretation;
- other experimental methods.

The analysis system is expected to evolve significantly over time.

### Reflection

The purpose of the analysis is not analysis for its own sake.

The eventual goal is to create interfaces that allow the user to **inspect their own history and patterns more clearly than memory alone allows**.

This may include timelines, semantic search, graphs, summaries, related-entry views, recurring themes, or entirely different interfaces developed later.

---

## Important Principle

Anicca must distinguish between:

1. **what the user actually recorded**, and
2. **what the system inferred from it**.

Raw observations should be preserved as canonical records.

Machine-generated interpretations, classifications, summaries, relationships, clusters, or other derived results should remain explicitly derived information rather than silently becoming part of the original record.

This is important because Anicca may repeatedly reinterpret the same history as its analysis methods improve.

---

## Immediate Goal

The immediate objective is much smaller than the long-term vision.

The first version should simply become something useful enough to start using regularly.

The main initial workflow is:

- quickly record entries from a phone;
- retain them reliably;
- browse them later;
- export the accumulated data;
- perform richer analysis on a laptop.

The sophisticated representation and analysis system can develop after genuine usage has produced real data and real requirements.

---

## Product Shape

The intended usage pattern is:

- **Phone:** fast, low-friction capture and lightweight viewing.
- **Laptop/Desktop:** deeper browsing, visualization, analysis, and experimentation.

The same frontend should support both environments, while computationally expensive functionality may only be available on machines that have the required local analysis infrastructure.

---

## Architecture

Use a single cross-platform web frontend that can run on:

- iOS;
- Android;
- Linux/Desktop.

The frontend should be a **Progressive Web App (PWA)**.

Recommended frontend stack:

- React
- TypeScript
- Vite
- Dexie / IndexedDB
- `vite-plugin-pwa`

The frontend should use responsive layouts, while feature availability should depend on actual device/backend capabilities rather than screen size alone.

---

## Data and Mobile Usage

For the initial version, the mobile application should not require a backend.

Entries can be stored locally using IndexedDB.

Initial transfer between phone and laptop can be deliberately simple:

```text
Phone
  ↓
Local Anicca data
  ↓
Export complete dataset
  ↓
JSON file
  ↓
Manual transfer
  ↓
Laptop
```

Automatic synchronization can be introduced later.

---

## Backend / Analysis

The desktop side will eventually have a separate analysis layer.

Python is preferred because future Anicca functionality is expected to involve machine learning, embeddings, clustering, graphs, local models, and experimental analysis.

FastAPI is a reasonable option if the frontend later needs an HTTP interface to the local Python system.

The analysis implementation should remain conceptually separate from the frontend.

---

## Hosting

The initial PWA can be hosted using GitHub Pages.

GitHub Pages should host only the frontend application.

Personal Anicca data should remain in local browser storage unless the user explicitly exports or later synchronizes it.

---

## Repository Structure

```text
app/
    frontend/
    backend/

docs/
```

- `app/frontend` — cross-platform PWA
- `app/backend` — Python analysis/backend components
- `docs` — design, architecture, and conceptual notes

---

## First Milestone

The first milestone is not advanced AI analysis.

It is:

> Anicca is installed on the phone, opening it is effortless, logging something takes very little effort, entries persist reliably, and the accumulated data can be moved to the laptop for later exploration.

Everything else can evolve from there.