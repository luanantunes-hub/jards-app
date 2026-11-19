// A vitrine de uma sessão: o que a página de compra mostra (ingressos, preço do lote da vez, quantos sobram) e a conta do total. Só lógica, sem banco e sem
// nenhum import de servidor: roda no navegador (o total muda a cada clique) e nos testes. A conta espelha fn_ticketeria_reservar: os lotes de um ingresso
// seguem em sequência; um lote cuja janela ainda não abriu segura os seguintes, o que fechou ou esgotou passa a vez ao próximo.

export type LoteDaVitrine = { id: string; ordem: number; preco_centavos: number; quantidade: number; vendas_inicio: string | null; vendas_fim: string | null; ocupados: number };

/** Uma faixa de preço: quantos ingressos ainda cabem a este preço, na ordem em que o banco os vai tirando. */
export type FaixaDePreco = { preco_centavos: number; livres: number };

export function faixasDoIngresso(lotes: readonly LoteDaVitrine[], agora: number = Date.now()): FaixaDePreco[] {
  const faixas: FaixaDePreco[] = [];
  for (const lote of [...lotes].sort((a, b) => a.ordem - b.ordem || a.id.localeCompare(b.id))) {
    if (lote.vendas_inicio && Date.parse(lote.vendas_inicio) > agora) break; // a janela ainda não abriu: segura os seguintes
    if (lote.vendas_fim && Date.parse(lote.vendas_fim) <= agora) continue; // a janela fechou: vale o seguinte
    const livres = lote.quantidade - lote.ocupados;
    if (livres > 0) faixas.push({ preco_centavos: lote.preco_centavos, livres });
  }
  return faixas;
}

export const disponivelNasFaixas = (faixas: readonly FaixaDePreco[]) => faixas.reduce((soma, f) => soma + f.livres, 0);

/** O total de `quantidade` ingressos, tirando das faixas em ordem; null se não há tantos. */
export function totalNasFaixas(faixas: readonly FaixaDePreco[], quantidade: number): number | null {
  if (!Number.isInteger(quantidade) || quantidade < 0) return null;
  let falta = quantidade;
  let total = 0;
  for (const f of faixas) {
    const tira = Math.min(f.livres, falta);
    total += tira * f.preco_centavos;
    falta -= tira;
    if (falta === 0) break;
  }
  return falta === 0 ? total : null;
}

export type IngressoDaVitrine = { id: string; nome: string; descricao: string | null; limite: number; faixas: FaixaDePreco[] };

export type EstadoDaVitrine = "aberta" | "sessao_encerrada" | "sessao_cancelada" | "nao_publicado" | "vendas_pausadas";

export type VitrineDaSessao = {
  estado: EstadoDaVitrine;
  sessao_id: string;
  site: { titulo: string; cor: string };
  evento: { titulo: string; descricao: string | null; classificacao: string | null; quando: string; local: string };
  ingressos: IngressoDaVitrine[];
};

/** O estado da venda de uma sessão, na ordem em que o comprador precisa saber: não publicado, cancelada, encerrada, sem conta de recebimento, aberta. */
export function estadoDaVenda(entrada: { eventoPublicado: boolean; canceladaEm: string | null; inicio: string; contaAprovada: boolean }, agora: number = Date.now()): EstadoDaVitrine {
  if (!entrada.eventoPublicado) return "nao_publicado";
  if (entrada.canceladaEm) return "sessao_cancelada";
  if (Date.parse(entrada.inicio) <= agora) return "sessao_encerrada";
  if (!entrada.contaAprovada) return "vendas_pausadas";
  return "aberta";
}

/** Os textos das telas de aviso, por estado. */
export const AVISO_DO_ESTADO: Record<Exclude<EstadoDaVitrine, "aberta">, { titulo: string; texto: string }> = {
  nao_publicado: { titulo: "Este evento ainda não está à venda", texto: "Volte em breve." },
  sessao_cancelada: { titulo: "Esta sessão foi cancelada", texto: "Não há mais ingressos à venda para ela. Quem já comprou receberá as orientações por e-mail." },
  sessao_encerrada: { titulo: "Esta sessão já aconteceu", texto: "As vendas estão encerradas." },
  vendas_pausadas: { titulo: "As vendas estão pausadas", texto: "Este evento não está vendendo ingressos agora. Tente mais tarde." },
};
