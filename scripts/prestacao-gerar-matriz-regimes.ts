// Gera a matriz de cobertura dos regimes (dimensão × regime) a partir do código.
//
// Uso:
//   npx tsx scripts/prestacao-gerar-matriz-regimes.ts
//
// Grava em ARQUIVO_MATRIZ (lib/prestacao/regimes/cobertura.ts). O teste
// tests/prestacao-regimes-cobertura.test.ts falha se o arquivo ficar
// diferente do código.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ARQUIVO_MATRIZ, gerarMatrizCobertura } from "../lib/prestacao/regimes/cobertura";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
writeFileSync(join(raiz, ARQUIVO_MATRIZ), gerarMatrizCobertura());
console.log(`Matriz gravada em ${ARQUIVO_MATRIZ}`);
