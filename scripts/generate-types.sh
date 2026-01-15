#!/bin/bash

# Generate TypeScript types from Supabase
# Usage: ./scripts/generate-types.sh

# Get these from your Supabase dashboard: Settings > API
SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}"
SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY}"

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
  echo "Error: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set"
  echo "You can find these in your Supabase dashboard: Settings > API"
  exit 1
fi

# Extract project ref from URL
PROJECT_REF=$(echo $SUPABASE_URL | sed -E 's|https://([^.]+)\.supabase\.co.*|\1|')

echo "Generating types for project: $PROJECT_REF"

# Generate types using Supabase API
curl -s "https://$PROJECT_REF.supabase.co/rest/v1/" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  > /dev/null 2>&1

# If you have Supabase CLI installed, use this:
if command -v supabase &> /dev/null; then
  echo "Using Supabase CLI..."
  supabase gen types typescript --linked > lib/supabase/types.ts
  echo "✅ Types generated successfully!"
else
  echo "⚠️  Supabase CLI not found. Please use one of these methods:"
  echo ""
  echo "1. Install Supabase CLI:"
  echo "   brew install supabase/tap/supabase"
  echo ""
  echo "2. Or use the Supabase Dashboard:"
  echo "   - Go to Settings > API"
  echo "   - Scroll to 'TypeScript types'"
  echo "   - Click 'Generate types'"
  echo "   - Copy and paste into lib/supabase/types.ts"
fi
