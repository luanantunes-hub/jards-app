/**
 * Peças que as specs OpenAPI de todos os módulos compartilham (parâmetros e blocos de corpo). Cada módulo monta
 * a própria spec com elas, em lib/mcp/openapi.ts (captação) e lib/mcp/openapi-prestacao.ts (prestação de contas).
 */

export const orgIdParam = {
  name: "organization_id",
  in: "query",
  required: false,
  schema: { type: "string", format: "uuid" },
  description: "Opcional se você pertence a uma única organização.",
};

export const buscaParam = {
  name: "busca",
  in: "query",
  required: false,
  schema: { type: "string" },
};

export const limiteParam = {
  name: "limite",
  in: "query",
  required: false,
  schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
};

export const deslocamentoParam = {
  name: "deslocamento",
  in: "query",
  required: false,
  schema: { type: "integer", minimum: 0, default: 0 },
  description: "Quantos resultados pular, para ver a página seguinte (use junto com limite).",
};

export const uuidQuery = (name: string, description?: string) => ({
  name,
  in: "query",
  required: false,
  schema: { type: "string", format: "uuid" },
  ...(description ? { description } : {}),
});

export const booleanQuery = (name: string, description: string) => ({
  name,
  in: "query",
  required: false,
  description,
  schema: { type: "boolean", default: false },
});

export const idNoCaminho = { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } };

export const uuid = (description?: string) => ({ type: "string", format: "uuid", ...(description ? { description } : {}) });
export const texto = (description?: string) => ({ type: "string", ...(description ? { description } : {}) });

// Toda criação aceita a chave: repetir o pedido com a mesma chave devolve o resultado de antes, sem duplicar.
export const chaveIdempotencia = texto(
  "Texto único por ação (ex.: um UUID novo). Se a rede falhar, repita o pedido com a MESMA chave: nada é criado duas vezes."
);

export const corpoJson = (required: string[], properties: Record<string, unknown>) => ({
  required: true,
  content: { "application/json": { schema: { type: "object", required, properties: { ...properties, chave_idempotencia: chaveIdempotencia } } } },
});

/** Corpo sem chave_idempotencia, para as operações cuja resposta tem um segredo (código de link, endereços assinados) e não pode ser guardada. */
export const corpoJsonSemChave = (required: string[], properties: Record<string, unknown>) => ({
  required: true,
  content: { "application/json": { schema: { type: "object", required, properties } } },
});

export const orgNoCorpo = { organization_id: uuid("Opcional se você pertence a uma única organização.") };

export const dataTexto = "Dia (AAAA-MM-DD) ou dia e hora (AAAA-MM-DDTHH:MM, horário de Brasília).";

export const SEGURANCA_BEARER = {
  components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } } },
  security: [{ bearerAuth: [] }],
};
