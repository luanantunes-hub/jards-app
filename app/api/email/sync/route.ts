import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/calendar/require-user";
import { getValidEmailAccessToken } from "@/lib/email/connections";
import { fetchGmailMessages } from "@/lib/email/google";
import { createAdminClient } from "@/lib/supabase/admin";

function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function interactionSummary(body: string | null, snippet: string | null): string | null {
  const source = body || snippet;
  if (!source) return null;
  const compact = source
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  return compact ? compact.slice(0, 1200) : null;
}

export async function POST(req: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response!;

  try {
    const accessToken = await getValidEmailAccessToken(user.id);

    const supabase = createAdminClient();
    const { data: conn } = await (supabase as any)
      .from("email_connections")
      .select("provider_account_email, organization_id, sync_enabled, last_sync_at")
      .eq("user_id", user.id)
      .eq("provider", "google")
      .maybeSingle();

    if (!conn) return NextResponse.json({ error: "Conta não conectada" }, { status: 400 });
    if (!conn.sync_enabled) return NextResponse.json({ synced: 0, skipped: true });

    const body = await req.json().catch(() => ({})) as { force?: boolean };
    const lastSyncAt = conn.last_sync_at ? new Date(conn.last_sync_at) : null;
    if (!body.force && lastSyncAt && Date.now() - lastSyncAt.getTime() < 15 * 60_000) {
      return NextResponse.json({ synced: 0, skipped: true });
    }

    const userEmail = conn.provider_account_email ?? "";
    const organizationId = conn.organization_id;
    if (!organizationId) {
      return NextResponse.json({ error: "Conexão sem organização válida" }, { status: 400 });
    }

    const { data: membership } = await (supabase as any)
      .from("organization_members")
      .select("organization_id")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) {
      return NextResponse.json({ error: "Acesso à organização revogado" }, { status: 403 });
    }

    // Uma pequena sobreposição evita perder mensagens na fronteira temporal;
    // o upsert e o Message-ID mantêm a operação idempotente.
    const after = lastSyncAt ? new Date(lastSyncAt.getTime() - 6 * 60 * 60_000) : null;
    const messages = await fetchGmailMessages(accessToken, userEmail, 100, after);
    if (messages.length === 0) return NextResponse.json({ synced: 0 });

    // Contatos são a fronteira de privacidade: apenas mensagens com uma
    // correspondência exata entram na memória compartilhada do CRM.
    const { data: contatos } = await (supabase as any)
      .from("contatos")
      .select("id, email, empresa_crm_id")
      .eq("organization_id", organizationId);

    type ContactMatch = { id: string; empresa_crm_id: string | null };
    const emailToContato = new Map<string, ContactMatch>();
    (contatos ?? []).forEach((c: ContactMatch & { email: string | null }) => {
      const email = normalizeEmail(c.email);
      if (email) emailToContato.set(email, { id: c.id, empresa_crm_id: c.empresa_crm_id });
    });

    const matchedCandidates = messages.flatMap((message) => {
      const participantEmails = message.direction === "outbound"
        ? [...message.to, ...message.cc]
        : [message.from];
      const contact = participantEmails
        .map(normalizeEmail)
        .map((email) => emailToContato.get(email))
        .find(Boolean);
      return contact ? [{ message, contact }] : [];
    });

    if (matchedCandidates.length === 0) {
      await (supabase as any)
        .from("email_connections")
        .update({ last_sync_at: new Date().toISOString(), last_error: null })
        .eq("user_id", user.id)
        .eq("provider", "google");
      return NextResponse.json({ synced: 0, scanned: messages.length, ignored: messages.length });
    }

    // O mesmo e-mail pode existir em duas caixas da equipe. O Message-ID RFC
    // evita criar duas interações organizacionais, mas preserva a ressincronização
    // da própria mensagem pelo mesmo usuário.
    const internetIds = matchedCandidates
      .map(({ message }) => message.internetMessageId)
      .filter((value): value is string => Boolean(value));
    const { data: existingOrganizationEmails } = internetIds.length
      ? await (supabase as any)
          .from("emails")
          .select("internet_message_id, user_id, message_id")
          .eq("organization_id", organizationId)
          .eq("visibility", "organization")
          .in("internet_message_id", [...new Set(internetIds)])
      : { data: [] };
    const existingByInternetId = new Map<string, Array<{ user_id: string; message_id: string }>>();
    (existingOrganizationEmails ?? []).forEach((email: { internet_message_id: string; user_id: string; message_id: string }) => {
      const current = existingByInternetId.get(email.internet_message_id) ?? [];
      current.push({ user_id: email.user_id, message_id: email.message_id });
      existingByInternetId.set(email.internet_message_id, current);
    });
    const matched = matchedCandidates.filter(({ message }) => {
      if (!message.internetMessageId) return true;
      const existing = existingByInternetId.get(message.internetMessageId) ?? [];
      return existing.length === 0 || existing.some((email) => email.user_id === user.id && email.message_id === message.id);
    });

    if (matched.length === 0) {
      await (supabase as any)
        .from("email_connections")
        .update({ last_sync_at: new Date().toISOString(), last_error: null })
        .eq("user_id", user.id)
        .eq("provider", "google");
      return NextResponse.json({ synced: 0, scanned: messages.length, ignored: messages.length });
    }

    const companyIds = [...new Set(matched.map(({ contact }) => contact.empresa_crm_id).filter(Boolean))];
    const { data: captacoes } = companyIds.length
      ? await (supabase as any)
          .from("captacoes")
          .select("id, empresa_crm_id, status, updated_at")
          .eq("organization_id", organizationId)
          .in("empresa_crm_id", companyIds)
          .not("status", "in", '("aprovado","recusado")')
          .order("updated_at", { ascending: false })
      : { data: [] };

    const activeCaptacoes = new Map<string, Array<{ id: string }>>();
    (captacoes ?? []).forEach((captacao: { id: string; empresa_crm_id: string }) => {
      const current = activeCaptacoes.get(captacao.empresa_crm_id) ?? [];
      current.push({ id: captacao.id });
      activeCaptacoes.set(captacao.empresa_crm_id, current);
    });

    const rows = matched.map(({ message: m, contact }) => {
      const companyCaptacoes = contact.empresa_crm_id
        ? activeCaptacoes.get(contact.empresa_crm_id) ?? []
        : [];
      const captacaoId = companyCaptacoes.length === 1 ? companyCaptacoes[0].id : null;

      return {
        organization_id: organizationId,
        user_id: user.id,
        message_id: m.id,
        thread_id: m.threadId,
        internet_message_id: m.internetMessageId,
        from_email: m.from,
        from_name: m.fromName,
        to_emails: m.to,
        cc_emails: m.cc,
        subject: m.subject,
        snippet: m.snippet,
        body_text: m.bodyText,
        sent_at: m.sentAt?.toISOString() ?? null,
        direction: m.direction,
        contato_id: contact.id,
        empresa_crm_id: contact.empresa_crm_id,
        captacao_id: captacaoId,
        visibility: "organization",
      };
    });

    const { data: savedEmails, error } = await (supabase as any)
      .from("emails")
      .upsert(rows, { onConflict: "user_id,message_id" })
      .select("id, message_id, contato_id, empresa_crm_id, captacao_id, direction, subject, snippet, body_text, sent_at");

    if (error) throw new Error(error.message);

    const interactions = (savedEmails ?? []).map((email: any) => ({
      organization_id: organizationId,
      account_id: user.id,
      empresa_crm_id: email.empresa_crm_id,
      contato_id: email.contato_id,
      captacao_id: email.captacao_id,
      email_id: email.id,
      tipo: "email",
      canal: "email",
      tipo_interacao: "mensagem",
      direcao: email.direction === "inbound" ? "entrada" : "saida",
      assunto: email.subject?.trim() || "E-mail sem assunto",
      resumo: interactionSummary(email.body_text, email.snippet),
      ocorreu_em: email.sent_at ?? new Date().toISOString(),
      created_by: user.id,
    }));

    const { error: interactionError } = await (supabase as any)
      .from("crm_interacoes")
      .upsert(interactions, { onConflict: "email_id" });
    if (interactionError) throw new Error(interactionError.message);

    await (supabase as any)
      .from("email_connections")
      .update({ last_sync_at: new Date().toISOString(), last_error: null })
      .eq("user_id", user.id)
      .eq("provider", "google");

    return NextResponse.json({
      synced: savedEmails?.length ?? 0,
      scanned: messages.length,
      ignored: messages.length - matched.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao sincronizar emails";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
