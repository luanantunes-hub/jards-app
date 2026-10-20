import { booleanQuery, buscaParam, corpoJson, corpoJsonSemChave, deslocamentoParam, idNoCaminho, limiteParam, orgIdParam, orgNoCorpo, SEGURANCA_BEARER, texto, uuid, uuidQuery } from "@/lib/mcp/openapi-comum";
import { STATUS_PRESTACAO, TIPOS_DA_DESPESA } from "@/lib/mcp/prestacao/enums";
import { REQUISITOS_EVIDENCIA, TIPOS_EVIDENCIA } from "@/lib/prestacao/evidencias";

const DIA = "Dia no formato AAAA-MM-DD.";

/** Os campos de uma atividade do objeto, os mesmos ao registrar e ao atualizar. */
const propriedadesDaAtividade = {
  titulo: texto("Nome da atividade (até 300 caracteres), como a pessoa a chama."),
  data_realizacao: texto(`Dia em que aconteceu (ou o primeiro dia). ${DIA}`),
  data_inicio: texto(`Início, quando a atividade dura mais de um dia. ${DIA}`),
  data_fim: texto(`Fim, quando a atividade dura mais de um dia. ${DIA}`),
  descricao: texto("O que foi feito (até 2000 caracteres), nas palavras da pessoa."),
  local: texto("Nome do espaço onde aconteceu."),
  cidade: texto("Cidade onde aconteceu."),
  estado: texto("Sigla do estado, como SP."),
  publico_atingido: { type: "integer", minimum: 0, description: "Quantas pessoas participaram, se a pessoa souber." },
  meta_prevista: { type: "integer", minimum: 0, description: "Público previsto para a atividade." },
  empregos_diretos: { type: "integer", minimum: 0 },
  empregos_indiretos: { type: "integer", minimum: 0 },
  democratizacao_descricao: texto("Como a atividade democratizou o acesso (gratuidade, ingressos populares...)."),
  acessibilidade_descricao: texto("Medidas de acessibilidade da atividade."),
  status_realizacao: { type: "string", enum: ["realizado", "nao_realizado"], description: "Padrão realizado. Não realizada pede justificativa_nao_realizacao." },
  justificativa_nao_realizacao: texto("Por que não aconteceu (obrigatória se status_realizacao for nao_realizado)."),
  meta_id: uuid("Meta do objeto a que a atividade serve (id de obter_objeto_da_prestacao)."),
  local_id: uuid("Local de realização do objeto (id de obter_objeto_da_prestacao)."),
};

/**
 * Spec OpenAPI do módulo Prestação de contas: é o que a GPT da Prestação importa
 * (`/api/mcp/openapi.json?modulo=prestacao`) e de onde o servidor MCP tira as ferramentas desse módulo.
 * Resumo e descrição de cada operação ficam abaixo de 300 caracteres (limite das Actions do ChatGPT).
 */
export function construirSpecPrestacao(baseUrl: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "Jards: prestação de contas",
      description: "Prestação de contas do Jards: consulta das prestações da organização (resumo, pendências, despesas, orçamento, objeto e relatório), envio de arquivos pelo chat e registro de despesas, evidências, atividades e resultados das metas para a equipe conferir.",
      version: "0.4.0",
    },
    servers: [{ url: `${baseUrl}/api/mcp` }],
    paths: {
      "/prestacoes/organizacoes": {
        get: {
          operationId: "listarOrganizacoesDaPrestacao",
          summary: "Lista as organizações em que você usa a prestação de contas, com seu papel e se o módulo permite gravar ou só consultar",
          responses: { "200": { description: "OK" } },
        },
      },
      "/prestacoes": {
        get: {
          operationId: "listarPrestacoes",
          summary: "Lista as prestações de contas da organização: status, regime, prazo, valores e link da tela. Filtre por status ou busque pelo título.",
          parameters: [
            orgIdParam,
            buscaParam,
            { name: "status", in: "query", required: false, schema: { type: "string", enum: [...STATUS_PRESTACAO] } },
            limiteParam,
            deslocamentoParam,
          ],
          responses: { "200": { description: "OK" } },
        },
      },
      "/prestacoes/{id}": {
        get: {
          operationId: "obterPrestacao",
          summary: "Resumo de uma prestação: status, regime, prazos, quanto foi comprovado, verificações abertas e a prontidão para enviar, com o que falta e onde resolver.",
          parameters: [idNoCaminho, orgIdParam],
          responses: { "200": { description: "OK" }, "404": { description: "Prestação não encontrada nesta organização" } },
        },
      },
      "/prestacoes/{id}/pendencias": {
        get: {
          operationId: "listarPendenciasDaPrestacao",
          summary: "O que falta para a prestação ficar pronta: por item do orçamento (a conciliar, regras pendentes, saldo) e as verificações abertas, com o link de onde resolver.",
          parameters: [
            idNoCaminho,
            orgIdParam,
            { name: "somente_com_pendencia", in: "query", required: false, schema: { type: "boolean", default: true }, description: "true (padrão) mostra só os itens com pendência; false mostra todos." },
            limiteParam,
            deslocamentoParam,
          ],
          responses: { "200": { description: "OK" }, "404": { description: "Prestação não encontrada nesta organização" } },
        },
      },
      "/prestacoes/{id}/despesas": {
        get: {
          operationId: "listarDespesasDaPrestacao",
          summary: "Despesas (comprovantes) da prestação: valor bruto e líquido, fornecedor, item do orçamento, pontos a revisar e verificações abertas. Filtre por status, item ou busca.",
          parameters: [
            idNoCaminho,
            orgIdParam,
            { name: "status", in: "query", required: false, schema: { type: "string", enum: ["pendente", "aceito", "rejeitado"] } },
            uuidQuery("item_id", "Só as despesas deste item do orçamento (id vindo de obter_orcamento_da_prestacao)."),
            booleanQuery("sem_item", "true mostra só as despesas ainda sem item do orçamento."),
            buscaParam,
            limiteParam,
            deslocamentoParam,
          ],
          responses: { "200": { description: "OK" }, "404": { description: "Prestação não encontrada nesta organização" } },
        },
        post: {
          operationId: "registrarDespesas",
          summary: "Registra despesas (até 20) a partir de arquivos da caixa de entrada, sempre PENDENTES para a equipe avaliar. XML de nota preenche os dados; informe o que leu nos PDFs e fotos.",
          parameters: [idNoCaminho],
          requestBody: corpoJson(["despesas"], {
            ...orgNoCorpo,
            despesas: {
              type: "array",
              maxItems: 20,
              description: "Uma despesa por arquivo recebido.",
              items: {
                type: "object",
                required: ["arquivo_id"],
                properties: {
                  arquivo_id: uuid("O arquivo_id da caixa de entrada (de enviar_arquivos ou conferir_envio_de_arquivos)."),
                  tipo: { type: "string", enum: [...TIPOS_DA_DESPESA], description: "Tipo do documento; num XML de nota vem do próprio XML." },
                  valor: { type: "number", description: "Valor bruto do documento, em reais." },
                  data_do_documento: texto("Data de emissão (AAAA-MM-DD)."),
                  numero_do_documento: texto("Número da nota ou do recibo."),
                  serie: texto("Série da nota."),
                  chave_de_acesso: texto("Chave de acesso da NF-e (44 caracteres), só se estiver no documento."),
                  descricao: texto("O que foi comprado ou contratado (até 500 caracteres)."),
                  retencoes: {
                    type: "object",
                    description: "Retenções do documento, em reais; deixe de fora o que não houver.",
                    properties: { iss: { type: "number" }, inss: { type: "number" }, irrf: { type: "number" }, outras: { type: "number" } },
                  },
                  item_id: uuid("Item do orçamento a que a despesa pertence (de obter_orcamento_da_prestacao)."),
                  fornecedor_documento: texto("CPF ou CNPJ do emitente, para ligar ao fornecedor cadastrado."),
                  observacao: texto("Observação para a equipe."),
                },
              },
            },
          }),
          responses: { "200": { description: "OK" }, "403": { description: "Sem permissão para editar" } },
        },
      },
      "/prestacoes/{id}/evidencias": {
        post: {
          operationId: "registrarEvidencia",
          summary: "Registra evidências do objeto (foto, lista de presença, declaração, link), até 10, a partir de arquivos da caixa de entrada ou de links, ligadas à meta, atividade ou local.",
          parameters: [idNoCaminho],
          requestBody: corpoJson(["evidencias"], {
            ...orgNoCorpo,
            evidencias: {
              type: "array",
              maxItems: 10,
              description: "Uma evidência por arquivo ou link.",
              items: {
                type: "object",
                properties: {
                  arquivo_id: uuid("O arquivo_id da caixa de entrada (enviado com destino evidencia). Use arquivo_id ou url."),
                  url: texto("Endereço (http ou https) da evidência, no lugar de um arquivo."),
                  tipo: { type: "string", enum: TIPOS_EVIDENCIA.map(tipo => tipo.id), description: "Tipo da evidência; sem informar, foto para imagem e link para url." },
                  descricao: texto("O que a evidência mostra (até 1000 caracteres)."),
                  atividade_id: uuid("Atividade a que a evidência pertence."),
                  meta_id: uuid("Meta a que a evidência pertence."),
                  local_id: uuid("Local onde aconteceu."),
                  capturada_em: texto("Data e hora em que a foto foi tirada (AAAA-MM-DDTHH:MM), se a pessoa souber."),
                  latitude: { type: "number" },
                  longitude: { type: "number" },
                  requisitos: { type: "array", items: { type: "string", enum: REQUISITOS_EVIDENCIA.map(r => r.id) }, description: "O que a evidência comprova." },
                  justificativa: texto("Justificativa, quando a evidência foge do padrão."),
                },
              },
            },
          }),
          responses: { "200": { description: "OK" }, "403": { description: "Sem permissão para editar" } },
        },
      },
      "/prestacoes/{id}/arquivos": {
        get: {
          operationId: "listarArquivosRecebidos",
          summary: "Arquivos da caixa de entrada da prestação: o que chegou, o que já virou despesa ou evidência e o que ainda espera. Filtre por situação ou destino.",
          parameters: [
            idNoCaminho,
            orgIdParam,
            { name: "situacao", in: "query", required: false, schema: { type: "string", enum: ["aguardando", "recebido", "registrado", "descartado"] } },
            { name: "destino", in: "query", required: false, schema: { type: "string", enum: ["despesa", "evidencia"] } },
            limiteParam,
            deslocamentoParam,
          ],
          responses: { "200": { description: "OK" } },
        },
        post: {
          operationId: "enviarArquivos",
          summary: "Recebe arquivos mandados pelo chat (anexo do ChatGPT em openaiFileIdRefs, ou o texto de um XML em conteudo_texto), confere pelo conteúdo e guarda na caixa de entrada. Não cria despesa.",
          parameters: [idNoCaminho],
          requestBody: corpoJson([], {
            ...orgNoCorpo,
            destino: { type: "string", enum: ["despesa", "evidencia"], description: "Para que o arquivo vem; padrão despesa." },
            openaiFileIdRefs: {
              type: "array",
              items: { type: "string" },
              description: "O ChatGPT preenche sozinho com os arquivos anexados à conversa. Não escreva este campo.",
            },
            nome_do_arquivo: texto("Nome do arquivo, quando você manda o conteúdo em texto."),
            conteudo_texto: texto("Conteúdo de um XML de nota fiscal colado no chat, até 200 mil caracteres."),
          }),
          responses: { "200": { description: "OK" }, "403": { description: "Sem permissão para editar" } },
        },
      },
      "/prestacoes/{id}/arquivos/envio": {
        post: {
          operationId: "prepararEnvioDeArquivos",
          summary: "Prepara o envio de arquivos que não cabem no texto: endereços de upload direto (PUT) para o ambiente de código do assistente, ou um link curto para a pessoa enviar pelo navegador ou celular (a página já confere o que ela envia).",
          parameters: [idNoCaminho],
          requestBody: corpoJsonSemChave([], {
            ...orgNoCorpo,
            destino: { type: "string", enum: ["despesa", "evidencia"], description: "Para que os arquivos vêm; padrão despesa." },
            modo: { type: "string", enum: ["endereco", "link"], description: "endereco: upload direto, informe nomes. link: página para a pessoa enviar pelo navegador." },
            nomes: { type: "array", items: { type: "string" }, maxItems: 10, description: "Nome de cada arquivo (com a extensão), no modo endereco." },
            maximo_de_arquivos: { type: "integer", minimum: 1, maximum: 10, description: "No modo link, quantos arquivos o link aceita (padrão 10)." },
          }),
          responses: { "200": { description: "OK" }, "403": { description: "Sem permissão para editar" } },
        },
      },
      "/prestacoes/{id}/arquivos/conferir": {
        post: {
          operationId: "conferirEnvioDeArquivos",
          summary: "Confere o que chegou nos endereços de upload (tamanho, tipo pelo conteúdo, duplicidade) e deixa pronto na caixa de entrada; o que não serve é apagado, com o motivo. O envio pelo link já se confere sozinho: sem nada esperando, mostra o que já está na caixa.",
          parameters: [idNoCaminho],
          requestBody: corpoJson([], {
            ...orgNoCorpo,
            arquivo_ids: { type: "array", items: { type: "string" }, maxItems: 20, description: "Quais arquivos conferir; sem informar, confere todos que esperam." },
          }),
          responses: { "200": { description: "OK" }, "403": { description: "Sem permissão para editar" } },
        },
      },
      "/prestacoes/{id}/objeto": {
        get: {
          operationId: "obterObjetoDaPrestacao",
          summary: "O objeto da prestação: metas (previsto, realizado, o que falta justificar), locais de realização e atividades, com os ids para registrar atividade ou atualizar meta.",
          parameters: [idNoCaminho, orgIdParam, limiteParam, deslocamentoParam],
          responses: { "200": { description: "OK" }, "404": { description: "Prestação não encontrada nesta organização" } },
        },
      },
      "/prestacoes/{id}/atividades": {
        post: {
          operationId: "registrarAtividades",
          summary: "Registra atividades do objeto (até 20) com o que a pessoa contou: data, local, público, empregos, meta e local do objeto. Nada é inventado; a equipe revisa no app.",
          parameters: [idNoCaminho],
          requestBody: corpoJson(["atividades"], {
            ...orgNoCorpo,
            atividades: {
              type: "array",
              maxItems: 20,
              description: "Uma atividade por item. Título, data_realizacao e status_realizacao (aconteceu ou não) são obrigatórios.",
              items: { type: "object", required: ["titulo", "data_realizacao", "status_realizacao"], properties: propriedadesDaAtividade },
            },
          }),
          responses: { "200": { description: "OK" }, "403": { description: "Sem permissão para editar" } },
        },
      },
      "/prestacoes/{id}/atividades/atualizar": {
        post: {
          operationId: "atualizarAtividade",
          summary: "Muda só os campos informados de uma atividade (atividade_id de obter_objeto_da_prestacao). Campo informado vazio é limpo; o que havia antes fica guardado em Ações do assistente.",
          parameters: [idNoCaminho],
          requestBody: corpoJson(["atividade_id"], {
            ...orgNoCorpo,
            atividade_id: uuid("A atividade a mudar (id de obter_objeto_da_prestacao)."),
            ...propriedadesDaAtividade,
            limpar: {
              type: "array",
              items: { type: "string" },
              description: "Campos a esvaziar, só quando a pessoa pedir para apagar o valor: descricao, data_inicio, data_fim, local, cidade, estado, publico_atingido, meta_prevista, empregos_diretos, empregos_indiretos, democratizacao_descricao, acessibilidade_descricao, meta_id, local_id. Campo vazio ou null em outro lugar não muda nada.",
            },
            substituir: { type: "boolean", default: false, description: "true só depois de confirmar com a pessoa que o valor que já existe deve ser trocado ou esvaziado. Completar campo vazio não precisa." },
          }),
          responses: { "200": { description: "OK" }, "403": { description: "Sem permissão para editar" }, "404": { description: "Atividade não encontrada" } },
        },
      },
      "/prestacoes/{id}/metas/atualizar": {
        post: {
          operationId: "atualizarMeta",
          summary: "Lança o realizado de uma meta do objeto e a justificativa, se ficou abaixo do previsto (meta_id de obter_objeto_da_prestacao). O previsto e a descrição vêm do projeto e não mudam por aqui.",
          parameters: [idNoCaminho],
          requestBody: corpoJson(["meta_id"], {
            ...orgNoCorpo,
            meta_id: uuid("A meta (id de obter_objeto_da_prestacao)."),
            realizado: { type: "number", minimum: 0, description: "Quanto foi alcançado, na unidade da meta." },
            justificativa: texto("Por que o realizado ficou diferente do previsto (até 2000 caracteres)."),
            limpar: { type: "array", items: { type: "string" }, description: "realizado e/ou justificativa, para esvaziar, só quando a pessoa pedir. Vazio ou null nos outros campos não muda nada." },
            substituir: { type: "boolean", default: false, description: "true só depois de confirmar com a pessoa que o resultado ou a justificativa que já existe deve ser trocado ou esvaziado. Lançar o que está vazio não precisa." },
          }),
          responses: { "200": { description: "OK" }, "403": { description: "Sem permissão para editar" }, "404": { description: "Meta não encontrada" } },
        },
      },
      "/prestacoes/{id}/relatorio": {
        get: {
          operationId: "obterRelatorioDaPrestacao",
          summary: "O relatório do objeto: as seções do modelo do regime, as lacunas de cada uma e, nas que têm campo para preencher, o texto e os números já salvos.",
          parameters: [idNoCaminho, orgIdParam],
          responses: { "200": { description: "OK" }, "404": { description: "Prestação não encontrada nesta organização" } },
        },
        post: {
          operationId: "salvarSecaoDoRelatorio",
          summary: "Preenche o texto e/ou os números de uma seção do relatório (secao_id de obter_relatorio_da_prestacao). Não troca o que já está escrito sem substituir=true e não apaga nada.",
          parameters: [idNoCaminho],
          requestBody: corpoJson(["secao_id"], {
            ...orgNoCorpo,
            secao_id: texto("A seção (secao_id de obter_relatorio_da_prestacao)."),
            texto: texto("O texto da seção, como a pessoa contou (até o limite do campo, 5000 caracteres por padrão)."),
            numeros: {
              type: "array",
              maxItems: 10,
              description: "Campos numéricos da seção, como empregos diretos e indiretos.",
              items: { type: "object", required: ["id", "valor"], properties: { id: texto("O id do campo, de obter_relatorio_da_prestacao."), valor: { type: "integer", minimum: 0 } } },
            },
            substituir: { type: "boolean", default: false, description: "true só depois de confirmar com a pessoa que o texto ou o número que já existe deve ser trocado." },
          }),
          responses: { "200": { description: "OK" }, "403": { description: "Sem permissão para editar" }, "409": { description: "A seção já tem conteúdo" } },
        },
      },
      "/prestacoes/{id}/acoes": {
        get: {
          operationId: "listarAcoesDoAssistente",
          summary: "O que o assistente fez nesta prestação, a mais recente primeiro, com o acao_id de cada ação e se dá para retirar.",
          parameters: [idNoCaminho, orgIdParam, limiteParam, deslocamentoParam],
          responses: { "200": { description: "OK" } },
        },
      },
      "/prestacoes/{id}/retirar": {
        post: {
          operationId: "retirarRegistroDoAssistente",
          summary: "Retira uma despesa ou evidência que o assistente criou (pelo acao_id), se a equipe ainda não avaliou, não foi enviada ao órgão e nada está ligado a ela. Só apaga o que o assistente criou.",
          parameters: [idNoCaminho],
          requestBody: corpoJson(["acao_id"], { ...orgNoCorpo, acao_id: uuid("O acao_id de listar_acoes_do_assistente.") }),
          responses: { "200": { description: "OK" }, "409": { description: "Já avaliada, enviada ou com vínculos" } },
        },
      },
      "/prestacoes/{id}/orcamento": {
        get: {
          operationId: "obterOrcamentoDaPrestacao",
          summary: "Orçamento em uso da prestação, item a item: aprovado, remanejado, vigente, comprometido, pago e saldo, com os totais e o percentual pago.",
          parameters: [idNoCaminho, orgIdParam, booleanQuery("somente_agrupadores", "true mostra só os agrupadores (metas, produtos, etapas), sem os itens."), limiteParam, deslocamentoParam],
          responses: { "200": { description: "OK" }, "404": { description: "Prestação não encontrada nesta organização" } },
        },
      },
      "/prestacoes/{id}/verificar": {
        post: {
          operationId: "rodarVerificacoes",
          summary: "Roda a verificação da prestação (o mesmo motor do botão Verificar do app) e atualiza o que está aberto, bloqueios e avisos. Não muda nenhum dado da prestação.",
          parameters: [idNoCaminho],
          requestBody: corpoJson([], { ...orgNoCorpo }),
          responses: { "200": { description: "OK" }, "404": { description: "Prestação não encontrada nesta organização" }, "429": { description: "Verificada agora há pouco" } },
        },
      },
      "/prestacoes/verificacoes": {
        get: {
          operationId: "explicarVerificacao",
          summary: "Explica uma verificação pelo código (como em listar_pendencias_da_prestacao): o que significa, o que fazer, onde resolver e, com a prestação, a regra e a norma do regime.",
          parameters: [
            { name: "codigo", in: "query", required: true, schema: { type: "string" }, description: "Código da verificação, como DOC_RETENCOES." },
            uuidQuery("prestacao_id", "Opcional: a prestação, para trazer a regra e a norma do regime dela."),
            orgIdParam,
          ],
          responses: { "200": { description: "OK" }, "404": { description: "Verificação desconhecida" } },
        },
      },
      "/prestacoes/diagnostico/arquivos": {
        post: {
          operationId: "diagnosticarArquivos",
          summary:
            "Teste: recebe os arquivos anexados à conversa (ChatGPT) ou um texto e devolve o que chegou (nome, tipo, tamanho, impressão digital). Nada é guardado.",
          requestBody: corpoJson([], {
            ...orgNoCorpo,
            openaiFileIdRefs: {
              type: "array",
              items: { type: "string" },
              description: "O ChatGPT preenche sozinho com os arquivos anexados à conversa. Não escreva este campo.",
            },
            nome_do_arquivo: texto("Nome do arquivo, quando você manda o conteúdo em texto."),
            conteudo_texto: texto("Conteúdo de um arquivo de texto (XML de nota fiscal, OFX, CSV ou TXT), até 200 mil caracteres."),
          }),
          responses: { "200": { description: "OK" }, "403": { description: "Chave é somente leitura" } },
        },
      },
      "/prestacoes/diagnostico/upload": {
        post: {
          operationId: "prepararUploadDeDiagnostico",
          summary: "Teste: devolve um endereço temporário de envio de arquivo, para você enviar um arquivo do seu ambiente com PUT e depois conferir.",
          requestBody: corpoJson([], { ...orgNoCorpo }),
          responses: { "200": { description: "OK" }, "403": { description: "Chave é somente leitura" } },
        },
      },
      "/prestacoes/diagnostico/upload/conferir": {
        post: {
          operationId: "conferirUploadDeDiagnostico",
          summary: "Teste: confere se o arquivo enviado ao endereço de diagnóstico chegou (tamanho e impressão digital) e apaga o arquivo de teste.",
          requestBody: corpoJson(["arquivo_id"], {
            ...orgNoCorpo,
            arquivo_id: uuid("O arquivo_id devolvido por preparar_upload_de_diagnostico."),
          }),
          responses: { "200": { description: "OK" }, "404": { description: "Nada foi enviado" } },
        },
      },
    },
    ...SEGURANCA_BEARER,
  };
}
