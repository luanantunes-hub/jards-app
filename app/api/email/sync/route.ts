import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/calendar/require-user";
import type { EmailProvider } from "@/lib/email/config";
import { getValidEmailAccessToken, listEmailConnections } from "@/lib/email/connections";
import { buscarMensagensDeContatos } from "@/lib/email/google";
import { enderecosParaBusca, filtroDesde } from "@/lib/email/historico";
import { interacaoDoEmail } from "@/lib/email/interacoes";
import { emLotes, emPartes } from "@/lib/email/lotes";
import { buscarMensagensDeContatosMicrosoft } from "@/lib/email/microsoft";
import { sincronizarDesconhecidos } from "@/lib/email/sincronizar-desconhecidos";
import { decisorDeVisibilidade, type EmailExistente } from "@/lib/email/visibilidade";
import { createAdminClient } from "@/lib/supabase/admin";

// A primeira sincronização traz o histórico de cada contato e pode levar alguns segundos.
export const maxDuration = 60;

const PRIMEIRA_SINCRONIZACAO_DIAS = 180;
const INTERVALO_MINIMO_MS = 15 * 60_000;

function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

type Resultado = { synced?: number; scanned?: number; ignored?: number; triagem?: number; skipped?: boolean; error?: string };

/** Sincroniza uma conexão (Gmail ou Microsoft). Devolve o status HTTP e o corpo da resposta. */
async function sincronizarUma(userId: string, provider: EmailProvider, force: boolean): Promise<{ status: number; corpo: Resultado }> {
  const supabase = createAdminClient();
  const marcarSincronizada = () =>
    (supabase as any)
      .from("email_connections")
      .update({ last_sync_at: new Date().toISOString(), last_error: null })
      .eq("user_id", userId)
      .eq("provider", provider);

  try {
    const { data: conn } = await (supabase as any)
      .from("email_connections")
      .select("provider_account_email, organization_id, sync_enabled, last_sync_at")
      .eq("user_id", userId)
      .eq("provider", provider)
      .maybeSingle();

    if (!conn) return { status: 400, corpo: { error: "Conta não conectada" } };
    if (!conn.sync_enabled) return { status: 200, corpo: { synced: 0, skipped: true } };

    const lastSyncAt = conn.last_sync_at ? new Date(conn.last_sync_at) : null;
    if (!force && lastSyncAt && Date.now() - lastSyncAt.getTime() < INTERVALO_MINIMO_MS) {
      return { status: 200, corpo: { synced: 0, skipped: true } };
    }

    const userEmail = conn.provider_account_email ?? "";
    const organizationId = conn.organization_id;
    if (!organizationId) {
      return { status: 400, corpo: { error: "Conexão sem organização válida" } };
    }

    const { data: membership } = await (supabase as any)
      .from("organization_members")
      .select("organization_id")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership) {
      return { status: 403, corpo: { error: "Acesso à organização revogado" } };
    }

    const accessToken = await getValidEmailAccessToken(userId, provider);

    // Contatos são a fronteira de privacidade: o provedor só é consultado pelos endereços dos contatos
    // e apenas mensagens com uma correspondência exata entram na memória compartilhada do CRM.
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

    // Primeira sincronização: o histórico dos últimos 180 dias. Depois, desde a última, com uma pequena
    // sobreposição para não perder mensagens na fronteira; o upsert e o Message-ID mantêm tudo idempotente.
    const desde = lastSyncAt
      ? new Date(lastSyncAt.getTime() - 6 * 60 * 60_000)
      : new Date(Date.now() - PRIMEIRA_SINCRONIZACAO_DIAS * 24 * 60 * 60_000);
    const enderecos = enderecosParaBusca([...emailToContato.keys()]);
    const busca = provider === "microsoft"
      ? await buscarMensagensDeContatosMicrosoft(accessToken, userEmail, enderecos, desde)
      : await buscarMensagensDeContatos(accessToken, userEmail, enderecos, filtroDesde(desde));
    const messages = busca.mensagens;
    if (messages.length === 0) {
      await marcarSincronizada();
      return { status: 200, corpo: { synced: 0 } };
    }

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
      await marcarSincronizada();
      return { status: 200, corpo: { synced: 0, scanned: messages.length, ignored: messages.length } };
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
      return existing.length === 0 || existing.some((email) => email.user_id === userId && email.message_id === message.id);
    });

    if (matched.length === 0) {
      await marcarSincronizada();
      return { status: 200, corpo: { synced: 0, scanned: messages.length, ignored: messages.length } };
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

    // "Só eu vejo" vale para a conversa inteira e sobrevive à sincronização: mensagem nova de uma conversa
    // privada nasce privada, e a que já existe não volta a ser da equipe só por ter sido lida de novo.
    const fios = [...new Set(matched.map(({ message }) => message.threadId).filter(Boolean))];
    const existentes = (
      await emLotes(emPartes(fios, 30), 3, async (grupo) => {
        const { data, error: existentesError } = await (supabase as any)
          .from("emails")
          .select("message_id, thread_id, visibility")
          .eq("user_id", userId)
          .eq("organization_id", organizationId)
          .in("thread_id", grupo);
        if (existentesError) throw new Error(existentesError.message);
        return (data ?? []) as EmailExistente[];
      })
    ).flat();
    const decidirVisibilidade = decisorDeVisibilidade(existentes);

    const rows = matched.map(({ message: m, contact }) => {
      const companyCaptacoes = contact.empresa_crm_id
        ? activeCaptacoes.get(contact.empresa_crm_id) ?? []
        : [];
      const captacaoId = companyCaptacoes.length === 1 ? companyCaptacoes[0].id : null;

      return {
        organization_id: organizationId,
        user_id: userId,
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
        visibility: decidirVisibilidade({ id: m.id, threadId: m.threadId }),
      };
    });

    const { data: savedEmails, error } = await (supabase as any)
      .from("emails")
      .upsert(rows, { onConflict: "user_id,message_id" })
      .select("id, message_id, contato_id, empresa_crm_id, captacao_id, direction, subject, snippet, body_text, sent_at, visibility");

    if (error) throw new Error(error.message);

    // A interação aparece para a organização inteira: só os e-mails visíveis à equipe a recebem.
    const interactions = (savedEmails ?? [])
      .filter((email: { visibility: string }) => email.visibility === "organization")
      .map((email: Parameters<typeof interacaoDoEmail>[0]) => interacaoDoEmail(email, organizationId, userId));

    if (interactions.length > 0) {
      const { error: interactionError } = await (supabase as any)
        .from("crm_interacoes")
        .upsert(interactions, { onConflict: "email_id" });
      if (interactionError) throw new Error(interactionError.message);
    }

    await marcarSincronizada();

    return {
      status: 200,
      corpo: {
        synced: savedEmails?.length ?? 0,
        scanned: messages.length,
        ignored: messages.length - matched.length,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao sincronizar emails";
    // O erro aparece no cartão de e-mail em Configurações, para a pessoa saber que precisa reconectar.
    await (supabase as any)
      .from("email_connections")
      .update({ last_error: message.slice(0, 500) })
      .eq("user_id", userId)
      .eq("provider", provider);
    return { status: 500, corpo: { error: message } };
  }
}

/** A triagem de remetentes desconhecidos de uma conexão. Erros viram aviso no cartão de e-mail, sem derrubar o resto. */
async function sincronizarTriagem(userId: string, provider: EmailProvider): Promise<number> {
  const supabase = createAdminClient();
  try {
    const { data: conn } = await (supabase as any)
      .from("email_connections")
      .select("provider_account_email, organization_id")
      .eq("user_id", userId)
      .eq("provider", provider)
      .maybeSingle();
    if (!conn?.organization_id || !conn.provider_account_email) return 0;
    const accessToken = await getValidEmailAccessToken(userId, provider);
    const { guardados } = await sincronizarDesconhecidos({
      banco: supabase as any,
      userId,
      organizationId: conn.organization_id,
      provider,
      accessToken,
      emailDaConta: conn.provider_account_email,
    });
    return guardados;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao separar os e-mails de quem não é contato";
    await (supabase as any)
      .from("email_connections")
      .update({ last_error: `Triagem: ${message}`.slice(0, 500) })
      .eq("user_id", userId)
      .eq("provider", provider);
    return 0;
  }
}

/**
 * Sincroniza as conexões de e-mail da pessoa. Sem `provider`, todas (Gmail e Microsoft); com ele, só aquela.
 * O intervalo mínimo de 15 minutos vale por conexão, a menos que venha `force`.
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response!;

  const body = (await req.json().catch(() => ({}))) as { force?: boolean; provider?: EmailProvider };
  const provider = body.provider === "google" || body.provider === "microsoft" ? body.provider : null;

  let alvos: EmailProvider[];
  try {
    alvos = provider ? [provider] : (await listEmailConnections(user.id)).map((conexao) => conexao.provider);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao buscar conexões";
    return NextResponse.json({ error: message }, { status: 500 });
  }
  if (alvos.length === 0) return NextResponse.json({ synced: 0, skipped: true });

  const total: Resultado = { synced: 0, scanned: 0, ignored: 0 };
  let status = 200;
  const erros: string[] = [];
  let todasPuladas = true;
  for (const alvo of alvos) {
    const { status: statusDaConexao, corpo } = await sincronizarUma(user.id, alvo, body.force === true);
    // E-mails de quem ainda não é contato vão para a triagem. Uma falha aqui não derruba a sincronização de contatos.
    if (statusDaConexao < 400 && !corpo.skipped) corpo.triagem = await sincronizarTriagem(user.id, alvo);
    if (statusDaConexao >= 400) {
      status = statusDaConexao;
      if (corpo.error) erros.push(corpo.error);
    }
    if (!corpo.skipped) todasPuladas = false;
    total.synced = (total.synced ?? 0) + (corpo.synced ?? 0);
    total.scanned = (total.scanned ?? 0) + (corpo.scanned ?? 0);
    total.ignored = (total.ignored ?? 0) + (corpo.ignored ?? 0);
    total.triagem = (total.triagem ?? 0) + (corpo.triagem ?? 0);
  }
  if (erros.length > 0) return NextResponse.json({ ...total, error: erros.join(" · ") }, { status });
  return NextResponse.json(todasPuladas ? { synced: 0, skipped: true } : total);
}
