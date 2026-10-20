import { avisarEvidenciasRegistradas, lerEvidenciaInformada, MAX_EVIDENCIAS_POR_CHAMADA, registrarEvidencia, type ResultadoDaEvidencia } from "@/lib/mcp/prestacao/evidencias-gravacao";
import { exigirEdicao, quemGrava } from "@/lib/mcp/prestacao/gravacao";
import { prestacaoDaOrganizacao } from "@/lib/mcp/prestacao/leitura";
import { linkDaPrestacao } from "@/lib/mcp/prestacao/resumo";
import { resposta, rotaMcp } from "@/lib/mcp/rota";
import { ErroMcp } from "@/lib/mcp/validacao";

/**
 * Registra evidências da realização do objeto (foto, lista de presença, declaração, clipping, link…), até 10 por vez, a partir
 * de arquivos da caixa de entrada ou de links, ligadas à meta, à atividade ou ao local. Ficam em "Ações do assistente"; a equipe confere.
 */
export const POST = rotaMcp({ escrita: true, modulo: "prestacao" }, async ({ admin, orgId, id, ctx, corpo, origem }) => {
  const prestacao = await prestacaoDaOrganizacao(admin, orgId, id);
  const quem = quemGrava(ctx);
  await exigirEdicao(admin, quem.usuarioId, prestacao.id);

  const lista = corpo.evidencias;
  if (!Array.isArray(lista) || lista.length === 0) throw new ErroMcp(400, 'Informe "evidencias": uma lista com uma evidência por arquivo ou link.');
  if (lista.length > MAX_EVIDENCIAS_POR_CHAMADA) throw new ErroMcp(400, `Registre até ${MAX_EVIDENCIAS_POR_CHAMADA} evidências por vez.`);
  const informadas = lista.map((item, posicao) => lerEvidenciaInformada(item, posicao));

  const resultados: ResultadoDaEvidencia[] = [];
  const vistos = new Set<string>();
  for (const informada of informadas) {
    if (informada.arquivoId && vistos.has(informada.arquivoId)) {
      resultados.push({ ok: false, arquivo_id: informada.arquivoId, erro: "Este arquivo aparece mais de uma vez na lista." });
      continue;
    }
    if (informada.arquivoId) vistos.add(informada.arquivoId);
    resultados.push(await registrarEvidencia({ admin, prestacaoId: prestacao.id, quem, informada }));
  }

  const registradas = resultados.filter(r => r.ok);
  if (registradas.length > 0) await avisarEvidenciasRegistradas(admin, prestacao.id, prestacao.titulo, registradas.length, registradas[0].acao_id ?? registradas[0].evidencia_id ?? prestacao.id);

  return resposta({
    prestacao: { id: prestacao.id, titulo: prestacao.titulo, url: linkDaPrestacao(origem, prestacao.id, "objeto") },
    registradas: registradas.length,
    com_erro: resultados.length - registradas.length,
    resultados,
  });
});
