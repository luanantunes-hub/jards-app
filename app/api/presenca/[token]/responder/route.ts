// POST /api/presenca/{código}/responder (PD6.9): a pessoa convidada responde ao convite pelo link, sem conta.
//
// O código do link, que só o banco confere (o hash dele), é a autorização. O servidor confere cada valor e grava de uma vez.
// A organização, a temporada e a pessoa vêm sempre do link e do banco, nunca do pedido.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ErroDoConvite, responderAoConvite } from "@/lib/producao/convite-publico";
import { estaNoLimite, registrarOcorrencia } from "@/lib/mcp/rateLimit";

const SEM_CACHE = { "cache-control": "no-store" };
/** Tentativas com um link que não existe, por IP, a cada minuto. Um código tem 256 bits, mas não custa fechar a porta. */
const MAX_FALHAS_POR_IP = 20;

function ipDe(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? req.headers.get("x-real-ip") ?? "desconhecido";
}

export async function POST(req: NextRequest, rota: { params: Promise<{ token: string }> }): Promise<NextResponse> {
  const chaveDeFalhas = `presenca-falha:${ipDe(req)}`;
  if (estaNoLimite(chaveDeFalhas, MAX_FALHAS_POR_IP)) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde um minuto e tente de novo." }, { status: 429, headers: SEM_CACHE });
  }
  try {
    const { token } = await rota.params;
    const corpo: unknown = await req.json().catch(() => null);
    if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) return NextResponse.json({ error: "Pedido inválido." }, { status: 400, headers: SEM_CACHE });
    const resultado = await responderAoConvite(createAdminClient(), token, corpo as Record<string, unknown>);
    return NextResponse.json({ ok: true, resposta: resultado.resposta }, { headers: SEM_CACHE });
  } catch (erro) {
    if (erro instanceof ErroDoConvite) {
      if (erro.extra.situacao === "inexistente") registrarOcorrencia(chaveDeFalhas);
      return NextResponse.json({ error: erro.message, ...erro.extra }, { status: erro.status, headers: SEM_CACHE });
    }
    console.error("[presenca] erro inesperado:", erro instanceof Error ? erro.message : "desconhecido");
    return NextResponse.json({ error: "Não foi possível enviar agora. Tente de novo em instantes." }, { status: 500, headers: SEM_CACHE });
  }
}
