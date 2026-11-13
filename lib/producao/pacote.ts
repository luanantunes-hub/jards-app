// O pacote do dinheiro da temporada (plano do módulo, PD5.7, primeiro corte): um .zip com as planilhas de tudo o que é dinheiro (orçamentos, acordos, pedidos, lançamentos,
// faturas, adiantamentos e diárias) e um resumo em texto. Sem tela e sem banco: recebe as linhas já lidas e devolve os arquivos. Os documentos (notas, recibos em arquivo)
// entram quando a produção tiver onde guardar arquivos (PD0.14), e o pacote passa a levá-los junto.

import { planilhaDasDiarias, planilhaDosAdiantamentos, totaisDasDiarias, totalEmAberto, type AdiantamentoDaTemporada, type DiariaDaTemporada, type GastoDoAdiantamento } from "@/lib/producao/adiantamentos";
import { comprometidoDoAcordoEmCentavos, planilhaDosAcordos, type AcordoDaTemporada } from "@/lib/producao/acordos";
import { formatarReais } from "@/lib/producao/bordero";
import { planilhaDasFaturas, totaisDasFaturas, type FaturaDaTemporada, type ParcelaDaFatura } from "@/lib/producao/faturas";
import { pagoPorLinha, planilhaDosLancamentos, type DivisaoDoLancamento, type LancamentoDaTemporada } from "@/lib/producao/lancamentos";
import { calcularOrcamento, planilhaDoOrcamento, ROTULO_DA_CATEGORIA_DO_ORCAMENTO, type LinhaDoOrcamento } from "@/lib/producao/orcamento";
import { planilhaDosPedidos, totaisDosPedidos, type PedidoDaTemporada } from "@/lib/producao/pedidos";
import type { SituacaoDoOrcamento } from "@/lib/producao/estados";
import { nomeDeArquivoSeguro, type ArquivoDoZip } from "@/lib/producao/zip";

export type DadosDoPacote = {
  temporada: string;
  hoje: string;
  orcamentos: readonly { id: string; nome: string; situacao: SituacaoDoOrcamento }[];
  linhas: readonly (LinhaDoOrcamento & { orcamento_id: string })[];
  acordos: readonly AcordoDaTemporada[];
  datasDoAcordo: (acordoId: string) => string[];
  pedidos: readonly PedidoDaTemporada[];
  lancamentos: readonly LancamentoDaTemporada[];
  divisoes: readonly DivisaoDoLancamento[];
  faturas: readonly FaturaDaTemporada[];
  parcelas: readonly ParcelaDaFatura[];
  adiantamentos: readonly AdiantamentoDaTemporada[];
  gastos: readonly GastoDoAdiantamento[];
  diarias: readonly DiariaDaTemporada[];
  /** O nome de uma pessoa da equipe pelo id. */
  nomeDaPessoa: (id: string) => string;
};

/** O nome do arquivo do pacote: "dinheiro-<temporada>-AAAA-MM-DD.zip". */
export const nomeDoPacote = (temporada: string, hoje: string) => `${nomeDeArquivoSeguro(`dinheiro ${temporada}`).replace(/ /g, "-").toLowerCase()}-${hoje}.zip`;

/** Os arquivos do pacote, na ordem em que aparecem: o resumo, os orçamentos e as demais planilhas (só as que têm linhas). */
export function montarPacote(dados: DadosDoPacote): ArquivoDoZip[] {
  const arquivos: ArquivoDoZip[] = [];
  const rotuloDaLinha = new Map(dados.linhas.map(linha => [linha.id, `${ROTULO_DA_CATEGORIA_DO_ORCAMENTO[linha.categoria]} · ${linha.descricao}`]));
  const dosAcordos: Record<string, number> = {};
  const acordosPorId = new Map(dados.acordos.map(acordo => [acordo.id, acordo]));
  for (const linha of dados.linhas) {
    const acordo = linha.acordo_id ? acordosPorId.get(linha.acordo_id) : undefined;
    const comprometido = acordo ? comprometidoDoAcordoEmCentavos(acordo) : null;
    if (comprometido !== null) dosAcordos[linha.id] = comprometido;
  }
  const pago = pagoPorLinha(dados.divisoes);
  const resumo: string[] = [`Dinheiro da temporada: ${dados.temporada}`, `Gerado em ${dados.hoje.split("-").reverse().join("/")}`, ""];

  dados.orcamentos.forEach((orcamento, indice) => {
    const linhas = dados.linhas.filter(linha => linha.orcamento_id === orcamento.id);
    const contas = calcularOrcamento(linhas, dosAcordos, pago);
    arquivos.push({ nome: `orcamento ${indice + 1} - ${orcamento.nome}.csv`, conteudo: planilhaDoOrcamento({ temporada: dados.temporada, nome: orcamento.nome, situacao: orcamento.situacao, contas }) });
    resumo.push(`Orçamento "${orcamento.nome}": previsto ${formatarReais(contas.previstoCentavos)} · comprometido ${formatarReais(contas.comprometidoCentavos)} · pago ${formatarReais(contas.pagoCentavos)} · a pagar ${formatarReais(contas.aPagarCentavos)}`);
  });
  if (dados.orcamentos.length === 0) resumo.push("Sem orçamento nesta temporada.");

  if (dados.acordos.length > 0) {
    arquivos.push({ nome: "acordos.csv", conteudo: planilhaDosAcordos({ temporada: dados.temporada, acordos: dados.acordos, datasDoAcordo: dados.datasDoAcordo }) });
    resumo.push(`Acordos: ${dados.acordos.length}, dos quais ${dados.acordos.filter(acordo => acordo.situacao === "assinado" || acordo.situacao === "encerrado").length} assinados`);
  }
  if (dados.pedidos.length > 0) {
    const totais = totaisDosPedidos(dados.pedidos, dados.hoje);
    arquivos.push({ nome: "pedidos de pagamento.csv", conteudo: planilhaDosPedidos({ temporada: dados.temporada, hoje: dados.hoje, pedidos: dados.pedidos, rotuloDaLinha: id => rotuloDaLinha.get(id) ?? "Linha apagada" }) });
    resumo.push(`Pedidos de pagamento: aguardando aprovação ${formatarReais(totais.aguardandoCentavos)} · aprovado e a pagar ${formatarReais(totais.aprovadoAPagarCentavos)} · pago ${formatarReais(totais.pagoCentavos)}${totais.pendenciasVencidas > 0 ? ` · ${totais.pendenciasVencidas} com a pendência vencida` : ""}`);
  }
  if (dados.lancamentos.length > 0) {
    arquivos.push({ nome: "lancamentos.csv", conteudo: planilhaDosLancamentos({ temporada: dados.temporada, lancamentos: dados.lancamentos, divisoes: dados.divisoes, rotuloDaLinha: id => rotuloDaLinha.get(id) ?? "Linha apagada" }) });
    resumo.push(`Lançamentos: ${dados.lancamentos.length}, no total de ${formatarReais(dados.lancamentos.reduce((soma, item) => soma + Math.round(item.valor * 100), 0))}`);
  }
  if (dados.faturas.length > 0) {
    const agrupadas = dados.faturas.map(fatura => ({ fatura, parcelas: dados.parcelas.filter(parcela => parcela.fatura_id === fatura.id) }));
    const totais = totaisDasFaturas(agrupadas, dados.hoje);
    arquivos.push({ nome: "faturas.csv", conteudo: planilhaDasFaturas({ temporada: dados.temporada, hoje: dados.hoje, faturas: agrupadas }) });
    resumo.push(`Faturas: a receber ${formatarReais(totais.aReceberCentavos)} · já recebido ${formatarReais(totais.recebidoCentavos)} · atrasado ${formatarReais(totais.atrasadoCentavos)} · retido ${formatarReais(totais.retidoCentavos)}`);
  }
  if (dados.adiantamentos.length > 0) {
    const itens = dados.adiantamentos.map(adiantamento => ({ pessoa: dados.nomeDaPessoa(adiantamento.pessoa_id), adiantamento, gastos: dados.gastos.filter(gasto => gasto.adiantamento_id === adiantamento.id) }));
    arquivos.push({ nome: "adiantamentos.csv", conteudo: planilhaDosAdiantamentos({ temporada: dados.temporada, itens }) });
    resumo.push(`Adiantamentos: ${formatarReais(totalEmAberto(itens))} ainda com as pessoas, em aberto`);
  }
  if (dados.diarias.length > 0) {
    const totais = totaisDasDiarias(dados.diarias);
    arquivos.push({ nome: "diarias.csv", conteudo: planilhaDasDiarias({ temporada: dados.temporada, itens: dados.diarias.map(diaria => ({ pessoa: dados.nomeDaPessoa(diaria.pessoa_id), diaria })) }) });
    resumo.push(`Diárias: total ${formatarReais(totais.totalCentavos)} · pago ${formatarReais(totais.pagoCentavos)} · a pagar ${formatarReais(totais.aPagarCentavos)}`);
  }
  resumo.push("", "As planilhas usam ponto e vírgula e vírgula decimal: abrem direto no Excel em português.", "Os arquivos de notas e recibos não vão neste pacote ainda: a produção ainda não os guarda.");
  return [{ nome: "resumo.txt", conteudo: resumo.join("\n") + "\n" }, ...arquivos];
}
