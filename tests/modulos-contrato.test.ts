import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  contratoEmVigor, contratoPago, diasEntre, fimDoTesteGratis, hojeEmBrasilia, limiteDeVagas, mensagemErroAcesso,
  situacaoDoContrato, somarDias, TESTE_GRATIS_DIAS, testeGratis, validarCortesia, type ContratoModulo,
} from "../lib/modulos-contrato";

const cortesia = (ate: string | null, vagas = 2): ContratoModulo => ({
  status: "cortesia", cortesia_ate: ate, past_due_since: null, vagas_cortesia: vagas, vagas_compradas: 0,
});

// 05/10/2026, 01h em Brasília (04h UTC): ainda é dia 5 no Brasil.
const AGORA = new Date("2026-10-05T04:00:00Z");

test("hoje é contado no horário de Brasília", () => {
  assert.equal(hojeEmBrasilia(new Date("2026-10-06T02:30:00Z")), "2026-10-05");
  assert.equal(hojeEmBrasilia(new Date("2026-10-06T03:30:00Z")), "2026-10-06");
});

test("a cortesia vale até o fim do último dia", () => {
  assert.equal(contratoEmVigor(cortesia("2026-10-05"), AGORA), true);
  assert.equal(contratoEmVigor(cortesia("2026-10-04"), AGORA), false);
  assert.equal(contratoEmVigor(cortesia(null), AGORA), true, "sem prazo continua valendo");
});

test("atraso vale durante a carência de 15 dias", () => {
  const atraso = (desde: string): ContratoModulo => ({ ...cortesia(null), status: "atraso", past_due_since: desde });
  assert.equal(contratoEmVigor(atraso("2026-09-25T00:00:00Z"), AGORA), true);
  assert.equal(contratoEmVigor(atraso("2026-09-15T00:00:00Z"), AGORA), false);
  assert.equal(contratoEmVigor({ ...cortesia(null), status: "cancelado" }, AGORA), false);
});

test("vagas: cortesia usa as vagas dela; assinatura tem 1 incluída mais as compradas", () => {
  assert.equal(limiteDeVagas(cortesia("2026-12-01", 3)), 3);
  assert.equal(limiteDeVagas({ ...cortesia(null), status: "ativo", vagas_compradas: 2 }), 3);
  assert.equal(contratoPago({ status: "atraso" }), true);
  assert.equal(contratoPago({ status: "cortesia" }), false);
  assert.equal(contratoPago(null), false);
});

test("validação do pedido de cortesia", () => {
  const ok = { ate: "2026-12-31", motivo: "Piloto com a produtora", vagas: 2 };
  assert.equal(validarCortesia(ok, 0, "2026-10-05"), null);
  assert.match(validarCortesia({ ...ok, ate: "2026-02-30" }, 0, "2026-10-05") ?? "", /data final/);
  assert.match(validarCortesia({ ...ok, ate: "2026-10-04" }, 0, "2026-10-05") ?? "", /passado/);
  assert.equal(validarCortesia({ ...ok, ate: "2026-10-05" }, 0, "2026-10-05"), null, "pode terminar hoje");
  assert.match(validarCortesia({ ...ok, ate: "2027-10-07" }, 0, "2026-10-05") ?? "", /um ano/);
  assert.match(validarCortesia({ ...ok, motivo: "  " }, 0, "2026-10-05") ?? "", /motivo/);
  assert.match(validarCortesia({ ...ok, vagas: 0 }, 0, "2026-10-05") ?? "", /vagas/);
  assert.match(validarCortesia({ ...ok, vagas: 1.5 }, 0, "2026-10-05") ?? "", /vagas/);
  assert.match(validarCortesia({ ...ok, vagas: 1 }, 2, "2026-10-05") ?? "", /reduzir/);
});

test("situação para a lista", () => {
  assert.equal(situacaoDoContrato(null, AGORA), "Sem prestação");
  assert.equal(situacaoDoContrato(cortesia("2026-11-12"), AGORA), "Cortesia até 12/11/2026");
  assert.equal(situacaoDoContrato(cortesia("2026-10-05"), AGORA), "Cortesia termina hoje");
  assert.equal(situacaoDoContrato(cortesia("2026-10-01"), AGORA), "Cortesia vencida");
  assert.equal(situacaoDoContrato(cortesia(null), AGORA), "Cortesia sem prazo");
  assert.equal(situacaoDoContrato({ ...cortesia(null), status: "cancelado" }, AGORA), "Encerrada");
  assert.equal(diasEntre("2026-10-05", "2026-10-12"), 7);
});

test("teste grátis: 45 dias contados em Brasília e situação na lista", () => {
  assert.equal(somarDias("2026-10-05", 45), "2026-11-19");
  assert.equal(somarDias("2026-12-20", 15), "2027-01-04");
  // 01h de 06/10 em UTC ainda é 05/10 em Brasília.
  assert.equal(fimDoTesteGratis(new Date("2026-10-06T01:00:00Z")), "2026-11-19");
  assert.equal(diasEntre(hojeEmBrasilia(AGORA), fimDoTesteGratis(AGORA)), TESTE_GRATIS_DIAS);

  const teste = (ate: string, status: ContratoModulo["status"] = "cortesia"): ContratoModulo => ({ ...cortesia(ate), status, teste_gratis: true });
  assert.equal(situacaoDoContrato(teste("2026-11-19"), AGORA), "Teste grátis até 19/11/2026");
  assert.equal(situacaoDoContrato(teste("2026-10-05"), AGORA), "Teste grátis termina hoje");
  assert.equal(situacaoDoContrato(teste("2026-10-04"), AGORA), "Teste grátis encerrado");
  assert.equal(situacaoDoContrato(teste("2026-10-04", "cancelado"), AGORA), "Teste grátis encerrado");
  assert.equal(situacaoDoContrato(cortesia("2026-11-19"), AGORA), "Cortesia até 19/11/2026", "cortesia do suporte não é teste");
  assert.equal(testeGratis({ ...teste("2026-11-19"), status: "ativo" }, AGORA), null, "a assinatura não é teste");
  assert.equal(testeGratis({ ...cortesia(null), teste_gratis: true }, AGORA), null, "teste sempre tem data de fim");
});

test("teste grátis: o banco usa os mesmos 45 dias e avisa no fim", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20261011110000_prestacao_teste_gratis_45_dias.sql", import.meta.url), "utf8");
  assert.match(sql, new RegExp(`\\(now\\(\\) at time zone 'America/Sao_Paulo'\\)::date \\+ ${TESTE_GRATIS_DIAS};`));
  assert.match(sql, /'modulo_teste_fim'/);
  assert.match(sql, /'modulo_teste_encerrado'/);
  assert.match(sql, /new\.status in \('ativo', 'teste', 'atraso'\)/, "a assinatura desmarca o teste");
});

test("erros da função de acesso viram texto da tela", () => {
  assert.match(mensagemErroAcesso("sem_vaga"), /vagas/);
  assert.match(mensagemErroAcesso('{"message":"captador_sem_modulo"}'), /Captadores/);
  assert.match(mensagemErroAcesso(undefined), /Tente de novo/);
});

test("P0.9: o banco segue as mesmas regras", async () => {
  const sql = await readFile("supabase/migrations/20261005120000_organization_modulos.sql", "utf8");
  const semComentarios = sql.replace(/--.*$/gm, "");
  assert.match(sql, /p_past_due_since > now\(\) - interval '15 days'/);
  assert.match(sql, /p_cortesia_ate >= \(now\(\) at time zone 'America\/Sao_Paulo'\)::date/);
  assert.match(sql, /when contrato\.status = 'cortesia' then contrato\.vagas_cortesia\s+else 1 \+ contrato\.vagas_compradas/);
  // Navegador só lê, e só o super admin; escrita pela chave de serviço.
  assert.match(sql, /revoke all on public\.organization_modulos from anon, authenticated/);
  assert.match(sql, /using \(public\.is_jards_super_admin\(\)\)/);
  assert.match(sql, /revoke execute on function public\.admin_definir_acesso_modulo\(uuid, uuid, text, boolean\) from public, anon, authenticated/);
  assert.match(sql, /cron\.schedule\('jards-prestacao-cortesias'/);
  // A notificação deduplica pela tabela inteira: a chave inclui o destinatário.
  assert.match(sql, /'modulo_cortesia_fim:' \|\| contrato\.id \|\| ':' \|\| contrato\.cortesia_ate \|\| ':' \|\| destinatario\.user_id/);
  assert.doesNotMatch(semComentarios, /\b(drop|truncate)\b/i, "sem DROP: o conector trava em comandos destrutivos");
  assert.doesNotMatch(semComentarios, /^\s*delete\s+from/im);
});

test("P0.9: mensagens cobrem os erros que a função levanta", async () => {
  const sql = await readFile("supabase/migrations/20261005120000_organization_modulos.sql", "utf8");
  for (const [, codigo] of sql.matchAll(/raise exception '([a-z_]+)'/g)) {
    assert.doesNotMatch(mensagemErroAcesso(codigo), /Tente de novo/, `erro ${codigo} sem mensagem`);
  }
});
