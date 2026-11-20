#!/usr/bin/env bash
# Empacota o plugin do WordPress (integracoes/wordpress/jards-ingressos) num .zip pronto para instalar ou enviar ao diretório do WordPress.org.
# Uso: scripts/empacotar-plugin-wordpress.sh [pasta-de-saida]   (padrão: a pasta atual). Imprime o caminho do zip.
set -euo pipefail
raiz="$(cd "$(dirname "$0")/.." && pwd)"
saida="$(cd "${1:-.}" && pwd)"
versao="$(sed -n 's/^ \* Version: *//p' "$raiz/integracoes/wordpress/jards-ingressos/jards-ingressos.php" | head -1 | tr -d '[:space:]')"
[ -n "$versao" ] || { echo "não achei a versão no cabeçalho do plugin" >&2; exit 1; }
zip_final="$saida/jards-ingressos-$versao.zip"
rm -f "$zip_final"
(cd "$raiz/integracoes/wordpress" && zip -rq "$zip_final" jards-ingressos -x "*.DS_Store" -x "*/.*")
echo "$zip_final"
