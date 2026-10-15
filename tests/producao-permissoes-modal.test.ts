import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PermissoesProducaoModal from "../components/modals/PermissoesProducaoModal";
import { PermissoesProducaoDoMembro } from "../components/producao/PermissoesProducaoDoMembro";
import { MODULOS, type ModuloId } from "../lib/modulos";
import { PAPEIS_EXTERNOS } from "../lib/equipe-modulos";

// PD0.7b: a tela. Os testes de unidade não têm navegador, então o HTML dos
// componentes é gerado no servidor (sem clique) e conferido; o que depende de
// clique (abrir, salvar, erro, teclado, celular) está na lógica e no banco de
// producao-permissoes-tela.test.ts e foi conferido no navegador, como descreve o
// PR. As regras de interface do dono ficam aqui como trava: Salvar verde,
// Cancelar só texto, cantos de 4px, sem campo solto na linha.

const SEM_PRODUCAO: ModuloId[] = MODULOS.filter(m => m !== "producao");
const ACESSO = ["captacao", "producao"];

type LinhaProps = ComponentProps<typeof PermissoesProducaoDoMembro>;
type ModalProps = ComponentProps<typeof PermissoesProducaoModal>;

function membro(papel: string, modulos_acesso: string[] = ACESSO): LinhaProps["membro"] {
  return { user_id: "u1", papel, modulos_acesso, full_name: "Carlos Colaborador", email: "carlos@org.com" };
}

function linha(props: Partial<LinhaProps> = {}): string {
  return renderToStaticMarkup(createElement(PermissoesProducaoDoMembro, {
    organizationId: "org-1",
    membro: membro("colaborador"),
    souAdmin: true,
    modulosDaOrganizacao: [...MODULOS],
    funcao: null,
    recarregar: async () => ({}),
    onSaved() {},
    ...props,
  }));
}

function modal(props: Partial<ModalProps> = {}): string {
  return renderToStaticMarkup(createElement(PermissoesProducaoModal, {
    organizationId: "org-1",
    membro: { user_id: "u1", full_name: "Carlos Colaborador", email: "carlos@org.com" },
    atual: { dinheiro: true, alcada: 5000, escopo: "organizacao" },
    comAlcada: true,
    onClose() {},
    onSaved() {},
    ...props,
  }));
}

/** Os botões do HTML: classes, atributos e o texto (sem os ícones). */
function botoes(html: string): { tag: string; classe: string; texto: string }[] {
  return [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(m => ({
    tag: m[1],
    classe: /class="([^"]*)"/.exec(m[1])?.[1] ?? "",
    texto: m[2].replace(/<[^>]*>/g, "").trim(),
  }));
}

function botao(html: string, texto: string) {
  const achado = botoes(html).find(b => b.texto === texto);
  assert.ok(achado, `botão "${texto}" não encontrado`);
  return achado;
}

/** Tem o atributo disabled? As classes "disabled:..." do Tailwind não contam. */
function desabilitado(tag: string): boolean {
  return /\sdisabled(=""|[\s/>])/.test(tag);
}

/** O campo de valor da alçada, ou undefined quando o modal não o traz. */
function campoDaAlcada(html: string): string | undefined {
  return /<input\b[^>]*>/.exec(html)?.[0];
}

// ─── A linha da equipe ──────────────────────────────────────────────────────

test("a linha não desenha nada quando não há o que oferecer: a tela de Equipe fica como hoje", () => {
  assert.equal(linha({ souAdmin: false }), "", "quem não administra");
  assert.equal(linha({ modulosDaOrganizacao: SEM_PRODUCAO }), "", "organização sem a produção");
  assert.equal(linha({ modulosDaOrganizacao: ["captacao"] }), "", "organização só com a captação");
  assert.equal(linha({ membro: membro("admin") }), "", "administrador");
  for (const externo of PAPEIS_EXTERNOS) assert.equal(linha({ membro: membro(externo) }), "", externo);
  assert.equal(linha({ membro: membro("colaborador", ["captacao"]) }), "", "pessoa sem a produção");
  assert.equal(linha({ membro: { ...membro("colaborador"), modulos_acesso: undefined } }), "", "sem lista de módulos");
  assert.equal(linha({ membro: { ...membro("colaborador"), modulos_acesso: null } }), "", "lista de módulos nula");
  assert.equal(linha({ organizationId: null }), "", "sem organização");
  // Nem com a função lida: o que decide é quem olha e onde, e não o dado.
  assert.equal(linha({ modulosDaOrganizacao: SEM_PRODUCAO, funcao: { dinheiro: true, alcada: 100, escopo: "organizacao" } }), "");
  assert.equal(linha({ souAdmin: false, funcao: { dinheiro: true, alcada: 100, escopo: "organizacao" } }), "");
});

test("colaborador e leitor que usam a produção: o botão 'Permissões da produção', secundário e de 4px", () => {
  for (const papel of ["colaborador", "visualizador", "leitor"]) {
    const html = linha({ membro: membro(papel) });
    const acao = botao(html, "Permissões da produção");
    assert.match(acao.tag, /type="button"/, papel);
    assert.equal(desabilitado(acao.tag), false, `${papel}: a leitura é feita ao clicar, então o botão já vale`);
    assert.match(acao.classe, /\brounded\b/, papel);
    assert.doesNotMatch(acao.classe, /rounded-(sm|md|lg|xl|2xl|3xl|full)/, `${papel}: só os 4px`);
    // Secundário: branco com borda leve, nunca o verde do Salvar nem o preto da ação principal.
    assert.match(acao.classe, /\bbg-white\b/, papel);
    assert.doesNotMatch(acao.classe, /bg-\[#(2E8932|282525)\]/, papel);
    // Edição só por botão e modal: nenhum campo solto na linha.
    assert.doesNotMatch(html, /<(input|select|textarea)\b/i, papel);
    assert.equal(botoes(html).length, 1, papel);
  }
});

test("cada botão da lista tem o nome da pessoa para quem navega por leitor de tela, sem perder o rótulo visível", () => {
  const html = linha();
  const acao = botoes(html)[0];
  assert.match(acao.tag, /aria-label="Permissões da produção de Carlos Colaborador"/);
  // O rótulo visível é o começo do nome acessível (WCAG 2.5.3).
  assert.equal(acao.texto, "Permissões da produção");
  assert.match(linha({ membro: { ...membro("leitor"), full_name: null } }), /aria-label="Permissões da produção de carlos@org\.com"/);
  assert.match(linha({ membro: { ...membro("leitor"), full_name: null, email: null } }), /aria-label="Permissões da produção de membro"/);
  // Só a leitura nova pelo clique: a página nunca abre o modal sozinha, e o estado inicial não mostra erro nem espera.
  assert.doesNotMatch(html, /aria-busy="true"/);
  assert.doesNotMatch(html, /role="alert"/);
  assert.doesNotMatch(html, /Não foi possível ler/);
});

test("o resumo ao lado do botão mostra o que a pessoa tem, e some quando não tem dinheiro", () => {
  assert.doesNotMatch(linha({ funcao: null }), /Vê o dinheiro/, "sem registro é o padrão e não pede aviso");
  assert.doesNotMatch(linha({ funcao: { dinheiro: false, alcada: null, escopo: "organizacao" } }), /Vê o dinheiro/);
  const soDinheiro = linha({ funcao: { dinheiro: true, alcada: null, escopo: "organizacao" } });
  assert.match(soDinheiro, />Vê o dinheiro</);
  assert.doesNotMatch(soDinheiro, /aprova/);
  const comAlcada = linha({ funcao: { dinheiro: true, alcada: 5000, escopo: "organizacao" } });
  assert.match(comAlcada, />Vê o dinheiro · aprova até R\$.5\.000</);
  // Com centavos o resumo traz o valor exato, e sem title: o texto já diz tudo.
  const comCentavos = linha({ funcao: { dinheiro: true, alcada: 7500.5, escopo: "organizacao" } });
  assert.match(comCentavos, />Vê o dinheiro · aprova até R\$.7\.500,50</);
  assert.doesNotMatch(comAlcada + comCentavos, /title=/);
  // O leitor nunca aprova: a alçada que sobrou de quando era colaborador não aparece.
  const leitor = linha({ membro: membro("leitor"), funcao: { dinheiro: true, alcada: 5000, escopo: "organizacao" } });
  assert.match(leitor, />Vê o dinheiro</);
  assert.doesNotMatch(leitor, /aprova/);
  assert.doesNotMatch(leitor, /title=/);
});

// ─── O modal ────────────────────────────────────────────────────────────────

test("modal do colaborador: o dinheiro, a alçada de hoje, o nome da pessoa e as ações no padrão do Jards", () => {
  const html = modal();
  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, /<h2[^>]*>Permissões da produção<\/h2>/);
  assert.match(html, />Carlos Colaborador</);
  // O dinheiro: um item marcável, marcado porque a pessoa já o tem.
  assert.match(html, /role="checkbox" aria-checked="true"[^>]*>[\s\S]*?Vê o dinheiro da produção/);
  // A alçada: o valor de hoje, em reais, no campo de valor do Jards (com o R$ na frente).
  assert.match(html, /<label for="[^"]+"[^>]*>Aprova pedidos até<\/label>/);
  const campo = campoDaAlcada(html);
  assert.ok(campo, "campo da alçada");
  assert.match(campo, /value="5\.000,00"/);
  assert.match(campo, /placeholder="Não aprova"/);
  assert.equal(desabilitado(campo), false);
  assert.match(html, />R\$<\/span>/);
  // Salvar sempre verde; Cancelar só texto, sem fundo e sem borda.
  const salvar = botao(html, "Salvar");
  assert.match(salvar.tag, /type="submit"/);
  assert.match(salvar.classe, /\bbg-\[#2E8932\]/);
  assert.match(salvar.classe, /\btext-white\b/);
  assert.match(salvar.classe, /\brounded\b/);
  const cancelar = botao(html, "Cancelar");
  assert.match(cancelar.tag, /type="button"/);
  assert.doesNotMatch(cancelar.classe, /\bbg-|\bborder\b|\bborder-/);
  assert.match(cancelar.classe, /text-black\/35/);
  assert.match(cancelar.classe, /hover:text-black\/55/);
  // O fechamento do cabeçalho tem nome para quem não vê o ícone.
  assert.match(html, /aria-label="Fechar"/);
});

test("modal: a alçada só vale com o dinheiro, então sem ele o campo fica desabilitado e vazio", () => {
  const semDinheiro = modal({ atual: { dinheiro: false, alcada: null, escopo: "organizacao" } });
  assert.match(semDinheiro, /aria-checked="false"/);
  const campo = campoDaAlcada(semDinheiro);
  assert.ok(campo);
  assert.equal(desabilitado(campo), true);
  assert.match(campo, /value=""/);
  // Alçada que sobrou sem o dinheiro (o banco não deixa gravar assim, mas a tela não a mostra): campo vazio e travado.
  const sobra = campoDaAlcada(modal({ atual: { dinheiro: false, alcada: 5000, escopo: "organizacao" } })) ?? "";
  assert.match(sobra, /value=""/);
  assert.equal(desabilitado(sobra), true);
  // Sem registro na tabela: sem dinheiro e sem alçada.
  const semRegistro = modal({ atual: null });
  assert.match(semRegistro, /aria-checked="false"/);
  assert.match(campoDaAlcada(semRegistro) ?? "", /value=""/);
  assert.equal(desabilitado(campoDaAlcada(semRegistro) ?? ""), true);
  // Com dinheiro e sem alçada: campo livre e vazio (vazio = não aprova).
  const soDinheiro = modal({ atual: { dinheiro: true, alcada: null, escopo: "organizacao" } });
  assert.equal(desabilitado(campoDaAlcada(soDinheiro) ?? ""), false);
  assert.match(campoDaAlcada(soDinheiro) ?? "", /value=""/);
});

test("modal do leitor: só o dinheiro; o campo da alçada nem aparece, porque leitor nunca aprova", () => {
  const html = modal({ comAlcada: false, atual: { dinheiro: true, alcada: 5000, escopo: "organizacao" } });
  assert.match(html, /Vê o dinheiro da produção/);
  assert.doesNotMatch(html, /Aprova pedidos/);
  assert.equal(campoDaAlcada(html), undefined);
  assert.doesNotMatch(html, /Não aprova/);
  assert.match(botao(html, "Salvar").classe, /bg-\[#2E8932\]/);
});

test("modal: sem nome cadastrado, o cabeçalho mostra o e-mail", () => {
  const html = modal({ membro: { user_id: "u1", full_name: null, email: "carlos@org.com" } });
  assert.match(html, />carlos@org\.com</);
});

// ─── Regras de interface e ligação na página ────────────────────────────────

const TELA = [
  "components/modals/PermissoesProducaoModal.tsx",
  "components/producao/PermissoesProducaoDoMembro.tsx",
];

test("os componentes seguem o DESIGN.md: 4px, sem select nativo, sem alert do navegador", async () => {
  for (const arquivo of TELA) {
    const texto = await readFile(arquivo, "utf8");
    assert.doesNotMatch(texto, /rounded-(md|lg|xl|2xl|3xl|full)\b/, `${arquivo}: cantos`);
    assert.doesNotMatch(texto, /<select\b|window\.alert|\balert\(|\bconfirm\(/, `${arquivo}: controles nativos`);
    assert.doesNotMatch(texto, /#0D0D0D|#000\b/i, `${arquivo}: o preto do Jards é o grafite #282525`);
  }
  // O único canto menor é o quadradinho do item marcável (rounded-sm, como no convite de membros).
  assert.equal(((await readFile(TELA[0], "utf8")).match(/rounded-sm/g) ?? []).length, 1);
  assert.doesNotMatch(await readFile(TELA[1], "utf8"), /rounded-sm/);
});

test("o modal não prende a pessoa: o pedido tem fim, o foco volta ao Salvar no erro e o fundo só fecha com o clique inteiro nele", async () => {
  const modal = await readFile(TELA[0], "utf8");
  // Nunca fica em "Salvando…" para sempre, nem se o cliente do navegador falhar ao nascer.
  assert.match(modal, /try \{\s*resultado = await definirFuncao\(createClient\(\) as unknown as ClienteDasPermissoes[^;]*;\s*\} catch \{[\s\S]*?\} finally \{\s*setSalvando\(false\);\s*\}/);
  // Com os itens desabilitados durante o pedido o foco cai para a página: com o aviso na tela ele volta ao Salvar.
  assert.match(modal, /useEffect\(\(\) => \{\s*if \(erro && !salvando\) botaoSalvar\.current\?\.focus\(\);\s*\}, \[erro, salvando\]\);/);
  assert.match(modal, /<button\s+ref=\{botaoSalvar\}\s+type="submit"/);
  // Arrastar a seleção do campo até fora do modal não fecha nem perde o valor: o clique precisa ter começado no fundo.
  assert.match(modal, /onMouseDown=\{evento => \{ clicouNoFundo\.current = evento\.target === evento\.currentTarget; \}\}/);
  assert.match(modal, /onClick=\{\(\) => \{ if \(clicouNoFundo\.current\) fechar\(\); \}\}/);
  assert.doesNotMatch(modal, /onClick=\{fechar\}\s*>\s*\n?\s*<div role="dialog"/);
});

test("a linha só abre o modal com a leitura nova, e a falha dela aparece e deixa tentar de novo", async () => {
  const linhaDoMembro = await readFile(TELA[1], "utf8");
  assert.match(linhaDoMembro, /const leitura = await lerParaEditar\(recarregar, membro\.user_id\);/);
  // O modal só vem depois de leitura que deu certo; a falha mostra a mensagem e não abre nada.
  assert.match(linhaDoMembro, /if \(!leitura\.ok\) \{\s*setLeituraFalhou\(true\);\s*return;\s*\}\s*setAberta\(\{ atual: leitura\.atual \}\);/);
  assert.match(linhaDoMembro, /role="alert"[^>]*>\{MENSAGEM_LEITURA_DAS_PERMISSOES\}/);
  // Enquanto lê, o botão espera; depois volta, e clicar de novo tenta outra vez.
  assert.match(linhaDoMembro, /aria-busy=\{lendo\}\s+disabled=\{lendo\}/);
  assert.match(linhaDoMembro, /setLendo\(true\);\s*setLeituraFalhou\(false\);/);
});

test("a página de Configurações só liga a tela: um botão por linha, depois dos módulos, e a leitura só para o admin da organização com a produção", async () => {
  const pagina = await readFile("app/(dashboard)/configuracoes/page.tsx", "utf8");
  assert.match(pagina, /import \{ PermissoesProducaoDoMembro \} from "@\/components\/producao\/PermissoesProducaoDoMembro";/);
  assert.match(pagina, /import \{ useFuncoesProducao \} from "@\/hooks\/useFuncoesProducao";/);
  assert.match(pagina, /useFuncoesProducao\(organizationId, isAdmin && orgModulos\.includes\("producao"\)\)/);
  assert.equal((pagina.match(/<PermissoesProducaoDoMembro\b/g) ?? []).length, 1);
  assert.match(pagina, /<ModulosDoMembro\b[\s\S]*?\/>\s*<PermissoesProducaoDoMembro\b/);
  // O modal abre com uma leitura nova (recarregar); o mapa da página serve só ao resumo e nunca vira "função de padrão" por falta de leitura.
  assert.match(pagina, /recarregar=\{recarregarFuncoesProducao\}/);
  assert.match(pagina, /funcao=\{funcoesProducao\?\.\[m\.user_id\] \?\? null\}/);
  assert.doesNotMatch(pagina, /funcao=\{[^}]*undefined/);
  // A lógica fica nos arquivos próprios: a página não chama o banco da produção nem decide quem recebe a ação.
  assert.doesNotMatch(pagina, /fn_producao_definir_funcao|producao_funcoes|ofertaDePermissoes|montarPedido/);
  assert.match(pagina, /showSuccess\("Permissões da produção atualizadas"\)/);
});
