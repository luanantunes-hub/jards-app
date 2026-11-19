// Locais, setores, eventos e sessões da Ticketeria (T2 do plano em docs/acoes-futuras/estudos/plano-modulo-ticketeria.md): a
// leitura do que a pessoa digita, as horas no fuso do local e as frases da tela. Sem tela e sem banco.
//
// As horas das sessões ficam gravadas com fuso (timestamptz). O que a pessoa digita ("05/12, 20:00") é a hora do LOCAL, no fuso
// dele; a tela converte com `instanteNoFuso` e mostra de volta com `partesNoFuso`. O Brasil não tem horário de verão hoje, mas as
// contas usam o fuso de verdade (Intl), então seguem certas se ele voltar.

import type { ClassificacaoIndicativa, SituacaoDoEvento } from "@/lib/ticketeria/estados";
import { lerUrlHttps } from "@/lib/ticketeria/site";

export const ROTULO_DA_SITUACAO_DO_EVENTO: Record<SituacaoDoEvento, string> = { rascunho: "Rascunho", publicado: "Publicado", cancelado: "Cancelado" };

export const ROTULO_DA_CLASSIFICACAO: Record<ClassificacaoIndicativa, string> = {
  livre: "Livre", 10: "10 anos", 12: "12 anos", 14: "14 anos", 16: "16 anos", 18: "18 anos",
};

export const UFS = ["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"] as const;

/** Os fusos do Brasil, com o nome que a pessoa reconhece. */
export const FUSOS_DO_BRASIL: readonly { id: string; rotulo: string; curto: string }[] = [
  { id: "America/Sao_Paulo", rotulo: "Horário de Brasília", curto: "horário de Brasília" },
  { id: "America/Manaus", rotulo: "Amazonas, Mato Grosso, Rondônia e Roraima (1 hora a menos)", curto: "horário do Amazonas" },
  { id: "America/Rio_Branco", rotulo: "Acre (2 horas a menos)", curto: "horário do Acre" },
  { id: "America/Noronha", rotulo: "Fernando de Noronha (1 hora a mais)", curto: "horário de Noronha" },
];

const texto = (valor: string | null | undefined) => (valor ?? "").trim();
const opcional = (valor: string | null | undefined) => (texto(valor) === "" ? null : texto(valor));

// ─── Local e setor ──────────────────────────────────────────────────────────

export type LeituraDoLocal =
  | { ok: true; valor: { nome: string; endereco: string | null; cidade: string | null; uf: string | null; fuso: string } }
  | { ok: false; erro: string; campo: string };

export function lerLocal(campos: { nome: string; endereco: string; cidade: string; uf: string; fuso: string }): LeituraDoLocal {
  const nome = texto(campos.nome);
  if (nome === "" || nome.length > 200) return { ok: false, erro: "Dê um nome ao local (até 200 letras).", campo: "nome" };
  const endereco = opcional(campos.endereco);
  if (endereco && endereco.length > 300) return { ok: false, erro: "O endereço pode ter até 300 letras.", campo: "endereco" };
  const cidade = opcional(campos.cidade);
  if (cidade && cidade.length > 120) return { ok: false, erro: "A cidade pode ter até 120 letras.", campo: "cidade" };
  const uf = opcional(campos.uf)?.toUpperCase() ?? null;
  if (uf && !(UFS as readonly string[]).includes(uf)) return { ok: false, erro: "Escolha o estado.", campo: "uf" };
  const fuso = texto(campos.fuso) || "America/Sao_Paulo";
  if (!FUSOS_DO_BRASIL.some(item => item.id === fuso)) return { ok: false, erro: "Escolha o fuso horário.", campo: "fuso" };
  return { ok: true, valor: { nome, endereco, cidade, uf, fuso } };
}

export type LeituraDoSetor = { ok: true; valor: { nome: string; lugares: number } } | { ok: false; erro: string; campo: string };

export function lerSetor(campos: { nome: string; lugares: string }): LeituraDoSetor {
  const nome = texto(campos.nome);
  if (nome === "" || nome.length > 120) return { ok: false, erro: "Dê um nome ao setor (até 120 letras), como Plateia ou Pista.", campo: "nome" };
  const bruto = texto(campos.lugares).replace(/\./g, "");
  const lugares = /^\d+$/.test(bruto) ? Number(bruto) : Number.NaN;
  if (!Number.isInteger(lugares) || lugares < 1 || lugares > 200000) return { ok: false, erro: "Os lugares vão de 1 a 200.000.", campo: "lugares" };
  return { ok: true, valor: { nome, lugares } };
}

/** A capacidade do local: a soma dos setores em uso. */
export function capacidadeDoLocal(setores: readonly { lugares: number; arquivado: boolean }[]): number {
  return setores.reduce((soma, setor) => soma + (setor.arquivado ? 0 : setor.lugares), 0);
}

// ─── Evento ─────────────────────────────────────────────────────────────────

export type LeituraDoEvento =
  | { ok: true; valor: { titulo: string; descricao: string | null; imagem_url: string | null; classificacao: ClassificacaoIndicativa | null } }
  | { ok: false; erro: string; campo: string };

export function lerEvento(campos: { titulo: string; descricao: string; imagem: string; classificacao: string }): LeituraDoEvento {
  const titulo = texto(campos.titulo);
  if (titulo === "" || titulo.length > 200) return { ok: false, erro: "Dê um título ao evento (até 200 letras).", campo: "titulo" };
  const descricao = opcional(campos.descricao);
  if (descricao && descricao.length > 5000) return { ok: false, erro: "A descrição pode ter até 5.000 letras.", campo: "descricao" };
  let imagem_url: string | null = null;
  if (texto(campos.imagem) !== "") {
    const url = lerUrlHttps(campos.imagem);
    if (!url.ok) return { ok: false, erro: "O endereço da imagem tem de começar com https://.", campo: "imagem" };
    imagem_url = url.url;
  }
  const bruta = texto(campos.classificacao);
  if (bruta !== "" && !(bruta in ROTULO_DA_CLASSIFICACAO)) return { ok: false, erro: "Escolha a classificação indicativa.", campo: "classificacao" };
  return { ok: true, valor: { titulo, descricao, imagem_url, classificacao: bruta === "" ? null : (bruta as ClassificacaoIndicativa) } };
}

// ─── Horas no fuso do local ─────────────────────────────────────────────────

const FORMATOS = new Map<string, Intl.DateTimeFormat>();
function formatoDe(fuso: string): Intl.DateTimeFormat {
  let formato = FORMATOS.get(fuso);
  if (!formato) {
    formato = new Intl.DateTimeFormat("en-US", { timeZone: fuso, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    FORMATOS.set(fuso, formato);
  }
  return formato;
}

function partes(instante: number, fuso: string): Record<string, number> {
  return Object.fromEntries(formatoDe(fuso).formatToParts(new Date(instante)).filter(p => p.type !== "literal").map(p => [p.type, Number(p.value)]));
}

/** Quantos minutos o fuso está à frente do UTC naquele instante (Brasília: -180). */
function deslocamento(instante: number, fuso: string): number {
  const p = partes(instante, fuso);
  return (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(instante / 1000) * 1000) / 60000;
}

const DIA = /^(\d{4})-(\d{2})-(\d{2})$/;
const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** O instante (ISO, em UTC) de um dia e uma hora digitados no fuso do local; null se o dia ou a hora não existem. */
export function instanteNoFuso(dia: string, hora: string, fuso: string): string | null {
  const d = DIA.exec(dia), h = HORA.exec(hora);
  if (!d || !h) return null;
  const [ano, mes, diaDoMes] = [Number(d[1]), Number(d[2]), Number(d[3])];
  const comoUtc = Date.UTC(ano, mes - 1, diaDoMes, Number(h[1]), Number(h[2]));
  const data = new Date(comoUtc);
  if (data.getUTCFullYear() !== ano || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== diaDoMes) return null;
  let instante = comoUtc - deslocamento(comoUtc, fuso) * 60000;
  instante = comoUtc - deslocamento(instante, fuso) * 60000; // de novo, para a virada de horário de verão
  return new Date(instante).toISOString();
}

/** O dia ("AAAA-MM-DD") e a hora ("HH:MM") de um instante, no fuso do local. */
export function partesNoFuso(iso: string, fuso: string): { dia: string; hora: string } {
  const p = partes(new Date(iso).getTime(), fuso);
  const dois = (n: number) => String(n).padStart(2, "0");
  return { dia: `${p.year}-${dois(p.month)}-${dois(p.day)}`, hora: `${dois(p.hour)}:${dois(p.minute)}` };
}

const somarDias = (dia: string, dias: number) => new Date(Date.parse(`${dia}T00:00:00Z`) + dias * 86400000).toISOString().slice(0, 10);

export type LeituraDaSessao =
  | { ok: true; valor: { inicio: string; fim: string | null; abertura_portas: string | null } }
  | { ok: false; erro: string; campo: string };

/**
 * A sessão como a pessoa digita: o dia e a hora do início, e, se quiser, a hora do fim e a da abertura das portas, no fuso do
 * local. O fim antes do início passa da meia-noite (termina no dia seguinte); a abertura das portas depois do início é do dia
 * anterior. As portas abrem no máximo 12 horas antes.
 */
export function lerSessao(campos: { dia: string; hora: string; fim: string; portas: string }, fuso: string): LeituraDaSessao {
  if (!DIA.test(texto(campos.dia))) return { ok: false, erro: "Escolha o dia da sessão.", campo: "dia" };
  if (!HORA.test(texto(campos.hora))) return { ok: false, erro: "Escreva a hora do início, como 20:00.", campo: "hora" };
  const dia = texto(campos.dia), hora = texto(campos.hora);
  const inicio = instanteNoFuso(dia, hora, fuso);
  if (!inicio) return { ok: false, erro: "Esse dia não existe.", campo: "dia" };
  let fim: string | null = null;
  if (texto(campos.fim) !== "") {
    if (!HORA.test(texto(campos.fim))) return { ok: false, erro: "Escreva a hora do fim, como 22:00.", campo: "fim" };
    if (texto(campos.fim) === hora) return { ok: false, erro: "O fim tem de ser depois do início.", campo: "fim" };
    fim = instanteNoFuso(texto(campos.fim) < hora ? somarDias(dia, 1) : dia, texto(campos.fim), fuso);
  }
  let abertura_portas: string | null = null;
  if (texto(campos.portas) !== "") {
    if (!HORA.test(texto(campos.portas))) return { ok: false, erro: "Escreva a hora em que as portas abrem, como 19:00.", campo: "portas" };
    abertura_portas = instanteNoFuso(texto(campos.portas) > hora ? somarDias(dia, -1) : dia, texto(campos.portas), fuso);
    if (abertura_portas && Date.parse(inicio) - Date.parse(abertura_portas) > 12 * 3600000) return { ok: false, erro: "As portas abrem no máximo 12 horas antes do início.", campo: "portas" };
  }
  return { ok: true, valor: { inicio, fim, abertura_portas } };
}

// ─── Situação e frases ──────────────────────────────────────────────────────

export type SituacaoDaSessao = "cancelada" | "realizada" | "agendada";

/** A sessão cancelada, a que já aconteceu (passou do fim, ou do início quando não tem fim) e a que está por vir. */
export function situacaoDaSessao(sessao: { inicio: string; fim: string | null; cancelada_em: string | null }, agora: number = Date.now()): SituacaoDaSessao {
  if (sessao.cancelada_em) return "cancelada";
  return Date.parse(sessao.fim ?? sessao.inicio) < agora ? "realizada" : "agendada";
}

const DIA_POR_EXTENSO = new Map<string, Intl.DateTimeFormat>();
/** "sáb., 5 de dez. de 2026 · 20:00", no fuso do local. */
export function quandoDaSessao(iso: string, fuso: string): string {
  let formato = DIA_POR_EXTENSO.get(fuso);
  if (!formato) {
    formato = new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, weekday: "short", day: "numeric", month: "short", year: "numeric" });
    DIA_POR_EXTENSO.set(fuso, formato);
  }
  return `${formato.format(new Date(iso))} · ${partesNoFuso(iso, fuso).hora}`;
}

/** A próxima sessão por vir (não cancelada), ou null. */
export function proximaSessao<T extends { inicio: string; fim: string | null; cancelada_em: string | null }>(sessoes: readonly T[], agora: number = Date.now()): T | null {
  return [...sessoes].filter(sessao => situacaoDaSessao(sessao, agora) === "agendada").sort((a, b) => a.inicio.localeCompare(b.inicio))[0] ?? null;
}

/** O erro do banco numa frase. */
export function mensagemDoErroDoEvento(erro: { code?: string; message?: string }): string {
  const m = erro.message ?? "";
  if (erro.code === "42501") return "Você não pode mudar a Ticketeria desta organização.";
  if (m.includes("local_arquivado")) return "Esse local está arquivado. Escolha outro ou tire-o do arquivo.";
  if (m.includes("evento_cancelado")) return "O evento está cancelado e não muda mais.";
  if (m.includes("evento_publicado")) return "Evento publicado não se apaga: cancele-o.";
  if (m.includes("sessao_de_evento_publicado")) return "Sessão de evento publicado não se apaga: cancele-a.";
  if (m.includes("ticketeria_sessoes_local_id_fkey")) return "Esse local tem sessões e não se apaga: arquive-o.";
  if (m.includes("ticketeria_setores_nome_key")) return "Já existe um setor com esse nome neste local.";
  return "Não foi possível salvar. Tente de novo.";
}
