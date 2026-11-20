import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { CODIGO_DO_LINK_DE_VOLUNTARIOS, lerInscricao } from "@/lib/producao/voluntarios";
import type { Database } from "@/lib/supabase/types";

// A página pública de inscrição de voluntários (PD7.11): /voluntario/[código]. Sem login: o código do link é a autorização, e só o
// hash dele fica no banco. O servidor escreve com a chave de serviço, então confere de novo o link e a validade a cada passo; a pessoa
// nunca escolhe a organização nem a temporada. A página só mostra o nome da organização, o título da temporada e o título do link.

type Admin = SupabaseClient<Database>;

export const hashDoCodigoDeVoluntarios = (codigo: string) => createHash("sha256").update(codigo).digest("hex");

export type SituacaoDoLinkDeVoluntarios = "valido" | "inexistente" | "expirado" | "revogado" | "cancelado";

/** O que a pessoa lê quando o link não vale. Não diz nada da produção. */
export const AVISO_DO_LINK_DE_VOLUNTARIOS: Record<Exclude<SituacaoDoLinkDeVoluntarios, "valido">, { status: number; titulo: string; texto: string }> = {
  inexistente: { status: 404, titulo: "Link não encontrado", texto: "Confira o endereço que você recebeu ou peça um novo link a quem enviou." },
  expirado: { status: 410, titulo: "As inscrições se encerraram", texto: "Este link expirou. Fale com quem enviou." },
  revogado: { status: 410, titulo: "As inscrições se encerraram", texto: "Este link foi desativado. Fale com quem enviou." },
  cancelado: { status: 410, titulo: "Esta produção foi cancelada", texto: "Fale com quem enviou o link." },
};

type LinkDeVoluntarios = { organization_id: string; temporada_id: string; titulo: string | null; vagas: number | null; expira_em: string };

export async function conferirLinkDeVoluntarios(admin: Admin, codigo: string): Promise<{ situacao: SituacaoDoLinkDeVoluntarios; link?: LinkDeVoluntarios }> {
  if (!CODIGO_DO_LINK_DE_VOLUNTARIOS.test(codigo)) return { situacao: "inexistente" };
  const producao = clienteDaProducao(admin);
  const { data, error } = await producao.from("producao_voluntarios_links")
    .select("organization_id, temporada_id, titulo, vagas, expira_em, revogado_em")
    .eq("token_hash", hashDoCodigoDeVoluntarios(codigo)).maybeSingle();
  if (error) throw new Error("não foi possível conferir o link");
  if (!data) return { situacao: "inexistente" };
  if (data.revogado_em) return { situacao: "revogado" };
  if (!data.expira_em || new Date(data.expira_em).getTime() < Date.now()) return { situacao: "expirado" };
  const { data: temporada } = await producao.from("producao_temporadas").select("situacao").eq("id", data.temporada_id).maybeSingle();
  if (temporada?.situacao === "cancelada") return { situacao: "cancelado" };
  return { situacao: "valido", link: { organization_id: data.organization_id, temporada_id: data.temporada_id, titulo: data.titulo, vagas: data.vagas, expira_em: data.expira_em } };
}

export type InscricaoPublica = { organizacao: string; temporada: string; titulo: string | null; expiraEm: string };

/** O que a página mostra: o contexto mínimo. */
export async function carregarInscricaoPublica(admin: Admin, link: LinkDeVoluntarios): Promise<InscricaoPublica> {
  const producao = clienteDaProducao(admin);
  const [organizacao, temporada] = await Promise.all([
    admin.from("organizations").select("nome").eq("id", link.organization_id).maybeSingle(),
    producao.from("producao_temporadas").select("titulo").eq("id", link.temporada_id).maybeSingle(),
  ]);
  return {
    organizacao: (organizacao.data as { nome?: string | null } | null)?.nome ?? "A produção",
    temporada: temporada.data?.titulo ?? "a produção",
    titulo: link.titulo, expiraEm: link.expira_em,
  };
}

export class ErroDeVoluntarios extends Error {
  constructor(public status: number, mensagem: string, public extra: Record<string, unknown> = {}) { super(mensagem); }
}

type ChamadaRpc = { rpc: (nome: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> };

const MOTIVO_DA_INSCRICAO: Record<string, { status: number; texto: string }> = {
  inexistente: { status: 404, texto: "Link não encontrado." },
  revogado: { status: 410, texto: "As inscrições se encerraram." },
  expirado: { status: 410, texto: "As inscrições se encerraram." },
  temporada_cancelada: { status: 410, texto: "Esta produção foi cancelada." },
  lotado: { status: 409, texto: "As vagas de voluntários acabaram. Fale com quem enviou o link." },
  ja_inscrito: { status: 409, texto: "Esse e-mail já está inscrito. Se precisar mudar algo, fale com a produção." },
};

/**
 * Grava a inscrição: confere o link e cada valor, e a gravação é de uma vez só (função do banco, só do servidor). Devolve "armadilha"
 * quando o campo escondido veio preenchido: responde como se tivesse dado certo, sem gravar nada.
 */
export async function inscreverVoluntario(admin: Admin, codigo: string, corpo: Record<string, unknown>): Promise<"ok" | "armadilha"> {
  const link = await conferirLinkDeVoluntarios(admin, codigo);
  if (link.situacao !== "valido") {
    const aviso = AVISO_DO_LINK_DE_VOLUNTARIOS[link.situacao];
    throw new ErroDeVoluntarios(aviso.status, aviso.titulo, { situacao: link.situacao });
  }
  const leitura = lerInscricao(corpo);
  if (leitura.ok === "armadilha") return "armadilha";
  if (!leitura.ok) throw new ErroDeVoluntarios(422, leitura.erro, { campo: leitura.campo });
  const { valor } = leitura;
  const { data, error } = await (admin as unknown as ChamadaRpc).rpc("fn_producao_voluntario_inscrever", {
    p_hash: hashDoCodigoDeVoluntarios(codigo), p_nome: valor.nome, p_email: valor.email ?? "", p_telefone: valor.telefone ?? "", p_disponibilidade: valor.disponibilidade ?? "",
  });
  if (error) throw new Error("não foi possível gravar a inscrição");
  if (data !== "ok") {
    const motivo = MOTIVO_DA_INSCRICAO[typeof data === "string" ? data : ""] ?? { status: 409, texto: "Não foi possível enviar agora." };
    throw new ErroDeVoluntarios(motivo.status, motivo.texto, { situacao: data });
  }
  return "ok";
}
