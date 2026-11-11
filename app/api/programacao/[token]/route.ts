// GET /api/programacao/{código} (PD8.3): a programação pública de um espaço em JSON, para o site da casa montar do jeito dele.
//
// Sem login: o código do link, que só o banco confere (o hash dele), é a autorização. Devolve só o que a página pública mostra:
// título, nome do espaço e, por dia, as sessões das pautas confirmadas com hora, título e sala. Aberta a qualquer site (CORS),
// com um minuto de cache.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { carregarProgramacaoPublica } from "@/lib/producao/programacao-publica";
import { estaNoLimite, registrarOcorrencia } from "@/lib/mcp/rateLimit";

const ABERTO = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, OPTIONS" };
const MAX_FALHAS_POR_IP = 20;

function ipDe(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? req.headers.get("x-real-ip") ?? "desconhecido";
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...ABERTO, "access-control-max-age": "86400" } });
}

export async function GET(req: NextRequest, rota: { params: Promise<{ token: string }> }): Promise<NextResponse> {
  const chaveDeFalhas = `programacao-falha:${ipDe(req)}`;
  if (estaNoLimite(chaveDeFalhas, MAX_FALHAS_POR_IP)) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde um minuto." }, { status: 429, headers: { ...ABERTO, "cache-control": "no-store" } });
  }
  try {
    const { token } = await rota.params;
    const resultado = await carregarProgramacaoPublica(createAdminClient(), token);
    if (resultado.situacao !== "valido") {
      const inexistente = resultado.situacao === "inexistente";
      if (inexistente) registrarOcorrencia(chaveDeFalhas);
      return NextResponse.json({ error: inexistente ? "Programação não encontrada." : "Programação desativada." }, { status: inexistente ? 404 : 410, headers: { ...ABERTO, "cache-control": "no-store" } });
    }
    return NextResponse.json(resultado.programacao, { headers: { ...ABERTO, "cache-control": "public, max-age=60, s-maxage=60" } });
  } catch (erro) {
    console.error("[programacao] erro inesperado:", erro instanceof Error ? erro.message : "desconhecido");
    return NextResponse.json({ error: "Não foi possível carregar agora." }, { status: 500, headers: { ...ABERTO, "cache-control": "no-store" } });
  }
}
