import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { VersoesSheet } from "../components/ticketeria/VersoesDoSite";
import { ORIGENS_DA_VERSAO } from "../lib/ticketeria/estados";
import type { Bloco } from "../lib/ticketeria/site";
import { avisoDeRestaurado, lerVersoes, linhasDasVersoes, mensagemDoErroDeRestaurar, quandoDaVersao, resumoDosBlocos } from "../lib/ticketeria/versoes-site";

// O histórico de versões das páginas do site (construtor, passo 4). Desenho aprovado pelo dono em 20/11/2026.

const AGORA = Date.parse("2026-11-20T18:00:00Z"); // 15h em Brasília
const t = (texto: string): Bloco => ({ tipo: "titulo", texto });

test("as origens da lista fechada do banco são as da tela", () => {
  assert.deepEqual([...ORIGENS_DA_VERSAO], ["publicada", "rascunho_guardado"]);
});

test("a hora da versão: hoje, ontem ou o dia, no fuso de Brasília", () => {
  assert.equal(quandoDaVersao("2026-11-20T17:02:00Z", AGORA), "Hoje, 14:02");
  assert.equal(quandoDaVersao("2026-11-19T13:15:00Z", AGORA), "Ontem, 10:15");
  assert.equal(quandoDaVersao("2026-11-18T19:40:00Z", AGORA), "18/11, 16:40");
  assert.equal(quandoDaVersao("2026-11-21T02:30:00Z", Date.parse("2026-11-21T02:45:00Z")), "Hoje, 23:30", "02:30 UTC ainda é dia 20 em Brasília");
});

test("o resumo dos blocos: quantos e os três primeiros, com reticências quando há mais", () => {
  assert.equal(resumoDosBlocos([]), "página vazia");
  assert.equal(resumoDosBlocos([t("a")]), "1 bloco · Título");
  assert.equal(resumoDosBlocos([t("a"), { tipo: "texto", texto: "b" }, { tipo: "ingressos", titulo: "", evento_id: null }]), "3 blocos · Título, Texto, Ingressos");
  assert.equal(resumoDosBlocos([{ tipo: "capa", layout: "tela_cheia", titulo: "x", subtitulo: "", imagem: "", botao_rotulo: "", botao_url: "", botao2_rotulo: "", botao2_url: "", chamada: "", info: "", slides: [] }, t("a"), { tipo: "faq", titulo: "", itens: [{ pergunta: "p", resposta: "r" }] }, t("b"), t("c"), t("d")]), "6 blocos · Destaque do alto, Título, Perguntas…");
});

test("a lista: mais novas primeiro, só as 20 mais recentes, blocos lidos como o site os lê, e linha estranha some", () => {
  const linha = (n: number, origem = "publicada") => ({ id: `v${n}`, origem, blocos: [{ tipo: "titulo", texto: `T${n}` }, { tipo: "video", url: "https://mau.com/x" }], created_at: new Date(AGORA - n * 3_600_000).toISOString() });
  const l = lerVersoes([linha(3), linha(1), linha(2, "rascunho_guardado"), { ...linha(4), origem: "outra" }, { ...linha(5), id: 7 }, null, "x"]);
  assert.deepEqual(l.map(v => v.id), ["v1", "v2", "v3"]);
  assert.equal(l[0].blocos.length, 1, "o bloco que não passa na leitura some");
  assert.equal(lerVersoes(Array.from({ length: 30 }, (_, n) => linha(n + 1))).length, 20);
  assert.deepEqual(lerVersoes(null), []);
});

test("as linhas: a mais nova igual ao que está no ar leva NO AR AGORA, e o rascunho guardado tem texto próprio", () => {
  const v = (id: string, origem: "publicada" | "rascunho_guardado", textos: string[], horas: number) => ({ id, origem, blocos: textos.map(t2 => t(t2)), created_at: new Date(AGORA - horas * 3_600_000).toISOString() });
  const lista = [v("a", "publicada", ["A", "B"], 1), v("b", "rascunho_guardado", ["Z"], 5), v("c", "publicada", ["A", "B"], 30)];
  const linhas = linhasDasVersoes(lista, [t("A"), t("B")], AGORA);
  assert.deepEqual(linhas.map(l => l.noAr), [true, false, false], "só a mais nova das iguais ao ar");
  assert.equal(linhas[0].titulo, "Hoje, 14:02".replace("14:02", "14:00"));
  assert.equal(linhas[0].subtitulo, "2 blocos · Título, Título");
  assert.deepEqual([linhas[1].guardada, linhas[1].titulo], [true, "Rascunho guardado · hoje, 10:00"]);
  assert.match(linhas[1].subtitulo, /1 bloco · Título · guardado antes de restaurar outra versão/);
  assert.deepEqual(linhasDasVersoes(lista, null, AGORA).map(l => l.noAr), [false, false, false], "sem nada publicado, nenhuma está no ar");
  assert.deepEqual(linhasDasVersoes(lista, [t("outro")], AGORA).map(l => l.noAr), [false, false, false], "conteúdo diferente do que está no ar: nenhuma");
});

test("as frases: erro de restaurar e o aviso depois", () => {
  assert.match(mensagemDoErroDeRestaurar({ code: "42501" }), /não pode mudar/);
  assert.match(mensagemDoErroDeRestaurar({ message: "sem_permissao" }), /não pode mudar/);
  assert.match(mensagemDoErroDeRestaurar({ code: "P0002" }), /não existe mais/);
  assert.match(mensagemDoErroDeRestaurar({ message: "x" }), /Tente de novo/);
  assert.equal(avisoDeRestaurado("Ontem, 10:15", true), "O rascunho agora é a versão de ontem, 10:15. O que está no ar não mudou até você publicar. O rascunho de antes ficou guardado em Versões.");
  assert.equal(avisoDeRestaurado("Ontem, 10:15", false), "O rascunho agora é a versão de ontem, 10:15. O que está no ar não mudou até você publicar.");
});

test("a folha monta com o título, a explicação e o Fechar (a lista chega depois, no navegador)", () => {
  const html = renderToStaticMarkup(createElement(VersoesSheet, { paginaId: "p1", titulo: "Início", publicados: null, podeEditar: true, onClose: () => {}, onRestaurado: () => {} }));
  for (const t2 of ["Versões da página", "Início · volte a uma versão que já esteve no ar", "Ficam as 20 mais recentes", "Carregando…", "Fechar"]) assert.ok(html.includes(t2), t2);
});

test("o editor tem o botão Versões (só para quem edita) e mostra o aviso depois de restaurar", () => {
  const codigo = readFileSync("components/ticketeria/EditorDoSite.tsx", "utf8");
  for (const t2 of ["VersoesSheet", ">Versões</button>", 'tipo: "versoes"', "onRestaurado={mensagem => { setAviso(mensagem); recarregar(); }}", 'role="status"']) assert.ok(codigo.includes(t2), t2);
  assert.match(codigo, /podeEditar && <button type="button" onClick=\{\(\) => setFolha\(\{ tipo: "versoes" \}\)\}/);
  const folha = readFileSync("components/ticketeria/VersoesDoSite.tsx", "utf8");
  for (const t2 of ["Restaurar no rascunho", "fn_ticketeria_site_restaurar_versao", "NO AR AGORA", "O que está no ar não muda até você publicar, e o rascunho de agora fica guardado nesta lista"]) assert.ok(folha.includes(t2), t2);
  assert.doesNotMatch(folha, /from "node:|server-only/, "roda no navegador");
});

test("a migration guarda a versão ao publicar, apara em 20, restaura no rascunho e nada é escrito direto pela tela", () => {
  const sql = readFileSync("supabase/migrations/20261123400000_ticketeria_site_versoes.sql", "utf8").replace(/--.*$/gm, "");
  assert.match(sql, /after update of blocos_publicados on public\.ticketeria_site_paginas/);
  assert.match(sql, /limit 20/);
  assert.match(sql, /grant select on public\.ticketeria_site_versoes to authenticated;/);
  assert.doesNotMatch(sql, /grant (insert|update|delete)/i);
  assert.match(sql, /revoke execute on function public\.fn_ticketeria_site_versao_guardar\(uuid, text, jsonb, uuid\) from public, anon, authenticated;/);
  assert.match(sql, /where p\.blocos_publicados is not null and not exists/, "a cópia inicial só das páginas publicadas e só uma vez");
  assert.doesNotMatch(sql, /\bdrop\b/i);
});
