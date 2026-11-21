import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { RemetenteDoEnvio } from "@/lib/email/divulgacao";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import type { AssinaturaDoEmail, SituacaoDoRemetente } from "@/lib/ticketeria/estados";
import { COTA_PADRAO_DE_EMAILS, enderecoDeEnvio, inicioDaCota, podeEnviar, PRECO_DO_EMAIL_CENTAVOS, type PodeEnviar, type RegistroDeDns } from "@/lib/ticketeria/remetente";

type Admin = SupabaseClient<Database>;

export type LinhaDoRemetente = {
  id: string; organization_id: string; loja_id: string; dominio: string | null; endereco_local: string; nome_exibicao: string | null; responder_para: string | null;
  resend_domain_id: string | null; situacao: SituacaoDoRemetente; registros: RegistroDeDns[] | null; verificado_em: string | null; assinatura: AssinaturaDoEmail;
  stripe_customer_id: string | null; stripe_subscription_id: string | null; periodo_inicio: string | null; periodo_fim: string | null; cancela_no_fim: boolean; cota_mensal: number;
};

/** O que a tela vê: sem os ids do Stripe e do Resend. */
export type RemetenteParaATela = {
  assinatura: AssinaturaDoEmail; periodo_fim: string | null; cancela_no_fim: boolean;
  dominio: string | null; endereco_local: string; nome_exibicao: string | null; responder_para: string | null; situacao: SituacaoDoRemetente; registros: RegistroDeDns[];
  usados: number; cota: number; preco_centavos: number; pode_enviar: boolean;
};

export async function remetenteDaLoja(admin: Admin, lojaId: string): Promise<LinhaDoRemetente | null> {
  const { data, error } = await clienteDaTicketeria(admin).from("ticketeria_remetentes").select("*").eq("loja_id", lojaId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? { ...data, situacao: data.situacao as SituacaoDoRemetente, assinatura: data.assinatura as AssinaturaDoEmail, registros: (data.registros ?? null) as RegistroDeDns[] | null } : null;
}

/** Quantos e-mails de divulgação a loja já tem no período da assinatura (a cota do mês). */
export async function emailsDoPeriodo(admin: Admin, lojaId: string, r: Pick<LinhaDoRemetente, "periodo_inicio"> | null, agora: Date = new Date()): Promise<number> {
  const { data, error } = await clienteDaTicketeria(admin).rpc("fn_ticketeria_emails_do_periodo", { p_loja: lojaId, p_desde: inicioDaCota(r?.periodo_inicio ?? null, agora).toISOString() });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export function remetenteParaATela(r: LinhaDoRemetente | null, usados: number): RemetenteParaATela {
  const cota = r?.cota_mensal ?? COTA_PADRAO_DE_EMAILS;
  return {
    assinatura: r?.assinatura ?? "nenhuma", periodo_fim: r?.periodo_fim ?? null, cancela_no_fim: r?.cancela_no_fim ?? false,
    dominio: r?.dominio ?? null, endereco_local: r?.endereco_local ?? "ingressos", nome_exibicao: r?.nome_exibicao ?? null, responder_para: r?.responder_para ?? null,
    situacao: r?.situacao ?? "sem_dominio", registros: r?.registros ?? [], usados, cota, preco_centavos: PRECO_DO_EMAIL_CENTAVOS,
    pode_enviar: podeEnviar(r, usados, 1).ok,
  };
}

/** De onde sai o e-mail da loja, se ela PODE enviar (assinatura ativa e domínio verificado); senão null. A cota é conferida quando o envio é criado. */
export async function remetenteParaEnviar(admin: Admin, lojaId: string): Promise<RemetenteDoEnvio | null> {
  const r = await remetenteDaLoja(admin, lojaId);
  if (!r || r.assinatura !== "ativa" || r.situacao !== "verificado" || !r.dominio) return null;
  return { from: enderecoDeEnvio({ dominio: r.dominio, endereco_local: r.endereco_local, nome_exibicao: r.nome_exibicao }), replyTo: r.responder_para };
}

/** A conta completa para criar um envio de `quantidade` e-mails: o motivo do "não" ou o remetente. */
export async function conferirEnvio(admin: Admin, lojaId: string, quantidade: number): Promise<{ ok: true; de: RemetenteDoEnvio } | Extract<PodeEnviar, { ok: false }>> {
  const r = await remetenteDaLoja(admin, lojaId);
  const usados = r ? await emailsDoPeriodo(admin, lojaId, r) : 0;
  const pode = podeEnviar(r, usados, quantidade);
  if (!pode.ok) return pode;
  const de = await remetenteParaEnviar(admin, lojaId);
  return de ? { ok: true, de } : { ok: false, motivo: "dominio_nao_verificado", restante: pode.restante };
}
