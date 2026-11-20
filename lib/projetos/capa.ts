// Proporção da faixa de capa na página do projeto (largura ÷ altura, por volta de 1200 × 104 px em tela comum).
export const PROPORCAO_DA_FAIXA = 1200 / 104;

/**
 * A capa dentro da pasta mostra o mesmo enquadramento escolhido na página do projeto. Lá a faixa é bem mais larga
 * que a pasta, então a mesma porcentagem de posição mostraria outra região: aqui a pasta centraliza exatamente a
 * faixa escolhida (e mostra só um pouco em volta). A conta usa o tamanho real da imagem, lido quando ela carrega.
 */
export function posicaoNaPasta(posicaoY: number, proporcaoDaImagem: number, proporcaoDaPasta: number, proporcaoDaFaixa = PROPORCAO_DA_FAIXA): number {
  // fração da altura da imagem que aparece em cada moldura (a imagem preenche a largura enquanto for mais "alta" que a moldura)
  const naFaixa = Math.min(1, proporcaoDaImagem / proporcaoDaFaixa);
  const naPasta = Math.min(1, proporcaoDaImagem / proporcaoDaPasta);
  if (naPasta >= 1) return 50;
  const centro = (posicaoY / 100) * (1 - naFaixa) + naFaixa / 2;
  const topo = Math.min(Math.max(centro - naPasta / 2, 0), 1 - naPasta);
  return (topo / (1 - naPasta)) * 100;
}
