#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Set all production secrets in Cloudflare Pages
# Usage: source .dev.vars && bash scripts/set-cloudflare-secrets.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
PROJECT="leadgen-pro"

echo "Setting Cloudflare Pages secrets for: $PROJECT"

secrets=(
  "OPENAI_API_KEY"
  "ANTHROPIC_API_KEY"
  "RESEND_API_KEY"
  "TWILIO_ACCOUNT_SID"
  "TWILIO_AUTH_TOKEN"
  "STRIPE_SECRET_KEY"
  "STRIPE_WEBHOOK_SECRET"
  "STRIPE_PUBLISHABLE_KEY"
  "JWT_SECRET"
)

for secret in "${secrets[@]}"; do
  value="${!secret:-}"
  if [ -n "$value" ]; then
    echo "$value" | npx wrangler pages secret put "$secret" --project-name "$PROJECT"
    echo "  ✅ $secret"
  else
    echo "  ⚠️  $secret — not set in environment, skipping"
  fi
done

echo ""
echo "✅ Secrets configured. Run: npx wrangler pages deploy dist --project-name $PROJECT"
