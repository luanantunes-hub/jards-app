// POST /api/convidar/{código}/pedir (PD7.2): quem recebeu o link pede um convidado para a sessão, sem conta.
//
// O código do link, que só o banco confere (o hash dele), é a autorização. O servidor confere cada valor e grava de uma vez; a cota
// do tipo e o corte são conferidos de novo no banco. A organização e a sessão vêm sempre do link, nunca do pedido.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ErroDePedido, pedirConvidado } from "@/lib/producao/pedido-publico";
import { estaNoLimite, registrarOcorrencia } from "@/lib/mcp/rateLimit";

const SEM_CACHE = { "cache-control": "no-store" };
/** Tentativas com um link que não existe, por IP, a cada minuto. */
const MAX_FALHAS_POR_IP = 20;

function ipDe(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? req.headers.get("x-real-ip") ?? "desconhecido";
}

export async function POST(req: NextRequest, rota: { params: Promise<{ token: string }> }): Promise<NextResponse> {
  const chaveDeFalhas = `convidar-falha:${ipDe(req)}`;
  if (estaNoLimite(chaveDeFalhas, MAX_FALHAS_POR_IP)) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde um minuto e tente de novo." }, { status: 429, headers: SEM_CACHE });
  }
  try {
    const { token } = await rota.params;
    const corpo: unknown = await req.json().catch(() => null);
    if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) return NextResponse.json({ error: "Pedido inválido." }, { status: 400, headers: SEM_CACHE });
    await pedirConvidado(createAdminClient(), token, corpo as Record<string, unknown>);
    return NextResponse.json({ ok: true }, { headers: SEM_CACHE });
  } catch (erro) {
    if (erro instanceof ErroDePedido) {
      if (erro.extra.situacao === "inexistente") registrarOcorrencia(chaveDeFalhas);
      return NextResponse.json({ error: erro.message, ...erro.extra }, { status: erro.status, headers: SEM_CACHE });
    }
    console.error("[convidar] erro inesperado:", erro instanceof Error ? erro.message : "desconhecido");
    return NextResponse.json({ error: "Não foi possível enviar agora. Tente de novo em instantes." }, { status: 500, headers: SEM_CACHE });
  }
}
