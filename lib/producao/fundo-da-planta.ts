// O fundo da planta vindo de um PDF (plano do módulo, PD2.3, primeiro corte): a imagem que fica atrás dos objetos. O navegador desenha a página do PDF e a reduz até caber no
// limite do banco. Sem tela e sem banco.

/** O mesmo teto do banco (producao_plantas_fundo_check): letras do data URL. */
export const LIMITE_DO_FUNDO = 1_500_000;
export const PREFIXO_DO_FUNDO = "data:image/jpeg;base64,";
export const OPACIDADE_MINIMA = 10;
export const OPACIDADE_MAXIMA = 100;
export const OPACIDADE_PADRAO = 40;
/** O PDF que a pessoa escolhe pode ter até 25 MB (planta de palco exportada costuma ter bem menos). */
export const LIMITE_DO_PDF_BYTES = 25 * 1024 * 1024;

export const fundoValido = (texto: string) => texto.startsWith(PREFIXO_DO_FUNDO) && texto.length > PREFIXO_DO_FUNDO.length && texto.length <= LIMITE_DO_FUNDO;
export const opacidadeValida = (numero: number) => Number.isInteger(numero) && numero >= OPACIDADE_MINIMA && numero <= OPACIDADE_MAXIMA;

/** As tentativas, da melhor imagem para a menor: largura em pixels e qualidade do JPEG. */
export const TENTATIVAS_DE_TAMANHO: readonly { largura: number; qualidade: number }[] = [
  { largura: 1800, qualidade: 0.8 }, { largura: 1800, qualidade: 0.65 }, { largura: 1400, qualidade: 0.7 }, { largura: 1100, qualidade: 0.65 }, { largura: 800, qualidade: 0.6 },
];

/**
 * Tenta cada tamanho, do maior para o menor, e fica com o primeiro que cabe no limite do banco. `gerar` desenha a página na largura pedida e devolve o data URL;
 * devolve nulo se nem o menor couber.
 */
export async function primeiroQueCabe(gerar: (largura: number, qualidade: number) => string | Promise<string>): Promise<string | null> {
  for (const tentativa of TENTATIVAS_DE_TAMANHO) {
    const texto = await gerar(tentativa.largura, tentativa.qualidade);
    if (fundoValido(texto)) return texto;
  }
  return null;
}

/** Quantas páginas o PDF tem de fato: a página escolhida vai de 1 até o total. */
export const paginaEscolhida = (texto: string, total: number): number => {
  const numero = Math.trunc(Number(texto));
  if (!Number.isFinite(numero) || total < 1) return 1;
  return Math.min(total, Math.max(1, numero));
};
