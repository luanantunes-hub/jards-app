import type { Ferramenta } from "@/lib/mcp/ferramentas";

/** Versões do protocolo MCP que o servidor entende, da mais nova para a mais antiga. */
export const VERSOES_SUPORTADAS = ["2025-06-18", "2025-03-26", "2024-11-05"] as const;

export const INSTRUCOES =
  "Jards é um CRM de captação de patrocínio por leis de incentivo (Rouanet/Cultura, Ancine, Esporte e Saúde). " +
  "As ferramentas consultam os dados da organização da pessoa conectada: projetos, empresas do CRM, contatos, " +
  "propostas, tarefas, captadores, proponentes, editais públicos e a base pública de patrocinadores. " +
  "Se a pessoa pertence a mais de uma organização, informe organization_id (use listar_minhas_organizacoes). " +
  "Ver os contatos de uma empresa consome crédito da organização na primeira vez.";

/** Resposta do tipo "tool result" maior que isso é cortada: o cliente de IA não aproveita e estoura o contexto. */
const MAX_TEXTO_DA_FERRAMENTA = 60_000;

export type IdJsonRpc = string | number | null;

export interface RespostaJsonRpc {
  jsonrpc: "2.0";
  id: IdJsonRpc;
  result?: unknown;
  error?: { code: number; message: string };
}

export type SaidaDaFerramenta =
  | { tipo: "resposta"; status: number; corpo: unknown }
  | { tipo: "desconhecida" }
  | { tipo: "argumentos_invalidos"; mensagem: string };

export interface DependenciasMcp {
  /** Confere o token; lança ErroHttp se for inválido, expirado ou sem plano. */
  garantirAutenticacao(): Promise<void>;
  /** Ferramentas que o escopo do token permite. */
  listarFerramentas(): Promise<readonly Ferramenta[]>;
  chamarFerramenta(nome: string, argumentos: Record<string, unknown>): Promise<SaidaDaFerramenta>;
}

/** Erro que vira resposta HTTP (e não resposta JSON-RPC): token inválido, limite, plano. */
export class ErroHttp extends Error {
  constructor(
    public readonly status: number,
    message: string,
    /** true: o cliente deve (re)iniciar a autorização OAuth (resposta 401 com WWW-Authenticate). */
    public readonly exigeAutorizacao = false
  ) {
    super(message);
  }
}

const ERRO_REQUISICAO_INVALIDA = -32600;
const ERRO_METODO_INEXISTENTE = -32601;
const ERRO_PARAMETROS_INVALIDOS = -32602;

function ok(id: IdJsonRpc, result: unknown): RespostaJsonRpc {
  return { jsonrpc: "2.0", id, result };
}

function erro(id: IdJsonRpc, code: number, message: string): RespostaJsonRpc {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

export function limitarTexto(texto: string): string {
  if (texto.length <= MAX_TEXTO_DA_FERRAMENTA) return texto;
  return `${texto.slice(0, MAX_TEXTO_DA_FERRAMENTA)}\n\n[resultado cortado: refine com "busca" ou um "limite" menor]`;
}

function paraFerramentaMcp(ferramenta: Ferramenta) {
  return {
    name: ferramenta.nome,
    title: ferramenta.titulo,
    description: ferramenta.descricao,
    inputSchema: ferramenta.inputSchema,
    annotations: {
      title: ferramenta.titulo,
      readOnlyHint: ferramenta.somenteLeitura,
      destructiveHint: false,
      openWorldHint: false,
    },
  };
}

/**
 * Trata uma mensagem JSON-RPC do MCP. Devolve a resposta, ou null quando não há o que responder
 * (notificações). Erros de autenticação saem como ErroHttp para o endpoint transformar em HTTP.
 */
export async function tratarMensagem(mensagem: unknown, deps: DependenciasMcp): Promise<RespostaJsonRpc | null> {
  if (!ehObjeto(mensagem)) return erro(null, ERRO_REQUISICAO_INVALIDA, "Requisição inválida.");

  // Respostas de cliente a pedidos do servidor: o Jards não faz pedidos ao cliente, então não há o que tratar.
  if (typeof mensagem.method !== "string") {
    return "result" in mensagem || "error" in mensagem ? null : erro(null, ERRO_REQUISICAO_INVALIDA, "Requisição inválida.");
  }
  if (mensagem.jsonrpc !== "2.0") return erro(null, ERRO_REQUISICAO_INVALIDA, "jsonrpc deve ser \"2.0\".");

  // Sem id é notificação (ex.: notifications/initialized): nada a responder.
  const id = mensagem.id;
  if (id === undefined || id === null) return null;
  if (typeof id !== "string" && typeof id !== "number") return erro(null, ERRO_REQUISICAO_INVALIDA, "id inválido.");

  const params = ehObjeto(mensagem.params) ? mensagem.params : {};

  switch (mensagem.method) {
    case "initialize": {
      await deps.garantirAutenticacao();
      const pedida = typeof params.protocolVersion === "string" ? params.protocolVersion : "";
      const protocolVersion = (VERSOES_SUPORTADAS as readonly string[]).includes(pedida) ? pedida : VERSOES_SUPORTADAS[0];
      return ok(id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "jards", title: "Jards", version: "1.0.0" },
        instructions: INSTRUCOES,
      });
    }

    case "ping":
      return ok(id, {});

    case "tools/list": {
      await deps.garantirAutenticacao();
      return ok(id, { tools: (await deps.listarFerramentas()).map(paraFerramentaMcp) });
    }

    case "tools/call": {
      const nome = params.name;
      if (typeof nome !== "string" || !nome) return erro(id, ERRO_PARAMETROS_INVALIDOS, "Informe o nome da ferramenta em params.name.");
      const argumentos = params.arguments === undefined ? {} : params.arguments;
      if (!ehObjeto(argumentos)) return erro(id, ERRO_PARAMETROS_INVALIDOS, "params.arguments deve ser um objeto.");

      const saida = await deps.chamarFerramenta(nome, argumentos);
      if (saida.tipo === "desconhecida") return erro(id, ERRO_PARAMETROS_INVALIDOS, `Ferramenta desconhecida: ${nome}.`);
      if (saida.tipo === "argumentos_invalidos") return erro(id, ERRO_PARAMETROS_INVALIDOS, saida.mensagem);

      // Erro de negócio (várias organizações, sem créditos, sem permissão) volta como resultado com
      // isError, com a mensagem original: é assim que o modelo entende o que corrigir ou avisar.
      const texto = typeof saida.corpo === "string" ? saida.corpo : JSON.stringify(saida.corpo, null, 2);
      return ok(id, { content: [{ type: "text", text: limitarTexto(texto) }], isError: saida.status >= 400 });
    }

    default:
      return erro(id, ERRO_METODO_INEXISTENTE, `Método não suportado: ${mensagem.method}.`);
  }
}
