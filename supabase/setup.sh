#!/bin/bash
# =============================================================
#  JARDS — Setup completo do banco Supabase
#  Uso: bash supabase/setup.sh
#
#  Precisa de:
#    - SUPABASE_ACCESS_TOKEN no ambiente (ou já ter feito supabase login)
#    - .env.local com SUPABASE_SERVICE_ROLE_KEY preenchida
# =============================================================
set -e

PROJECT_REF="ykaymbmybellixxvtasi"

echo ""
echo "🔗 Linkando projeto..."
supabase link --project-ref $PROJECT_REF

echo ""
echo "📦 Aplicando migrations..."
supabase db push

echo ""
echo "🌱 Importando dados do Bubble (empresas + responsáveis)..."
cd "$(dirname "$0")/.."
npx tsx supabase/seed_from_bubble.ts

echo ""
echo "✅ Banco pronto!"
echo "   → ${PROJECT_REF}.supabase.co"
