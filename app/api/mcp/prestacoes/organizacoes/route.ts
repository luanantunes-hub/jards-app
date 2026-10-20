import { podeEditarNaPrestacao } from "@/lib/mcp/prestacao/acesso";
import { resposta, rotaMcp } from "@/lib/mcp/rota";

/** Em quais organizações a pessoa usa a prestação de contas, com o papel dela e se o módulo permite gravar ou só consultar. */
export const GET = rotaMcp({ escrita: false, modulo: "prestacao", semOrganizacao: true }, async ({ ctx }) => {
  const acesso = ctx.prestacao;
  const organizacoes = (acesso?.organizationIds ?? []).map((id) => {
    const naOrganizacao = acesso!.porOrganizacao[id];
    return {
      id,
      nome: naOrganizacao.nome,
      seu_papel: naOrganizacao.papel,
      sua_funcao: naOrganizacao.funcao,
      modulo_em_vigor: naOrganizacao.emVigor,
      voce_pode_gravar: naOrganizacao.emVigor && podeEditarNaPrestacao(naOrganizacao.papel),
    };
  });
  return resposta({
    organizacoes,
    ...(organizacoes.length > 1 ? { orientacao: "Você usa a prestação de contas em mais de uma organização: informe organization_id nas outras ferramentas." } : {}),
  });
});
