import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser, resolveAuthorizedOrganizationId } from "@/lib/calendar/require-user";
import { listPublicConnections } from "@/lib/calendar/connections";
import { proximasReunioes } from "@/lib/reunioes/calendario-sincronizar";

export const dynamic = "force-dynamic";
const SEM_CACHE = { "Cache-Control": "private, no-store" };

// Tela de configurações: liga/desliga o robô pelo calendário, mostra as próximas reuniões que ele cobre e deixa tirar uma delas ("não entrar nesta").

export async function GET(req: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response;
  const org = await resolveAuthorizedOrganizationId(req.nextUrl.searchParams.get("organization_id"));
  if (!org.authorized || !org.organizationId) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const admin = createAdminClient();
  const [conexoes, config] = await Promise.all([
    listPublicConnections(user.id),
    admin.from("reunioes_calendario_config").select("ativo, ultima_leitura, erro, organization_id").eq("user_id", user.id).maybeSingle(),
  ]);
  const contas = conexoes.map(conexao => ({ provider: conexao.provider, email: conexao.provider_account_email }));
  const ativo = config.data?.ativo === true && config.data.organization_id === org.organizationId;
  // só gasta chamadas na agenda quando há conta conectada
  const proximas = contas.length > 0
    ? await proximasReunioes(admin, user.id, org.organizationId).catch(() => ({ reunioes: [], erros: ["Não foi possível ler a agenda agora."] }))
    : { reunioes: [], erros: [] };
  return NextResponse.json({ ativo, contas, ultimaLeitura: config.data?.ultima_leitura ?? null, erroDaLeitura: config.data?.erro ?? null, proximas: proximas.reunioes, errosDaAgenda: proximas.erros }, { headers: SEM_CACHE });
}

export async function PUT(req: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response;
  const corpo = await req.json().catch(() => null) as { organization_id?: string; ativo?: boolean } | null;
  if (typeof corpo?.ativo !== "boolean") return NextResponse.json({ error: "Informe se quer ligar ou desligar" }, { status: 400 });
  const org = await resolveAuthorizedOrganizationId(corpo.organization_id ?? null);
  if (!org.authorized || !org.organizationId) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  if (corpo.ativo && (await listPublicConnections(user.id)).length === 0) {
    return NextResponse.json({ error: "Conecte primeiro o Google Agenda ou o Outlook." }, { status: 409 });
  }
  const { error } = await createAdminClient().from("reunioes_calendario_config").upsert(
    { user_id: user.id, organization_id: org.organizationId, ativo: corpo.ativo, updated_at: new Date().toISOString() }, { onConflict: "user_id" },
  );
  if (error) return NextResponse.json({ error: "Não foi possível salvar" }, { status: 500 });
  return NextResponse.json({ ativo: corpo.ativo }, { headers: SEM_CACHE });
}

export async function POST(req: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response;
  const corpo = await req.json().catch(() => null) as { organization_id?: string; provider?: string; eventoId?: string; inicio?: string; titulo?: string; voltar?: boolean } | null;
  if (!corpo?.eventoId || !corpo.inicio || (corpo.provider !== "google" && corpo.provider !== "microsoft") || Number.isNaN(Date.parse(corpo.inicio))) {
    return NextResponse.json({ error: "Reunião inválida" }, { status: 400 });
  }
  const org = await resolveAuthorizedOrganizationId(corpo.organization_id ?? null);
  if (!org.authorized || !org.organizationId) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const admin = createAdminClient();
  const inicio = new Date(corpo.inicio).toISOString();
  if (corpo.voltar) {
    // "voltar a cobrir": só desfaz o que a própria pessoa tirou, nunca uma reunião que já teve robô
    await admin.from("reunioes_calendario_eventos").delete().eq("user_id", user.id).eq("provider", corpo.provider).eq("evento_id", corpo.eventoId).eq("inicio", inicio).eq("situacao", "ignorada");
    return NextResponse.json({ ok: true }, { headers: SEM_CACHE });
  }
  const { error } = await admin.from("reunioes_calendario_eventos").insert({
    user_id: user.id, organization_id: org.organizationId, provider: corpo.provider, evento_id: corpo.eventoId, inicio, titulo: corpo.titulo?.slice(0, 200) ?? null, situacao: "ignorada",
  });
  if (error && error.code !== "23505") return NextResponse.json({ error: "Não foi possível salvar" }, { status: 500 });
  return NextResponse.json({ ok: true }, { headers: SEM_CACHE });
}
