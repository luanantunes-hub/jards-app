import assert from "node:assert/strict";
import test from "node:test";
import { comprasPorPessoa, compraramNoUltimoAno, diaCombina, efeitoDoEnvio, efeitoPorTipo, ingressosDeQuemRecebeu, porLimite, porPreferencias, soUltimoAno, sortearComparacao, tipoNoDia, type EfeitoPorTipo } from "../lib/ticketeria/envios-controle";
import { acaoDoEnvio, emailDeDivulgacao, lerEnvio } from "../lib/ticketeria/envios";

// O grupo de comparação dos envios, o limite por semana, as preferências e o que o e-mail trouxe a mais.

let s = 7;
const aleatorio = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
const pessoas = (n: number, prefixo = "p") => Array.from({ length: n }, (_, i) => ({ email: `${prefixo}${i}@x.com`, nome: `P${i}` }));

test("sorteio: 10% no grupo de comparação, ninguém nos dois lados; pequeno ou desligado, todos recebem", () => {
  const r = sortearComparacao(pessoas(300), true, aleatorio);
  assert.equal(r.comparacao.length, 30);
  assert.equal(r.enviar.length, 270);
  assert.equal(new Set([...r.enviar, ...r.comparacao].map(p => p.email)).size, 300);
  assert.equal(sortearComparacao(pessoas(40), true, aleatorio).comparacao.length, 0, "menos de 50: sem comparação");
  assert.equal(sortearComparacao(pessoas(300), false, aleatorio).enviar.length, 300);
});

test("limite por semana e preferências", () => {
  const ps = pessoas(4);
  assert.deepEqual(porLimite(ps, new Map([["p0@x.com", 3], ["p1@x.com", 2]]), 3).fora, 1);
  const prefs = new Map([["p0@x.com", { frequencia: "menos" as const, dias: "qualquer" as const }], ["p1@x.com", { frequencia: "parecidos" as const, dias: "qualquer" as const }], ["p2@x.com", { frequencia: "tudo" as const, dias: "fim_de_semana" as const }]]);
  // Sessão numa quarta (3): p2 só quer fim de semana; p1 só parecidos (não está); p0 recebeu há 10 dias e quer menos.
  const r = porPreferencias(ps, prefs, { diaDaSemanaDaSessao: 3, parecidos: new Set(), ultimoRecebido: new Map([["p0@x.com", "2026-11-13"]]), hoje: "2026-11-23" });
  assert.deepEqual(r.dentro.map(p => p.email), ["p3@x.com"]);
  assert.equal(r.fora, 3);
  assert.equal(diaCombina("fim_de_semana", 5), true, "sexta conta como fim de semana");
  assert.equal(diaCombina("semana", 6), false);
});

const compras = comprasPorPessoa([
  ...Array.from({ length: 30 }, (_, i) => ({ email: `r${i}@x.com`, dia: "2026-01-20", quantidade: i < 15 ? 2 : 0 })),
  ...Array.from({ length: 30 }, (_, i) => ({ email: `c${i}@x.com`, dia: "2026-01-20", quantidade: i < 3 ? 2 : 0 })),
  { email: "r0@x.com", dia: "2025-12-01", quantidade: 1 },
]);

test("o que o envio trouxe a mais: diferença por pessoa entre quem recebeu e o grupo de comparação, em 90 dias", () => {
  const e = { dia: "2026-01-10", recebeu: Array.from({ length: 30 }, (_, i) => `r${i}@x.com`), comparacao: Array.from({ length: 30 }, (_, i) => `c${i}@x.com`) };
  const r = efeitoDoEnvio(e, compras, "2026-05-01");
  // Quem recebeu: 30 ingressos (15 × 2) em 30 pessoas; comparação: 6 em 30 → 0,8 por pessoa a mais × 30 = 24.
  assert.equal(r.tipo, "efeito");
  assert.ok(r.tipo === "efeito" && r.ingressos === 24 && r.baixo > 0 && r.alto > r.ingressos);
  assert.deepEqual(efeitoDoEnvio(e, compras, "2026-02-01"), { tipo: "medindo", faltam: 68 });
  assert.deepEqual(efeitoDoEnvio({ ...e, comparacao: [] }, compras, "2026-05-01"), { tipo: "sem_comparacao" });
  assert.equal(ingressosDeQuemRecebeu(e.dia, e.recebeu, compras), 30);
  assert.equal(efeitoDoEnvio({ ...e, recebeu: e.comparacao }, compras, "2026-05-01").tipo, "sem_diferenca");
});

test("tipo de público pela última compra antes do envio, e o efeito por tipo somando envios", () => {
  assert.equal(tipoNoDia(compras.get("r0@x.com"), "2026-01-10"), "recente");
  assert.equal(tipoNoDia([{ dia: "2025-03-01" }], "2026-01-10"), "ano");
  assert.equal(tipoNoDia([{ dia: "2024-03-01" }], "2026-01-10"), "antigo");
  assert.equal(tipoNoDia(undefined, "2026-01-10"), "nunca");
  const e = { dia: "2026-01-10", recebeu: Array.from({ length: 30 }, (_, i) => `r${i}@x.com`), comparacao: Array.from({ length: 30 }, (_, i) => `c${i}@x.com`) };
  const r = efeitoPorTipo([e], compras, "2026-05-01");
  assert.equal(r.envios, 1);
  const nunca = r.tipos.find(t => t.tipo === "nunca")!;
  assert.ok(nunca.porCem > 0 && nunca.pesa, "quase todos são 'nunca' aqui, e o e-mail trouxe a mais");
  assert.equal(efeitoPorTipo([e], compras, "2026-02-01").envios, 0, "ainda medindo: não entra");
  assert.equal(compraramNoUltimoAno("r0@x.com", compras, "2026-01-10"), true);
  assert.equal(compraramNoUltimoAno("r5@x.com", compras, "2026-01-10"), false);
});

test("só para quem comprou no último ano: parte do efeito e e-mails a menos; nula quando quem sumiu também responde", () => {
  const t = (tipo: EfeitoPorTipo["tipo"], porCem: number, pesa: boolean): EfeitoPorTipo => ({ tipo, pessoas: 100, porCem, baixo: pesa ? 1 : -1, alto: porCem + 1, pesa });
  const tipos = [t("recente", 3.1, true), t("ano", 1.5, true), t("antigo", 0.2, false), t("nunca", 0, false)];
  assert.deepEqual(soUltimoAno(tipos, { recente: 4210, ano: 6580, antigo: 2930, nunca: 1120 }), { parteDoEfeito: 0.98, menosEmails: 0.27 });
  assert.equal(soUltimoAno([...tipos.slice(0, 2), t("antigo", 2, true), t("nunca", 0, false)], { recente: 1, ano: 1, antigo: 1, nunca: 1 }), null);
  assert.equal(soUltimoAno([t("recente", -1, false), t("ano", 0, false), t("antigo", 0, false), t("nunca", 0, false)], { recente: 1, ano: 1, antigo: 1, nunca: 1 }), null);
});

test("envio: comparação ligada por padrão, só último ano opcional; {nome} no assunto vira o nome e some da ação do link", () => {
  const base = { assunto: "{nome}, últimas vagas", mensagem: "Oi", sessao_id: "11111111-1111-1111-1111-111111111111", segmento: "aceitaram" };
  const r = lerEnvio(base);
  assert.ok(r.ok && r.envio.comparacao === true && r.envio.soUltimoAno === false);
  const r2 = lerEnvio({ ...base, comparacao: false, so_ultimo_ano: true });
  assert.ok(r2.ok && r2.envio.comparacao === false && r2.envio.soUltimoAno === true);
  const e = emailDeDivulgacao({ loja: "Teatro", nome: "Rita Souza", assunto: "{nome}, últimas vagas", mensagem: "Oi", enderecoDeCompra: "https://x.com/c", enderecoParaSair: "https://x.com/s" });
  assert.equal(e.assunto, "Rita, últimas vagas");
  assert.equal(emailDeDivulgacao({ loja: "T", nome: "", assunto: "{nome}, últimas vagas", mensagem: "Oi", enderecoDeCompra: "https://x.com/c", enderecoParaSair: "https://x.com/s" }).assunto, "últimas vagas");
  assert.match(acaoDoEnvio("{nome}, últimas vagas", new Date("2026-11-20T12:00:00Z")), /^ultimas-vagas-20-11$/);
});
