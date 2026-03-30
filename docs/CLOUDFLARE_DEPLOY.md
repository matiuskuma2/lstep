# Cloudflare Deploy Guide

## Overview

Worker deployment is fully automated via GitHub Actions.
Push to `main` deploys to production. Push to `staging` deploys to staging.

---

## Worker Names

| Environment | Worker Name | Branch |
|-------------|-------------|--------|
| Production | `lstep-ai-api-prod` | `main` |
| Staging | `lstep-ai-api-stg` | `staging` |

---

## Deploy Flow

```
Push to staging branch
  -> GitHub Actions: deploy-worker.yml
  -> wrangler deploy --env staging
  -> lstep-ai-api-stg deployed

Push to main branch
  -> GitHub Actions: deploy-worker.yml
  -> wrangler deploy
  -> lstep-ai-api-prod deployed

Manual dispatch (Actions tab)
  -> Choose environment
  -> Deploy
```

---

## Required GitHub Secrets

Set these in GitHub repo Settings > Secrets and variables > Actions:

| Secret | Description | How to get |
|--------|-------------|------------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token (NOT Global API Key) | Cloudflare Dashboard > My Profile > API Tokens > Create Token > "Edit Cloudflare Workers" template |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID | Cloudflare Dashboard > any domain > Overview > right sidebar, or Workers & Pages > Overview |

### Creating the API Token

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use template: **"Edit Cloudflare Workers"**
4. Permissions needed:
   - Account > Workers Scripts > Edit
   - Account > Workers KV Storage > Edit
   - Account > Workers R2 Storage > Edit
   - Account > D1 > Edit
5. Account Resources: Include your account
6. Create Token and copy it to GitHub Secrets

---

## Cloudflare Runtime Secrets

These are set on the Worker itself, NOT in GitHub Secrets:

| Secret | Purpose | When needed |
|--------|---------|-------------|
| `OPENAI_API_KEY` | AI chat LLM calls | Before AI chat endpoints work |
| `ADMIN_JWT_SECRET` | Admin UI session signing | Before admin auth works |

### How to set runtime secrets

**Option A: Cloudflare Dashboard**
1. Workers & Pages > lstep-ai-api-prod (or stg)
2. Settings > Variables
3. Add under "Secrets"

**Option B: wrangler CLI**
```bash
wrangler secret put OPENAI_API_KEY
wrangler secret put ADMIN_JWT_SECRET
# For staging:
wrangler secret put OPENAI_API_KEY --env staging
```

---

## First-time Setup Checklist

### 1. GitHub Secrets
- [ ] `CLOUDFLARE_API_TOKEN` set
- [ ] `CLOUDFLARE_ACCOUNT_ID` set

### 2. D1 Database
- [ ] Create D1 database: `wrangler d1 create lstep-db`
- [ ] Update `database_id` in `wrangler.toml`
- [ ] (Optional) Create staging DB: `wrangler d1 create lstep-db-stg`

### 3. Initial Deploy
- [ ] Push to `staging` branch
- [ ] Check Actions tab for success
- [ ] Verify worker URL responds: `https://lstep-ai-api-stg.<subdomain>.workers.dev`

### 4. Runtime Secrets
- [ ] Set `OPENAI_API_KEY` on worker
- [ ] Set `ADMIN_JWT_SECRET` on worker

### 5. Production
- [ ] Merge to `main`
- [ ] Verify production deploy
- [ ] Set production runtime secrets

---

## Branch Strategy

```
feature/* branches
  -> PR to staging
  -> merge to staging -> auto deploy to lstep-ai-api-stg
  -> test on staging
  -> PR to main
  -> merge to main -> auto deploy to lstep-ai-api-prod
```

---

## Troubleshooting

### Deploy fails with auth error
- Verify `CLOUDFLARE_API_TOKEN` has correct permissions
- Verify `CLOUDFLARE_ACCOUNT_ID` is correct
- Check token hasn't expired

### Deploy fails with "Worker not found"
- First deploy creates the worker automatically
- If `wrangler.toml` has wrong name, it creates a new worker

### D1 binding error
- Update `database_id` in `wrangler.toml` after creating D1
- D1 must be in the same Cloudflare account

---

## Safety Rules

- NEVER put `OPENAI_API_KEY` or other runtime secrets in GitHub Secrets
- NEVER put secrets in `wrangler.toml`
- NEVER commit `.dev.vars` (add to `.gitignore`)
- Use Cloudflare Dashboard or `wrangler secret put` for runtime secrets
- Global API Key should NOT be used; use scoped API Token instead
