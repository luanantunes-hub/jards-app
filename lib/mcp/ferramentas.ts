import { construirSpecOpenApi } from "@/lib/mcp/openapi";
import { MODULOS_MCP, MODULO_PADRAO, type ModuloMcp } from "@/lib/mcp/modulos";
import { lerValorBRL } from "@/lib/valor";

interface EsquemaJson {
  type?: string;
  format?: string;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  maxItems?: number;
  default?: unknown;
  description?: string;
  items?: EsquemaJson;
  properties?: Record<string, EsquemaJson>;
  required?: string[];
}

interface ParametroOpenApi {
  name: string;
  in: "query" | "path";
  required?: boolean;
  schema: EsquemaJson;
  description?: string;
}

interface OperacaoOpenApi {
  operationId: string;
  summary: string;
  description?: string;
  parameters?: ParametroOpenApi[];
  requestBody?: { content: { "application/json": { schema: { properties: Record<string, EsquemaJson>; required?: string[] } } } };
}

export interface Ferramenta {
  /** Nome da ferramenta no MCP: o operationId da spec em snake_case. */
  nome: string;
  operationId: string;
  /** Módulo da spec de onde a ferramenta vem: só aparece para quem autorizou esse módulo. */
  modulo: ModuloMcp;
  metodo: "GET" | "POST";
  /** Caminho relativo a /api/mcp, ex.: "/projetos/{id}". */
  caminho: string;
  titulo: string;
  descricao: string;
  inputSchema: {
    type: "object";
    properties: Record<string, EsquemaJson>;
    required: string[];
    additionalProperties: false;
  };
  parametrosDeCaminho: string[];
  /** Só consulta, sem efeito nenhum: o cliente pode chamar sem pedir confirmação. */
  somenteLeitura: boolean;
  /** Cria registros: só aparece para quem autorizou o acesso de escrita (mesma regra das rotas, requireWriteScope). */
  exigeEscrita: boolean;
}

export function paraSnakeCase(operationId: string): string {
  return operationId.replace(/[A-Z]/g, (letra) => `_${letra.toLowerCase()}`);
}

/** Uma ferramenta por operação das specs OpenAPI (uma por módulo): o que o ChatGPT vê e o que o Claude vê nunca divergem. */
export function construirFerramentas(): Ferramenta[] {
  const ferramentas: Ferramenta[] = [];

  for (const modulo of MODULOS_MCP) {
    const caminhos = construirSpecOpenApi("http://localhost", modulo).paths as unknown as Record<string, Record<string, OperacaoOpenApi>>;

    for (const [caminho, operacoes] of Object.entries(caminhos)) {
      for (const [metodo, operacao] of Object.entries(operacoes)) {
        const properties: Record<string, EsquemaJson> = {};
        const required: string[] = [];
        const parametrosDeCaminho: string[] = [];

        for (const parametro of operacao.parameters ?? []) {
          properties[parametro.name] = { ...parametro.schema, ...(parametro.description ? { description: parametro.description } : {}) };
          if (parametro.required) required.push(parametro.name);
          if (parametro.in === "path") parametrosDeCaminho.push(parametro.name);
        }

        const corpo = operacao.requestBody?.content["application/json"].schema;
        if (corpo) {
          Object.assign(properties, corpo.properties);
          required.push(...(corpo.required ?? []));
        }

        const exigeEscrita = metodo !== "get";
        ferramentas.push({
          nome: paraSnakeCase(operacao.operationId),
          operationId: operacao.operationId,
          modulo,
          metodo: metodo.toUpperCase() as "GET" | "POST",
          caminho,
          titulo: operacao.summary,
          descricao: operacao.description ?? operacao.summary,
          inputSchema: { type: "object", properties, required, additionalProperties: false },
          parametrosDeCaminho,
          somenteLeitura: !exigeEscrita,
          exigeEscrita,
        });
      }
    }
  }

  const repetidas = ferramentas.map((f) => f.operationId).filter((id, i, todas) => todas.indexOf(id) !== i);
  if (repetidas.length > 0) throw new Error(`operationId repetido entre módulos: ${[...new Set(repetidas)].join(", ")}`);
  return ferramentas;
}

export const FERRAMENTAS: readonly Ferramenta[] = construirFerramentas();

/** As ferramentas que a chave pode usar: o escopo decide se grava; os módulos, de que parte do Jards ela fala (padrão: só a captação). */
export function ferramentasDoEscopo(escopo: "read" | "write", modulos: readonly ModuloMcp[] = [MODULO_PADRAO]): readonly Ferramenta[] {
  return FERRAMENTAS.filter((f) => modulos.includes(f.modulo) && (escopo === "write" || !f.exigeEscrita));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Clientes de IA às vezes mandam número ou booleano como texto: aceita e converte antes de validar. */
export function normalizarArgumentos(ferramenta: Ferramenta, argumentos: Record<string, unknown>): Record<string, unknown> {
  const saida: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(argumentos)) {
    const tipo = ferramenta.inputSchema.properties[chave]?.type;
    if (tipo === "integer" && typeof valor === "string" && /^-?\d+$/.test(valor.trim())) saida[chave] = Number(valor);
    else if (tipo === "number" && typeof valor === "string" && lerValorBRL(valor).valor !== null) saida[chave] = lerValorBRL(valor).valor;
    else if (tipo === "boolean" && (valor === "true" || valor === "false")) saida[chave] = valor === "true";
    else if (tipo === "array" && typeof valor === "string") saida[chave] = lerListaEmTexto(valor, ferramenta.inputSchema.properties[chave]?.items?.type);
    else saida[chave] = valor;
  }
  return saida;
}

/** Lista que chegou como texto: de objetos vem como JSON; de textos, separada por vírgula. */
function lerListaEmTexto(valor: string, tipoDoItem: string | undefined): unknown {
  if (tipoDoItem === "object") {
    try {
      const lido: unknown = JSON.parse(valor);
      if (Array.isArray(lido)) return lido;
    } catch {
      // cai no valor original: a validação explica o erro
    }
    return valor;
  }
  return valor.split(",").map((item) => item.trim()).filter(Boolean);
}

/** Devolve a mensagem de erro (em português, para o modelo corrigir a chamada) ou null se estiver tudo certo. */
export function validarArgumentos(ferramenta: Ferramenta, argumentos: Record<string, unknown>): string | null {
  const { properties, required } = ferramenta.inputSchema;

  for (const chave of Object.keys(argumentos)) {
    if (!(chave in properties)) return `Parâmetro desconhecido: ${chave}. Aceitos: ${Object.keys(properties).join(", ") || "nenhum"}.`;
  }
  for (const chave of required) {
    if (argumentos[chave] === undefined || argumentos[chave] === null || argumentos[chave] === "") return `Parâmetro obrigatório ausente: ${chave}.`;
  }

  for (const [chave, valor] of Object.entries(argumentos)) {
    if (valor === undefined || valor === null) continue;
    const esquema = properties[chave];
    if (esquema.type === "string" && typeof valor !== "string") return `${chave} deve ser texto.`;
    if (esquema.type === "boolean" && typeof valor !== "boolean") return `${chave} deve ser verdadeiro ou falso.`;
    if (esquema.type === "integer") {
      if (typeof valor !== "number" || !Number.isInteger(valor)) return `${chave} deve ser um número inteiro.`;
      if (esquema.minimum !== undefined && valor < esquema.minimum) return `${chave} deve ser no mínimo ${esquema.minimum}.`;
      if (esquema.maximum !== undefined && valor > esquema.maximum) return `${chave} deve ser no máximo ${esquema.maximum}.`;
    }
    if (esquema.type === "number") {
      if (typeof valor !== "number" || !Number.isFinite(valor)) return `${chave} deve ser um número.`;
      if (esquema.minimum !== undefined && valor < esquema.minimum) return `${chave} deve ser no mínimo ${esquema.minimum}.`;
      if (esquema.maximum !== undefined && valor > esquema.maximum) return `${chave} deve ser no máximo ${esquema.maximum}.`;
    }
    if (esquema.type === "array") {
      if (esquema.items?.type === "object") {
        if (!Array.isArray(valor) || valor.some((item) => !item || typeof item !== "object" || Array.isArray(item))) return `${chave} deve ser uma lista de objetos.`;
      } else if (!Array.isArray(valor) || valor.some((item) => typeof item !== "string")) {
        return `${chave} deve ser uma lista de textos.`;
      }
      if (esquema.maxItems !== undefined && (valor as unknown[]).length > esquema.maxItems) return `${chave} aceita até ${esquema.maxItems} itens.`;
    }
    if (esquema.enum && !esquema.enum.includes(valor as string)) return `${chave} deve ser um destes: ${esquema.enum.join(", ")}.`;
    if (esquema.format === "uuid" && (typeof valor !== "string" || !UUID.test(valor))) return `${chave} deve ser um UUID válido.`;
  }

  return null;
}
