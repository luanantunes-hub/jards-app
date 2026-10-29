import { exigirEdicao, quemGrava } from "@/lib/mcp/prestacao/gravacao";
import { prestacaoDaOrganizacao } from "@/lib/mcp/prestacao/leitura";
import { avisarSecaoPreenchida, montarRelatorio, salvarSecaoDoRelatorio, secaoParaOAssistente } from "@/lib/mcp/prestacao/relatorio-conector";
import { resposta, rotaMcp } from "@/lib/mcp/rota";

const enderecoDoRelatorio = (origem: string, id: string) => `${origem}/prestacoes/${id}/envio/objeto`;

/**
 * O relatório do objeto: as seções do modelo do regime, quantas lacunas há em cada e, nas que têm campo para a pessoa
 * preencher (um texto e/ou números, como empregos), o que já está escrito. É a leitura que vem antes de salvar_secao_do_relatorio.
 */
export const GET = rotaMcp({ escrita: false, modulo: "prestacao" }, async ({ admin, orgId, id, origem }) => {
  const prestacao = await prestacaoDaOrganizacao(admin, orgId, id);
  const { rascunho, avisos } = await montarRelatorio(admin, prestacao);
  return resposta({
    prestacao: { id: prestacao.id, titulo: prestacao.titulo, url: enderecoDoRelatorio(origem, prestacao.id) },
    modelo: rascunho.modelo,
    relatorio: rascunho.titulo,
    descricao: rascunho.descricao,
    lacunas: rascunho.lacunas,
    secoes: rascunho.secoes.map(secaoParaOAssistente),
    ...(avisos.length > 0 ? { avisos } : {}),
    orientacao: "As seções com pode_preencher=true recebem o texto e os números que a pessoa contar, por salvar_secao_do_relatorio. As outras o Jards monta sozinho com as metas, os locais, as evidências e os demais dados.",
  });
});

/**
 * Preenche o texto e/ou os números de uma seção do relatório. Não troca texto que a pessoa já escreveu sem `substituir: true`
 * (e o de antes fica guardado em "Ações do assistente"), e não apaga nada.
 */
export const POST = rotaMcp({ escrita: true, modulo: "prestacao" }, async ({ admin, orgId, id, ctx, corpo, origem }) => {
  const prestacao = await prestacaoDaOrganizacao(admin, orgId, id);
  const quem = quemGrava(ctx);
  await exigirEdicao(admin, quem.usuarioId, prestacao.id);
  const resultado = await salvarSecaoDoRelatorio({ admin, prestacao, quem, corpo });
  if (resultado.mudou) await avisarSecaoPreenchida(admin, prestacao.id, prestacao.titulo, resultado.titulo, resultado.acao_ids[0] ?? prestacao.id);
  return resposta({
    prestacao: { id: prestacao.id, titulo: prestacao.titulo, url: enderecoDoRelatorio(origem, prestacao.id) },
    ...resultado,
    ...(resultado.mudou ? {} : { aviso: "Nada mudou: o que você enviou já estava salvo." }),
  });
});
