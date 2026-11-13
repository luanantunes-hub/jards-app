// O mapa da plateia (plano do módulo, PD7.7, primeiro corte): setores de uma sala e as cotas pintadas por sessão (venda, patrocinador,
// gratuidade, acessibilidade, imprensa, bloqueio). Sem tela e sem banco.

import type { CategoriaDaCota } from "@/lib/producao/estados";
import { CATEGORIAS_DA_COTA } from "@/lib/producao/estados";

export const ROTULO_DA_CATEGORIA: Record<CategoriaDaCota, string> = {
  venda: "Venda", patrocinador: "Patrocinador", gratuidade: "Gratuidade", acessibilidade: "Acessibilidade", imprensa: "Imprensa", bloqueio: "Bloqueio",
};

/** A cor de cada categoria no gráfico (só no segmento; rótulos e números ficam em tinta). Azul, âmbar, teal, grafite, cinza e um cinza claro para o bloqueio. */
export const COR_DA_CATEGORIA: Record<CategoriaDaCota, string> = {
  venda: "#2D72B0", patrocinador: "#B07A14", gratuidade: "#1A8B7A", acessibilidade: "#282525", imprensa: "#8A8585", bloqueio: "#D4D0D0",
};

export type SetorDaSala = { id: string; nome: string; lugares: number; ordem: number };
export type CotaDoSetor = { id: string; setor_id: string; categoria: CategoriaDaCota; lugares: number };

export type SegmentoDoSetor = { categoria: CategoriaDaCota; lugares: number };
export type MapaDoSetor = { setor: SetorDaSala; segmentos: SegmentoDoSetor[]; pintados: number; semDestino: number; estourado: boolean };

/** Setores em ordem (ordem, depois nome). */
export function ordenarSetores(setores: readonly SetorDaSala[]): SetorDaSala[] {
  return [...setores].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR"));
}

/** O que cada setor tem pintado: os segmentos na ordem das categorias, quantos lugares já têm destino e quantos ainda não (negativo = estourado, se o setor encolheu depois). */
export function mapaDosSetores(setores: readonly SetorDaSala[], cotas: readonly CotaDoSetor[]): MapaDoSetor[] {
  return ordenarSetores(setores).map(setor => {
    const doSetor = cotas.filter(cota => cota.setor_id === setor.id);
    const segmentos = CATEGORIAS_DA_COTA.map(categoria => ({ categoria, lugares: doSetor.filter(cota => cota.categoria === categoria).reduce((soma, cota) => soma + cota.lugares, 0) })).filter(segmento => segmento.lugares > 0);
    const pintados = segmentos.reduce((soma, segmento) => soma + segmento.lugares, 0);
    return { setor, segmentos, pintados, semDestino: Math.max(setor.lugares - pintados, 0), estourado: pintados > setor.lugares };
  });
}

export type ResumoDaPlateia = { totalDeLugares: number; porCategoria: SegmentoDoSetor[]; semDestino: number };

/** Os totais da sala na sessão: lugares, quanto de cada categoria e quantos ainda sem destino. */
export function resumoDaPlateia(mapa: readonly MapaDoSetor[]): ResumoDaPlateia {
  const totalDeLugares = mapa.reduce((soma, item) => soma + item.setor.lugares, 0);
  const porCategoria = CATEGORIAS_DA_COTA.map(categoria => ({ categoria, lugares: mapa.reduce((soma, item) => soma + (item.segmentos.find(segmento => segmento.categoria === categoria)?.lugares ?? 0), 0) })).filter(item => item.lugares > 0);
  return { totalDeLugares, porCategoria, semDestino: mapa.reduce((soma, item) => soma + item.semDestino, 0) };
}

const texto = (valor: string) => valor.trim();
const inteiro = (valor: string) => (/^\d+$/.test(texto(valor)) ? Number(texto(valor)) : Number.NaN);

export type LeituraDoSetor = { ok: true; valor: { nome: string; lugares: number; ordem: number } } | { ok: false; erro: string; campo: string };

/** O setor como o banco confere: nome de 1 a 60, de 1 a 20.000 lugares e ordem de 0 a 999 (vazia = 0). */
export function lerSetor(campos: { nome: string; lugares: string; ordem: string }): LeituraDoSetor {
  const nome = texto(campos.nome);
  if (nome === "") return { ok: false, erro: "Escreva o nome do setor.", campo: "nome" };
  if (nome.length > 60) return { ok: false, erro: "O nome pode ter até 60 letras.", campo: "nome" };
  const lugares = inteiro(campos.lugares);
  if (!Number.isInteger(lugares) || lugares < 1 || lugares > 20000) return { ok: false, erro: "O setor tem de 1 a 20.000 lugares.", campo: "lugares" };
  const ordem = texto(campos.ordem) === "" ? 0 : inteiro(campos.ordem);
  if (!Number.isInteger(ordem) || ordem > 999) return { ok: false, erro: "A ordem é um número de 0 a 999.", campo: "ordem" };
  return { ok: true, valor: { nome, lugares, ordem } };
}

export type MudancaDeCota = { categoria: CategoriaDaCota; acao: "criar" | "alterar" | "apagar"; lugares: number; id?: string; delta: number };
export type LeituraDaPintura = { ok: true; mudancas: MudancaDeCota[] } | { ok: false; erro: string; categoria?: CategoriaDaCota };

/**
 * A pintura de um setor numa sessão: um número de lugares por categoria (vazio ou 0 = nenhum). Confere cada número e a soma contra os lugares do
 * setor (o banco confere de novo) e devolve só o que muda, com as diminuições e os apagamentos primeiro: assim, gravando em sequência, a soma
 * nunca passa do setor no meio do caminho.
 */
export function lerPintura(setor: Pick<SetorDaSala, "lugares">, atuais: readonly CotaDoSetor[], campos: Partial<Record<CategoriaDaCota, string>>): LeituraDaPintura {
  const novos = new Map<CategoriaDaCota, number>();
  for (const categoria of CATEGORIAS_DA_COTA) {
    const bruto = texto(campos[categoria] ?? "");
    const numero = bruto === "" ? 0 : inteiro(bruto);
    if (!Number.isInteger(numero) || numero > 20000) return { ok: false, erro: `${ROTULO_DA_CATEGORIA[categoria]}: digite um número inteiro de lugares.`, categoria };
    novos.set(categoria, numero);
  }
  const soma = [...novos.values()].reduce((total, valor) => total + valor, 0);
  if (soma > setor.lugares) return { ok: false, erro: `A soma (${soma}) passa dos ${setor.lugares} lugares do setor.` };
  const mudancas: MudancaDeCota[] = [];
  for (const categoria of CATEGORIAS_DA_COTA) {
    const novo = novos.get(categoria) ?? 0;
    const atual = atuais.find(cota => cota.categoria === categoria);
    const antes = atual?.lugares ?? 0;
    if (novo === antes) continue;
    mudancas.push({ categoria, acao: novo === 0 ? "apagar" : atual ? "alterar" : "criar", lugares: novo, id: atual?.id, delta: novo - antes });
  }
  return { ok: true, mudancas: mudancas.sort((a, b) => a.delta - b.delta) };
}

/** O texto para o erro que o banco devolve ao gravar. */
export function mensagemDoErroDePlateia(erro: { code?: string; message?: string }): string {
  const mensagem = erro.message ?? "";
  if (erro.code === "42501") return "Você não pode alterar a plateia desta sessão.";
  if (mensagem.includes("lugares_excedidos")) return "A soma passa dos lugares do setor. Diminua alguma categoria.";
  if (mensagem.includes("setor_de_outra_sala")) return "Esse setor não é da sala desta sessão.";
  if (erro.code === "23505") return "Já existe um setor com esse nome nesta sala.";
  if (erro.code === "23503") return "Não foi possível apagar: o setor ainda está em uso.";
  return "Não foi possível salvar. Tente de novo.";
}
