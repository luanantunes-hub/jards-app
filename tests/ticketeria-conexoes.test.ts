import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CartaoDeAnuncios, CartaoDoMeta, ConexoesDaLoja, EscolherContaSheet, type ConexaoMeta } from "../components/ticketeria/ConexoesView";

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

test("o cartão do Google Ads: o mesmo cartão, com o nome e as frases dele", () => {
  const sem = html(createElement(CartaoDeAnuncios, { provedor: "google_ads", estado: { disponivel: true, conexao: null } }));
  assert.ok(sem.includes("Google Ads") && sem.includes("Pesquisa e YouTube") && sem.includes("Conectar"));
  const escolher = html(createElement(CartaoDeAnuncios, { provedor: "google_ads", estado: { disponivel: true, conexao: { ...ativa, situacao: "escolher_conta", conta_nome: null } } }));
  assert.ok(escolher.includes("Você entrou no Google Ads"));
  const erro = html(createElement(CartaoDeAnuncios, { provedor: "google_ads", estado: { disponivel: true, conexao: { ...ativa, situacao: "erro", ultimo_erro: null } } }));
  assert.ok(erro.includes("O acesso ao Google Ads venceu ou foi retirado"));
  assert.ok(html(createElement(CartaoDeAnuncios, { provedor: "google_ads", estado: { disponivel: false, conexao: null } })).includes("Em breve"));
  assert.ok(html(createElement(CartaoDeAnuncios, { provedor: "google_ads", estado: { disponivel: true, conexao: ativa } })).includes("R$ 1.842,30"));
});

test("a aba: o texto de só leitura, os dois cartões, o TikTok em breve e o aviso da volta do login", () => {
  const sem = { disponivel: true, conexao: null };
  const aba = html(createElement(ConexoesDaLoja, { estados: { meta: sem, google_ads: { disponivel: false, conexao: null }, ga4: { disponivel: false, conexao: null } }, aviso: "O Meta não liberou o acesso." }));
  for (const t of ["Só leitura", "Anúncios pagos", "Site e redes", "Meta Ads", "Google Ads", "Google Analytics 4", "TikTok Ads", "Em breve", "O Meta não liberou o acesso."]) assert.ok(aba.includes(t), `falta: ${t}`);
  assert.equal((aba.match(/Em breve/g) ?? []).length, 3, "o Google Ads e o GA4 (sem credenciais) e o TikTok");
});

test("a folha de escolher a conta: só real e ativa pode ser escolhida; carregando, vazio e erro", () => {
  const contas = [
    { id: "1048771", nome: "Cia Atores de Mar", moeda: "BRL", ativa: true, suportada: true }, { id: "7731902", nome: "Conta em dólar", moeda: "USD", ativa: true, suportada: false }, { id: "2290305", nome: "Antiga", moeda: "BRL", ativa: false, suportada: true },
  ];
  const f = html(createElement(EscolherContaSheet, { contas, escolhida: "1048771", onClose: () => {} }));
  for (const t of ["Escolha a conta de anúncios", "Cia Atores de Mar", "real (BRL)", "não dá para somar com real ainda", "conta desativada na plataforma", "Conectar esta conta", "nunca criamos nem mudamos anúncios"]) assert.ok(f.includes(t), `falta: ${t}`);
  assert.equal((f.match(/role="radio"/g) ?? []).length, 3);
  assert.equal((f.match(/aria-checked="true"/g) ?? []).length, 1);
  assert.equal((f.match(/disabled=""/g) ?? []).length >= 2, true, "a conta em dólar e a desativada não se escolhem");
  assert.ok(html(createElement(EscolherContaSheet, { contas: null, escolhida: null, carregando: true, onClose: () => {} })).includes("Buscando as suas contas"));
  assert.ok(html(createElement(EscolherContaSheet, { contas: [], escolhida: null, onClose: () => {} })).includes("não devolveu nenhuma conta"));
  const semEscolha = html(createElement(EscolherContaSheet, { contas, escolhida: null, onClose: () => {} }));
  assert.ok(/<button[^>]*disabled=""[^>]*>Conectar esta conta/.test(semEscolha), "sem conta escolhida não conecta");
  assert.ok(html(createElement(EscolherContaSheet, { contas, escolhida: "1048771", erro: "Por enquanto só contas em real (BRL).", onClose: () => {} })).includes("só contas em real"));
});

test("o cartão do GA4: visitas em vez de gasto, a origem que mais trouxe e as frases da propriedade", () => {
  const ga4: ConexaoMeta = { ...ativa, conta_nome: "Cia Atores de Mar · Site", moeda: null, visitas_30_dias: 4210, principal_origem: { nome: "Instagram", porcento: 38 }, gasto_30_dias_centavos: 0 };
  const ok = html(createElement(CartaoDeAnuncios, { provedor: "ga4", estado: { disponivel: true, conexao: ga4 } }));
  for (const t of ["Google Analytics 4", "Visitas ao seu site", "CONECTADO", "Site", "Cia Atores de Mar · Site", "Visitas lidas nos últimos 30 dias", "4.210", "principal origem: Instagram (38%)", "Trocar site", "Ler agora"]) assert.ok(ok.includes(t), `falta: ${t}`);
  assert.ok(!ok.includes("Gasto lido") && !ok.includes("Moeda"), "o GA4 não tem gasto nem moeda");
  assert.ok(html(createElement(CartaoDeAnuncios, { provedor: "ga4", estado: { disponivel: true, conexao: { ...ga4, principal_origem: null, visitas_30_dias: 0 } } })).includes("ainda sem visitas lidas"));
  assert.ok(html(createElement(CartaoDeAnuncios, { provedor: "ga4", estado: { disponivel: true, conexao: { ...ga4, situacao: "escolher_conta" } } })).includes("Escolher o site"));
  assert.ok(html(createElement(CartaoDeAnuncios, { provedor: "ga4", estado: { disponivel: true, conexao: { ...ga4, situacao: "erro", ultimo_erro: null } } })).includes("O acesso ao Google Analytics venceu ou foi retirado"));
  const folha = html(createElement(EscolherContaSheet, { fonte: "Google Analytics", tipo: "visitas", contas: [{ id: "338100094", nome: "Cia Atores de Mar · Site", moeda: "", ativa: true, suportada: true }], escolhida: "338100094", onClose: () => {} }));
  for (const t of ["Escolha o site do Analytics", "cujas visitas o Jards vai ler", "Propriedade 3381 …094", "Cia Atores de Mar · Site"]) assert.ok(folha.includes(t), `falta: ${t}`);
  assert.ok(!folha.includes("real (BRL)") && !folha.includes("moeda desconhecida"));
  assert.ok(html(createElement(EscolherContaSheet, { fonte: "Google Analytics", tipo: "visitas", contas: [], escolhida: null, onClose: () => {} })).includes("não devolveu nenhuma propriedade"));
});
