// A PREVISÃO POR SESSÃO: como cada dia e horário vende na casa, a "procura sobrando" de um evento (sessões esgotadas e gente na lista de espera) e "e se eu acrescentar uma
// sessão?". Putler & Lele (Marketing Letters, 2003): a procura é por sessão, e o dia da semana e o horário pesam. Tudo é da própria casa: a média de cada dia e horário vem das
// sessões que já aconteceram ali, e a força do evento é ele comparado à casa nas mesmas sessões. Nada de categoria universal de evento (decisão do dono, 23/11/2026).
// Sem banco e sem imports de servidor: roda nos testes (tests/ticketeria-previsao-sessao.test.ts).

import { PARTE_QUE_ESGOTA } from "@/lib/ticketeria/esgotamento";

/** Um dia e horário só entra na conta da casa com tantas sessões realizadas ou mais. */
export const MIN_SESSOES_DO_HORARIO = 4;
/** Com tantas sessões ou mais no dia e horário (e a força do evento medida em MIN_SESSOES_DA_FORCA_MEDIDA), a estimativa vira "medido". */
export const SESSOES_PARA_MEDIDO = 12;
export const MIN_SESSOES_DA_FORCA_MEDIDA = 4;
/** A força do evento fica entre estes limites (uma sessão fora da curva não faz o evento valer o triplo da casa). */
export const FORCA_MIN = 0.5;
export const FORCA_MAX = 1.6;
/** Quanto da nova sessão pode ser público que só troca de sessão: muito com pouca gente esperando, menos com lista de espera grande. */
export const TROCA_SEM_ESPERA = 0.35;
export const TROCA_COM_ESPERA = 0.2;
/** A lista de espera conta como "grande" quando passa desta parte dos lugares da sessão nova. */
export const ESPERA_GRANDE = 0.1;
/** Quantas opções de dia e horário o "e se" mostra. */
export const OPCOES_DO_E_SE = 3;
/** O "e se" procura dias até tantos dias depois da última sessão do evento. */
export const DIAS_DEPOIS_DA_TEMPORADA = 7;

export type Turno = "manha" | "tarde" | "noite";
export const ROTULO_DO_TURNO: Record<Turno, string> = { manha: "manhã", tarde: "tarde", noite: "noite" };
const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DIAS_POR_EXTENSO = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
/** A ordem dos dias no gráfico: da segunda ao domingo (o fim de semana junto, no fim). */
const ORDEM_DOS_DIAS = [1, 2, 3, 4, 5, 6, 0];
const ORDEM_DOS_TURNOS: Turno[] = ["manha", "tarde", "noite"];

/** O turno pela hora local ("HH:MM"): antes do meio-dia é manhã, antes das 18h é tarde (a matinê), depois é noite. */
export function turnoDaHora(hora: string): Turno {
  const h = Number(hora.slice(0, 2));
  return h < 12 ? "manha" : h < 18 ? "tarde" : "noite";
}
/** O dia da semana (0 = domingo) de um dia "AAAA-MM-DD". */
export const diaDaSemana = (dia: string): number => new Date(`${dia}T12:00:00Z`).getUTCDay();
const somarDias = (dia: string, n: number) => new Date(Date.parse(`${dia}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/** Uma sessão de um dia, já no fuso do local: dia, hora, lugares (da sala) e quantos ingressos vendeu. `esgotou`: chegou a PARTE_QUE_ESGOTA. */
export type SessaoDaCasa = { id: string; eventoId: string; localId: string; salaId: string; dia: string; hora: string; lugares: number; vendidos: number };
const ocupacao = (s: SessaoDaCasa) => Math.min(1, s.vendidos / s.lugares);
export const esgotou = (s: Pick<SessaoDaCasa, "lugares" | "vendidos">) => s.lugares > 0 && s.vendidos >= PARTE_QUE_ESGOTA * s.lugares;

export type DiaEHorario = { diaDaSemana: number; turno: Turno; rotulo: string; sessoes: number; ocupacao: number; desvio: number; horaMaisComum: string };
const chave = (d: number, t: Turno) => `${d}|${t}`;

/**
 * Como cada dia e horário vende na casa: a lotação média das sessões que já aconteceram (antes de `hoje`, com lotação), por dia da semana e turno. Só entra o dia e horário com
 * MIN_SESSOES_DO_HORARIO sessões ou mais. Da segunda ao domingo, e dentro do dia da manhã à noite.
 */
export function comoCadaDiaVende(sessoes: SessaoDaCasa[], hoje: string, min: number = MIN_SESSOES_DO_HORARIO): DiaEHorario[] {
  const grupos = new Map<string, SessaoDaCasa[]>();
  for (const s of sessoes) {
    if (s.lugares <= 0 || s.dia >= hoje) continue;
    const k = chave(diaDaSemana(s.dia), turnoDaHora(s.hora));
    grupos.set(k, [...(grupos.get(k) ?? []), s]);
  }
  const saida: DiaEHorario[] = [];
  for (const [k, lista] of grupos) {
    if (lista.length < min) continue;
    const [d, t] = k.split("|") as [string, Turno];
    const ocs = lista.map(ocupacao);
    const media = ocs.reduce((a, b) => a + b, 0) / ocs.length;
    const desvio = Math.sqrt(ocs.reduce((a, b) => a + (b - media) ** 2, 0) / ocs.length);
    const horas = new Map<string, number>();
    for (const s of lista) horas.set(s.hora, (horas.get(s.hora) ?? 0) + 1);
    const horaMaisComum = [...horas].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
    saida.push({ diaDaSemana: Number(d), turno: t, rotulo: `${DIAS[Number(d)]} · ${ROTULO_DO_TURNO[t]}`, sessoes: lista.length, ocupacao: Math.round(media * 1000) / 1000, desvio: Math.round(desvio * 1000) / 1000, horaMaisComum });
  }
  return saida.sort((a, b) => ORDEM_DOS_DIAS.indexOf(a.diaDaSemana) - ORDEM_DOS_DIAS.indexOf(b.diaDaSemana) || ORDEM_DOS_TURNOS.indexOf(a.turno) - ORDEM_DOS_TURNOS.indexOf(b.turno));
}

/** A frase do gráfico: o dia e horário mais forte e o mais fraco ("Sábado à noite é o seu dia mais forte; quarta à noite, o mais fraco."). Null com menos de dois. */
export function fraseDosDias(dias: DiaEHorario[]): string | null {
  if (dias.length < 2) return null;
  const ordenados = [...dias].sort((a, b) => b.ocupacao - a.ocupacao);
  const nome = (d: DiaEHorario) => `${DIAS_POR_EXTENSO[d.diaDaSemana]} ${d.turno === "manha" ? "de manhã" : d.turno === "tarde" ? "à tarde" : "à noite"}`;
  const forte = nome(ordenados[0]);
  return `${forte[0].toUpperCase()}${forte.slice(1)} é o seu dia mais forte; ${nome(ordenados.at(-1)!)}, o mais fraco.`;
}

/**
 * A força do evento: quanto ele vende frente à média da casa nas mesmas sessões (1 = igual à casa; 1,21 = 21% acima). Só contam as sessões do evento que já aconteceram ou que já
 * esgotaram (uma sessão por vir, ainda vendendo, puxaria a força para baixo), e só as de dia e horário com média na casa. Null sem sessão comparável.
 */
export function forcaDoEvento(sessoesDoEvento: SessaoDaCasa[], dias: DiaEHorario[], hoje: string): { forca: number; sessoes: number } | null {
  const media = new Map(dias.map(d => [chave(d.diaDaSemana, d.turno), d.ocupacao]));
  let doEvento = 0, daCasa = 0, n = 0;
  for (const s of sessoesDoEvento) {
    if (s.lugares <= 0 || (s.dia >= hoje && !esgotou(s))) continue;
    const m = media.get(chave(diaDaSemana(s.dia), turnoDaHora(s.hora)));
    if (m === undefined || m <= 0) continue;
    doEvento += ocupacao(s);
    daCasa += m;
    n++;
  }
  if (n === 0) return null;
  return { forca: Math.round(Math.min(FORCA_MAX, Math.max(FORCA_MIN, doEvento / daCasa)) * 100) / 100, sessoes: n };
}

export type ProcuraSobrando = { esgotadas: number; sessoes: number; naEspera: number };

/**
 * A procura sobrando de um evento, SÓ com sinal medido: alguma sessão esgotou e (há gente na lista de espera, ou metade das sessões ou mais esgotou). O evento precisa ter sessão de
 * hoje em diante (depois da temporada, acrescentar sessão não é mais pergunta). `naEspera` é quantas pessoas estão na lista (ainda não avisadas). Null sem sinal.
 */
export function procuraSobrando(sessoesDoEvento: SessaoDaCasa[], naEspera: number, hoje: string): ProcuraSobrando | null {
  const comLugar = sessoesDoEvento.filter(s => s.lugares > 0);
  if (!comLugar.some(s => s.dia >= hoje)) return null;
  const esgotadas = comLugar.filter(esgotou).length;
  if (esgotadas === 0) return null;
  if (naEspera <= 0 && esgotadas * 2 < comLugar.length) return null;
  return { esgotadas, sessoes: comLugar.length, naEspera: Math.max(0, naEspera) };
}

export type Selo = "medido" | "razoavel";
export type EstimativaDaSessao = {
  dia: string; hora: string; diaDaSemana: number; turno: Turno; lugares: number;
  baixo: number; alto: number; selo: Selo;
  /** A base da conta, para a explicação: a média da casa nesse dia e horário e em quantas sessões, e a força do evento (null: sem comparação, vale 1). */
  mediaDaCasa: number; sessoesDaCasa: number; forca: number | null; sessoesDaForca: number; parteQueTroca: number;
};

const arredondar = (n: number, lugares: number, para: "baixo" | "cima") => {
  const passo = lugares >= 100 ? 10 : lugares >= 30 ? 5 : 1;
  return para === "baixo" ? Math.floor(n / passo) * passo : Math.ceil(n / passo) * passo;
};

/**
 * Quanto uma sessão nova deve vender: a média da casa naquele dia e horário × a força do evento, nos lugares da sala. A faixa desce pela parte do público que só trocaria de sessão
 * (menos quando a lista de espera é grande: é gente que não achou lugar). Null quando a casa não tem esse dia e horário medido.
 */
export function estimarSessao(alvo: { dia: string; hora: string; lugares: number }, dias: DiaEHorario[], forca: { forca: number; sessoes: number } | null, naEspera: number): EstimativaDaSessao | null {
  if (alvo.lugares <= 0) return null;
  const d = diaDaSemana(alvo.dia), t = turnoDaHora(alvo.hora);
  const base = dias.find(x => x.diaDaSemana === d && x.turno === t);
  if (!base) return null;
  const centro = Math.min(1, base.ocupacao * (forca?.forca ?? 1)) * alvo.lugares;
  const parteQueTroca = naEspera >= ESPERA_GRANDE * alvo.lugares ? TROCA_COM_ESPERA : TROCA_SEM_ESPERA;
  const alto = Math.min(alvo.lugares, arredondar(centro, alvo.lugares, "cima"));
  const baixo = Math.min(alto, Math.max(0, arredondar(centro * (1 - parteQueTroca), alvo.lugares, "baixo")));
  const medido = base.sessoes >= SESSOES_PARA_MEDIDO && (forca?.sessoes ?? 0) >= MIN_SESSOES_DA_FORCA_MEDIDA;
  return { dia: alvo.dia, hora: alvo.hora, diaDaSemana: d, turno: t, lugares: alvo.lugares, baixo, alto, selo: medido ? "medido" : "razoavel", mediaDaCasa: base.ocupacao, sessoesDaCasa: base.sessoes, forca: forca?.forca ?? null, sessoesDaForca: forca?.sessoes ?? 0, parteQueTroca };
}

/**
 * As opções do "e se eu acrescentar uma sessão?": de amanhã (ou da primeira sessão) até DIAS_DEPOIS_DA_TEMPORADA dias depois da última sessão do evento, cada dia com um dia e horário
 * medido na casa, na hora mais comum da casa nesse horário; fora os dias em que o evento já tem sessão no mesmo turno. As OPCOES_DO_E_SE que mais vendem, em ordem de data.
 */
export function opcoesDoESe(sessoesDoEvento: SessaoDaCasa[], dias: DiaEHorario[], forca: { forca: number; sessoes: number } | null, naEspera: number, hoje: string, quantas: number = OPCOES_DO_E_SE): EstimativaDaSessao[] {
  const comLugar = sessoesDoEvento.filter(s => s.lugares > 0);
  if (comLugar.length === 0 || dias.length === 0) return [];
  const datas = comLugar.map(s => s.dia).sort();
  // A partir de amanhã: uma sessão nova para hoje não teria tempo de vender.
  const amanha = somarDias(hoje, 1);
  const de = datas[0] > amanha ? datas[0] : amanha;
  const ate = somarDias(datas.at(-1)!, DIAS_DEPOIS_DA_TEMPORADA);
  // Os lugares da sessão nova: os da sala mais usada pelo evento.
  const salas = new Map<string, { n: number; lugares: number }>();
  for (const s of comLugar) salas.set(s.salaId, { n: (salas.get(s.salaId)?.n ?? 0) + 1, lugares: s.lugares });
  const lugares = [...salas.values()].sort((a, b) => b.n - a.n)[0].lugares;
  const ocupados = new Set(comLugar.map(s => `${s.dia}|${turnoDaHora(s.hora)}`));
  const candidatas: EstimativaDaSessao[] = [];
  for (let dia = de; dia <= ate; dia = somarDias(dia, 1)) {
    for (const h of dias.filter(x => x.diaDaSemana === diaDaSemana(dia))) {
      if (ocupados.has(`${dia}|${h.turno}`)) continue;
      const e = estimarSessao({ dia, hora: h.horaMaisComum, lugares }, dias, forca, naEspera);
      if (e) candidatas.push(e);
    }
  }
  return candidatas.sort((a, b) => (b.baixo + b.alto) - (a.baixo + a.alto) || a.dia.localeCompare(b.dia)).slice(0, quantas)
    .sort((a, b) => a.dia.localeCompare(b.dia) || a.hora.localeCompare(b.hora));
}

/** "Dom, 22/3, 16h" (ou "16h30"), com "(matinê)" à tarde. */
export function rotuloDaOpcao(e: Pick<EstimativaDaSessao, "dia" | "hora" | "diaDaSemana" | "turno">): string {
  const [h, m] = e.hora.split(":");
  return `${DIAS[e.diaDaSemana]}, ${Number(e.dia.slice(8, 10))}/${Number(e.dia.slice(5, 7))}, ${Number(h)}h${m && m !== "00" ? m : ""}${e.turno === "tarde" ? " (matinê)" : ""}`;
}

/** O nome do dia e horário na frase ("Uma matinê de domingo", "Uma sessão de quarta à noite"). */
export function nomeDaSessaoNova(e: Pick<EstimativaDaSessao, "diaDaSemana" | "turno">): string {
  const dia = DIAS_POR_EXTENSO[e.diaDaSemana];
  if (e.turno === "tarde") return `Uma matinê de ${dia}`;
  return `Uma sessão de ${dia} ${e.turno === "manha" ? "de manhã" : "à noite"}`;
}

/** A explicação da estimativa, em frases curtas. */
export function porQueEssaEstimativa(e: EstimativaDaSessao, evento: string, naEspera: number): string {
  const nome = nomeDaSessaoNova(e).replace(/^Uma /, "").replace(/^sessão de /, "sessões de ").replace(/^matinê de /, "matinês de ");
  const partes = [`Na sua casa, as ${e.sessoesDaCasa} ${nome} venderam em média ${Math.round(e.mediaDaCasa * 100)}% da lotação.`];
  if (e.forca === null) partes.push(`${evento} ainda não tem sessão para comparar com a casa: a conta usa a média da casa.`);
  else {
    const dif = Math.round((e.forca - 1) * 100);
    partes.push(dif === 0 ? `${evento} vende como a média da casa nas mesmas sessões.` : `${evento} vende ${Math.abs(dif)}% ${dif > 0 ? "acima" : "abaixo"} da média da casa nas mesmas sessões.`);
  }
  partes.push(naEspera > 0
    ? `A faixa é larga porque parte desse público compraria outra sessão${e.parteQueTroca === TROCA_COM_ESPERA ? `: com ${naEspera} ${naEspera === 1 ? "pessoa" : "pessoas"} na lista de espera, a maior parte deve ser público novo.` : "."}`
    : "A faixa é larga porque parte desse público compraria outra sessão.");
  return partes.join(" ");
}
