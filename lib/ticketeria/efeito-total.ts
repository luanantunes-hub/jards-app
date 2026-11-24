// O EFEITO TOTAL de cada canal: o modelo mede o que o anúncio vende sozinho, mas quem ele traz traz outros (o boca a boca) e a sala que enche faz o resto comprar mais rápido (a urgência).
// Sem o anúncio, essas vendas também não teriam acontecido (decisão do dono, 23/11/2026). A conta: para cada canal, refaz a venda semana a semana SEM ele, tirando o que ele vendeu
// (`por_semana` do resultado) e o que o boca a boca e a urgência perdem com a parte vendida menor de cada sessão (com a força que o modelo mediu: `efeito_por_unidade`). Validada em
// modelo/ESTUDO-DO-EFEITO-TOTAL.md (o erro contra o total verdadeiro caiu de 5,6 para 3,3 pontos). Sem banco e sem imports de servidor: roda nos testes (tests/ticketeria-efeito-total.test.ts).

import { inicioDaSemana, semanasEntre } from "@/lib/ticketeria/modelo";
import { HORIZONTE_DA_PROXIMIDADE_EM_SEMANAS } from "@/lib/ticketeria/modelo-controles";

export type SessaoComVendas = { dia: string; lugares: number; vendas: { dia: string; quantidade: number }[] };
export type EntradaDoEfeitoTotal = {
  /** As semanas da tabela do modelo (segundas, em ordem) e os ingressos de cada uma. */ semanas: string[]; ingressos: number[];
  sessoes: SessaoComVendas[];
  /** O que cada canal vendeu em cada semana, na ordem de `semanas`. */ canais: { canal: string; porSemana: number[] }[];
  /** Ingressos por semana por unidade do controle (0 quando o modelo não mediu). */ boca: number; urgencia: number;
};

type Sessao = { semana: string; lugares: number; porSemana: Map<string, number> };

/** A venda refeita com `tirar[t]` ingressos a menos em cada semana: devolve a venda de cada semana sem eles e sem o que o boca a boca e a urgência perdem por isso. */
function refazer(semanas: string[], ingressos: number[], sessoes: Sessao[], tirar: number[], boca: number, urgencia: number): number[] {
  const real = sessoes.map(() => 0), sim = sessoes.map(() => 0);
  return semanas.map((semana, t) => {
    let br = 0, ur = 0, bs = 0, us = 0, peso = 0;
    sessoes.forEach((s, i) => {
      if (s.semana < semana || semanasEntre(semana, s.semana) - 1 > HORIZONTE_DA_PROXIMIDADE_EM_SEMANAS) return;
      const zr = Math.min(1, real[i] / s.lugares), zs = Math.min(1, sim[i] / s.lugares);
      br += s.lugares * zr * (1 - zr); ur += s.lugares * zr; bs += s.lugares * zs * (1 - zs); us += s.lugares * zs; peso += s.lugares;
    });
    const perdido = peso > 0 ? boca * (br - bs) / peso + urgencia * (ur - us) / peso : 0;
    const y = ingressos[t] ?? 0;
    const sem = Math.max(0, y - (tirar[t] ?? 0) - perdido);
    const fator = y > 0 ? sem / y : 1;
    sessoes.forEach((s, i) => { const q = s.porSemana.get(semana) ?? 0; real[i] += q; sim[i] += q * fator; });
    return sem;
  });
}

/**
 * O efeito total de cada canal, em % das vendas (o mesmo jeito da parte de cada canal). Sem boca a boca nem urgência medidos (`boca` e `urgencia` zero), devolve {}: o total é o próprio
 * efeito direto. Só sessões com lotação entram na conta da parte vendida.
 */
export function porcentoTotalDosCanais(e: EntradaDoEfeitoTotal): Record<string, number> {
  if ((e.boca === 0 && e.urgencia === 0) || e.semanas.length === 0 || e.ingressos.length !== e.semanas.length) return {};
  const soma = e.ingressos.reduce((s, x) => s + x, 0);
  if (soma <= 0) return {};
  const sessoes: Sessao[] = e.sessoes.filter(s => s.lugares > 0).map(s => {
    const porSemana = new Map<string, number>();
    for (const v of s.vendas) if (v.quantidade > 0) porSemana.set(inicioDaSemana(v.dia), (porSemana.get(inicioDaSemana(v.dia)) ?? 0) + v.quantidade);
    return { semana: inicioDaSemana(s.dia), lugares: s.lugares, porSemana };
  });
  const saida: Record<string, number> = {};
  for (const c of e.canais) {
    if (c.porSemana.length !== e.semanas.length) continue;
    const sem = refazer(e.semanas, e.ingressos, sessoes, c.porSemana, e.boca, e.urgencia);
    const total = e.ingressos.reduce((s, y, t) => s + (y - sem[t]), 0);
    saida[c.canal] = Math.round(Math.min(100, Math.max(0, (total / soma) * 100)) * 100) / 100;
  }
  return saida;
}

/** A razão entre o efeito total e o direto (1 quando não há total ou ele não passa do direto): o "onde vale investir mais" multiplica a curva do canal por ela. */
export const razaoDoTotal = (porcento: number, total: number | null | undefined): number => (typeof total === "number" && porcento > 0 && total > porcento ? total / porcento : 1);

/** O boca a boca ou a urgência só pesam com pelo menos tanto das vendas e o intervalo fora do zero: sem efeito, o modelo chega a mostrar até 3% (estudos em modelo/). */
export const PARTE_MINIMA_DA_VENDA_QUE_PUXA_VENDA = 5;
export const puxaVenda = (p: { porcento: number; baixo: number } | undefined): boolean => !!p && p.porcento >= PARTE_MINIMA_DA_VENDA_QUE_PUXA_VENDA && p.baixo > 0;
/** O efeito total só vale (na tela e no "onde investir") quando o boca a boca ou a urgência pesam na rodada; senão o total seria só ruído em cima do direto. */
export const totalVale = (partes: { chave: string; porcento: number; baixo: number }[]): boolean => puxaVenda(partes.find(p => p.chave === "boca")) || puxaVenda(partes.find(p => p.chave === "urgencia"));
