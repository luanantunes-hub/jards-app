// Junta arquivos SQL num bloco que roda tudo e é desfeito no fim.
//
// Uso:
//   npx tsx scripts/testes-banco-em-bloco.ts supabase/tests/prestacao_rls.test.sql > bloco.sql
//   npx tsx scripts/testes-banco-em-bloco.ts supabase/migrations/<nova>.sql supabase/tests/prestacao_rls.test.sql > bloco.sql
//
// Cole o bloco no editor SQL do Supabase (ou mande pelo conector): a saída
// TAP volta na mensagem de erro "BLOCO DESFEITO", e nada fica gravado. Com a
// migration na frente, os testes rodam sobre ela antes de ela ser aplicada.
// Veja supabase/tests/README.md.
import { readFileSync } from "node:fs";
import { emBlocoDesfeito } from "../lib/supabase/sql-em-bloco";

const arquivos = process.argv.slice(2);
if (arquivos.length === 0) {
  console.error("Informe ao menos um arquivo .sql");
  process.exit(1);
}
process.stdout.write(emBlocoDesfeito(arquivos.map(arquivo => readFileSync(arquivo, "utf8"))));
