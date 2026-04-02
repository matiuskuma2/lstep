# Audit Workflow

## Purpose

Prevent technical debt, runtime incidents, and repeated failures by adding structured quality gates at three stages: Issue creation, PR review, and staging verification.

---

## Stage 1: Issue Pre-Audit

When Claude creates an Issue, it must include:

### Risk Checklist
- [ ] null / undefined / empty input handling confirmed
- [ ] tenant boundary respected (no cross-tenant data access)
- [ ] no direct DB mutation (uses adapter/service layer)
- [ ] no secrets exposed in code or logs
- [ ] existing pages/endpoints not broken
- [ ] race condition / concurrency impact assessed
- [ ] error messages are actionable, not leaking internals

### Verification Plan
- **Completion criteria:** specific, measurable outcome
- **Staging URL to test:** exact endpoint(s)
- **Expected response:** what success looks like
- **DB evidence:** what to check in D1
- **PASS / FAIL / PENDING criteria:** unambiguous

---

## Stage 2: PR Audit

When Claude reviews a Codex PR, output must follow this format:

```
## PR Audit: #{PR_NUMBER}

### 1. Summary
[What this PR does in 1-2 sentences]

### 2. Concerns
[List any issues found, prefixed with warning symbol]

### 3. Code Quality Check
| Category | Status | Notes |
|----------|--------|-------|
| Input safety | PASS/FAIL | |
| Logic correctness | PASS/FAIL | |
| Error handling | PASS/FAIL | |
| Existing code compatibility | PASS/FAIL | |
| Security | PASS/FAIL | |
| Config / Infrastructure | PASS/FAIL | |
| Performance | PASS/FAIL | |
| Dependencies | PASS/FAIL | |
| Tests | PASS/FAIL | |
| Maintainability | PASS/FAIL | |

### 4. Development Process Check
| Check | Status |
|-------|--------|
| "Fixed" vs "verified working" distinction | PASS/FAIL |
| Root cause confirmed before fix | PASS/FAIL |
| Design change not mixed with bug fix | PASS/FAIL |
| Real data assumptions validated | PASS/FAIL |
| Completion criteria specific | PASS/FAIL |

### 5. Verdict
PASS / FAIL / PENDING

### 6. Required Follow-up
[List any fix Issues needed, or "None"]
```

---

## Stage 3: Staging Verification

After deploy to staging, Claude must produce:

```
## Staging Verification: #{ISSUE_NUMBER}

- **URL tested:** [exact URL]
- **Expected result:** [what should happen]
- **Actual result:** [what happened]
- **DB evidence:** [query result or N/A]
- **Side effects checked:** [list what was verified not broken]
- **Verdict:** PASS / FAIL / PENDING
- **Evidence:** [screenshot description, response body, etc.]
```

### Verdict Definitions
- **PASS:** All completion criteria met, evidence captured, no regressions
- **FAIL:** One or more criteria not met, or regression found
- **PENDING:** Cannot verify (e.g., depends on external service, needs manual test)

---

## Weekly Audit (Recommended)

Once per week, Claude should:
1. Review last 3-5 merged PRs for patterns
2. Identify recurring issues or shortcuts
3. List any technical debt accumulating
4. Create Issues for cross-cutting fixes if needed
5. Update this doc if audit process needs adjustment

---

## Anti-Patterns to Flag

- "It deployed successfully" used as proof of correctness
- Multiple unrelated changes in one PR
- Direct DB queries bypassing adapter layer
- Debug endpoints left in merged code
- Staging direct push instead of PR flow
- Error handling that swallows errors silently
- Untested edge cases for null/empty inputs
- Tenant ID not checked on data access
