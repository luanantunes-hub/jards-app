import { impressaoDigital, LIMITE_ARQUIVO_BYTES, tipoPeloConteudo } from "@/lib/mcp/prestacao/arquivos";
import { caminhoDoDiagnostico, pastaENomeDoDiagnostico } from "@/lib/mcp/prestacao/diagnostico";
import { resposta, rotaMcp } from "@/lib/mcp/rota";
import { ErroMcp, uuidDe } from "@/lib/mcp/validacao";

/** Confere se o arquivo enviado ao endereço de diagnóstico chegou (tamanho, tipo pelo conteúdo, impressão digital) e apaga o de teste. */
export const POST = rotaMcp({ escrita: true, modulo: "prestacao" }, async ({ admin, orgId, corpo }) => {
  const arquivoId = uuidDe(corpo, "arquivo_id", true) as string;
  const bucket = admin.storage.from("documentos");
  const { pasta, nome } = pastaENomeDoDiagnostico(orgId, arquivoId);
  const caminho = caminhoDoDiagnostico(orgId, arquivoId);

  const { data: achados } = await bucket.list(pasta, { search: nome, limit: 1 });
  const achado = (achados ?? []).find((objeto) => objeto.name === nome);
  if (!achado) throw new ErroMcp(404, "Nenhum arquivo chegou nesse endereço ainda. Envie com PUT e confira de novo.");

  const tamanho = Number((achado.metadata as { size?: number } | null)?.size ?? 0);
  if (tamanho > LIMITE_ARQUIVO_BYTES) {
    await bucket.remove([caminho]);
    throw new ErroMcp(413, "O arquivo de teste passa de 15 MB e foi descartado.");
  }

  const { data: arquivo, error } = await bucket.download(caminho);
  if (error || !arquivo) throw new ErroMcp(502, "Não foi possível ler o arquivo enviado agora. Tente de novo em instantes.");
  const bytes = Buffer.from(await arquivo.arrayBuffer());
  await bucket.remove([caminho]);

  return resposta({
    chegou: true,
    bytes: bytes.length,
    tipo_pelo_conteudo: tipoPeloConteudo(bytes),
    sha256_inicio: impressaoDigital(bytes).slice(0, 16),
    arquivo_de_teste_apagado: true,
  });
});
