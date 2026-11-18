// Liga a agenda ao robô: para cada pessoa que ativou "Reuniões pelo calendário", lê os eventos de agora, aplica a regra (só com convidado de fora da instituição) e manda o robô
// do Vexa na hora da reunião. O robô só é enviado perto do começo, então reunião remarcada ou cancelada não gasta nada. Rodado a cada 3 minutos por /api/reunioes/calendario/sincronizar.

import type { SupabaseClient } from "@supabase/supabase-js";
import { getConnection, getValidAccessToken } from "@/lib/calendar/connections";
import type { CalendarProvider } from "@/lib/calendar/config";
import { enviarBot } from "./vexa";
import { usoDaOrganizacao } from "./uso";
import { decidirEntrada, textoDoMotivo, type ContextoDaInstituicao, type Decisao } from "./regra-do-calendario";
import { lerEventosDaMicrosoft, lerEventosDoGoogle, type EventoLido } from "./eventos-do-calendario";

/** O robô é enviado de 4 minutos antes do começo até 10 minutos depois (quem atrasou a leitura ainda alcança a reunião no meio). */
export const ANTES_DO_COMECO_MS = 4 * 60_000;
export const DEPOIS_DO_COMECO_MS = 10 * 60_000;
const PROVEDORES: CalendarProvider[] = ["google", "microsoft"];

export function naJanelaDeEntrada(inicioIso: string, agora: Date): boolean {
  const diferenca = new Date(inicioIso).getTime() - agora.getTime();
  return diferenca <= ANTES_DO_COMECO_MS && diferenca >= -DEPOIS_DO_COMECO_MS;
}

/** O link do Meet sem parâmetros de rastreio, para duas pessoas da mesma reunião não gerarem dois robôs; o do Teams fica inteiro (o código está no caminho). */
export function chaveDaReuniao(url: string): string {
  try {
    const endereco = new URL(url);
    return endereco.hostname === "meet.google.com" ? `${endereco.origin}${endereco.pathname}` : endereco.toString();
  } catch { return url; }
}

export type ProximaReuniao = { provider: CalendarProvider; eventoId: string; titulo: string; inicio: string; plataforma: string | null; entra: boolean; motivo: string; ignorada: boolean };

async function contextoDaInstituicao(admin: SupabaseClient, organizationId: string, emailDaConta: string): Promise<ContextoDaInstituicao> {
  const { data: membros } = await admin.from("organization_members").select("user_id").eq("organization_id", organizationId);
  const ids = (membros ?? []).map(membro => membro.user_id as string);
  const { data: perfis } = ids.length ? await admin.from("profiles").select("email").in("id", ids) : { data: [] as Array<{ email: string | null }> };
  return { emailDaConta, emailsDosMembros: (perfis ?? []).map(perfil => perfil.email).filter((email): email is string => Boolean(email)) };
}

/** Lê os eventos entre dois instantes de todas as agendas conectadas da pessoa, já com a decisão da regra. Falha de uma agenda não derruba a outra. */
export async function lerAgendasDaPessoa(admin: SupabaseClient, userId: string, organizationId: string, de: Date, ate: Date): Promise<{ itens: Array<{ provider: CalendarProvider; evento: EventoLido; decisao: Decisao }>; erros: string[] }> {
  const itens: Array<{ provider: CalendarProvider; evento: EventoLido; decisao: Decisao }> = [];
  const erros: string[] = [];
  for (const provider of PROVEDORES) {
    const conexao = await getConnection(userId, provider);
    if (!conexao) continue;
    try {
      const token = await getValidAccessToken(userId, provider);
      const eventos = provider === "google" ? await lerEventosDoGoogle(token, conexao.calendar_id || "primary", de, ate) : await lerEventosDaMicrosoft(token, conexao.calendar_id || "primary", de, ate);
      const contexto = await contextoDaInstituicao(admin, organizationId, conexao.provider_account_email ?? "");
      for (const evento of eventos) if (!evento.cancelado) itens.push({ provider, evento, decisao: decidirEntrada(evento, contexto) });
    } catch (erro) {
      erros.push(`${provider === "google" ? "Google" : "Microsoft"}: ${erro instanceof Error ? erro.message : "falha ao ler a agenda"}`);
    }
  }
  return { itens, erros };
}

/** A lista "próximas reuniões" da tela de configurações: o que o robô cobre e o que fica de fora, com o motivo. */
export async function proximasReunioes(admin: SupabaseClient, userId: string, organizationId: string, dias = 7, agora = new Date()): Promise<{ reunioes: ProximaReuniao[]; erros: string[] }> {
  const { itens, erros } = await lerAgendasDaPessoa(admin, userId, organizationId, agora, new Date(agora.getTime() + dias * 86_400_000));
  const { data: ignoradas } = await admin.from("reunioes_calendario_eventos").select("provider, evento_id, inicio").eq("user_id", userId).eq("situacao", "ignorada");
  const chaveIgnorada = new Set((ignoradas ?? []).map(linha => `${linha.provider}|${linha.evento_id}|${new Date(linha.inicio as string).toISOString()}`));
  const reunioes = itens
    .filter(({ evento }) => evento.linkDeVideo && evento.plataforma)
    .map(({ provider, evento, decisao }) => ({
      provider, eventoId: evento.id, titulo: evento.titulo, inicio: evento.inicio, plataforma: evento.plataforma, entra: decisao.entra, motivo: textoDoMotivo(decisao),
      ignorada: chaveIgnorada.has(`${provider}|${evento.id}|${evento.inicio}`),
    }))
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
  return { reunioes, erros };
}

export type ResultadoDaSincronizacao = { pessoas: number; enviadas: number; ignoradas: number; erros: string[] };

/** Uma rodada: percorre quem ativou e manda o robô nas reuniões que cobrem a regra e estão na janela de entrada. */
export async function sincronizarCalendarios(admin: SupabaseClient, agora = new Date()): Promise<ResultadoDaSincronizacao> {
  const resultado: ResultadoDaSincronizacao = { pessoas: 0, enviadas: 0, ignoradas: 0, erros: [] };
  const { data: configs, error } = await admin.from("reunioes_calendario_config").select("user_id, organization_id").eq("ativo", true);
  if (error) { resultado.erros.push("não foi possível ler quem ativou"); return resultado; }

  for (const config of configs ?? []) {
    const userId = config.user_id as string, organizationId = config.organization_id as string;
    resultado.pessoas++;
    const { itens, erros } = await lerAgendasDaPessoa(admin, userId, organizationId, new Date(agora.getTime() - DEPOIS_DO_COMECO_MS - 120_000), new Date(agora.getTime() + ANTES_DO_COMECO_MS + 120_000));
    await admin.from("reunioes_calendario_config").update({ ultima_leitura: agora.toISOString(), erro: erros.join(" · ") || null }).eq("user_id", userId);
    resultado.erros.push(...erros);

    for (const { provider, evento, decisao } of itens) {
      if (!decisao.entra || !evento.linkDeVideo || !evento.plataforma || !naJanelaDeEntrada(evento.inicio, agora)) continue;
      // reserva o evento antes de mandar o robô: duas rodadas ao mesmo tempo, ou o "não entrar nesta", esbarram na chave única e saem
      const reserva = await admin.from("reunioes_calendario_eventos").insert({ user_id: userId, organization_id: organizationId, provider, evento_id: evento.id, inicio: evento.inicio, titulo: evento.titulo, situacao: "enviando" }).select("id").single();
      if (reserva.error || !reserva.data) { if (reserva.error?.code !== "23505") resultado.erros.push(`reserva: ${reserva.error?.message}`); continue; }
      const registro = reserva.data.id as string;
      const fechar = (situacao: string, extra: Record<string, unknown> = {}) => admin.from("reunioes_calendario_eventos").update({ situacao, ...extra }).eq("id", registro);

      try {
        // outra pessoa da mesma reunião já mandou o robô?
        const desde = new Date(agora.getTime() - 3 * 3_600_000).toISOString();
        const { data: recentes } = await admin.from("reunioes").select("url_reuniao").eq("organization_id", organizationId).neq("status", "falhou").gte("created_at", desde);
        if ((recentes ?? []).some(linha => chaveDaReuniao(linha.url_reuniao as string) === chaveDaReuniao(evento.linkDeVideo as string))) { await fechar("duplicada"); resultado.ignoradas++; continue; }

        if ((await usoDaOrganizacao(admin, organizationId, agora)).atingido) { await fechar("limite"); resultado.ignoradas++; continue; }

        const bot = await enviarBot({ meetingUrl: evento.linkDeVideo });
        const { data: reuniao, error: erroReuniao } = await admin.from("reunioes").insert({
          organization_id: organizationId, titulo: evento.titulo, plataforma: evento.plataforma, url_reuniao: evento.linkDeVideo, status: "bot_entrando",
          vexa_bot_id: bot.id, agendada_para: evento.inicio, created_by: userId,
        }).select("id").single();
        if (erroReuniao) throw new Error(erroReuniao.message);
        await fechar("enviada", { reuniao_id: reuniao.id });
        resultado.enviadas++;
      } catch (erro) {
        const mensagem = erro instanceof Error ? erro.message : "falha ao enviar o robô";
        await fechar("erro", { erro: mensagem.slice(0, 500) });
        resultado.erros.push(`${evento.titulo}: ${mensagem}`);
      }
    }
  }
  return resultado;
}
