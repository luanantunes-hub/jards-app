import { NextRequest, NextResponse } from "next/server";
import { isErrorResponse, type McpAuthContext } from "@/lib/mcp/auth";
import { FERRAMENTAS, ferramentasDoEscopo, normalizarArgumentos, validarArgumentos } from "@/lib/mcp/ferramentas";
import { executarFerramenta } from "@/lib/mcp/execucao";
import { MODULO_PADRAO, type ModuloMcp } from "@/lib/mcp/modulos";
import { ErroHttp, instrucoesDosModulos, type DependenciasMcp } from "@/lib/mcp/protocolo";
import { dependenciasDaRota } from "@/lib/mcp/rota";

async function converterErroDeAutenticacao(resposta: NextResponse): Promise<ErroHttp> {
  const corpo = await resposta.json().catch(() => ({}));
  const mensagem = typeof corpo?.error === "string" ? corpo.error : "Não autorizado.";
  if (resposta.status === 401) return new ErroHttp(401, mensagem, true);
  // Plano sem assinatura ativa: para o cliente MCP é falta de permissão, não "pagamento exigido".
  return new ErroHttp(resposta.status === 402 ? 403 : resposta.status, mensagem);
}

/** O que dizer a quem tentou gravar com uma conexão somente leitura: a permissão que falta tem o nome do módulo da ferramenta. */
const MENSAGEM_SOMENTE_LEITURA: Record<ModuloMcp, string> = {
  captacao:
    "Esta conexão é somente leitura. Para criar registros, reconecte o Jards e marque a permissão de criar registros no CRM (empresas, contatos, negociações, atividades e mais).",
  prestacao:
    "Esta conexão é somente leitura. Para gravar na prestação de contas, reconecte o Jards e marque a permissão de criar e alterar registros.",
};

/** O que o servidor MCP precisa para tratar as mensagens de um pedido: autenticação (uma vez por pedido), ferramentas e instruções dos módulos da chave. */
export function criarDependencias(req: NextRequest): DependenciasMcp {
  let autenticado: Promise<McpAuthContext> | null = null;
  const autenticar = () =>
    (autenticado ??= (async () => {
      const resultado = await dependenciasDaRota.autenticar(req);
      if (isErrorResponse(resultado)) throw await converterErroDeAutenticacao(resultado);
      return resultado;
    })());

  return {
    garantirAutenticacao: async () => {
      await autenticar();
    },
    // Só as ferramentas dos módulos que a chave autorizou e a que a pessoa tem acesso agora. Uma ferramenta de outro módulo,
    // chamada pelo nome mesmo assim, é recusada pela própria rota (requireModulo) com a explicação do que falta.
    listarFerramentas: async () => {
      const contexto = await autenticar();
      return ferramentasDoEscopo(contexto.scope, contexto.modulos ?? [MODULO_PADRAO]);
    },
    instrucoes: async () => instrucoesDosModulos((await autenticar()).modulos ?? [MODULO_PADRAO]),
    chamarFerramenta: async (nome, argumentos) => {
      const ferramenta = FERRAMENTAS.find((f) => f.nome === nome);
      if (!ferramenta) return { tipo: "desconhecida" };

      const normalizados = normalizarArgumentos(ferramenta, argumentos);
      const problema = validarArgumentos(ferramenta, normalizados);
      if (problema) return { tipo: "argumentos_invalidos", mensagem: problema };

      const { status, corpo } = await executarFerramenta(ferramenta, normalizados, req);
      if (status === 401) throw new ErroHttp(401, "Token inválido, expirado ou revogado.", true);
      if (status === 403 && typeof (corpo as { error?: string })?.error === "string" && (corpo as { error: string }).error.includes("somente leitura")) {
        return { tipo: "resposta", status, corpo: { error: MENSAGEM_SOMENTE_LEITURA[ferramenta.modulo] } };
      }
      return { tipo: "resposta", status, corpo };
    },
  };
}
