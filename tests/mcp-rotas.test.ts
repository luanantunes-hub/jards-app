import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { NextRequest } from "next/server";
import { POST as atividadesPOST } from "../app/api/mcp/atividades/route";
import { GET as contatosDaEmpresaGET } from "../app/api/mcp/empresas/[id]/contatos/route";
import { GET as contatosGET, POST as contatosPOST } from "../app/api/mcp/contatos/route";
import { GET as empresasGET, POST as empresasPOST } from "../app/api/mcp/empresas/route";
import { POST as followupsPOST } from "../app/api/mcp/followups/route";
import { POST as interacoesPOST } from "../app/api/mcp/interacoes/route";
import { GET as negociacoesGET, POST as negociacoesPOST } from "../app/api/mcp/negociacoes/route";
import { POST as notasPOST } from "../app/api/mcp/notas/route";
import { POST as projetosPOST } from "../app/api/mcp/projetos/route";
import { POST as proponentesPOST } from "../app/api/mcp/proponentes/route";
import { hojeEmSaoPaulo } from "../lib/mcp/datas";
import { executarFerramenta } from "../lib/mcp/execucao";
import { FERRAMENTAS } from "../lib/mcp/ferramentas";
import { SEM_PARAMETROS, dependenciasDaRota, type ParametrosDaRota } from "../lib/mcp/rota";
import { diaSeguinte, paraInstante } from "../lib/mcp/validacao";
import { bancoFalso, consultasDe, type Consulta, type Resolvedor } from "./_helpers/banco-falso";

const ORG = "5c1b0f0e-0000-4000-8000-000000000001";
const USUARIO = "5c1b0f0e-0000-4000-8000-000000000002";
const EMPRESA = "5c1b0f0e-0000-4000-8000-000000000003";
const OUTRA_EMPRESA = "5c1b0f0e-0000-4000-8000-000000000004";
const CONTATO = "5c1b0f0e-0000-4000-8000-000000000005";
const NEGOCIACAO = "5c1b0f0e-0000-4000-8000-000000000006";
const PROJETO = "5c1b0f0e-0000-4000-8000-000000000007";
const BASE_PUBLICA = "5c1b0f0e-0000-4000-8000-000000000008";
const CAPTADOR = "5c1b0f0e-0000-4000-8000-000000000009";
const NOVO = "5c1b0f0e-0000-4000-8000-00000000000a";

const originais = { ...dependenciasDaRota };
afterEach(() => Object.assign(dependenciasDaRota, originais));

/** Troca a autenticação e o banco das rotas por versões de mentira; devolve o registro das consultas feitas. */
function preparar(resolver: Resolvedor, escopo: "read" | "write" = "write") {
  const { admin, consultas } = bancoFalso(resolver);
  dependenciasDaRota.autenticar = async () => ({ userId: USUARIO, organizationIds: [ORG], paidOrganizationIds: [ORG], scope: escopo });
  dependenciasDaRota.criarAdmin = () => admin;
  return consultas;
}

const pedido = (metodo: "GET" | "POST", caminho: string, corpo?: unknown) =>
  new NextRequest(`https://app.jards.test/api/mcp${caminho}`, {
    method: metodo,
    headers: { authorization: "Bearer teste", "content-type": "application/json" },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });

const comId = (id: string) => ({ params: Promise.resolve({ id }) });

type Rota = (req: NextRequest, contexto: ParametrosDaRota) => Promise<Response>;
/** Chama a rota como o Next faz: sempre com o segundo argumento (vazio quando o caminho não tem parâmetros). */
const chamar = (rota: Rota, req: NextRequest, contexto: ParametrosDaRota = SEM_PARAMETROS) => rota(req, contexto);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;

async function ler(resposta: Response): Promise<{ status: number; corpo: Json }> {
  return { status: resposta.status, corpo: (await resposta.json()) as Json };
}

/** A consulta é desta tabela e ação (select por padrão)? */
const ehDe = (consulta: Consulta, tabela: string, acao: Consulta["acao"] = "select") => consulta.tabela === tabela && consulta.acao === acao;

const inserido = (consultas: readonly Consulta[], tabela: string) => consultasDe(consultas, tabela, "insert")[0]?.valores;

test("chave somente leitura não cria nada em nenhuma rota de criação", async () => {
  const consultas = preparar(() => undefined, "read");
  const criacoes: Array<[Rota, string, unknown]> = [
    [empresasPOST, "/empresas", { nome: "Vale" }],
    [contatosPOST, "/contatos", { nome: "Ana" }],
    [projetosPOST, "/projetos", { nome: "Festival" }],
    [proponentesPOST, "/proponentes", { nome: "Instituto" }],
    [negociacoesPOST, "/negociacoes", { empresa_crm_id: EMPRESA }],
    [atividadesPOST, "/atividades", { nome: "Ligar" }],
    [notasPOST, "/notas", { conteudo: "Oi", empresa_crm_id: EMPRESA }],
    [interacoesPOST, "/interacoes", { assunto: "Conversa", empresa_crm_id: EMPRESA }],
    [followupsPOST, "/followups", { titulo: "Retomar", empresa_crm_id: EMPRESA }],
  ];
  for (const [rota, caminho, corpo] of criacoes) {
    const { status, corpo: saida } = await ler(await chamar(rota, pedido("POST", caminho, corpo)));
    assert.equal(status, 403, caminho);
    assert.match(saida.error, /somente leitura/, caminho);
  }
  assert.equal(consultas.length, 0, "nenhuma consulta deveria chegar ao banco");
});

test("corpo que não é um objeto JSON é recusado antes de qualquer consulta", async () => {
  const consultas = preparar(() => undefined);
  for (const corpo of [[], "texto", 12, null]) {
    const { status, corpo: saida } = await ler(await chamar(empresasPOST, pedido("POST", "/empresas", corpo)));
    assert.equal(status, 400);
    assert.match(saida.error, /objeto JSON/);
  }
  assert.equal(consultas.length, 0);
});

test("erro inesperado vira resposta genérica, sem vazar o texto interno", async () => {
  preparar(() => undefined);
  dependenciasDaRota.criarAdmin = () => {
    throw new Error("senha do banco: abc123");
  };
  const silenciar = console.error;
  console.error = () => undefined;
  try {
    const { status, corpo } = await ler(await chamar(empresasGET, pedido("GET", "/empresas")));
    assert.equal(status, 500);
    assert.ok(!/abc123|senha/.test(corpo.error), corpo.error);
  } finally {
    console.error = silenciar;
  }
});

test("empresa nova é ligada à base pública quando o nome bate com uma só empresa de lá", async () => {
  const consultas = preparar((c) => {
    if (ehDe(c, "empresas")) return { data: [{ id: BASE_PUBLICA, nome: "Vale S.A.", site: "https://www.vale.com/pt", setor: "Mineração" }] };
    if (ehDe(c, "empresas_crm", "insert")) return { data: { id: EMPRESA, nome: "Vale S.A." } };
  });
  const { status, corpo } = await ler(await chamar(empresasPOST, pedido("POST", "/empresas", { nome: " Vale S.A. " })));
  assert.equal(status, 201);
  assert.equal(corpo.ja_existia, false);
  assert.deepEqual(corpo.vinculada_a_base_publica, { id: BASE_PUBLICA, nome: "Vale S.A." });
  assert.equal(corpo.url, `https://app.jards.test/empresas-crm/${EMPRESA}`);
  assert.deepEqual(inserido(consultas, "empresas_crm"), {
    organization_id: ORG,
    account_id: USUARIO,
    nome: "Vale S.A.",
    tipo: "prospect",
    setor: "Mineração",
    site: "https://www.vale.com/pt",
    domain_key: "vale.com",
    cidades_interesse: [],
    empresa_pub_id: BASE_PUBLICA,
  });
});

test("nome que existe mais de uma vez na base pública não é ligado a nenhuma delas", async () => {
  const consultas = preparar((c) => {
    if (ehDe(c, "empresas")) {
      return { data: [{ id: BASE_PUBLICA, nome: "Alfa", site: null, setor: null }, { id: OUTRA_EMPRESA, nome: "ALFA", site: null, setor: null }] };
    }
    if (ehDe(c, "empresas_crm", "insert")) return { data: { id: EMPRESA } };
  });
  const { status, corpo } = await ler(await chamar(empresasPOST, pedido("POST", "/empresas", { nome: "Alfa", site: "alfa.com.br", tipo: "cliente_ativo" })));
  assert.equal(status, 201);
  assert.equal(corpo.vinculada_a_base_publica, null);
  const campos = inserido(consultas, "empresas_crm") as Json;
  assert.equal(campos.empresa_pub_id, undefined);
  assert.equal(campos.tipo, "cliente_ativo");
  assert.equal(campos.domain_key, "alfa.com.br");
});

test("empresa que já está no CRM da organização volta como existente, sem criar outra", async () => {
  const consultas = preparar((c) => {
    if (ehDe(c, "empresas_crm")) return { data: [{ id: EMPRESA, nome: "Itaú Cultural" }] };
  });
  const { status, corpo } = await ler(await chamar(empresasPOST, pedido("POST", "/empresas", { nome: "ITAU  cultural" })));
  assert.equal(status, 200);
  assert.equal(corpo.ja_existia, true);
  assert.equal(corpo.empresa.id, EMPRESA);
  assert.equal(consultasDe(consultas, "empresas_crm", "insert").length, 0);
  assert.ok(consultas.every((c) => c.acao === "select"), "nada além de leitura");
  assert.equal(consultas.length, 1, "o nome igual é achado já na primeira busca, que é pela igualdade e não por trecho");
  assert.ok(consultas[0].filtros.some(([op, col, valor]) => op === "ilike" && col === "nome" && valor === "ITAU  cultural"));
  assert.ok(consultas[0].filtros.some(([op, col, valor]) => op === "eq" && col === "organization_id" && valor === ORG), "busca só na organização");
});

test("empresa_pub_id que não existe na base pública é recusado", async () => {
  const consultas = preparar(() => undefined);
  const { status, corpo } = await ler(await chamar(empresasPOST, pedido("POST", "/empresas", { nome: "Nova", empresa_pub_id: BASE_PUBLICA })));
  assert.equal(status, 404);
  assert.match(corpo.error, /base pública/);
  assert.equal(consultasDe(consultas, "empresas_crm", "insert").length, 0);
});

test("responsável interno precisa ser da equipe da organização", async () => {
  const consultas = preparar(() => undefined);
  const { status, corpo } = await ler(await chamar(empresasPOST, pedido("POST", "/empresas", { nome: "Nova", responsavel_interno_id: USUARIO })));
  assert.equal(status, 404);
  assert.match(corpo.error, /equipe/);
  assert.equal(consultasDe(consultas, "empresas_crm", "insert").length, 0);
  const consulta = consultasDe(consultas, "organization_members", "select")[0];
  assert.ok(consulta.filtros.some(([op, col, valor]) => op === "eq" && col === "papel" && valor === "admin"));
});

test("tipo de empresa fora da lista diz quais valem", async () => {
  preparar(() => undefined);
  const { status, corpo } = await ler(await chamar(empresasPOST, pedido("POST", "/empresas", { nome: "Nova", tipo: "parceira" })));
  assert.equal(status, 400);
  assert.match(corpo.error, /prospect, cliente_ativo, ex_cliente/);
});

test("a busca de empresas tira da frase o que quebraria o filtro do banco", async () => {
  const consultas = preparar((c) => (ehDe(c, "empresas_crm") ? { data: [{ id: EMPRESA, nome: "Vale" }] } : undefined), "read");
  const { status, corpo } = await ler(await chamar(empresasGET, pedido("GET", "/empresas?busca=Vale,(x)%25&tipo=prospect")));
  assert.equal(status, 200);
  assert.equal(corpo.empresas.length, 1);
  const filtros = consultas[0].filtros;
  assert.ok(filtros.some(([op, col, valor]) => op === "ilike" && col === "nome" && valor === "%Vale x%"), JSON.stringify(filtros));
  assert.ok(filtros.some(([op, col, valor]) => op === "eq" && col === "tipo" && valor === "prospect"));
});

test("contato fica ligado a uma só coisa e a recusa vem antes de qualquer consulta", async () => {
  const consultas = preparar(() => undefined);
  const { status, corpo } = await ler(await chamar(contatosPOST, pedido("POST", "/contatos", { nome: "Ana", empresa_crm_id: EMPRESA, proponente_id: OUTRA_EMPRESA })));
  assert.equal(status, 400);
  assert.match(corpo.error, /uma só coisa/);
  assert.equal(consultas.length, 0);
});

test("contato numa empresa de outra organização não é criado", async () => {
  const consultas = preparar(() => undefined);
  const { status, corpo } = await ler(await chamar(contatosPOST, pedido("POST", "/contatos", { nome: "Ana", empresa_crm_id: EMPRESA })));
  assert.equal(status, 404);
  assert.match(corpo.error, /empresa_crm_id não foi encontrado na sua organização/);
  assert.equal(consultasDe(consultas, "contatos", "insert").length, 0);
  assert.ok(consultas[0].filtros.some(([op, col, valor]) => op === "eq" && col === "organization_id" && valor === ORG));
});

test("contato novo grava só o que foi informado, na organização de quem autorizou", async () => {
  const consultas = preparar((c) => {
    if (ehDe(c, "empresas_crm")) return { data: { id: EMPRESA } };
    if (ehDe(c, "contatos", "insert")) return { data: { id: CONTATO, nome: "Ana Souza" } };
  });
  const { status, corpo } = await ler(
    await chamar(contatosPOST, pedido("POST", "/contatos", { nome: "Ana Souza", empresa_crm_id: EMPRESA, cargo: "Gerente de marca", papel_decisao: "champion" }))
  );
  assert.equal(status, 201);
  assert.equal(corpo.ja_existia, false);
  assert.equal(corpo.url, `https://app.jards.test/contatos/${CONTATO}`);
  assert.deepEqual(inserido(consultas, "contatos"), {
    organization_id: ORG,
    account_id: USUARIO,
    nome: "Ana Souza",
    empresa_crm_id: EMPRESA,
    cargo: "Gerente de marca",
    papel_decisao: "champion",
  });
});

test("mesmo e-mail na organização devolve o contato que já existe", async () => {
  const consultas = preparar((c) => (ehDe(c, "contatos") ? { data: { id: CONTATO, nome: "Ana", email: "ana@vale.com" } } : undefined));
  const { status, corpo } = await ler(await chamar(contatosPOST, pedido("POST", "/contatos", { nome: "Ana Souza", email: "Ana@Vale.com" })));
  assert.equal(status, 200);
  assert.equal(corpo.ja_existia, true);
  assert.equal(corpo.contato.id, CONTATO);
  assert.equal(consultasDe(consultas, "contatos", "insert").length, 0);
  assert.ok(consultas[0].filtros.some(([op, col, valor]) => op === "ilike" && col === "email" && valor === "Ana@Vale.com"));
});

test("e-mail que não parece e-mail é recusado", async () => {
  preparar(() => undefined);
  const { status, corpo } = await ler(await chamar(contatosPOST, pedido("POST", "/contatos", { nome: "Ana", email: "ana-sem-arroba" })));
  assert.equal(status, 400);
  assert.match(corpo.error, /e-mail válido/);
});

test("a lista de contatos busca por nome, e-mail ou cargo e mostra o nome da empresa", async () => {
  const consultas = preparar((c) => {
    if (ehDe(c, "contatos")) return { data: [{ id: CONTATO, nome: "Ana", empresa_crm_id: EMPRESA }] };
    if (ehDe(c, "empresas_crm")) return { data: [{ id: EMPRESA, nome: "Vale" }] };
  }, "read");
  const { status, corpo } = await ler(await chamar(contatosGET, pedido("GET", "/contatos?busca=ana")));
  assert.equal(status, 200);
  assert.equal(corpo.contatos[0].empresa_nome, "Vale");
  const busca = consultas[0].filtros.find(([op]) => op === "or");
  // o filtro `or` chega ao banco como um texto só, guardado na posição da coluna
  assert.equal(busca?.[1], "nome.ilike.%ana%,email.ilike.%ana%,cargo.ilike.%ana%");
});

test("ver os contatos de uma empresa funciona com chave de leitura e não mexe em crédito", async () => {
  const consultas = preparar((c) => {
    if (ehDe(c, "empresas_crm") && c.unico) return { data: { id: EMPRESA } };
    if (ehDe(c, "contatos")) return { data: [{ id: CONTATO, nome: "Ana", empresa_crm_id: EMPRESA }, { id: NOVO, nome: "Bia", empresa_crm_id: EMPRESA }] };
    if (ehDe(c, "empresas_crm")) return { data: [{ id: EMPRESA, nome: "Vale" }] };
  }, "read");
  const { status, corpo } = await ler(await chamar(contatosDaEmpresaGET, pedido("GET", `/empresas/${EMPRESA}/contatos`), comId(EMPRESA)));
  assert.equal(status, 200);
  assert.deepEqual(corpo.contatos.map((contato: Json) => contato.nome), ["Ana", "Bia"]);
  assert.ok(!consultas.some((c) => c.acao === "rpc" || c.tabela === "desbloqueios"), "ver a própria carteira não gasta crédito");
  assert.ok(consultas.some((c) => c.tabela === "contatos" && c.filtros.some(([op, col, valor]) => op === "eq" && col === "empresa_crm_id" && valor === EMPRESA)));
});

test("empresa de outra organização não tem os contatos listados", async () => {
  preparar(() => undefined, "read");
  const { status } = await ler(await chamar(contatosDaEmpresaGET, pedido("GET", `/empresas/${EMPRESA}/contatos`), comId(EMPRESA)));
  assert.equal(status, 404);
});

test("projeto com o mesmo nome (sem diferenciar caixa e acento) volta como existente", async () => {
  const consultas = preparar((c) => (ehDe(c, "projetos_crm") ? { data: [{ id: PROJETO, nome: "Festival de Jazz Açu" }] } : undefined));
  const { status, corpo } = await ler(await chamar(projetosPOST, pedido("POST", "/projetos", { nome: "festival de JAZZ acu" })));
  assert.equal(status, 200);
  assert.equal(corpo.ja_existia, true);
  assert.equal(consultasDe(consultas, "projetos_crm", "insert").length, 0);
});

test("projeto novo guarda valores à brasileira como número e a chave do nome", async () => {
  const consultas = preparar((c) => (ehDe(c, "projetos_crm", "insert") ? { data: { id: PROJETO } } : undefined));
  const { status } = await ler(
    await chamar(projetosPOST, pedido("POST", "/projetos", { nome: "Festival de Jazz", valor_alvo: "R$ 500.000,00", fase: "captacao", tags: "jazz, música", data_inicio: "2027-03-01" }))
  );
  assert.equal(status, 201);
  assert.deepEqual(inserido(consultas, "projetos_crm"), {
    organization_id: ORG,
    account_id: USUARIO,
    nome: "Festival de Jazz",
    nome_key: "festival de jazz",
    valor_alvo: 500000,
    fase: "captacao",
    data_inicio: "2027-03-01",
    tags: ["jazz", "música"],
  });
});

test("projeto não pode terminar antes de começar", async () => {
  const consultas = preparar(() => undefined);
  const { status, corpo } = await ler(await chamar(projetosPOST, pedido("POST", "/projetos", { nome: "Festival", data_inicio: "2027-03-10", data_fim: "2027-03-01" })));
  assert.equal(status, 400);
  assert.match(corpo.error, /data_fim/);
  assert.equal(consultasDe(consultas, "projetos_crm", "insert").length, 0);
});

test("proponente com o mesmo CNPJ volta como existente mesmo com outro nome", async () => {
  const consultas = preparar((c) => (ehDe(c, "proponentes") && c.unico ? { data: { id: NOVO, nome: "Instituto Alfa", cnpj: "12.345.678/0001-90" } } : undefined));
  const { status, corpo } = await ler(await chamar(proponentesPOST, pedido("POST", "/proponentes", { nome: "Alfa", cnpj: "12.345.678/0001-90" })));
  assert.equal(status, 200);
  assert.equal(corpo.ja_existia, true);
  assert.equal(consultasDe(consultas, "proponentes", "insert").length, 0);
});

test("negociação não nasce em aprovado nem em recusado: isso só se faz no app", async () => {
  const consultas = preparar((c) => (ehDe(c, "empresas_crm") ? { data: { id: EMPRESA, nome: "Vale", empresa_pub_id: null } } : undefined));
  const { status, corpo } = await ler(await chamar(negociacoesPOST, pedido("POST", "/negociacoes", { empresa_crm_id: EMPRESA, etapa: "aprovado" })));
  assert.equal(status, 400);
  assert.match(corpo.error, /Fechar negócio/);
  assert.equal(consultasDe(consultas, "captacoes", "insert").length, 0);
});

test("negociação nova entra na primeira etapa em aberto, com a empresa da base pública quando há", async () => {
  const consultas = preparar((c) => {
    if (ehDe(c, "empresas_crm")) return { data: { id: EMPRESA, nome: "Vale", empresa_pub_id: BASE_PUBLICA } };
    if (ehDe(c, "verificar_exclusividade", "rpc")) return { data: [] };
    if (ehDe(c, "captacoes", "insert")) return { data: { id: NEGOCIACAO } };
    if (ehDe(c, "captacoes") && c.unico === "single") return { data: { id: NEGOCIACAO, status: "prospeccao", empresa_crm_id: EMPRESA } };
  });
  const { status, corpo } = await ler(await chamar(negociacoesPOST, pedido("POST", "/negociacoes", { empresa_crm_id: EMPRESA })));
  assert.equal(status, 201);
  assert.equal(corpo.ja_existia, false);
  assert.equal(corpo.negociacao.etapa, "Prospecção");
  assert.equal(corpo.negociacao.empresa_nome, "Vale");
  assert.equal(corpo.url, `https://app.jards.test/captacoes/${NEGOCIACAO}`);
  assert.deepEqual(inserido(consultas, "captacoes"), {
    organization_id: ORG,
    account_id: USUARIO,
    empresa_crm_id: EMPRESA,
    empresa_id: BASE_PUBLICA,
    status: "prospeccao",
    potencial_fechamento: "medio",
  });
  assert.equal(consultasDe(consultas, "fn_aplicar_proposta_simplificada", "rpc").length, 0, "sem valor nem cota, não há proposta a aplicar");
});

test("o valor da negociação vai pela mesma função que o app usa", async () => {
  const consultas = preparar((c) => {
    if (ehDe(c, "empresas_crm")) return { data: { id: EMPRESA, nome: "Vale", empresa_pub_id: null } };
    if (ehDe(c, "verificar_exclusividade", "rpc")) return { data: [] };
    if (ehDe(c, "captacoes", "insert")) return { data: { id: NEGOCIACAO } };
    if (ehDe(c, "captacoes") && c.unico === "single") return { data: { id: NEGOCIACAO, status: "em_negociacao" } };
  });
  const { status } = await ler(
    await chamar(negociacoesPOST, pedido("POST", "/negociacoes", { empresa_crm_id: EMPRESA, etapa: "em_negociacao", valor: "150.000,00", potencial_fechamento: "alto" }))
  );
  assert.equal(status, 201);
  const [chamada] = consultasDe(consultas, "fn_aplicar_proposta_simplificada", "rpc");
  assert.deepEqual(chamada.valores, { p_captacao_id: NEGOCIACAO, p_valor: 150000, p_cota_id: null, p_alterar_cota: false });
  assert.equal((inserido(consultas, "captacoes") as Json).potencial_fechamento, "alto");
});

test("se o valor não puder ser aplicado, a negociação criada é desfeita", async () => {
  const consultas = preparar((c) => {
    if (ehDe(c, "empresas_crm")) return { data: { id: EMPRESA, nome: "Vale", empresa_pub_id: null } };
    if (ehDe(c, "verificar_exclusividade", "rpc")) return { data: [] };
    if (ehDe(c, "captacoes", "insert")) return { data: { id: NEGOCIACAO } };
    if (ehDe(c, "fn_aplicar_proposta_simplificada", "rpc")) return { error: { message: "falhou por dentro", code: "XX000" } };
  });
  const { status, corpo } = await ler(await chamar(negociacoesPOST, pedido("POST", "/negociacoes", { empresa_crm_id: EMPRESA, valor: 1000 })));
  assert.equal(status, 500);
  assert.ok(!/por dentro/.test(corpo.error));
  const apagadas = consultasDe(consultas, "captacoes", "delete");
  assert.equal(apagadas.length, 1);
  assert.deepEqual(apagadas[0].filtros, [["eq", "id", NEGOCIACAO]]);
});

test("empresa com exclusividade de outro captador não abre negociação", async () => {
  const consultas = preparar((c) => {
    if (ehDe(c, "empresas_crm")) return { data: { id: EMPRESA, nome: "Vale", empresa_pub_id: null } };
    if (ehDe(c, "verificar_exclusividade", "rpc")) return { data: [{ tipo: "exclusividade_empresa", captador_user_id: CAPTADOR }] };
    if (ehDe(c, "captadores")) return { data: { nome: "Agência Zeta" } };
  });
  const { status, corpo } = await ler(await chamar(negociacoesPOST, pedido("POST", "/negociacoes", { empresa_crm_id: EMPRESA })));
  assert.equal(status, 409);
  assert.match(corpo.error, /exclusividade por empresa ativa com Agência Zeta/);
  assert.equal(consultasDe(consultas, "captacoes", "insert").length, 0);
});

test("o captador dono da exclusividade pode abrir a negociação", async () => {
  const consultas = preparar((c) => {
    if (ehDe(c, "empresas_crm")) return { data: { id: EMPRESA, nome: "Vale", empresa_pub_id: null } };
    if (ehDe(c, "captadores")) return { data: { id: CAPTADOR } };
    if (ehDe(c, "verificar_exclusividade", "rpc")) return { data: [{ tipo: "time_lock", captador_user_id: CAPTADOR }] };
    if (ehDe(c, "captacoes", "insert")) return { data: { id: NEGOCIACAO } };
    if (ehDe(c, "captacoes") && c.unico === "single") return { data: { id: NEGOCIACAO, status: "prospeccao" } };
  });
  const { status } = await ler(await chamar(negociacoesPOST, pedido("POST", "/negociacoes", { empresa_crm_id: EMPRESA, captador_externo_id: CAPTADOR })));
  assert.equal(status, 201);
  assert.equal((inserido(consultas, "captacoes") as Json).captador_externo_id, CAPTADOR);
});

test("pedir de novo a negociação em aberto da mesma empresa no mesmo projeto devolve a que existe", async () => {
  const consultas = preparar((c) => {
    if (ehDe(c, "empresas_crm")) return { data: { id: EMPRESA, nome: "Vale", empresa_pub_id: null } };
    if (ehDe(c, "projetos_crm")) return { data: { id: PROJETO } };
    if (ehDe(c, "verificar_exclusividade", "rpc")) return { data: [] };
    if (ehDe(c, "captacoes")) return { data: { id: NEGOCIACAO, status: "em_negociacao" } };
  });
  const { status, corpo } = await ler(await chamar(negociacoesPOST, pedido("POST", "/negociacoes", { empresa_crm_id: EMPRESA, projeto_id: PROJETO })));
  assert.equal(status, 200);
  assert.equal(corpo.ja_existia, true);
  assert.equal(consultasDe(consultas, "captacoes", "insert").length, 0);
});

test("contato de outra empresa não pode ser o contato da negociação", async () => {
  const consultas = preparar((c) => {
    if (ehDe(c, "empresas_crm")) return { data: { id: EMPRESA, nome: "Vale", empresa_pub_id: null } };
    if (ehDe(c, "contatos")) return { data: { id: CONTATO, empresa_crm_id: OUTRA_EMPRESA } };
  });
  const { status, corpo } = await ler(await chamar(negociacoesPOST, pedido("POST", "/negociacoes", { empresa_crm_id: EMPRESA, contato_empresa_id: CONTATO })));
  assert.equal(status, 400);
  assert.match(corpo.error, /outra empresa/);
  assert.equal(consultasDe(consultas, "captacoes", "insert").length, 0);
});

test("a lista de negociações mostra a etapa pelo nome da organização e os nomes da empresa e do projeto", async () => {
  const consultas = preparar((c) => {
    if (ehDe(c, "captacoes")) return { data: [{ id: NEGOCIACAO, status: "em_negociacao", empresa_crm_id: EMPRESA, projeto_id: PROJETO }] };
    if (ehDe(c, "empresas_crm")) return { data: [{ id: EMPRESA, nome: "Vale" }] };
    if (ehDe(c, "projetos_crm")) return { data: [{ id: PROJETO, nome: "Festival" }] };
    if (ehDe(c, "etiquetas")) return { data: [{ entidade: "captacao", key: "em_negociacao", label: "Conversando", ordem: 4 }] };
  }, "read");
  const { status, corpo } = await ler(await chamar(negociacoesGET, pedido("GET", "/negociacoes?apenas_em_aberto=true")));
  assert.equal(status, 200);
  assert.deepEqual(
    { etapa: corpo.negociacoes[0].etapa, empresa: corpo.negociacoes[0].empresa_nome, projeto: corpo.negociacoes[0].projeto_nome },
    { etapa: "Conversando", empresa: "Vale", projeto: "Festival" }
  );
  const busca = consultasDe(consultas, "captacoes", "select")[0];
  assert.ok(busca.filtros.some(([op, col, valor]) => op === "not" && col === "status" && JSON.stringify(valor) === JSON.stringify(["in", "(aprovado,recusado)"])));
});

test("tarefa do Jards é atividade: grava em atividades, com os padrões e a pessoa que autorizou como responsável", async () => {
  const consultas = preparar((c) => {
    if (ehDe(c, "empresas_crm")) return { data: { id: EMPRESA } };
    if (ehDe(c, "atividades", "insert")) return { data: { id: NOVO } };
  });
  const { status } = await ler(
    await chamar(atividadesPOST, pedido("POST", "/atividades", { nome: "Ligar para a Vale", data_prevista: "2026-10-15", empresa_crm_id: EMPRESA }))
  );
  assert.equal(status, 201);
  assert.ok(!consultas.some((c) => c.tabela === "tarefas"), "a tabela legada de tarefas não é usada");
  assert.deepEqual(inserido(consultas, "atividades"), {
    organization_id: ORG,
    account_id: USUARIO,
    nome: "Ligar para a Vale",
    tipo: "outro",
    prioridade: "media",
    responsavel_id: USUARIO,
    data_inicio: "2026-10-15",
    data_prevista: "2026-10-15",
    feita: false,
    empresa_crm_id: EMPRESA,
  });
});

test("atividade com dia e hora guarda o dia e a hora em colunas separadas, como o app", async () => {
  const consultas = preparar((c) => (ehDe(c, "atividades", "insert") ? { data: { id: NOVO, data_prevista: "2026-10-15T00:00:00+00:00", data_inicio: "2026-10-15T00:00:00+00:00" } } : undefined));
  const { status, corpo } = await ler(
    await chamar(atividadesPOST, pedido("POST", "/atividades", { nome: "Reunião", tipo: "reuniao", prioridade: "alta", data_prevista: "2026-10-15T09:30", hora_fim: "10:30" }))
  );
  assert.equal(status, 201);
  const campos = inserido(consultas, "atividades") as Json;
  assert.equal(campos.data_prevista, "2026-10-15");
  assert.equal(campos.data_inicio, "2026-10-15");
  assert.equal(campos.hora_inicio, "09:30");
  assert.equal(campos.hora_fim, "10:30");
  assert.equal(campos.tipo, "reuniao");
  assert.equal(corpo.atividade.data_prevista, "2026-10-15", "a resposta devolve o dia puro, não a meia-noite UTC");
});

test("atividade à noite continua no mesmo dia, mesmo quando a hora vem com fuso", async () => {
  const consultas = preparar((c) => (ehDe(c, "atividades", "insert") ? { data: { id: NOVO } } : undefined));
  await chamar(atividadesPOST, pedido("POST", "/atividades", { nome: "Jantar", data_prevista: "2026-10-15T22:30" }));
  await chamar(atividadesPOST, pedido("POST", "/atividades", { nome: "Jantar", data_prevista: "2026-10-16T01:30:00Z" }));
  for (const insercao of consultasDe(consultas, "atividades", "insert")) {
    const campos = insercao.valores as Json;
    assert.equal(campos.data_prevista, "2026-10-15");
    assert.equal(campos.hora_inicio, "22:30");
  }
});

test("hora_inicio informada vale mais que a hora escrita junto com a data", async () => {
  const consultas = preparar((c) => (ehDe(c, "atividades", "insert") ? { data: { id: NOVO } } : undefined));
  await chamar(atividadesPOST, pedido("POST", "/atividades", { nome: "Reunião", data_prevista: "2026-10-15T09:30", hora_inicio: "14:00" }));
  assert.equal((inserido(consultas, "atividades") as Json).hora_inicio, "14:00");
});

test("atividade se liga a uma só coisa", async () => {
  const consultas = preparar(() => undefined);
  const { status, corpo } = await ler(await chamar(atividadesPOST, pedido("POST", "/atividades", { nome: "Ligar", empresa_crm_id: EMPRESA, contato_id: CONTATO })));
  assert.equal(status, 400);
  assert.match(corpo.error, /uma só coisa/);
  assert.equal(consultas.length, 0);
});

test("atividade com data final antes da inicial ou hora de fim antes do começo é recusada", async () => {
  preparar(() => undefined);
  const datas = await ler(await chamar(atividadesPOST, pedido("POST", "/atividades", { nome: "Ligar", data_inicio: "2026-10-20", data_prevista: "2026-10-15" })));
  assert.equal(datas.status, 400);
  assert.match(datas.corpo.error, /data_prevista/);
  const horas = await ler(await chamar(atividadesPOST, pedido("POST", "/atividades", { nome: "Ligar", hora_inicio: "11:00", hora_fim: "10:00" })));
  assert.equal(horas.status, 400);
  assert.match(horas.corpo.error, /hora_fim/);
});

test("responsável da atividade precisa ser da equipe", async () => {
  const consultas = preparar(() => undefined);
  const { status } = await ler(await chamar(atividadesPOST, pedido("POST", "/atividades", { nome: "Ligar", responsavel_id: CAPTADOR })));
  assert.equal(status, 404);
  assert.equal(consultasDe(consultas, "atividades", "insert").length, 0);
});

test("interação precisa dizer a quem se refere", async () => {
  const consultas = preparar(() => undefined);
  const { status, corpo } = await ler(await chamar(interacoesPOST, pedido("POST", "/interacoes", { assunto: "Conversa" })));
  assert.equal(status, 400);
  assert.match(corpo.error, /Informe a que interação se refere/);
  assert.equal(consultas.length, 0);
});

test("interação numa negociação completa a empresa e guarda o canal do jeito que a tela guarda", async () => {
  const consultas = preparar((c) => {
    if (ehDe(c, "captacoes")) return { data: { id: NEGOCIACAO, empresa_crm_id: EMPRESA } };
    if (ehDe(c, "crm_interacoes", "insert")) return { data: { id: NOVO } };
  });
  const { status } = await ler(
    await chamar(
      interacoesPOST,
      pedido("POST", "/interacoes", { assunto: "Reunião de alinhamento", captacao_id: NEGOCIACAO, canal: "videoconferencia", ocorreu_em: "2026-10-07", duracao_minutos: 45 })
    )
  );
  assert.equal(status, 201);
  assert.deepEqual(inserido(consultas, "crm_interacoes"), {
    organization_id: ORG,
    account_id: USUARIO,
    created_by: USUARIO,
    empresa_crm_id: EMPRESA,
    captacao_id: NEGOCIACAO,
    tipo: "reuniao",
    canal: "videoconferencia",
    tipo_interacao: "reuniao",
    direcao: "saida",
    assunto: "Reunião de alinhamento",
    duracao_minutos: 45,
    ocorreu_em: "2026-10-07T15:00:00.000Z",
  });
});

test("canal que a organização não usa é recusado com a lista dos que valem", async () => {
  preparar((c) => (ehDe(c, "empresas_crm") ? { data: { id: EMPRESA } } : undefined));
  const { status, corpo } = await ler(await chamar(interacoesPOST, pedido("POST", "/interacoes", { assunto: "Oi", empresa_crm_id: EMPRESA, canal: "pombo_correio" })));
  assert.equal(status, 400);
  assert.match(corpo.error, /canal deve ser um destes: email, telefone, linkedin, whatsapp/);
});

test("ids de empresas diferentes na mesma interação são recusados", async () => {
  const consultas = preparar((c) => {
    if (ehDe(c, "empresas_crm")) return { data: { id: EMPRESA } };
    if (ehDe(c, "captacoes")) return { data: { id: NEGOCIACAO, empresa_crm_id: OUTRA_EMPRESA } };
  });
  const { status, corpo } = await ler(await chamar(interacoesPOST, pedido("POST", "/interacoes", { assunto: "Oi", empresa_crm_id: EMPRESA, captacao_id: NEGOCIACAO })));
  assert.equal(status, 400);
  assert.match(corpo.error, /empresas diferentes/);
  assert.equal(consultasDe(consultas, "crm_interacoes", "insert").length, 0);
});

test("follow-up sem empresa, negociação ou proponente é recusado", async () => {
  preparar(() => undefined);
  const { status, corpo } = await ler(await chamar(followupsPOST, pedido("POST", "/followups", { titulo: "Retomar" })));
  assert.equal(status, 400);
  assert.match(corpo.error, /empresa_crm_id, captacao_id ou proponente_id/);
});

test("follow-up com data e canal grava o instante de Brasília e o tipo que a tela espera", async () => {
  const consultas = preparar((c) => {
    if (ehDe(c, "empresas_crm")) return { data: { id: EMPRESA } };
    if (ehDe(c, "crm_followups", "insert")) return { data: { id: NOVO } };
  });
  const { status } = await ler(
    await chamar(followupsPOST, pedido("POST", "/followups", { titulo: "Retomar conversa", empresa_crm_id: EMPRESA, previsto_para: "2026-10-20", canal: "whatsapp", workflow: "pos_reuniao" }))
  );
  assert.equal(status, 201);
  assert.deepEqual(inserido(consultas, "crm_followups"), {
    organization_id: ORG,
    account_id: USUARIO,
    created_by: USUARIO,
    empresa_crm_id: EMPRESA,
    titulo: "Retomar conversa",
    canal: "mensagem",
    previsto_para: "2026-10-20T15:00:00.000Z",
    workflow: "pos_reuniao",
    responsavel_id: USUARIO,
  });
});

test("follow-up sem data fica para amanhã (horário de Brasília)", async () => {
  const consultas = preparar((c) => {
    if (ehDe(c, "empresas_crm")) return { data: { id: EMPRESA } };
    if (ehDe(c, "crm_followups", "insert")) return { data: { id: NOVO } };
  });
  const { status } = await ler(await chamar(followupsPOST, pedido("POST", "/followups", { titulo: "Retomar", empresa_crm_id: EMPRESA })));
  assert.equal(status, 201);
  assert.equal((inserido(consultas, "crm_followups") as Json).previsto_para, paraInstante(diaSeguinte(hojeEmSaoPaulo())));
});

test("nota precisa de exatamente um destino", async () => {
  const consultas = preparar(() => undefined);
  const nenhum = await ler(await chamar(notasPOST, pedido("POST", "/notas", { conteudo: "Oi" })));
  assert.equal(nenhum.status, 400);
  assert.match(nenhum.corpo.error, /exatamente um destes/);
  const dois = await ler(await chamar(notasPOST, pedido("POST", "/notas", { conteudo: "Oi", empresa_crm_id: EMPRESA, contato_id: CONTATO })));
  assert.equal(dois.status, 400);
  assert.equal(consultas.length, 0);
});

test("nota numa empresa da organização grava o título só quando veio", async () => {
  const consultas = preparar((c) => {
    if (ehDe(c, "empresas_crm")) return { data: { id: EMPRESA } };
    if (ehDe(c, "notas", "insert")) return { data: { id: NOVO } };
  });
  const { status } = await ler(await chamar(notasPOST, pedido("POST", "/notas", { conteudo: "Falou com a Ana", empresa_crm_id: EMPRESA })));
  assert.equal(status, 201);
  assert.deepEqual(inserido(consultas, "notas"), { organization_id: ORG, account_id: USUARIO, conteudo: "Falou com a Ana", empresa_crm_id: EMPRESA });
});

test("título de nota repetido no mesmo proponente vira um aviso claro", async () => {
  preparar((c) => {
    if (ehDe(c, "proponentes")) return { data: { id: NOVO } };
    if (ehDe(c, "notas", "insert")) return { error: { code: "23505", message: 'duplicate key value violates unique constraint "notas_proponente_titulo_unico"' } };
  });
  const { status, corpo } = await ler(await chamar(notasPOST, pedido("POST", "/notas", { conteudo: "Oi", titulo: "Reunião", proponente_id: NOVO })));
  assert.equal(status, 409);
  assert.match(corpo.error, /já tem uma nota com esse título/);
  assert.ok(!/duplicate key/.test(corpo.error));
});

test("nota em registro de outra organização é recusada", async () => {
  const consultas = preparar(() => undefined);
  const { status } = await ler(await chamar(notasPOST, pedido("POST", "/notas", { conteudo: "Oi", captacao_id: NEGOCIACAO })));
  assert.equal(status, 404);
  assert.equal(consultasDe(consultas, "notas", "insert").length, 0);
});

test("a ferramenta chega à rota com o corpo certo e o endereço do site para montar o link", async () => {
  const consultas = preparar((c) => {
    if (ehDe(c, "empresas_crm")) return { data: { id: EMPRESA } };
    if (ehDe(c, "notas", "insert")) return { data: { id: NOVO } };
  });
  const ferramenta = FERRAMENTAS.find((f) => f.nome === "criar_nota");
  assert.ok(ferramenta);
  const saida = await executarFerramenta(ferramenta, { conteudo: "Falou com a Ana", empresa_crm_id: EMPRESA }, pedido("POST", "/server", {}));
  assert.equal(saida.status, 201);
  assert.equal((inserido(consultas, "notas") as Json).conteudo, "Falou com a Ana");
});

// ─── Localização da empresa: cidade e estado em campos próprios ─────────────

test("empresa nova guarda cidade e estado em campos próprios (estado por extenso vira sigla) e a localização acompanha", async () => {
  const consultas = preparar((c) => {
    if (ehDe(c, "empresas_crm", "insert")) return { data: { id: EMPRESA, nome: "Rumo" } };
  });
  const { status } = await ler(await chamar(empresasPOST, pedido("POST", "/empresas", { nome: "Rumo", cidade: " Curitiba ", estado: "Paraná" })));
  assert.equal(status, 201);
  const campos = inserido(consultas, "empresas_crm") as Json;
  assert.equal(campos.cidade, "Curitiba");
  assert.equal(campos.estado, "PR");
  assert.equal(campos.localizacao, "Curitiba-PR");
});

test("localizacao no formato Cidade-UF é separada em cidade e estado", async () => {
  const consultas = preparar((c) => {
    if (ehDe(c, "empresas_crm", "insert")) return { data: { id: EMPRESA, nome: "Rumo" } };
  });
  for (const [texto, cidade, estado] of [["Londrina-PR", "Londrina", "PR"], ["Mogi-Guaçu - sp", "Mogi-Guaçu", "SP"], ["Curitiba", "Curitiba", undefined]] as const) {
    const { status } = await ler(await chamar(empresasPOST, pedido("POST", "/empresas", { nome: "Rumo", localizacao: texto })));
    assert.equal(status, 201, texto);
    const campos = consultasDe(consultas, "empresas_crm", "insert").at(-1)?.valores as Json;
    assert.equal(campos.cidade, cidade, texto);
    assert.equal(campos.estado, estado, texto);
  }
});

test("localização malformada ou estado que não existe é recusado, sem gravar", async () => {
  const consultas = preparar(() => undefined);
  const lixo = await ler(await chamar(empresasPOST, pedido("POST", "/empresas", { nome: "Rumo", localizacao: "d-D" })));
  assert.equal(lixo.status, 400);
  assert.match(lixo.corpo.error, /Cidade-UF/);
  const semUf = await ler(await chamar(empresasPOST, pedido("POST", "/empresas", { nome: "Rumo", localizacao: "Curitiba-XX" })));
  assert.equal(semUf.status, 400);
  const estado = await ler(await chamar(empresasPOST, pedido("POST", "/empresas", { nome: "Rumo", cidade: "Curitiba", estado: "Atlantida" })));
  assert.equal(estado.status, 400);
  assert.match(estado.corpo.error, /sigla de um estado/);
  assert.equal(consultasDe(consultas, "empresas_crm", "insert").length, 0);
});

test("empresa ligada à base pública herda cidade e estado de lá, e o que a pessoa informar vale mais", async () => {
  const consultas = preparar((c) => {
    if (ehDe(c, "empresas")) return { data: [{ id: BASE_PUBLICA, nome: "Vale S.A.", site: "https://www.vale.com", setor: "Mineração", cidade: "Rio de Janeiro", estado: "RJ " }] };
    if (ehDe(c, "empresas_crm", "insert")) return { data: { id: EMPRESA, nome: "Vale S.A." } };
  });
  await ler(await chamar(empresasPOST, pedido("POST", "/empresas", { nome: "Vale S.A." })));
  let campos = inserido(consultas, "empresas_crm") as Json;
  assert.equal(campos.cidade, "Rio de Janeiro");
  assert.equal(campos.estado, "RJ");
  assert.equal(campos.localizacao, "Rio de Janeiro-RJ");

  await ler(await chamar(empresasPOST, pedido("POST", "/empresas", { nome: "Vale S.A.", cidade: "Belo Horizonte", estado: "MG" })));
  campos = consultasDe(consultas, "empresas_crm", "insert").at(-1)?.valores as Json;
  assert.equal(campos.cidade, "Belo Horizonte");
  assert.equal(campos.estado, "MG");
});

test("a lista de empresas do CRM filtra por cidade e estado", async () => {
  const consultas = preparar((c) => (ehDe(c, "empresas_crm") ? { data: [{ id: EMPRESA, nome: "Rumo", cidade: "Curitiba", estado: "PR" }] } : undefined), "read");
  const { status, corpo } = await ler(await chamar(empresasGET, pedido("GET", "/empresas?cidade=Curitiba&estado=paraná")));
  assert.equal(status, 200);
  assert.equal(corpo.empresas[0].cidade, "Curitiba");
  const filtros = consultas[0].filtros;
  assert.ok(filtros.some(([op, col, valor]) => op === "ilike" && col === "cidade" && valor === "%Curitiba%"), JSON.stringify(filtros));
  assert.ok(filtros.some(([op, col, valor]) => op === "eq" && col === "estado" && valor === "PR"), JSON.stringify(filtros));
  assert.match(consultas[0].colunas ?? "", /cidade,estado/);
});
