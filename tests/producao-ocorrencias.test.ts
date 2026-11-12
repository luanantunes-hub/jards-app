import assert from "node:assert/strict";
import test from "node:test";
import { lerOcorrencia, ordenarOcorrencias, resumoDasOcorrencias } from "../lib/producao/ocorrencias";

const base = { tipo: "tecnica", gravidade: "media", descricao: "A mesa de som caiu", providencia: "" };

test("ocorrência: descrição obrigatória, providência opcional, listas fechadas", () => {
  const leitura = lerOcorrencia({ ...base, descricao: "  A mesa de som caiu  ", providencia: " Troca pela reserva " });
  assert.deepEqual(leitura.ok && leitura.ocorrencia, { tipo: "tecnica", gravidade: "media", descricao: "A mesa de som caiu", providencia: "Troca pela reserva" });
  assert.equal(lerOcorrencia(base).ok && (lerOcorrencia(base) as { ocorrencia: { providencia: string | null } }).ocorrencia.providencia, null);
  const erro = (campos: Partial<typeof base>) => { const l = lerOcorrencia({ ...base, ...campos }); return l.ok ? null : l.erro; };
  assert.match(erro({ tipo: "alienigena" }) ?? "", /tipo/);
  assert.match(erro({ gravidade: "enorme" }) ?? "", /gravidade/);
  assert.match(erro({ descricao: " " }) ?? "", /Conte/);
  assert.match(erro({ descricao: "x".repeat(2001) }) ?? "", /2\.000/);
  assert.match(erro({ providencia: "x".repeat(1001) }) ?? "", /1\.000/);
});

test("ordem: abertas primeiro, a mais grave antes; resolvidas por último; a mais recente antes dentro do grupo", () => {
  const lista = [
    { id: "r", gravidade: "alta" as const, resolvida: true, ocorreu_em: "2026-12-05T20:00:00Z" },
    { id: "baixa", gravidade: "baixa" as const, resolvida: false, ocorreu_em: "2026-12-05T21:00:00Z" },
    { id: "alta-antiga", gravidade: "alta" as const, resolvida: false, ocorreu_em: "2026-12-05T18:00:00Z" },
    { id: "alta-nova", gravidade: "alta" as const, resolvida: false, ocorreu_em: "2026-12-05T19:00:00Z" },
    { id: "media", gravidade: "media" as const, resolvida: false, ocorreu_em: "2026-12-05T22:00:00Z" },
  ];
  assert.deepEqual(ordenarOcorrencias(lista).map(item => item.id), ["alta-nova", "alta-antiga", "media", "baixa", "r"]);
});

test("resumo: abertas e altas abertas", () => {
  assert.deepEqual(resumoDasOcorrencias([{ gravidade: "alta", resolvida: false }, { gravidade: "alta", resolvida: true }, { gravidade: "baixa", resolvida: false }]), { abertas: 2, altasAbertas: 1, total: 3 });
  assert.deepEqual(resumoDasOcorrencias([]), { abertas: 0, altasAbertas: 0, total: 0 });
});
