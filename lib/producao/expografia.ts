// A planta expográfica (plano do módulo, PD8.5, primeiro corte): as obras de arte de uma sala, onde ficam, a que altura, em que ordem se
// montam e com que luz. Sem tela e sem banco.

import type { LuzDaObra, PosicaoNaExposicao } from "@/lib/producao/estados";
import { encaixar, manterDentro } from "@/lib/producao/planta";

export const ROTULO_DA_POSICAO: Record<PosicaoNaExposicao, string> = { parede: "Na parede", piso: "No piso", teto: "Suspensa no teto", vitrine: "Em vitrine", outro: "Outro lugar" };
export const ROTULO_DA_LUZ: Record<LuzDaObra, string> = { sem_luz: "Sem luz", difusa: "Luz difusa", pontual: "Luz pontual", natural: "Luz natural", baixa: "Baixa luminosidade" };

export type ObraNaSala = {
  id: string; item_id: string; posicao: PosicaoNaExposicao; altura_instalacao_cm: number | null; ordem_montagem: number; luz: LuzDaObra; lux: number | null; notas: string | null; instalada_em: string | null;
  x_m?: number | null; y_m?: number | null;
};
export type ObraDeArte = { id: string; nome: string; altura_cm: number | null; largura_cm: number | null; comprimento_cm: number | null };

/** A ordem de montagem (a menor primeiro; empate pela instalação mais antiga e pelo id). */
export function ordenarMontagem<T extends Pick<ObraNaSala, "ordem_montagem" | "id">>(lista: readonly T[]): T[] {
  return [...lista].sort((a, b) => a.ordem_montagem - b.ordem_montagem || a.id.localeCompare(b.id));
}

/** Quantas obras já foram instaladas e a próxima a montar (a primeira da ordem que ainda não foi). */
export function progressoDaMontagem<T extends Pick<ObraNaSala, "ordem_montagem" | "id" | "instalada_em">>(lista: readonly T[]): { total: number; instaladas: number; proxima: T | null } {
  const ordenada = ordenarMontagem(lista);
  return { total: ordenada.length, instaladas: ordenada.filter(obra => obra.instalada_em !== null).length, proxima: ordenada.find(obra => obra.instalada_em === null) ?? null };
}

/** As medidas da obra em texto ("120 × 80 × 5 cm"): só o que foi cadastrado no inventário. */
export function medidasDaObra(obra: Pick<ObraDeArte, "altura_cm" | "largura_cm" | "comprimento_cm">): string | null {
  const partes = [obra.altura_cm, obra.largura_cm, obra.comprimento_cm].filter((valor): valor is number => valor !== null && valor !== undefined);
  return partes.length === 0 ? null : `${partes.map(valor => valor.toLocaleString("pt-BR")).join(" × ")} cm`;
}

/** O que falta preencher numa obra para a montagem: altura de quem fica na parede ou suspenso, e o nível de luz de quem tem luz pontual. */
export function pendenciasDaObra(obra: Pick<ObraNaSala, "posicao" | "altura_instalacao_cm" | "luz" | "lux">): string[] {
  const pendencias: string[] = [];
  if ((obra.posicao === "parede" || obra.posicao === "teto") && obra.altura_instalacao_cm === null) pendencias.push("Falta a altura de instalação");
  if (obra.luz === "pontual" && obra.lux === null) pendencias.push("Falta o nível de luz (lux)");
  return pendencias;
}

const texto = (valor: string) => valor.trim();
const inteiro = (valor: string) => (/^\d+$/.test(texto(valor)) ? Number(texto(valor)) : Number.NaN);

export type LeituraDaObraNaSala =
  | { ok: true; valor: { item_id: string; posicao: PosicaoNaExposicao; altura_instalacao_cm: number | null; ordem_montagem: number; luz: LuzDaObra; lux: number | null; notas: string | null } }
  | { ok: false; erro: string; campo: string };

/** A obra na sala como o banco confere: obra escolhida, altura de 0 a 2.000 cm (vazia = não definida), ordem de 0 a 999, lux de 0 a 100.000 e nota até 300. */
export function lerObraNaSala(campos: { itemId: string; posicao: PosicaoNaExposicao; altura: string; ordem: string; luz: LuzDaObra; lux: string; notas: string }): LeituraDaObraNaSala {
  if (campos.itemId === "") return { ok: false, erro: "Escolha a obra.", campo: "item" };
  let altura: number | null = null;
  if (texto(campos.altura) !== "") {
    altura = inteiro(campos.altura);
    if (!Number.isInteger(altura) || altura > 2000) return { ok: false, erro: "A altura é um número de 0 a 2.000 centímetros.", campo: "altura" };
  }
  const ordem = texto(campos.ordem) === "" ? 0 : inteiro(campos.ordem);
  if (!Number.isInteger(ordem) || ordem > 999) return { ok: false, erro: "A ordem de montagem é um número de 0 a 999.", campo: "ordem" };
  let lux: number | null = null;
  if (texto(campos.lux) !== "") {
    lux = inteiro(campos.lux);
    if (!Number.isInteger(lux) || lux > 100000) return { ok: false, erro: "O nível de luz é um número de lux de 0 a 100.000.", campo: "lux" };
  }
  const notas = texto(campos.notas);
  if (notas.length > 300) return { ok: false, erro: "A nota pode ter até 300 letras.", campo: "notas" };
  return { ok: true, valor: { item_id: campos.itemId, posicao: campos.posicao, altura_instalacao_cm: altura, ordem_montagem: ordem, luz: campos.luz, lux, notas: notas === "" ? null : notas } };
}

/** O texto para o erro que o banco devolve ao gravar. */
export function mensagemDoErroDeExpografia(erro: { code?: string; message?: string }): string {
  const mensagem = erro.message ?? "";
  if (erro.code === "42501") return "Você não pode alterar a exposição desta sala.";
  if (mensagem.includes("item_nao_e_obra_de_arte")) return "Esse item do inventário não é uma obra de arte.";
  if (mensagem.includes("unica_key") || erro.code === "23505") return "Essa obra já está nesta sala.";
  return "Não foi possível salvar. Tente de novo.";
}

// ─── O lugar da obra na planta da sala (PD8.5, segundo corte) ───────────────

/** O menor lado que uma obra ocupa na planta, em metros: obra sem medida ainda precisa de um retângulo para pegar. */
export const LADO_MINIMO_M = 0.4;

/**
 * O retângulo que a obra ocupa na planta, em metros, a partir das medidas do inventário (que estão em centímetros):
 * a largura é a largura da obra e a profundidade é o comprimento dela (a altura não entra, porque a planta é vista
 * de cima). Sem medida, um quadrado do lado mínimo.
 */
export function tamanhoNaPlanta(obra: Pick<ObraDeArte, "largura_cm" | "comprimento_cm">): { largura_m: number; profundidade_m: number } {
  const lado = (centimetros: number | null | undefined) => Math.max(LADO_MINIMO_M, Math.round(((centimetros ?? 0) / 100) * 100) / 100);
  return { largura_m: lado(obra.largura_cm), profundidade_m: lado(obra.comprimento_cm) };
}

/** Onde a obra cai quando é soltada: encaixada no passo da planta e dentro dela. */
export function lugarDaObra(
  ponto: { x: number; y: number },
  tamanho: { largura_m: number; profundidade_m: number },
  planta: { largura_m: number; profundidade_m: number },
): { x_m: number; y_m: number } {
  const encaixado = { ...tamanho, rotacao_graus: 0, x_m: encaixar(ponto.x), y_m: encaixar(ponto.y) };
  return manterDentro(encaixado, planta);
}

/** As obras que já estão na planta e as que ainda não foram postas, na ordem de montagem. */
export function obrasNaPlanta<T extends Pick<ObraNaSala, "ordem_montagem" | "id" | "x_m" | "y_m">>(lista: readonly T[]): { postas: T[]; fora: T[] } {
  const ordenada = ordenarMontagem(lista);
  return {
    postas: ordenada.filter(obra => obra.x_m !== null && obra.x_m !== undefined),
    fora: ordenada.filter(obra => obra.x_m === null || obra.x_m === undefined),
  };
}
