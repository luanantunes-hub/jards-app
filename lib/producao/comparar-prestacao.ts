// O orçamento da produção ao lado do da prestação de contas (plano do módulo, PD10.4): só leitura, dizendo de onde
// vem cada número. Sem tela e sem banco.
//
// **A produção nunca grava na árvore regulatória da prestação**, e o Jards **não** iguala as categorias de um lado
// às do outro: cada lado aparece com os nomes que usa, e o total é o que dá para comparar. Igualar categoria é
// decisão de quem presta contas, com o contador — não do app.

import type { CategoriaDoOrcamento } from "@/lib/producao/estados";
import { ROTULO_DA_CATEGORIA_DO_ORCAMENTO, type ContasDoOrcamento } from "@/lib/producao/orcamento";

/** Um nó do orçamento da prestação, como o banco dela guarda (valores em reais, não em centavos). */
export type NoDaPrestacao = { id: string; tipo: string; nome: string; grupo_custo: string | null; valor_total: number | null; parent_id: string | null };

export type LinhaDaComparacao = { nome: string; centavos: number };
export type Comparacao = {
  producao: { linhas: LinhaDaComparacao[]; totalCentavos: number };
  prestacao: { linhas: LinhaDaComparacao[]; totalCentavos: number };
  /** Produção menos prestação: positivo = a produção prevê mais do que a prestação aprovou. */
  diferencaCentavos: number;
};

/** Reais (como a prestação guarda) em centavos inteiros (como a produção conta). */
const emCentavos = (reais: number | null | undefined) => Math.round((reais ?? 0) * 100);

/**
 * As duas colunas: a produção por categoria (o previsto de cada uma) e a prestação por grupo de custo (o valor
 * total de cada nó de folha). Nó que tem filho não entra, para o valor não ser contado duas vezes.
 */
export function compararComAPrestacao(contas: ContasDoOrcamento, nos: readonly NoDaPrestacao[]): Comparacao {
  const producao = contas.porCategoria
    .map(item => ({ nome: ROTULO_DA_CATEGORIA_DO_ORCAMENTO[item.categoria as CategoriaDoOrcamento], centavos: item.previstoCentavos }))
    .filter(linha => linha.centavos !== 0);

  // Só as folhas: pai com filho já soma os filhos.
  const comFilho = new Set(nos.map(no => no.parent_id).filter((id): id is string => id !== null));
  const porGrupo = new Map<string, number>();
  for (const no of nos) {
    if (comFilho.has(no.id)) continue;
    const grupo = (no.grupo_custo ?? "").trim() || no.tipo.trim() || "Sem grupo";
    porGrupo.set(grupo, (porGrupo.get(grupo) ?? 0) + emCentavos(no.valor_total));
  }
  const prestacao = [...porGrupo.entries()]
    .map(([nome, centavos]) => ({ nome, centavos }))
    .filter(linha => linha.centavos !== 0)
    .sort((a, b) => b.centavos - a.centavos || a.nome.localeCompare(b.nome, "pt-BR"));

  const totalProducao = producao.reduce((soma, linha) => soma + linha.centavos, 0);
  const totalPrestacao = prestacao.reduce((soma, linha) => soma + linha.centavos, 0);
  return {
    producao: { linhas: producao, totalCentavos: totalProducao },
    prestacao: { linhas: prestacao, totalCentavos: totalPrestacao },
    diferencaCentavos: totalProducao - totalPrestacao,
  };
}
