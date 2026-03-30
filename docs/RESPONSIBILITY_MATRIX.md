# Responsibility Matrix: Admin UI vs AI Chat vs Secrets

## Overview

This document defines which settings and operations belong to which layer.
The guiding principle: **AI operates on what's already connected, never connects infrastructure itself.**

---

## Layer 1: Admin UI (Manual / Human-confirmed)

These are set up by a human in the LINE Harness admin panel before AI can do anything.

### LINE Account Infrastructure
| Setting | Where | Notes |
|---------|-------|-------|
| LINE Channel ID | Admin UI `accounts` page | Per-account |
| Channel Access Token | Admin UI `accounts` page | Stored in D1 `line_accounts` |
| Channel Secret | Admin UI `accounts` page | Used for webhook signature verification |
| Login Channel ID + Secret | Admin UI `accounts` page | For `/auth/line` OAuth flow |
| Webhook URL | LINE Developers Console + Admin UI | Must match worker deployment URL |
| LIFF URL | LINE Developers Console | For forms, friend-add flow |
| Rich Menu | Admin UI `rich-menus` page | Visual configuration |
| Account display name / picture | LINE Official Account Manager | Not in LINE Harness |

### Multi-Account / BAN Recovery
| Setting | Where | Notes |
|---------|-------|-------|
| Add/remove LINE accounts | Admin UI `accounts` page | Human decision |
| BAN recovery group assignment | Admin UI `health` page | Sensitive |
| Account migration trigger | Admin UI `health` page | Requires human judgment |
| Health monitoring config | Admin UI `health` page | Thresholds |

### Entry Route Base Config
| Setting | Where | Notes |
|---------|-------|-------|
| Define entry route codes | Admin UI (entry routes section) | e.g. `youtube`, `instagram` |
| Map ref codes to tags | Admin UI | Which tags to auto-apply on registration |
| Map ref codes to scenarios | Admin UI | Which scenarios to auto-enroll |

### Form / Questionnaire Design
| Setting | Where | Notes |
|---------|-------|-------|
| Create form structure | Admin UI `forms` page | Field types, labels, validation |
| Edit form fields | Admin UI `forms` page | Change questions |
| Activate/deactivate forms | Admin UI `forms` page | Control availability |

### Staff / Permissions
| Setting | Where | Notes |
|---------|-------|-------|
| Add/remove staff members | Admin UI `staff` page | RBAC |
| Assign roles (owner/admin/staff) | Admin UI `staff` page | Access control |
| Generate API keys | Admin UI `staff` page | For SDK/external access |

### Automations (Base Rules)
| Setting | Where | Notes |
|---------|-------|-------|
| Create IF-THEN automations | Admin UI `automations` page | Complex logic |
| Edit automation triggers/actions | Admin UI `automations` page | Requires understanding |

---

## Layer 2: AI Chat (Orchestration / Operations)

AI chat works **on top of** what's already set up in Layer 1.
It reads existing accounts, routes, forms, and creates operational configurations.

### Scenario Operations
| Operation | AI Chat | Admin UI | Notes |
|-----------|---------|----------|-------|
| Create step scenario | Yes (primary) | Yes (fallback) | AI asks slots, builds plan, confirms |
| Edit step scenario | Yes | Yes | AI identifies target, proposes change |
| Delete scenario | No | Yes only | Destructive, human-only |
| View scenario list | Yes (read) | Yes | AI can list for context |
| Enroll friends manually | No | Yes only | Sensitive bulk operation |

### Tracked Link Operations
| Operation | AI Chat | Admin UI | Notes |
|-----------|---------|----------|-------|
| Create tracked link | Yes | Yes | AI binds to scenario/LP/CV |
| View click stats | Yes (read) | Yes | AI can report |
| Delete tracked link | No | Yes only | Destructive |

### Conversion Point Operations
| Operation | AI Chat | Admin UI | Notes |
|-----------|---------|----------|-------|
| Create conversion point | Yes | Yes | AI defines code/name/scope |
| Edit conversion point | Yes (with confirm) | Yes | |
| Delete conversion point | No | Yes only | Could break attribution |
| View conversion events | Yes (read) | Yes | For reporting |

### LP Operations
| Operation | AI Chat | Admin UI | Notes |
|-----------|---------|----------|-------|
| Propose internal LP publish plan | Yes (plan only) | N/A | AI generates plan, human executes |
| Generate external LP tracking guide | Yes | N/A | AI produces install guide |
| Manage LP variants | Yes (create) | Yes | AI can register LP metadata |

### Reporting
| Operation | AI Chat | Admin UI | Notes |
|-----------|---------|----------|-------|
| Show funnel report | Yes | Yes | AI formats and explains |
| Show conversion quality | Yes | Yes | |
| Show attribution breakdown | Yes | Yes | |

### What AI Chat MUST Do Before Mutation
1. Identify which LINE account to use (ask if ambiguous)
2. Extract all required slots
3. Ask back only for missing required fields
4. Generate structured preview
5. Wait for explicit confirmation
6. Execute via adapters (not direct DB)
7. Log execution
8. Return summary with admin UI link for manual follow-up

### What AI Chat MUST NOT Do
- Connect or disconnect LINE accounts
- Modify webhook URLs or channel secrets
- Change authentication/login configuration
- Delete scenarios, tracked links, or conversion points
- Bulk-edit friends, tags, or enrollments
- Modify automations or scoring rules
- Access or display secrets/tokens
- Bypass event bus for mutations

---

## Layer 3: Cloudflare Secrets (Server-side only)

These are never visible in any UI. Set via `wrangler secret put` or Cloudflare dashboard.

| Secret | Purpose | Notes |
|--------|---------|-------|
| `OPENAI_API_KEY` | AI chat backend (LLM calls) | Required for AI orchestration |
| `ANTHROPIC_API_KEY` | Alternative/future LLM provider | Optional |
| `WEBHOOK_VERIFY_SECRET` | Outgoing webhook HMAC signing | If using external webhook consumers |
| `ADMIN_JWT_SECRET` | Admin UI session signing | Authentication |
| Future external API keys | Third-party integrations | As needed |

### Rules for Secrets
- Never store in `wrangler.toml`
- Never expose in admin UI
- Never include in AI chat responses
- Never commit to git
- Access only via `env.SECRET_NAME` in worker code

---

## Startup Sequence (For New Deployment)

### Step 1: Infrastructure (One-time, Human)
1. Deploy LINE Harness worker to Cloudflare
2. Set Cloudflare Secrets (`wrangler secret put`)
3. Create LINE Official Account in LINE Developers Console
4. Configure Messaging API channel
5. Configure Login channel (for UUID/entry route tracking)

### Step 2: Admin UI Setup (Human)
1. Add LINE account in admin UI (Channel ID, Token, Secret)
2. Set webhook URL in LINE Developers Console
3. Verify webhook works (friend add triggers)
4. Create LIFF app and set URL
5. Define entry route codes and tag mappings
6. Create initial form/questionnaire
7. Set up staff accounts and permissions

### Step 3: Verify Base Functions (Human)
1. Add yourself as friend via `/auth/line?ref=test`
2. Confirm entry route recorded
3. Fill test form
4. Confirm friend metadata stored
5. Create a manual test scenario in admin UI
6. Confirm step delivery works

### Step 4: AI Chat Operations (AI-assisted)
1. AI reads available LINE accounts
2. User says: "新規友だち向けに3日ステップを作って"
3. AI asks missing slots
4. AI shows preview
5. Human confirms
6. AI creates scenario + tracked links + CV point
7. Human verifies in admin UI

---

## Decision Table: "Should AI Do This?"

| Question | Answer | Layer |
|----------|--------|-------|
| Does it involve infrastructure credentials? | No -> maybe AI, Yes -> Admin UI | Admin UI |
| Does it delete or destroy data? | No -> maybe AI, Yes -> Admin UI only | Admin UI |
| Does it change authentication flow? | Always Admin UI | Admin UI |
| Does it create operational config? | AI Chat (with confirm) | AI Chat |
| Does it read/report data? | AI Chat (no confirm needed) | AI Chat |
| Does it involve secrets? | Cloudflare Secrets | Secrets |
| Is it a bulk operation on friends? | Admin UI only | Admin UI |
| Is it a single scenario/link/CV creation? | AI Chat (with confirm) | AI Chat |

---

## Summary

```
Admin UI:  "接続する・守る・消す"
AI Chat:   "作る・読む・提案する"（確認付き）
Secrets:   "鍵を隠す"
```
