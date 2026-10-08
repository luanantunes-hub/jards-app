import { lerValorBRL } from "@/lib/valor";

export type Corpo = Record<string, unknown>;

/** Erro que vira resposta JSON com o status certo. O texto vai para o assistente corrigir a chamada. */
export class ErroMcp extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly extra: Record<string, unknown> = {}
  ) {
    super(message);
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATA_HORA_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;
const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const EMAIL_RE = /^\S+@\S+\.\S+$/;

export function ausente(valor: unknown): boolean {
  return valor === undefined || valor === null || (typeof valor === "string" && valor.trim() === "");
}

function falta(campo: string): never {
  throw new ErroMcp(400, `Informe ${campo}.`);
}

export function texto(corpo: Corpo, campo: string, { max = 500, obrigatorio = false }: { max?: number; obrigatorio?: boolean } = {}): string | null {
  const valor = corpo[campo];
  if (ausente(valor)) return obrigatorio ? falta(campo) : null;
  if (typeof valor !== "string") throw new ErroMcp(400, `${campo} deve ser texto.`);
  const limpo = valor.trim();
  if (limpo.length > max) throw new ErroMcp(400, `${campo} passa de ${max} caracteres.`);
  return limpo;
}

export function email(corpo: Corpo, campo: string): string | null {
  const valor = texto(corpo, campo, { max: 200 });
  if (valor !== null && !EMAIL_RE.test(valor)) throw new ErroMcp(400, `${campo} não parece um e-mail válido.`);
  return valor;
}

export function opcao<T extends string>(corpo: Corpo, campo: string, permitidas: readonly T[], obrigatorio = false): T | null {
  const valor = corpo[campo];
  if (ausente(valor)) return obrigatorio ? falta(campo) : null;
  if (typeof valor !== "string" || !(permitidas as readonly string[]).includes(valor)) {
    throw new ErroMcp(400, `${campo} deve ser um destes: ${permitidas.join(", ")}.`);
  }
  return valor as T;
}

/** Aceita número ou texto como "150.000,00" (o assistente costuma mandar o que a pessoa escreveu). */
export function numero(corpo: Corpo, campo: string, { min, max, obrigatorio = false }: { min?: number; max?: number; obrigatorio?: boolean } = {}): number | null {
  const valor = corpo[campo];
  if (ausente(valor)) return obrigatorio ? falta(campo) : null;
  let lido: number;
  if (typeof valor === "number") lido = valor;
  else if (typeof valor === "string") {
    const texto = lerValorBRL(valor);
    if (!texto.valido || texto.valor === null) throw new ErroMcp(400, `${campo} deve ser um número, como 150000 ou 150.000,00.`);
    lido = texto.valor;
  } else throw new ErroMcp(400, `${campo} deve ser um número.`);
  if (!Number.isFinite(lido)) throw new ErroMcp(400, `${campo} deve ser um número.`);
  if (min !== undefined && lido < min) throw new ErroMcp(400, `${campo} deve ser no mínimo ${min}.`);
  if (max !== undefined && lido > max) throw new ErroMcp(400, `${campo} deve ser no máximo ${max}.`);
  return lido;
}

export function inteiro(corpo: Corpo, campo: string, limites: { min?: number; max?: number } = {}): number | null {
  const valor = numero(corpo, campo, limites);
  if (valor !== null && !Number.isInteger(valor)) throw new ErroMcp(400, `${campo} deve ser um número inteiro.`);
  return valor;
}

export function booleano(corpo: Corpo, campo: string): boolean | null {
  const valor = corpo[campo];
  if (ausente(valor)) return null;
  if (typeof valor === "boolean") return valor;
  if (valor === "true") return true;
  if (valor === "false") return false;
  throw new ErroMcp(400, `${campo} deve ser verdadeiro ou falso.`);
}

export function uuidDe(corpo: Corpo, campo: string, obrigatorio = false): string | null {
  const valor = corpo[campo];
  if (ausente(valor)) return obrigatorio ? falta(campo) : null;
  if (typeof valor !== "string" || !UUID_RE.test(valor.trim())) throw new ErroMcp(400, `${campo} deve ser um UUID válido.`);
  return valor.trim().toLowerCase();
}

function dataExiste(dia: string): boolean {
  const data = new Date(`${dia}T00:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === dia;
}

/** Dia (AAAA-MM-DD) ou dia e hora (AAAA-MM-DDTHH:MM). Devolve o texto como veio, já conferido. */
export function dataDe(corpo: Corpo, campo: string, obrigatorio = false): string | null {
  const valor = corpo[campo];
  if (ausente(valor)) return obrigatorio ? falta(campo) : null;
  const dica = `${campo} deve ser uma data no formato AAAA-MM-DD (ou AAAA-MM-DDTHH:MM).`;
  if (typeof valor !== "string") throw new ErroMcp(400, dica);
  const limpo = valor.trim();
  if (DATA_RE.test(limpo)) {
    if (!dataExiste(limpo)) throw new ErroMcp(400, `${campo}: essa data não existe.`);
    return limpo;
  }
  if (DATA_HORA_RE.test(limpo) && !Number.isNaN(new Date(limpo).getTime()) && dataExiste(limpo.slice(0, 10))) return limpo;
  throw new ErroMcp(400, dica);
}

export function soDia(valor: string): boolean {
  return DATA_RE.test(valor);
}

/**
 * Data ou data e hora do pedido como instante ISO. Dia sem hora vale meio-dia e hora sem fuso vale o horário de
 * Brasília: é como a pessoa digita no app (o servidor roda em UTC e erraria o dia).
 */
export function paraInstante(valor: string): string {
  const completo = soDia(valor)
    ? `${valor}T12:00:00-03:00`
    : /(Z|[+-]\d{2}:?\d{2})$/.test(valor)
      ? valor
      : `${valor.length === 16 ? `${valor}:00` : valor}-03:00`;
  return new Date(completo).toISOString();
}

const HORARIO_DE_BRASILIA = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/**
 * Dia e hora (HH:MM) no horário de Brasília de um valor já conferido por dataDe. Dia puro não tem hora; hora sem
 * fuso já é a de Brasília; com Z ou deslocamento é convertida. O app guarda o dia e a hora das atividades em
 * colunas separadas, então o dia nunca pode andar por causa do fuso.
 */
export function diaEHoraEmBrasilia(valor: string | null): { dia: string; hora: string | null } | null {
  if (valor === null) return null;
  if (soDia(valor)) return { dia: valor, hora: null };
  if (!/(Z|[+-]\d{2}:?\d{2})$/.test(valor)) return { dia: valor.slice(0, 10), hora: valor.slice(11, 16) };
  const partes = Object.fromEntries(HORARIO_DE_BRASILIA.formatToParts(new Date(valor)).map((parte) => [parte.type, parte.value]));
  return { dia: `${partes.year}-${partes.month}-${partes.day}`, hora: `${partes.hour}:${partes.minute}` };
}

/** Dia seguinte (AAAA-MM-DD) a um dia dado, para filtros "até o fim do dia". */
export function diaSeguinte(dia: string): string {
  const data = new Date(`${dia}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() + 1);
  return data.toISOString().slice(0, 10);
}

export function horaDe(corpo: Corpo, campo: string): string | null {
  const valor = corpo[campo];
  if (ausente(valor)) return null;
  if (typeof valor !== "string" || !HORA_RE.test(valor.trim())) throw new ErroMcp(400, `${campo} deve ser uma hora no formato HH:MM.`);
  return valor.trim();
}

/** Lista de textos: aceita uma lista ou um texto separado por vírgulas. */
export function listaDeTextos(corpo: Corpo, campo: string, { maxItens = 30, max = 80 }: { maxItens?: number; max?: number } = {}): string[] | null {
  const valor = corpo[campo];
  if (ausente(valor)) return null;
  const itens = Array.isArray(valor) ? valor : typeof valor === "string" ? valor.split(",") : null;
  if (!itens) throw new ErroMcp(400, `${campo} deve ser uma lista de textos.`);
  const limpos = itens.map((item) => {
    if (typeof item !== "string") throw new ErroMcp(400, `${campo} deve ter só textos.`);
    return item.trim();
  }).filter(Boolean);
  if (limpos.length > maxItens) throw new ErroMcp(400, `${campo} aceita até ${maxItens} itens.`);
  if (limpos.some((item) => item.length > max)) throw new ErroMcp(400, `Cada item de ${campo} aceita até ${max} caracteres.`);
  return [...new Set(limpos)];
}

/** Tira o que quebraria um filtro do PostgREST (vírgula, parênteses, aspas, curingas) e deixa só o termo. */
export function termoDeBusca(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const limpo = valor.replace(/[,()"'\\%_*]/g, " ").replace(/\s+/g, " ").trim();
  return limpo ? limpo.slice(0, 120) : null;
}

/** Trecho de um nome que dá para usar num "contém": o maior pedaço sem os caracteres que o filtro não aceita. */
export function trechoParaBusca(nome: string): string {
  const pedacos = nome.split(/[,()"'\\%_*]/).map((pedaco) => pedaco.trim()).filter(Boolean);
  const maior = pedacos.sort((a, b) => b.length - a.length)[0] ?? nome.trim();
  return maior.slice(0, 60);
}

/** Igualdade sem diferenciar maiúsculas, para usar com ilike: escapa os curingas do LIKE. */
export function igualSemCaixa(valor: string): string {
  return valor.replace(/[\\%_]/g, "\\$&");
}

export function paginacao(query: URLSearchParams): { limite: number; deslocamento: number } {
  const limite = Math.min(Math.max(Math.trunc(Number(query.get("limite") ?? 20)) || 20, 1), 100);
  const deslocamento = Math.max(Math.trunc(Number(query.get("deslocamento") ?? 0)) || 0, 0);
  return { limite, deslocamento };
}

export function paramOpcao<T extends string>(query: URLSearchParams, campo: string, permitidas: readonly T[]): T | null {
  const valor = query.get(campo);
  if (valor === null || valor === "") return null;
  if (!(permitidas as readonly string[]).includes(valor)) throw new ErroMcp(400, `${campo} deve ser um destes: ${permitidas.join(", ")}.`);
  return valor as T;
}

export function paramUuid(query: URLSearchParams, campo: string): string | null {
  const valor = query.get(campo);
  if (valor === null || valor === "") return null;
  if (!UUID_RE.test(valor.trim())) throw new ErroMcp(400, `${campo} deve ser um UUID válido.`);
  return valor.trim().toLowerCase();
}

export function paramData(query: URLSearchParams, campo: string): string | null {
  const valor = query.get(campo);
  if (valor === null || valor === "") return null;
  return dataDe({ [campo]: valor }, campo);
}

export function paramBooleano(query: URLSearchParams, campo: string): boolean {
  return query.get(campo) === "true";
}

/** Traduz o erro do banco em resposta que o assistente entende (nunca devolve texto interno cru). */
export function erroDoBanco(erro: { message?: string; code?: string } | null | undefined): ErroMcp {
  const mensagem = erro?.message ?? "Erro ao gravar.";
  if (/RATE_LIMIT/.test(mensagem)) return new ErroMcp(429, "Limite de criação da organização atingido. Aguarde 1 minuto.");
  if (/Limite do plano gratuito/.test(mensagem)) return new ErroMcp(402, `${mensagem} Veja os planos em /meu-plano.`);
  switch (erro?.code) {
    case "23503":
      return new ErroMcp(400, "Um dos ids informados não existe.");
    case "23502":
      return new ErroMcp(400, "Falta um campo obrigatório.");
    case "23505":
      return new ErroMcp(409, "Já existe um registro igual.");
    case "23514":
      return new ErroMcp(400, `Algum valor não é aceito: ${mensagem}`);
    case "22023":
    case "22P02":
      return new ErroMcp(400, mensagem);
    case "42501":
      return new ErroMcp(403, mensagem);
    case "P0002":
      return new ErroMcp(404, mensagem);
    default:
      return new ErroMcp(500, "Não foi possível concluir. Tente de novo em instantes.");
  }
}
