import { linhasVisiveis, montarArvore, percentualPago, rotuloGrupo, type ComprovanteDoOrcamento, type NoOrcamento, type PagamentoDoOrcamento } from "@/lib/prestacao/orcamento";
import type { RegimeNormativo } from "@/lib/prestacao/regimes";

export interface EntradaDoOrcamento {
  nos: readonly NoOrcamento[];
  comprovantes: readonly ComprovanteDoOrcamento[];
  pagamentos: readonly PagamentoDoOrcamento[];
  regime: RegimeNormativo | null;
  somenteAgrupadores: boolean;
  limite: number;
  deslocamento: number;
}

/**
 * O orçamento em uso, previsto contra executado, como a aba Orçamento do app (mesma árvore e mesmas somas de
 * lib/prestacao/orcamento.ts): aprovado, remanejado e vigente; "comprometido" é a despesa ainda sem pagamento
 * conciliado com o extrato, e "pago" a parte conciliada.
 */
export function montarOrcamento(entrada: EntradaDoOrcamento) {
  const arvore = montarArvore(entrada.nos, entrada.comprovantes, entrada.pagamentos);
  const todas = linhasVisiveis(arvore.raizes).filter(linha => !entrada.somenteAgrupadores || linha.no.tipo !== "item");
  const pagina = todas.slice(entrada.deslocamento, entrada.deslocamento + entrada.limite);
  const proximo = entrada.deslocamento + entrada.limite;
  return {
    totais: { ...arvore.total, percentual_pago: percentualPago(arvore.total) },
    fora_da_versao: {
      quantidade: arvore.foraDaVersao.quantidade,
      comprometido: arvore.foraDaVersao.comprometido,
      pago: arvore.foraDaVersao.pago,
    },
    linhas: pagina.map(linha => ({
      id: linha.no.id,
      tipo: linha.no.tipo,
      codigo: linha.no.codigo,
      nome: linha.no.nome,
      nivel: linha.nivel,
      grupo_de_custo: linha.grupo ? { codigo: linha.grupo, rotulo: rotuloGrupo(linha.grupo, entrada.regime) } : null,
      aprovado: linha.totais.aprovado,
      remanejado: linha.totais.remanejado,
      vigente: linha.totais.vigente,
      comprometido: linha.totais.comprometido,
      pago: linha.totais.pago,
      saldo: linha.totais.saldo,
      percentual_pago: percentualPago(linha.totais),
      itens: linha.totais.itens,
      ...(linha.no.tipo === "item" && linha.no.quantidade !== null
        ? { quantidade: linha.no.quantidade, ocorrencias: linha.no.ocorrencias, unidade: linha.no.unidade, valor_unitario: linha.no.valor_unitario }
        : {}),
    })),
    total_de_linhas: todas.length,
    proximo_deslocamento: proximo < todas.length ? proximo : null,
  };
}
