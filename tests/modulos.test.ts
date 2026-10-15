import assert from "node:assert/strict";
import test from "node:test";
import {
  destinoSemAcesso,
  INICIO_DO_MODULO,
  MODULOS,
  MODULOS_EM_CONSTRUCAO,
  moduloDaRota,
  moduloVisivel,
  modulosDisponiveis,
  mostraSeletorDeModulo,
  normalizarModulos,
  podeUsarModulo,
  usaModuloEmAlgumaOrganizacao,
  type AcessoModulos,
} from "../lib/modulos";

const SO_CAPTACAO: AcessoModulos = { superAdmin: false, modulosOrganizacao: ["captacao"], modulosMembro: ["captacao"] };
const SO_PRESTACAO: AcessoModulos = { superAdmin: false, modulosOrganizacao: ["captacao", "prestacao"], modulosMembro: ["prestacao"] };
const OS_DOIS: AcessoModulos = { superAdmin: false, modulosOrganizacao: ["captacao", "prestacao"], modulosMembro: ["captacao", "prestacao"] };
const SUPER: AcessoModulos = { superAdmin: true, modulosOrganizacao: ["captacao"], modulosMembro: ["captacao"] };

test("coluna sem valor, vazia ou estranha vale só a captação", () => {
  assert.deepEqual(normalizarModulos(null), ["captacao"]);
  assert.deepEqual(normalizarModulos(undefined), ["captacao"]);
  assert.deepEqual(normalizarModulos([]), ["captacao"]);
  assert.deepEqual(normalizarModulos("prestacao"), ["captacao"]);
  assert.deepEqual(normalizarModulos(["financeiro"]), ["captacao"]);
  assert.deepEqual(normalizarModulos(["prestacao", "x"]), ["prestacao"]);
  assert.deepEqual(normalizarModulos(["prestacao", "captacao"]), ["captacao", "prestacao"]);
});

test("rotas da prestação pertencem ao módulo; o resto é captação", () => {
  assert.equal(moduloDaRota("/prestacoes"), "prestacao");
  assert.equal(moduloDaRota("/prestacoes/abc/comprovantes"), "prestacao");
  assert.equal(moduloDaRota("/prestacoes-antigas"), "captacao");
  assert.equal(moduloDaRota("/dashboard"), "captacao");
});

test("módulo exige organização e vínculo; super admin usa todos", () => {
  assert.equal(podeUsarModulo(SO_CAPTACAO, "prestacao"), false);
  assert.equal(podeUsarModulo({ ...SO_CAPTACAO, modulosMembro: ["captacao", "prestacao"] }, "prestacao"), false);
  assert.equal(podeUsarModulo(SO_PRESTACAO, "prestacao"), true);
  assert.equal(podeUsarModulo(SO_PRESTACAO, "captacao"), false);
  assert.equal(podeUsarModulo(SUPER, "prestacao"), true);
});

test("quem só usa a prestação é mandado para /prestacoes", () => {
  assert.equal(destinoSemAcesso("/dashboard", SO_PRESTACAO), "/prestacoes");
  assert.equal(destinoSemAcesso("/captacoes/1", SO_PRESTACAO), "/prestacoes");
  assert.equal(destinoSemAcesso("/prestacoes/1", SO_PRESTACAO), null);
});

test("quem só usa a captação não abre a prestação pela URL", () => {
  assert.equal(destinoSemAcesso("/prestacoes", SO_CAPTACAO), "/dashboard");
  assert.equal(destinoSemAcesso("/dashboard", SO_CAPTACAO), null);
});

test("configurações, plano e notificações abrem para todos", () => {
  for (const rota of ["/configuracoes", "/configuracoes/mcp", "/meu-plano", "/notificacoes"]) {
    assert.equal(destinoSemAcesso(rota, SO_PRESTACAO), null, rota);
    assert.equal(destinoSemAcesso(rota, SO_CAPTACAO), null, rota);
  }
});

test("organização e vínculo sem módulo em comum caem nas configurações", () => {
  const semComum: AcessoModulos = { superAdmin: false, modulosOrganizacao: ["prestacao"], modulosMembro: ["captacao"] };
  assert.equal(destinoSemAcesso("/dashboard", semComum), "/configuracoes");
});

test("seletor aparece só para quem usa os dois módulos", () => {
  assert.equal(mostraSeletorDeModulo(SO_CAPTACAO), false);
  assert.equal(mostraSeletorDeModulo(SO_PRESTACAO), false);
  assert.equal(mostraSeletorDeModulo(OS_DOIS), true);
  assert.deepEqual(modulosDisponiveis(SUPER), ["captacao", "prestacao", "producao"]);
});

test("bloqueio do servidor aceita acesso em qualquer organização", () => {
  const vinculos = [
    { modulosOrganizacao: ["captacao"] as const, modulosMembro: ["captacao", "prestacao"] as const },
    { modulosOrganizacao: ["captacao", "prestacao"] as const, modulosMembro: ["prestacao"] as const },
  ];
  assert.equal(usaModuloEmAlgumaOrganizacao(false, vinculos, "prestacao"), true);
  assert.equal(usaModuloEmAlgumaOrganizacao(false, vinculos.slice(0, 1), "prestacao"), false);
  assert.equal(usaModuloEmAlgumaOrganizacao(false, [], "prestacao"), false);
  assert.equal(usaModuloEmAlgumaOrganizacao(true, [], "prestacao"), true);
});

const SO_PRODUCAO: AcessoModulos = { superAdmin: false, modulosOrganizacao: ["captacao", "producao"], modulosMembro: ["producao"] };

test("rotas da produção pertencem ao módulo, sem confundir com a prestação", () => {
  assert.equal(moduloDaRota("/producoes"), "producao");
  assert.equal(moduloDaRota("/producoes/datas/1"), "producao");
  assert.equal(moduloDaRota("/producoes-antigas"), "captacao");
  assert.equal(moduloDaRota("/prestacoes"), "prestacao");
});

test("cada módulo tem página inicial, e quem só usa a produção vai para ela", () => {
  for (const modulo of MODULOS) assert.ok(INICIO_DO_MODULO[modulo].startsWith("/"), modulo);
  assert.equal(destinoSemAcesso("/dashboard", SO_PRODUCAO), "/producoes");
  assert.equal(destinoSemAcesso("/prestacoes", SO_PRODUCAO), "/producoes");
  assert.equal(destinoSemAcesso("/producoes", SO_PRODUCAO), null);
  assert.equal(destinoSemAcesso("/producoes", SO_CAPTACAO), "/dashboard");
  assert.equal(destinoSemAcesso("/producoes", SO_PRESTACAO), "/prestacoes");
});

test("módulo em construção fica escondido até a organização tê-lo", () => {
  assert.deepEqual([...MODULOS_EM_CONSTRUCAO], ["producao"]);
  assert.equal(moduloVisivel("producao", ["captacao"]), false);
  assert.equal(moduloVisivel("producao", ["captacao", "prestacao"]), false);
  assert.equal(moduloVisivel("producao", ["captacao", "producao"]), true);
  assert.equal(moduloVisivel("prestacao", ["captacao"]), true);
  assert.equal(moduloVisivel("captacao", []), true);
});
