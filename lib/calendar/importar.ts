// Agenda -> Jards: as reuniões marcadas no Google Agenda e no Outlook de quem ligou a sincronização viram atividades do tipo "reunião" na agenda do Jards, ligadas ao contato e à empresa
// quando o e-mail de um convidado bate com um contato do CRM. Rodado a cada 10 minutos por /api/calendar/importar. O que nasceu no Jards e foi para a agenda nunca é importado de volta.
//
// Regras de cuidado:
//  - só reuniões com horário que ainda não terminaram (dia inteiro, como feriado e folga, não entra) e que a pessoa não recusou;
//  - quem está no plano gratuito não recebe a importação, porque cada reunião ocuparia uma das 5 vagas de atividade em aberto;
//  - se a agenda trouxe o máximo de eventos que a leitura aceita, nada é apagado (pode ter faltado evento no fim da lista);
//  - o que foi importado muda com a agenda (título, dia, horário), some se o evento for cancelado ou recusado e é concluído sozinho quando a reunião termina.

import type { SupabaseClient } from "@supabase/supabase-js";
import { getValidAccessToken } from "./connections";
import type { CalendarProvider } from "./config";
import { instanteLocal, partesLocais } from "./horario";
import { lerEventosDaMicrosoft, lerEventosDoGoogle, type EventoLido } from "@/lib/reunioes/eventos-do-calendario";

const DIAS_A_FRENTE = 30;
const LIMITE_DA_LEITURA: Record<CalendarProvider, number> = { google: 250, microsoft: 100 };

export type AtividadeImportada = { nome: string; tipo: "reuniao"; data_inicio: string; data_prevista: string; hora_inicio: string; hora_fim: string; nota: string };

/** Como um evento da agenda vira atividade; nulo quando não deve entrar (dia inteiro, cancelado ou recusado). */
export function atividadeDoEvento(evento: EventoLido, provider: CalendarProvider): AtividadeImportada | null {
  if (evento.diaInteiro || evento.cancelado || evento.minhaResposta === "recusou") return null;
  const inicio = partesLocais(evento.inicio);
  const fimBruto = partesLocais(evento.fim ?? evento.inicio);
  const fim = `${fimBruto.data}T${fimBruto.hora}` < `${inicio.data}T${inicio.hora}` ? inicio : fimBruto;
  const origem = provider === "google" ? "Google Agenda" : "Outlook";
  return {
    nome: evento.titulo.trim().slice(0, 200) || "Reunião sem título", tipo: "reuniao",
    data_inicio: inicio.data, data_prevista: fim.data, hora_inicio: inicio.hora, hora_fim: fim.hora,
    nota: [evento.linkDeVideo ? `Link da reunião: ${evento.linkDeVideo}` : null, `Importada do ${origem}.`].filter(Boolean).join("\n"),
  };
}

type LinhaDaAtividade = { id: string; sync_origin: string | null; nome: string; data_inicio: string | null; data_prevista: string | null; hora_inicio: string | null; hora_fim: string | null; feita: boolean; google_event_id: string | null; microsoft_event_id: string | null };
type Contato = { id: string; email: string | null; empresa_crm_id: string | null };

/** Liga a reunião ao CRM: um único contato conhecido entre os convidados liga o contato e a empresa; vários da mesma empresa ligam só a empresa. */
export function vinculoDosConvidados(emails: readonly string[], contatos: readonly Contato[]): { contato_id: string | null; empresa_crm_id: string | null } {
  const chaves = new Set(emails.map(email => email.toLowerCase()));
  const achados = contatos.filter(contato => contato.email && chaves.has(contato.email.toLowerCase()));
  if (achados.length === 0) return { contato_id: null, empresa_crm_id: null };
  const empresas = new Set(achados.map(contato => contato.empresa_crm_id).filter((id): id is string => Boolean(id)));
  const empresa = empresas.size === 1 ? [...empresas][0] : null;
  return { contato_id: achados.length === 1 ? achados[0].id : null, empresa_crm_id: empresa };
}

export type ResultadoDaImportacao = { pessoas: number; criadas: number; atualizadas: number; removidas: number; concluidas: number; erros: string[] };
type ConexaoDeImportacao = { user_id: string; provider: CalendarProvider; calendar_id: string; organization_id: string | null; provider_account_email: string | null };

function emailsDoEvento(evento: EventoLido, emailDaConta: string | null): string[] {
  const proprio = emailDaConta?.toLowerCase();
  return evento.convidados.filter(convidado => !convidado.recurso && convidado.email.toLowerCase() !== proprio).map(convidado => convidado.email);
}

async function contatosDaOrganizacao(admin: SupabaseClient, organizationId: string, emails: string[]): Promise<Contato[]> {
  const unicos = [...new Set(emails.flatMap(email => [email, email.toLowerCase()]))];
  const achados: Contato[] = [];
  for (let i = 0; i < unicos.length; i += 40) {
    const { data } = await admin.from("contatos").select("id, email, empresa_crm_id").eq("organization_id", organizationId).in("email", unicos.slice(i, i + 40));
    achados.push(...((data ?? []) as Contato[]));
  }
  return achados;
}

async function importarUmaAgenda(admin: SupabaseClient, conexao: ConexaoDeImportacao, agora: Date, resultado: ResultadoDaImportacao): Promise<void> {
  const organizationId = conexao.organization_id as string;
  const { provider, user_id: userId } = conexao;
  const coluna = provider === "google" ? "google_event_id" : "microsoft_event_id";
  const de = instanteLocal(partesLocais(agora).data, "00:00");
  const ate = new Date(agora.getTime() + DIAS_A_FRENTE * 86_400_000);

  const token = await getValidAccessToken(userId, provider);
  const eventos = provider === "google" ? await lerEventosDoGoogle(token, conexao.calendar_id || "primary", de, ate) : await lerEventosDaMicrosoft(token, conexao.calendar_id || "primary", de, ate);
  const truncada = eventos.length >= LIMITE_DA_LEITURA[provider];

  const { data: existentes, error } = await admin.from("atividades")
    .select("id, sync_origin, nome, data_inicio, data_prevista, hora_inicio, hora_fim, feita, google_event_id, microsoft_event_id")
    .or(`account_id.eq.${userId},responsavel_id.eq.${userId}`).not(coluna, "is", null).gte("data_inicio", new Date(de.getTime() - 86_400_000).toISOString());
  if (error) throw new Error(error.message);
  const porEvento = new Map<string, LinhaDaAtividade>();
  for (const linha of (existentes ?? []) as LinhaDaAtividade[]) {
    const id = linha[coluna];
    if (id) porEvento.set(id, linha);
  }

  const desejados = new Set<string>();
  const novosOuMudados: Array<{ evento: EventoLido; dados: AtividadeImportada }> = [];
  for (const evento of eventos) {
    const dados = atividadeDoEvento(evento, provider);
    if (!dados) continue;
    desejados.add(evento.id);
    if (new Date(evento.fim ?? evento.inicio) < agora) continue; // já terminou: não vale importar
    novosOuMudados.push({ evento, dados });
  }

  const contatos = await contatosDaOrganizacao(admin, organizationId, novosOuMudados.flatMap(({ evento }) => emailsDoEvento(evento, conexao.provider_account_email)));
  for (const { evento, dados } of novosOuMudados) {
    const existente = porEvento.get(evento.id);
    if (existente && existente.sync_origin !== provider) continue; // nasceu no Jards (ou é de outra origem): não mexe
    if (existente) {
      const mudou = existente.nome !== dados.nome || existente.data_inicio?.slice(0, 10) !== dados.data_inicio || existente.data_prevista?.slice(0, 10) !== dados.data_prevista
        || existente.hora_inicio?.slice(0, 5) !== dados.hora_inicio || existente.hora_fim?.slice(0, 5) !== dados.hora_fim;
      if (!mudou) continue;
      const { error: falha } = await admin.from("atividades").update({ nome: dados.nome, data_inicio: dados.data_inicio, data_prevista: dados.data_prevista, hora_inicio: dados.hora_inicio, hora_fim: dados.hora_fim, calendar_synced_at: agora.toISOString() }).eq("id", existente.id);
      if (falha) resultado.erros.push(`atualizar "${dados.nome}": ${falha.message}`); else resultado.atualizadas++;
      continue;
    }
    const vinculo = vinculoDosConvidados(emailsDoEvento(evento, conexao.provider_account_email), contatos);
    const { error: falha } = await admin.from("atividades").insert({
      account_id: userId, responsavel_id: userId, organization_id: organizationId, ...dados, ...vinculo,
      calendar_sync_requested: false, feita: false, [coluna]: evento.id, sync_origin: provider, calendar_sync_status: "synced", calendar_synced_at: agora.toISOString(),
    });
    if (falha) { if (falha.code !== "23505") resultado.erros.push(`importar "${dados.nome}": ${falha.message}`); } else resultado.criadas++;
  }

  // o que sumiu da agenda (cancelado, recusado, apagado) sai do Jards; as que já foram concluídas ficam como registro
  if (!truncada) {
    const hoje = partesLocais(agora).data;
    const sumidas = [...porEvento.entries()].filter(([id, linha]) => linha.sync_origin === provider && !linha.feita && !desejados.has(id) && (linha.data_inicio?.slice(0, 10) ?? "") >= hoje);
    for (const [, linha] of sumidas) {
      const { error: falha } = await admin.from("atividades").delete().eq("id", linha.id).eq("sync_origin", provider);
      if (falha) resultado.erros.push(`remover "${linha.nome}": ${falha.message}`); else resultado.removidas++;
    }
  }

  // reunião que já terminou é concluída sozinha, para não virar pendência atrasada
  for (const linha of porEvento.values()) {
    if (linha.sync_origin !== provider || linha.feita) continue;
    const dia = linha.data_prevista?.slice(0, 10) ?? linha.data_inicio?.slice(0, 10);
    if (!dia) continue;
    const fim = instanteLocal(dia, linha.hora_fim?.slice(0, 5) ?? "23:59");
    if (fim >= agora) continue;
    const { error: falha } = await admin.from("atividades").update({ feita: true, data_realizada: fim.toISOString() }).eq("id", linha.id);
    if (falha) resultado.erros.push(`concluir "${linha.nome}": ${falha.message}`); else resultado.concluidas++;
  }
}

/** Uma rodada: percorre as agendas conectadas com a sincronização ligada. Falha de uma agenda fica registrada nela e não derruba as outras. */
export async function importarAgendas(admin: SupabaseClient, agora = new Date()): Promise<ResultadoDaImportacao> {
  const resultado: ResultadoDaImportacao = { pessoas: 0, criadas: 0, atualizadas: 0, removidas: 0, concluidas: 0, erros: [] };
  const { data, error } = await admin.from("calendar_connections").select("user_id, provider, calendar_id, organization_id, provider_account_email").eq("sync_enabled", true);
  if (error) { resultado.erros.push(error.message); return resultado; }
  const gratuita = new Map<string, boolean>();
  const pessoas = new Set<string>();
  for (const conexao of (data ?? []) as ConexaoDeImportacao[]) {
    if (!conexao.organization_id) continue;
    if (!gratuita.has(conexao.organization_id)) {
      const { data: usaGratuito } = await admin.rpc("organization_uses_free_plan", { p_organization_id: conexao.organization_id });
      gratuita.set(conexao.organization_id, usaGratuito !== false);
    }
    if (gratuita.get(conexao.organization_id)) continue;
    pessoas.add(conexao.user_id);
    let falhou: string | null = null;
    try {
      await importarUmaAgenda(admin, conexao, agora, resultado);
    } catch (erro) {
      falhou = erro instanceof Error ? erro.message : "falha ao ler a agenda";
      resultado.erros.push(`${conexao.provider}: ${falhou}`.slice(0, 200));
    }
    await admin.from("calendar_connections").update({ last_sync_at: agora.toISOString(), last_error: falhou ? falhou.slice(0, 300) : null }).eq("user_id", conexao.user_id).eq("provider", conexao.provider);
  }
  resultado.pessoas = pessoas.size;
  resultado.erros = resultado.erros.slice(0, 10);
  return resultado;
}
