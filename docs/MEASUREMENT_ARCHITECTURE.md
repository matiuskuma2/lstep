# Measurement Architecture

## 1. Purpose

This document defines the measurement architecture for the AI-driven LINE step delivery system built on top of LINE Harness OSS.

**Primary business goal:**
- Track acquisition source -> LINE registration -> questionnaire/form attributes -> message click -> LP visit -> conversion
- Support both internally hosted LPs and external LPs
- Make attribution understandable and operationally safe for marketing teams

**Initial target use case:** Hiramatsu Kenchiku step delivery operations

---

## 2. Measurement Objectives

We need to answer the following questions reliably:

1. **Where did the user come from before LINE registration?**
   - YouTube, Instagram, TikTok, HP, Seminar, Partner routes, Other campaign-specific sources

2. **What kind of user registered?**
   - Area / region, Budget, Interest category, Inquiry type, Questionnaire answers

3. **Which LINE step / message / link did the user interact with?**

4. **Which LP did the user visit?**

5. **Did the user convert?**

6. **What conversion type occurred?**
   - `lifeplan_apply`, `certified_builder_inquiry`, `catalog_request`, `consultation_booking`, other future types

7. **Which combinations are working?**
   - source -> scenario -> step -> link -> LP -> conversion
   - source -> questionnaire attributes -> conversion
   - LP variant -> conversion

---

## 3. Principles

### 3.1 Prefer internal LP hosting first
Internal LP hosting is the default recommendation because it provides:
- stronger attribution control
- simpler event capture
- less cross-domain loss
- easier debugging
- more consistent mobile behavior

### 3.2 Support external LPs as a secondary mode
External LPs are supported, but attribution quality depends on:
- tracking tag installation quality
- query param preservation
- browser/device behavior
- site-side event forwarding

### 3.3 Distinguish measured events from inferred events
We must not mix certainty levels.
- Link click = measured
- LP page view = measured if confirmed
- Conversion on external site = measured only if explicit event received
- Attribution fallback guess = inferred

### 3.4 Keep attribution explicit
Never rely on hidden assumptions when a deterministic identifier can be passed.

### 3.5 Human-safe operations
Measurement changes that affect campaigns must be reviewable and understandable by operations staff.

---

## 4. Canonical Entities

### 4.1 Line Account
Key fields: `line_account_id`, `channel_id`, `account_name`, `status`, `ban_recovery_group_id` (future)

### 4.2 Entry Route
Examples: `youtube`, `instagram`, `tiktok`, `hp`, `lp_campaign_a`, `partner_tokyo`, `seminar_2026_04`

Key fields: `entry_route_id`, `route_code`, `route_name`, `source_platform`, `campaign_name`, `ref_value`

### 4.3 Friend
Key fields: `friend_id`, `line_user_id`, `uuid`, `line_account_id`, `registered_at`, `entry_route_id`, `status`

### 4.4 Friend Attributes
Examples: region, city, budget_range, desired_move_timing, family_structure, inquiry_type

Key fields: `friend_attribute_id`, `friend_id`, `attribute_key`, `attribute_value`, `source_form_id`, `captured_at`

### 4.5 Scenario
Key fields: `scenario_id`, `line_account_id`, `scenario_name`, `trigger_type`, `status`

### 4.6 Scenario Step
Key fields: `scenario_step_id`, `scenario_id`, `step_order`, `send_delay_minutes`, `message_type`, `content_reference`, `goal_label`

### 4.7 Tracked Link
Key fields: `tracked_link_id`, `scenario_id`, `scenario_step_id`, `destination_type`, `destination_url`, `lp_variant_id`, `conversion_point_id`, `campaign_label`

### 4.8 Link Click
Key fields: `click_id`, `tracked_link_id`, `friend_id`, `line_account_id`, `clicked_at`, `user_agent`, `ip_hash`, `ref_context`

### 4.9 LP Variant
Internal LP examples: `/lp/lifeplan/youtube-a`, `/lp/lifeplan/instagram-b`
External LP examples: `https://example.com/lp/house-1`

Key fields: `lp_variant_id`, `lp_type` (internal | external), `lp_name`, `canonical_url`, `version_label`, `campaign_label`

### 4.10 Conversion Point
Examples: `lifeplan_apply`, `certified_builder_inquiry`, `consultation_booking`

Key fields: `conversion_point_id`, `conversion_code`, `conversion_name`, `conversion_scope`, `is_primary`

### 4.11 Conversion Event
Key fields: `conversion_event_id`, `conversion_point_id`, `friend_id`, `tracked_link_id`, `click_id`, `lp_variant_id`, `event_source`, `happened_at`, `verification_status`

Verification status values: `verified`, `measured_unverified`, `inferred`

---

## 5. End-to-End Event Flow

### 5.1 Acquisition -> LINE Registration
1. User sees a campaign entry point
2. User clicks LINE registration URL with route identifier
3. LINE registration / login completes
4. System stores: `line_account_id`, `uuid`, `entry_route_id`, `registered_at`

Expected route capture pattern:
- `/auth/line?ref=youtube`
- `/auth/line?ref=instagram_reel_2026_04`
- `/auth/line?ref=partner_aichi`

### 5.2 Registration -> Questionnaire
1. Newly registered friend receives first step / prompt
2. User answers questionnaire or form
3. Attributes are linked to `friend_id`

### 5.3 Scenario Delivery -> Tracked Link Click
1. Scenario step message contains tracked link
2. User clicks tracked link
3. System records click before redirecting

### 5.4 Click -> LP Visit
**If internal LP:** click_id and attribution params are passed directly

**If external LP:** query params are passed if possible; depends on external instrumentation

### 5.5 LP Visit -> Conversion
**If internal LP:** conversion event posted directly to our endpoint; strong attribution

**If external LP:** conversion event must be sent by tag or server callback

---

## 6. Attribution Model

### 6.1 Primary attribution chain
```
entry_route -> friend registration -> questionnaire attributes -> scenario -> scenario_step -> tracked_link -> click -> lp_variant -> conversion_event
```

### 6.2 Attribution priority
1. explicit `click_id`
2. `tracked_link_id`
3. `friend_id` + recent `lp_variant` mapping
4. inferred from latest qualifying click within window

### 6.3 Attribution window
- Default: **30 days**
- Configurable per conversion point in future

### 6.4 One conversion, multiple signals
Keep all available evidence. Do not compress prematurely.

---

## 7. Internal LP Strategy

### 7.1 URL design
```
/lp/{campaign_slug}/{variant_slug}
```

### 7.2 Attribution params
Required: `click_id`, `tracked_link_id`, `friend_ref`, `scenario_id`, `scenario_step_id`, `entry_route`, `lp_variant`

### 7.3 Conversion endpoint
```
POST /api/lp/conversions
```
Payload: `conversion_point_code`, `lp_variant_id`/`slug`, `click_id`, `tracked_link_id`, `friend_ref`, `happened_at`

### 7.4 Versioning
Keep immutable version folders or metadata. Do not silently overwrite historical LP meaning.

---

## 8. External LP Strategy

### 8.1 Measurement levels
| Level | What we can measure |
|-------|-------------------|
| Level 1: Click only | tracked link click |
| Level 2: Click + param propagation | partial attribution |
| Level 3: Click + conversion tag | measured conversion |
| Level 4: Click + server callback | verified conversion |

### 8.2 Minimum spec
- preserve query params
- install conversion event tag
- send `conversion_point_code`, `click_id`, `tracked_link_id`

### 8.3 Caveats
- query params may be stripped
- JS may not load
- cross-domain limitations
- mobile in-app browser behaviors vary

### 8.4 Reporting rule
Always distinguish: measured click, confirmed landing, verified conversion, unattributed conversion

---

## 9. Reporting Requirements

- Funnel by acquisition source
- Funnel by scenario
- Funnel by LP variant
- Funnel by questionnaire attributes
- Conversion quality report (verified / measured_unverified / inferred)

---

## 10. Data Quality Rules

1. Never treat click as conversion
2. Never treat external conversion as verified unless explicit event received
3. Preserve raw evidence fields
4. Keep timestamps in all event tables
5. Prefer append-only event recording
6. Log attribution mismatches

---

## 11. Out of Scope for Initial Release

- Full multi-touch attribution
- Ads platform bid optimization
- Cross-platform identity stitching
- Offline conversion import
- Agent P2P in production measurement path

---

## 12. Open Questions

1. Which existing tables already cover entry route and conversion event needs?
2. How is UUID persisted through LINE login flow?
3. Do internal LPs live in same repo, same deployment, or separate Pages project?
4. Required retention period for raw click and conversion evidence?
5. Which conversion types are primary KPIs at launch?
