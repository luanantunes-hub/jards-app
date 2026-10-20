import {
  CANAIS_PREFERIDOS,
  FASES_PROJETO,
  ORIGENS_CONTATO,
  PAPEIS_DECISAO,
  POTENCIAIS_FECHAMENTO,
  PRIORIDADES,
  STATUS_COMERCIAL_PROJETO,
  TIPOS_ATIVIDADE,
  TIPOS_EMPRESA,
  TIPOS_PROPONENTE,
  VISIBILIDADES_PROJETO,
  WORKFLOWS_FOLLOWUP,
  DIRECOES_INTERACAO,
} from "@/lib/mcp/enums";
import { orgIdParam, buscaParam, limiteParam, deslocamentoParam, uuidQuery, booleanQuery, idNoCaminho, uuid, texto, corpoJson, orgNoCorpo, dataTexto } from "@/lib/mcp/openapi-comum";
import type { ModuloMcp } from "@/lib/mcp/modulos";
import { construirSpecPrestacao } from "@/lib/mcp/openapi-prestacao";

/**
 * Specs OpenAPI da camada REST do MCP/Custom GPT, uma por módulo. São a fonte única das operações: a Action do
 * ChatGPT lê a spec do módulo e o servidor MCP remoto (Claude) deriva as ferramentas delas.
 * Resumo e descrição de cada operação ficam abaixo de 300 caracteres (limite das Actions do ChatGPT) e cada spec
 * tem no máximo 30 operações (teto de uma Action): por isso cada módulo tem a sua.
 */
export function construirSpecOpenApi(baseUrl: string, modulo: ModuloMcp = "captacao") {
  return modulo === "prestacao" ? construirSpecPrestacao(baseUrl) : construirSpecCaptacao(baseUrl);
}

function construirSpecCaptacao(baseUrl: string) {
  const spec = {
    openapi: "3.1.0",
    info: {
      title: "Jards",
      description:
        "CRM de captação do Jards: empresas, contatos, negociações, projetos, proponentes, atividades, follow-ups, interações, notas, inscrições em editais, propostas e editais públicos.",
      version: "1.1.0",
    },
    servers: [{ url: `${baseUrl}/api/mcp` }],
    paths: {
      "/organizacoes": {
        get: {
          operationId: "listarMinhasOrganizacoes",
          summary: "Lista as organizações de que o usuário é membro",
          responses: { "200": { description: "OK" } },
        },
      },
      "/opcoes": {
        get: {
          operationId: "listarOpcoesDoCrm",
          summary: "Etapas do funil, origens, canais, resultados, valores válidos e a equipe (ids) desta organização. Consulte antes de criar negociações, atividades, interações e follow-ups.",
          parameters: [orgIdParam],
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
            { name: "fase", in: "query", required: false, schema: { type: "string", enum: [...FASES_PROJETO] } },
            limiteParam,
            deslocamentoParam,
          ],
          responses: { "200": { description: "OK" } },
        },
        post: {
          operationId: "criarProjeto",
          summary: "Cria um projeto no CRM. Se já existir um com o mesmo nome, devolve o existente (ja_existia: true) sem duplicar.",
          requestBody: corpoJson(["nome"], {
            ...orgNoCorpo,
            nome: texto(),
            descricao: texto(),
            valor_alvo: { type: "number", minimum: 0, description: "Meta de captação em reais." },
            valor_garantido: { type: "number", minimum: 0, description: "Valor já garantido, em reais." },
            fase: { type: "string", enum: [...FASES_PROJETO] },
            status_comercial: { type: "string", enum: [...STATUS_COMERCIAL_PROJETO] },
            visibilidade: { type: "string", enum: [...VISIBILIDADES_PROJETO] },
            proponente_id: uuid("Proponente do projeto (listar_proponentes)."),
            proponente_nome: texto("Nome do proponente, quando ele não está cadastrado."),
            cidade: texto(),
            estado: texto(),
            abrangencia: texto(),
            data_inicio: texto("AAAA-MM-DD"),
            data_fim: texto("AAAA-MM-DD"),
            areas_culturais: { type: "array", items: { type: "string" } },
            tags: { type: "array", items: { type: "string" } },
          }),
          responses: { "201": { description: "Criado" }, "200": { description: "Já existia" }, "403": { description: "Chave é somente leitura" } },
        },
      },
      "/projetos/{id}": {
        get: {
          operationId: "obterProjeto",
          summary: "Detalhes completos de um projeto",
          parameters: [idNoCaminho, orgIdParam],
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
            { name: "tipo", in: "query", required: false, schema: { type: "string", enum: [...TIPOS_EMPRESA] } },
            { name: "cidade", in: "query", required: false, schema: { type: "string" }, description: "Só empresas desta cidade, ex.: Curitiba." },
            { name: "estado", in: "query", required: false, schema: { type: "string" }, description: "Sigla do estado, ex.: PR." },
            limiteParam,
            deslocamentoParam,
          ],
          responses: { "200": { description: "OK" } },
        },
        post: {
          operationId: "criarEmpresaCrm",
          summary: "Cria uma empresa no CRM da organização. Se já existir uma com o mesmo nome, devolve a existente (ja_existia: true) sem duplicar.",
          requestBody: corpoJson(["nome"], {
            ...orgNoCorpo,
            nome: texto(),
            site: texto("Site (ex.: vale.com): dá o logotipo na tela."),
            setor: texto(),
            tipo: { type: "string", enum: [...TIPOS_EMPRESA], description: "prospect (padrão), cliente_ativo ou ex_cliente." },
            cidade: texto("Cidade da sede. Sem ela, herda da empresa da base pública quando há ligação."),
            estado: texto("Sigla do estado da sede (ex.: PR). Só aceita estados válidos."),
            localizacao: texto('Atalho "Cidade-UF" (ex.: Curitiba-PR). Prefira cidade e estado.'),
            cidades_interesse: { type: "array", items: { type: "string" } },
            ja_patrocina_cultura: { type: "boolean" },
            ja_patrocina_esporte: { type: "boolean" },
            potencial_relacionamento: { type: "integer", minimum: 0, maximum: 100 },
            responsavel_interno_id: uuid("Quem da equipe cuida da empresa (listar_opcoes_do_crm, campo equipe)."),
            empresa_pub_id: uuid("Empresa da base pública (listar_patrocinadores_publicos). Se omitido, o Jards liga sozinho quando só há uma com o mesmo nome."),
          }),
          responses: { "201": { description: "Criada" }, "200": { description: "Já existia" }, "403": { description: "Chave é somente leitura" } },
        },
      },
      "/empresas/{id}": {
        get: {
          operationId: "obterEmpresaCrm",
          summary: "Ficha de uma empresa do CRM: dados, contatos, negociações, atividades e follow-ups pendentes, últimas interações e notas",
          parameters: [idNoCaminho, orgIdParam],
          responses: { "200": { description: "OK" } },
        },
      },
      "/empresas/{id}/contatos": {
        get: {
          operationId: "listarContatosDaEmpresa",
          summary: "Lista os contatos de uma empresa do CRM (os que a equipe cadastrou). Leitura simples, sem gastar crédito.",
          parameters: [idNoCaminho, orgIdParam, buscaParam, limiteParam, deslocamentoParam],
          responses: { "200": { description: "OK" } },
        },
      },
      "/contatos": {
        get: {
          operationId: "listarContatos",
          summary: "Lista os contatos do CRM da organização, de todas as empresas. A busca vale para nome, e-mail e cargo.",
          parameters: [
            orgIdParam,
            buscaParam,
            uuidQuery("empresa_crm_id", "Só os contatos desta empresa."),
            uuidQuery("proponente_id"),
            uuidQuery("captador_id"),
            limiteParam,
            deslocamentoParam,
          ],
          responses: { "200": { description: "OK" } },
        },
        post: {
          operationId: "criarContato",
          summary: "Cria um contato no CRM, ligado a uma empresa, a um proponente ou a um captador. Se o e-mail (ou o nome na mesma empresa) já existir, devolve o existente sem duplicar.",
          requestBody: corpoJson(["nome"], {
            ...orgNoCorpo,
            nome: texto(),
            empresa_crm_id: uuid("Empresa do contato (criar_empresa_crm / listar_empresas_crm)."),
            proponente_id: uuid(),
            captador_id: uuid(),
            cargo: texto(),
            email: texto(),
            telefone: texto(),
            linkedin_url: texto(),
            origem: { type: "string", enum: [...ORIGENS_CONTATO] },
            papel_decisao: { type: "string", enum: [...PAPEIS_DECISAO] },
            canal_preferido: { type: "string", enum: [...CANAIS_PREFERIDOS] },
            responsavel_interno_id: uuid("Quem da equipe cuida deste contato."),
            notas: texto(),
          }),
          responses: { "201": { description: "Criado" }, "200": { description: "Já existia" }, "403": { description: "Chave é somente leitura" } },
        },
      },
      "/negociacoes": {
        get: {
          operationId: "listarNegociacoes",
          summary: "Lista as negociações (funil de captação): empresa, projeto, etapa, valor e previsão",
          parameters: [
            orgIdParam,
            { name: "status", in: "query", required: false, schema: { type: "string" }, description: "Chave da etapa (listar_opcoes_do_crm)." },
            uuidQuery("empresa_crm_id"),
            uuidQuery("projeto_id"),
            booleanQuery("apenas_em_aberto", "Verdadeiro: esconde as aprovadas e recusadas."),
            limiteParam,
            deslocamentoParam,
          ],
          responses: { "200": { description: "OK" } },
        },
        post: {
          operationId: "criarNegociacao",
          summary:
            "Cria uma negociação: liga uma empresa do CRM a um projeto. Nasce na primeira etapa em aberto, salvo se informar etapa. Aprovar ou recusar só no app. Respeita exclusividade e devolve a negociação em aberto que já existir.",
          requestBody: corpoJson(["empresa_crm_id"], {
            ...orgNoCorpo,
            empresa_crm_id: uuid(),
            projeto_id: uuid("Projeto negociado (criar_projeto / listar_projetos)."),
            etapa: texto("Chave de uma etapa em aberto (listar_opcoes_do_crm, etapas_da_negociacao)."),
            potencial_fechamento: { type: "string", enum: [...POTENCIAIS_FECHAMENTO], description: "Padrão: medio." },
            prioridade: { type: "string", enum: [...PRIORIDADES] },
            valor: { type: "number", minimum: 0, description: "Valor da proposta em reais, ex.: 150000." },
            cota_id: uuid("Cota do projeto."),
            data_previsao: texto("Previsão de fechamento: AAAA-MM-DD."),
            contato_empresa_id: uuid("Contato principal (tem de ser desta empresa)."),
            captador_id: uuid("Pessoa da equipe que capta (listar_opcoes_do_crm, equipe)."),
            captador_externo_id: uuid("Agência captadora (listar_captadores)."),
            supervisor_id: uuid("Supervisor da negociação (equipe)."),
            origem_oportunidade: texto("De onde veio (listar_opcoes_do_crm, origens)."),
            canal_planejado: texto("Canal do próximo contato (listar_opcoes_do_crm, canais)."),
            notas: texto(),
          }),
          responses: { "201": { description: "Criada" }, "200": { description: "Já existia" }, "409": { description: "Empresa com exclusividade" } },
        },
      },
      "/negociacoes/{id}": {
        get: {
          operationId: "obterNegociacao",
          summary: "Ficha de uma negociação: empresa, projeto, contato, proposta, follow-ups, atividades, interações, notas e mudanças de etapa",
          parameters: [idNoCaminho, orgIdParam],
          responses: { "200": { description: "OK" } },
        },
      },
      "/atividades": {
        get: {
          operationId: "listarAtividades",
          summary: "Lista as atividades (as tarefas do Jards: ligações, e-mails, reuniões, eventos) com prazo, responsável e vínculo",
          parameters: [
            orgIdParam,
            booleanQuery("apenas_pendentes", "Verdadeiro: só as que ainda não foram feitas."),
            { name: "tipo", in: "query", required: false, schema: { type: "string", enum: [...TIPOS_ATIVIDADE] } },
            uuidQuery("responsavel_id"),
            uuidQuery("empresa_crm_id"),
            uuidQuery("captacao_id"),
            uuidQuery("contato_id"),
            uuidQuery("projeto_id"),
            uuidQuery("proponente_id"),
            { name: "de", in: "query", required: false, schema: { type: "string" }, description: "Prazo a partir de (AAAA-MM-DD)." },
            { name: "ate", in: "query", required: false, schema: { type: "string" }, description: "Prazo até (AAAA-MM-DD), inclusive." },
            limiteParam,
            deslocamentoParam,
          ],
          responses: { "200": { description: "OK" } },
        },
        post: {
          operationId: "criarAtividade",
          summary: "Cria uma atividade (tarefa) no Jards. Liga-se a uma só coisa: empresa, negociação, contato, projeto, proponente, captador ou inscrição. Sem responsável, fica com quem conectou.",
          requestBody: corpoJson(["nome"], {
            ...orgNoCorpo,
            nome: texto("O que fazer."),
            tipo: { type: "string", enum: [...TIPOS_ATIVIDADE], description: "Padrão: outro." },
            prioridade: { type: "string", enum: [...PRIORIDADES], description: "Padrão: media." },
            data_prevista: texto("Prazo (dia). AAAA-MM-DD; se vier com hora (AAAA-MM-DDTHH:MM, Brasília), a hora vai para hora_inicio."),
            data_inicio: texto("Início (dia; padrão: o prazo). AAAA-MM-DD."),
            hora_inicio: texto("HH:MM, horário de Brasília."),
            hora_fim: texto("HH:MM, horário de Brasília."),
            responsavel_id: uuid("Quem da equipe faz (listar_opcoes_do_crm, equipe)."),
            nota: texto(),
            resultado: texto(),
            empresa_crm_id: uuid(),
            captacao_id: uuid(),
            contato_id: uuid(),
            projeto_id: uuid(),
            proponente_id: uuid(),
            captador_id: uuid(),
            edital_user_id: uuid(),
          }),
          responses: { "201": { description: "Criada" }, "403": { description: "Chave é somente leitura" } },
        },
      },
      "/historico": {
        get: {
          operationId: "listarHistorico",
          summary: "O que já aconteceu com uma empresa, contato, negociação ou proponente: interações, follow-ups e notas. Informe exatamente um dos ids.",
          parameters: [orgIdParam, uuidQuery("empresa_crm_id"), uuidQuery("contato_id"), uuidQuery("captacao_id"), uuidQuery("proponente_id"), limiteParam],
          responses: { "200": { description: "OK" } },
        },
      },
      "/notas": {
        post: {
          operationId: "criarNota",
          summary: "Cria uma nota numa empresa, contato, negociação, inscrição em edital ou proponente. Informe exatamente um dos ids.",
          requestBody: corpoJson(["conteudo"], {
            ...orgNoCorpo,
            conteudo: texto(),
            titulo: texto(),
            empresa_crm_id: uuid(),
            contato_id: uuid(),
            captacao_id: uuid(),
            edital_user_id: uuid(),
            proponente_id: uuid(),
          }),
          responses: { "201": { description: "Criada" }, "403": { description: "Chave é somente leitura" } },
        },
      },
      "/interacoes": {
        post: {
          operationId: "registrarInteracao",
          summary: "Registra uma conversa que já aconteceu (ligação, e-mail, reunião, mensagem) no histórico de uma empresa, contato, negociação ou proponente.",
          requestBody: corpoJson(["assunto"], {
            ...orgNoCorpo,
            assunto: texto("Do que se tratou."),
            canal: texto("Canal (listar_opcoes_do_crm, canais). Padrão: email."),
            resumo: texto(),
            resultado: texto("Resultado (listar_opcoes_do_crm, resultados_do_contato)."),
            proximo_passo: texto(),
            ocorreu_em: texto(`Quando aconteceu (padrão: agora). ${dataTexto}`),
            direcao: { type: "string", enum: [...DIRECOES_INTERACAO], description: "saida (padrão): nós falamos; entrada: eles falaram." },
            duracao_minutos: { type: "integer", minimum: 0, maximum: 1440 },
            empresa_crm_id: uuid(),
            contato_id: uuid(),
            captacao_id: uuid(),
            proponente_id: uuid(),
          }),
          responses: { "201": { description: "Registrada" }, "403": { description: "Chave é somente leitura" } },
        },
      },
      "/followups": {
        post: {
          operationId: "criarFollowup",
          summary: "Agenda um follow-up: lembrete de retomar o contato numa data. Precisa de empresa, negociação ou proponente. Avisa o responsável.",
          requestBody: corpoJson(["titulo"], {
            ...orgNoCorpo,
            titulo: texto("Ex.: Cobrar retorno da proposta."),
            previsto_para: texto(`Quando retomar (padrão: amanhã). ${dataTexto}`),
            canal: texto("Canal (listar_opcoes_do_crm, canais). Padrão: email."),
            motivo: texto(),
            workflow: { type: "string", enum: [...WORKFLOWS_FOLLOWUP] },
            responsavel_id: uuid("Quem da equipe retoma (padrão: quem conectou)."),
            empresa_crm_id: uuid(),
            contato_id: uuid(),
            captacao_id: uuid(),
            proponente_id: uuid(),
          }),
          responses: { "201": { description: "Agendado" }, "403": { description: "Chave é somente leitura" } },
        },
      },
      "/inscricoes": {
        get: {
          operationId: "listarInscricoes",
          summary: "Lista as inscrições da organização em editais de patrocínio (empresa, projeto, edital, etapa, datas)",
          parameters: [
            orgIdParam,
            { name: "status", in: "query", required: false, schema: { type: "string" }, description: "Chave da etapa (listar_opcoes_do_crm)." },
            uuidQuery("empresa_crm_id"),
            uuidQuery("projeto_id"),
            booleanQuery("apenas_em_aberto", "Verdadeiro: esconde as aprovadas, reprovadas e canceladas."),
            limiteParam,
            deslocamentoParam,
          ],
          responses: { "200": { description: "OK" } },
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
          parameters: [orgIdParam, buscaParam, limiteParam, deslocamentoParam],
          responses: { "200": { description: "OK" } },
        },
        post: {
          operationId: "criarProponente",
          summary: "Cria um proponente (quem apresenta projetos). Se já existir um com o mesmo nome ou CNPJ, devolve o existente sem duplicar.",
          requestBody: corpoJson(["nome"], {
            ...orgNoCorpo,
            nome: texto(),
            tipo: { type: "string", enum: [...TIPOS_PROPONENTE] },
            cnpj: texto(),
            cidade: texto(),
            estado: texto(),
            email: texto(),
            telefone: texto(),
            site: texto(),
            descricao: texto(),
          }),
          responses: { "201": { description: "Criado" }, "200": { description: "Já existia" }, "403": { description: "Chave é somente leitura" } },
        },
      },
      "/editais": {
        get: {
          operationId: "listarEditais",
          summary: "Lista editais públicos (base compartilhada entre todos os clientes do Jards)",
          parameters: [buscaParam, { name: "apenas_ativos", in: "query", required: false, description: "Verdadeiro (padrão): só editais ainda abertos, sem data de fechamento ou fechando de hoje em diante. Falso: inclui os já encerrados.", schema: { type: "boolean", default: true } }, limiteParam],
          responses: { "200": { description: "OK" } },
        },
      },
      "/patrocinadores-publicos": {
        get: {
          operationId: "listarPatrocinadoresPublicos",
          summary:
            "Consulta a base pública de empresas do Jards (não é a carteira da organização). Filtra por cidade, estado e setor; devolve o total, a próxima página e quantos contatos cada empresa tem e quanto custa liberá-los.",
          parameters: [
            orgIdParam,
            { ...buscaParam, description: "Vale para nome, cidade e setor (sem diferenciar acento). Duas letras que são um estado, como PR, valem como estado." },
            { name: "cidade", in: "query", required: false, schema: { type: "string" }, description: "Só empresas desta cidade, ex.: Curitiba." },
            { name: "estado", in: "query", required: false, schema: { type: "string" }, description: "Sigla do estado, ex.: PR." },
            { name: "setor", in: "query", required: false, schema: { type: "string" }, description: "Setor, ex.: Logística." },
            limiteParam,
            deslocamentoParam,
          ],
          responses: { "200": { description: "OK" } },
        },
      },
      "/empresas/base-publica": {
        post: {
          operationId: "adicionarEmpresasDaBasePublica",
          summary:
            "Adiciona ao CRM, em lote (até 50), empresas da base pública, por ids ou por filtro. Sem duplicar. Mostra quantos contatos há e o custo de liberá-los; só libera com desbloquear_contatos e a confirmação exata do custo.",
          requestBody: corpoJson([], {
            ...orgNoCorpo,
            empresa_pub_ids: { type: "array", items: { type: "string" }, description: "Ids da base pública (listar_patrocinadores_publicos). Use estes ou os filtros." },
            busca: texto("Filtro: vale para nome, cidade e setor."),
            cidade: texto("Filtro: cidade."),
            estado: texto("Filtro: sigla do estado."),
            setor: texto("Filtro: setor."),
            limite: { type: "integer", minimum: 1, maximum: 50, description: "Com filtro: quantas empresas do resultado adicionar (padrão 20)." },
            deslocamento: { type: "integer", minimum: 0, description: "Com filtro: quantas pular, para o lote seguinte." },
            tipo: { type: "string", enum: [...TIPOS_EMPRESA], description: "prospect (padrão), cliente_ativo ou ex_cliente." },
            desbloquear_contatos: { type: "boolean", description: "Verdadeiro: libera os contatos (1 crédito por empresa). Exige confirmar_custo_creditos." },
            confirmar_custo_creditos: { type: "integer", minimum: 0, description: "O custo total que a pessoa aceitou gastar. Tem de ser igual ao custo calculado (o pedido sem desbloquear_contatos mostra)." },
          }),
          responses: { "201": { description: "Criadas" }, "200": { description: "Já existiam" }, "402": { description: "Créditos insuficientes" }, "409": { description: "Custo não confirmado" } },
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
          summary: "Visão geral da organização: projetos por fase, propostas, empresas, negociações por etapa e valor em aberto, atividades pendentes e atrasadas, valor captado",
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
