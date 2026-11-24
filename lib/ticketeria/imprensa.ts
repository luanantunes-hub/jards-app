// A IMPRENSA medida pelas vendas de cada casa (decisão do dono, 23/11/2026): o peso de um veículo é relacional, do público daquela casa e daquele evento (a TV local pode valer mais
// que a Folha para um evento em Sorocaba; a TV Aparecida, mais que o SBT para um evento católico). Nada aqui vem de uma lista de veículos importantes: cada marcação é medida pelas vendas do
// evento nos dias seguintes, e o veículo acumula o que mediu na casa. Também o aviso de "as vendas subiram sem anúncio a mais": a imprensa que ninguém marcou.
// Sem banco e sem imports de servidor: roda nos testes (tests/ticketeria-imprensa.test.ts).

/** A marcação é medida nos DIAS_DEPOIS dias a partir do dia em que saiu, contra os DIAS_ANTES dias de antes. */
export const DIAS_DEPOIS = 3;
export const DIAS_ANTES = 7;
/** Abaixo disto de vendas nos dias de antes, o evento ainda não vendia o bastante para comparar. */
export const MIN_VENDAS_ANTES = 3;
/** O excesso só conta acima de max(MIN_EXCESSO, 2 × o vaivém normal da venda, 25% do esperado). */
export const MIN_EXCESSO = 5;
/** O anúncio "mudou junto" quando o gasto médio por dia depois passa de 1,5 vez o de antes mais R$ 20. */
export const GASTO_QUE_MUDA = { vezes: 1.5, centavos: 2000 };
/** O pico sem explicação: pelo menos PICO_MINIMO ingressos no dia e PICO_VEZES vezes o normal dos 14 dias de antes, nos últimos DIAS_DO_PICO dias. */
export const PICO_MINIMO = 10;
export const PICO_VEZES = 3;
export const DIAS_DO_PICO = 14;

const DIA = 86400000;
export const somarDias = (dia: string, n: number): string => new Date(Date.parse(`${dia}T12:00:00Z`) + n * DIA).toISOString().slice(0, 10);
const mediana = (v: number[]): number => { const o = [...v].sort((a, b) => a - b); return o.length === 0 ? 0 : o.length % 2 ? o[(o.length - 1) / 2] : (o[o.length / 2 - 1] + o[o.length / 2]) / 2; };

/** O veículo para comparar: sem acento, sem maiúscula e sem espaço sobrando ("TV  Tem" = "tv tem"). */
export const normalizarVeiculo = (v: string | null | undefined): string => (v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Os veículos já marcados na casa, com quantas vezes (o nome como foi escrito da primeira vez), do mais marcado para o menos. */
export function veiculosConhecidos(acoes: { canal: string; veiculo?: string | null }[]): { nome: string; vezes: number }[] {
  const porChave = new Map<string, { nome: string; vezes: number }>();
  for (const a of acoes) {
    const chave = normalizarVeiculo(a.veiculo);
    if (a.canal !== "imprensa" || !chave) continue;
    const atual = porChave.get(chave) ?? { nome: (a.veiculo as string).trim(), vezes: 0 };
    atual.vezes++;
    porChave.set(chave, atual);
  }
  return [...porChave.values()].sort((a, b) => b.vezes - a.vezes || a.nome.localeCompare(b.nome));
}

export type EfeitoDaMarcacao =
  | { tipo: "efeito"; ingressos: number }
  | { tipo: "sem_diferenca" }
  | { tipo: "anuncio_mudou" }
  | { tipo: "pouco_dado" }
  | { tipo: "medindo" };

/**
 * O que as vendas mostraram depois de uma crítica ou matéria: as vendas dos DIAS_DEPOIS dias a partir do dia em que saiu contra o ritmo dos DIAS_ANTES dias de antes. `vendas` e `gasto` são por
 * dia (AAAA-MM-DD): as vendas do evento (ou da casa toda) e o gasto em anúncio da casa. "medindo" enquanto os dias de depois não passaram.
 */
export function efeitoDaMarcacao(dia: string, vendas: Map<string, number>, gasto: Map<string, number>, hoje: string): EfeitoDaMarcacao {
  if (somarDias(dia, DIAS_DEPOIS - 1) >= hoje) return { tipo: "medindo" };
  const antes = Array.from({ length: DIAS_ANTES }, (_, i) => vendas.get(somarDias(dia, -DIAS_ANTES + i)) ?? 0);
  const depois = Array.from({ length: DIAS_DEPOIS }, (_, i) => vendas.get(somarDias(dia, i)) ?? 0);
  const somaAntes = antes.reduce((s, x) => s + x, 0);
  if (somaAntes < MIN_VENDAS_ANTES) return { tipo: "pouco_dado" };
  const mediaDoGasto = (de: number, n: number) => Array.from({ length: n }, (_, i) => gasto.get(somarDias(dia, de + i)) ?? 0).reduce((s, x) => s + x, 0) / n;
  const gastoAntes = mediaDoGasto(-DIAS_ANTES, DIAS_ANTES), gastoDepois = mediaDoGasto(0, DIAS_DEPOIS);
  if (gastoDepois > GASTO_QUE_MUDA.vezes * gastoAntes + GASTO_QUE_MUDA.centavos) return { tipo: "anuncio_mudou" };
  const media = somaAntes / DIAS_ANTES;
  const desvio = Math.sqrt(antes.reduce((s, x) => s + (x - media) ** 2, 0) / DIAS_ANTES);
  const esperado = media * DIAS_DEPOIS;
  const excesso = depois.reduce((s, x) => s + x, 0) - esperado;
  const limiar = Math.max(MIN_EXCESSO, 2 * desvio * Math.sqrt(DIAS_DEPOIS), 0.25 * esperado);
  return excesso > limiar ? { tipo: "efeito", ingressos: Math.round(excesso) } : { tipo: "sem_diferenca" };
}

/** O que cada veículo mostrou na casa: quantas vezes foi marcado e, das marcações medidas (efeito ou sem diferença), a média de ingressos a mais (sem diferença conta como 0). */
export function resumoPorVeiculo(marcacoes: { veiculo: string; efeito: EfeitoDaMarcacao }[]): { veiculo: string; vezes: number; medidas: number; media: number | null }[] {
  const porChave = new Map<string, { veiculo: string; vezes: number; soma: number; medidas: number }>();
  for (const m of marcacoes) {
    const chave = normalizarVeiculo(m.veiculo);
    if (!chave) continue;
    const a = porChave.get(chave) ?? { veiculo: m.veiculo, vezes: 0, soma: 0, medidas: 0 };
    a.vezes++;
    if (m.efeito.tipo === "efeito") { a.soma += m.efeito.ingressos; a.medidas++; } else if (m.efeito.tipo === "sem_diferenca") a.medidas++;
    porChave.set(chave, a);
  }
  return [...porChave.values()].map(a => ({ veiculo: a.veiculo, vezes: a.vezes, medidas: a.medidas, media: a.medidas > 0 ? Math.round(a.soma / a.medidas) : null }))
    .sort((a, b) => (b.media ?? -1) - (a.media ?? -1) || b.vezes - a.vezes);
}

export type PicoSemExplicacao = { eventoId: string | null; evento: string; dia: string; vendidos: number; vezes: number };

/**
 * O pico de venda sem explicação mais recente: num dia dos últimos DIAS_DO_PICO dias, um evento vendeu PICO_MINIMO ingressos ou mais e PICO_VEZES vezes o normal (a mediana dos 14 dias de
 * antes, no mínimo 1), sem o gasto em anúncio subir (até 1,5 vez a mediana mais R$ 20) e sem crítica ou matéria marcada daquele evento (ou da casa toda) de 2 dias antes até o dia.
 * O que o produtor já disse que não foi imprensa (`descartados`, "evento|dia") não volta. Null se não há.
 */
export function picoSemExplicacao(eventos: { eventoId: string | null; evento: string; vendas: Map<string, number> }[], gasto: Map<string, number>, marcacoes: { dia: string; eventoId: string | null }[], descartados: Set<string>, hoje: string): PicoSemExplicacao | null {
  let melhor: PicoSemExplicacao | null = null;
  for (const e of eventos) {
    for (let k = 1; k <= DIAS_DO_PICO; k++) {
      const dia = somarDias(hoje, -k);
      const vendidos = e.vendas.get(dia) ?? 0;
      if (vendidos < PICO_MINIMO) continue;
      const normal = Math.max(1, mediana(Array.from({ length: 14 }, (_, i) => e.vendas.get(somarDias(dia, -14 + i)) ?? 0)));
      if (vendidos < PICO_VEZES * normal) continue;
      const gastoNormal = mediana(Array.from({ length: 14 }, (_, i) => gasto.get(somarDias(dia, -14 + i)) ?? 0));
      if ((gasto.get(dia) ?? 0) > GASTO_QUE_MUDA.vezes * gastoNormal + GASTO_QUE_MUDA.centavos) continue;
      if (marcacoes.some(m => (m.eventoId === null || m.eventoId === e.eventoId) && m.dia >= somarDias(dia, -2) && m.dia <= dia)) continue;
      if (descartados.has(`${e.eventoId ?? ""}|${dia}`)) continue;
      const pico = { eventoId: e.eventoId, evento: e.evento, dia, vendidos, vezes: Math.round((vendidos / normal) * 10) / 10 };
      if (!melhor || pico.dia > melhor.dia || (pico.dia === melhor.dia && pico.vezes > melhor.vezes)) melhor = pico;
    }
  }
  return melhor;
}

const DIAS_DA_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
/** "Na terça, 14/3, o Hamlet vendeu 62 ingressos, três vezes o normal, e o gasto em anúncio ficou igual. Saiu algo na imprensa?" */
export function fraseDoPico(p: PicoSemExplicacao): string {
  const d = new Date(`${p.dia}T12:00:00Z`);
  const vezes = p.vezes >= 2.5 && p.vezes < 3.5 ? "três vezes" : p.vezes >= 3.5 && p.vezes < 4.5 ? "quatro vezes" : `${String(p.vezes).replace(".", ",")} vezes`;
  const dia = d.getUTCDay();
  return `${dia === 0 || dia === 6 ? "No" : "Na"} ${DIAS_DA_SEMANA[dia]}, ${d.getUTCDate()}/${d.getUTCMonth() + 1}, ${p.evento} vendeu ${p.vendidos} ingressos, ${vezes} o normal, e o gasto em anúncio ficou igual. Saiu algo na imprensa?`;
}

/** A frase do efeito de uma marcação, para a tabela. */
export function fraseDoEfeito(e: EfeitoDaMarcacao): string {
  switch (e.tipo) {
    case "efeito": return `cerca de ${e.ingressos} a mais que o esperado em ${DIAS_DEPOIS} dias`;
    case "sem_diferenca": return "não deu para ver diferença";
    case "anuncio_mudou": return "o anúncio mudou junto; não dá para separar";
    case "pouco_dado": return "o evento ainda vendia pouco; não dá para comparar";
    case "medindo": return `medindo: espere ${DIAS_DEPOIS} dias depois de sair`;
  }
}
