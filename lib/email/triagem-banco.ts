import { enderecosParaBusca } from "./historico";
import { emPartes } from "./lotes";
import type { BancoDaTriagem } from "./sincronizar-desconhecidos";
import type { EmailDeTriagem } from "./triagem";

type Resposta<T> = { data: T[] | null; error: { message: string } | null };

/** Lê uma consulta inteira, página a página: o Supabase corta em 1.000 linhas sem avisar. */
export async function lerTodas<T>(consulta: (de: number, ate: number) => PromiseLike<Resposta<T>>, tamanho = 1000): Promise<T[]> {
  const todas: T[] = [];
  for (let de = 0; ; de += tamanho) {
    const { data, error } = await consulta(de, de + tamanho - 1);
    if (error) throw new Error(error.message);
    todas.push(...(data ?? []));
    if ((data ?? []).length < tamanho) break;
  }
  return todas;
}

const COLUNAS = "id, from_email, from_name, to_emails, cc_emails, direction, subject, snippet, sent_at, contato_id, visibility";

export type EmailDoRemetente = EmailDeTriagem & { contato_id: string | null; visibility: string };

/** Os e-mails da pessoa trocados com esses endereços: recebidos deles ou enviados a eles (Para ou Cc). */
export async function emailsDosRemetentes(
  banco: BancoDaTriagem,
  userId: string,
  organizationId: string,
  enderecos: readonly string[],
): Promise<EmailDoRemetente[]> {
  const validos = enderecosParaBusca(enderecos);
  const porId = new Map<string, EmailDoRemetente>();
  for (const parte of emPartes(validos, 80)) {
    const base = () => banco.from("emails").select(COLUNAS).eq("user_id", userId).eq("organization_id", organizationId);
    const consultas = [
      base().in("from_email", parte).limit(1000),
      base().overlaps("to_emails", parte).limit(1000),
      base().overlaps("cc_emails", parte).limit(1000),
    ];
    for (const consulta of consultas) {
      const { data, error } = (await consulta) as Resposta<EmailDoRemetente>;
      if (error) throw new Error(error.message);
      for (const email of data ?? []) porId.set(email.id, email);
    }
  }
  return [...porId.values()];
}

/** `ilike` trata % _ e \ como curingas: o endereço vira texto literal. */
export function literalParaIlike(texto: string): string {
  return texto.replace(/[\\%_]/g, (caractere) => `\\${caractere}`);
}
