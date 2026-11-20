// A planta da produção (plano do módulo, PD2.2, primeiro corte): geometria em metros, leitura do formulário e o
// encaixe de um item do inventário na planta. Sem tela e sem banco.

import type { TipoDePlanta } from "@/lib/producao/estados";
import { lerNumero } from "@/lib/producao/inventario";

export const ROTULO_DO_TIPO_DE_PLANTA: Record<TipoDePlanta, string> = {
  palco: "Palco", sala: "Sala", hospedagem: "Hospedagem", exposicao: "Exposição", outro: "Outro",
};

/** O passo do encaixe ao arrastar, em metros. */
export const PASSO_M = 0.1;

export type LeituraDaPlanta = { ok: true; planta: { nome: string; tipo: TipoDePlanta; largura_m: number; profundidade_m: number } } | { ok: false; erro: string };

/** A planta como o banco aceita: nome até 200 letras e lados de 0,5 a 500 metros. */
export function lerPlanta(campos: { nome: string; tipo: string; largura: string; profundidade: string }): LeituraDaPlanta {
  const nome = campos.nome.trim();
  if (nome === "") return { ok: false, erro: "Dê um nome à planta." };
  if (nome.length > 200) return { ok: false, erro: "O nome pode ter até 200 letras." };
  if (!(Object.keys(ROTULO_DO_TIPO_DE_PLANTA) as string[]).includes(campos.tipo)) return { ok: false, erro: "Escolha o tipo." };
  const largura = lerNumero(campos.largura), profundidade = lerNumero(campos.profundidade);
  const lado = (valor: number | null | "invalido") => valor !== null && valor !== "invalido" && valor >= 0.5 && valor <= 500;
  if (!lado(largura) || !lado(profundidade)) return { ok: false, erro: "Largura e profundidade ficam entre 0,5 e 500 metros." };
  return { ok: true, planta: { nome, tipo: campos.tipo as TipoDePlanta, largura_m: Math.round((largura as number) * 100) / 100, profundidade_m: Math.round((profundidade as number) * 100) / 100 } };
}

/** Encaixa o valor no passo (0,1 m): 2,34 → 2,3. */
export function encaixar(valor: number, passo = PASSO_M): number {
  return Math.round(Math.round(valor / passo) * passo * 100) / 100;
}

export type ObjetoDaPlanta = { x_m: number; y_m: number; largura_m: number; profundidade_m: number; rotacao_graus: number };

/** A caixa que o objeto ocupa depois de girado (retângulo que o contém), com o canto superior esquerdo em (x, y) do objeto. */
export function caixaOcupada(objeto: ObjetoDaPlanta): { x: number; y: number; largura: number; profundidade: number } {
  const radianos = (objeto.rotacao_graus * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radianos)), sen = Math.abs(Math.sin(radianos));
  const largura = objeto.largura_m * cos + objeto.profundidade_m * sen;
  const profundidade = objeto.largura_m * sen + objeto.profundidade_m * cos;
  const centroX = objeto.x_m + objeto.largura_m / 2, centroY = objeto.y_m + objeto.profundidade_m / 2;
  return { x: centroX - largura / 2, y: centroY - profundidade / 2, largura, profundidade };
}

/**
 * Mantém o objeto dentro da planta (a caixa girada não passa das bordas). Se a planta for menor que o objeto, ele fica
 * encostado no canto superior esquerdo.
 */
export function manterDentro(objeto: ObjetoDaPlanta, planta: { largura_m: number; profundidade_m: number }): { x_m: number; y_m: number } {
  const caixa = caixaOcupada(objeto);
  const dx = caixa.x - objeto.x_m, dy = caixa.y - objeto.y_m;
  const minimoX = -dx, maximoX = planta.largura_m - caixa.largura - dx;
  const minimoY = -dy, maximoY = planta.profundidade_m - caixa.profundidade - dy;
  const limitar = (valor: number, menor: number, maior: number) => (maior < menor ? menor : Math.min(maior, Math.max(menor, valor)));
  return { x_m: Math.round(limitar(objeto.x_m, minimoX, maximoX) * 100) / 100 + 0, y_m: Math.round(limitar(objeto.y_m, minimoY, maximoY) * 100) / 100 + 0 };
}

/** O ponto da tela (pixels) em metros da planta, dada a caixa do SVG na tela e o `viewBox` dele. */
export function pixelsParaMetros(
  ponto: { x: number; y: number },
  caixa: { left: number; top: number; width: number; height: number },
  viewBox: { x: number; y: number; largura: number; altura: number },
): { x: number; y: number } {
  return {
    x: viewBox.x + ((ponto.x - caixa.left) / caixa.width) * viewBox.largura,
    y: viewBox.y + ((ponto.y - caixa.top) / caixa.height) * viewBox.altura,
  };
}

/** O objeto novo a partir de um item do inventário: as dimensões em cm viram metros (1 m se faltar), no centro da planta. */
export function objetoDoItem(
  item: { nome: string; comprimento_cm: number | null; largura_cm: number | null },
  planta: { largura_m: number; profundidade_m: number },
): { rotulo: string; largura_m: number; profundidade_m: number; x_m: number; y_m: number } {
  const metros = (cm: number | null) => (cm && cm > 0 ? Math.min(500, Math.max(0.05, Math.round(cm) / 100)) : 1);
  const largura = metros(item.comprimento_cm), profundidade = metros(item.largura_cm);
  return {
    rotulo: item.nome.slice(0, 120), largura_m: largura, profundidade_m: profundidade,
    x_m: encaixar(Math.max(0, (planta.largura_m - largura) / 2)), y_m: encaixar(Math.max(0, (planta.profundidade_m - profundidade) / 2)),
  };
}

/** Gira em passos, sempre de 0 a menos de 360. */
export function girar(graus: number, passo: number): number {
  return (((graus + passo) % 360) + 360) % 360;
}
