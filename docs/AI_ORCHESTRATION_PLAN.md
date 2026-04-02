# AI Orchestration Plan

## 1. Purpose

This document defines the AI orchestration layer that enables natural-language-driven campaign setup on top of LINE Harness OSS.

The AI layer must help users create and configure:
- step scenarios
- tracked links
- conversion points
- LP publishing plans
- reporting requests

The AI layer must **not** directly mutate core campaign state without a confirmation step.

---

## 2. Product Goal

Provide an admin-side AI chat experience where operators can say things like:

- "\u65b0\u898f\u53cb\u3060\u3061\u5411\u3051\u306b3\u65e5\u30b9\u30c6\u30c3\u30d7\u3092\u4f5c\u3063\u3066"
- "YouTube\u6d41\u5165\u5411\u3051\u306bLP\u3078\u8a98\u5c0e\u3057\u3066\u3001\u30e9\u30a4\u30d5\u30d7\u30e9\u30f3\u7533\u8fbc\u3092CV\u3068\u3057\u3066\u8a08\u6e2c\u3057\u3066"
- "Instagram\u6d41\u5165\u306e\u53cd\u5fdc\u304c\u60aa\u3044\u306e\u3067\u3001\u5c0e\u7dda\u3068CV\u3092\u78ba\u8a8d\u3057\u3066"

The system should:
1. detect intent
2. identify missing required business fields
3. ask only necessary follow-up questions
4. create a draft execution plan
5. wait for confirmation
6. execute via adapters/services
7. return created resources and summary
8. preserve manual admin editing path

---

## 3. Design Principles

1. **Safety before autonomy** - AI should be useful, not free-running
2. **State-machine over pure free-form prompting** - Execution follows explicit state transitions
3. **Reuse domain primitives** - Prefer existing LINE Harness logic
4. **Deterministic slot extraction** - Prefer explicit schemas over vague interpretation
5. **Confirmation required for mutations** - No mutations without preview/confirm
6. **Preserve operator control** - Everything created by AI must remain editable via admin UI

---

## 4. Initial Supported Intents

| Intent | Category |
|--------|----------|
| `create_step_scenario` | Mutation |
| `edit_step_scenario` | Mutation |
| `create_tracking_link` | Mutation |
| `set_conversion_point` | Mutation |
| `publish_internal_lp_plan` | Plan (may mutate) |
| `generate_external_lp_tracking_guide` | Read-only |
| `show_funnel_report` | Read-only |

Optional future: `create_broadcast`, `create_automation`, `assign_tag_rule`, `generate_copy_variants`, `analyze_dropoff`

---

## 5. Conversation State Machine

```
idle
  -> intent_detected
    -> collecting_required_slots
      -> awaiting_user_answer
        -> (back to collecting_required_slots)
      -> draft_plan_ready
        -> awaiting_confirmation
          -> executing
            -> completed
            -> partial_failed
            -> failed
```

Transitions must be explicit and logged.

---

## 6. Core Execution Flow

### 6.1 High-level flow
1. User sends chat instruction
2. System classifies intent
3. System loads slot schema for that intent
4. System extracts known values from user message and context
5. System identifies missing required slots
6. System asks focused follow-up questions
7. System builds structured draft plan
8. System displays preview
9. User confirms
10. System executes using adapters/services
11. System returns summary, IDs, links, and manual follow-up path

### 6.2 Mutation rule
If the action changes business state, preview/confirm is **mandatory**.

**Requires confirmation:** create scenario, edit scenario, create tracked link, create conversion point, publish LP plan

**No confirmation needed:** show report, explain current setup, draft external tracking guide

---

## 7. Structured Intermediate Representation

Before execution, the AI must build a structured action plan.

Example:
```json
{
  "intent": "create_step_scenario",
  "line_account_id": "acc_main",
  "target_audience": "new_friends",
  "trigger": "friend_add",
  "scenario_name": "Lifeplan 3-day nurture",
  "steps": [
    {"order": 1, "delay_minutes": 0, "goal": "welcome", "message_outline": "Welcome and expectation setting"},
    {"order": 2, "delay_minutes": 1440, "goal": "education", "message_outline": "Explain lifeplan value"},
    {"order": 3, "delay_minutes": 2880, "goal": "conversion", "message_outline": "Drive lifeplan application"}
  ],
  "tracked_link_plan": {
    "destination_type": "internal_lp",
    "lp_variant_slug": "lifeplan/youtube-a",
    "conversion_point_code": "lifeplan_apply"
  }
}
```

Execution must consume this structured representation, not raw natural language.

---

## 8. Required Slots by Intent

### 8.1 `create_step_scenario`
| Slot | Required | Example |
|------|----------|--------|
| `line_account` | Yes | Hiramatsu Main |
| `target_audience` | Yes | new_friends |
| `trigger` | Yes | friend_add |
| `scenario_name` | Yes | Lifeplan 3-day nurture |
| `step_count` or `step_structure` | Yes | 3 |
| `message_goal_per_step` | Yes | welcome, education, conversion |
| `delivery_timing` | Yes | day 0, day 1, day 2 |
| `destination_lp` | Yes | /lp/lifeplan/youtube-a |
| `tracking_required` | Yes | true |
| `conversion_point` | Yes | lifeplan_apply |
| `safe_send_window` | Yes | 09:00-20:00 |
| `tag_conditions` | No | - |
| `tone/style` | No | - |

### 8.2 `edit_step_scenario`
| Slot | Required |
|------|----------|
| `target_scenario` | Yes |
| `requested_change` | Yes |
| `step_number` | No |
| `timing_change` | No |
| `copy_change` | No |
| `destination_change` | No |

### 8.3 `create_tracking_link`
| Slot | Required |
|------|----------|
| `line_account` | Yes |
| `destination_type` | Yes |
| `destination_url` or `lp_variant` | Yes |
| `campaign_label` | Yes |
| `attribution_context` | Yes |
| `scenario_id` | No |
| `conversion_point` | No |

### 8.4 `set_conversion_point`
| Slot | Required |
|------|----------|
| `conversion_name` | Yes |
| `conversion_code` | Yes |
| `conversion_scope` | Yes |
| `verification_method` | Yes |
| `primary_flag` | No |
| `lp_variant_binding` | No |

### 8.5 `publish_internal_lp_plan`
| Slot | Required |
|------|----------|
| `source_lp_assets` | Yes |
| `campaign_slug` | Yes |
| `variant_slug` | Yes |
| `destination_conversion_point` | Yes |
| `attribution_params_required` | Yes |
| `version_label` | No |

### 8.6 `generate_external_lp_tracking_guide`
| Slot | Required |
|------|----------|
| `external_domain` | Yes |
| `conversion_type` | Yes |
| `integration_capability_level` | Yes |
| `tag_manager_availability` | No |
| `server_side_callback_support` | No |

### 8.7 `show_funnel_report`
| Slot | Required |
|------|----------|
| `report_scope` | Yes |
| `time_range` | Yes |
| `line_account` | No |
| `source_filter` | No |
| `scenario_filter` | No |
| `lp_filter` | No |
| `conversion_filter` | No |
| `attribute_breakdown` | No |

---

## 9. Ask-Back Design

Ask follow-up questions only for missing **required** business fields.

### Good examples
- "\u3069\u306eLINE\u30a2\u30ab\u30a6\u30f3\u30c8\u3067\u914d\u4fe1\u3057\u307e\u3059\u304b\uff1f"
- "CV\u3068\u3057\u3066\u8a08\u6e2c\u3057\u305f\u3044\u306e\u306f\u3001\u30e9\u30a4\u30d5\u30d7\u30e9\u30f3\u7533\u8fbc\u3067\u3059\u304b\u3001\u8a8d\u5b9a\u5de5\u52d9\u5e97\u554f\u3044\u5408\u308f\u305b\u3067\u3059\u304b\uff1f"
- "\u8a98\u5c0e\u5148LP\u306f\u5185\u90e8\u30db\u30b9\u30c8\u3067\u3059\u304b\u3001\u5916\u90e8\u30b5\u30a4\u30c8\u3067\u3059\u304b\uff1f"

### Ask-back priority order
1. account / target / trigger
2. destination and conversion
3. timing and scenario shape
4. optional details

---

## 10. Preview / Confirm Design

Before mutation, show a concise execution summary.

### Required preview content
- intent, target LINE account, scenario name, trigger
- number of steps, destination LP, conversion point
- tracked link creation summary
- warnings / assumptions

### Example preview
```
LINE account: Hiramatsu Main
Scenario: Lifeplan 3-day nurture
Trigger: friend_add
Steps: 3
LP: internal /lp/lifeplan/youtube-a
Conversion: lifeplan_apply
Tracking links: 1 per conversion step
Assumption: safe send window 09:00-20:00

\u3053\u306e\u5185\u5bb9\u3067\u4f5c\u6210\u3057\u3066\u3088\u308d\u3057\u3044\u3067\u3059\u304b\uff1f [\u78ba\u8a8d] / [\u4fee\u6b63]
```

User must explicitly approve before execution.

---

## 11. Adapter Architecture

The AI layer must not directly mutate core entities. Use adapters.

| Adapter | Responsibility |
|---------|---------------|
| `ScenarioAdapter` | Create/read scenarios |
| `ScenarioStepAdapter` | Create/edit scenario steps |
| `TrackedLinkAdapter` | Create tracked links |
| `ConversionPointAdapter` | Create/read conversion points |
| `ReportAdapter` | Query and format reports |
| `InternalLpPlanAdapter` | Generate LP publish plans |
| `ExternalLpGuideAdapter` | Generate external LP tracking guides |

Adapter responsibilities: validate payload, call existing services, normalize results, log execution.

---

## 12. Execution Logging

Every AI-driven execution must be logged.

Minimum fields: `execution_id`, `user_id`, `intent`, `input_summary`, `structured_plan` (JSON), `confirmation_timestamp`, `execution_status`, `created_resource_ids`, `failure_reason`, timestamps.

---

## 13. Failure Handling

- Never hide partial failure
- Show what succeeded and what failed
- Keep structured plan for retry
- Suggest manual admin follow-up when needed
- Retries must be idempotent where possible

---

## 14. Initial UI Plan

Add an AI Chat tab to admin UI.

Minimum sections: chat thread, intent badge, fields checklist, preview panel, execution result panel, link to manual admin editor.

---

## 15. Agent P2P Policy

**Allowed:** copy generation, batch reporting, async analysis, proposal generation

**Not allowed initially:** scenario execution, tracked link creation, webhook logic, cron dispatch

---

## 16. Security and Governance

- no secret exposure in prompts
- no autonomous broad mutation
- no direct DB manipulation by LLM
- confirmation required for mutations
- preserve auditability

---

## 17. Success Criteria for MVP

1. operator can request a step scenario in chat
2. AI asks only necessary follow-ups
3. AI produces a clear preview
4. confirmed execution creates scenario/tracking/CV resources
5. operator can continue editing in admin UI
6. execution is logged
7. no direct unsafe mutation path exists

---

## 18. Open Questions

1. Which existing admin pages should host the AI chat tab?
2. Which routes/services are safest to reuse for scenario and tracked link mutations?
3. Should structured plans be stored as JSON in execution logs?
4. What minimal permission model is required for AI-assisted operations?
5. Should internal LP publishing be plan-only in MVP or executable?
