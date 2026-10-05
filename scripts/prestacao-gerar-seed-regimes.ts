// Gera o seed de prestacao_regimes e calendario_regulatorio a partir do código.
//
// Uso:
//   npx tsx scripts/prestacao-gerar-seed-regimes.ts
//
// Grava em ARQUIVO_SEED (lib/prestacao/regimes/seed.ts). O teste
// tests/prestacao-regimes-seed.test.ts falha se o arquivo ficar diferente
// do código.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ARQUIVO_SEED, gerarSeedRegimes } from "../lib/prestacao/regimes/seed";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
writeFileSync(join(raiz, ARQUIVO_SEED), gerarSeedRegimes());
console.log(`Seed gravado em ${ARQUIVO_SEED}`);
