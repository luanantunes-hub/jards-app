import assert from "node:assert/strict";
import test from "node:test";
import { compradoresPorEvento, eventosEmComum, historicoDoArtista, normalizarArtista, segmentoEmComum } from "../lib/ticketeria/publico-em-comum";
import { parecidoCom, type CurvaDoEvento } from "../lib/ticketeria/ritmo-comparado";
import { destinatariosDoSegmento, lerEnvio } from "../lib/ticketeria/envios";
import { lerEvento } from "../lib/ticketeria/eventos";

const A = "aaaaaaaa-0000-4000-8000-000000000001", B = "bbbbbbbb-0000-4000-8000-000000000002", C = "cccccccc-0000-4000-8000-000000000003";

test("público em comum: de quem comprou o evento, a parte que também comprou o outro", () => {
  const sessao = { s1: A, s2: A, s3: B, s4: C };
  const pedidos = [
    ...["ana", "bia", "caio", "dani"].map(n => ({ comprador_email: `${n}@x.com`, sessao_id: "s1" })),
    { comprador_email: "ANA@x.com ", sessao_id: "s2" },
    { comprador_email: "ana@x.com", sessao_id: "s3" }, { comprador_email: "bia@x.com", sessao_id: "s3" }, { comprador_email: "zeca@x.com", sessao_id: "s3" },
    { comprador_email: "caio@x.com", sessao_id: "s4" },
  ];
  const c = compradoresPorEvento(pedidos, sessao);
  assert.equal(c.get(A)?.size, 4, "o mesmo e-mail em duas sessões conta uma vez");
  assert.deepEqual(eventosEmComum(c, A), [{ eventoId: B, emComum: 2, parte: 0.5 }, { eventoId: C, emComum: 1, parte: 0.25 }]);
  assert.deepEqual(eventosEmComum(c, "nada"), []);
});

test("o artista se compara sem acento, maiúscula ou espaço; o histórico só traz o que já aconteceu, do mais recente", () => {
  assert.equal(normalizarArtista("  Cia.  Atores de MAR "), "cia atores de mar");
  assert.equal(normalizarArtista(null), "");
  const eventos = [
    { eventoId: "1", titulo: "Ricardo III", artista: "Cia. Atores de Mar", ultimoDia: "2025-08-10", lotacao: 1 },
    { eventoId: "2", titulo: "O Avarento", artista: "cia atores de mar", ultimoDia: "2024-03-01", lotacao: 0.82 },
    { eventoId: "3", titulo: "Hamlet", artista: "Cia. Atores de Mar", ultimoDia: "2027-01-01", lotacao: 0.3 },
    { eventoId: "4", titulo: "Outra", artista: "Outra Cia", ultimoDia: "2025-01-01", lotacao: 0.5 },
  ];
  assert.deepEqual(historicoDoArtista(eventos, "Cia Atores de Mar", "3", "2026-11-23").map(e => [e.titulo, e.lotacao]), [["Ricardo III", 1], ["O Avarento", 0.82]]);
  assert.deepEqual(historicoDoArtista(eventos, "", null, "2026-11-23"), []);
});

test("com compradores suficientes, parecido é quem divide 10% ou mais do público (e vendeu); sem, vale local e preço", () => {
  const curva = (o: Partial<CurvaDoEvento>): CurvaDoEvento => ({ id: "c", nome: "X", quando: "", local: "Outro", localId: "L2", precoMedioCentavos: 20000, lugares: 100, acumulado: [80], ...o });
  const atual = { id: "atual", localId: "L1", precoMedioCentavos: 5000, compradores: 40 };
  assert.deepEqual(parecidoCom(atual, curva({ publicoEmComum: 0.38 })), { parecido: true }, "outro local e outro preço, mas mesmo público");
  assert.deepEqual(parecidoCom(atual, curva({ publicoEmComum: 0.03 })), { parecido: false, motivo: "só 3% de público em comum" });
  assert.deepEqual(parecidoCom(atual, curva({ publicoEmComum: 0.5, acumulado: [5] })), { parecido: false, motivo: "vendeu pouco" });
  assert.deepEqual(parecidoCom({ ...atual, compradores: 5 }, curva({ publicoEmComum: 0.38 })), { parecido: false, motivo: "outro local" }, "poucos compradores: regra antiga");
});

test("o envio 'foram a A e não compraram B' só vai para quem aceitou novidades, comprou A e não comprou B", () => {
  assert.ok(lerEnvio({ canal: "email", assunto: "Oi", mensagem: "Oi", sessao_id: A, segmento: segmentoEmComum(A, B) }).ok);
  assert.ok(!lerEnvio({ canal: "email", assunto: "Oi", mensagem: "Oi", sessao_id: A, segmento: `evento:${A}:sem:x` }).ok);
  const pedido = (email: string, sessao: string, aceitou: boolean) => ({ id: `${email}-${sessao}`, sessao_id: sessao, comprador_nome: email, comprador_email: email, comprador_whatsapp: null, novidades_aceitas_em: aceitou ? "2026-01-01T00:00:00Z" : null, novidades_versao: aceitou ? "v" : null, pago_em: "2026-01-01T00:00:00Z", origem_canal: null } as never);
  const entrada = {
    pedidos: [pedido("ana@x.com", "s1", true), pedido("bia@x.com", "s1", true), pedido("bia@x.com", "s2", true), pedido("caio@x.com", "s1", false)],
    quantidadePorPedido: {}, espera: [], eventoDaSessao: { s1: "Hamlet", s2: "Ricardo" }, eventoIdDaSessao: { s1: A, s2: B }, saidas: [], importados: [],
  };
  assert.deepEqual(destinatariosDoSegmento(entrada as never, segmentoEmComum(A, B)).map(d => d.email), ["ana@x.com"]);
});

test("o artista do evento: até 120 letras, vazio apaga, ausente não mexe", () => {
  const base = { titulo: "Hamlet", descricao: "", imagem: "", classificacao: "" };
  const com = lerEvento({ ...base, artista: "  Cia. Atores de Mar " });
  assert.ok(com.ok && com.valor.artista === "Cia. Atores de Mar");
  const vazio = lerEvento({ ...base, artista: "" });
  assert.ok(vazio.ok && vazio.valor.artista === null);
  const sem = lerEvento(base);
  assert.ok(sem.ok && !("artista" in sem.valor));
  assert.ok(!lerEvento({ ...base, artista: "x".repeat(121) }).ok);
});
