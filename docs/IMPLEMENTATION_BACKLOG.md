# Implementation Backlog

## Overview

This document defines the implementation issue list, dependencies, and execution order for the AI orchestration layer on LINE Harness OSS.

---

## Epic 0: Repo Audit / Planning

### Issue 0-1: Audit existing LINE Harness capabilities
**Priority:** P0 (blocker)
**Description:** Audit the LINE Harness OSS codebase for existing scenario, tracking, conversion, entry route, form, friend metadata, and automation capabilities. Document which features exist and are reusable.
**Deliverable:** `docs/REPO_AUDIT.md`
**Dependencies:** None

### Issue 0-2: Map existing DB tables and API endpoints for attribution
**Priority:** P0 (blocker)
**Description:** Identify all D1 tables, API routes, and service functions related to tracked links, conversion points, conversion events, entry routes, forms, and friend metadata. Produce a table-level and route-level inventory.
**Deliverable:** Section in `docs/REPO_AUDIT.md`
**Dependencies:** Issue 0-1

### Issue 0-3: Document internal-LP vs external-LP measurement strategy
**Priority:** P0
**Description:** Finalize the measurement strategy document covering both internal and external LP measurement, attribution model, and event flow.
**Deliverable:** `docs/MEASUREMENT_ARCHITECTURE.md` (review and finalize)
**Dependencies:** Issue 0-1

### Issue 0-4: Define AI orchestration state machine and required slots
**Priority:** P0
**Description:** Finalize the AI orchestration plan document covering intents, slot schemas, state machine, preview/confirm design, and adapter architecture.
**Deliverable:** `docs/AI_ORCHESTRATION_PLAN.md` (review and finalize)
**Dependencies:** Issue 0-1, 0-3

---

## Epic 1: Measurement Foundation

### Issue 1-1: Design attribution model entity schemas
**Priority:** P1
**Description:** Define concrete D1 table schemas (or schema extensions) for: `entry_routes`, `lp_variants`, `link_clicks` (extended), `conversion_events` (extended), `friend_attributes`. Map to existing tables where possible.
**Deliverable:** Migration SQL draft + schema doc
**Dependencies:** Epic 0 completed

### Issue 1-2: Define internal LP conversion capture endpoint
**Priority:** P1
**Description:** Design the `POST /api/lp/conversions` endpoint for internal LPs. Define request payload, validation rules, attribution resolution logic, and response format.
**Deliverable:** API spec + route skeleton
**Dependencies:** Issue 1-1

### Issue 1-3: Define external LP tracking integration spec
**Priority:** P2
**Description:** Define the minimum embeddable tag / script / payload spec for external LP conversion capture. Produce an install guide template.
**Deliverable:** `docs/EXTERNAL_LP_TRACKING_GUIDE_TEMPLATE.md`
**Dependencies:** Issue 1-1

### Issue 1-4: Implement LP variant entity
**Priority:** P1
**Description:** Add `lp_variants` table (if not existing) and CRUD routes/services for managing LP variants (internal and external).
**Deliverable:** Migration + service + routes
**Dependencies:** Issue 1-1

---

## Epic 2: AI Orchestration MVP

### Issue 2-1: Implement intent catalog
**Priority:** P1
**Description:** Create a registry of supported intents with metadata (name, category, requires_confirmation, slot_schema_ref). Start with 7 initial intents.
**Deliverable:** `src/ai/intents/` module
**Dependencies:** Epic 0 completed

### Issue 2-2: Implement slot schema per intent
**Priority:** P1
**Description:** Define structured slot schemas (required/optional fields, types, validation rules) for each intent. Use JSON Schema or equivalent.
**Deliverable:** Slot schema definitions
**Dependencies:** Issue 2-1

### Issue 2-3: Implement ask-back engine
**Priority:** P1
**Description:** Build the logic that compares extracted slots against required slots and generates focused follow-up questions in Japanese.
**Deliverable:** Ask-back module with tests
**Dependencies:** Issue 2-2

### Issue 2-4: Implement preview/confirm flow
**Priority:** P1 (critical safety)
**Description:** Build the preview generation and confirmation gate. Mutating intents must produce a human-readable summary and block execution until confirmed.
**Deliverable:** Preview/confirm module with tests
**Dependencies:** Issue 2-3

### Issue 2-5: Implement execution logging
**Priority:** P1
**Description:** Create execution log table and logging service. Every AI-driven mutation must be logged with intent, plan, status, and resource IDs.
**Deliverable:** Migration + logging service
**Dependencies:** Issue 2-4

### Issue 2-6: Implement admin AI chat tab skeleton
**Priority:** P1
**Description:** Add an AI Chat tab to the Next.js admin UI. Minimum: chat thread, intent badge, fields checklist, preview panel, result panel, link to manual editor.
**Deliverable:** UI component + route
**Dependencies:** Issue 2-1

---

## Epic 3: Adapters

### Issue 3-1: ScenarioAdapter
**Priority:** P1
**Description:** Adapter for creating scenarios via existing domain services. Accepts structured plan, calls scenario creation routes/services, returns created resource summary.
**Deliverable:** Adapter + tests
**Dependencies:** Epic 0 (route inventory), Issue 2-4

### Issue 3-2: ScenarioStepAdapter
**Priority:** P1
**Description:** Adapter for creating/editing scenario steps. Handles step ordering, delay configuration, message content references.
**Deliverable:** Adapter + tests
**Dependencies:** Issue 3-1

### Issue 3-3: TrackedLinkAdapter
**Priority:** P1
**Description:** Adapter for creating tracked links. Binds to scenario steps, LP variants, and conversion points.
**Deliverable:** Adapter + tests
**Dependencies:** Issue 3-1, Issue 1-4

### Issue 3-4: ConversionPointAdapter
**Priority:** P1
**Description:** Adapter for creating/reading conversion points. Maps AI-specified conversion codes to existing or new conversion point records.
**Deliverable:** Adapter + tests
**Dependencies:** Issue 1-1

### Issue 3-5: ReportAdapter
**Priority:** P2
**Description:** Adapter for querying and formatting funnel reports by source, scenario, LP variant, and attributes.
**Deliverable:** Adapter + tests
**Dependencies:** Issue 1-1, Issue 1-4

---

## Epic 4: LP Support

### Issue 4-1: Internal LP publish plan design
**Priority:** P1
**Description:** Define the LP publishing workflow: folder/version naming, attribution param propagation, conversion endpoint binding. AI generates a plan; execution may be manual initially.
**Deliverable:** Design doc + plan generation logic
**Dependencies:** Issue 1-2, Issue 1-4

### Issue 4-2: Internal LP conversion event endpoint implementation
**Priority:** P1
**Description:** Implement `POST /api/lp/conversions` with validation, attribution resolution, and event recording.
**Deliverable:** Route + service + tests
**Dependencies:** Issue 1-2

### Issue 4-3: External LP script/tag guide generation
**Priority:** P2
**Description:** Implement guide generation logic that produces a customized install guide based on external domain, conversion type, and integration level.
**Deliverable:** Guide generator + template
**Dependencies:** Issue 1-3

### Issue 4-4: Attribution param propagation rules
**Priority:** P1
**Description:** Define and implement rules for how attribution params flow from tracked link click through LP visit to conversion event. Cover both internal and external LP cases.
**Deliverable:** Attribution param service + tests
**Dependencies:** Issue 1-1, Issue 1-4

---

## Epic 5: Reporting

### Issue 5-1: Source-to-CV funnel report
**Priority:** P2
**Description:** Implement the primary funnel report: source -> registration -> click -> LP visit -> conversion. Filterable by time range, account, source, scenario.
**Deliverable:** Report query + API + UI component
**Dependencies:** Epic 1, Epic 3

### Issue 5-2: Attribute-based conversion breakdown
**Priority:** P2
**Description:** Implement conversion breakdown by questionnaire/form attributes (region, budget, inquiry type, etc.).
**Deliverable:** Report query + API + UI component
**Dependencies:** Issue 5-1

### Issue 5-3: Conversion verification and mismatch logging
**Priority:** P2
**Description:** Implement conversion quality report showing verified/measured_unverified/inferred counts. Log attribution mismatches for investigation.
**Deliverable:** Report + mismatch log service
**Dependencies:** Issue 5-1

---

## Epic 6: Optional Agent P2P Spike

### Issue 6-1: Define AgentP2PExecutor interface
**Priority:** P3
**Description:** Define the interface for non-critical distributed tasks (copy generation, report generation, analysis).
**Deliverable:** Interface definition + design doc
**Dependencies:** Epic 2 completed

### Issue 6-2: Spike: copy/report generation via Agent P2P
**Priority:** P3
**Description:** Prototype running content generation or report generation as a distributed Agent P2P task. Strictly non-critical path.
**Deliverable:** Spike report + prototype
**Dependencies:** Issue 6-1

### Issue 6-3: Document production boundaries for Agent P2P
**Priority:** P3
**Description:** Document which operations are allowed and forbidden for Agent P2P in production. Keep this in CLAUDE.md and design docs.
**Deliverable:** Policy doc update
**Dependencies:** Issue 6-1

---

## Dependency Graph

```
Epic 0 (Audit/Planning)
  |
  v
Epic 1 (Measurement Foundation) ---+---> Epic 4 (LP Support)
  |                                |
  v                                v
Epic 2 (AI Orchestration MVP) ---> Epic 3 (Adapters) ---> Epic 5 (Reporting)
                                                              |
                                                              v
                                                     Epic 6 (Agent P2P Spike)
```

---

## Implementation Order (Minimum Viable Path)

### Phase 1: Foundation (Week 1-2)
1. Issue 0-1: Repo audit
2. Issue 0-2: DB/API inventory
3. Issue 0-3: Measurement architecture finalization
4. Issue 0-4: AI orchestration plan finalization

### Phase 2: Core Infrastructure (Week 2-3)
5. Issue 1-1: Attribution entity schemas
6. Issue 2-1: Intent catalog
7. Issue 2-2: Slot schemas
8. Issue 2-6: Admin AI chat tab skeleton

### Phase 3: Orchestration Engine (Week 3-4)
9. Issue 2-3: Ask-back engine
10. Issue 2-4: Preview/confirm flow
11. Issue 2-5: Execution logging
12. Issue 1-4: LP variant entity

### Phase 4: First Vertical Slice (Week 4-5)
13. Issue 3-1: ScenarioAdapter
14. Issue 3-2: ScenarioStepAdapter
15. Issue 3-3: TrackedLinkAdapter
16. Issue 3-4: ConversionPointAdapter

### Phase 5: LP + Conversion (Week 5-6)
17. Issue 4-1: Internal LP publish plan
18. Issue 1-2: Internal LP conversion endpoint
19. Issue 4-2: Internal LP conversion implementation
20. Issue 4-4: Attribution param propagation

### Phase 6: Reporting + External LP (Week 6-8)
21. Issue 5-1: Funnel report
22. Issue 1-3: External LP tracking spec
23. Issue 4-3: External LP guide generation
24. Issue 5-2: Attribute breakdown
25. Issue 5-3: Conversion quality report

### Phase 7: Agent P2P Spike (Optional)
26. Issue 6-1: Interface definition
27. Issue 6-2: Spike
28. Issue 6-3: Production boundary docs

---

## Fork Strategy Note

### Approach
- Fork `Shudesu/line-harness-oss` to organization GitHub
- Set upstream to original repository
- All extensions are additive changes on feature branches
- Avoid broad refactoring of existing core routes/services
- Preserve upstream merge compatibility

### Extension Points
- New `src/ai/` directory for orchestration layer
- New admin UI tab/route for AI chat
- New API routes for LP conversion capture
- New/extended DB tables for LP variants and enhanced attribution
- New adapter layer between AI and existing domain services

### Risky Modifications (Avoid)
- Changing existing webhook processing logic
- Modifying core delivery/cron execution paths
- Restructuring existing DB schemas in breaking ways
- Removing existing admin UI functionality
- Changing authentication/authorization flow

### Recommended First Branch Plan
1. `feature/docs-foundation` - All planning docs
2. `feature/ai-intent-catalog` - Intent + slot schemas
3. `feature/ai-chat-skeleton` - Admin UI chat tab
4. `feature/ai-orchestration-engine` - State machine + ask-back + preview/confirm
5. `feature/adapters-scenario` - Scenario + step adapters
6. `feature/lp-conversion` - LP variant entity + conversion endpoint
7. `feature/reporting-funnel` - Basic funnel report
