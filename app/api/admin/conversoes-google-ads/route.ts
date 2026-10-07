import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { carregarCadastrosComOrigem } from "@/lib/origem-cadastro-servidor";
import { csvConversoesGoogleAds, montarConversoes } from "@/lib/origem-cadastro";

async function requireSuperAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, allowed: false };

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("jards_super_admin")
    .eq("id", user.id)
    .maybeSingle();

  return { user, allowed: profile?.jards_super_admin === true };
}

// Lista de conversões (cadastro e assinatura) dos cliques de anúncio dos
// últimos 90 dias, no modelo de importação do Google Ads. Repetir o envio é
// seguro: o Google descarta a conversão que já recebeu.
export async function GET() {
  const { user, allowed } = await requireSuperAdmin();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!allowed) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { usuarios, pagamentos, planos } = await carregarCadastrosComOrigem();
  const csv = csvConversoesGoogleAds(montarConversoes(usuarios, pagamentos, planos));
  const hoje = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="conversoes-google-ads-${hoje}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
