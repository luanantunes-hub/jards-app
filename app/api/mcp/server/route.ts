import { NextRequest, NextResponse } from "next/server";
import { pedidoDeNavegador } from "@/lib/mcp/navegador";
import { ErroHttp, VERSOES_SUPORTADAS, tratarMensagem, type RespostaJsonRpc } from "@/lib/mcp/protocolo";
import { criarDependencias } from "@/lib/mcp/servidor";

/**
 * Servidor MCP remoto do Jards (transporte Streamable HTTP, sem sessão): o Claude conecta aqui
 * pela URL, autoriza com a própria conta via OAuth e passa a chamar as ferramentas. A
 * autenticação e as regras de escopo, organização e plano são as das rotas REST em /api/mcp/*.
 */

// Cada ferramenta roda dentro desta chamada (inclusive receber arquivos de até 15 MB e rodar a verificação da prestação): um minuto, que é o que um cliente espera.
export const maxDuration = 60;

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
