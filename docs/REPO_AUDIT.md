# Repository Audit: LINE Harness OSS

**Source:** https://github.com/Shudesu/line-harness-oss
**Audit date:** 2026-03-30
**Status:** Comprehensive audit based on remote repository exploration

---

## 1. Overall Architecture

LINE Harness OSS is a **pnpm monorepo**:

```
pnpm-workspace.yaml:
  - "apps/*"
  - "packages/*"
```

### Apps
| App | Stack | Purpose |
|-----|-------|---------|
| `apps/worker` | Cloudflare Workers (Hono) + Vite (LIFF client) | Core API, webhook handling, cron delivery, LIFF frontend |
| `apps/web` | Next.js 15 (App Router, Tailwind) | Admin management UI (19 page routes) |

### Packages
| Package | Purpose |
|---------|---------|
| `packages/db` | D1 database access layer (`@line-crm/db`, ~40 tables, 25 TS modules) |
| `packages/sdk` | AI-native programmatic SDK (`@line-harness/sdk`, 10 resource modules) |
| `packages/line-sdk` | Low-level LINE Platform API wrapper (`@line-crm/line-sdk`) |
| `packages/shared` | Shared types (`types.ts`, `index.ts`) |
| `packages/mcp-server` | MCP server for Claude Code integration |
| `packages/create-line-harness` | CLI scaffolding tool |
| `packages/plugin-template` | Plugin boilerplate |

---

## 2. Worker Structure (`apps/worker/src`)

```
apps/worker/src/
├── client/              # LIFF frontend (Vite-built)
│   ├── main.ts          # Entry point: friend-add + attribution
│   ├── form.ts          # Dynamic form renderer
│   ├── booking.ts       # Booking calendar
│   └── env.d.ts
├── middleware/
│   ├── auth.ts
│   ├── rate-limit.ts
│   └── role-guard.ts
├── routes/              # 27 route files
├── services/            # 12 service modules
├── utils/
├── index.ts             # Entry + cron scheduler + /r/:ref handler
├── wrangler.toml
└── vite.config.ts
```

### 27 Route Files

| Route File | Key Endpoints | Relevance |
|------------|--------------|-----------|
| `webhook.ts` | `POST /webhook` (multi-account signature resolution) | **Critical** - do not modify |
| `liff.ts` | `GET /auth/line`, `GET /auth/callback`, analytics | **Critical** - entry route + UUID |
| `friends.ts` | CRUD + tags, metadata, messages, ref-stats | **Critical** |
| `scenarios.ts` | Scenario CRUD + steps + enrollment | **Critical** |
| `tracked-links.ts` | Link CRUD + `GET /t/:linkId` redirect | **Critical** |
| `conversions.ts` | CV points CRUD + `POST /api/conversions/track` | **Critical** |
| `forms.ts` | Form CRUD + `POST /api/forms/:id/submit` | **Critical** |
| `tags.ts` | Tag CRUD | **High** |
| `automations.ts` | IF-THEN automation CRUD + logs | **High** |
| `broadcasts.ts` | Broadcast lifecycle | **High** |
| `line-accounts.ts` | Multi-account management with RBAC | **High** |
| `users.ts` | UUID user CRUD + friend linking | **High** |
| `health.ts` | Account health + migration | Medium |
| `affiliates.ts` | Affiliate management | Medium |
| `ad-platforms.ts` | Ad platform config | Medium |
| `staff.ts` | Staff member RBAC | Medium |
| `templates.ts` | Message template CRUD | Medium |
| `chats.ts` | Live chat | Low |
| `rich-menus.ts` | Rich menu ops | Low |
| `scoring.ts` | Lead scoring | Low |
| `calendar.ts` | Google Calendar bookings | Low |
| `reminders.ts` | Reminder management | Low |
| `notifications.ts` | Notification system | Low |
| `webhooks.ts` | Webhook I/O config | Low |
| `stripe.ts` | Stripe events | Low |
| `images.ts` | Image upload (R2) | Low |
| `openapi.ts` | API docs | Low |

### 12 Service Modules

| Service | Purpose | Relevance |
|---------|---------|-----------|
| `event-bus.ts` | **Central event dispatcher**: webhooks, scoring, ad CV, automations, notifications | **Critical** - orchestration hub |
| `step-delivery.ts` | Cron step delivery with `{{name}}`, `{{uid}}`, `{{auth_url:CHANNEL_ID}}` | **Critical** - do not modify |
| `broadcast.ts` | Broadcast sending engine | High |
| `ad-conversion.ts` | Offline CV postback: Meta CAPI, X, Google Ads, TikTok | High |
| `auto-track.ts` | Auto-wraps URLs in messages with tracking links | **High** |
| `segment-query.ts` | Segmented targeting | Medium |
| `segment-send.ts` | Segmented sending | Medium |
| `ban-monitor.ts` | Cron health checks (403=danger, 429=warning) | Medium |
| `stealth.ts` | Anti-detection: jitter, zero-width chars, rate limiting | Medium - sensitive |
| `reminder-delivery.ts` | Reminder scheduling | Low |
| `google-calendar.ts` | Calendar integration | Low |
| `token-refresh.ts` | Token management | Low |

---

## 3. Database Schema (~40 tables)

### Core (MVP)
| Table | Key Fields | Notes |
|-------|-----------|-------|
| `friends` | `line_user_id`, `user_id` (UUID), `metadata` (JSON), `ref_code` | **ref_code = first-touch attribution** |
| `tags` / `friend_tags` | Tag system with color, many-to-many | Segmentation |
| `scenarios` / `scenario_steps` / `friend_scenarios` | triggers: `friend_add`, `tag_added`, `manual` | Step delivery |
| `broadcasts` | Draft/scheduled/sending/sent lifecycle | Broadcast |
| `messages_log` | Full message history | Audit |
| `auto_replies` | Keyword-based (exact/contains) | Auto-response |

### Round 2 (Multi-account / Tracking)
| Table | Notes |
|-------|-------|
| `users` | **UUID identity system** |
| `line_accounts` | Multi-account (channel_id, tokens, secrets) |
| `conversion_points` | Named CV with optional monetary value |
| `conversion_events` | friend + conversion_point + metadata |
| `affiliates` / `affiliate_clicks` | Affiliate tracking |

### Round 3 (Advanced)
`incoming_webhooks`, `outgoing_webhooks`, `google_calendar_connections`, `calendar_bookings`, `reminders`, `reminder_steps`, `friend_reminders`, `scoring_rules`, `friend_scores`, `templates`, `operators`, `chats`, `notification_rules`, `notifications`, `stripe_events`, `account_health_logs`, `account_migrations`, `automations`, `automation_logs`, `ad_platforms`, `ad_conversion_logs`, `staff_members`

### IMPORTANT: Tables in Migrations (Not in schema.sql)
- `entry-routes.ts` -> `entry_routes` table
- `tracked-links.ts` -> `tracked_links` / `link_clicks` tables
- `forms.ts` -> `forms` / `form_submissions` tables

**TODO:** Read migration files to confirm exact schemas.

---

## 4. Entry Route Tracking (`/auth/line?ref=xxx`)

**`GET /auth/line`**: Initiates LINE Login OAuth
- Accepts: `ref`, `redirect`, `gclid`, `fbclid`, `twclid`, `ttclid`, `utmSource`, `utmMedium`, `utmCampaign`
- All tracking data base64-encoded into OAuth `state` parameter
- Supports multi-account via `account` query param

**`GET /auth/callback`**: Processes OAuth return
- Decodes state to recover ref + ad click IDs + UTM params
- Creates/links UUID user record
- **First-touch attribution**: stores `ref` on `friends.ref_code`
- Post-auth: scenario enrollment for `friend_add`, step 0 delivery, tag application

**Analytics**: `GET /api/analytics/ref-summary`, `GET /api/analytics/ref/:refCode`

---

## 5. LINE Login UUID Flow

1. `users` table: Internal UUID users
2. `friends.user_id`: Links LINE friend to UUID user
3. LIFF client: `/api/liff/link` associates LINE user with UUID, stores in localStorage
4. Cross-account: same `user_id` across different `line_account_id` values
5. BAN Recovery: UUID persists across account migrations

---

## 6. SDK Structure (`@line-harness/sdk`)

10 resource modules: friends, tags, scenarios, broadcasts, forms, tracked-links, rich-menus, ad-platforms, staff, images.
High-level workflows: `createStepScenario()`, `broadcastText()`, `broadcastToTag()`.
Explicitly "AI-native" and "designed for AI agents (Claude Code)".

---

## 7. MCP Server

`packages/mcp-server/` with `resources/` and `tools/` directories.
Enables Claude Code to directly interact with LINE Harness API.

---

## 8. Admin UI (`apps/web/src`)

19 page routes: accounts, affiliates, automations, broadcasts, chats, conversions, emergency, form-submissions, friends, health, login, notifications, reminders, scenarios, scoring, staff, templates, users, webhooks.

Key components:
- `cc-prompt-button.tsx`: **Fixed FAB "CCに依頼" on every page**
- `prompt-modal.tsx`: Pre-built Claude Code prompt templates
- Multi-account context for account switching

---

## 9. Event Bus Architecture

**`event-bus.ts` is the central orchestration point.** All actions flow through `fireEvent()`:
- Phase 1: Outgoing webhooks, scoring, ad CV postbacks
- Phase 2: Automation rules, notifications

Actions: tag add/remove, scenario enrollment, messaging, rich menu, metadata update, webhook.

**AI layer should route through event bus, not bypass it.**

---

## 10. Existing Claude Code Integration

- **CcPromptButton**: FAB on every admin page
- **PromptModal**: Pre-built prompts for KPI analysis, scenario suggestions
- **MCP Server**: Direct API interaction from Claude Code
- **SDK**: AI-native design with high-level workflow functions
- **Variable expansion**: `{{auth_url:CHANNEL_ID}}` in step delivery

---

## 11. Reuse Assessment

### Directly Reusable
Scenario CRUD, Tracked Links, Conversion Points/Events, Entry Routes, Forms, Friend Management, Tags, Event Bus, Auto-Track, SDK workflows, Ad CV Postback

### Needs Extension
LP Variant Management, AI Execution Logging, Conversion Events (LP attribution), Funnel Reporting

### Needs New
AI Orchestration Engine, Admin AI Chat Tab, Internal LP Conversion Endpoint, Preview/Confirm Module

---

## 12. Risky Modifications (Avoid)

| Area | Risk | Recommendation |
|------|------|----------------|
| `webhook.ts` | Critical | Do not modify |
| `step-delivery.ts` | Critical | Do not modify |
| `event-bus.ts` | Critical | Read and reuse, do not restructure |
| `/auth/line` + `/auth/callback` | Critical | Do not modify |
| `stealth.ts` | Sensitive | Do not modify |
| `ban-monitor.ts` | Sensitive | Do not modify |
| Core DB schema | Migration risk | Additive changes only |

---

## 13. Critical Finding: auto-track.ts

**auto-track.ts automatically wraps URLs in messages with tracking links.**
- URLs in step delivery are already instrumented
- AI orchestration should leverage this, not duplicate
- Tracked link creation may be partially automatic

---

## 14. Open Questions

1. Exact schemas for tracked_links, link_clicks, entry_routes, forms, form_submissions?
2. How does auto-track.ts interact with manually created tracked links?
3. What fields does entry_routes config store?
4. What are the side effects of forms/:id/submit?
5. What tools/resources does MCP server expose?
6. What is event-bus.ts event schema and action payload format?
7. How does conversions/track endpoint work for attribution?

---

## 15. Summary

LINE Harness OSS provides **nearly all primitives needed**:

- **Reusable as-is:** Scenarios, tracked links, CV points/events, entry routes, forms, friends, tags, event bus, auto-track, SDK, ad platform CAPI
- **Needs extension:** LP variants, AI execution logging, funnel reporting
- **Needs new:** AI orchestration engine, admin AI chat UI, internal LP conversion endpoint
- **Existing CC awareness:** MCP server, CC prompt button, AI-native SDK

**Approach:** Build thin AI layer on top. Route mutations through existing services and event bus. Add new entities only where needed.
