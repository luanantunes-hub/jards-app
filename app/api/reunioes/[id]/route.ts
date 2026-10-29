import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const admin = adminClient();

  const { data: reuniao, error } = await admin
    .from("reunioes")
    .select("id,organization_id,titulo,plataforma,url_reuniao,status,erro,captacao_id,empresa_crm_id,resumo_ia,agendada_para,iniciada_em,finalizada_em,created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!reuniao) return NextResponse.json({ error: "Reunião não encontrada" }, { status: 404 });

  // Confirma que o usuário pertence à organização dona da reunião antes de
  // devolver qualquer dado de transcrição — nunca confiar só no id da URL.
  const { data: membership } = await admin
    .from("organization_members")
    .select("id")
    .eq("organization_id", reuniao.organization_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const [{ data: transcricoes }, { data: participantes }, { data: marcadores }] = await Promise.all([
    admin.from("reuniao_transcricoes").select("id,falante,texto,inicio_ms,fim_ms").eq("reuniao_id", id).order("inicio_ms"),
    admin.from("reuniao_participantes").select("id,nome,email").eq("reuniao_id", id),
    admin.from("reuniao_marcadores").select("id,tipo,texto,timestamp_ms").eq("reuniao_id", id).order("timestamp_ms"),
  ]);

  return NextResponse.json(
    { reuniao, transcricoes: transcricoes ?? [], participantes: participantes ?? [], marcadores: marcadores ?? [] },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
