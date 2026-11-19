import { mudarVisibilidadeDaConversa, type BancoDeEmails } from "./mudar-visibilidade";
import type { BancoDaTriagem } from "./sincronizar-desconhecidos";
import { emailsDosRemetentes, literalParaIlike } from "./triagem-banco";
import { emPartes } from "./lotes";

type Banco = BancoDaTriagem & BancoDeEmails;

export type ResultadoDaAcao = { status: 200; corpo: Record<string, unknown> } | { status: 400 | 403 | 404 | 409 | 500; corpo: { error: string } };

/** A pessoa só trata remetentes que estão pendentes na triagem dela: é a regra de segurança das duas ações. */
async function remetentePendente(banco: Banco, userId: string, organizationId: string, endereco: string): Promise<boolean> {
  const { data, error } = await banco
    .from("email_triagem")
    .select("endereco")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .eq("endereco", endereco)
    .eq("estado", "pendente")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

async function marcarEstado(banco: Banco, userId: string, organizationId: string, endereco: string, estado: "registrado" | "dispensado") {
  const { error } = await banco
    .from("email_triagem")
    .update({ estado, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .eq("endereco", endereco);
  if (error) throw new Error(error.message);
}

/**
 * Passo "registrar": liga os e-mails desse remetente ao contato que a pessoa criou e os mostra para a equipe, no
 * histórico da empresa. Sem contato ainda, não há onde registrar: a pessoa precisa criar o contato primeiro.
 */
export async function registrarRemetente(banco: Banco, userId: string, organizationId: string, enderecoBruto: string): Promise<ResultadoDaAcao> {
  const endereco = enderecoBruto.trim().toLowerCase();
  if (!(await remetentePendente(banco, userId, organizationId, endereco))) {
    return { status: 404, corpo: { error: "Remetente não encontrado na triagem" } };
  }

  const { data: candidatos, error: erroContato } = await banco
    .from("contatos")
    .select("id, email, empresa_crm_id")
    .eq("organization_id", organizationId)
    .ilike("email", literalParaIlike(endereco))
    .limit(5);
  if (erroContato) throw new Error(erroContato.message);
  const contato = ((candidatos ?? []) as Array<{ id: string; email: string | null; empresa_crm_id: string | null }>)
    .find((candidato) => (candidato.email ?? "").trim().toLowerCase() === endereco);
  if (!contato) return { status: 409, corpo: { error: "Crie o contato antes de registrar a conversa." } };

  const emails = await emailsDosRemetentes(banco, userId, organizationId, [endereco]);
  // Só o que veio da triagem: e-mails que a pessoa já ligou a outro contato não são mexidos.
  const ids = emails.filter((email) => email.contato_id === null || email.contato_id === contato.id).map((email) => email.id);
  if (ids.length === 0) return { status: 404, corpo: { error: "Nenhum e-mail desse remetente foi encontrado" } };

  for (const parte of emPartes(ids, 50)) {
    const { error } = await banco
      .from("emails")
      .update({ contato_id: contato.id, empresa_crm_id: contato.empresa_crm_id })
      .eq("user_id", userId)
      .eq("organization_id", organizationId)
      .in("id", parte);
    if (error) throw new Error(error.message);
  }

  const resultado = await mudarVisibilidadeDaConversa(banco, userId, ids, "organization");
  if (resultado.status !== 200) return resultado;
  await marcarEstado(banco, userId, organizationId, endereco, "registrado");
  return { status: 200, corpo: { registrados: resultado.corpo.atualizados } };
}

/** Passo "dispensar": a pessoa não quer esse remetente no Jards. Apaga as cópias que ainda não foram ligadas a contato e não o traz de volta. */
export async function dispensarRemetente(banco: Banco, userId: string, organizationId: string, enderecoBruto: string): Promise<ResultadoDaAcao> {
  const endereco = enderecoBruto.trim().toLowerCase();
  if (!(await remetentePendente(banco, userId, organizationId, endereco))) {
    return { status: 404, corpo: { error: "Remetente não encontrado na triagem" } };
  }
  const emails = await emailsDosRemetentes(banco, userId, organizationId, [endereco]);
  const soDaTriagem = emails.filter((email) => email.contato_id === null && email.visibility === "private").map((email) => email.id);
  for (const parte of emPartes(soDaTriagem, 50)) {
    const { error } = await banco.from("emails").delete().eq("user_id", userId).eq("organization_id", organizationId).in("id", parte);
    if (error) throw new Error(error.message);
  }
  await marcarEstado(banco, userId, organizationId, endereco, "dispensado");
  return { status: 200, corpo: { apagados: soDaTriagem.length } };
}
