import { NextRequest, NextResponse } from "next/server";
import type { Admin } from "@/lib/mcp/crm";
import { estaNoLimite, registrarOcorrencia } from "@/lib/mcp/rateLimit";
import { dependenciasDaRota } from "@/lib/mcp/rota";
import { ErroMcp } from "@/lib/mcp/validacao";

/**
 * Casca das duas rotas da página de envio (/api/enviar/{código}/...). Não tem login: o código do link, que só o banco
 * confere (envio-publico.ts), é a autorização. Aqui ficam o corpo JSON, o limite de tentativas com link inválido por IP
 * e a resposta com o status certo.
 */

/** Tentativas com um link que não existe, por IP: a cada minuto, até 20. Um código tem 256 bits, mas não custa fechar a porta. */
const chaveDeFalhas = (ip: string) => `enviar-falha:${ip}`;
const MAX_FALHAS_POR_IP = 20;

function ipDe(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? req.headers.get("x-real-ip") ?? "desconhecido";
}

const SEM_CACHE = { "cache-control": "no-store" };

export function rotaDeEnvio(executar: (contexto: { admin: Admin; codigo: string; corpo: Record<string, unknown> }) => Promise<object>) {
  return async (req: NextRequest, rota: { params: Promise<{ token: string }> }): Promise<NextResponse> => {
    const ip = ipDe(req);
    if (estaNoLimite(chaveDeFalhas(ip), MAX_FALHAS_POR_IP)) {
      return NextResponse.json({ error: "Muitas tentativas. Aguarde um minuto e tente de novo." }, { status: 429, headers: SEM_CACHE });
    }
    try {
      const { token } = await rota.params;
      const bruto: unknown = await req.json().catch(() => null);
      if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) throw new ErroMcp(400, "Pedido inválido.");
      const resposta = await executar({ admin: dependenciasDaRota.criarAdmin(), codigo: token, corpo: bruto as Record<string, unknown> });
      return NextResponse.json(resposta, { headers: SEM_CACHE });
    } catch (erro) {
      if (erro instanceof ErroMcp) {
        if (erro.extra.situacao === "inexistente") registrarOcorrencia(chaveDeFalhas(ip));
        return NextResponse.json({ error: erro.message, ...erro.extra }, { status: erro.status, headers: SEM_CACHE });
      }
      console.error("[enviar] erro inesperado:", erro instanceof Error ? erro.message : "desconhecido");
      return NextResponse.json({ error: "Não foi possível concluir agora. Tente de novo em instantes." }, { status: 500, headers: SEM_CACHE });
    }
  };
}
