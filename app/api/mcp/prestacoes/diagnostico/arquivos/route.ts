import {
  baixarArquivoDoChat,
  impressaoDigital,
  lerReferenciasDeArquivo,
  MAX_TEXTO_DO_ARQUIVO,
  tipoPeloConteudo,
} from "@/lib/mcp/prestacao/arquivos";
import { resposta, rotaMcp } from "@/lib/mcp/rota";
import { texto } from "@/lib/mcp/validacao";

/**
 * Diagnóstico do envio de arquivos pelo chat: confere o que o assistente consegue entregar ao Jards (anexos do ChatGPT
 * ou um texto colado) e devolve nome, tipo, tamanho e impressão digital. Nada é guardado. Serve para provar o caminho
 * antes de a caixa de entrada existir.
 */
export const POST = rotaMcp({ escrita: true, modulo: "prestacao" }, async ({ corpo }) => {
  const referencias = lerReferenciasDeArquivo(corpo.openaiFileIdRefs);

  const arquivos = [];
  for (const referencia of referencias) {
    const inicio = Date.now();
    const baixado = await baixarArquivoDoChat(referencia.download_link);
    if (!baixado.ok) {
      arquivos.push({ nome: referencia.nome, tipo_declarado: referencia.mime_type, host_do_link: baixado.host, ok: false, erro: baixado.erro, ms: Date.now() - inicio });
      continue;
    }
    arquivos.push({
      nome: referencia.nome,
      tipo_declarado: referencia.mime_type,
      tipo_pelo_conteudo: tipoPeloConteudo(baixado.bytes),
      bytes: baixado.bytes.length,
      sha256_inicio: impressaoDigital(baixado.bytes).slice(0, 16),
      host_do_link: baixado.host,
      ok: true,
      ms: Date.now() - inicio,
    });
  }

  const conteudo = texto(corpo, "conteudo_texto", { max: MAX_TEXTO_DO_ARQUIVO });
  const textoRecebido = conteudo
    ? {
        nome: texto(corpo, "nome_do_arquivo", { max: 300 }) ?? "texto",
        caracteres: conteudo.length,
        tipo_pelo_conteudo: tipoPeloConteudo(Buffer.from(conteudo, "utf8")),
        sha256_inicio: impressaoDigital(conteudo).slice(0, 16),
      }
    : null;

  const chegaram = arquivos.filter((arquivo) => arquivo.ok).length;
  return resposta({
    chegaram_arquivos: chegaram,
    arquivos,
    texto: textoRecebido,
    ...(chegaram === 0 && !textoRecebido
      ? {
          dica: "Nenhum arquivo nem texto chegou. No ChatGPT, anexe o arquivo na conversa e peça de novo. No Claude, cole o texto do arquivo (XML, OFX, CSV) ou use preparar_upload_de_diagnostico para enviar o arquivo.",
        }
      : {}),
  });
});
