import { lerObjeto } from "@/lib/mcp/prestacao/objeto-leitura";
import { prestacaoDaOrganizacao } from "@/lib/mcp/prestacao/leitura";
import { linkDaPrestacao } from "@/lib/mcp/prestacao/resumo";
import { resposta, rotaMcp } from "@/lib/mcp/rota";
import { paginacao } from "@/lib/mcp/validacao";

/**
 * O objeto da prestação: as metas (previsto, realizado, o que falta justificar), os locais de realização e as atividades,
 * paginadas. É a leitura que vem antes de registrar atividade ou atualizar meta: traz os ids que essas ferramentas pedem.
 */
export const GET = rotaMcp({ escrita: false, modulo: "prestacao" }, async ({ admin, orgId, id, query, origem }) => {
  const prestacao = await prestacaoDaOrganizacao(admin, orgId, id);
  const pagina = paginacao(query);
  const objeto = await lerObjeto(admin, prestacao.id, pagina);
  return resposta({
    prestacao: {
      id: prestacao.id,
      titulo: prestacao.titulo,
      periodo_de_execucao: { inicio: prestacao.data_inicio_execucao, fim: prestacao.data_fim_execucao },
      url_objeto: linkDaPrestacao(origem, prestacao.id, "objeto"),
      url_atividades: linkDaPrestacao(origem, prestacao.id, "atividades"),
    },
    ...objeto,
    pagina,
  });
});
