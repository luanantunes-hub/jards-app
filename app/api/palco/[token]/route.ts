import { NextResponse } from "next/server";
import { carregarPalco } from "@/lib/producao/palco-publico";
import { createAdminClient } from "@/lib/supabase/admin";

// O telão de palco pergunta aqui a cada poucos segundos (PD7.1): o mesmo conteúdo da página, em JSON, sem cache. O código do link é a
// autorização; código inexistente, desativado ou vencido responde 404, 410 e 410, sem dizer mais nada.
export const dynamic = "force-dynamic";

const SEM_CACHE = { "Cache-Control": "no-store" };

export async function GET(_pedido: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const resultado = await carregarPalco(createAdminClient(), token);
    if (resultado.situacao === "valido") return NextResponse.json({ palco: resultado.palco }, { headers: SEM_CACHE });
    if (resultado.situacao === "inexistente") return NextResponse.json({ erro: "inexistente" }, { status: 404, headers: SEM_CACHE });
    return NextResponse.json({ erro: resultado.situacao }, { status: 410, headers: SEM_CACHE });
  } catch {
    return NextResponse.json({ erro: "indisponivel" }, { status: 503, headers: SEM_CACHE });
  }
}
