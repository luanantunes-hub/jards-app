// POST /api/visita/{código}/agendar (PD7.5): escola ou grupo agenda uma visita pelo link, sem conta.
//
// O código do link, que só o banco confere (o hash dele), é a autorização. O servidor confere cada valor e grava de uma vez; a capacidade do
// horário é conferida de novo no banco. A organização e o espaço vêm sempre do link e do banco, nunca do pedido.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ErroDeVisita, agendarVisita } from "@/lib/producao/visita-publica";
import { estaNoLimite, registrarOcorrencia } from "@/lib/mcp/rateLimit";

const SEM_CACHE = { "cache-control": "no-store" };
/** Tentativas com um link que não existe, por IP, a cada minuto. */
const MAX_FALHAS_POR_IP = 20;

function ipDe(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? req.headers.get("x-real-ip") ?? "desconhecido";
}

export async function POST(req: NextRequest, rota: { params: Promise<{ token: string }> }): Promise<NextResponse> {
  const chaveDeFalhas = `visita-falha:${ipDe(req)}`;
  if (estaNoLimite(chaveDeFalhas, MAX_FALHAS_POR_IP)) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde um minuto e tente de novo." }, { status: 429, headers: SEM_CACHE });
  }
  try {
    const { token } = await rota.params;
    const corpo: unknown = await req.json().catch(() => null);
    if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) return NextResponse.json({ error: "Pedido inválido." }, { status: 400, headers: SEM_CACHE });
    await agendarVisita(createAdminClient(), token, corpo as Record<string, unknown>);
    return NextResponse.json({ ok: true }, { headers: SEM_CACHE });
  } catch (erro) {
    if (erro instanceof ErroDeVisita) {
      if (erro.extra.situacao === "inexistente") registrarOcorrencia(chaveDeFalhas);
      return NextResponse.json({ error: erro.message, ...erro.extra }, { status: erro.status, headers: SEM_CACHE });
    }
    console.error("[visita] erro inesperado:", erro instanceof Error ? erro.message : "desconhecido");
    return NextResponse.json({ error: "Não foi possível enviar agora. Tente de novo em instantes." }, { status: 500, headers: SEM_CACHE });
  }
}
