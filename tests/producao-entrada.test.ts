import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { NextRequest } from "next/server";
import { proxy } from "../proxy";
import { destinoDoConvite } from "../lib/equipe-modulos";
import {
  destinoSemAcesso,
  INICIO_DO_MODULO,
  MODULOS,
  moduloDaRota,
  modulosDaOrganizacao,
  normalizarModulos,
  paginaDeEntrada,
  podeUsarModulo,
  type AcessoModulos,
  type VinculoModulos,
} from "../lib/modulos";
import { destinoDeQuemNaoUsa, entradaDoAcesso, type AcessoAosModulos } from "../lib/modulos-acesso";
import { ITENS_DO_MENU, PERFIS, destinoAoAbrir, inicioDo } from "../e2e/perfis";
import { linhasDeVinculo, type LinhaDeVinculo } from "./_helpers/modulos-grade";
import {
  CHAVE_FALSA,
  cookieDaSessao,
  instalarSupabaseFalso,
  URL_FALSA,
  type Falhas,
  type UsuarioFalso,
} from "./_helpers/supabase-fetch-falso";

// PD0.3: o caminho de quem usa só a produção, salto a salto, e a prova de que quem usa a
// captação e/ou a prestação segue exatamente como antes.
//
// 1. Convite: o e-mail leva a /api/auth/callback?next=/producoes (destinoDoConvite).
// 2. Login, Google ou raiz: a pessoa pede "/", "/login" ou "/dashboard" (proxy.ts).
// 3. O proxy a manda para a página inicial do módulo que usa, antes de qualquer tela.
// 4. /producoes: o layout de servidor deixa entrar (ou manda quem não usa a produção para a página dele).
// 5. Qualquer rota da captação: o layout de cliente (destinoSemAcesso) leva a /producoes.

process.env.NEXT_PUBLIC_SUPABASE_URL = URL_FALSA;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = CHAVE_FALSA;

const org = (ativos: string[], leitura: string[] = []) => ({ modulos_ativos: ativos, modulos_leitura: leitura });

function usuario(indice: number, nome: string, superAdmin: boolean, vinculos: LinhaDeVinculo[]): UsuarioFalso {
  return { id: `00000000-0000-4000-8000-${String(indice).padStart(12, "0")}`, email: `${nome}@exemplo.test`, superAdmin, vinculos };
}

const SO_CAPTACAO = usuario(1, "so-captacao", false, [{ modulos_acesso: ["captacao"], organizations: org(["captacao"]) }]);
const SO_PRESTACAO = usuario(2, "so-prestacao", false, [{ modulos_acesso: ["prestacao"], organizations: org(["captacao", "prestacao"]) }]);
const CAPTACAO_E_PRESTACAO = usuario(3, "captacao-prestacao", false, [{ modulos_acesso: ["captacao", "prestacao"], organizations: org(["captacao", "prestacao"]) }]);
const SO_PRODUCAO = usuario(4, "so-producao", false, [{ modulos_acesso: ["producao"], organizations: org(["captacao", "producao"]) }]);
const CAPTACAO_E_PRODUCAO = usuario(5, "captacao-producao", false, [{ modulos_acesso: ["captacao", "producao"], organizations: org(["captacao", "producao"]) }]);
const PRODUCAO_SO_PARA_LEITURA = usuario(6, "producao-leitura", false, [{ modulos_acesso: ["producao"], organizations: org(["captacao"], ["producao"]) }]);
const SUPER_ADMIN = usuario(7, "super-admin", true, [{ modulos_acesso: ["captacao"], organizations: org(["captacao"]) }]);
const SEM_VINCULOS = usuario(8, "sem-vinculos", false, []);
const COLUNAS_NULAS = usuario(9, "colunas-nulas", false, [{ modulos_acesso: ["producao"], organizations: { modulos_ativos: null, modulos_leitura: null } }]);
const PRODUCAO_EM_DUAS = usuario(10, "producao-duas-orgs", false, [
  { modulos_acesso: ["producao"], organizations: org(["captacao", "producao"]) },
  { modulos_acesso: ["producao"], organizations: org(["captacao", "producao"]) },
]);
const TODOS = [SO_CAPTACAO, SO_PRESTACAO, CAPTACAO_E_PRESTACAO, SO_PRODUCAO, CAPTACAO_E_PRODUCAO, PRODUCAO_SO_PARA_LEITURA, SUPER_ADMIN, SEM_VINCULOS, COLUNAS_NULAS, PRODUCAO_EM_DUAS];

type Pedido = { documento?: boolean };

/** Passa o pedido pelo proxy de verdade, com o cliente do Supabase de verdade e o servidor falso. */
async function pedir(pessoa: UsuarioFalso | null, caminho: string, { documento = true }: Pedido = {}) {
  const cabecalhos: Record<string, string> = {
    "sec-fetch-dest": documento ? "document" : "empty",
    "x-forwarded-for": "203.0.113.7",
  };
  if (pessoa) cabecalhos.cookie = cookieDaSessao(pessoa);
  const resposta = await proxy(new NextRequest(new URL(caminho, "http://localhost:3000"), { headers: cabecalhos }));
  const local = resposta.headers.get("location");
  return { destino: local ? `${new URL(local).pathname}${new URL(local).search}` : null };
}

async function comServidorFalso<T>(pessoas: readonly UsuarioFalso[], rodar: (servidor: ReturnType<typeof instalarSupabaseFalso>) => Promise<T>, falhas: Falhas = {}): Promise<T> {
  const servidor = instalarSupabaseFalso(pessoas, falhas);
  try {
    return await rodar(servidor);
  } finally {
    servidor.restaurar();
  }
}

// ─── Salto 1: o convite ─────────────────────────────────────────────────────

test("convite só para a produção leva a /producoes, e a pessoa pode abri-la", () => {
  const destino = destinoDoConvite("colaborador", ["producao"]);
  assert.equal(destino, "/producoes");
  assert.equal(destino, INICIO_DO_MODULO.producao);
  const acesso: AcessoModulos = { superAdmin: false, modulosOrganizacao: ["captacao", "producao"], modulosMembro: ["producao"] };
  assert.equal(destinoSemAcesso(destino, acesso), null);
  // Quem tem a captação também continua indo para as configurações, como antes.
  assert.equal(destinoDoConvite("colaborador", ["captacao", "producao"]), "/configuracoes");
  assert.equal(destinoDoConvite("colaborador", ["prestacao"]), "/prestacoes");
});

test("a volta do e-mail só repassa o next do convite; sem next, vale /dashboard e o proxy leva ao módulo", async () => {
  // A rota de convite monta o link com destinoDoConvite (tests/equipe-rotas.test.ts confere "next=/producoes");
  // a rota de volta (callback) não decide módulo nenhum: entrega a pessoa a esse caminho. Sem next (login com o
  // Google, link de recuperação), entrega em /dashboard, e o proxy dos testes abaixo a leva a /producoes.
  const texto = await readFile("app/api/auth/callback/route.ts", "utf8");
  assert.ok(texto.includes('searchParams.get("next") ?? "/dashboard"'));
  assert.ok(texto.includes('next.startsWith("/") ? next : "/dashboard"'));
  assert.ok(texto.includes("NextResponse.redirect(`${origin}${destino}`)"));
});

// ─── Saltos 2 e 3: a raiz, o login e /dashboard ─────────────────────────────

test("o proxy leva cada perfil à página inicial do módulo que usa, em todas as portas de entrada", async () => {
  const esperado: [UsuarioFalso, string][] = [
    [SO_CAPTACAO, "/dashboard"],
    [SO_PRESTACAO, "/prestacoes"],
    [CAPTACAO_E_PRESTACAO, "/dashboard"],
    [SO_PRODUCAO, "/producoes"],
    [CAPTACAO_E_PRODUCAO, "/dashboard"],
    [PRODUCAO_SO_PARA_LEITURA, "/producoes"],
    [SUPER_ADMIN, "/dashboard"],
    [SEM_VINCULOS, "/dashboard"],
    [COLUNAS_NULAS, "/dashboard"],
    [PRODUCAO_EM_DUAS, "/producoes"],
  ];
  await comServidorFalso(TODOS, async () => {
    for (const [pessoa, entrada] of esperado) {
      assert.equal((await pedir(pessoa, "/")).destino, entrada, `${pessoa.email}: raiz`);
      assert.equal((await pedir(pessoa, "/login")).destino, entrada, `${pessoa.email}: login`);
      assert.equal((await pedir(pessoa, "/login?next=%2Fprestacoes")).destino, entrada, `${pessoa.email}: login com next`);
      const dashboard = (await pedir(pessoa, "/dashboard")).destino;
      assert.equal(dashboard, entrada === "/dashboard" ? null : entrada, `${pessoa.email}: /dashboard`);
    }
  });
});

test("o proxy só tira da captação quem abre a página; a navegação dentro do app e a pré-busca seguem pelo layout de cliente", async () => {
  await comServidorFalso(TODOS, async servidor => {
    for (const pessoa of TODOS) {
      assert.equal((await pedir(pessoa, "/dashboard", { documento: false })).destino, null, pessoa.email);
    }
    assert.equal(servidor.consultasAoBanco().length, 0, "navegação dentro do app não consulta o banco");
  });
});

test("o proxy não consulta o banco fora da raiz, do login e de /dashboard, e não decide módulo de outras rotas", async () => {
  await comServidorFalso(TODOS, async servidor => {
    for (const rota of ["/producoes", "/producoes/datas/1", "/prestacoes", "/captacoes", "/atividades", "/configuracoes", "/meu-plano"]) {
      for (const pessoa of TODOS) assert.equal((await pedir(pessoa, rota)).destino, null, `${pessoa.email} ${rota}`);
    }
    assert.equal(servidor.consultasAoBanco().length, 0);
  });
});

test("quem usa a captação paga só a consulta de /dashboard aberto pela barra de endereço", async () => {
  await comServidorFalso([SO_CAPTACAO], async servidor => {
    assert.equal((await pedir(SO_CAPTACAO, "/dashboard")).destino, null);
    // As duas consultas saem juntas: a ordem não importa.
    assert.deepEqual(servidor.consultasAoBanco().sort(), ["GET /rest/v1/organization_members", "GET /rest/v1/profiles"]);
  });
});

test("a busca da página vai junto no redirecionamento (aviso de impersonação, por exemplo)", async () => {
  await comServidorFalso([SO_PRODUCAO, SO_CAPTACAO], async () => {
    assert.equal((await pedir(SO_PRODUCAO, "/dashboard?_imp=1&_imp_email=a%40b.com")).destino, "/producoes?_imp=1&_imp_email=a%40b.com");
    assert.equal((await pedir(SO_CAPTACAO, "/dashboard?_imp=1&_imp_email=a%40b.com")).destino, null);
  });
});

test("se a consulta falhar, ninguém sai da captação por isso", async () => {
  for (const falhas of [{ vinculos: true }, { perfil: true }]) {
    await comServidorFalso([SO_PRODUCAO], async () => {
      assert.equal((await pedir(SO_PRODUCAO, "/dashboard")).destino, null, JSON.stringify(falhas));
      assert.equal((await pedir(SO_PRODUCAO, "/")).destino, "/dashboard", JSON.stringify(falhas));
      assert.equal((await pedir(SO_PRODUCAO, "/login")).destino, "/dashboard", JSON.stringify(falhas));
    }, falhas);
  }
});

test("se o banco travar, a abertura de /dashboard não fica presa: o proxy desiste da leitura e deixa passar", async () => {
  await comServidorFalso([SO_PRODUCAO], async () => {
    const inicio = Date.now();
    assert.equal((await pedir(SO_PRODUCAO, "/dashboard")).destino, null);
    const demorou = Date.now() - inicio;
    assert.ok(demorou >= 1_400 && demorou < 4_000, `esperou o prazo da leitura (${demorou} ms)`);
  }, { vinculosParados: true });
});

test("deslogado: rota privada vai para o login com o caminho de volta; a landing e o login seguem abertos", async () => {
  await comServidorFalso([], async () => {
    assert.equal((await pedir(null, "/producoes")).destino, "/login?next=%2Fproducoes");
    assert.equal((await pedir(null, "/prestacoes/abc")).destino, "/login?next=%2Fprestacoes%2Fabc");
    assert.equal((await pedir(null, "/dashboard")).destino, "/login?next=%2Fdashboard");
    assert.equal((await pedir(null, "/")).destino, null);
    assert.equal((await pedir(null, "/login")).destino, null);
  });
});

// ─── Salto 4: o bloqueio de servidor de cada módulo ─────────────────────────

function acessoDe(pessoa: UsuarioFalso): AcessoAosModulos {
  return {
    superAdmin: pessoa.superAdmin,
    vinculos: pessoa.vinculos.map(v => ({
      modulosMembro: normalizarModulos(v.modulos_acesso),
      modulosOrganizacao: modulosDaOrganizacao(v.organizations?.modulos_ativos, v.organizations?.modulos_leitura),
    })),
    incompleto: false,
  };
}

test("o layout da produção deixa entrar quem usa a produção (em vigor ou só para leitura) e manda os outros para a página deles", () => {
  const esperado: [UsuarioFalso, string | null][] = [
    [SO_CAPTACAO, "/dashboard"],
    [SO_PRESTACAO, "/prestacoes"],
    [CAPTACAO_E_PRESTACAO, "/dashboard"],
    [SO_PRODUCAO, null],
    [CAPTACAO_E_PRODUCAO, null],
    [PRODUCAO_SO_PARA_LEITURA, null],
    [PRODUCAO_EM_DUAS, null],
    [SUPER_ADMIN, null],
    [SEM_VINCULOS, "/dashboard"],
    [COLUNAS_NULAS, "/dashboard"],
  ];
  for (const [pessoa, destino] of esperado) assert.equal(destinoDeQuemNaoUsa("producao", acessoDe(pessoa)), destino, pessoa.email);
});

test("o layout da prestação deixa entrar quem a usa; quem só usa a produção vai para /producoes", () => {
  const esperado: [UsuarioFalso, string | null][] = [
    [SO_CAPTACAO, "/dashboard"],
    [SO_PRESTACAO, null],
    [CAPTACAO_E_PRESTACAO, null],
    [SO_PRODUCAO, "/producoes"],
    [CAPTACAO_E_PRODUCAO, "/dashboard"],
    [SUPER_ADMIN, null],
    [SEM_VINCULOS, "/dashboard"],
  ];
  for (const [pessoa, destino] of esperado) assert.equal(destinoDeQuemNaoUsa("prestacao", acessoDe(pessoa)), destino, pessoa.email);
});

test("todo módulo com rota própria tem layout de servidor que o exige, e a produção não é exceção", async () => {
  for (const modulo of MODULOS.filter(m => m !== "captacao")) {
    const arquivo = `app/(dashboard)${INICIO_DO_MODULO[modulo]}/layout.tsx`;
    const texto = await readFile(arquivo, "utf8");
    assert.ok(!/^["']use client["']/m.test(texto), `${arquivo} é de servidor`);
    assert.ok(texto.includes(`await exigirModulo("${modulo}")`), `${arquivo} exige o módulo`);
    assert.ok(texto.includes("export const metadata"), `${arquivo} publica o título da aba`);
  }
});

test("a página inicial da produção é a agenda, e a agenda tem estado vazio", async () => {
  const pagina = await readFile("app/(dashboard)/producoes/page.tsx", "utf8");
  assert.ok(pagina.startsWith('"use client"'));
  assert.match(pagina, /AgendaDaProducao/);
  const agenda = await readFile("components/producao/AgendaDaProducao.tsx", "utf8");
  assert.match(agenda, /ListEmptyState/);
  // O bloqueio por módulo é do layout de servidor; a agenda só lê com as regras do banco (cliente da pessoa).
  assert.match(agenda, /clienteDaProducao\(createClient\(\)\)/);
});

// ─── Salto 5 e a prova de que não há laço ───────────────────────────────────

type Pessoa = { superAdmin: boolean; orgs: VinculoModulos[] };

const ROTAS_DE_PARTIDA = [
  "/", "/login", "/dashboard",
  "/atividades", "/projetos", "/projetos/1", "/patrocinadores", "/comparativo", "/editais-abertos", "/empresas-crm",
  "/captacoes", "/captacoes/1", "/editais-inscritos", "/proponentes", "/captadores", "/contatos", "/contas-patrocinio",
  "/prestacoes", "/prestacoes/1", "/prestacoes/fornecedores",
  "/producoes", "/producoes/datas/1",
  "/configuracoes", "/meu-plano", "/notificacoes",
];

/**
 * Uma abertura de página e todos os redirecionamentos que se seguem, na ordem em que acontecem:
 * proxy (só abertura de página), bloqueio de servidor do módulo e layout de cliente, que usa a
 * organização aberta. Devolve o caminho final e o número de redirecionamentos.
 */
function seguir(pessoa: Pessoa, inicio: string, orgAberta: number, documento: boolean): { final: string; saltos: number } {
  const acesso: AcessoAosModulos = { superAdmin: pessoa.superAdmin, vinculos: pessoa.orgs, incompleto: false };
  let caminho = inicio;
  let ehDocumento = documento;
  for (let saltos = 0; saltos <= 8; saltos++) {
    let proximo: string | null = null;
    const dono = moduloDaRota(caminho);
    if (caminho === "/" || caminho.startsWith("/login")) {
      proximo = entradaDoAcesso(acesso);
    } else if (caminho === "/dashboard" && ehDocumento) {
      const entrada = entradaDoAcesso(acesso);
      proximo = entrada === INICIO_DO_MODULO.captacao ? null : entrada;
    }
    if (!proximo && dono !== "captacao") proximo = destinoDeQuemNaoUsa(dono, acesso);
    if (proximo) {
      caminho = proximo;
      continue;
    }
    const aberta = pessoa.orgs[orgAberta];
    if (aberta && caminho !== "/" && !caminho.startsWith("/login")) {
      const doCliente = destinoSemAcesso(caminho, { superAdmin: pessoa.superAdmin, modulosOrganizacao: aberta.modulosOrganizacao, modulosMembro: aberta.modulosMembro });
      if (doCliente && doCliente !== caminho) {
        caminho = doCliente;
        ehDocumento = false;
        continue;
      }
    }
    return { final: caminho, saltos };
  }
  throw new Error(`laço de redirecionamento a partir de ${inicio}`);
}

function vinculo(linha: LinhaDeVinculo): VinculoModulos {
  return {
    modulosMembro: normalizarModulos(linha.modulos_acesso),
    modulosOrganizacao: modulosDaOrganizacao(linha.organizations?.modulos_ativos, linha.organizations?.modulos_leitura),
  };
}

const ROTAS_COMUNS = ["/configuracoes", "/meu-plano", "/notificacoes"];

test("nenhum caminho de redirecionamento forma laço, e todos terminam numa página que a pessoa pode abrir", () => {
  const linhas = linhasDeVinculo().map(vinculo);
  const pessoas: Pessoa[] = [{ superAdmin: true, orgs: [] }, { superAdmin: true, orgs: [linhas[0]] }, { superAdmin: false, orgs: [] }];
  for (const v of linhas) pessoas.push({ superAdmin: false, orgs: [v] });
  // Duas organizações: pares de todos os tipos (a primeira a cada 9, contra todas as outras).
  for (let i = 0; i < linhas.length; i += 9) for (const outra of linhas) pessoas.push({ superAdmin: false, orgs: [linhas[i], outra] });

  for (const pessoa of pessoas) {
    for (let aberta = 0; aberta < Math.max(1, pessoa.orgs.length); aberta++) {
      const orgAberta = pessoa.orgs[aberta];
      const podeNaAberta = (modulo: (typeof MODULOS)[number]) =>
        pessoa.superAdmin || Boolean(orgAberta && orgAberta.modulosOrganizacao.includes(modulo) && orgAberta.modulosMembro.includes(modulo));
      const temModuloNaAberta = MODULOS.some(podeNaAberta);
      for (const inicio of ROTAS_DE_PARTIDA) {
        for (const documento of [true, false]) {
          const { final, saltos } = seguir(pessoa, inicio, aberta, documento);
          const onde = JSON.stringify({ pessoa, aberta, inicio, documento, final });
          assert.ok(saltos <= 3, `redirecionamentos demais: ${onde}`);
          if (!pessoa.orgs.length && !pessoa.superAdmin) continue;
          // Terminou onde a pessoa pode estar: numa rota comum, num módulo que usa na organização aberta,
          // ou, sem nenhum módulo nela, nas configurações (o único lugar que sobra) ou na página que pediu.
          if (ROTAS_COMUNS.some(r => final === r || final.startsWith(`${r}/`))) continue;
          if (final === "/" || final.startsWith("/login")) assert.fail(`parou na porta de entrada: ${onde}`);
          if (temModuloNaAberta) assert.ok(podeNaAberta(moduloDaRota(final)), `parou onde a pessoa não pode: ${onde}`);
        }
      }
    }
  }
});

test("quem só usa a produção entra em /producoes sem passar pela captação, venha de onde vier", () => {
  const so: Pessoa = { superAdmin: false, orgs: [vinculo({ modulos_acesso: ["producao"], organizations: org(["captacao", "producao"]) })] };
  for (const inicio of ROTAS_DE_PARTIDA.filter(r => !ROTAS_COMUNS.some(c => r.startsWith(c)))) {
    // As páginas da própria produção ficam onde estão; todas as outras levam à página inicial dela.
    const esperado = moduloDaRota(inicio) === "producao" ? inicio : "/producoes";
    assert.equal(seguir(so, inicio, 0, false).final, esperado, `${inicio} (navegação)`);
    assert.equal(seguir(so, inicio, 0, true).final, esperado, `${inicio} (barra de endereço)`);
  }
  // Pelas três portas de entrada, a abertura de página termina em /producoes com um só redirecionamento.
  for (const porta of ["/", "/login", "/dashboard"]) {
    const { final, saltos } = seguir(so, porta, 0, true);
    assert.equal(final, "/producoes", porta);
    assert.equal(saltos, 1, porta);
  }
});

test("quem usa a captação e/ou a prestação chega à mesma página de antes, pelas mesmas portas", () => {
  // Antes: o proxy mandava a raiz e o login para /dashboard e o layout de cliente (destinoSemAcesso, que
  // não mudou) corrigia depois. Esse é o destino final de referência; o número de redirecionamentos de
  // antes era 1 para a raiz e o login e 0 para /dashboard, mais 1 quando o layout de cliente corrigia.
  for (const linha of linhasDeVinculo()) {
    const v = vinculo(linha);
    const acesso: AcessoModulos = { superAdmin: false, modulosOrganizacao: v.modulosOrganizacao, modulosMembro: v.modulosMembro };
    const antes = destinoSemAcesso("/dashboard", acesso) ?? "/dashboard";
    const usaCaptacao = podeUsarModulo(acesso, "captacao");
    for (const porta of ["/", "/login", "/dashboard"]) {
      const { final, saltos } = seguir({ superAdmin: false, orgs: [v] }, porta, 0, true);
      const onde = `${JSON.stringify(linha)} ${porta}`;
      assert.equal(final, antes, onde);
      const saltosAntes = (porta === "/dashboard" ? 0 : 1) + (antes === "/dashboard" ? 0 : 1);
      if (usaCaptacao) assert.equal(saltos, saltosAntes, `quem usa a captação passa pelos mesmos redirecionamentos: ${onde}`);
      else assert.ok(saltos <= saltosAntes, `nunca mais redirecionamentos que antes: ${onde}`);
    }
  }
});

test("a página de entrada coincide com o destino que o layout de cliente daria a quem tem uma só organização", () => {
  for (const linha of linhasDeVinculo()) {
    const v = vinculo(linha);
    const doCliente = destinoSemAcesso("/dashboard", { superAdmin: false, modulosOrganizacao: v.modulosOrganizacao, modulosMembro: v.modulosMembro });
    const entrada = paginaDeEntrada(false, [v]);
    // Sem nenhum módulo em uso o cliente manda para as configurações e a entrada fica na captação: o proxy não redireciona.
    if (doCliente === "/configuracoes") assert.equal(entrada, "/dashboard");
    else assert.equal(entrada, doCliente ?? "/dashboard", JSON.stringify(v));
  }
});

test("o que o e2e por perfil espera é o que o app decide, e os itens do menu existem no layout", async () => {
  const rotas = ["/dashboard", "/captacoes", "/contatos", "/projetos", "/prestacoes", "/prestacoes/fornecedores", "/producoes", "/configuracoes"];
  for (const perfil of PERFIS) {
    // A organização do perfil tem a captação (toda organização tem) e os módulos que a pessoa usa.
    const pessoa: Pessoa = {
      superAdmin: false,
      orgs: [{ modulosOrganizacao: MODULOS.filter(m => m === "captacao" || perfil.modulos.includes(m)), modulosMembro: perfil.modulos }],
    };
    for (const rota of rotas) assert.equal(seguir(pessoa, rota, 0, true).final, destinoAoAbrir(perfil, rota), `${perfil.id} ${rota}`);
    for (const porta of ["/", "/login", "/dashboard"]) assert.equal(seguir(pessoa, porta, 0, true).final, inicioDo(perfil), `${perfil.id} ${porta}`);
  }
  assert.deepEqual(PERFIS.map(p => p.id), ["so-captacao", "so-prestacao", "so-producao", "captacao-producao"]);

  const layout = await readFile("app/(dashboard)/layout.tsx", "utf8");
  for (const itens of Object.values(ITENS_DO_MENU)) {
    for (const item of itens) assert.ok(layout.includes(`label: "${item}"`), `o menu não tem "${item}"`);
  }
});
