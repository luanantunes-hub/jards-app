import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { CODIGO_DO_LINK_DE_PEDIDOS, lerPedido, saldoDosTipos } from "@/lib/producao/convidados";
import type { Database } from "@/lib/supabase/types";

// A página pública de pedidos de convidados (PD7.2): /convidar/[código]. Sem login: o código do link é a autorização, e só o hash dele
// fica no banco. O servidor escreve com a chave de serviço, então confere de novo o link e o corte a cada passo; a pessoa nunca escolhe
// a organização nem a sessão. A página mostra só o nome da organização, a sessão, o corte e os tipos de credencial com o saldo; nunca
// quem já foi convidado.

type Admin = SupabaseClient<Database>;

export const hashDoCodigoDePedidos = (codigo: string) => createHash("sha256").update(codigo).digest("hex");

export type SituacaoDoLinkDePedidos = "valido" | "inexistente" | "revogado" | "encerrado";

/** O que a pessoa lê quando o link não vale. Não diz nada da produção. */
export const AVISO_DO_LINK_DE_PEDIDOS: Record<Exclude<SituacaoDoLinkDePedidos, "valido">, { status: number; titulo: string; texto: string }> = {
  inexistente: { status: 404, titulo: "Link não encontrado", texto: "Confira o endereço que você recebeu ou peça um novo link a quem enviou." },
  revogado: { status: 410, titulo: "Os pedidos se encerraram", texto: "Este link foi desativado. Fale com quem enviou." },
  encerrado: { status: 410, titulo: "Os pedidos se encerraram", texto: "O prazo para pedir convidados acabou. Fale com quem enviou." },
};

type LinkDePedidos = { organization_id: string; sessao_id: string; titulo: string | null; corte_em: string };

export async function conferirLinkDePedidos(admin: Admin, codigo: string): Promise<{ situacao: SituacaoDoLinkDePedidos; link?: LinkDePedidos }> {
  if (!CODIGO_DO_LINK_DE_PEDIDOS.test(codigo)) return { situacao: "inexistente" };
  const { data, error } = await clienteDaProducao(admin).from("producao_convidados_links")
    .select("organization_id, sessao_id, titulo, corte_em, revogado_em")
    .eq("token_hash", hashDoCodigoDePedidos(codigo)).maybeSingle();
  if (error) throw new Error("não foi possível conferir o link");
  if (!data) return { situacao: "inexistente" };
  if (data.revogado_em) return { situacao: "revogado" };
  if (new Date(data.corte_em).getTime() <= Date.now()) return { situacao: "encerrado" };
  return { situacao: "valido", link: { organization_id: data.organization_id, sessao_id: data.sessao_id, titulo: data.titulo, corte_em: data.corte_em } };
}

export type TipoOferecido = { id: string; nome: string; livres: number | null };
export type PedidoPublico = { organizacao: string; sessao: string; dia: string; inicio: string; fim: string; titulo: string | null; corteEm: string; tipos: TipoOferecido[] };

/** O que a página mostra: o contexto mínimo e os tipos com o saldo de lugares (sem dizer quem já foi convidado). */
export async function carregarPedidoPublico(admin: Admin, link: LinkDePedidos): Promise<PedidoPublico> {
  const producao = clienteDaProducao(admin);
  const [organizacao, sessao, tipos, convidados] = await Promise.all([
    admin.from("organizations").select("nome").eq("id", link.organization_id).maybeSingle(),
    producao.from("producao_sessoes").select("dia, inicio, fim, titulo, pauta_id").eq("id", link.sessao_id).maybeSingle(),
    producao.from("producao_credencial_tipos").select("id, nome, cota_por_sessao, arquivado").eq("organization_id", link.organization_id).eq("arquivado", false).order("nome"),
    producao.from("producao_convidados").select("id, tipo_id, nome, afiliacao, quantidade, situacao").eq("sessao_id", link.sessao_id),
  ]);
  if (!sessao.data) throw new Error("sessão não encontrada");
  const pauta = await producao.from("producao_pautas").select("titulo").eq("id", sessao.data.pauta_id).maybeSingle();
  const saldos = saldoDosTipos(tipos.data ?? [], convidados.data ?? []);
  return {
    organizacao: (organizacao.data as { nome?: string | null } | null)?.nome ?? "A produção",
    sessao: sessao.data.titulo ?? pauta.data?.titulo ?? "Sessão",
    dia: sessao.data.dia, inicio: sessao.data.inicio.slice(0, 5), fim: sessao.data.fim.slice(0, 5),
    titulo: link.titulo, corteEm: link.corte_em,
    tipos: saldos.filter(saldo => !saldo.arquivado).map(saldo => ({ id: saldo.tipoId, nome: saldo.nome, livres: saldo.saldo === null ? null : Math.max(saldo.saldo, 0) })),
  };
}

export class ErroDePedido extends Error {
  constructor(public status: number, mensagem: string, public extra: Record<string, unknown> = {}) { super(mensagem); }
}

type ChamadaRpc = { rpc: (nome: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> };

const MOTIVO_DO_PEDIDO: Record<string, { status: number; texto: string }> = {
  inexistente: { status: 404, texto: "Link não encontrado." },
  revogado: { status: 410, texto: "Os pedidos se encerraram." },
  encerrado: { status: 410, texto: "O prazo para pedir convidados acabou." },
  lotado: { status: 409, texto: "Este link já recebeu o máximo de pedidos. Fale com quem enviou." },
  cota_cheia: { status: 409, texto: "Não há mais lugares nesse tipo de credencial. Escolha outro tipo ou fale com quem enviou." },
  tipo_invalido: { status: 422, texto: "Esse tipo de credencial não está disponível. Escolha outro." },
};

/**
 * Grava o pedido: confere o link e cada valor, e a gravação é de uma vez só (função do banco, só do servidor, que também confere a
 * cota). Devolve "armadilha" quando o campo escondido veio preenchido: responde como se tivesse dado certo, sem gravar nada.
 */
export async function pedirConvidado(admin: Admin, codigo: string, corpo: Record<string, unknown>): Promise<"ok" | "armadilha"> {
  const link = await conferirLinkDePedidos(admin, codigo);
  if (link.situacao !== "valido") {
    const aviso = AVISO_DO_LINK_DE_PEDIDOS[link.situacao];
    throw new ErroDePedido(aviso.status, aviso.titulo, { situacao: link.situacao });
  }
  const leitura = lerPedido(corpo);
  if (leitura.ok === "armadilha") return "armadilha";
  if (!leitura.ok) throw new ErroDePedido(422, leitura.erro, { campo: leitura.campo });
  const { valor } = leitura;
  const { data, error } = await (admin as unknown as ChamadaRpc).rpc("fn_producao_convidado_pedir", {
    p_hash: hashDoCodigoDePedidos(codigo), p_solicitante: valor.solicitante, p_nome: valor.nome, p_afiliacao: valor.afiliacao ?? "", p_tipo: valor.tipo_id, p_quantidade: valor.quantidade,
  });
  if (error) throw new Error("não foi possível gravar o pedido");
  if (data !== "ok") {
    const motivo = MOTIVO_DO_PEDIDO[typeof data === "string" ? data : ""] ?? { status: 409, texto: "Não foi possível enviar agora." };
    throw new ErroDePedido(motivo.status, motivo.texto, { situacao: data });
  }
  return "ok";
}
