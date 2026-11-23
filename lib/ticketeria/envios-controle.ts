// O que o e-mail TROUXE A MAIS, medido com um grupo de comparação (decisão do dono, 23/11/2026). Em cada envio, PARTE_DA_COMPARACAO das pessoas é sorteada e NÃO recebe o e-mail; nos
// DIAS_DA_MEDIDA dias seguintes, o Jards compara quanto cada grupo comprou (em qualquer canal: o e-mail também vende por quem não clica). Somando os envios, mostra para quem o e-mail
// funciona na casa, por há quanto tempo a pessoa comprou pela última vez, e quanto se teria com menos e-mails (Valenti, Srinivasan, Yildirim e Pauwels, JAMS 2024; Ascarza, JMR 2018;
// Hitsch, Misra e Zhang, QME 2024). Também o limite de e-mails por semana e a central de preferências (Zhang, Kumar e Cosguner, JMR 2017; De Pessemier et al., 2012).
// Sem banco e sem imports de servidor: roda nos testes (tests/ticketeria-envios-controle.test.ts).

export const PARTE_DA_COMPARACAO = 0.1;
/** Abaixo disto o grupo de comparação teria poucas pessoas para dizer qualquer coisa: o envio sai para todos. */
export const MIN_PARA_COMPARAR = 50;
export const DIAS_DA_MEDIDA = 90;
/** A faixa do "trouxe a mais": 90% (1,645 desvios). */
const Z = 1.645;
export const LIMITE_PADRAO_POR_SEMANA = 3;
/** "Menos e-mails" na central de preferências: no máximo um a cada tantos dias. */
export const DIAS_DO_MENOS = 30;

const DIA = 86400000;
const somarDias = (dia: string, n: number): string => new Date(Date.parse(`${dia}T12:00:00Z`) + n * DIA).toISOString().slice(0, 10);
const diasEntre = (de: string, ate: string): number => Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / DIA);

/** Sorteia o grupo de comparação (embaralhamento de Fisher-Yates com o `aleatorio` dado). Com menos de MIN_PARA_COMPARAR pessoas, ou desligado, todo mundo recebe. */
export function sortearComparacao<T>(pessoas: T[], ligado: boolean, aleatorio: () => number, parte: number = PARTE_DA_COMPARACAO): { enviar: T[]; comparacao: T[] } {
  if (!ligado || pessoas.length < MIN_PARA_COMPARAR) return { enviar: [...pessoas], comparacao: [] };
  const v = [...pessoas];
  for (let i = v.length - 1; i > 0; i--) { const j = Math.floor(aleatorio() * (i + 1)); [v[i], v[j]] = [v[j], v[i]]; }
  const n = Math.max(1, Math.round(v.length * parte));
  return { comparacao: v.slice(0, n), enviar: v.slice(n) };
}

/** Quem já recebeu `limite` e-mails da loja nos últimos 7 dias fica de fora deste envio. */
export function porLimite<T extends { email: string }>(pessoas: T[], recebidosNaSemana: Map<string, number>, limite: number): { dentro: T[]; fora: number } {
  const dentro = pessoas.filter(p => (recebidosNaSemana.get(p.email) ?? 0) < limite);
  return { dentro, fora: pessoas.length - dentro.length };
}

export type Frequencia = "tudo" | "menos" | "parecidos";
export type Dias = "qualquer" | "fim_de_semana" | "semana";
export type Preferencia = { frequencia: Frequencia; dias: Dias };
/** O dia da sessão (0 = domingo) combina com a preferência de dias: fim de semana é de sexta a domingo; dias de semana, de segunda a quinta. */
export const diaCombina = (dias: Dias, diaDaSemana: number): boolean => dias === "qualquer" || (dias === "fim_de_semana" ? [5, 6, 0].includes(diaDaSemana) : [1, 2, 3, 4].includes(diaDaSemana));

/**
 * O que cada pessoa escolheu na central de preferências: "menos" fica de fora se recebeu um e-mail da loja nos últimos DIAS_DO_MENOS dias; "parecidos" só recebe se o evento do envio tem
 * público em comum com o que ela já comprou (`parecidos`: quem entra); e os dias têm de combinar com o dia da sessão. Sem preferência, recebe.
 */
export function porPreferencias<T extends { email: string }>(pessoas: T[], preferencias: Map<string, Preferencia>, c: { diaDaSemanaDaSessao: number; parecidos: Set<string>; ultimoRecebido: Map<string, string>; hoje: string }): { dentro: T[]; fora: number } {
  const dentro = pessoas.filter(p => {
    const pref = preferencias.get(p.email);
    if (!pref) return true;
    if (!diaCombina(pref.dias, c.diaDaSemanaDaSessao)) return false;
    if (pref.frequencia === "parecidos" && !c.parecidos.has(p.email)) return false;
    if (pref.frequencia === "menos") { const u = c.ultimoRecebido.get(p.email); if (u && diasEntre(u, c.hoje) < DIAS_DO_MENOS) return false; }
    return true;
  });
  return { dentro, fora: pessoas.length - dentro.length };
}

// ─── O que o envio trouxe a mais ─────────────────────────────────────────────

export type CompraDaPessoa = { email: string; dia: string; quantidade: number };
/** As compras de cada pessoa (dia e ingressos), em ordem. */
export function comprasPorPessoa(compras: CompraDaPessoa[]): Map<string, { dia: string; quantidade: number }[]> {
  const m = new Map<string, { dia: string; quantidade: number }[]>();
  for (const c of compras) { const e = c.email.trim().toLowerCase(); if (!e || c.quantidade <= 0) continue; (m.get(e) ?? m.set(e, []).get(e)!).push({ dia: c.dia, quantidade: c.quantidade }); }
  for (const v of m.values()) v.sort((a, b) => a.dia.localeCompare(b.dia));
  return m;
}
/** Os ingressos que a pessoa comprou do dia do envio até DIAS_DA_MEDIDA dias depois (ou até `ate`). */
const ingressosNaJanela = (compras: { dia: string; quantidade: number }[] | undefined, de: string, ate: string): number => (compras ?? []).filter(c => c.dia >= de && c.dia < ate).reduce((s, c) => s + c.quantidade, 0);

export type EfeitoDoEnvio =
  | { tipo: "sem_comparacao" }
  | { tipo: "medindo"; faltam: number }
  | { tipo: "efeito" | "sem_diferenca"; ingressos: number; baixo: number; alto: number };

const media = (v: number[]) => v.reduce((s, x) => s + x, 0) / Math.max(1, v.length);
const variancia = (v: number[]) => { const m = media(v); return v.length > 1 ? v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1) : 0; };
/** A diferença por pessoa entre dois grupos e a faixa de 90%, multiplicadas por `vezes`. */
function diferenca(a: number[], b: number[], vezes: number): { ingressos: number; baixo: number; alto: number } {
  const d = media(a) - media(b);
  const ep = Math.sqrt(variancia(a) / Math.max(1, a.length) + variancia(b) / Math.max(1, b.length));
  const um = (x: number) => Math.round(x * 10) / 10;
  return { ingressos: um(d * vezes), baixo: um((d - Z * ep) * vezes), alto: um((d + Z * ep) * vezes) };
}

/** O que um envio trouxe a mais: os ingressos de quem recebeu menos o que os do grupo de comparação compraram por pessoa, nos DIAS_DA_MEDIDA dias, com a faixa. */
export function efeitoDoEnvio(e: { dia: string; recebeu: string[]; comparacao: string[] }, compras: Map<string, { dia: string; quantidade: number }[]>, hoje: string): EfeitoDoEnvio {
  if (e.comparacao.length === 0) return { tipo: "sem_comparacao" };
  const fim = somarDias(e.dia, DIAS_DA_MEDIDA);
  if (hoje < fim) return { tipo: "medindo", faltam: diasEntre(hoje, fim) };
  const r = diferenca(e.recebeu.map(x => ingressosNaJanela(compras.get(x), e.dia, fim)), e.comparacao.map(x => ingressosNaJanela(compras.get(x), e.dia, fim)), e.recebeu.length);
  return { tipo: r.baixo > 0 ? "efeito" : "sem_diferenca", ...{ ingressos: Math.round(r.ingressos), baixo: Math.round(r.baixo), alto: Math.round(r.alto) } };
}
/** Os ingressos que quem recebeu comprou nos DIAS_DA_MEDIDA dias depois do envio (ou até hoje): inclui quem compraria de qualquer jeito. */
export const ingressosDeQuemRecebeu = (dia: string, recebeu: string[], compras: Map<string, { dia: string; quantidade: number }[]>): number => recebeu.reduce((s, x) => s + ingressosNaJanela(compras.get(x), dia, somarDias(dia, DIAS_DA_MEDIDA)), 0);

// ─── Para quem o e-mail funciona na casa ─────────────────────────────────────

export type TipoDePublico = "recente" | "ano" | "antigo" | "nunca";
export const TIPOS_DE_PUBLICO: TipoDePublico[] = ["recente", "ano", "antigo", "nunca"];
export const ROTULO_DO_TIPO: Record<TipoDePublico, string> = { recente: "Compraram nos últimos 3 meses", ano: "Compraram de 3 a 12 meses atrás", antigo: "Compraram há mais de 1 ano", nunca: "Nunca compraram (só contato)" };
/** O tipo da pessoa no dia: pela última compra ANTES do dia (até 90 dias: recente; até 365: no ano; mais: antigo; nenhuma: nunca). */
export function tipoNoDia(compras: { dia: string }[] | undefined, dia: string): TipoDePublico {
  const antes = (compras ?? []).filter(c => c.dia < dia).at(-1);
  if (!antes) return "nunca";
  const d = diasEntre(antes.dia, dia);
  return d <= 90 ? "recente" : d <= 365 ? "ano" : "antigo";
}

export type EfeitoPorTipo = { tipo: TipoDePublico; pessoas: number; porCem: number; baixo: number; alto: number; pesa: boolean };
/**
 * Somando os envios já medidos (com comparação e DIAS_DA_MEDIDA dias passados): para cada tipo de público, os ingressos a mais a cada 100 e-mails (a diferença por pessoa entre quem
 * recebeu e quem ficou de fora, vezes 100), com a faixa de 90%. "Pesa" quando a faixa fica acima de zero.
 */
export function efeitoPorTipo(envios: { dia: string; recebeu: string[]; comparacao: string[] }[], compras: Map<string, { dia: string; quantidade: number }[]>, hoje: string): { tipos: EfeitoPorTipo[]; envios: number } {
  const grupos = new Map<TipoDePublico, { r: number[]; c: number[]; pessoas: Set<string> }>(TIPOS_DE_PUBLICO.map(t => [t, { r: [], c: [], pessoas: new Set() }]));
  let medidos = 0;
  for (const e of envios) {
    const fim = somarDias(e.dia, DIAS_DA_MEDIDA);
    if (e.comparacao.length === 0 || hoje < fim) continue;
    medidos++;
    for (const [lista, lado] of [[e.recebeu, "r"], [e.comparacao, "c"]] as const) {
      for (const x of lista) {
        const g = grupos.get(tipoNoDia(compras.get(x), e.dia))!;
        g[lado].push(ingressosNaJanela(compras.get(x), e.dia, fim));
        if (lado === "r") g.pessoas.add(x);
      }
    }
  }
  const tipos = TIPOS_DE_PUBLICO.map(t => {
    const g = grupos.get(t)!;
    if (g.r.length === 0 || g.c.length === 0) return { tipo: t, pessoas: g.pessoas.size, porCem: 0, baixo: 0, alto: 0, pesa: false };
    const d = diferenca(g.r, g.c, 100);
    return { tipo: t, pessoas: g.pessoas.size, porCem: d.ingressos, baixo: d.baixo, alto: d.alto, pesa: d.baixo > 0 };
  });
  return { tipos, envios: medidos };
}

/**
 * E se os envios tivessem ido só para quem comprou no último ano? A parte do efeito que viria dos tipos "recente" e "ano" e quantos e-mails a menos (os "antigo" e "nunca"), com o próprio
 * efeito medido (avaliar uma política com os grupos já sorteados: Hitsch, Misra e Zhang). Null se o efeito total não é positivo ou se os dois tipos do último ano não pesam.
 */
export function soUltimoAno(tipos: EfeitoPorTipo[], recebimentos: Record<TipoDePublico, number>): { parteDoEfeito: number; menosEmails: number } | null {
  const efeito = (t: TipoDePublico) => (tipos.find(x => x.tipo === t)?.porCem ?? 0) * (recebimentos[t] ?? 0) / 100;
  const total = TIPOS_DE_PUBLICO.reduce((s, t) => s + efeito(t), 0);
  const doAno = efeito("recente") + efeito("ano");
  const todos = TIPOS_DE_PUBLICO.reduce((s, t) => s + (recebimentos[t] ?? 0), 0);
  if (total <= 0 || todos === 0 || !tipos.some(t => (t.tipo === "recente" || t.tipo === "ano") && t.pesa)) return null;
  if (tipos.some(t => (t.tipo === "antigo" || t.tipo === "nunca") && t.pesa)) return null; // quem sumiu também responde: cortar não vale
  return { parteDoEfeito: Math.min(1, Math.round((doAno / total) * 100) / 100), menosEmails: Math.round(((recebimentos.antigo + recebimentos.nunca) / todos) * 100) / 100 };
}
/** Quem comprou no último ano (até 365 dias antes de `hoje`): o "Mandar só para elas" do novo envio. */
export const compraramNoUltimoAno = (email: string, compras: Map<string, { dia: string }[]>, hoje: string): boolean => { const t = tipoNoDia(compras.get(email), somarDias(hoje, 1)); return t === "recente" || t === "ano"; };
