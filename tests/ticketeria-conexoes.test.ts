import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CartaoDoMeta, ConexoesDaLoja, EscolherContaSheet, type ConexaoMeta } from "../components/ticketeria/ConexoesView";

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el).replace(/ /g, " ");
const ativa: ConexaoMeta = { situacao: "ativa", conta_nome: "Cia Atores de Mar", moeda: "BRL", ultima_leitura_em: "2026-11-20T09:10:00Z", ultimo_erro: null, lido_desde: "2025-11-20", gasto_30_dias_centavos: 184230 };

test("o cartão do Meta em cada situação", () => {
  const breve = html(createElement(CartaoDoMeta, { meta: { disponivel: false, conexao: null } }));
  assert.ok(breve.includes("Em breve") && !breve.includes("Conectar"), "sem as credenciais do app: em breve, sem botão");
  const sem = html(createElement(CartaoDoMeta, { meta: { disponivel: true, conexao: null } }));
  assert.ok(sem.includes("Conectar") && sem.includes("Instagram e Facebook"));
  const escolher = html(createElement(CartaoDoMeta, { meta: { disponivel: true, conexao: { ...ativa, situacao: "escolher_conta", conta_nome: null } } }));
  assert.ok(escolher.includes("Escolher a conta") && escolher.includes("Falta escolher"));
  const erro = html(createElement(CartaoDoMeta, { meta: { disponivel: true, conexao: { ...ativa, situacao: "erro", ultimo_erro: "O acesso ao Meta venceu ou foi retirado. Conecte de novo." } } }));
  assert.ok(erro.includes("PRECISA CONECTAR DE NOVO") && erro.includes("Conectar de novo") && erro.includes("venceu"));
  const ok = html(createElement(CartaoDoMeta, { meta: { disponivel: true, conexao: ativa } }));
  for (const t of ["CONECTADO", "Cia Atores de Mar", "Moeda: real (BRL)", "R$ 1.842,30", "desde 20/11/2025", "Ler agora", "Trocar conta", "Desconectar"]) assert.ok(ok.includes(t), `falta: ${t}`);
  assert.ok(html(createElement(CartaoDoMeta, { meta: { disponivel: true, conexao: ativa }, ocupado: true })).includes("Lendo…"));
  assert.ok(html(createElement(CartaoDoMeta, { meta: { disponivel: true, conexao: { ...ativa, ultima_leitura_em: null } } })).includes("ainda não leu"));
  assert.ok(html(createElement(CartaoDoMeta, { meta: { disponivel: true, conexao: { ...ativa, ultimo_erro: "A Meta pediu para esperar um pouco." } } })).includes("pediu para esperar"));
});

test("a aba: o texto de só leitura, os outros conectores em breve e o aviso da volta do login", () => {
  const aba = html(createElement(ConexoesDaLoja, { meta: { disponivel: true, conexao: null }, aviso: "O Meta não liberou o acesso." }));
  for (const t of ["Só leitura", "Anúncios pagos", "Google Ads", "TikTok Ads", "Em breve", "O Meta não liberou o acesso."]) assert.ok(aba.includes(t), `falta: ${t}`);
});

test("a folha de escolher a conta: só real e ativa pode ser escolhida; carregando, vazio e erro", () => {
  const contas = [
    { id: "1048771", nome: "Cia Atores de Mar", moeda: "BRL", ativa: true, suportada: true }, { id: "7731902", nome: "Conta em dólar", moeda: "USD", ativa: true, suportada: false }, { id: "2290305", nome: "Antiga", moeda: "BRL", ativa: false, suportada: true },
  ];
  const f = html(createElement(EscolherContaSheet, { contas, escolhida: "1048771", onClose: () => {} }));
  for (const t of ["Escolha a conta de anúncios", "Cia Atores de Mar", "real (BRL)", "não dá para somar com real ainda", "conta desativada no Meta", "Conectar esta conta", "nunca criamos nem mudamos anúncios"]) assert.ok(f.includes(t), `falta: ${t}`);
  assert.equal((f.match(/role="radio"/g) ?? []).length, 3);
  assert.equal((f.match(/aria-checked="true"/g) ?? []).length, 1);
  assert.equal((f.match(/disabled=""/g) ?? []).length >= 2, true, "a conta em dólar e a desativada não se escolhem");
  assert.ok(html(createElement(EscolherContaSheet, { contas: null, escolhida: null, carregando: true, onClose: () => {} })).includes("Buscando as suas contas"));
  assert.ok(html(createElement(EscolherContaSheet, { contas: [], escolhida: null, onClose: () => {} })).includes("não devolveu nenhuma conta"));
  const semEscolha = html(createElement(EscolherContaSheet, { contas, escolhida: null, onClose: () => {} }));
  assert.ok(/<button[^>]*disabled=""[^>]*>Conectar esta conta/.test(semEscolha), "sem conta escolhida não conecta");
  assert.ok(html(createElement(EscolherContaSheet, { contas, escolhida: "1048771", erro: "Por enquanto só contas em real (BRL).", onClose: () => {} })).includes("só contas em real"));
});
