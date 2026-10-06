/**
 * Spec OpenAPI da camada REST do MCP/Custom GPT. É a fonte única das operações: a Action do
 * ChatGPT lê esta spec e o servidor MCP remoto (Claude) deriva as ferramentas dela.
 */
export function construirSpecOpenApi(baseUrl: string) {
  const orgIdParam = {
    name: "organization_id",
    in: "query",
    required: false,
    schema: { type: "string", format: "uuid" },
    description: "Opcional se você pertence a uma única organização.",
  };
  const buscaParam = {
    name: "busca",
    in: "query",
    required: false,
    schema: { type: "string" },
  };
  const limiteParam = {
    name: "limite",
    in: "query",
    required: false,
    schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
  };

  const spec = {
    openapi: "3.1.0",
    info: { title: "Jards", description: "Dados de CRM do Jards: projetos, empresas, contatos, propostas, tarefas, editais.", version: "1.0.0" },
    servers: [{ url: `${baseUrl}/api/mcp` }],
    paths: {
      "/organizacoes": {
        get: {
          operationId: "listarMinhasOrganizacoes",
          summary: "Lista as organizações de que o usuário é membro",
          responses: { "200": { description: "OK" } },
        },
      },
      "/projetos": {
        get: {
          operationId: "listarProjetos",
          summary: "Lista projetos do CRM",
          parameters: [
            orgIdParam,
            buscaParam,
            { name: "fase", in: "query", required: false, schema: { type: "string", enum: ["planejamento", "captacao", "execucao", "prestacao", "concluido"] } },
            limiteParam,
          ],
          responses: { "200": { description: "OK" } },
        },
      },
      "/projetos/{id}": {
        get: {
          operationId: "obterProjeto",
          summary: "Detalhes completos de um projeto",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
            orgIdParam,
          ],
          responses: { "200": { description: "OK" } },
        },
      },
      "/empresas": {
        get: {
          operationId: "listarEmpresasCrm",
          summary: "Lista empresas do CRM da organização (patrocinadores e prospects já trabalhados)",
          parameters: [
            orgIdParam,
            buscaParam,
            { name: "tipo", in: "query", required: false, schema: { type: "string", enum: ["prospect", "cliente_ativo", "ex_cliente"] } },
            limiteParam,
          ],
          responses: { "200": { description: "OK" } },
        },
      },
      "/empresas/{id}/contatos": {
        get: {
          operationId: "listarContatosDaEmpresa",
          summary: "Lista contatos de uma empresa. Consome 1 crédito da organização na primeira vez.",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
            orgIdParam,
            buscaParam,
            limiteParam,
          ],
          responses: { "200": { description: "OK" }, "402": { description: "Sem créditos disponíveis" }, "403": { description: "Chave é somente leitura" } },
        },
      },
      "/contatos": {
        post: {
          operationId: "criarContato",
          summary: "Cria um novo contato no CRM",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["nome"],
                  properties: {
                    organization_id: { type: "string", format: "uuid" },
                    nome: { type: "string" },
                    empresa_crm_id: { type: "string", format: "uuid" },
                    proponente_id: { type: "string", format: "uuid" },
                    captador_id: { type: "string", format: "uuid" },
                    cargo: { type: "string" },
                    email: { type: "string" },
                    telefone: { type: "string" },
                    linkedin_url: { type: "string" },
                    origem: { type: "string", enum: ["jards", "proprio", "indicacao", "linkedin", "outro"] },
                    notas: { type: "string" },
                  },
                },
              },
            },
          },
          responses: { "201": { description: "Criado" }, "403": { description: "Chave é somente leitura" } },
        },
      },
      "/propostas": {
        get: {
          operationId: "listarPropostas",
          summary: "Lista propostas comerciais",
          parameters: [orgIdParam, { name: "projeto_id", in: "query", required: false, schema: { type: "string", format: "uuid" } }, limiteParam],
          responses: { "200": { description: "OK" } },
        },
      },
      "/tarefas": {
        get: {
          operationId: "listarTarefas",
          summary: "Lista tarefas comerciais",
          parameters: [
            orgIdParam,
            { name: "responsavel_id", in: "query", required: false, schema: { type: "string", format: "uuid" } },
            { name: "apenas_pendentes", in: "query", required: false, schema: { type: "boolean", default: false } },
            limiteParam,
          ],
          responses: { "200": { description: "OK" } },
        },
        post: {
          operationId: "criarTarefa",
          summary: "Cria uma nova tarefa comercial",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["titulo"],
                  properties: {
                    organization_id: { type: "string", format: "uuid" },
                    titulo: { type: "string" },
                    tipo: { type: "string", enum: ["email", "ligacao", "reuniao", "documento", "followup", "tarefa"] },
                    status: { type: "string", enum: ["pendente", "em_andamento", "concluida", "cancelada"] },
                    data_prazo: { type: "string", format: "date-time" },
                    responsavel_id: { type: "string", format: "uuid" },
                    captacao_id: { type: "string", format: "uuid" },
                  },
                },
              },
            },
          },
          responses: { "201": { description: "Criado" }, "403": { description: "Chave é somente leitura" } },
        },
      },
      "/captadores": {
        get: {
          operationId: "listarCaptadores",
          summary: "Lista captadores da organização",
          parameters: [orgIdParam, buscaParam, limiteParam],
          responses: { "200": { description: "OK" } },
        },
      },
      "/proponentes": {
        get: {
          operationId: "listarProponentes",
          summary: "Lista proponentes da organização",
          parameters: [orgIdParam, buscaParam, limiteParam],
          responses: { "200": { description: "OK" } },
        },
      },
      "/editais": {
        get: {
          operationId: "listarEditais",
          summary: "Lista editais públicos (base compartilhada entre todos os clientes do Jards)",
          parameters: [buscaParam, { name: "apenas_ativos", in: "query", required: false, schema: { type: "boolean", default: true } }, limiteParam],
          responses: { "200": { description: "OK" } },
        },
      },
      "/patrocinadores-publicos": {
        get: {
          operationId: "listarPatrocinadoresPublicos",
          summary: "Consulta a base pública de empresas/patrocinadores do Jards (não é a carteira da organização)",
          parameters: [buscaParam, limiteParam],
          responses: { "200": { description: "OK" } },
        },
      },
      "/analise/carteira-empresa": {
        get: {
          operationId: "avaliarCarteiraEmpresa",
          summary: "Avalia a carteira de uma empresa a partir dos projetos que ela já apoiou",
          parameters: [orgIdParam, { name: "empresa_crm_id", in: "query", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { "200": { description: "OK" } },
        },
      },
      "/analise/resumo": {
        get: {
          operationId: "resumoOrganizacao",
          summary: "Visão geral analítica da organização (projetos por fase, propostas por status, valor captado)",
          parameters: [orgIdParam],
          responses: { "200": { description: "OK" } },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer" },
      },
    },
    security: [{ bearerAuth: [] }],
  };

  return spec;
}
