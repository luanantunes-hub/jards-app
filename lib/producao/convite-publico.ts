import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { CODIGO_DO_CONVITE, lerRespostaDoConvite, primeiroNome } from "@/lib/producao/convites";
import type { RespostaDoConvite } from "@/lib/producao/estados";
import type { Database } from "@/lib/supabase/types";

// A página pública do convite (PD6.9): /presenca/[código]. Sem login: o código do link é a autorização, e só o hash dele fica no
// banco. Como o servidor escreve com a chave de serviço, cada passo confere de novo o link e a validade; a pessoa nunca escolhe
// a organização, a temporada nem a pessoa. Nada aqui devolve dinheiro, equipe, outras datas ou dado de outra pessoa: só o nome da
// organização, o título da temporada, o primeiro nome de quem foi convidada e a resposta dela.

type Admin = SupabaseClient<Database>;

export const hashDoCodigoDoConvite = (codigo: string) => createHash("sha256").update(codigo).digest("hex");

export type SituacaoDoLinkDoConvite = "valido" | "inexistente" | "expirado" | "revogado" | "cancelado";

/** O que a pessoa lê quando o link não vale. Não diz nada da produção. */
export const AVISO_DO_LINK_DO_CONVITE: Record<Exclude<SituacaoDoLinkDoConvite, "valido">, { status: number; titulo: string; texto: string }> = {
  inexistente: { status: 404, titulo: "Link não encontrado", texto: "Confira o endereço que você recebeu ou peça um novo link a quem enviou." },
  expirado: { status: 410, titulo: "Este link expirou", texto: "Peça um novo link a quem enviou." },
  revogado: { status: 410, titulo: "Este link foi desativado", texto: "Peça um novo link a quem enviou." },
  cancelado: { status: 410, titulo: "Esta produção foi cancelada", texto: "Fale com quem enviou o link." },
};

type ConviteDoLink = {
  id: string; organization_id: string; temporada_id: string; pessoa_id: string; resposta: RespostaDoConvite;
  chegada_dia: string | null; chegada_hora: string | null; saida_dia: string | null; saida_hora: string | null; observacao: string | null; link_expira_em: string | null;
};

export async function conferirLinkDoConvite(admin: Admin, codigo: string): Promise<{ situacao: SituacaoDoLinkDoConvite; convite?: ConviteDoLink }> {
  if (!CODIGO_DO_CONVITE.test(codigo)) return { situacao: "inexistente" };
  const producao = clienteDaProducao(admin);
  const { data, error } = await producao.from("producao_convites")
    .select("id, organization_id, temporada_id, pessoa_id, resposta, chegada_dia, chegada_hora, saida_dia, saida_hora, observacao, link_expira_em, link_revogado_em")
    .eq("token_hash", hashDoCodigoDoConvite(codigo)).maybeSingle();
  if (error) throw new Error("não foi possível conferir o link");
  if (!data) return { situacao: "inexistente" };
  if (data.link_revogado_em) return { situacao: "revogado" };
  if (!data.link_expira_em || new Date(data.link_expira_em).getTime() < Date.now()) return { situacao: "expirado" };
  const { data: temporada } = await producao.from("producao_temporadas").select("situacao").eq("id", data.temporada_id).maybeSingle();
  if (temporada?.situacao === "cancelada") return { situacao: "cancelado" };
  return { situacao: "valido", convite: data };
}

export type ConvitePublico = {
  organizacao: string; temporada: string; primeiroNome: string; resposta: RespostaDoConvite;
  chegadaDia: string | null; chegadaHora: string | null; saidaDia: string | null; saidaHora: string | null; observacao: string | null; expiraEm: string;
};

/** O que a página mostra: o contexto mínimo e a resposta que a pessoa já deu. */
export async function carregarConvitePublico(admin: Admin, convite: ConviteDoLink): Promise<ConvitePublico> {
  const producao = clienteDaProducao(admin);
  const [organizacao, temporada, pessoa] = await Promise.all([
    admin.from("organizations").select("nome").eq("id", convite.organization_id).maybeSingle(),
    producao.from("producao_temporadas").select("titulo").eq("id", convite.temporada_id).maybeSingle(),
    producao.from("producao_pessoas").select("nome").eq("id", convite.pessoa_id).maybeSingle(),
  ]);
  return {
    organizacao: (organizacao.data as { nome?: string | null } | null)?.nome ?? "A produção",
    temporada: temporada.data?.titulo ?? "a produção",
    primeiroNome: pessoa.data?.nome ? primeiroNome(pessoa.data.nome) : "",
    resposta: convite.resposta,
    chegadaDia: convite.chegada_dia, chegadaHora: convite.chegada_hora?.slice(0, 5) ?? null,
    saidaDia: convite.saida_dia, saidaHora: convite.saida_hora?.slice(0, 5) ?? null,
    observacao: convite.observacao, expiraEm: convite.link_expira_em as string,
  };
}

export class ErroDoConvite extends Error {
  constructor(public status: number, mensagem: string, public extra: Record<string, unknown> = {}) { super(mensagem); }
}

type ChamadaRpc = { rpc: (nome: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> };

const MOTIVO_DA_RESPOSTA: Record<string, { status: number; texto: string }> = {
  inexistente: { status: 404, texto: "Link não encontrado." },
  revogado: { status: 410, texto: "Este link foi desativado." },
  expirado: { status: 410, texto: "Este link expirou." },
  temporada_cancelada: { status: 410, texto: "Esta produção foi cancelada." },
};

/** Grava a resposta da pessoa: confere o link e cada valor; a gravação é de uma vez só (função do banco, só do servidor). */
export async function responderAoConvite(admin: Admin, codigo: string, corpo: Record<string, unknown>): Promise<{ conviteId: string; resposta: "vou" | "nao_vou" }> {
  const link = await conferirLinkDoConvite(admin, codigo);
  if (link.situacao !== "valido" || !link.convite) {
    const aviso = AVISO_DO_LINK_DO_CONVITE[link.situacao === "valido" ? "inexistente" : link.situacao];
    throw new ErroDoConvite(aviso.status, aviso.titulo, { situacao: link.situacao });
  }
  const leitura = lerRespostaDoConvite(corpo);
  if (!leitura.ok) throw new ErroDoConvite(422, leitura.erro, { campo: leitura.campo });
  const { valor } = leitura;
  const { data, error } = await (admin as unknown as ChamadaRpc).rpc("fn_producao_convite_responder", {
    p_hash: hashDoCodigoDoConvite(codigo), p_resposta: valor.resposta, p_chegada_dia: valor.chegada_dia, p_chegada_hora: valor.chegada_hora,
    p_saida_dia: valor.saida_dia, p_saida_hora: valor.saida_hora, p_observacao: valor.observacao ?? "",
  });
  if (error) throw new Error("não foi possível gravar a resposta");
  if (data !== "ok") {
    const motivo = MOTIVO_DA_RESPOSTA[typeof data === "string" ? data : ""] ?? { status: 409, texto: "Não foi possível enviar agora." };
    throw new ErroDoConvite(motivo.status, motivo.texto, { situacao: data });
  }
  return { conviteId: link.convite.id, resposta: valor.resposta };
}
