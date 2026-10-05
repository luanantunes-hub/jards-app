import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const MIGRATION = "supabase/migrations/20261005170000_prestacao_prazos_avisos.sql";
const ATIVIDADES = "supabase/migrations/20260830000001_notification_inbox_v2.sql";

function dias(lista: string): number[] {
  return lista.split(",").map(valor => Number(valor.trim()));
}

test("a rotina avisa nos marcos do prazo e não repete o que a atividade já avisa", async () => {
  const sql = await readFile(MIGRATION, "utf8");
  const marcos = sql.match(/p\.prazo - hoje in \(([^)]+)\)/);
  assert.ok(marcos, "marcos do aviso");
  assert.deepEqual(dias(marcos[1]), [30, 15, 7, 3, 1, 0, -1, -3, -7]);

  const soDaRotina = sql.match(/continue when r\.tem_atividade and dias not in \(([^)]+)\)/);
  assert.ok(soDaRotina, "com atividade, a rotina só manda os avisos longos");
  assert.deepEqual(dias(soDaRotina[1]), [30, 15]);

  // Os demais marcos são exatamente os da rotina das atividades.
  const atividades = await readFile(ATIVIDADES, "utf8");
  const daAtividade = atividades.match(/data_prevista::date - current_date in \(([^)]+)\)/);
  assert.ok(daAtividade);
  assert.deepEqual(
    dias(marcos[1]).filter(dia => !dias(soDaRotina[1]).includes(dia)),
    dias(daAtividade[1]),
  );
});

test("aviso repetido não conta e a chave separa destinatário e prazo", async () => {
  const sql = await readFile(MIGRATION, "utf8");
  assert.match(sql, /evento := public\.fn_emit_notification\(/);
  assert.match(sql, /if evento is not null then avisos := avisos \+ 1; end if;/);
  assert.match(sql, /'prestacao_prazo:' \|\| r\.id \|\| ':' \|\| r\.prazo \|\| ':' \|\| dias \|\| ':' \|\| r\.destinatario/);
  assert.match(sql, /'\/prestacoes\/' \|\| r\.id, 'prestacao'/, "link e categoria da prestação");
});

test("a categoria da prestação tem nome na caixa de notificações", async () => {
  const pagina = await readFile("app/(dashboard)/notificacoes/page.tsx", "utf8");
  assert.match(pagina, /prestacao: "Prestação de contas"/);
});

test("a atividade não impede salvar a prestação e acompanha prazo, status e título", async () => {
  const sql = await readFile(MIGRATION, "utf8");
  const criacao = sql.slice(sql.indexOf("insert into public.atividades"), sql.indexOf("return;\n  end if;"));
  assert.match(criacao, /exception when others then\s+--[^\n]*\n[^\n]*\n\s+raise warning/,
    "limite do plano gratuito vira aviso, não erro");
  assert.match(sql, /when \(old\.prazo is distinct from new\.prazo\s+or old\.status is distinct from new\.status\s+or old\.titulo is distinct from new\.titulo\)/);
  assert.match(sql, /update public\.atividades set feita = true, data_realizada = now\(\)/, "enviada, a atividade é concluída");
  assert.match(sql, /regra_origem = 'prestacao_prazo_envio'/);
});

test("rotina agendada, funções fechadas ao navegador e migração sem DROP", async () => {
  const sql = await readFile(MIGRATION, "utf8");
  assert.match(sql, /cron\.schedule\('jards-prestacao-prazos', '20 11 \* \* \*', 'select public\.fn_prestacao_prazos_diaria\(\);'\)/);
  for (const funcao of ["prestacao_responsavel(uuid)", "fn_prestacao_sincronizar_atividade(uuid)", "fn_prestacao_prazos_diaria()"]) {
    assert.ok(sql.includes(`revoke execute on function public.${funcao} from public, anon, authenticated;`), funcao);
  }
  assert.doesNotMatch(sql.replace(/--[^\n]*/g, ""), /\bdrop\b/i);
});
