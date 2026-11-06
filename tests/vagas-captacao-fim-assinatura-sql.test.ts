import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { dividirComandos } from "../lib/supabase/sql-em-bloco";

// Vagas da captação quando a assinatura acaba: confere sem banco a forma da
// migration. O comportamento é conferido no banco por
// supabase/tests/vagas_captacao_fim_assinatura.test.sql.

const COBRANCA_ANTERIOR = "supabase/migrations/20260910000002_carencia_pagamento_atrasado.sql";
const VAGAS_ANTERIOR = "supabase/migrations/20261015062658_producao_modulo_funcoes.sql";
const TESTE = "supabase/tests/vagas_captacao_fim_assinatura.test.sql";

async function migration(): Promise<string> {
  const nome = (await readdir("supabase/migrations")).find(n => n.endsWith("_vagas_captacao_fim_assinatura.sql"));
  assert.ok(nome, "migration vagas_captacao_fim_assinatura.sql não encontrada");
  return readFile(`supabase/migrations/${nome}`, "utf8");
}

/** Comandos sem comentários, com os espaços reduzidos a um e em minúsculas. */
const comandosDe = (sql: string) =>
  dividirComandos(sql.replace(/--.*$/gm, "")).map(comando => comando.replace(/\s+/g, " ").trim().toLowerCase());

function funcao(comandos: string[], nome: string): string {
  const comando = comandos.find(c => c.startsWith(`create or replace function public.${nome}(`));
  assert.ok(comando, `função ${nome} não encontrada`);
  return comando;
}

/** Os ramos `when '<módulo>' then …` de modulo_vagas_limite, na ordem; o último vai até o `else 0 end` final. */
function ramos(definicao: string): Record<string, string> {
  const partes = definicao.replace(/ else 0 end; \$\$$/, "").split(/ when '(\w+)' then /);
  const saida: Record<string, string> = {};
  for (let i = 1; i < partes.length; i += 2) saida[partes[i]] = partes[i + 1];
  return saida;
}

test("a migration não apaga nada: sem DROP e sem DELETE", async () => {
  const comandos = comandosDe(await migration());
  assert.ok(comandos.every(c => !/\bdrop\b/.test(c)), "sem DROP");
  assert.ok(comandos.every(c => !/^delete\b/.test(c)), "sem DELETE");
});

test("a cobrança só ganha o fim das vagas: o resto é a função de 20260910000002", async () => {
  const nova = funcao(comandosDe(await migration()), "fn_process_stripe_billing_event");
  const anterior = funcao(comandosDe(await readFile(COBRANCA_ANTERIOR, "utf8")), "fn_process_stripe_billing_event");
  const acrescimos: Array<[string, string]> = [
    ["v_past_due_since timestamptz; v_assinatura_anterior text; v_vagas_encerradas integer := 0;", "v_past_due_since timestamptz;"],
    [
      "select past_due_since, stripe_subscription_id into v_past_due_since, v_assinatura_anterior from public.profiles where id = v_user_id;",
      "select past_due_since into v_past_due_since from public.profiles where id = v_user_id;",
    ],
    [
      " if p_subscription_status in ('canceled', 'incomplete_expired') and (v_assinatura_anterior is null or v_assinatura_anterior = p_subscription_id) then"
        + " update public.organization_seats set purchased_seats = 0, stripe_subscription_item_id = null, updated_at = now()"
        + " where billing_user_id = v_user_id and (purchased_seats <> 0 or stripe_subscription_item_id is not null);"
        + " get diagnostics v_vagas_encerradas = row_count; end if;",
      "",
    ],
    [", 'vagas_encerradas', v_vagas_encerradas );", " );"],
  ];
  let semAcrescimos = nova;
  for (const [trecho, antes] of acrescimos) {
    assert.ok(semAcrescimos.includes(trecho), `falta o trecho: ${trecho.slice(0, 80)}…`);
    semAcrescimos = semAcrescimos.replace(trecho, antes);
  }
  assert.equal(semAcrescimos, anterior);
});

test("as vagas compradas da captação só contam com a assinatura em vigor; prestação e produção iguais", async () => {
  const nova = ramos(funcao(comandosDe(await migration()), "modulo_vagas_limite"));
  const anterior = ramos(funcao(comandosDe(await readFile(VAGAS_ANTERIOR, "utf8")), "modulo_vagas_limite"));
  assert.deepEqual(Object.keys(nova), ["captacao", "prestacao", "producao"]);
  assert.equal(nova.prestacao, anterior.prestacao);
  assert.equal(nova.producao, anterior.producao);
  assert.equal(
    nova.captacao,
    "1 + case when public.fn_org_assinatura_ativa(p_org) then coalesce( (select seats.purchased_seats from public.organization_seats seats where seats.organization_id = p_org), 0) else 0 end",
  );
});

test("as duas funções seguem fechadas ao navegador", async () => {
  const comandos = comandosDe(await migration());
  const assinaturas = [
    "fn_process_stripe_billing_event(text, text, uuid, text, text, text, text, text, text, timestamptz, timestamptz, boolean)",
    "modulo_vagas_limite(uuid, text)",
  ];
  for (const assinatura of assinaturas) {
    assert.ok(comandos.includes(`revoke execute on function public.${assinatura} from public, anon, authenticated`), assinatura);
    assert.ok(comandos.includes(`grant execute on function public.${assinatura} to service_role`), assinatura);
  }
});

test("o plano do teste de banco bate com as verificações", async () => {
  const teste = await readFile(TESTE, "utf8");
  const plano = Number(/select plan\((\d+)\);/.exec(teste)?.[1]);
  const verificacoes = teste.match(/^select (is|ok|results_eq|throws_ok|lives_ok)\(/gm) ?? [];
  assert.equal(verificacoes.length, plano);
});
