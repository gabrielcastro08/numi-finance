#!/bin/sh
# Gera dev/.site: copia do app usando o Supabase falso (dev/mock-supabase.js),
# com dados ficticios em memoria e sem service worker. Nada toca o banco real.
#   sh dev/build-mock.sh && python -m http.server 8790 --directory dev/.site
DEV="$(cd "$(dirname "$0")" && pwd)"
OUT="$DEV/.site"
rm -rf "$OUT" && cp -r "$DEV/../controle-financeiro-deploy" "$OUT" && cp "$DEV/mock-supabase.js" "$OUT/"
sed -i 's#<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>#<script src="mock-supabase.js"></script>#; s#if (.serviceWorker. in navigator)#if (false)#' "$OUT/index.html"
grep -q 'mock-supabase.js' "$OUT/index.html" || { echo "ERRO: tag do supabase nao encontrada"; exit 1; }
echo "ok: $OUT"
