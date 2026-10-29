// "Abrir produção" a partir do projeto (plano do módulo, PD1.4): quando o projeto
// já tem patrocínio vendido ou inscrição aprovada, o Jards oferece criar a temporada
// já ligada a ele. Só lê o que o projeto já tem; nada dispara sozinho.

/** O projeto tem dinheiro garantido: venda de patrocínio registrada ou inscrição aprovada. */
export function podeAbrirProducao(projeto: { vendas: number; inscricoesAprovadas: number }): boolean {
  return projeto.vendas > 0 || projeto.inscricoesAprovadas > 0;
}

/** Nome sugerido da temporada: o do projeto, para a pessoa reconhecer na agenda. */
export function tituloSugeridoDaTemporada(nomeDoProjeto: string): string {
  return nomeDoProjeto.trim().slice(0, 200);
}
