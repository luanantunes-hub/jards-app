import { NextRequest, NextResponse } from "next/server";
import { authenticateMcpRequest, isErrorResponse, type McpAuthContext } from "@/lib/mcp/auth";
import { FERRAMENTAS, ferramentasDoEscopo, normalizarArgumentos, validarArgumentos } from "@/lib/mcp/ferramentas";
import { executarFerramenta } from "@/lib/mcp/execucao";
import { pedidoDeNavegador } from "@/lib/mcp/navegador";
import { ErroHttp, VERSOES_SUPORTADAS, tratarMensagem, type DependenciasMcp, type RespostaJsonRpc } from "@/lib/mcp/protocolo";

/**
 * Servidor MCP remoto do Jards (transporte Streamable HTTP, sem sessão): o Claude conecta aqui
 * pela URL, autoriza com a própria conta via OAuth e passa a chamar as ferramentas. A
 * autenticação e as regras de escopo, organização e plano são as das rotas REST em /api/mcp/*.
 */

const SEM_CACHE = { "Cache-Control": "no-store" };

/** 401 com o endereço dos metadados OAuth: é o que faz o cliente MCP iniciar a autorização. */
function desafio(origem: string, tokenInvalido: boolean) {
  const metadados = `${origem}/.well-known/oauth-protected-resource/api/mcp/server`;
  return NextResponse.json(
    {
      error: tokenInvalido ? "invalid_token" : "unauthorized",
      error_description: tokenInvalido ? "Token inválido, expirado ou revogado." : "Autorize o acesso ao Jards para continuar.",
    },
    {
      status: 401,
      headers: { ...SEM_CACHE, "WWW-Authenticate": `Bearer resource_metadata="${metadados}"${tokenInvalido ? ', error="invalid_token"' : ""}` },
    }
  );
}

function erroJsonRpc(status: number, code: number, message: string) {
  return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code, message } }, { status, headers: SEM_CACHE });
}

async function converterErroDeAutenticacao(resposta: NextResponse): Promise<ErroHttp> {
  const corpo = await resposta.json().catch(() => ({}));
  const mensagem = typeof corpo?.error === "string" ? corpo.error : "Não autorizado.";
  if (resposta.status === 401) return new ErroHttp(401, mensagem, true);
  // Plano sem assinatura ativa: para o cliente MCP é falta de permissão, não "pagamento exigido".
  return new ErroHttp(resposta.status === 402 ? 403 : resposta.status, mensagem);
}

function criarDependencias(req: NextRequest): DependenciasMcp {
  let contexto: Promise<McpAuthContext> | null = null;
  const autenticar = () =>
    (contexto ??= (async () => {
      const resultado = await authenticateMcpRequest(req);
      if (isErrorResponse(resultado)) throw await converterErroDeAutenticacao(resultado);
      return resultado;
    })());

  return {
    garantirAutenticacao: async () => {
      await autenticar();
    },
    listarFerramentas: async () => ferramentasDoEscopo((await autenticar()).scope),
    chamarFerramenta: async (nome, argumentos) => {
      const ferramenta = FERRAMENTAS.find((f) => f.nome === nome);
      if (!ferramenta) return { tipo: "desconhecida" };

      const normalizados = normalizarArgumentos(ferramenta, argumentos);
      const problema = validarArgumentos(ferramenta, normalizados);
      if (problema) return { tipo: "argumentos_invalidos", mensagem: problema };

      const { status, corpo } = await executarFerramenta(ferramenta, normalizados, req);
      if (status === 401) throw new ErroHttp(401, "Token inválido, expirado ou revogado.", true);
      if (status === 403 && typeof (corpo as { error?: string })?.error === "string" && (corpo as { error: string }).error.includes("somente leitura")) {
        return {
          tipo: "resposta",
          status,
          corpo: { error: "Esta conexão é somente leitura. Para criar registros, reconecte o Jards e marque a permissão de criar contatos e tarefas." },
        };
      }
      return { tipo: "resposta", status, corpo };
    },
  };
}

export async function POST(req: NextRequest) {
  const origem = req.nextUrl.origin;

  // Sem token: devolve o desafio OAuth antes de qualquer outra coisa (e sem tocar o banco).
  if (!/^Bearer\s+\S+/i.test(req.headers.get("authorization") ?? "")) return desafio(origem, false);

  const versaoPedida = req.headers.get("mcp-protocol-version");
  if (versaoPedida && !(VERSOES_SUPORTADAS as readonly string[]).includes(versaoPedida)) {
    return erroJsonRpc(400, -32600, `Versão do protocolo não suportada: ${versaoPedida}.`);
  }

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return erroJsonRpc(400, -32700, "JSON inválido.");
  }

  const deps = criarDependencias(req);
  try {
    if (Array.isArray(corpo)) {
      if (corpo.length === 0) return erroJsonRpc(400, -32600, "Lote vazio.");
      const respostas: RespostaJsonRpc[] = [];
      for (const item of corpo) {
        const resposta = await tratarMensagem(item, deps);
        if (resposta) respostas.push(resposta);
      }
      return respostas.length > 0 ? NextResponse.json(respostas, { headers: SEM_CACHE }) : new NextResponse(null, { status: 202 });
    }

    const resposta = await tratarMensagem(corpo, deps);
    return resposta ? NextResponse.json(resposta, { headers: SEM_CACHE }) : new NextResponse(null, { status: 202 });
  } catch (erro) {
    if (erro instanceof ErroHttp) {
      if (erro.exigeAutorizacao) return desafio(origem, true);
      return NextResponse.json({ error: erro.message }, { status: erro.status, headers: SEM_CACHE });
    }
    console.error("Erro no servidor MCP:", erro);
    return erroJsonRpc(500, -32603, "Erro interno.");
  }
}

// Este servidor só responde a POST: não oferece fluxo de eventos nem sessão.
function metodoNaoPermitido() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}

// Quem cola o endereço na barra do navegador (em vez de no Claude ou no ChatGPT) cairia num download
// vazio: leva essa pessoa para a tela que explica como conectar.
export function GET(req: NextRequest) {
  if (pedidoDeNavegador(req.headers.get("accept"))) {
    return NextResponse.redirect(new URL("/configuracoes/mcp", req.nextUrl.origin), {
      status: 307,
      headers: { ...SEM_CACHE, Vary: "Accept" },
    });
  }
  return metodoNaoPermitido();
}
export const DELETE = metodoNaoPermitido;
