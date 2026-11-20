// A planta da sala desenhada no PDF da ficha técnica (PD3.5, terceiro corte): a geometria em metros da PD2.2 virada
// em pontos do PDF, com a escala que faz a planta caber na largura e na altura disponíveis. Sem tela e sem banco.
//
// O desenho sai em coordenadas do PDF: a origem é o canto de baixo à esquerda da caixa e o y cresce para cima (na
// planta o y cresce para baixo, como na tela). Cada forma já vem com o canto que o PDF usa para desenhar um
// retângulo girado, então quem monta o PDF só soma a origem da caixa.

export type ObjetoParaPdf = { rotulo: string; x_m: number; y_m: number; largura_m: number; profundidade_m: number; rotacao_graus: number };
export type PlantaParaPdf = { nome: string; largura_m: number; profundidade_m: number; objetos: readonly ObjetoParaPdf[] };

export type FormaDoDesenho = {
  /** O canto que o PDF gira em volta, em pontos, a partir da origem da caixa. */
  x: number; y: number;
  largura: number; altura: number;
  /** Graus no sentido do PDF (anti-horário); a planta gira no sentido da tela (horário). */
  rotacao: number;
  rotulo: string;
  /** O centro da forma, onde o rótulo é escrito. */
  centroX: number; centroY: number;
};
export type DesenhoDaPlanta = { largura: number; altura: number; escala: number; formas: FormaDoDesenho[] };

/** Quantos pontos do PDF cada metro ocupa, no máximo: planta pequena não vira um desenho gigante. */
const ESCALA_MAXIMA = 60;

/**
 * A planta em pontos do PDF, caber na largura e na altura dadas (a escala é a menor das duas, limitada por
 * `ESCALA_MAXIMA`). Objeto girado sai girado, em volta do próprio centro.
 */
export function desenhoDaPlanta(planta: PlantaParaPdf, larguraDisponivel: number, alturaMaxima: number): DesenhoDaPlanta {
  const escala = Math.min(larguraDisponivel / planta.largura_m, alturaMaxima / planta.profundidade_m, ESCALA_MAXIMA);
  const largura = planta.largura_m * escala;
  const altura = planta.profundidade_m * escala;
  const formas = planta.objetos.map(objeto => {
    const w = objeto.largura_m * escala, h = objeto.profundidade_m * escala;
    // O centro do objeto: na planta o y cresce para baixo, no PDF para cima.
    const centroX = (objeto.x_m + objeto.largura_m / 2) * escala;
    const centroY = altura - (objeto.y_m + objeto.profundidade_m / 2) * escala;
    const radianos = (-objeto.rotacao_graus * Math.PI) / 180;
    const cos = Math.cos(radianos), sen = Math.sin(radianos);
    return {
      x: centroX - ((w / 2) * cos - (h / 2) * sen),
      y: centroY - ((w / 2) * sen + (h / 2) * cos),
      largura: w, altura: h, rotacao: objeto.rotacao_graus === 0 ? 0 : -objeto.rotacao_graus, rotulo: objeto.rotulo, centroX, centroY,
    };
  });
  return { largura, altura, escala, formas };
}

/** "6,0 m × 4,5 m · 1 cm = 50 cm" não: só a medida da planta, para a legenda abaixo do desenho. */
export function medidaDaPlanta(planta: { largura_m: number; profundidade_m: number }): string {
  const m = (n: number) => n.toLocaleString("pt-BR");
  return `${m(planta.largura_m)} m de largura × ${m(planta.profundidade_m)} m de profundidade`;
}

/**
 * A planta para o desenho em SVG (a página da ficha por link), nas próprias medidas em metros: o `viewBox` é a
 * planta, e cada objeto é um retângulo girado em volta do próprio centro. O rótulo só entra quando cabe dentro do
 * objeto, na letra do tamanho dado (em metros).
 */
export function svgDaPlanta(planta: PlantaParaPdf): { viewBox: string; letra: number; objetos: { x: number; y: number; largura: number; altura: number; giro: string; rotulo: string | null; centroX: number; centroY: number }[] } {
  const letra = Math.max(planta.largura_m, planta.profundidade_m) / 45;
  return {
    viewBox: `0 0 ${planta.largura_m} ${planta.profundidade_m}`,
    letra,
    objetos: planta.objetos.map(objeto => {
      const centroX = objeto.x_m + objeto.largura_m / 2, centroY = objeto.y_m + objeto.profundidade_m / 2;
      // Uma letra ocupa mais ou menos meia altura de largura; rótulo maior que o objeto fica de fora.
      const cabe = objeto.rotulo.length * letra * 0.5 <= Math.max(objeto.largura_m, objeto.profundidade_m);
      return {
        x: objeto.x_m, y: objeto.y_m, largura: objeto.largura_m, altura: objeto.profundidade_m,
        giro: objeto.rotacao_graus === 0 ? "" : `rotate(${objeto.rotacao_graus} ${centroX} ${centroY})`,
        rotulo: cabe ? objeto.rotulo : null, centroX, centroY,
      };
    }),
  };
}
