import { randomUUID } from "crypto";
import { arquivosDeTesteVencidos, caminhoDoDiagnostico, pastaDoDiagnostico } from "@/lib/mcp/prestacao/diagnostico";
import { resposta, rotaMcp } from "@/lib/mcp/rota";
import { ErroMcp } from "@/lib/mcp/validacao";

/**
 * Diagnóstico do envio por endereço assinado: devolve um endereço de upload direto ao Storage para o assistente enviar
 * um arquivo do ambiente dele com PUT. O endereço só aceita um arquivo, nesse caminho, e vale por algumas horas (prazo
 * fixo do Storage). Prova se o Claude (ou o Claude Code) alcança o Storage antes de a caixa de entrada existir.
 * O arquivo de teste vai para uma pasta de diagnóstico e é apagado na conferência (ou, se ninguém conferir, na próxima preparação depois de um dia).
 */
export const POST = rotaMcp({ escrita: true, modulo: "prestacao" }, async ({ admin, orgId }) => {
  const bucket = admin.storage.from("documentos");

  // Faxina de quem não conferiu: melhor esforço, nunca atrapalha a preparação.
  try {
    const pasta = pastaDoDiagnostico(orgId);
    const { data: existentes } = await bucket.list(pasta, { limit: 100 });
    const vencidos = arquivosDeTesteVencidos(existentes ?? [], Date.now());
    if (vencidos.length > 0) await bucket.remove(vencidos.map((nome) => `${pasta}/${nome}`));
  } catch {
    // sem faxina desta vez
  }

  const arquivoId = randomUUID();
  const { data, error } = await bucket.createSignedUploadUrl(caminhoDoDiagnostico(orgId, arquivoId));
  if (error || !data) throw new ErroMcp(502, "Não foi possível preparar o envio agora. Tente de novo em instantes.");

  const dominio = new URL(data.signedUrl).host;
  return resposta({
    arquivo_id: arquivoId,
    upload_url: data.signedUrl,
    metodo: "PUT",
    cabecalho: "Content-Type: application/octet-stream",
    dominio_a_liberar: dominio,
    exemplo: `curl -X PUT -H "Content-Type: application/octet-stream" --data-binary @arquivo.pdf "${data.signedUrl}"`,
    depois: "Envie o arquivo e chame conferir_upload_de_diagnostico com o arquivo_id. Se o envio falhar por rede, o ambiente precisa liberar o domínio em dominio_a_liberar.",
  });
});
