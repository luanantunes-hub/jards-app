import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { NextRequest } from "next/server";
import { POST as diagnosticoArquivosPOST } from "../app/api/mcp/prestacoes/diagnostico/arquivos/route";
import { POST as diagnosticoUploadPOST } from "../app/api/mcp/prestacoes/diagnostico/upload/route";
import { POST as diagnosticoConferirPOST } from "../app/api/mcp/prestacoes/diagnostico/upload/conferir/route";
import { GET as organizacoesDaPrestacaoGET } from "../app/api/mcp/prestacoes/organizacoes/route";
import { GET as prestacoesGET } from "../app/api/mcp/prestacoes/route";
import { GET as projetosGET } from "../app/api/mcp/projetos/route";
import type { McpAuthContext } from "../lib/mcp/auth";
import { executarFerramenta } from "../lib/mcp/execucao";
import { FERRAMENTAS } from "../lib/mcp/ferramentas";
import { LIMITE_ARQUIVO_BYTES } from "../lib/mcp/prestacao/arquivos";
import { acessoDaPrestacao, type MembroDaPrestacao, type ModulosDaOrganizacao } from "../lib/mcp/prestacao/acesso";
import { dependenciasDaRota, SEM_PARAMETROS } from "../lib/mcp/rota";
import { bancoFalso, type Consulta, type Resolvedor } from "./_helpers/banco-falso";

const ORG_A = "5c1b0f0e-0000-4000-8000-0000000000a1";
const ORG_B = "5c1b0f0e-0000-4000-8000-0000000000b2";
const USUARIO = "5c1b0f0e-0000-4000-8000-000000000002";
const PRESTACAO_1 = "5c1b0f0e-0000-4000-8000-0000000000d1";
const PRESTACAO_2 = "5c1b0f0e-0000-4000-8000-0000000000d2";
const REGIME = "5c1b0f0e-0000-4000-8000-0000000000e1";
const ARQUIVO = "5c1b0f0e-0000-4000-8000-0000000000f1";

const originais = { ...dependenciasDaRota };
const fetchOriginal = globalThis.fetch;
afterEach(() => {
  Object.assign(dependenciasDaRota, originais);
  globalThis.fetch = fetchOriginal;
});

const membro = (organization_id: string, papel: string, prestacao_funcao: string | null = null): MembroDaPrestacao => ({
  organization_id,
  papel,
  modulos_acesso: ["prestacao"],
  prestacao_funcao,
});
const organizacao = (id: string, nome: string, ativos: string[] = ["prestacao"], leitura: string[] = []): ModulosDaOrganizacao => ({
  id,
  nome,
  modulos_ativos: ativos,
  modulos_leitura: leitura,
});

interface Cenario {
  membros?: MembroDaPrestacao[];
  organizacoes?: ModulosDaOrganizacao[];
  escopo?: "read" | "write";
  modulos?: McpAuthContext["modulos"];
}

interface BucketFalso {
  list?: (pasta: string, opcoes: unknown) => { data: unknown[]; error: null };
  download?: (caminho: string) => { data: Blob | null; error: { message: string } | null };
  assinar?: (caminho: string) => { data: { signedUrl: string; token: string; path: string } | null; error: { message: string } | null };
}

/** Troca a autenticação e o banco por versões de mentira. O Storage registra cada chamada em `chamadas`. */
function preparar(resolver: Resolvedor, cenario: Cenario = {}, bucket: BucketFalso = {}) {
  const { admin, consultas } = bancoFalso(resolver);
  const chamadas: Array<{ acao: string; argumentos: unknown[] }> = [];
  const registrar = <T,>(acao: string, argumentos: unknown[], resultado: T): T => {
    chamadas.push({ acao, argumentos });
    return resultado;
  };
  const armazenamento = {
    from: (nome: string) => {
      assert.equal(nome, "documentos", "o diagnóstico usa o bucket de documentos");
      return {
        list: async (pasta: string, opcoes: unknown) => registrar("list", [pasta, opcoes], bucket.list?.(pasta, opcoes) ?? { data: [], error: null }),
        remove: async (caminhos: string[]) => registrar("remove", [caminhos], { data: [], error: null }),
        download: async (caminho: string) => registrar("download", [caminho], bucket.download?.(caminho) ?? { data: null, error: { message: "Object not found" } }),
        createSignedUploadUrl: async (caminho: string) =>
          registrar(
            "createSignedUploadUrl",
            [caminho],
            bucket.assinar?.(caminho) ?? {
              data: { signedUrl: `https://projeto.supabase.co/storage/v1/object/upload/sign/documentos/${caminho}?token=t0k3n`, token: "t0k3n", path: caminho },
              error: null,
            }
          ),
      };
    },
  };

  const membros = cenario.membros ?? [membro(ORG_A, "admin")];
  const organizacoes = cenario.organizacoes ?? [organizacao(ORG_A, "Instituto A")];
  const contexto: McpAuthContext = {
    userId: USUARIO,
    organizationIds: [],
    paidOrganizationIds: [],
    scope: cenario.escopo ?? "write",
    modulos: cenario.modulos ?? ["prestacao"],
    prestacao: acessoDaPrestacao(membros, organizacoes),
  };
  dependenciasDaRota.autenticar = async () => contexto;
  dependenciasDaRota.criarAdmin = () => ({ ...(admin as object), storage: armazenamento }) as never;
  return { consultas, chamadas };
}

const pedido = (metodo: "GET" | "POST", caminho: string, corpo?: unknown) =>
  new NextRequest(`https://app.jards.test/api/mcp${caminho}`, {
    method: metodo,
    headers: { authorization: "Bearer teste", "content-type": "application/json" },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;
async function ler(resposta: Response): Promise<{ status: number; corpo: Json }> {
  return { status: resposta.status, corpo: (await resposta.json()) as Json };
}
const ehDe = (consulta: Consulta, tabela: string) => consulta.tabela === tabela && consulta.acao === "select";
const filtro = (consulta: Consulta | undefined, operador: string, coluna: string) => consulta?.filtros.find(([o, c]) => o === operador && c === coluna)?.[2];

const linha = (extra: Record<string, unknown> = {}) => ({
  id: PRESTACAO_1,
  titulo: "Festival de Inverno 2026",
  status: "rascunho",
  prazo: "2099-01-31",
  prazo_final: "2099-01-31",
  prazo_final_override: null,
  valor_aprovado: "150000.00",
  valor_realizado: null,
  regime_id: REGIME,
  identificador_oficial: "PRONAC 261234",
  updated_at: "2026-10-18T12:00:00Z",
  ...extra,
});

test("a chave que não autorizou a prestação não chega em nenhuma rota dela, e a do CRM não vê a prestação", async () => {
  const { consultas } = preparar(() => undefined, { modulos: ["captacao"] });
  for (const resposta of [
    await organizacoesDaPrestacaoGET(pedido("GET", "/prestacoes/organizacoes"), SEM_PARAMETROS),
    await prestacoesGET(pedido("GET", "/prestacoes"), SEM_PARAMETROS),
    await diagnosticoArquivosPOST(pedido("POST", "/prestacoes/diagnostico/arquivos", {}), SEM_PARAMETROS),
    await diagnosticoUploadPOST(pedido("POST", "/prestacoes/diagnostico/upload", {}), SEM_PARAMETROS),
    await diagnosticoConferirPOST(pedido("POST", "/prestacoes/diagnostico/upload/conferir", { arquivo_id: ARQUIVO }), SEM_PARAMETROS),
  ]) {
    const { status, corpo } = await ler(resposta);
    assert.equal(status, 403);
    assert.match(corpo.error, /prestação de contas/);
  }
  assert.equal(consultas.length, 0, "nenhuma consulta deveria chegar ao banco");

  // E o contrário: a chave só da prestação não alcança o CRM.
  preparar(() => undefined, { modulos: ["prestacao"] });
  const crm = await ler(await projetosGET(pedido("GET", "/projetos"), SEM_PARAMETROS));
  assert.equal(crm.status, 403);
  assert.match(crm.corpo.error, /captação/);
});

test("lista as organizações em que a pessoa usa a prestação, com papel, situação do módulo e se pode gravar", async () => {
  preparar(
    () => undefined,
    {
      membros: [membro(ORG_A, "admin", "revisor"), membro(ORG_B, "leitor")],
      organizacoes: [organizacao(ORG_A, "Instituto A"), organizacao(ORG_B, "Associação B", [], ["prestacao"])],
    }
  );
  const { status, corpo } = await ler(await organizacoesDaPrestacaoGET(pedido("GET", "/prestacoes/organizacoes"), SEM_PARAMETROS));
  assert.equal(status, 200);
  assert.deepEqual(corpo.organizacoes, [
    { id: ORG_A, nome: "Instituto A", seu_papel: "admin", sua_funcao: "revisor", modulo_em_vigor: true, voce_pode_gravar: true },
    { id: ORG_B, nome: "Associação B", seu_papel: "leitor", sua_funcao: null, modulo_em_vigor: false, voce_pode_gravar: false },
  ]);
  assert.match(corpo.orientacao, /organization_id/);
});

test("lista as prestações só da organização da pessoa, com regime, prazo e link da tela", async () => {
  const { consultas } = preparar((c) => {
    if (ehDe(c, "prestacoes_contas")) {
      return {
        data: [linha(), linha({ id: PRESTACAO_2, titulo: "Oficina de Teatro", status: "enviado", prazo: "2020-01-10", prazo_final: null, regime_id: null, valor_aprovado: null })],
        count: 2,
      };
    }
    if (ehDe(c, "prestacao_regimes")) return { data: [{ id: REGIME, codigo: "rouanet", nome: "Lei Rouanet" }] };
  });
  const { status, corpo } = await ler(await prestacoesGET(pedido("GET", "/prestacoes"), SEM_PARAMETROS));
  assert.equal(status, 200);

  const consulta = consultas.find((c) => ehDe(c, "prestacoes_contas"));
  assert.equal(filtro(consulta, "eq", "organization_id"), ORG_A, "a consulta sempre é da organização do vínculo");
  assert.ok(consulta?.colunas && !consulta.colunas.includes("*"), "só colunas escolhidas");

  assert.equal(corpo.total, 2);
  assert.equal(corpo.proximo_deslocamento, null);
  const [primeira, segunda] = corpo.prestacoes;
  assert.equal(primeira.titulo, "Festival de Inverno 2026");
  assert.deepEqual(primeira.regime, { codigo: "rouanet", nome: "Lei Rouanet" });
  assert.equal(primeira.prazo_origem, "calculado_pelo_regime");
  assert.equal(primeira.atrasada, false);
  assert.equal(primeira.valor_aprovado, 150000);
  assert.equal(primeira.valor_realizado, null);
  assert.equal(primeira.url, `https://app.jards.test/prestacoes/${PRESTACAO_1}`);
  assert.equal(segunda.regime, null);
  assert.equal(segunda.atrasada, false, "depois de enviada, o prazo de envio não conta como atraso");
  assert.equal(segunda.prazo_origem, "informado");
});

test("busca por título e filtro de status viram filtros do banco, e status que não existe é recusado", async () => {
  const { consultas } = preparar(() => ({ data: [], count: 0 }));
  const filtrada = await ler(await prestacoesGET(pedido("GET", "/prestacoes?busca=festival&status=rascunho&limite=5&deslocamento=10"), SEM_PARAMETROS));
  assert.equal(filtrada.status, 200);
  const consulta = consultas.find((c) => ehDe(c, "prestacoes_contas"));
  assert.equal(filtro(consulta, "eq", "status"), "rascunho");
  assert.match(String(filtro(consulta, "ilike", "titulo")), /festival/);

  const invalido = await ler(await prestacoesGET(pedido("GET", "/prestacoes?status=inventado"), SEM_PARAMETROS));
  assert.equal(invalido.status, 400);
  assert.match(invalido.corpo.error, /status deve ser um destes/);
});

test("com mais prestações do que cabem na página, a resposta indica a próxima", async () => {
  preparar(() => ({ data: [linha()], count: 7 }));
  const { corpo } = await ler(await prestacoesGET(pedido("GET", "/prestacoes?limite=1"), SEM_PARAMETROS));
  assert.equal(corpo.total, 7);
  assert.equal(corpo.proximo_deslocamento, 1);
});

test("quem usa a prestação em duas organizações precisa dizer qual; outra organização é recusada", async () => {
  const cenario: Cenario = {
    membros: [membro(ORG_A, "admin"), membro(ORG_B, "colaborador")],
    organizacoes: [organizacao(ORG_A, "Instituto A"), organizacao(ORG_B, "Associação B")],
  };
  const { consultas } = preparar(() => ({ data: [], count: 0 }), cenario);
  const sem = await ler(await prestacoesGET(pedido("GET", "/prestacoes"), SEM_PARAMETROS));
  assert.equal(sem.status, 400);
  assert.equal(sem.corpo.organizacoes.length, 2);
  assert.equal(consultas.length, 0);

  const escolhida = await ler(await prestacoesGET(pedido("GET", `/prestacoes?organization_id=${ORG_B}`), SEM_PARAMETROS));
  assert.equal(escolhida.status, 200);
  assert.equal(filtro(consultas.find((c) => ehDe(c, "prestacoes_contas")), "eq", "organization_id"), ORG_B);

  preparar(() => ({ data: [], count: 0 }));
  const alheia = await ler(await prestacoesGET(pedido("GET", `/prestacoes?organization_id=${ORG_B}`), SEM_PARAMETROS));
  assert.equal(alheia.status, 403);
});

test("organização só para consulta e papel leitor listam normalmente: consultar nunca exige o módulo em vigor", async () => {
  preparar(() => ({ data: [linha()], count: 1 }), { membros: [membro(ORG_A, "leitor")], organizacoes: [organizacao(ORG_A, "Instituto A", [], ["prestacao"])], escopo: "read" });
  const { status, corpo } = await ler(await prestacoesGET(pedido("GET", "/prestacoes"), SEM_PARAMETROS));
  assert.equal(status, 200);
  assert.equal(corpo.prestacoes.length, 1);
});

test("erro do banco ao listar não vaza o texto interno", async () => {
  preparar((c) => (ehDe(c, "prestacoes_contas") ? { error: { message: 'relation "prestacoes_contas" password=abc123', code: "XX000" } } : undefined));
  const silenciar = console.error;
  console.error = () => undefined;
  try {
    const { status, corpo } = await ler(await prestacoesGET(pedido("GET", "/prestacoes"), SEM_PARAMETROS));
    assert.ok(status >= 400);
    assert.ok(!/abc123|password|relation/.test(corpo.error), corpo.error);
  } finally {
    console.error = silenciar;
  }
});

test("as rotas que recebem arquivo exigem acesso de gravação: chave somente leitura não chega ao banco nem ao Storage", async () => {
  const { consultas, chamadas } = preparar(() => undefined, { escopo: "read" });
  for (const resposta of [
    await diagnosticoArquivosPOST(pedido("POST", "/prestacoes/diagnostico/arquivos", { conteudo_texto: "<NFe/>" }), SEM_PARAMETROS),
    await diagnosticoUploadPOST(pedido("POST", "/prestacoes/diagnostico/upload", {}), SEM_PARAMETROS),
    await diagnosticoConferirPOST(pedido("POST", "/prestacoes/diagnostico/upload/conferir", { arquivo_id: ARQUIVO }), SEM_PARAMETROS),
  ]) {
    const { status, corpo } = await ler(resposta);
    assert.equal(status, 403);
    assert.match(corpo.error, /somente leitura/);
  }
  assert.equal(consultas.length + chamadas.length, 0);
});

test("gravar com o módulo só para consulta (402) ou como leitor (403) é recusado antes de tocar o Storage", async () => {
  const consulta = preparar(() => undefined, { organizacoes: [organizacao(ORG_A, "Instituto A", [], ["prestacao"])] });
  const semVigor = await ler(await diagnosticoUploadPOST(pedido("POST", "/prestacoes/diagnostico/upload", {}), SEM_PARAMETROS));
  assert.equal(semVigor.status, 402);
  assert.equal(semVigor.corpo.upgrade_url, "/meu-plano?acao=assinar");
  assert.equal(consulta.chamadas.length, 0);

  const leitor = preparar(() => undefined, { membros: [membro(ORG_A, "leitor")] });
  const soConsulta = await ler(await diagnosticoUploadPOST(pedido("POST", "/prestacoes/diagnostico/upload", {}), SEM_PARAMETROS));
  assert.equal(soConsulta.status, 403);
  assert.equal(leitor.chamadas.length, 0);
});

test("diagnóstico de arquivos: texto colado chega com tipo e impressão digital; sem nada, vem a dica do plano B", async () => {
  preparar(() => undefined);
  const xml = '<?xml version="1.0"?><nfeProc><NFe/></nfeProc>';
  const ok = await ler(await diagnosticoArquivosPOST(pedido("POST", "/prestacoes/diagnostico/arquivos", { conteudo_texto: xml, nome_do_arquivo: "nota.xml" }), SEM_PARAMETROS));
  assert.equal(ok.status, 200);
  assert.equal(ok.corpo.chegaram_arquivos, 0);
  assert.deepEqual(ok.corpo.texto.nome, "nota.xml");
  assert.equal(ok.corpo.texto.caracteres, xml.length);
  assert.equal(ok.corpo.texto.tipo_pelo_conteudo, "xml");
  assert.match(ok.corpo.texto.sha256_inicio, /^[0-9a-f]{16}$/);
  assert.equal(ok.corpo.dica, undefined);

  const vazio = await ler(await diagnosticoArquivosPOST(pedido("POST", "/prestacoes/diagnostico/arquivos", {}), SEM_PARAMETROS));
  assert.equal(vazio.status, 200);
  assert.equal(vazio.corpo.chegaram_arquivos, 0);
  assert.equal(vazio.corpo.texto, null);
  assert.match(vazio.corpo.dica, /preparar_upload_de_diagnostico/);

  const longo = await ler(await diagnosticoArquivosPOST(pedido("POST", "/prestacoes/diagnostico/arquivos", { conteudo_texto: "x".repeat(200_001) }), SEM_PARAMETROS));
  assert.equal(longo.status, 400);
});

test("diagnóstico de arquivos: baixa o anexo do ChatGPT, e link interno ou vencido vira erro por arquivo, sem derrubar o resto", async () => {
  preparar(() => undefined);
  const buscados: string[] = [];
  globalThis.fetch = (async (entrada: URL | string) => {
    buscados.push(String(entrada));
    return String(entrada).includes("vencido") ? new Response("expirou", { status: 403 }) : new Response("%PDF-1.7 nota", { status: 200 });
  }) as typeof fetch;

  const { status, corpo } = await ler(
    await diagnosticoArquivosPOST(
      pedido("POST", "/prestacoes/diagnostico/arquivos", {
        openaiFileIdRefs: [
          { name: "nota.pdf", id: "file-1", mime_type: "application/pdf", download_link: "https://files.oaiusercontent.com/file-1?sig=a" },
          { name: "velho.pdf", id: "file-2", mime_type: "application/pdf", download_link: "https://files.oaiusercontent.com/vencido?sig=b" },
          { name: "mal.pdf", id: "file-3", download_link: "https://169.254.169.254/latest/meta-data" },
        ],
      }),
      SEM_PARAMETROS
    )
  );
  assert.equal(status, 200);
  assert.equal(corpo.chegaram_arquivos, 1);
  const [bom, vencido, interno] = corpo.arquivos;
  assert.equal(bom.ok, true);
  assert.equal(bom.tipo_pelo_conteudo, "pdf");
  assert.equal(bom.tipo_declarado, "application/pdf");
  assert.equal(bom.host_do_link, "files.oaiusercontent.com");
  assert.equal(vencido.ok, false);
  assert.match(vencido.erro, /403/);
  assert.equal(interno.ok, false);
  assert.ok(!buscados.some((url) => url.includes("169.254")), "o link interno nunca foi buscado");
  assert.ok(!JSON.stringify(corpo).includes("sig="), "o link temporário não volta na resposta");
});

test("preparar o envio: o endereço assinado aponta para o caminho da organização e nada além do host vai para a resposta fora do necessário", async () => {
  const { chamadas } = preparar(() => undefined);
  const { status, corpo } = await ler(await diagnosticoUploadPOST(pedido("POST", "/prestacoes/diagnostico/upload", {}), SEM_PARAMETROS));
  assert.equal(status, 200);
  assert.match(corpo.arquivo_id, /^[0-9a-f-]{36}$/);
  assert.equal(corpo.metodo, "PUT");
  assert.equal(corpo.dominio_a_liberar, "projeto.supabase.co");
  assert.ok(corpo.upload_url.includes(`diagnostico-mcp/${ORG_A}/${corpo.arquivo_id}.bin`));
  assert.ok(corpo.exemplo.includes(corpo.upload_url));

  const assinatura = chamadas.find((c) => c.acao === "createSignedUploadUrl");
  assert.deepEqual(assinatura?.argumentos, [`diagnostico-mcp/${ORG_A}/${corpo.arquivo_id}.bin`]);
});

test("preparar o envio apaga o que ficou sem conferir há mais de um dia, e só nessa pasta", async () => {
  const velho = new Date(Date.now() - 3 * 86_400_000).toISOString();
  const novo = new Date(Date.now() - 60_000).toISOString();
  const { chamadas } = preparar(() => undefined, {}, { list: () => ({ data: [{ name: "velho.bin", created_at: velho }, { name: "novo.bin", created_at: novo }], error: null }) });
  const { status } = await ler(await diagnosticoUploadPOST(pedido("POST", "/prestacoes/diagnostico/upload", {}), SEM_PARAMETROS));
  assert.equal(status, 200);
  const remocao = chamadas.find((c) => c.acao === "remove");
  assert.deepEqual(remocao?.argumentos, [[`diagnostico-mcp/${ORG_A}/velho.bin`]]);
});

test("se o Storage recusar assinar, a resposta é um erro genérico e a faxina com defeito não atrapalha", async () => {
  preparar(() => undefined, {}, { assinar: () => ({ data: null, error: { message: "bucket interno xyz falhou" } }) });
  const { status, corpo } = await ler(await diagnosticoUploadPOST(pedido("POST", "/prestacoes/diagnostico/upload", {}), SEM_PARAMETROS));
  assert.equal(status, 502);
  assert.ok(!/xyz|interno/.test(corpo.error));
});

test("conferir o envio: sem arquivo é 404, com arquivo devolve tamanho e tipo e apaga o de teste", async () => {
  const sem = preparar(() => undefined);
  const naoChegou = await ler(await diagnosticoConferirPOST(pedido("POST", "/prestacoes/diagnostico/upload/conferir", { arquivo_id: ARQUIVO }), SEM_PARAMETROS));
  assert.equal(naoChegou.status, 404);
  assert.equal(sem.chamadas.some((c) => c.acao === "download"), false);

  const conteudo = Buffer.from("%PDF-1.7 comprovante");
  const caminho = `diagnostico-mcp/${ORG_A}/${ARQUIVO}.bin`;
  const { chamadas } = preparar(
    () => undefined,
    {},
    {
      list: () => ({ data: [{ name: `${ARQUIVO}.bin`, created_at: new Date().toISOString(), metadata: { size: conteudo.length } }], error: null }),
      download: () => ({ data: new Blob([new Uint8Array(conteudo)]), error: null }),
    }
  );
  const { status, corpo } = await ler(await diagnosticoConferirPOST(pedido("POST", "/prestacoes/diagnostico/upload/conferir", { arquivo_id: ARQUIVO }), SEM_PARAMETROS));
  assert.equal(status, 200);
  assert.equal(corpo.chegou, true);
  assert.equal(corpo.bytes, conteudo.length);
  assert.equal(corpo.tipo_pelo_conteudo, "pdf");
  assert.equal(corpo.arquivo_de_teste_apagado, true);
  assert.deepEqual(chamadas.find((c) => c.acao === "download")?.argumentos, [caminho]);
  assert.deepEqual(chamadas.find((c) => c.acao === "remove")?.argumentos, [[caminho]]);
});

test("conferir: arquivo acima do limite é apagado sem ser baixado, e arquivo_id que não é UUID é recusado", async () => {
  const { chamadas } = preparar(
    () => undefined,
    {},
    { list: () => ({ data: [{ name: `${ARQUIVO}.bin`, created_at: new Date().toISOString(), metadata: { size: LIMITE_ARQUIVO_BYTES + 1 } }], error: null }) }
  );
  const grande = await ler(await diagnosticoConferirPOST(pedido("POST", "/prestacoes/diagnostico/upload/conferir", { arquivo_id: ARQUIVO }), SEM_PARAMETROS));
  assert.equal(grande.status, 413);
  assert.equal(chamadas.some((c) => c.acao === "download"), false, "não baixa o que passa do limite");
  assert.deepEqual(chamadas.find((c) => c.acao === "remove")?.argumentos, [[`diagnostico-mcp/${ORG_A}/${ARQUIVO}.bin`]]);

  preparar(() => undefined);
  for (const corpo of [{}, { arquivo_id: "../../prestacoes/segredo" }, { arquivo_id: "123" }]) {
    const { status } = await ler(await diagnosticoConferirPOST(pedido("POST", "/prestacoes/diagnostico/upload/conferir", corpo), SEM_PARAMETROS));
    assert.equal(status, 400, JSON.stringify(corpo));
  }
});

test("conferir só enxerga a pasta da própria organização: o mesmo arquivo_id em outra organização não aparece", async () => {
  const { chamadas } = preparar(() => undefined, { membros: [membro(ORG_B, "admin")], organizacoes: [organizacao(ORG_B, "Associação B")] }, {
    list: (pasta) => ({ data: pasta === `diagnostico-mcp/${ORG_A}` ? [{ name: `${ARQUIVO}.bin`, metadata: { size: 10 } }] : [], error: null }),
  });
  const { status } = await ler(await diagnosticoConferirPOST(pedido("POST", "/prestacoes/diagnostico/upload/conferir", { arquivo_id: ARQUIVO }), SEM_PARAMETROS));
  assert.equal(status, 404);
  assert.deepEqual(chamadas.find((c) => c.acao === "list")?.argumentos[0], `diagnostico-mcp/${ORG_B}`);
});

test("pelo servidor MCP: a ferramenta da prestação chama o mesmo handler e a lista chega em JSON", async () => {
  preparar((c) => (ehDe(c, "prestacoes_contas") ? { data: [linha()], count: 1 } : ehDe(c, "prestacao_regimes") ? { data: [{ id: REGIME, codigo: "rouanet", nome: "Lei Rouanet" }] } : undefined));
  const ferramenta = FERRAMENTAS.find((f) => f.nome === "listar_prestacoes");
  assert.ok(ferramenta);
  assert.equal(ferramenta.modulo, "prestacao");
  const { status, corpo } = await executarFerramenta(ferramenta, { status: "rascunho", limite: 5 }, pedido("POST", "/server"));
  assert.equal(status, 200);
  assert.equal((corpo as Json).prestacoes[0].regime.codigo, "rouanet");
});
