#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# LeadGen Pro — Production Deployment Script
# Run: bash scripts/deploy-production.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT="leadgen-pro"
DB_NAME="leadgen-pro-production"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  LeadGen Pro — Production Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. Verify Cloudflare auth
echo ""
echo "▸ Checking Cloudflare authentication..."
npx wrangler whoami || { echo "ERROR: Run setup_cloudflare_api_key first"; exit 1; }

# 2. Build
echo ""
echo "▸ Building for production..."
npm run build

# 3. Apply D1 migrations
echo ""
echo "▸ Applying D1 database migrations..."
npx wrangler d1 migrations apply "$DB_NAME" || echo "  (No new migrations)"

# 4. Push Cloudflare Pages secrets
echo ""
echo "▸ Configuring Cloudflare Pages secrets..."
npx wrangler pages secret put OPENAI_API_KEY      --project-name "$PROJECT" < /dev/stdin <<< "${OPENAI_API_KEY:-}"
npx wrangler pages secret put RESEND_API_KEY       --project-name "$PROJECT" < /dev/stdin <<< "${RESEND_API_KEY:-}"
npx wrangler pages secret put TWILIO_ACCOUNT_SID   --project-name "$PROJECT" < /dev/stdin <<< "${TWILIO_ACCOUNT_SID:-}"
npx wrangler pages secret put TWILIO_AUTH_TOKEN     --project-name "$PROJECT" < /dev/stdin <<< "${TWILIO_AUTH_TOKEN:-}"
npx wrangler pages secret put STRIPE_SECRET_KEY     --project-name "$PROJECT" < /dev/stdin <<< "${STRIPE_SECRET_KEY:-}"
npx wrangler pages secret put STRIPE_WEBHOOK_SECRET --project-name "$PROJECT" < /dev/stdin <<< "${STRIPE_WEBHOOK_SECRET:-}"
npx wrangler pages secret put JWT_SECRET            --project-name "$PROJECT" < /dev/stdin <<< "${JWT_SECRET:-}"

# 5. Deploy
echo ""
echo "▸ Deploying to Cloudflare Pages..."
npx wrangler pages deploy dist --project-name "$PROJECT"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Deployment complete!"
echo "  🌐 https://${PROJECT}.pages.dev"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
