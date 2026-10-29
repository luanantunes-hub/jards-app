import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { enviarBot, type VexaPlataforma } from "@/lib/reunioes/vexa";

function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

async function currentUser() {
  const cookieStore = await cookies();
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const { data: { user } } = await client.auth.getUser();
  return user;
}

async function ehMembroDaOrg(admin: ReturnType<typeof adminClient>, organizationId: string, userId: string) {
  const { data } = await admin
    .from("organization_members")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const organizationId = req.nextUrl.searchParams.get("organization_id") ?? "";
  if (!organizationId) return NextResponse.json({ error: "Organização não informada" }, { status: 400 });

  const admin = adminClient();
  if (!await ehMembroDaOrg(admin, organizationId, user.id)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { data, error } = await admin
    .from("reunioes")
    .select("id,titulo,plataforma,status,captacao_id,empresa_crm_id,agendada_para,iniciada_em,finalizada_em,created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ reunioes: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const organizationId = body?.organization_id as string | undefined;
  const titulo = String(body?.titulo ?? "").trim();
  const plataforma = body?.plataforma as VexaPlataforma | undefined;
  const urlReuniao = String(body?.url_reuniao ?? "").trim();
  const captacaoId = body?.captacao_id as string | undefined;
  const empresaCrmId = body?.empresa_crm_id as string | undefined;

  if (!organizationId) return NextResponse.json({ error: "Organização não informada" }, { status: 400 });
  if (!titulo) return NextResponse.json({ error: "Informe um título para a reunião" }, { status: 400 });
  if (plataforma !== "google_meet" && plataforma !== "teams") {
    return NextResponse.json({ error: "Plataforma inválida" }, { status: 400 });
  }
  if (!urlReuniao) return NextResponse.json({ error: "Informe o link da reunião" }, { status: 400 });

  const admin = adminClient();
  if (!await ehMembroDaOrg(admin, organizationId, user.id)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  // Se a reunião for vinculada a uma negociação/empresa do CRM, confirma que
  // pertence à mesma organização do usuário — nunca confia só no id recebido.
  if (captacaoId) {
    const { data } = await admin.from("captacoes").select("id").eq("id", captacaoId).eq("organization_id", organizationId).maybeSingle();
    if (!data) return NextResponse.json({ error: "Negociação não encontrada nesta organização" }, { status: 404 });
  }
  if (empresaCrmId) {
    const { data } = await admin.from("empresas_crm").select("id").eq("id", empresaCrmId).eq("organization_id", organizationId).maybeSingle();
    if (!data) return NextResponse.json({ error: "Empresa não encontrada nesta organização" }, { status: 404 });
  }

  const { data: reuniao, error: insertError } = await admin
    .from("reunioes")
    .insert({
      organization_id: organizationId,
      titulo,
      plataforma,
      url_reuniao: urlReuniao,
      captacao_id: captacaoId ?? null,
      empresa_crm_id: empresaCrmId ?? null,
      status: "bot_entrando",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  try {
    const { vexaBotId } = await enviarBot({
      meetingUrl: urlReuniao,
      plataforma,
      webhookUrl: `${appUrl}/api/reunioes/webhook`,
    });
    await admin.from("reunioes").update({ vexa_bot_id: vexaBotId }).eq("id", reuniao.id);
  } catch (error) {
    await admin.from("reunioes").update({
      status: "falhou",
      erro: error instanceof Error ? error.message : "Não foi possível enviar o assistente para a reunião",
    }).eq("id", reuniao.id);
    return NextResponse.json({ error: "Não foi possível enviar o assistente para a reunião" }, { status: 502 });
  }

  return NextResponse.json({ id: reuniao.id }, { status: 201 });
}
