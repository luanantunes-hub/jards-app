import { baixarArquivoDoChat, lerReferenciasDeArquivo, MAX_TEXTO_DO_ARQUIVO } from "@/lib/mcp/prestacao/arquivos";
import { limparVencidos, listarCaixa, receberArquivo, visaoDaCaixa, type ContextoDaCaixa, type Destino } from "@/lib/mcp/prestacao/caixa";
import { resumoFiscalDoArquivo } from "@/lib/mcp/prestacao/fiscal";
import { exigirEdicao, quemGrava, registrarAcao } from "@/lib/mcp/prestacao/gravacao";
import { prestacaoDaOrganizacao } from "@/lib/mcp/prestacao/leitura";
import { linkDaPrestacao } from "@/lib/mcp/prestacao/resumo";
import { resposta, rotaMcp } from "@/lib/mcp/rota";
import { ErroMcp, opcao, paginacao, paramOpcao, texto } from "@/lib/mcp/validacao";

// Baixar e conferir arquivos de até 15 MB, vários por chamada, passa do prazo padrão das funções: um minuto basta.
export const maxDuration = 60;

const DESTINOS = ["despesa", "evidencia"] as const;
const SITUACOES = ["aguardando", "recebido", "registrado", "descartado"] as const;

/** Os arquivos da prestação na caixa de entrada do assistente: o que chegou, o que já virou despesa ou evidência e o que ainda espera. */
export const GET = rotaMcp({ escrita: false, modulo: "prestacao" }, async ({ admin, orgId, id, query }) => {
  const prestacao = await prestacaoDaOrganizacao(admin, orgId, id);
  const { limite, deslocamento } = paginacao(query);
  const { linhas, total } = await listarCaixa(admin, prestacao.id, {
    situacao: paramOpcao(query, "situacao", SITUACOES) ?? undefined,
    destino: paramOpcao(query, "destino", DESTINOS) ?? undefined,
    limite,
    deslocamento,
  });
  return resposta({
    arquivos: linhas.map(visaoDaCaixa),
    total,
    proximo_deslocamento: deslocamento + limite < total ? deslocamento + limite : null,
  });
});

/**
 * Recebe arquivos que a pessoa mandou pelo chat: o anexo da conversa no ChatGPT (openaiFileIdRefs) ou o texto de um
 * arquivo colado (XML de nota). Cada um é conferido pelo conteúdo, guardado e posto na caixa de entrada, de onde
 * registrar_despesas ou registrar_evidencia o transformam em registro. Não cria despesa nem evidência.
 */
export const POST = rotaMcp({ escrita: true, modulo: "prestacao" }, async ({ admin, orgId, id, ctx, corpo, origem }) => {
  const prestacao = await prestacaoDaOrganizacao(admin, orgId, id);
  const quem = quemGrava(ctx);
  await exigirEdicao(admin, quem.usuarioId, prestacao.id);

  const destino: Destino = opcao(corpo, "destino", DESTINOS) ?? "despesa";
  const referencias = lerReferenciasDeArquivo(corpo.openaiFileIdRefs);
  const conteudo = texto(corpo, "conteudo_texto", { max: MAX_TEXTO_DO_ARQUIVO });
  if (referencias.length === 0 && !conteudo) {
    throw new ErroMcp(400, "Nenhum arquivo chegou. No ChatGPT, anexe o arquivo na conversa e peça de novo. No Claude, cole o texto do arquivo (XML da nota) em conteudo_texto ou use preparar_envio_de_arquivos.");
  }

  await limparVencidos(admin, prestacao.id);
  const contexto: ContextoDaCaixa = { admin, organizationId: orgId, prestacaoId: prestacao.id, quem };

  const arquivos: Array<Record<string, unknown>> = [];
  const receber = async (nome: string, bytes: Buffer, de: "chatgpt" | "texto") => {
    try {
      const { linha, repetido } = await receberArquivo(contexto, { destino, origem: de, nome, bytes });
      arquivos.push({ ...visaoDaCaixa(linha), ok: true, repetido, fiscal: resumoFiscalDoArquivo(linha.tipo_real, bytes) });
    } catch (erro) {
      if (!(erro instanceof ErroMcp)) throw erro;
      arquivos.push({ nome, ok: false, erro: erro.message });
    }
  };

  for (const referencia of referencias) {
    const baixado = await baixarArquivoDoChat(referencia.download_link);
    if (!baixado.ok) {
      arquivos.push({ nome: referencia.nome, ok: false, erro: baixado.erro });
      continue;
    }
    await receber(referencia.nome, baixado.bytes, "chatgpt");
  }
  if (conteudo) await receber(texto(corpo, "nome_do_arquivo", { max: 300 }) ?? "texto.xml", Buffer.from(conteudo, "utf8"), "texto");

  const novos = arquivos.filter(a => a.ok === true && a.repetido === false).length;
  if (novos > 0) {
    await registrarAcao(admin, quem, {
      prestacaoId: prestacao.id,
      ferramenta: "enviar_arquivos",
      acao: "criar",
      tabela: "assistente_arquivos",
      resumo: `Recebeu ${novos} ${novos === 1 ? "arquivo" : "arquivos"} pelo chat para ${destino === "despesa" ? "despesa" : "evidência"}`,
    });
  }

  return resposta({
    prestacao: { id: prestacao.id, titulo: prestacao.titulo, url: linkDaPrestacao(origem, prestacao.id) },
    destino,
    arquivos,
    recebidos: arquivos.filter(a => a.ok === true).length,
    com_erro: arquivos.filter(a => a.ok === false).length,
    proximo_passo:
      destino === "despesa"
        ? "Leia cada documento e chame registrar_despesas com o arquivo_id e os dados (valor, data, número, descrição). Para XML de nota, os dados vêm do próprio XML."
        : "Chame registrar_evidencia com o arquivo_id e o que ele comprova.",
  });
});
