import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/calendar/connections";
import { requireUser, resolveAuthorizedOrganizationId } from "@/lib/calendar/require-user";
import { CALENDARIO_DA_PLATAFORMA, fimDaReuniao, linkDaSala, montarEventoDaReuniao, validarPedidoDeReuniao } from "@/lib/reunioes/agendar";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 30;

const NOME_DO_CALENDARIO = { google: "Google Agenda", microsoft: "Outlook" } as const;

/**
 * Marca a reunião no calendário da pessoa e cria a sala junto: o Meet nasce na agenda do Google e o Teams na do
 * Outlook, então a conexão de calendário desse provedor precisa existir. A reunião fica gravada como "agendada".
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response!;

  const corpo = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const validacao = validarPedidoDeReuniao(corpo);
  if (!validacao.ok) return NextResponse.json({ error: validacao.erro }, { status: 400 });
  const { pedido } = validacao;

  const organizacao = await resolveAuthorizedOrganizationId(typeof corpo?.organizationId === "string" ? corpo.organizationId : null);
  if (!organizacao.authorized || !organizacao.organizationId) {
    return NextResponse.json({ error: "Organização inválida" }, { status: 403 });
  }
  const organizationId = organizacao.organizationId;
  const provider = CALENDARIO_DA_PLATAFORMA[pedido.plataforma];

  try {
    const admin = createAdminClient();

    // Os vínculos precisam ser da mesma organização: ninguém marca reunião no cadastro de outra.
    for (const [tabela, id] of [["empresas_crm", pedido.empresaCrmId], ["captacoes", pedido.captacaoId]] as const) {
      if (!id) continue;
      const { data } = await (admin as any).from(tabela).select("id").eq("id", id).eq("organization_id", organizationId).maybeSingle();
      if (!data) return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
    }

    let accessToken: string;
    try {
      accessToken = await getValidAccessToken(user.id, provider);
    } catch {
      return NextResponse.json(
        { error: `Conecte sua ${NOME_DO_CALENDARIO[provider]} em Configurações › Minhas ferramentas para marcar uma reunião no ${pedido.plataforma === "google_meet" ? "Meet" : "Teams"}.`, conectar: provider },
        { status: 409 },
      );
    }

    const evento = montarEventoDaReuniao(pedido, randomUUID());
    const endereco = provider === "google"
      ? "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all"
      : "https://graph.microsoft.com/v1.0/me/events";
    const resposta = await fetch(endereco, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(evento),
    });
    const criado = (await resposta.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
    if (!resposta.ok || !criado.id) {
      return NextResponse.json({ error: criado.error?.message || `Não foi possível criar o evento no calendário (${resposta.status}).` }, { status: 502 });
    }

    const url = linkDaSala(pedido.plataforma, criado);
    if (!url) {
      // Sem sala não há como entrar: desmarca o que acabou de ser criado, para não deixar lixo na agenda.
      const base = provider === "google"
        ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(criado.id)}`
        : `https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(criado.id)}`;
      await fetch(base, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }).catch(() => {});
      return NextResponse.json({ error: `O ${pedido.plataforma === "google_meet" ? "Meet" : "Teams"} não devolveu o link da sala. Tente de novo.` }, { status: 502 });
    }

    const { data: reuniao, error } = await (admin as any)
      .from("reunioes")
      .insert({
        organization_id: organizationId,
        titulo: pedido.titulo,
        plataforma: pedido.plataforma,
        url_reuniao: url,
        status: "agendada",
        agendada_para: pedido.comeca.toISOString(),
        participantes: pedido.participantes,
        empresa_crm_id: pedido.empresaCrmId,
        captacao_id: pedido.captacaoId,
        calendar_provider: provider,
        calendar_event_id: criado.id,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    return NextResponse.json({ id: reuniao.id, url, termina: fimDaReuniao(pedido.comeca, pedido.duracaoMin).toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao marcar a reunião";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
