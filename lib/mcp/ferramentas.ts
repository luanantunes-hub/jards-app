import { construirSpecOpenApi } from "@/lib/mcp/openapi";
import { lerValorBRL } from "@/lib/valor";

interface EsquemaJson {
  type?: string;
  format?: string;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  default?: unknown;
  description?: string;
  items?: EsquemaJson;
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

/** Uma ferramenta por operação da spec OpenAPI: o que o ChatGPT vê e o que o Claude vê nunca divergem. */
export function construirFerramentas(): Ferramenta[] {
  const caminhos = construirSpecOpenApi("http://localhost").paths as unknown as Record<string, Record<string, OperacaoOpenApi>>;
  const ferramentas: Ferramenta[] = [];

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

  return ferramentas;
}

export const FERRAMENTAS: readonly Ferramenta[] = construirFerramentas();

export function ferramentasDoEscopo(escopo: "read" | "write"): readonly Ferramenta[] {
  return escopo === "write" ? FERRAMENTAS : FERRAMENTAS.filter((f) => !f.exigeEscrita);
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
    else if (tipo === "array" && typeof valor === "string") saida[chave] = valor.split(",").map((item) => item.trim()).filter(Boolean);
    else saida[chave] = valor;
  }
  return saida;
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
    if (esquema.type === "array" && (!Array.isArray(valor) || valor.some((item) => typeof item !== "string"))) return `${chave} deve ser uma lista de textos.`;
    if (esquema.enum && !esquema.enum.includes(valor as string)) return `${chave} deve ser um destes: ${esquema.enum.join(", ")}.`;
    if (esquema.format === "uuid" && (typeof valor !== "string" || !UUID.test(valor))) return `${chave} deve ser um UUID válido.`;
  }

  return null;
}
