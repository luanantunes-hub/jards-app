import { DESFECHOS_NEGOCIACAO } from "@/lib/etapas";
import { hojeEmSaoPaulo } from "@/lib/mcp/datas";
import { carregarFunil } from "@/lib/mcp/funil";
import { resposta, rotaMcp } from "@/lib/mcp/rota";
import { erroDoBanco } from "@/lib/mcp/validacao";

/** O banco devolve no máximo isto por consulta: acima disso a contagem é parcial e o resumo avisa. */
const LIMITE_DA_CONSULTA = 1000;

function contarPor<T extends Record<string, unknown>>(linhas: T[], campo: keyof T) {
  const saida: Record<string, number> = {};
  for (const linha of linhas) {
    const chave = String(linha[campo] ?? "sem_status");
    saida[chave] = (saida[chave] ?? 0) + 1;
  }
  return saida;
}

export const GET = rotaMcp({ escrita: false }, async ({ admin, orgId }) => {
  const daOrganizacao = (tabela: string, colunas: string) => admin.from(tabela).select(colunas).eq("organization_id", orgId).limit(LIMITE_DA_CONSULTA);
  const [projetos, propostas, empresas, negociacoes, atividades, vendas, funil] = await Promise.all([
    daOrganizacao("projetos_crm", "fase,status_comercial,valor_total"),
    daOrganizacao("propostas", "status"),
    daOrganizacao("empresas_crm", "tipo"),
    daOrganizacao("captacoes", "status,valor_solicitado"),
    daOrganizacao("atividades", "feita,data_prevista"),
    daOrganizacao("vendas_patrocinio", "valor_vendido"),
    carregarFunil(admin, orgId),
  ]);
  for (const resultado of [projetos, propostas, empresas, negociacoes, atividades, vendas]) {
    if (resultado.error) throw erroDoBanco(resultado.error);
  }

  const listas = [projetos, propostas, empresas, negociacoes, atividades, vendas].map((resultado) => (resultado.data ?? []) as unknown as Record<string, unknown>[]);
  const [linhasProjetos, linhasPropostas, linhasEmpresas, linhasNegociacoes, linhasAtividades, linhasVendas] = listas;

  const nomesDasEtapas = new Map(funil.negociacao.map((etapa) => [etapa.chave, etapa.nome]));
  const porEtapa: Record<string, number> = {};
  for (const [chave, quantidade] of Object.entries(contarPor(linhasNegociacoes, "status"))) {
    porEtapa[nomesDasEtapas.get(chave) ?? chave] = quantidade;
  }
  const emAberto = linhasNegociacoes.filter((linha) => !DESFECHOS_NEGOCIACAO.includes(String(linha.status)));

  const hoje = hojeEmSaoPaulo();
  const pendentes = linhasAtividades.filter((linha) => linha.feita === false);
  const atrasadas = pendentes.filter((linha) => typeof linha.data_prevista === "string" && linha.data_prevista.slice(0, 10) < hoje);

  return resposta({
    total_projetos: linhasProjetos.length,
    projetos_por_fase: contarPor(linhasProjetos, "fase"),
    projetos_por_status_comercial: contarPor(linhasProjetos, "status_comercial"),
    propostas_por_status: contarPor(linhasPropostas, "status"),
    empresas_por_tipo: contarPor(linhasEmpresas, "tipo"),
    negociacoes_por_etapa: porEtapa,
    negociacoes_em_aberto: emAberto.length,
    valor_em_negociacoes_em_aberto: emAberto.reduce((soma, linha) => soma + (Number(linha.valor_solicitado) || 0), 0),
    atividades: {
      pendentes: pendentes.length,
      atrasadas: atrasadas.length,
      feitas: linhasAtividades.length - pendentes.length,
    },
    valor_total_captado_historico: linhasVendas.reduce((soma, venda) => soma + (Number(venda.valor_vendido) || 0), 0),
    contagens_parciais: listas.some((linhas) => linhas.length >= LIMITE_DA_CONSULTA),
  });
});
