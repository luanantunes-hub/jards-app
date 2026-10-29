import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { NextRequest } from "next/server";
import { POST as basePublicaPOST } from "../app/api/mcp/empresas/base-publica/route";
import { GET as patrocinadoresGET } from "../app/api/mcp/patrocinadores-publicos/route";
import { SEM_PARAMETROS, dependenciasDaRota } from "../lib/mcp/rota";
import { bancoFalso, consultasDe, type Consulta, type Resolvedor } from "./_helpers/banco-falso";

const ORG = "5c1b0f0e-0000-4000-8000-000000000001";
const OUTRA_ORG = "5c1b0f0e-0000-4000-8000-0000000000f2";
const USUARIO = "5c1b0f0e-0000-4000-8000-000000000002";
const PUB_A = "5c1b0f0e-0000-4000-8000-0000000000a1";
const PUB_B = "5c1b0f0e-0000-4000-8000-0000000000b2";
const PUB_C = "5c1b0f0e-0000-4000-8000-0000000000c3";
const CRM_A = "5c1b0f0e-0000-4000-8000-0000000001a1";
const CRM_B = "5c1b0f0e-0000-4000-8000-0000000001b2";

const originais = { ...dependenciasDaRota };
afterEach(() => Object.assign(dependenciasDaRota, originais));

function preparar(resolver: Resolvedor, organizacoes: string[] = [ORG]) {
  const { admin, consultas } = bancoFalso(resolver);
  dependenciasDaRota.autenticar = async () => ({ userId: USUARIO, organizationIds: organizacoes, paidOrganizationIds: organizacoes, scope: "write" });
  dependenciasDaRota.criarAdmin = () => admin;
  return consultas;
}

const pedidoGet = (caminho: string) => new NextRequest(`https://app.jards.test/api/mcp${caminho}`, { headers: { authorization: "Bearer teste" } });
const pedidoPost = (corpo: unknown) =>
  new NextRequest("https://app.jards.test/api/mcp/empresas/base-publica", {
    method: "POST",
    headers: { authorization: "Bearer teste", "content-type": "application/json" },
    body: JSON.stringify(corpo),
  });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;
async function ler(resposta: Response): Promise<{ status: number; corpo: Json }> {
  return { status: resposta.status, corpo: (await resposta.json()) as Json };
}

const ehDe = (consulta: Consulta, tabela: string, acao: Consulta["acao"] = "select") => consulta.tabela === tabela && consulta.acao === acao;
const rpcs = (consultas: readonly Consulta[], nome: string) => consultasDe(consultas, nome, "rpc");

const FICHA_A = { id: PUB_A, nome: "Ademicon", site: "https://ademicon.com.br", cidade: "Curitiba", estado: "PR", setor: "Financeiro", tem_detalhe: true };
const FICHA_B = { id: PUB_B, nome: "Arauco", site: "https://arauco.com", cidade: "Curitiba", estado: "PR", setor: "Papel e celulose", tem_detalhe: false };

// ─── Listagem da base pública ───────────────────────────────────────────────

test("a busca por cidade e estado vai para o banco normalizada, com página, total e o custo dos contatos", async () => {
  const consultas = preparar((c) => {
    if (ehDe(c, "fn_buscar_empresas_publicas", "rpc")) {
      return {
        data: [
          { ...FICHA_A, contatos_disponiveis: 4, contatos_liberados: false, total: "62" },
          { ...FICHA_B, contatos_disponiveis: 2, contatos_liberados: true, total: "62" },
          { id: PUB_C, nome: "Sem contatos", site: null, cidade: "Curitiba", estado: "PR", setor: null, tem_detalhe: true, contatos_disponiveis: 0, contatos_liberados: false, total: "62" },
        ],
      };
    }
    if (ehDe(c, "fn_creditos_disponiveis", "rpc")) return { data: 12 };
  });
  const { status, corpo } = await ler(await patrocinadoresGET(pedidoGet("/patrocinadores-publicos?cidade=Curitiba&estado=Paraná&setor=Logística&limite=3&deslocamento=3")));
  assert.equal(status, 200);

  assert.deepEqual(rpcs(consultas, "fn_buscar_empresas_publicas")[0].valores, {
    p_organization_id: ORG,
    p_busca: null,
    p_cidade: "Curitiba",
    p_estado: "PR",
    p_setor: "Logística",
    p_limite: 3,
    p_deslocamento: 3,
  });
  assert.equal(corpo.total, 62);
  assert.equal(corpo.limite, 3);
  assert.equal(corpo.deslocamento, 3);
  assert.equal(corpo.proximo_deslocamento, 6);
  assert.equal(corpo.creditos_disponiveis, 12);
  assert.deepEqual(
    corpo.patrocinadores.map((p: Json) => [p.nome, p.contatos_disponiveis, p.contatos_liberados, p.custo_para_ver_contatos]),
    [["Ademicon", 4, false, 1], ["Arauco", 2, true, 0], ["Sem contatos", 0, false, 0]]
  );
  assert.equal(corpo.patrocinadores[0].cidade, "Curitiba");
  assert.equal(corpo.patrocinadores[0].estado, "PR");
  assert.equal(corpo.patrocinadores[0].total, undefined, "o total vai uma vez, não em cada empresa");
});

test("na última página não há próxima, e a busca livre vale para nome, cidade e setor", async () => {
  const consultas = preparar((c) => {
    if (ehDe(c, "fn_buscar_empresas_publicas", "rpc")) return { data: [{ ...FICHA_A, contatos_disponiveis: 1, contatos_liberados: false, total: 21 }] };
    if (ehDe(c, "fn_creditos_disponiveis", "rpc")) return { data: 0 };
  });
  const { corpo } = await ler(await patrocinadoresGET(pedidoGet("/patrocinadores-publicos?busca=Curitiba&limite=20&deslocamento=20")));
  assert.equal(corpo.total, 21);
  assert.equal(corpo.proximo_deslocamento, null);
  assert.equal((rpcs(consultas, "fn_buscar_empresas_publicas")[0].valores as Json).p_busca, "Curitiba");
});

test("página além do fim do resultado ainda diz o total", async () => {
  const consultas = preparar((c) => {
    if (ehDe(c, "fn_buscar_empresas_publicas", "rpc")) {
      return (c.valores as Json).p_deslocamento === 0 ? { data: [{ ...FICHA_A, contatos_disponiveis: 0, contatos_liberados: false, total: 62 }] } : { data: [] };
    }
    if (ehDe(c, "fn_creditos_disponiveis", "rpc")) return { data: 3 };
  });
  const { corpo } = await ler(await patrocinadoresGET(pedidoGet("/patrocinadores-publicos?cidade=Curitiba&deslocamento=500")));
  assert.deepEqual(corpo.patrocinadores, []);
  assert.equal(corpo.total, 62);
  assert.equal(corpo.proximo_deslocamento, null);
  assert.equal(rpcs(consultas, "fn_buscar_empresas_publicas").length, 2);
});

test("estado que não existe diz como escrever, e nenhuma consulta é feita", async () => {
  const consultas = preparar(() => undefined);
  const { status, corpo } = await ler(await patrocinadoresGET(pedidoGet("/patrocinadores-publicos?estado=Atlantida")));
  assert.equal(status, 400);
  assert.match(corpo.error, /sigla de um estado/);
  assert.equal(consultas.length, 0);
});

test("quem está em mais de uma organização consulta a base sem informar qual (só não vê o que já está liberado)", async () => {
  const consultas = preparar((c) => {
    if (ehDe(c, "fn_buscar_empresas_publicas", "rpc")) return { data: [{ ...FICHA_A, contatos_disponiveis: 1, contatos_liberados: false, total: 1 }] };
  }, [ORG, OUTRA_ORG]);
  const { status, corpo } = await ler(await patrocinadoresGET(pedidoGet("/patrocinadores-publicos?busca=ademicon")));
  assert.equal(status, 200);
  assert.equal((rpcs(consultas, "fn_buscar_empresas_publicas")[0].valores as Json).p_organization_id, null);
  assert.equal(corpo.creditos_disponiveis, undefined);
  assert.equal(rpcs(consultas, "fn_creditos_disponiveis").length, 0);
});

test("organização informada que não é da pessoa continua sendo recusada na base pública", async () => {
  preparar(() => undefined);
  const { status } = await ler(await patrocinadoresGET(pedidoGet(`/patrocinadores-publicos?organization_id=${OUTRA_ORG}`)));
  assert.equal(status, 403);
});

// ─── Ação em lote ───────────────────────────────────────────────────────────

/** Banco do lote: duas empresas públicas (A tem contatos bloqueados; B não tem detalhe e já é livre), nada no CRM ainda. */
function bancoDoLote(opcoes: { saldo?: number; noCrm?: Array<Record<string, unknown>>; falhaNaSegunda?: boolean; fichas?: Array<Record<string, unknown>> } = {}): Resolvedor {
  let desbloqueios = 0;
  return (c) => {
    if (ehDe(c, "empresas")) return { data: opcoes.fichas ?? [FICHA_A, FICHA_B] };
    if (ehDe(c, "responsaveis")) return { data: [{ empresa_id: PUB_A }, { empresa_id: PUB_A }, { empresa_id: PUB_B }] };
    if (ehDe(c, "desbloqueios")) return { data: [] };
    if (ehDe(c, "fn_creditos_disponiveis", "rpc")) return { data: opcoes.saldo ?? 5 };
    if (ehDe(c, "empresas_crm", "insert")) {
      const novas = c.valores as Array<Json>;
      return { data: novas.map((n) => ({ id: n.empresa_pub_id === PUB_A ? CRM_A : CRM_B, nome: n.nome, empresa_pub_id: n.empresa_pub_id, cidade: n.cidade, estado: n.estado })) };
    }
    if (ehDe(c, "empresas_crm")) return { data: opcoes.noCrm ?? [] };
    if (ehDe(c, "fn_desbloquear_empresa_as", "rpc")) {
      desbloqueios += 1;
      return opcoes.falhaNaSegunda && desbloqueios === 2 ? { error: { message: "Sem créditos disponíveis. Faça upgrade do plano." } } : { data: { sucesso: true, consumiu_credito: true } };
    }
    if (ehDe(c, "fn_responsaveis_empresa_org", "rpc")) {
      return { data: [{ id: "r1", nome: "Ana Souza", cargo: "Gerente de marketing", email: "ana@exemplo.com", linkedin_url: null, fonte: "proprietaria", mascarado: false }] };
    }
  };
}

test("o lote cria as empresas no CRM com a localização da base e mostra o custo, sem gastar crédito", async () => {
  const consultas = preparar(bancoDoLote());
  const { status, corpo } = await ler(await basePublicaPOST(pedidoPost({ empresa_pub_ids: [PUB_A, PUB_B] }), SEM_PARAMETROS));
  assert.equal(status, 201);

  const inseridas = consultasDe(consultas, "empresas_crm", "insert")[0].valores as Json[];
  assert.deepEqual(inseridas[0], {
    organization_id: ORG,
    account_id: USUARIO,
    nome: "Ademicon",
    nome_key: "ademicon",
    tipo: "prospect",
    setor: "Financeiro",
    site: "https://ademicon.com.br",
    domain_key: "ademicon.com.br",
    cidade: "Curitiba",
    estado: "PR",
    localizacao: "Curitiba-PR",
    empresa_pub_id: PUB_A,
  });
  assert.equal(inseridas.length, 2);

  assert.equal(corpo.resumo.criadas, 2);
  assert.equal(corpo.resumo.ja_existiam, 0);
  assert.deepEqual(corpo.resumo.contatos, { empresas_com_contatos: 2, liberados_agora: 0, ainda_bloqueados: 1, custo_para_liberar_creditos: 1, creditos_disponiveis: 5 });
  assert.match(corpo.oferta_de_contatos, /custa 1 crédito\(s\) \(saldo: 5\)/);
  assert.match(corpo.oferta_de_contatos, /confirmar_custo_creditos: 1/);
  assert.equal(corpo.empresas[0].url, `https://app.jards.test/empresas-crm/${CRM_A}`);
  assert.equal(corpo.empresas[0].custo_para_ver_contatos, 1);
  assert.equal(corpo.empresas[1].custo_para_ver_contatos, 0, "empresa sem detalhe tem os contatos livres");
  assert.equal(corpo.empresas[0].contatos, undefined, "contato só vai quando a pessoa pediu para liberar");
  assert.equal(rpcs(consultas, "fn_desbloquear_empresa_as").length, 0);
});

test("liberar contatos sem confirmar o custo exato não cria nem cobra nada, e diz o custo", async () => {
  const consultas = preparar(bancoDoLote());
  for (const confirmacao of [undefined, 0, 2]) {
    const { status, corpo } = await ler(
      await basePublicaPOST(pedidoPost({ empresa_pub_ids: [PUB_A, PUB_B], desbloquear_contatos: true, ...(confirmacao === undefined ? {} : { confirmar_custo_creditos: confirmacao }) }), SEM_PARAMETROS)
    );
    assert.equal(status, 409, String(confirmacao));
    assert.match(corpo.error, /custa 1 crédito\(s\) \(saldo: 5\)\. Nada foi criado nem cobrado/);
    assert.equal(corpo.custo_total_creditos, 1);
    assert.deepEqual(corpo.empresas_a_liberar, ["Ademicon"]);
  }
  assert.equal(consultasDe(consultas, "empresas_crm", "insert").length, 0);
  assert.equal(rpcs(consultas, "fn_desbloquear_empresa_as").length, 0);
});

test("sem créditos suficientes nada é criado nem cobrado", async () => {
  const consultas = preparar(bancoDoLote({ saldo: 0 }));
  const { status, corpo } = await ler(await basePublicaPOST(pedidoPost({ empresa_pub_ids: [PUB_A, PUB_B], desbloquear_contatos: true, confirmar_custo_creditos: 1 }), SEM_PARAMETROS));
  assert.equal(status, 402);
  assert.match(corpo.error, /Créditos insuficientes: liberar custa 1 e a organização tem 0/);
  assert.equal(consultasDe(consultas, "empresas_crm", "insert").length, 0);
  assert.equal(rpcs(consultas, "fn_desbloquear_empresa_as").length, 0);
});

test("com o custo confirmado, libera só quem está bloqueado e devolve os contatos", async () => {
  const consultas = preparar(bancoDoLote());
  const { status, corpo } = await ler(await basePublicaPOST(pedidoPost({ empresa_pub_ids: [PUB_A, PUB_B], desbloquear_contatos: true, confirmar_custo_creditos: 1 }), SEM_PARAMETROS));
  assert.equal(status, 201);

  const liberacoes = rpcs(consultas, "fn_desbloquear_empresa_as");
  assert.equal(liberacoes.length, 1, "a empresa B já era livre: não gasta crédito com ela");
  assert.deepEqual(liberacoes[0].valores, { p_user_id: USUARIO, p_organization_id: ORG, p_empresa_id: PUB_A });
  assert.equal(corpo.resumo.contatos.liberados_agora, 1);
  assert.equal(corpo.resumo.contatos.ainda_bloqueados, 0);
  assert.equal(corpo.oferta_de_contatos, undefined);
  assert.equal(corpo.empresas[0].contatos_liberados, true);
  assert.deepEqual(corpo.empresas[0].contatos[0], { nome: "Ana Souza", cargo: "Gerente de marketing", email: "ana@exemplo.com", linkedin_url: null, fonte: "proprietaria" });
  assert.equal(corpo.empresas[1].contatos.length, 1);
});

test("liberar quando nada está bloqueado não pede confirmação de custo", async () => {
  const consultas = preparar(bancoDoLote({ fichas: [FICHA_B] }));
  const { status, corpo } = await ler(await basePublicaPOST(pedidoPost({ empresa_pub_ids: [PUB_B], desbloquear_contatos: true }), SEM_PARAMETROS));
  assert.equal(status, 201);
  assert.equal(rpcs(consultas, "fn_desbloquear_empresa_as").length, 0);
  assert.equal(corpo.empresas[0].contatos.length, 1);
});

test("empresa que já está no CRM (ligada ou de mesmo nome) não é duplicada", async () => {
  const consultas = preparar(
    bancoDoLote({ noCrm: [{ id: CRM_A, nome: "Ademicon", empresa_pub_id: PUB_A }, { id: CRM_B, nome: "ARAUCO ", empresa_pub_id: null }] })
  );
  const { status, corpo } = await ler(await basePublicaPOST(pedidoPost({ empresa_pub_ids: [PUB_A, PUB_B] }), SEM_PARAMETROS));
  assert.equal(status, 200, "nada novo foi criado");
  assert.equal(consultasDe(consultas, "empresas_crm", "insert").length, 0);
  assert.equal(corpo.resumo.criadas, 0);
  assert.equal(corpo.resumo.ja_existiam, 2);
  assert.deepEqual(corpo.empresas.map((e: Json) => [e.empresa_crm_id, e.ja_existia]), [[CRM_A, true], [CRM_B, true]]);
});

test("por filtro, traz o resultado da busca com a página e diz se há mais", async () => {
  const consultas = preparar((c) => {
    if (ehDe(c, "fn_buscar_empresas_publicas", "rpc")) {
      return { data: [{ ...FICHA_A, contatos_disponiveis: 2, contatos_liberados: false, total: 62 }, { ...FICHA_B, contatos_disponiveis: 1, contatos_liberados: true, total: 62 }] };
    }
    return bancoDoLote()(c);
  });
  const { status, corpo } = await ler(await basePublicaPOST(pedidoPost({ cidade: "Curitiba", estado: "pr", limite: 2 }), SEM_PARAMETROS));
  assert.equal(status, 201);
  assert.deepEqual(rpcs(consultas, "fn_buscar_empresas_publicas")[0].valores, {
    p_organization_id: ORG,
    p_busca: null,
    p_cidade: "Curitiba",
    p_estado: "PR",
    p_setor: null,
    p_limite: 2,
    p_deslocamento: 0,
  });
  assert.equal(corpo.total_no_filtro, 62);
  assert.equal(corpo.proximo_deslocamento, 2);
});

test("sem ids nem filtro o lote não adiciona a base inteira", async () => {
  const consultas = preparar(bancoDoLote());
  const { status, corpo } = await ler(await basePublicaPOST(pedidoPost({}), SEM_PARAMETROS));
  assert.equal(status, 400);
  assert.match(corpo.error, /empresa_pub_ids ou ao menos um filtro/);
  assert.equal(consultas.length, 0);
});

test("o lote aceita no máximo 50 empresas e só ids válidos", async () => {
  preparar(bancoDoLote());
  const muitos = Array.from({ length: 51 }, (_, i) => `5c1b0f0e-0000-4000-8000-${String(i).padStart(12, "0")}`);
  const { status, corpo } = await ler(await basePublicaPOST(pedidoPost({ empresa_pub_ids: muitos }), SEM_PARAMETROS));
  assert.equal(status, 400);
  assert.match(corpo.error, /aceita até 50 itens/);
  const invalido = await ler(await basePublicaPOST(pedidoPost({ empresa_pub_ids: ["não-é-uuid"] }), SEM_PARAMETROS));
  assert.equal(invalido.status, 400);
  assert.match(invalido.corpo.error, /UUIDs válidos/);
});

test("id que não existe na base pública é recusado com a lista dos que faltam", async () => {
  const consultas = preparar(bancoDoLote({ fichas: [FICHA_A] }));
  const { status, corpo } = await ler(await basePublicaPOST(pedidoPost({ empresa_pub_ids: [PUB_A, PUB_C] }), SEM_PARAMETROS));
  assert.equal(status, 404);
  assert.ok(corpo.error.includes(PUB_C));
  assert.equal(consultasDe(consultas, "empresas_crm", "insert").length, 0);
});

test("se a liberação para no meio, o que foi feito aparece, a resposta é de erro e repetir conclui sem cobrar em dobro", async () => {
  const fichas = [FICHA_A, { ...FICHA_B, id: PUB_C, nome: "Outra", tem_detalhe: true }];
  const base = bancoDoLote({ falhaNaSegunda: true, fichas });
  const consultas = preparar((c) => {
    if (ehDe(c, "responsaveis")) return { data: [{ empresa_id: PUB_A }, { empresa_id: PUB_C }] };
    return base(c);
  });
  const { status, corpo } = await ler(await basePublicaPOST(pedidoPost({ empresa_pub_ids: [PUB_A, PUB_C], desbloquear_contatos: true, confirmar_custo_creditos: 2 }), SEM_PARAMETROS));
  assert.equal(status, 502);
  assert.equal(rpcs(consultas, "fn_desbloquear_empresa_as").length, 2);
  assert.equal(corpo.falha_na_liberacao.empresa, "Outra");
  assert.match(corpo.falha_na_liberacao.erro, /Sem créditos/);
  assert.equal(corpo.resumo.contatos.liberados_agora, 1);
  assert.equal(corpo.resumo.contatos.ainda_bloqueados, 1);
  assert.match(corpo.mensagem, /Repita o mesmo pedido/);
});

test("chave somente leitura não usa o lote", async () => {
  const { admin, consultas } = bancoFalso(() => undefined);
  dependenciasDaRota.autenticar = async () => ({ userId: USUARIO, organizationIds: [ORG], paidOrganizationIds: [ORG], scope: "read" });
  dependenciasDaRota.criarAdmin = () => admin;
  const { status, corpo } = await ler(await basePublicaPOST(pedidoPost({ empresa_pub_ids: [PUB_A] }), SEM_PARAMETROS));
  assert.equal(status, 403);
  assert.match(corpo.error, /somente leitura/);
  assert.equal(consultas.length, 0);
});
