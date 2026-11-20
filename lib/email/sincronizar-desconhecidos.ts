import { buscarMensagensRecentesGmail } from "./google";
import { emPartes } from "./lotes";
import type { MensagemDeEmail } from "./mensagem";
import { buscarMensagensRecentesMicrosoft } from "./microsoft";
import type { EmailProvider } from "./config";
import { contraparteDaTriagem, DIAS_DA_TRIAGEM, LIMITE_DA_TRIAGEM } from "./triagem";
import { lerTodas } from "./triagem-banco";

/** O cliente do Supabase com permissão de servidor (ou um falso, nos testes). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BancoDaTriagem = { from: (tabela: string) => any };

type Entrada = {
  banco: BancoDaTriagem;
  userId: string;
  organizationId: string;
  provider: EmailProvider;
  accessToken: string;
  emailDaConta: string;
  agora?: Date;
  /** Quem busca as mensagens recentes no provedor; os testes trocam por uma lista pronta. */
  buscar?: (desde: Date) => Promise<MensagemDeEmail[]>;
};

/**
 * Guarda, só para a pessoa, os e-mails recentes de quem ainda não é contato, e marca cada remetente como "pendente"
 * na triagem. Nada vai para a equipe: a visibilidade é "private" e não nasce interação do CRM. Quem a pessoa já
 * tratou ou dispensou não volta, e o corpo das mensagens nunca é lido (só cabeçalho e trecho).
 */
export async function sincronizarDesconhecidos({ banco, userId, organizationId, provider, accessToken, emailDaConta, agora = new Date(), buscar }: Entrada): Promise<{ guardados: number; remetentes: number }> {
  const contatos = await lerTodas<{ email: string | null }>((de, ate) =>
    banco.from("contatos").select("email").eq("organization_id", organizationId).range(de, ate));
  const { data: triagem, error: erroTriagem } = await banco
    .from("email_triagem")
    .select("endereco, estado")
    .eq("user_id", userId)
    .eq("organization_id", organizationId);
  if (erroTriagem) throw new Error(erroTriagem.message);

  const enderecosDeContatos = new Set<string>(
    contatos.map((contato) => (contato.email ?? "").trim().toLowerCase()).filter(Boolean),
  );
  // Remetente já tratado ou dispensado não volta; o que está pendente segue pendente e ganha as mensagens novas.
  const tratados = new Set<string>(
    ((triagem ?? []) as Array<{ endereco: string; estado: string }>).filter((linha) => linha.estado !== "pendente").map((linha) => linha.endereco),
  );
  const filtros = { emailDaConta, contatos: enderecosDeContatos, tratados };

  const desde = new Date(agora.getTime() - DIAS_DA_TRIAGEM * 24 * 60 * 60_000);
  const recentes = buscar
    ? await buscar(desde)
    : provider === "microsoft"
      ? await buscarMensagensRecentesMicrosoft(accessToken, emailDaConta, desde)
      : await buscarMensagensRecentesGmail(accessToken, emailDaConta, desde);

  const escolhidas = recentes
    .flatMap((mensagem) => {
      const contraparte = contraparteDaTriagem(mensagem, filtros);
      return contraparte ? [{ mensagem, contraparte }] : [];
    })
    .slice(0, LIMITE_DA_TRIAGEM);
  if (escolhidas.length === 0) return { guardados: 0, remetentes: 0 };

  // Um nome por remetente, o que ele usa nos e-mails que mandou.
  const nomes = new Map<string, string | null>();
  for (const { mensagem, contraparte } of escolhidas) {
    if (!nomes.has(contraparte) || (!nomes.get(contraparte) && mensagem.direction === "inbound")) {
      nomes.set(contraparte, mensagem.direction === "inbound" ? mensagem.fromName : null);
    }
  }
  const remetentes = [...nomes.entries()].map(([endereco, nome]) => ({
    user_id: userId,
    organization_id: organizationId,
    endereco,
    nome,
    estado: "pendente",
  }));
  for (const parte of emPartes(remetentes, 100)) {
    const { error } = await banco.from("email_triagem").upsert(parte, { onConflict: "user_id,organization_id,endereco", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }

  const linhas = escolhidas.map(({ mensagem: m }) => ({
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
    body_text: null,
    sent_at: m.sentAt?.toISOString() ?? null,
    direction: m.direction,
    contato_id: null,
    empresa_crm_id: null,
    captacao_id: null,
    visibility: "private",
  }));
  // `ignoreDuplicates`: o que já foi guardado (e talvez ligado a um contato depois) não é sobrescrito.
  for (const parte of emPartes(linhas, 100)) {
    const { error } = await banco.from("emails").upsert(parte, { onConflict: "user_id,message_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }
  return { guardados: linhas.length, remetentes: remetentes.length };
}
