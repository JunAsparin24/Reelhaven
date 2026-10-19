#!/bin/sh
# Writes config.json for the browser from environment variables (used by the
# Render build). Only the public anon key is used — never a service-role key.
OUT="${1:-dist/config.json}"
printf '{"supabaseUrl":"%s","supabaseAnonKey":"%s","googleAuth":%s}\n' \
  "${SUPABASE_URL:-}" "${SUPABASE_ANON_KEY:-}" "${GOOGLE_AUTH_ENABLED:-false}" > "$OUT"
echo "wrote $OUT (online: $([ -n "$SUPABASE_URL" ] && echo on || echo off))"
