// A tela de palco (plano do módulo, PD7.1, segundo corte): o que o telão ou o celular do palco mostra do roteiro ao vivo do dia: o bloco em
// andamento com o tempo que falta para ele acabar, o próximo com o tempo que falta para começar (já com o atraso), o atraso corrente e a lista
// do dia. Tudo calculado a partir dos blocos e da hora de agora, então a tela refaz a conta a cada segundo sem perguntar nada ao servidor.
// Sem tela e sem banco.

import { situacaoDoRoteiro, type BlocoAoVivo, type EstadoDoBloco } from "@/lib/producao/ao-vivo";
import { ordenarBlocos, rotuloDaHora } from "@/lib/producao/dia";

const MINUTO = 60_000;

export type BlocoDoPalco = BlocoAoVivo & { titulo: string };

export type BlocoAtual = { id: string; titulo: string; iniciadoEm: string; fimPrevisto: string | null; restanteMs: number | null };
export type BlocoSeguinte = { id: string; titulo: string; comecaEm: string; atrasoMin: number; faltaMs: number };
export type LinhaDoPalco = { id: string; titulo: string; estado: EstadoDoBloco; hora: string; previstoPara: string | null; atrasoMin: number };
export type TelaDoPalco = {
  /** O atraso corrente em minutos (só atraso conta: adiantado é 0). */
  atrasoMin: number;
  atual: BlocoAtual | null;
  proximo: BlocoSeguinte | null;
  lista: LinhaDoPalco[];
  /** Tudo o que tem hora marcada já terminou. */
  encerrado: boolean;
};

const temHora = (bloco: BlocoDoPalco) => Boolean(bloco.inicio) && bloco.exibicao !== "a_definir" && bloco.exibicao !== "oculta";

/**
 * O estado da tela de palco na hora `agora`. Bloco oculto não aparece. Em andamento é o último que começou e ainda não terminou: o fim previsto é a hora
 * marcada de fim mais o atraso com que ele começou (se começou adiantado, vale a hora marcada), e o tempo restante fica negativo quando estoura.
 * O próximo é o primeiro ainda não começado com hora marcada, com a hora de começo já empurrada pelo atraso.
 */
export function telaDoPalco(blocos: readonly BlocoDoPalco[], agora: Date, fuso: string): TelaDoPalco {
  const visiveis = ordenarBlocos(blocos.filter(bloco => bloco.exibicao !== "oculta"));
  const situacao = situacaoDoRoteiro(visiveis);
  const tempo = agora.getTime();

  const emAndamento = visiveis.filter(bloco => situacao.get(bloco.id)?.estado === "em_andamento");
  const maisRecente = [...emAndamento].sort((a, b) => Date.parse(b.iniciado_em ?? "") - Date.parse(a.iniciado_em ?? ""))[0] ?? null;
  const atual: BlocoAtual | null = maisRecente && maisRecente.iniciado_em
    ? (() => {
        const atrasoDoComeco = Math.max(0, situacao.get(maisRecente.id)?.atrasoDoComecoMin ?? 0);
        const fimPrevisto = maisRecente.fim && temHora(maisRecente) ? new Date(Date.parse(maisRecente.fim) + atrasoDoComeco * MINUTO).toISOString() : null;
        return { id: maisRecente.id, titulo: maisRecente.titulo, iniciadoEm: maisRecente.iniciado_em!, fimPrevisto, restanteMs: fimPrevisto ? Date.parse(fimPrevisto) - tempo : null };
      })()
    : null;

  const seguinte = visiveis.find(bloco => situacao.get(bloco.id)?.estado === "pendente" && temHora(bloco)) ?? null;
  const proximo: BlocoSeguinte | null = seguinte && seguinte.inicio
    ? (() => {
        const dele = situacao.get(seguinte.id);
        const comecaEm = dele?.previstoPara ?? seguinte.inicio!;
        return { id: seguinte.id, titulo: seguinte.titulo, comecaEm, atrasoMin: dele?.atrasoPropagadoMin ?? 0, faltaMs: Date.parse(comecaEm) - tempo };
      })()
    : null;

  const lista = visiveis.map(bloco => {
    const dele = situacao.get(bloco.id);
    return { id: bloco.id, titulo: bloco.titulo, estado: dele?.estado ?? "pendente", hora: rotuloDaHora(bloco, fuso), previstoPara: dele?.previstoPara ?? null, atrasoMin: dele?.atrasoPropagadoMin ?? 0 };
  });
  const atrasoMin = Math.max(0, ...visiveis.map(bloco => situacao.get(bloco.id)?.atrasoPropagadoMin ?? 0));
  const comHora = visiveis.filter(temHora);
  const encerrado = comHora.length > 0 && comHora.every(bloco => situacao.get(bloco.id)?.estado === "concluido");
  return { atrasoMin, atual, proximo, lista, encerrado };
}

/** Um tempo em milissegundos como relógio: "05:07", "1:02:10". O sinal fica por conta de quem chama (use o valor absoluto). */
export function relogio(ms: number): string {
  const total = Math.floor(Math.abs(ms) / 1000);
  const horas = Math.floor(total / 3600), minutos = Math.floor((total % 3600) / 60), segundos = total % 60;
  const dois = (n: number) => String(n).padStart(2, "0");
  return horas > 0 ? `${horas}:${dois(minutos)}:${dois(segundos)}` : `${dois(minutos)}:${dois(segundos)}`;
}
