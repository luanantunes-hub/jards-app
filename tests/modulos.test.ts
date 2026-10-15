import assert from "node:assert/strict";
import test from "node:test";
import {
  destinoSemAcesso,
  INICIO_DO_MODULO,
  MODULOS,
  MODULOS_EM_CONSTRUCAO,
  moduloDaRota,
  moduloVisivel,
  modulosDaOrganizacao,
  modulosDisponiveis,
  mostraSeletorDeModulo,
  normalizarModulos,
  paginaDeEntrada,
  podeUsarModulo,
  situacaoNoSeletor,
  usaModuloEmAlgumaOrganizacao,
  type AcessoModulos,
  type VinculoModulos,
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

const VINCULO_CAPTACAO: VinculoModulos = { modulosOrganizacao: ["captacao"], modulosMembro: ["captacao"] };
const VINCULO_PRESTACAO: VinculoModulos = { modulosOrganizacao: ["captacao", "prestacao"], modulosMembro: ["prestacao"] };
const VINCULO_PRODUCAO: VinculoModulos = { modulosOrganizacao: ["captacao", "producao"], modulosMembro: ["producao"] };

test("página de entrada: a da captação, a menos que a pessoa não a use em nenhuma organização", () => {
  assert.equal(paginaDeEntrada(false, [VINCULO_CAPTACAO]), "/dashboard");
  assert.equal(paginaDeEntrada(false, [{ modulosOrganizacao: ["captacao", "prestacao"], modulosMembro: ["captacao", "prestacao"] }]), "/dashboard");
  assert.equal(paginaDeEntrada(false, [VINCULO_PRESTACAO]), "/prestacoes");
  assert.equal(paginaDeEntrada(false, [VINCULO_PRODUCAO]), "/producoes");
  assert.equal(paginaDeEntrada(true, []), "/dashboard", "super admin usa todos: entra pela captação");
});

test("página de entrada: com mais de uma organização, vale a captação onde ela existir e a ordem dos módulos no resto", () => {
  assert.equal(paginaDeEntrada(false, [VINCULO_PRODUCAO, VINCULO_CAPTACAO]), "/dashboard");
  assert.equal(paginaDeEntrada(false, [VINCULO_PRODUCAO, VINCULO_PRESTACAO]), "/prestacoes", "prestação vem antes da produção na ordem de MODULOS");
  assert.equal(paginaDeEntrada(false, [VINCULO_PRODUCAO, VINCULO_PRODUCAO]), "/producoes");
});

test("página de entrada: sem vínculos ou sem módulo em comum fica a da captação (o layout de cliente decide o resto)", () => {
  assert.equal(paginaDeEntrada(false, []), "/dashboard");
  assert.equal(paginaDeEntrada(false, [{ modulosOrganizacao: ["prestacao"], modulosMembro: ["captacao"] }]), "/dashboard");
});

test("a produção só para leitura (cortesia que acabou) ainda é a entrada de quem só a usa", () => {
  // organizations.modulos_ativos sem a produção e modulos_leitura com ela: modulosDaOrganizacao junta as duas.
  const vinculo: VinculoModulos = { modulosOrganizacao: modulosDaOrganizacao(["captacao"], ["producao"]), modulosMembro: normalizarModulos(["producao"]) };
  assert.deepEqual([...vinculo.modulosOrganizacao], ["captacao", "producao"]);
  assert.equal(paginaDeEntrada(false, [vinculo]), "/producoes");
  assert.equal(usaModuloEmAlgumaOrganizacao(false, [vinculo], "producao"), true);
  assert.equal(destinoSemAcesso("/dashboard", { superAdmin: false, ...vinculo }), "/producoes");
  assert.equal(destinoSemAcesso("/producoes", { superAdmin: false, ...vinculo }), null);
});

test("colunas de módulo nulas ou vazias valem só a captação, sem erro", () => {
  for (const coluna of [null, undefined, [], "producao", {}]) {
    assert.deepEqual(modulosDaOrganizacao(coluna, coluna), ["captacao"]);
  }
  // Vínculo da produção numa organização que (ainda) não a tem: não entra, e nada quebra.
  const vinculo: VinculoModulos = { modulosOrganizacao: modulosDaOrganizacao(null, null), modulosMembro: normalizarModulos(["producao"]) };
  assert.equal(usaModuloEmAlgumaOrganizacao(false, [vinculo], "producao"), false);
  assert.equal(paginaDeEntrada(false, [vinculo]), "/dashboard");
  assert.equal(destinoSemAcesso("/producoes", { superAdmin: false, ...vinculo }), "/configuracoes");
});

test("quem só usa a produção: toda rota da captação e da prestação leva a /producoes", () => {
  const rotas = [
    "/dashboard", "/atividades", "/projetos", "/projetos/1", "/patrocinadores", "/comparativo", "/editais-abertos",
    "/empresas-crm", "/captacoes", "/captacoes/1", "/editais-inscritos", "/proponentes", "/captadores", "/contatos",
    "/contas-patrocinio", "/contratos/1", "/entregas/1", "/ativacoes/1", "/prestacoes", "/prestacoes/1/comprovantes", "/prestacoes/fornecedores",
  ];
  for (const rota of rotas) assert.equal(destinoSemAcesso(rota, SO_PRODUCAO), "/producoes", rota);
  for (const rota of ["/producoes", "/producoes/datas/1", "/configuracoes", "/meu-plano", "/notificacoes"]) {
    assert.equal(destinoSemAcesso(rota, SO_PRODUCAO), null, rota);
  }
});
