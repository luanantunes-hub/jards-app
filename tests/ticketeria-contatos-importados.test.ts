import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ImportarContatosSheet } from "../components/ticketeria/ImportarContatosSheet";
import { PublicoDaLoja } from "../components/ticketeria/PublicoView";
import { MAX_CONTATOS_POR_IMPORTACAO, VERSAO_DA_DECLARACAO, adivinharColunasDeContatos, lerContatos, lerCorpoDaImportacaoDeContatos, nomeDoContato, textoDaDeclaracao } from "../lib/ticketeria/contatos-importados";
import { SEGMENTO_TODOS, destinatariosDoSegmento, segmentosDoPublico, type EntradaParaEnvio } from "../lib/ticketeria/envios";
import { filtrarPublico, montarPublico, recebeNovidades } from "../lib/ticketeria/publico";

test("as colunas: o e-mail vem primeiro e cada coluna serve a um campo só", () => {
  assert.deepEqual(adivinharColunasDeContatos(["Nome completo", "E-mail", "Celular"]), { nome: 0, email: 1, whatsapp: 2 });
  assert.deepEqual(adivinharColunasDeContatos(["Name", "Email", "Phone"]), { nome: 0, email: 1, whatsapp: 2 });
  assert.deepEqual(adivinharColunasDeContatos(["E-mail do contato", "Telefone"]), { nome: null, email: 0, whatsapp: 1 }, "'contato' no e-mail não vira o nome");
  assert.deepEqual(adivinharColunasDeContatos(["A", "B"]), { nome: null, email: null, whatsapp: null });
});

test("ler os contatos: e-mail válido e único, nome limpo, WhatsApp do Brasil; o que não serve é contado", () => {
  const mapa = { nome: 0, email: 1, whatsapp: 2 };
  const r = lerContatos([
    ["  Rita   Almeida ", "Rita@Email.com ", "(15) 99712-4410"],
    ["Rita de novo", "rita@email.com", ""],
    ["", "carlos@email.com", "123"],
    ["Sem e-mail", "", ""],
    ["Torto", "sem-arroba", ""],
    ["", "", ""],
    ["Joana", "joana@email.com", ""],
  ], mapa);
  assert.deepEqual(r.contatos, [
    { nome: "Rita Almeida", email: "rita@email.com", whatsapp: "5515997124410" },
    { nome: "carlos", email: "carlos@email.com", whatsapp: null },
    { nome: "Joana", email: "joana@email.com", whatsapp: null },
  ]);
  assert.equal(r.lidas, 6, "a linha vazia não conta");
  assert.equal(r.repetidos, 1);
  assert.equal(r.whatsapp_invalidos, 1, "o número torto entra sem o número");
  assert.deepEqual(r.problemas, [{ linha: 5, motivo: "sem_email" }, { linha: 6, motivo: "email_invalido" }]);
  assert.equal(r.problemas_total, 2);
  assert.equal(lerContatos([["a"]], { nome: null, email: null, whatsapp: null }).contatos.length, 0, "sem coluna de e-mail não lê nada");
  assert.equal(nomeDoContato("   ", "maria.silva@x.com"), "maria.silva");
});

test("o limite por importação: o resto fica de fora e a tela avisa", () => {
  const linhas = Array.from({ length: MAX_CONTATOS_POR_IMPORTACAO + 3 }, (_, i) => [`p${i}@x.com`]);
  const r = lerContatos(linhas, { nome: null, email: 0, whatsapp: null });
  assert.equal(r.contatos.length, MAX_CONTATOS_POR_IMPORTACAO);
  assert.equal(r.passou_do_limite, true);
});

test("o corpo no servidor: conferido de novo, e-mail torto recusa tudo, repetidos somem, declaração só com true", () => {
  const ok = lerCorpoDaImportacaoDeContatos({ arquivo: " contatos\n.csv ", declaro: true, contatos: [{ nome: "Rita", email: "RITA@x.com", whatsapp: "(15) 99712-4410" }, { nome: "x", email: "rita@x.com" }, { email: "b@x.com", whatsapp: "5511988887777" }] });
  assert.ok(ok.ok);
  if (ok.ok) assert.deepEqual(ok.corpo, { arquivo: "contatos.csv", declaro: true, contatos: [{ nome: "Rita", email: "rita@x.com", whatsapp: "5515997124410" }, { nome: "b", email: "b@x.com", whatsapp: "5511988887777" }] });
  const sem = lerCorpoDaImportacaoDeContatos({ declaro: "true", contatos: [{ email: "a@x.com" }] });
  assert.ok(sem.ok && sem.corpo.declaro === false && sem.corpo.arquivo === "planilha", "só true vale");
  for (const ruim of [null, {}, { contatos: [] }, { contatos: "x" }, { contatos: [{ email: "torto" }] }, { contatos: [{}] }, { contatos: Array.from({ length: MAX_CONTATOS_POR_IMPORTACAO + 1 }, (_, i) => ({ email: `p${i}@x.com` })) }]) assert.equal(lerCorpoDaImportacaoDeContatos(ruim).ok, false);
  assert.match(VERSAO_DA_DECLARACAO, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(textoDaDeclaracao("Cia").includes("Cia"));
});

const SESSAO_E = "0d760000-0000-4000-8000-0000000000a1";
const entrada: EntradaParaEnvio = {
  pedidos: [{ id: "p1", sessao_id: "s1", comprador_nome: "Rita", comprador_email: "rita@email.com", comprador_whatsapp: null, novidades_aceitas_em: null, pago_em: "2026-11-10T12:00:00Z", created_at: "2026-11-10T12:00:00Z" }],
  quantidadePorPedido: { p1: 1 }, espera: [{ sessao_id: "s1", nome: "Bia", email: "bia@email.com", created_at: "2026-11-09T12:00:00Z" }],
  eventoDaSessao: { s1: "Hamlet" }, eventoIdDaSessao: { s1: SESSAO_E }, saidas: ["paulo@email.com"],
  importados: [
    { email: "marcos@email.com", nome: "Marcos", whatsapp: "5515997124410", arquivo: "lista.xlsx", declarado_em: "2026-11-21T12:00:00Z", created_at: "2026-11-21T12:00:00Z" },
    { email: "sem@email.com", nome: "Sem Aceite", whatsapp: "5511988887777", arquivo: "lista.xlsx", declarado_em: null, created_at: "2026-11-21T12:00:00Z" },
    { email: "rita@email.com", nome: "Rita (planilha)", whatsapp: "5515911112222", arquivo: "lista.xlsx", declarado_em: "2026-11-21T12:00:00Z", created_at: "2026-11-21T12:00:00Z" },
    { email: "bia@email.com", nome: "Bia", whatsapp: null, arquivo: "lista.xlsx", declarado_em: "2026-11-21T12:00:00Z", created_at: "2026-11-21T12:00:00Z" },
    { email: "paulo@email.com", nome: "Paulo", whatsapp: null, arquivo: "lista.xlsx", declarado_em: "2026-11-21T12:00:00Z", created_at: "2026-11-21T12:00:00Z" },
  ],
};

test("o Público com importados: declarado recebe, sem declaração não; quem já era de compra ou espera continua com a origem; quem saiu segue fora", () => {
  const { contatos, resumo } = montarPublico(entrada);
  const por = (email: string) => contatos.find(c => c.email === email)!;
  assert.deepEqual([por("marcos@email.com").veio_de, por("marcos@email.com").novidades, por("marcos@email.com").whatsapp, por("marcos@email.com").evento], ["importado", "declarado", "5515997124410", "lista.xlsx"]);
  assert.deepEqual([por("sem@email.com").novidades, por("sem@email.com").whatsapp], ["sem_aceite", null], "sem declaração: sem aceite e o número nem aparece");
  assert.deepEqual([por("rita@email.com").veio_de, por("rita@email.com").nome, por("rita@email.com").novidades], ["compra", "Rita", "declarado"], "a compra manda na origem e no nome; a declaração vale como aceite");
  assert.equal(por("rita@email.com").whatsapp, "5515911112222");
  assert.deepEqual([por("bia@email.com").veio_de, por("bia@email.com").novidades], ["espera", "declarado"]);
  assert.equal(por("paulo@email.com").novidades, "saiu", "quem saiu da lista segue fora, declarado ou não");
  assert.deepEqual(resumo, { contatos: 5, aceitaram: 3, aceitaram_porcento: 60, com_whatsapp: 2, sairam: 1 });
  assert.equal(recebeNovidades({ novidades: "declarado" }), true);
  assert.equal(recebeNovidades({ novidades: "so_espera" }), false);
  assert.deepEqual(filtrarPublico(contatos, "importados", "").map(c => c.email).sort(), ["marcos@email.com", "paulo@email.com", "sem@email.com"]);
  assert.deepEqual(filtrarPublico(contatos, "aceitaram", "").map(c => c.email).sort(), ["bia@email.com", "marcos@email.com", "rita@email.com"]);
});

test("os envios: o declarado entra em 'todos que aceitaram'; quem não declarou, não; o segmento de evento exige a compra", () => {
  assert.deepEqual(destinatariosDoSegmento(entrada, SEGMENTO_TODOS).map(d => d.email).sort(), ["bia@email.com", "marcos@email.com", "rita@email.com"]);
  assert.deepEqual(destinatariosDoSegmento(entrada, `evento:${SESSAO_E}`).map(d => d.email), ["rita@email.com"], "o evento é de quem comprou");
  assert.equal(segmentosDoPublico(entrada)[0].total, 3);
});

test("a folha de importar: o arquivo, as colunas, a prévia e a declaração (desmarcada de início)", () => {
  const arquivo = { nome: "contatos.csv", cabecalho: ["Nome", "E-mail", "WhatsApp"], linhas: [["Rita", "rita@x.com", "(15) 99712-4410"], ["Rita", "rita@x.com", ""], ["Torto", "torto", ""]], truncado: false };
  const h = renderToStaticMarkup(createElement(ImportarContatosSheet, { loja: "Cia Atores de Mar", arquivoInicial: arquivo, onClose() {} }));
  for (const t of ["Importar planilha", "contatos.csv", "Onde está cada coisa", "rita@x.com", "+5515997124410", "1 contato para importar", "1 repetido na planilha", "1 linha ficou de fora", "Declaro que estas pessoas aceitaram receber novidades e ofertas de Cia Atores de Mar", "Sem a declaração, as pessoas entram no Público, mas não recebem nenhum envio", "Importar 1 contato"]) assert.ok(h.includes(t), t);
  assert.doesNotMatch(h, /type="checkbox"[^>]*checked/, "a declaração começa desmarcada");
  const marcada = renderToStaticMarkup(createElement(ImportarContatosSheet, { loja: "Cia", arquivoInicial: arquivo, declaroInicial: true, onClose() {} }));
  assert.match(marcada, /type="checkbox"[^>]*checked/);
  assert.ok(!marcada.includes("Sem a declaração"), "marcada: sem o aviso");
  const vazio = renderToStaticMarkup(createElement(ImportarContatosSheet, { loja: "Cia", onClose() {} }));
  assert.ok(vazio.includes("Escolher arquivo") && vazio.includes("Baixar o modelo"));
  assert.ok(!vazio.includes("Declaro"), "sem arquivo, sem declaração");
});

test("a tela do Público: origem Importado e a etiqueta de declarado; a rota só para quem edita e a migration só do servidor", async () => {
  const { contatos, resumo } = montarPublico(entrada);
  const h = renderToStaticMarkup(createElement(PublicoDaLoja, { resumo, contatos, filtro: "todos", busca: "" }));
  for (const t of ["Importado · lista.xlsx", "DECLARADO POR VOCÊ", "SEM ACEITE", "SAIU DA LISTA", "Importados"]) assert.ok(h.includes(t), t);
  const rota = await readFile("app/api/ticketeria/lojas/[id]/publico/importar/route.ts", "utf8");
  assert.match(rota, /autorizarLoja/);
  assert.match(rota, /VERSAO_DA_DECLARACAO/);
  assert.match(rota, /corpo\.declaro \? \{ novidades_declaradas_em/);
  const sql = (await readFile("supabase/migrations/20261125400000_ticketeria_contatos_importados.sql", "utf8")).replace(/--.*$/gm, "");
  assert.match(sql, /revoke insert, update, delete on public\.ticketeria_contatos_importados from authenticated/);
  assert.doesNotMatch(sql, /\bdrop\b/i);
});
