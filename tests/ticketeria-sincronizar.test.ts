import assert from "node:assert/strict";
import test from "node:test";
import { ErroDaMeta } from "../lib/ticketeria/midia/meta";
import { emPartes, janelaDeLeitura, lerConexao, type PortasDaLeitura } from "../lib/ticketeria/midia/sincronizar";

test("a janela de leitura: o último ano na primeira vez; depois, desde 7 dias antes da última leitura", () => {
  assert.deepEqual(janelaDeLeitura(null, "2026-11-20"), { de: "2025-11-20", ate: "2026-11-20" });
  assert.deepEqual(janelaDeLeitura("2026-11-19T09:00:10Z", "2026-11-20"), { de: "2026-11-12", ate: "2026-11-20" });
  assert.deepEqual(janelaDeLeitura("2026-11-30T09:00:00Z", "2026-11-20"), { de: "2026-11-20", ate: "2026-11-20" }, "relógio adiantado: nunca pede o futuro");
});

test("em pedaços de até 90 dias, na ordem e sem furos", () => {
  assert.deepEqual(emPartes("2026-11-01", "2026-11-20"), [{ de: "2026-11-01", ate: "2026-11-20" }]);
  const partes = emPartes("2025-11-20", "2026-11-20");
  assert.equal(partes.length, 5);
  assert.deepEqual(partes[0], { de: "2025-11-20", ate: "2026-02-17" });
  assert.deepEqual(partes[1].de, "2026-02-18");
  assert.equal(partes.at(-1)?.ate, "2026-11-20");
  assert.deepEqual(emPartes("2026-11-20", "2026-11-20"), [{ de: "2026-11-20", ate: "2026-11-20" }]);
});

function portas(sobre: Partial<PortasDaLeitura> = {}) {
  const chamadas = { pedidos: [] as [string, string][], conexoes: [] as string[], marcas: [] as unknown[] };
  const p: PortasDaLeitura = {
    async token() { return "EAAB-token-de-teste-0123456789"; },
    async lerPeriodo(_t, conta, de, ate, _g, conexao) { chamadas.pedidos.push([de, ate]); chamadas.conexoes.push(conexao); assert.equal(conta, "1048771"); return 1; },
    async marcar(_c, r) { chamadas.marcas.push(r); },
    ...sobre,
  };
  return { p, chamadas };
}
const conexao = { id: "c1", conta_externa_id: "1048771", ultima_leitura_em: null };

test("a primeira leitura traz o último ano em 5 pedidos, grava cada um e marca o resultado", async () => {
  const { p, chamadas } = portas();
  assert.deepEqual(await lerConexao(p, conexao, "2026-11-20"), { ok: true, dias: 5 });
  assert.equal(chamadas.pedidos.length, 5);
  assert.deepEqual(chamadas.conexoes, ["c1", "c1", "c1", "c1", "c1"], "cada pedaço é lido e gravado para a conexão");
  assert.deepEqual(chamadas.marcas, [{ ok: true, lido_desde: "2025-11-20" }]);
});

test("uma leitura de rotina refaz só os últimos 7 dias", async () => {
  const { p, chamadas } = portas();
  assert.deepEqual(await lerConexao(p, { ...conexao, ultima_leitura_em: "2026-11-19T09:00:00Z" }, "2026-11-20"), { ok: true, dias: 1 });
  assert.deepEqual(chamadas.pedidos, [["2026-11-12", "2026-11-20"]]);
});

test("token vencido: marca a conexão com erro de token e devolve a frase", async () => {
  const { p, chamadas } = portas({ async lerPeriodo() { throw new ErroDaMeta("token", 190, null); } });
  const r = await lerConexao(p, conexao, "2026-11-20");
  assert.deepEqual(r, { ok: false, erro: "O acesso ao Meta venceu ou foi retirado. Conecte de novo.", token_invalido: true });
  assert.deepEqual(chamadas.marcas, [{ ok: false, erro: "O acesso ao Meta venceu ou foi retirado. Conecte de novo.", token_invalido: true }]);
});

test("limite de chamadas: tenta de novo amanhã, sem pôr a conexão em erro; sem token no Vault: pede para conectar de novo", async () => {
  const limite = portas({ async lerPeriodo() { throw new ErroDaMeta("limite", 17, 2446079); } });
  const r = await lerConexao(limite.p, conexao, "2026-11-20");
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.token_invalido, false);
  const semToken = portas({ async token() { return null; } });
  const r2 = await lerConexao(semToken.p, conexao, "2026-11-20");
  assert.ok(!r2.ok && r2.token_invalido);
  assert.equal(semToken.chamadas.pedidos.length, 0, "sem token não pergunta nada à Meta");
});

test("falha ao marcar o erro não esconde o erro verdadeiro", async () => {
  const { p } = portas({ async lerPeriodo() { throw new ErroDaMeta("outro", null, null); }, async marcar() { throw new Error("banco fora do ar"); } });
  const r = await lerConexao(p, conexao, "2026-11-20");
  assert.ok(!r.ok && /Não foi possível ler o Meta/.test(r.erro));
});
