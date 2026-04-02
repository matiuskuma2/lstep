#!/bin/bash
# ============================================================
# lstep Cloudflare Setup Script
# ============================================================
# Usage:
#   1. Install wrangler: npm install -g wrangler
#   2. Login: wrangler login
#   3. Run this script: bash scripts/cloudflare-setup.sh
#
# IMPORTANT:
#   - This creates a NEW worker named "lstep-worker"
#   - This creates a NEW D1 database named "lstep-db"
#   - This does NOT touch any existing workers or databases
#   - Review each step before running
# ============================================================

set -euo pipefail

echo "============================================"
echo "  lstep Cloudflare Setup"
echo "============================================"
echo ""

# --- Config ---
WORKER_NAME="lstep-worker"
D1_DB_NAME="lstep-db"

# --- Pre-flight checks ---
echo "[1/6] Checking wrangler..."
if ! command -v wrangler &> /dev/null; then
    echo "ERROR: wrangler is not installed."
    echo "Install it with: npm install -g wrangler"
    exit 1
fi

echo "[2/6] Checking authentication..."
wrangler whoami || {
    echo "ERROR: Not logged in. Run 'wrangler login' first."
    exit 1
}

# --- List existing resources (safety check) ---
echo ""
echo "[3/6] Listing existing Workers (for safety)..."
echo "--- Existing Workers ---"
wrangler deployments list 2>/dev/null || echo "(Could not list deployments)"
echo ""
echo "--- Existing D1 Databases ---"
wrangler d1 list 2>/dev/null || echo "(Could not list D1 databases)"
echo ""

# --- Confirm before proceeding ---
echo "============================================"
echo "This script will create:"
echo "  - Worker: $WORKER_NAME"
echo "  - D1 Database: $D1_DB_NAME"
echo ""
echo "It will NOT modify any existing resources."
echo "============================================"
read -p "Continue? (y/N): " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "Aborted."
    exit 0
fi

# --- Create D1 Database ---
echo ""
echo "[4/6] Creating D1 database: $D1_DB_NAME ..."
D1_OUTPUT=$(wrangler d1 create "$D1_DB_NAME" 2>&1)
echo "$D1_OUTPUT"

# Extract database_id from output
D1_ID=$(echo "$D1_OUTPUT" | grep -oP 'database_id\s*=\s*"\K[^"]+' || echo "")
if [ -z "$D1_ID" ]; then
    D1_ID=$(echo "$D1_OUTPUT" | grep -oP '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1 || echo "")
fi

if [ -z "$D1_ID" ]; then
    echo "WARNING: Could not extract database_id automatically."
    echo "Please find it in the output above and update wrangler.toml manually."
else
    echo ""
    echo "D1 Database ID: $D1_ID"
fi

# --- Generate wrangler.toml ---
echo ""
echo "[5/6] Generating wrangler.toml ..."

cat > wrangler.toml << TOML
name = "$WORKER_NAME"
main = "src/index.ts"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

# D1 Database binding
[[d1_databases]]
binding = "DB"
database_name = "$D1_DB_NAME"
database_id = "${D1_ID:-REPLACE_WITH_YOUR_D1_DATABASE_ID}"

# R2 Bucket (for image uploads) - create separately if needed
# [[r2_buckets]]
# binding = "IMAGES"
# bucket_name = "lstep-images"

# KV Namespace (for caching) - create separately if needed
# [[kv_namespaces]]
# binding = "CACHE"
# id = "REPLACE_WITH_KV_NAMESPACE_ID"

# Environment variables (non-secret)
[vars]
ENVIRONMENT = "production"

# Secrets (set via: wrangler secret put SECRET_NAME)
# Required secrets:
#   - OPENAI_API_KEY
#   - ADMIN_JWT_SECRET
#
# Do NOT put secrets in this file.
# Use: wrangler secret put OPENAI_API_KEY
# Use: wrangler secret put ADMIN_JWT_SECRET

# Cron triggers (for step delivery, broadcasts, health checks)
# [triggers]
# crons = ["*/1 * * * *"]
TOML

echo "wrangler.toml generated."

# --- Print next steps ---
echo ""
echo "[6/6] Setup complete!"
echo ""
echo "============================================"
echo "  Next Steps"
echo "============================================"
echo ""
echo "1. Review wrangler.toml"
if [ -z "$D1_ID" ]; then
    echo "   - Update database_id in wrangler.toml"
fi
echo ""
echo "2. Set secrets (NEVER put these in wrangler.toml):"
echo "   wrangler secret put OPENAI_API_KEY"
echo "   wrangler secret put ADMIN_JWT_SECRET"
echo ""
echo "3. Initialize D1 schema (when LINE Harness is forked):"
echo "   wrangler d1 execute $D1_DB_NAME --file=packages/db/schema.sql"
echo ""
echo "4. Deploy:"
echo "   wrangler deploy"
echo ""
echo "5. Verify:"
echo "   curl https://$WORKER_NAME.<your-subdomain>.workers.dev/health"
echo ""
echo "============================================"
echo "  Safety Reminders"
echo "============================================"
echo "- Do NOT commit wrangler.toml with real secrets"
echo "- Do NOT share API keys in chat or code"
echo "- Rotate any exposed credentials immediately"
echo "- Check Cloudflare dashboard to verify only lstep resources were created"
echo ""
