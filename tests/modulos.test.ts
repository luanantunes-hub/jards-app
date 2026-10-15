import assert from "node:assert/strict";
import test from "node:test";
import {
  destinoSemAcesso,
  moduloDaRota,
  modulosDisponiveis,
  mostraSeletorDeModulo,
  normalizarModulos,
  podeUsarModulo,
  situacaoNoSeletor,
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
  assert.deepEqual(modulosDisponiveis(SUPER), ["captacao", "prestacao"]);
});

test("a prestação nunca aparece como não contratada no seletor", () => {
  const carregado = { carregado: true };
  // Nunca teve: convite do teste grátis, para administrador ou não.
  assert.deepEqual(situacaoNoSeletor({ ...SO_CAPTACAO, ...carregado }, "prestacao"), { tipo: "teste" });
  // Em vigor, ou só para leitura depois do teste (modulosDaOrganizacao junta as duas listas): entra.
  assert.deepEqual(situacaoNoSeletor({ ...OS_DOIS, ...carregado }, "prestacao"), { tipo: "livre" });
  // Antes de saber os módulos da organização, nada de cadeado nem de convite.
  assert.deepEqual(situacaoNoSeletor({ ...SO_CAPTACAO, carregado: false }, "prestacao"), { tipo: "carregando" });
  assert.deepEqual(situacaoNoSeletor({ ...OS_DOIS, carregado: false }, "captacao"), { tipo: "carregando" });
  // Super admin usa todos, mesmo antes de carregar.
  assert.deepEqual(situacaoNoSeletor({ ...SUPER, carregado: false }, "prestacao"), { tipo: "livre" });
  // A organização tem o módulo e a pessoa não tem a vaga: quem decide é o administrador.
  const semVaga = situacaoNoSeletor({ ...OS_DOIS, modulosMembro: ["captacao"], ...carregado }, "prestacao");
  assert.equal(semVaga.tipo, "bloqueado");
  assert.match(semVaga.tipo === "bloqueado" ? semVaga.motivo : "", /peça a quem administra/);
  for (const acesso of [SO_CAPTACAO, SO_PRESTACAO, OS_DOIS, SUPER]) {
    for (const carregadoOuNao of [true, false]) {
      const situacao = situacaoNoSeletor({ ...acesso, carregado: carregadoOuNao }, "prestacao");
      assert.ok(situacao.tipo !== "bloqueado" || !/não contratado/.test(situacao.motivo));
    }
  }
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
