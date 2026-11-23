// Os CONTROLES do modelo de marketing (MMM): além do gasto em divulgação, o que também empurra as vendas de ingresso. O modelo precisa saber disso para não creditar a um anúncio uma venda
// que a proximidade da sessão ou o Natal já teriam trazido. Sem banco e sem imports de servidor: roda nos testes (tests/ticketeria-modelo-controles.test.ts); quem lê as linhas é
// lib/ticketeria/modelo-servidor.ts.
//
// Cada controle é uma coluna da tabela semanal (`SemanaDaTabela.controles`), uma linha por semana, em escala pequena e sem unidade:
//   - proximidade: 1 na semana da sessão e cai até 0 oito semanas antes; semana depois da última sessão ou longe de qualquer sessão vale 0;
//   - feriado: 1 se a semana tem um feriado, uma data de comércio (Dia das Mães, Black Friday…) ou uma data de pico da própria loja;
//   - lote: 1 se um lote (que não o primeiro de cada ingresso) começou a ser vendido na semana: a virada de lote puxa uma corrida de compra;
//   - preco: o preço médio por ingresso pago na semana em relação ao preço mediano da loja (0 = o de sempre; 0,2 = 20% mais caro); semana sem venda repete a anterior;
//   - cupom: a parte dos ingressos pagos da semana comprados com cupom (0 a 1);
//   - visitas: as visitas ao site que NÃO vieram de anúncio pago, em relação à mediana (log): só vem do GA4 (outra fatia);
//   - lugares: o TAMANHO do que está à venda na semana: os lugares das sessões que acontecem nas próximas HORIZONTE_DA_PROXIMIDADE_EM_SEMANAS semanas, em relação à mediana (1 = o de sempre,
//     2 = o dobro). Quem espera vender mais anuncia mais (Kang, International Journal of Market Research, 2019): sem isto o modelo credita ao anúncio a venda que veio do evento ser maior.
//     Nas semanas de antes da primeira sessão conhecida (histórico importado, que não tem sessão) vale 1, "o de sempre", para o controle não marcar a diferença entre o histórico e a Ticketeria.
// Com pouca história o modelo usa só os três primeiros (proximidade, feriado e lugares); os outros entram a partir de SEMANAS_DOS_CONTROLES_EXTRAS semanas, para não confundir um efeito com outro.

import { inicioDaSemana, semanasEntre } from "@/lib/ticketeria/modelo";

export const SEMANAS_DOS_CONTROLES_EXTRAS = 52;
/** O GA4 só vira controle com pelo menos tantas semanas inteiras de visitas lidas (com menos, o modelo não tem como separar a visita do resto). */
export const MIN_SEMANAS_DE_VISITAS = 26;
export const HORIZONTE_DA_PROXIMIDADE_EM_SEMANAS = 8;

export type ChaveDoControle = "proximidade" | "feriado" | "lugares" | "lote" | "preco" | "cupom" | "visitas";
export type GrupoDeControle = "proximidade" | "feriados" | "lugares" | "preco_e_lotes" | "cupons" | "visitas";

export const GRUPOS_DE_CONTROLE: { grupo: GrupoDeControle; rotulo: string; chaves: ChaveDoControle[]; extra: boolean }[] = [
  { grupo: "proximidade", rotulo: "Proximidade da sessão", chaves: ["proximidade"], extra: false },
  { grupo: "feriados", rotulo: "Feriados e datas de pico", chaves: ["feriado"], extra: false },
  { grupo: "lugares", rotulo: "Tamanho do que está à venda", chaves: ["lugares"], extra: false },
  { grupo: "preco_e_lotes", rotulo: "Preço e lotes", chaves: ["lote", "preco"], extra: true },
  { grupo: "cupons", rotulo: "Cupons", chaves: ["cupom"], extra: true },
  { grupo: "visitas", rotulo: "Visitas ao site, sem anúncio (GA4)", chaves: ["visitas"], extra: true },
];

// ─── O calendário ───────────────────────────────────────────────────────────

const msDoDia = 86400000;
const diaDe = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
const utc = (ano: number, mes: number, dia: number): number => Date.UTC(ano, mes - 1, dia);

/** O domingo de Páscoa do ano (algoritmo gregoriano de Meeus/Jones/Butcher), em milissegundos UTC. */
export function pascoa(ano: number): number {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(ano, mes, dia);
}

/** O n-ésimo domingo/quinta de um mês (dia da semana: 0 = domingo). */
const enesimo = (ano: number, mes: number, diaDaSemana: number, n: number): number => {
  const primeiro = new Date(utc(ano, mes, 1)).getUTCDay();
  return utc(ano, mes, 1 + ((diaDaSemana - primeiro + 7) % 7) + (n - 1) * 7);
};

/** As datas do calendário nacional que mexem com a venda de ingresso, num ano: feriados e datas de comércio. */
export function datasNacionaisDoAno(ano: number): { dia: string; nome: string }[] {
  const p = pascoa(ano);
  const lista: [number, string][] = [
    [utc(ano, 1, 1), "Ano Novo"], [p - 47 * msDoDia, "Carnaval"], [p - 2 * msDoDia, "Sexta-feira Santa"], [p, "Páscoa"], [utc(ano, 4, 21), "Tiradentes"], [utc(ano, 5, 1), "Dia do Trabalho"],
    [enesimo(ano, 5, 0, 2), "Dia das Mães"], [utc(ano, 6, 12), "Dia dos Namorados"], [p + 60 * msDoDia, "Corpus Christi"], [enesimo(ano, 8, 0, 2), "Dia dos Pais"], [utc(ano, 9, 7), "Independência"],
    [utc(ano, 10, 12), "Dia das Crianças"], [utc(ano, 11, 2), "Finados"], [utc(ano, 11, 15), "Proclamação da República"], [enesimo(ano, 11, 4, 4) + msDoDia, "Black Friday"],
    [utc(ano, 12, 25), "Natal"], [utc(ano, 12, 31), "Réveillon"],
  ];
  return lista.map(([ms, nome]) => ({ dia: diaDe(ms), nome })).sort((a, b) => a.dia.localeCompare(b.dia));
}

// ─── Os controles semana a semana ───────────────────────────────────────────

export type ItemDePedidoPago = { dia: string; quantidade: number; precoCentavos: number; comCupom: boolean };
export type EntradaDosControles = {
  /** As semanas da tabela (segundas-feiras, AAAA-MM-DD), em ordem. */
  semanas: string[];
  /** O dia de início (AAAA-MM-DD, no fuso da loja) das sessões que não foram canceladas. */
  sessoes: string[];
  /** Os lugares de cada sessão (a lotação da sala), para o controle de tamanho; sem isto o controle fica de fora. */
  lugaresDasSessoes?: { dia: string; lugares: number }[];
  /** As datas de pico que o produtor acrescentou. */
  datasProprias: { dia: string; nome: string }[];
  /** O dia em que cada lote que não é o primeiro do ingresso começa a ser vendido. */
  viradasDeLote: string[];
  /** Cada item de ingresso das compras pagas (dia no fuso da loja). */
  itens: ItemDePedidoPago[];
};

const arredondar = (n: number, casas = 4): number => Math.round(n * 10 ** casas) / 10 ** casas;
const mediana = (v: number[]): number => { const o = [...v].sort((a, b) => a - b); return o.length === 0 ? 0 : o.length % 2 ? o[(o.length - 1) / 2] : (o[o.length / 2 - 1] + o[o.length / 2]) / 2; };

/** As colunas de controle de cada semana (as que a entrada permite calcular; `visitas` vem de outra fatia). */
export function controlesDasSemanas(e: EntradaDosControles): Record<string, Record<ChaveDoControle, number>> {
  const diasDePico = new Set(e.datasProprias.map(d => d.dia));
  const anos = new Set(e.semanas.flatMap(s => [Number(s.slice(0, 4)), Number(s.slice(0, 4)) + 1]));
  for (const ano of anos) for (const d of datasNacionaisDoAno(ano)) diasDePico.add(d.dia);
  const semanasDePico = new Set([...diasDePico].map(inicioDaSemana));
  const semanasDeLote = new Set(e.viradasDeLote.map(inicioDaSemana));
  const semanasDeSessao = [...new Set(e.sessoes.map(inicioDaSemana))].sort();

  const porSemana = new Map<string, { quantidade: number; valor: number; comCupom: number; pagos: number }>();
  for (const it of e.itens) {
    if (it.quantidade <= 0 || it.precoCentavos <= 0) continue; // cortesia e gratuito não dizem nada do preço nem do cupom
    const s = inicioDaSemana(it.dia);
    const a = porSemana.get(s) ?? { quantidade: 0, valor: 0, comCupom: 0, pagos: 0 };
    a.quantidade += it.quantidade; a.valor += it.quantidade * it.precoCentavos; a.pagos += it.quantidade; if (it.comCupom) a.comCupom += it.quantidade;
    porSemana.set(s, a);
  }
  const precoMedio = new Map([...porSemana].map(([s, a]) => [s, a.valor / a.quantidade]));
  const referencia = mediana([...precoMedio.values()]);

  // O tamanho do que está à venda: os lugares das sessões que acontecem desta semana até HORIZONTE semanas à frente, em relação à mediana das semanas com sessão à frente.
  const comLugares = (e.lugaresDasSessoes ?? []).filter(x => x.lugares > 0).map(x => ({ semana: inicioDaSemana(x.dia), lugares: x.lugares }));
  const lugaresBrutos = new Map(e.semanas.map(semana => [semana, comLugares.reduce((soma, x) => {
    const d = semanasEntre(semana, x.semana) - 1;
    return x.semana >= semana && d <= HORIZONTE_DA_PROXIMIDADE_EM_SEMANAS ? soma + x.lugares : soma;
  }, 0)]));
  const lugaresDeReferencia = mediana([...lugaresBrutos.values()].filter(v => v > 0));
  const primeiraJanela = comLugares.length > 0 ? comLugares.map(x => x.semana).sort()[0] : null;

  const saida: Record<string, Record<ChaveDoControle, number>> = {};
  let precoAnterior = 0;
  for (const semana of e.semanas) {
    const proxima = semanasDeSessao.find(s => s >= semana);
    const distancia = proxima ? semanasEntre(semana, proxima) - 1 : null;
    const proximidade = distancia !== null && distancia <= HORIZONTE_DA_PROXIMIDADE_EM_SEMANAS ? 1 - distancia / (HORIZONTE_DA_PROXIMIDADE_EM_SEMANAS + 1) : 0;
    const preco = precoMedio.get(semana);
    const relativo = preco !== undefined && referencia > 0 ? preco / referencia - 1 : precoAnterior;
    precoAnterior = relativo;
    const compras = porSemana.get(semana);
    saida[semana] = {
      proximidade: arredondar(proximidade), feriado: semanasDePico.has(semana) ? 1 : 0,
      lugares: lugaresDeReferencia <= 0 ? 0
        : primeiraJanela !== null && semanasEntre(semana, primeiraJanela) - 1 > HORIZONTE_DA_PROXIMIDADE_EM_SEMANAS && semana < primeiraJanela ? 1
        : arredondar(Math.min(10, (lugaresBrutos.get(semana) ?? 0) / lugaresDeReferencia)),
      lote: semanasDeLote.has(semana) ? 1 : 0, preco: arredondar(relativo),
      cupom: compras && compras.pagos > 0 ? arredondar(compras.comCupom / compras.pagos) : 0, visitas: 0,
    };
  }
  return saida;
}


// ─── As visitas sem anúncio (GA4) ───────────────────────────────────────────

/** O mesmo critério do próprio GA4 para "pago": o meio tem "cp" (cpc, cpm, cpv…), é ppc, retargeting ou começa com "paid"; e o link de divulgação da própria loja marcado como anúncio pago. */
const MEIO_PAGO = /^(.*cp.*|ppc|retargeting|paid.*)$/;
export function visitaDeAnuncioPago(origem: string): boolean {
  const [fonte = "", meio = ""] = origem.split("/").map(x => x.trim().toLowerCase());
  return fonte === "anuncio-pago" || MEIO_PAGO.test(meio);
}

export type VisitaDoDia = { dia: string; origem: string; sessoes: number };
const somaDias = (dia: string, n: number): string => diaDe(Date.parse(`${dia}T00:00:00Z`) + n * msDoDia);

/**
 * O controle de visitas de cada semana: as sessões que NÃO vieram de anúncio pago (as de anúncio são consequência do gasto: se entrassem como controle o modelo contaria o mesmo efeito
 * duas vezes), em escala de log em relação à mediana (0 = a visita de sempre). Só valem as semanas INTEIRAS lidas; as de fora, e tudo se houver menos de MIN_SEMANAS_DE_VISITAS semanas
 * lidas, ficam em 0 (nada a dizer). `semanasLidas` são as semanas inteiras que a conexão leu.
 */
export function controleDeVisitas(visitas: VisitaDoDia[], primeiroDia: string | null, ultimoDia: string | null, semanas: string[]): { valores: Record<string, number>; semanasLidas: number } {
  const zeros = Object.fromEntries(semanas.map(s => [s, 0]));
  if (!primeiroDia || !ultimoDia || ultimoDia < primeiroDia) return { valores: zeros, semanasLidas: 0 };
  const porSemana = new Map<string, number>();
  for (let ws = inicioDaSemana(primeiroDia); somaDias(ws, 6) <= ultimoDia; ws = somaDias(ws, 7)) if (ws >= primeiroDia) porSemana.set(ws, 0);
  for (const v of visitas) {
    const ws = inicioDaSemana(v.dia);
    if (porSemana.has(ws) && !visitaDeAnuncioPago(v.origem)) porSemana.set(ws, (porSemana.get(ws) ?? 0) + v.sessoes);
  }
  const semanasLidas = porSemana.size;
  if (semanasLidas < MIN_SEMANAS_DE_VISITAS) return { valores: zeros, semanasLidas };
  const referencia = Math.log1p(mediana([...porSemana.values()]));
  return { valores: Object.fromEntries(semanas.map(s => [s, porSemana.has(s) ? arredondar(Math.log1p(porSemana.get(s) as number) - referencia) : 0])), semanasLidas };
}

// ─── O que a tela mostra de cada controle ───────────────────────────────────

export type EstadoDoControle = "em_uso" | "entra_depois" | "sem_dados" | "opcional";
export type ControleDaTela = { grupo: GrupoDeControle; rotulo: string; estado: EstadoDoControle; detalhe: string; /** Só em "entra_depois": quantas semanas faltam. */ faltam: number | null; acao: "datas" | "conexoes" | null };
/** O que a loja tem de cada coisa (só para o texto da tela). */
export type ResumoDosControles = { eventos: number; sessoes: number; lotes: number; cupons: number; datasProprias: number };

/** Uma coluna "varia" se tem pelo menos dois valores diferentes (constante não ensina nada ao modelo). */
export const variaNaTabela = (semanas: { controles?: Partial<Record<ChaveDoControle, number>> }[], chave: ChaveDoControle): boolean => {
  const valores = new Set(semanas.map(s => s.controles?.[chave]).filter((v): v is number => typeof v === "number"));
  return valores.size >= 2;
};

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Os controles que o modelo usaria com esta tabela, na ordem da tela: em uso, entra com mais semanas, sem dado ou opcional. */
export function controlesDaTela(tabela: { controles?: Partial<Record<ChaveDoControle, number>> }[], resumo: ResumoDosControles, visitas: { conectado: boolean; semanas: number }): ControleDaTela[] {
  const n = tabela.length;
  const faltam = Math.max(0, SEMANAS_DOS_CONTROLES_EXTRAS - n);
  return GRUPOS_DE_CONTROLE.map(g => {
    const varia = g.chaves.some(c => variaNaTabela(tabela, c));
    const base = { grupo: g.grupo, rotulo: g.rotulo };
    if (g.grupo === "visitas") {
      if (!visitas.conectado || visitas.semanas === 0) return { ...base, estado: "opcional", faltam: null, acao: "conexoes", detalhe: "Só as visitas que não vieram de anúncio pago: busca, direto, e-mail, indicação. As de anúncio não entram, para o efeito não ser contado duas vezes." } satisfies ControleDaTela;
      if (visitas.semanas < MIN_SEMANAS_DE_VISITAS) return { ...base, estado: "sem_dados", faltam: null, acao: null, detalhe: `O GA4 está conectado, mas só ${plural(visitas.semanas, "semana", "semanas")} de visitas foram lidas. Entra com ${MIN_SEMANAS_DE_VISITAS} semanas lidas.` } satisfies ControleDaTela;
      if (faltam > 0) return { ...base, estado: "entra_depois", faltam, acao: null, detalhe: `O GA4 está conectado (${plural(visitas.semanas, "semana", "semanas")} de visitas). Só entram as que não vieram de anúncio pago.` } satisfies ControleDaTela;
      return { ...base, estado: varia ? "em_uso" : "sem_dados", faltam: null, acao: null, detalhe: varia ? `Só as visitas que não vieram de anúncio pago (${plural(visitas.semanas, "semana", "semanas")} lidas).` : "As visitas sem anúncio ainda não variam o bastante entre as semanas." } satisfies ControleDaTela;
    }
    if (g.grupo === "proximidade") {
      return { ...base, estado: varia ? "em_uso" : "sem_dados", faltam: null, acao: null, detalhe: varia
        ? `Ingresso vende mais perto da data. O modelo lê as datas das suas sessões (${plural(resumo.eventos, "evento", "eventos")}, ${plural(resumo.sessoes, "sessão", "sessões")}) e aprende essa curva sozinho.`
        : "Ingresso vende mais perto da data. Quando houver sessões dentro do período do histórico, o modelo aprende essa curva sozinho." } satisfies ControleDaTela;
    }
    if (g.grupo === "lugares") {
      return { ...base, estado: varia ? "em_uso" : "sem_dados", faltam: null, acao: null, detalhe: varia
        ? "Quantos lugares estão à venda nas próximas semanas. Evento maior vende mais e costuma receber mais anúncio: o modelo separa uma coisa da outra para não dar ao anúncio o mérito do tamanho do evento."
        : "Quantos lugares estão à venda nas próximas semanas. Quando os eventos tiverem tamanhos diferentes, o modelo usa isso para não dar ao anúncio o mérito do tamanho do evento." } satisfies ControleDaTela;
    }
    if (g.grupo === "feriados") {
      return { ...base, estado: varia ? "em_uso" : "sem_dados", faltam: null, acao: "datas", detalhe: "Carnaval, Dia das Mães, Black Friday, Natal. Vem de um calendário nacional pronto." + (resumo.datasProprias > 0 ? ` Mais ${plural(resumo.datasProprias, "data sua", "datas suas")}.` : "") } satisfies ControleDaTela;
    }
    const detalhe = g.grupo === "preco_e_lotes"
      ? `Troca de lote e preço médio da semana. Já estão na Ticketeria (${plural(resumo.lotes, "lote", "lotes")} nesta loja).`
      : `Semanas com cupom ativo e a parte dos ingressos comprados com cupom. Já estão na Ticketeria (${plural(resumo.cupons, "cupom", "cupons")}).`;
    if (faltam > 0) return { ...base, estado: "entra_depois", faltam, acao: null, detalhe } satisfies ControleDaTela;
    return { ...base, estado: varia ? "em_uso" : "sem_dados", faltam: null, acao: null, detalhe: varia ? detalhe : `${detalhe} Ainda não variou entre as semanas, então não entra.` } satisfies ControleDaTela;
  });
}

/** Os controles que o job usa com esta tabela (a mesma regra do cálculo em modelo/mmm.py): os dois primeiros sempre, o resto com SEMANAS_DOS_CONTROLES_EXTRAS semanas ou mais, e só os que variam. */
export function controlesQueEntram(tabela: { controles?: Partial<Record<ChaveDoControle, number>> }[]): ChaveDoControle[] {
  const extras = tabela.length >= SEMANAS_DOS_CONTROLES_EXTRAS;
  return GRUPOS_DE_CONTROLE.filter(g => !g.extra || extras).flatMap(g => g.chaves).filter(c => variaNaTabela(tabela, c));
}

// ─── As datas de pico da própria loja ───────────────────────────────────────

export type DataDePico = { id: string; dia: string; nome: string };
export type CamposDaDataDePico = { dia: string; nome: string };

/** Confere o que o produtor digitou na folha "Adicionar uma data sua": um dia que existe e um nome de 2 a 60 letras. */
export function lerDataDePico(c: CamposDaDataDePico): { ok: true; valor: CamposDaDataDePico } | { ok: false; erro: string } {
  const nome = c.nome.replace(/\s+/g, " ").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.dia) || diaDe(Date.parse(`${c.dia}T00:00:00Z`)) !== c.dia) return { ok: false, erro: "Escolha o dia." };
  if (nome.length < 2 || nome.length > 60) return { ok: false, erro: "Dê um nome de 2 a 60 letras, como “Festa da cidade”." };
  return { ok: true, valor: { dia: c.dia, nome } };
}
