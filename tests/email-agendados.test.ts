import assert from "node:assert/strict";
import test from "node:test";
import { processarAgendados } from "../lib/email/agendados";
import { ErroDeEnvio } from "../lib/email/enviar";
import { bancoFalso, consultasDe, type Consulta, type Resolvedor } from "./_helpers/banco-falso";

const AGORA = new Date("2026-11-19T12:00:00Z");
const USUARIO = "11111111-1111-4111-8111-111111111111";

function item(campos: Record<string, unknown> = {}) {
  return {
    id: "ag1", user_id: USUARIO, provider: "microsoft", para: ["ana@x.com"], cc: [], cco: [], assunto: "Oi", texto: "Olá", responder_a_email_id: null, tentativas: 0, ...campos,
  };
}

const filtro = (c: Consulta, coluna: string) => c.filtros.find((f) => f[1] === coluna);

function banco({ itens = [item()], reservado = true }: { itens?: unknown[]; reservado?: boolean } = {}): { resolver: Resolvedor } {
  return {
    resolver: (c) => {
      if (c.tabela === "email_agendados" && c.acao === "select") return { data: itens };
      if (c.tabela === "email_agendados" && c.acao === "update" && filtro(c, "estado")?.[2] === "pendente") return { data: reservado ? [{ id: "ag1" }] : [] };
      if (c.tabela === "emails") return { data: { message_id: "AAMk-original", thread_id: "fio-1", internet_message_id: "<orig@x>" } };
      return undefined;
    },
  };
}

const atualizacoes = (consultas: readonly Consulta[]) => consultasDe(consultas, "email_agendados", "update").map((c) => c.valores as Record<string, unknown>);

test("envia o que venceu, reserva antes e marca como enviado", async () => {
  const { admin, consultas } = bancoFalso(banco().resolver);
  const enviados: unknown[] = [];
  const resultado = await processarAgendados(admin, AGORA, async (...args) => { enviados.push(args); });
  assert.deepEqual(resultado, { enviados: 1, falhas: 0, reagendados: 0 });
  assert.deepEqual(enviados[0], [USUARIO, "microsoft", { para: ["ana@x.com"], cc: [], cco: [], assunto: "Oi", texto: "Olá" }, null]);
  const estados = atualizacoes(consultas).map((valores) => valores.estado);
  assert.deepEqual(estados, ["pendente", "enviando", "enviado"]); // destrava presos, reserva, conclui
  const busca = consultasDe(consultas, "email_agendados", "select")[0];
  assert.deepEqual(filtro(busca, "enviar_em"), ["lte", "enviar_em", AGORA.toISOString()]);
  assert.equal(busca.limite, 20);
});

test("resposta: leva a mensagem original para o envio manter o fio", async () => {
  const { admin } = bancoFalso(banco({ itens: [item({ responder_a_email_id: "aaaaaaaa-0000-4000-8000-000000000001" })] }).resolver);
  let resposta: unknown = null;
  await processarAgendados(admin, AGORA, async (_u, _p, _pedido, r) => { resposta = r; });
  assert.deepEqual(resposta, { messageId: "AAMk-original", threadId: "fio-1", internetMessageId: "<orig@x>" });
});

test("outra rodada já reservou: não envia de novo", async () => {
  const { admin } = bancoFalso(banco({ reservado: false }).resolver);
  let chamadas = 0;
  const resultado = await processarAgendados(admin, AGORA, async () => { chamadas += 1; });
  assert.equal(chamadas, 0);
  assert.deepEqual(resultado, { enviados: 0, falhas: 0, reagendados: 0 });
});

test("falha passageira do provedor: volta para a fila em 5 minutos", async () => {
  const { admin, consultas } = bancoFalso(banco().resolver);
  const resultado = await processarAgendados(admin, AGORA, async () => { throw new ErroDeEnvio("provedor", "Serviço indisponível"); });
  assert.deepEqual(resultado, { enviados: 0, falhas: 0, reagendados: 1 });
  const ultimo = atualizacoes(consultas).at(-1)!;
  assert.equal(ultimo.estado, "pendente");
  assert.equal(ultimo.tentativas, 1);
  assert.equal(ultimo.enviar_em, "2026-11-19T12:05:00.000Z");
  assert.equal(ultimo.erro, "Serviço indisponível");
});

test("na terceira falha, desiste e guarda o motivo", async () => {
  const { admin, consultas } = bancoFalso(banco({ itens: [item({ tentativas: 2 })] }).resolver);
  const resultado = await processarAgendados(admin, AGORA, async () => { throw new ErroDeEnvio("provedor", "Serviço indisponível"); });
  assert.deepEqual(resultado, { enviados: 0, falhas: 1, reagendados: 0 });
  assert.equal(atualizacoes(consultas).at(-1)!.estado, "falhou");
});

test("sem permissão de envio ou sem conexão, falha de vez (tentar de novo não resolve)", async () => {
  for (const codigo of ["sem-permissao", "sem-conexao"] as const) {
    const { admin, consultas } = bancoFalso(banco().resolver);
    const resultado = await processarAgendados(admin, AGORA, async () => { throw new ErroDeEnvio(codigo, "Reconecte o Outlook"); });
    assert.deepEqual(resultado, { enviados: 0, falhas: 1, reagendados: 0 }, codigo);
    assert.equal(atualizacoes(consultas).at(-1)!.estado, "falhou");
  }
});
