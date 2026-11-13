import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { lerCodigo } from "@/lib/producao/credenciais";
import type { Database } from "@/lib/supabase/types";

// A página pública da credencial (PD7.3): /credencial/[código]. Sem login: o código é a autorização, e só o hash dele fica no banco.
// Mostra ao portador o que ele já sabe: seu nome, a sessão, quantas pessoas o convite admite e o QR com o código. Nada de outra pessoa,
// de outra sessão, de dinheiro ou da equipe.

type Admin = SupabaseClient<Database>;

export const hashDoCodigoDaCredencial = (codigo: string) => createHash("sha256").update(codigo).digest("hex");

export type CredencialPublica = {
  organizacao: string; nome: string; afiliacao: string | null; tipo: string | null; lugares: number; entradas: number;
  dia: string; inicio: string; fim: string; sessao: string; codigo: string;
};

export type LeituraDaCredencial =
  | { situacao: "valida"; credencial: CredencialPublica }
  | { situacao: "inexistente" | "cancelada" | "nao_confirmada" };

/** Procura a credencial pelo código (o hash fica no banco) e monta o que a página mostra. O código mal formado nem chega ao banco. */
export async function carregarCredencialPublica(admin: Admin, codigoDigitado: string): Promise<LeituraDaCredencial> {
  const codigo = lerCodigo(codigoDigitado);
  if (!codigo) return { situacao: "inexistente" };
  const producao = clienteDaProducao(admin);
  const { data: cred, error } = await producao.from("producao_credenciais")
    .select("convidado_id, sessao_id, organization_id, entradas, revogada_em")
    .eq("token_hash", hashDoCodigoDaCredencial(codigo)).maybeSingle();
  if (error) throw new Error("não foi possível conferir a credencial");
  if (!cred) return { situacao: "inexistente" };
  if (cred.revogada_em) return { situacao: "cancelada" };
  const [convidado, sessao, organizacao] = await Promise.all([
    producao.from("producao_convidados").select("nome, afiliacao, quantidade, situacao, tipo_id").eq("id", cred.convidado_id).maybeSingle(),
    producao.from("producao_sessoes").select("dia, inicio, fim, titulo, pauta_id").eq("id", cred.sessao_id).maybeSingle(),
    admin.from("organizations").select("nome").eq("id", cred.organization_id).maybeSingle(),
  ]);
  if (!convidado.data || !sessao.data) return { situacao: "inexistente" };
  if (convidado.data.situacao !== "confirmado") return { situacao: "nao_confirmada" };
  const [tipo, pauta] = await Promise.all([
    producao.from("producao_credencial_tipos").select("nome").eq("id", convidado.data.tipo_id).maybeSingle(),
    producao.from("producao_pautas").select("titulo").eq("id", sessao.data.pauta_id).maybeSingle(),
  ]);
  return {
    situacao: "valida",
    credencial: {
      organizacao: (organizacao.data as { nome?: string | null } | null)?.nome ?? "A produção",
      nome: convidado.data.nome, afiliacao: convidado.data.afiliacao, tipo: tipo.data?.nome ?? null, lugares: convidado.data.quantidade, entradas: cred.entradas,
      dia: sessao.data.dia, inicio: sessao.data.inicio.slice(0, 5), fim: sessao.data.fim.slice(0, 5), sessao: sessao.data.titulo ?? pauta.data?.titulo ?? "Sessão", codigo,
    },
  };
}

/** O que a pessoa lê quando a credencial não vale. Não diz nada da produção. */
export const AVISO_DA_CREDENCIAL: Record<"inexistente" | "cancelada" | "nao_confirmada", { titulo: string; texto: string }> = {
  inexistente: { titulo: "Credencial não encontrada", texto: "Confira o endereço que você recebeu ou peça um novo código a quem enviou." },
  cancelada: { titulo: "Esta credencial foi cancelada", texto: "Fale com quem enviou o convite." },
  nao_confirmada: { titulo: "Convite ainda não confirmado", texto: "A produção ainda não confirmou o seu convite. Fale com quem enviou." },
};
