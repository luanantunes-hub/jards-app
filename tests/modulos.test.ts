import assert from "node:assert/strict";
import test from "node:test";
import {
  destinoDaEntrada,
  destinoDoBloqueio,
  destinoSemAcesso,
  inicioEmAlgumaOrganizacao,
  inicioNaOrganizacao,
  INICIO_DO_MODULO,
  MODULOS,
  MODULOS_EM_CONSTRUCAO,
  moduloDaRota,
  moduloVisivel,
  modulosDisponiveis,
  mostraSeletorDeModulo,
  normalizarModulos,
  podeUsarModulo,
  situacaoNoSeletor,
  usaModuloEmAlgumaOrganizacao,
  vinculoDaLinha,
  type AcessoModulos,
  type ModuloId,
  type VinculoModulos,
  type VinculosLidos,
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

const VINCULO_SO_PRODUCAO: VinculoModulos = { modulosOrganizacao: ["captacao", "producao"], modulosMembro: ["producao"] };
const lidos = (vinculos: readonly VinculoModulos[], extra: Partial<VinculosLidos> = {}): VinculosLidos =>
  ({ superAdmin: false, vinculos, captador: false, erro: false, ...extra });

test("página inicial: o primeiro módulo que a pessoa usa, na ordem dos módulos", () => {
  assert.equal(inicioNaOrganizacao(SO_CAPTACAO), "/dashboard");
  assert.equal(inicioNaOrganizacao(SO_PRESTACAO), "/prestacoes");
  assert.equal(inicioNaOrganizacao(SO_PRODUCAO), "/producoes");
  assert.equal(inicioNaOrganizacao(SUPER), "/dashboard");
  assert.equal(inicioNaOrganizacao({ superAdmin: false, modulosOrganizacao: ["prestacao"], modulosMembro: ["producao"] }), "/configuracoes");

  assert.equal(inicioEmAlgumaOrganizacao(false, [VINCULO_SO_PRODUCAO]), "/producoes");
  assert.equal(inicioEmAlgumaOrganizacao(false, [{ modulosOrganizacao: ["producao", "prestacao"], modulosMembro: ["producao", "prestacao"] }]), "/prestacoes");
  assert.equal(inicioEmAlgumaOrganizacao(false, [VINCULO_SO_PRODUCAO, { modulosOrganizacao: ["captacao"], modulosMembro: ["captacao"] }]), "/dashboard");
  assert.equal(inicioEmAlgumaOrganizacao(false, [{ modulosOrganizacao: ["prestacao"], modulosMembro: ["producao"] }]), "/configuracoes");
  assert.equal(inicioEmAlgumaOrganizacao(false, []), "/configuracoes");
  assert.equal(inicioEmAlgumaOrganizacao(true, []), "/dashboard");
});

// Todas as combinações de módulos de organização e de vínculo.
const CONJUNTOS: ModuloId[][] = [[]];
for (const modulo of MODULOS) for (const conjunto of [...CONJUNTOS]) CONJUNTOS.push([...conjunto, modulo]);
const VINCULOS: VinculoModulos[] = CONJUNTOS.flatMap(org => CONJUNTOS.map(membro => ({ modulosOrganizacao: org, modulosMembro: membro })));

test("a página inicial é sempre de um módulo que a pessoa usa, ou as configurações", () => {
  for (const vinculo of VINCULOS) for (const superAdmin of [false, true]) {
    const acesso = { superAdmin, ...vinculo };
    const inicio = inicioNaOrganizacao(acesso);
    if (inicio === "/configuracoes") assert.equal(modulosDisponiveis(acesso).length, 0);
    else assert.ok(podeUsarModulo(acesso, moduloDaRota(inicio)), inicio);
    const emAlguma = inicioEmAlgumaOrganizacao(superAdmin, [vinculo]);
    if (emAlguma !== "/configuracoes") assert.ok(usaModuloEmAlgumaOrganizacao(superAdmin, [vinculo], moduloDaRota(emAlguma)), emAlguma);
  }
});

test("a linha do banco é lida com as regras do navegador", () => {
  const modulos = { modulos_ativos: ["captacao", "producao"], modulos_leitura: ["prestacao"] };
  const esperado = { modulosMembro: ["producao"], modulosOrganizacao: ["captacao", "prestacao", "producao"] };
  assert.deepEqual(vinculoDaLinha({ modulos_acesso: ["producao"], organizations: modulos }), esperado);
  assert.deepEqual(vinculoDaLinha({ modulos_acesso: ["producao"], organizations: [modulos] }), esperado);
  assert.deepEqual(vinculoDaLinha({ modulos_acesso: null, organizations: null }), { modulosMembro: ["captacao"], modulosOrganizacao: ["captacao"] });
});

test("bloqueio do módulo: entra quem usa; os outros vão para o módulo que usam", () => {
  assert.equal(destinoDoBloqueio("producao", lidos([VINCULO_SO_PRODUCAO])), null);
  assert.equal(destinoDoBloqueio("prestacao", lidos([VINCULO_SO_PRODUCAO])), "/producoes");
  assert.equal(destinoDoBloqueio("producao", lidos([], { superAdmin: true })), null);
  // A leitura falhou: as configurações, nunca a /dashboard (que abre na falha).
  assert.equal(destinoDoBloqueio("producao", lidos([], { erro: true })), "/configuracoes");
});

test("entrada: quem não usa a captação em lugar nenhum não abre a /dashboard", () => {
  assert.equal(destinoDaEntrada(lidos([VINCULO_SO_PRODUCAO])), "/producoes");
  assert.equal(destinoDaEntrada(lidos([{ modulosOrganizacao: ["captacao", "prestacao"], modulosMembro: ["prestacao"] }])), "/prestacoes");
  assert.equal(destinoDaEntrada(lidos([{ modulosOrganizacao: ["prestacao"], modulosMembro: ["producao"] }])), "/configuracoes");
  // Usa a captação em alguma organização: fica, e o navegador decide pela organização aberta.
  assert.equal(destinoDaEntrada(lidos([VINCULO_SO_PRODUCAO, { modulosOrganizacao: ["captacao"], modulosMembro: ["captacao"] }])), null);
  // Na dúvida, abre: erro, super admin, captador, nenhum vínculo.
  assert.equal(destinoDaEntrada(lidos([VINCULO_SO_PRODUCAO], { erro: true })), null);
  assert.equal(destinoDaEntrada(lidos([VINCULO_SO_PRODUCAO], { superAdmin: true })), null);
  assert.equal(destinoDaEntrada(lidos([VINCULO_SO_PRODUCAO], { captador: true })), null);
  assert.equal(destinoDaEntrada(lidos([])), null);
});

/** O servidor numa rota: o proxy na /dashboard, o layout de bloqueio na prestação e na produção. */
function servidor(rota: string, lido: VinculosLidos): string | null {
  if (rota === "/dashboard") return destinoDaEntrada(lido);
  const modulo = moduloDaRota(rota);
  return modulo === "captacao" ? null : destinoDoBloqueio(modulo, lido);
}

/** Segue servidor e navegador (organização aberta) até parar; falha se um destino se repete. */
function percorrer(inicio: string, lido: VinculosLidos, aberta: AcessoModulos | null): string[] {
  const caminho = [inicio];
  for (;;) {
    const atual = caminho[caminho.length - 1];
    const destino = servidor(atual, lido) ?? (aberta ? destinoSemAcesso(atual, aberta) : null);
    if (!destino || destino === atual) return caminho;
    assert.ok(!caminho.includes(destino), `laço: ${[...caminho, destino].join(" → ")}`);
    caminho.push(destino);
  }
}

test("servidor e navegador juntos nunca fazem laço, com uma ou duas organizações", () => {
  let casos = 0;
  const grupos: VinculoModulos[][] = [[]];
  for (const a of VINCULOS) { grupos.push([a]); for (const b of VINCULOS) grupos.push([a, b]); }
  for (const vinculos of grupos) for (const superAdmin of [false, true]) {
    // Leitura certa; vínculos que falharam (vêm vazios); só o perfil falhou (o servidor não sabe do super admin).
    const leituras: VinculosLidos[] = [
      lidos(vinculos, { superAdmin }),
      lidos([], { erro: true }),
      lidos(vinculos, { erro: true }),
    ];
    for (const lido of leituras) for (const aberta of vinculos.length ? vinculos : [null]) {
      for (const inicio of ["/dashboard", "/captacoes", "/prestacoes", "/producoes", "/configuracoes"]) {
        percorrer(inicio, lido, aberta && { superAdmin, ...aberta });
        casos++;
      }
    }
  }
  assert.ok(casos > 100_000, String(casos));
});

test("quem só tem a produção chega nela por qualquer caminho", () => {
  const lido = lidos([VINCULO_SO_PRODUCAO]);
  for (const inicio of ["/dashboard", "/captacoes", "/prestacoes", "/producoes"]) {
    assert.equal(percorrer(inicio, lido, { superAdmin: false, ...VINCULO_SO_PRODUCAO }).at(-1), "/producoes", inicio);
  }
  // Já no servidor: a /dashboard nem abre.
  assert.deepEqual(percorrer("/dashboard", lido, null), ["/dashboard", "/producoes"]);
});
