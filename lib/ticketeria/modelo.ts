// O modelo de marketing (MMM), fatia M-A: montar a TABELA SEMANAL (ingressos vendidos e gasto por canal, semana a semana) e dizer se já há dado para o modelo rodar (a prontidão).
// Ainda não há motor: o cálculo do modelo é a fatia seguinte. Aqui só se une o que o Jards já coleta e se confere se basta. Sem banco e sem imports de servidor: roda nos testes
// (tests/ticketeria-modelo.test.ts); quem lê as linhas é lib/ticketeria/modelo-servidor.ts.
//
// De onde vem cada número:
//   - vendas: ingressos das compras pagas na Ticketeria + o histórico importado de planilha;
//   - gasto: as conexões (Meta Ads, Google Ads) > o histórico importado > as ações registradas à mão (o gasto da ação espalhado pelos dias dela). No mesmo canal e dia vale a fonte
//     mais confiável (conexão, depois planilha, depois ação): assim o mesmo gasto nunca entra duas vezes. Ação de "anúncio pago" é ignorada quando já há gasto de anúncio lido das conexões.

import { rotuloDoCanal } from "@/lib/ticketeria/divulgacao";
import type { ChaveDoControle, ControleDaTela, ResumoDosControles } from "@/lib/ticketeria/modelo-controles";
import type { RitmoDoEvento } from "@/lib/ticketeria/modelo-painel";

export const MIN_SEMANAS_DE_VENDAS = 26;
export const MIN_SEMANAS_COM_GASTO = 26;
/** Um canal só entra na conta do modelo se teve gasto em pelo menos tantas semanas. */
export const MIN_SEMANAS_COM_GASTO_POR_CANAL = 8;
export const SEMANAS_DA_CONFIANCA_MEDIA = 52;
export const SEMANAS_IDEAIS = 104;
/** O gasto "varia" se o desvio de uma semana para outra é pelo menos esta parte da média. */
export const VARIACAO_MINIMA = 0.25;

// ─── Semanas ────────────────────────────────────────────────────────────────

const msDoDia = 86400000;
const noDia = (dia: string): number => Date.parse(`${dia}T00:00:00Z`);
const diaDe = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** A segunda-feira da semana de um dia (AAAA-MM-DD): é o nome da semana na tabela. */
export function inicioDaSemana(dia: string): string {
  const d = new Date(`${dia}T00:00:00Z`);
  const delta = (d.getUTCDay() + 6) % 7; // segunda = 0
  return diaDe(d.getTime() - delta * msDoDia);
}

export const semanasEntre = (de: string, ate: string): number => (ate < de ? 0 : Math.round((noDia(inicioDaSemana(ate)) - noDia(inicioDaSemana(de))) / (7 * msDoDia)) + 1);

// ─── Gasto por dia e canal ──────────────────────────────────────────────────

export type FonteDoGasto = "conexao" | "planilha" | "acao";
export type GastoDiario = { dia: string; canal: string; centavos: number; fonte: FonteDoGasto };
export type AcaoParaGasto = { nome: string; canal: string; inicio: string; fim: string; gasto_centavos: number };

/** O nome do canal de gasto no modelo: "google" da planilha e "google-ads" da conexão são o mesmo canal; "meta" e "meta-ads" também. */
export function canalDoGasto(canal: string): string {
  const c = canal.trim().toLowerCase();
  if (c === "google" || c === "google-ads" || c === "googleads") return "google-ads";
  if (c === "meta" || c === "meta-ads" || c === "metaads" || c === "facebook-ads") return "meta-ads";
  return c;
}

const rotuloDoCanalBase = (canal: string): string => (canal === "meta-ads" ? "Meta Ads" : canal === "google-ads" ? "Google Ads" : rotuloDoCanal(canal));
/** O nome do canal na tela. A marca e os eventos separados (lib/ticketeria/campanhas.ts) viram "Meta Ads · marca" e "Meta Ads · eventos". */
export const rotuloDoCanalDeGasto = (canal: string): string =>
  canal.endsWith("-marca") ? `${rotuloDoCanalBase(canal.slice(0, -6))} · marca` : canal.endsWith("-eventos") ? `${rotuloDoCanalBase(canal.slice(0, -8))} · eventos` : rotuloDoCanalBase(canal);

/** O gasto de cada ação repartido igualmente pelos dias dela (a ação de um dia só fica inteira nesse dia). */
export function gastoDasAcoes(acoes: AcaoParaGasto[]): GastoDiario[] {
  const linhas: GastoDiario[] = [];
  for (const a of acoes) {
    if (a.gasto_centavos <= 0 || a.fim < a.inicio) continue;
    const n = Math.round((noDia(a.fim) - noDia(a.inicio)) / msDoDia) + 1;
    const base = Math.floor(a.gasto_centavos / n);
    let resto = a.gasto_centavos - base * n;
    for (let i = 0; i < n; i++) {
      const extra = resto > 0 ? 1 : 0;
      resto -= extra;
      linhas.push({ dia: diaDe(noDia(a.inicio) + i * msDoDia), canal: canalDoGasto(a.canal), centavos: base + extra, fonte: "acao" });
    }
  }
  return linhas;
}

const PESO: Record<FonteDoGasto, number> = { conexao: 3, planilha: 2, acao: 1 };

/** Une as três fontes de gasto: no mesmo canal e dia, fica só a de maior confiança. `ignoradas` são as ações que não entraram (o gasto delas já vem das conexões). */
export function consolidarGasto(entrada: { conexoes: { dia: string; canal: string; centavos: number }[]; planilhas: { dia: string; canal: string; centavos: number }[]; acoes: AcaoParaGasto[] }): { gasto: GastoDiario[]; ignoradas: string[] } {
  const conexoes: GastoDiario[] = entrada.conexoes.map(l => ({ ...l, canal: canalDoGasto(l.canal), fonte: "conexao" as const }));
  const haGastoDeAnuncio = conexoes.some(l => l.canal === "meta-ads" || l.canal === "google-ads");
  const ignoradas: string[] = [];
  const acoesValidas = entrada.acoes.filter(a => {
    if (haGastoDeAnuncio && canalDoGasto(a.canal) === "anuncio-pago" && a.gasto_centavos > 0) { ignoradas.push(a.nome); return false; }
    return true;
  });
  const todas: GastoDiario[] = [...conexoes, ...entrada.planilhas.map(l => ({ ...l, canal: canalDoGasto(l.canal), fonte: "planilha" as const })), ...gastoDasAcoes(acoesValidas)];
  // Por canal, dia e fonte, soma (a planilha pode ter várias linhas no dia); entre fontes, vale a de maior peso.
  const porFonte = new Map<string, GastoDiario>();
  for (const l of todas) {
    const chave = `${l.canal}|${l.dia}|${l.fonte}`;
    const antes = porFonte.get(chave);
    porFonte.set(chave, antes ? { ...antes, centavos: antes.centavos + l.centavos } : { ...l });
  }
  const melhor = new Map<string, GastoDiario>();
  for (const l of porFonte.values()) {
    const chave = `${l.canal}|${l.dia}`;
    const atual = melhor.get(chave);
    if (!atual || PESO[l.fonte] > PESO[atual.fonte]) melhor.set(chave, l);
  }
  return { gasto: [...melhor.values()].sort((a, b) => a.dia.localeCompare(b.dia) || a.canal.localeCompare(b.canal)), ignoradas };
}

// ─── A tabela semanal ───────────────────────────────────────────────────────

export type SemanaDaTabela = { semana: string; ingressos: number; gasto: Record<string, number>; /** O que mais empurra as vendas na semana (proximidade da sessão, feriado…): ver modelo-controles.ts. */ controles?: Partial<Record<ChaveDoControle, number>> };

/** Uma linha por semana, da primeira à última com qualquer dado, sem furos (semana sem nada vale zero): é a entrada do modelo. */
export function montarTabelaSemanal(entrada: { vendas: Record<string, number>; gasto: GastoDiario[] }): SemanaDaTabela[] {
  const dias = [...Object.keys(entrada.vendas), ...entrada.gasto.map(g => g.dia)].filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));
  if (dias.length === 0) return [];
  const ordenados = dias.sort();
  const primeira = inicioDaSemana(ordenados[0]);
  const ultima = inicioDaSemana(ordenados.at(-1) as string);
  const semanas = new Map<string, SemanaDaTabela>();
  for (let ms = noDia(primeira); ms <= noDia(ultima); ms += 7 * msDoDia) semanas.set(diaDe(ms), { semana: diaDe(ms), ingressos: 0, gasto: {} });
  for (const [dia, n] of Object.entries(entrada.vendas)) { const s = semanas.get(inicioDaSemana(dia)); if (s) s.ingressos += n; }
  for (const g of entrada.gasto) { const s = semanas.get(inicioDaSemana(g.dia)); if (s) s.gasto[g.canal] = (s.gasto[g.canal] ?? 0) + g.centavos; }
  return [...semanas.values()];
}

// ─── Os canais ──────────────────────────────────────────────────────────────

export type ResumoDoCanal = {
  canal: string; rotulo: string; semanasComGasto: number; primeiraSemana: string; ultimaSemana: string; gastoTotalCentavos: number;
  /** Desvio do gasto semanal dividido pela média, nas semanas entre a primeira e a última com gasto (semana sem gasto conta zero). */
  variacao: number; /** O gasto mais comum numa semana com gasto (a mediana). */ medianaCentavos: number;
};

export function resumirCanais(tabela: SemanaDaTabela[]): ResumoDoCanal[] {
  const canais = new Set(tabela.flatMap(s => Object.keys(s.gasto)));
  const saida: ResumoDoCanal[] = [];
  for (const canal of canais) {
    const comGasto = tabela.filter(s => (s.gasto[canal] ?? 0) > 0);
    if (comGasto.length === 0) continue;
    const primeira = comGasto[0].semana;
    const ultima = comGasto.at(-1)!.semana;
    const janela = tabela.filter(s => s.semana >= primeira && s.semana <= ultima).map(s => s.gasto[canal] ?? 0);
    const media = janela.reduce((a, b) => a + b, 0) / janela.length;
    const desvio = Math.sqrt(janela.reduce((a, b) => a + (b - media) ** 2, 0) / janela.length);
    const ordenados = comGasto.map(s => s.gasto[canal]).sort((a, b) => a - b);
    saida.push({
      canal, rotulo: rotuloDoCanalDeGasto(canal), semanasComGasto: comGasto.length, primeiraSemana: primeira, ultimaSemana: ultima,
      gastoTotalCentavos: comGasto.reduce((a, s) => a + s.gasto[canal], 0), variacao: media > 0 ? desvio / media : 0, medianaCentavos: ordenados[Math.floor(ordenados.length / 2)],
    });
  }
  return saida.sort((a, b) => b.semanasComGasto - a.semanasComGasto || b.gastoTotalCentavos - a.gastoTotalCentavos);
}

// ─── A prontidão ────────────────────────────────────────────────────────────

export type EstadoDaVerificacao = "ok" | "atencao" | "falta" | "opcional";
export type AcaoDaVerificacao = "importar" | "conexoes" | null;
export type Verificacao = { id: "vendas" | "gasto" | "variacao" | "visitas"; estado: EstadoDaVerificacao; titulo: string; detalhe: string; acao: AcaoDaVerificacao };
export type Confianca = "baixa" | "media" | "boa";
export type ProntidaoDoModelo = {
  pronto: boolean; verificacoes: Verificacao[]; prontos: number; total: number;
  /** A confiança que o modelo teria com estes dados (só quando está pronto); `semanas` são as semanas com vendas e gasto juntos. */
  confianca: Confianca | null; semanas: number; canais: ResumoDoCanal[]; ignoradas: string[];
  /** O que o modelo leva em conta além dos anúncios (ver modelo-controles.ts): vazio quando quem chamou não calculou. */
  controles: ControleDaTela[];
  /** O que a loja tem de eventos, sessões, lotes e cupons (para o texto da confiança); null quando quem chamou não calculou. */
  resumo: ResumoDosControles | null;
  /** O ritmo de venda da próxima sessão que já vendeu (só a rota calcula; a prontidão pura deixa vazio). */
  ritmo?: RitmoDoEvento | null;
};

const semanasTexto = (n: number) => `${n} ${n === 1 ? "semana" : "semanas"}`;
const reais = (centavos: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(centavos / 100).replace(/ /g, " ");

export function confiancaPelasSemanas(semanas: number): Confianca {
  return semanas >= SEMANAS_IDEAIS ? "boa" : semanas >= SEMANAS_DA_CONFIANCA_MEDIA ? "media" : "baixa";
}

export type EntradaDaProntidao = {
  tabela: SemanaDaTabela[]; ga4Conectado: boolean; primeiroDiaDeVisitas: string | null; ultimoDiaDeVisitas: string | null; ignoradas?: string[]; controles?: ControleDaTela[]; resumo?: ResumoDosControles;
};

/** Confere se há dado para o modelo rodar: vendas, gasto, variação do gasto (os três obrigatórios) e visitas (opcional). */
export function avaliarProntidao(e: EntradaDaProntidao): ProntidaoDoModelo {
  const comVendas = e.tabela.filter(s => s.ingressos > 0);
  const semanasDeVendas = comVendas.length > 0 ? semanasEntre(comVendas[0].semana, comVendas.at(-1)!.semana) : 0;
  const canais = resumirCanais(e.tabela);
  const melhor = canais[0] ?? null;
  const verificacoes: Verificacao[] = [];

  // 1. Vendas
  verificacoes.push(semanasDeVendas >= MIN_SEMANAS_DE_VENDAS
    ? { id: "vendas", estado: "ok", titulo: `Vendas: ${semanasTexto(semanasDeVendas)}`, detalhe: `Ingressos vendidos pela Ticketeria e pela planilha importada. O mínimo para começar são ${MIN_SEMANAS_DE_VENDAS} semanas; o ideal são ${SEMANAS_IDEAIS}.`, acao: null }
    : semanasDeVendas === 0
      ? { id: "vendas", estado: "falta", titulo: "Vendas: ainda nenhuma", detalhe: `Venda ingressos pela Ticketeria ou importe a planilha de eventos antigos. O mínimo para começar são ${MIN_SEMANAS_DE_VENDAS} semanas.`, acao: "importar" }
      : { id: "vendas", estado: "atencao", titulo: `Vendas: só ${semanasTexto(semanasDeVendas)}`, detalhe: `Faltam ${MIN_SEMANAS_DE_VENDAS - semanasDeVendas} para o mínimo (${MIN_SEMANAS_DE_VENDAS}). Importe a planilha de eventos antigos para ganhar história.`, acao: "importar" });

  // 2. Gasto
  const semanasDeGasto = melhor?.semanasComGasto ?? 0;
  verificacoes.push(semanasDeGasto >= MIN_SEMANAS_COM_GASTO
    ? { id: "gasto", estado: "ok", titulo: `Gasto em divulgação: ${semanasTexto(semanasDeGasto)}`, detalhe: `${melhor!.rotulo} tem ${semanasTexto(semanasDeGasto)} com gasto. O mínimo são ${MIN_SEMANAS_COM_GASTO}.`, acao: null }
    : semanasDeGasto === 0
      ? { id: "gasto", estado: "falta", titulo: "Gasto em divulgação: nenhum", detalhe: "Conecte o Meta Ads ou o Google Ads, registre as ações com o gasto ou importe os gastos de eventos antigos.", acao: "conexoes" }
      : { id: "gasto", estado: "atencao", titulo: `Gasto em divulgação: só ${semanasTexto(semanasDeGasto)}`, detalhe: `${melhor!.rotulo} tem ${semanasTexto(semanasDeGasto)} com gasto. Faltam ${MIN_SEMANAS_COM_GASTO - semanasDeGasto} para o mínimo (${MIN_SEMANAS_COM_GASTO}). Importe um arquivo com o gasto de antes ou aguarde a leitura diária.`, acao: "importar" });

  // 3. Variação do gasto (só dá para conferir num canal com semanas suficientes)
  const avaliavel = canais.find(c => c.semanasComGasto >= MIN_SEMANAS_COM_GASTO_POR_CANAL) ?? null;
  verificacoes.push(!avaliavel
    ? { id: "variacao", estado: "falta", titulo: "O gasto precisa variar de semana a semana", detalhe: `Ainda não há gasto suficiente para conferir (são precisas ao menos ${MIN_SEMANAS_COM_GASTO_POR_CANAL} semanas com gasto em um canal). Sem variação o modelo não separa o efeito da divulgação do que venderia de qualquer jeito.`, acao: null }
    : avaliavel.variacao >= VARIACAO_MINIMA
      ? { id: "variacao", estado: "ok", titulo: "O gasto varia de semana a semana", detalhe: `${avaliavel.rotulo} muda o bastante de uma semana para outra para o modelo enxergar o efeito.`, acao: null }
      : { id: "variacao", estado: "atencao", titulo: "O gasto precisa variar de semana a semana", detalhe: `No ${avaliavel.rotulo} o gasto quase não mudou (sempre perto de ${reais(avaliavel.medianaCentavos)} por semana). Sem variação o modelo não consegue separar o efeito do anúncio do que venderia de qualquer jeito. Experimente pausar ou dobrar o anúncio por uma ou duas semanas.`, acao: null });

  // 4. Visitas (opcional)
  const semanasDeVisitas = e.primeiroDiaDeVisitas && e.ultimoDiaDeVisitas ? semanasEntre(e.primeiroDiaDeVisitas, e.ultimoDiaDeVisitas) : 0;
  verificacoes.push(e.ga4Conectado && semanasDeVisitas > 0
    ? { id: "visitas", estado: "ok", titulo: `Visitas ao site (opcional): ${semanasTexto(semanasDeVisitas)}`, detalhe: "O Google Analytics 4 está conectado: o modelo enxerga as visitas por origem.", acao: null }
    : { id: "visitas", estado: "opcional", titulo: "Visitas ao site (opcional)", detalhe: "Conecte o Google Analytics 4 para o modelo enxergar as visitas por origem. Melhora a leitura, mas não é obrigatório.", acao: "conexoes" });

  const obrigatorias = verificacoes.filter(v => v.id !== "visitas");
  const prontos = obrigatorias.filter(v => v.estado === "ok").length;
  const pronto = prontos === obrigatorias.length;
  // As semanas em que há vendas e gasto juntos: é o que o modelo consegue usar.
  let semanasJuntas = 0;
  if (pronto && melhor && comVendas.length > 0) {
    const de = comVendas[0].semana > melhor.primeiraSemana ? comVendas[0].semana : melhor.primeiraSemana;
    const ate = comVendas.at(-1)!.semana < melhor.ultimaSemana ? comVendas.at(-1)!.semana : melhor.ultimaSemana;
    semanasJuntas = semanasEntre(de, ate);
  }
  return { pronto, verificacoes, prontos, total: obrigatorias.length, confianca: pronto ? confiancaPelasSemanas(semanasJuntas) : null, semanas: semanasJuntas, canais, ignoradas: e.ignoradas ?? [], controles: e.controles ?? [], resumo: e.resumo ?? null };
}
