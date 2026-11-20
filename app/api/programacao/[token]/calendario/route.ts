// GET /api/programacao/{código}/calendario (PD8.3): o calendário (.ics) das sessões da programação pública, para o público pôr na própria agenda.
//
// Sem login: o código do link, que só o banco confere (o hash dele), é a autorização. Leva só o que a página pública mostra (dia, hora, título, sala e
// quem apresenta). Aceita ?sala= e ?dia= como a página. Baixar de novo atualiza os eventos em vez de duplicar (o identificador de cada um é fixo).

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { carregarProgramacaoPublica } from "@/lib/producao/programacao-publica";
import { calendarioIcs, filtrarProgramacao, filtroDoEndereco } from "@/lib/producao/programacao-vistas";
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
    const filtro = filtroDoEndereco({ sala: req.nextUrl.searchParams.get("sala") ?? undefined, dia: req.nextUrl.searchParams.get("dia") ?? undefined });
    const { programacao } = resultado;
    const ics = calendarioIcs({ titulo: programacao.titulo, espaco: programacao.espaco, dias: filtrarProgramacao(programacao.dias, filtro), geradoEm: new Date() });
    return new NextResponse(ics, {
      headers: { ...ABERTO, "content-type": "text/calendar; charset=utf-8", "content-disposition": 'attachment; filename="programacao.ics"', "cache-control": "public, max-age=60, s-maxage=60" },
    });
  } catch (erro) {
    console.error("[programacao] erro inesperado no calendário:", erro instanceof Error ? erro.message : "desconhecido");
    return NextResponse.json({ error: "Não foi possível carregar agora." }, { status: 500, headers: { ...ABERTO, "cache-control": "no-store" } });
  }
}
