import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { itemEditavel, lerRespondente, lerRespostas, type ItemDoAcerto } from "@/lib/producao/acerto";
import type { TipoDeCampoDoAcerto } from "@/lib/producao/estados";
import type { Database } from "@/lib/supabase/types";

// A página pública do acerto técnico (PD4.2): /acerto/[código]. Sem login: o código do link é a autorização, e só o hash
// dele fica no banco. Como o servidor escreve com a chave de serviço, cada passo confere de novo o link, a validade e o que
// cada item permite; a casa nunca escolhe a organização, a data nem os itens que pode mudar. Nada aqui devolve dinheiro,
// equipe, outras datas ou dado pessoal: só o nome da organização, o título da temporada, o dia e o espaço da data, e os
// campos que a produção deixou visíveis.

type Admin = SupabaseClient<Database>;

/** 32 bytes em base64url: o formato que `fn_producao_acerto_novo_link` gera. Qualquer outra coisa nem chega ao banco. */
export const CODIGO_DO_ACERTO = /^[A-Za-z0-9_-]{43}$/;

export const hashDoCodigo = (codigo: string) => createHash("sha256").update(codigo).digest("hex");

export type SituacaoDoLink = "valido" | "inexistente" | "expirado" | "revogado" | "cancelado";

/** O que a pessoa lê quando o link não vale. Não diz nada do acerto. */
export const AVISO_DO_LINK: Record<Exclude<SituacaoDoLink, "valido">, { status: number; titulo: string; texto: string }> = {
  inexistente: { status: 404, titulo: "Link não encontrado", texto: "Confira o endereço que você recebeu ou peça um novo link a quem enviou." },
  expirado: { status: 410, titulo: "Este link expirou", texto: "Peça um novo link a quem enviou." },
  revogado: { status: 410, titulo: "Este link foi desativado", texto: "Peça um novo link a quem enviou." },
  cancelado: { status: 410, titulo: "Este acerto foi cancelado", texto: "Fale com quem enviou o link." },
};

type AcertoDoLink = {
  id: string; organization_id: string; data_id: string; modelo_nome: string; situacao: "aguardando" | "respondido" | "concluido" | "cancelado";
  link_expira_em: string | null; link_revogado_em: string | null; respondente_nome: string | null; respondido_em: string | null;
};

export async function conferirLinkDoAcerto(admin: Admin, codigo: string): Promise<{ situacao: SituacaoDoLink; acerto?: AcertoDoLink }> {
  if (!CODIGO_DO_ACERTO.test(codigo)) return { situacao: "inexistente" };
  const { data, error } = await clienteDaProducao(admin).from("producao_acertos")
    .select("id, organization_id, data_id, modelo_nome, situacao, link_expira_em, link_revogado_em, respondente_nome, respondido_em")
    .eq("token_hash", hashDoCodigo(codigo)).maybeSingle();
  if (error) throw new Error("não foi possível conferir o link");
  if (!data) return { situacao: "inexistente" };
  if (data.link_revogado_em) return { situacao: "revogado" };
  if (!data.link_expira_em || new Date(data.link_expira_em).getTime() < Date.now()) return { situacao: "expirado" };
  if (data.situacao === "cancelado") return { situacao: "cancelado" };
  return { situacao: "valido", acerto: data };
}

export type ItemPublico = {
  id: string; secao: string; rotulo: string; tipo: TipoDeCampoDoAcerto; opcoes: string[]; visibilidade: "leitura" | "opcional" | "obrigatorio"; ajuda: string;
  valor_atual: string | null; resposta: string | null; situacao: ItemDoAcerto["situacao"]; motivo: string | null; editavel: boolean;
};

export type AcertoPublico = {
  titulo: string; organizacao: string; temporada: string | null; dia: string | null; espaco: string | null;
  situacao: AcertoDoLink["situacao"]; respondente: string | null; expiraEm: string; itens: ItemPublico[];
};

const opcoesDe = (valor: unknown): string[] => (Array.isArray(valor) ? valor.filter((item): item is string => typeof item === "string") : []);

/** Os itens completos do acerto (com o destino e a visibilidade), para conferir respostas no servidor. */
async function itensDoAcerto(admin: Admin, acertoId: string): Promise<(ItemDoAcerto)[]> {
  const { data, error } = await clienteDaProducao(admin).from("producao_acerto_itens")
    .select("id, chave, secao, rotulo, tipo, opcoes, destino, visibilidade, ajuda, valor_atual, resposta, situacao, motivo")
    .eq("acerto_id", acertoId).order("ordem");
  if (error) throw new Error("não foi possível ler os itens");
  return (data ?? []).map(item => ({
    id: item.id, chave: item.chave, secao: item.secao, rotulo: item.rotulo, tipo: item.tipo, opcoes: opcoesDe(item.opcoes), destino: item.destino,
    visibilidade: item.visibilidade, ajuda: item.ajuda ?? "", valor_atual: item.valor_atual, resposta: item.resposta, situacao: item.situacao, motivo: item.motivo,
  }));
}

/** O que a página mostra: o contexto mínimo e os itens que não são ocultos. */
export async function carregarAcertoPublico(admin: Admin, acerto: AcertoDoLink): Promise<AcertoPublico> {
  const producao = clienteDaProducao(admin);
  const [{ data: dataRow }, organizacao, itens] = await Promise.all([
    producao.from("producao_datas").select("data, temporada_id, espaco_id").eq("id", acerto.data_id).maybeSingle(),
    admin.from("organizations").select("nome").eq("id", acerto.organization_id).maybeSingle(),
    itensDoAcerto(admin, acerto.id),
  ]);
  const [temporada, espaco] = await Promise.all([
    dataRow ? producao.from("producao_temporadas").select("titulo").eq("id", dataRow.temporada_id).maybeSingle() : Promise.resolve({ data: null }),
    dataRow?.espaco_id ? producao.from("producao_espacos").select("nome").eq("id", dataRow.espaco_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return {
    titulo: acerto.modelo_nome,
    organizacao: (organizacao.data as { nome?: string | null } | null)?.nome ?? "A produção",
    temporada: temporada.data?.titulo ?? null,
    dia: dataRow?.data ?? null,
    espaco: espaco.data?.nome ?? null,
    situacao: acerto.situacao,
    respondente: acerto.respondente_nome,
    expiraEm: acerto.link_expira_em as string,
    itens: itens.filter(item => item.visibilidade !== "oculto").map(item => ({
      id: item.id, secao: item.secao, rotulo: item.rotulo, tipo: item.tipo, opcoes: item.opcoes, visibilidade: item.visibilidade as ItemPublico["visibilidade"], ajuda: item.ajuda,
      // O que a produção escreveu só vai nos campos "a casa só lê"; a resposta e o motivo são da casa e da revisão dela.
      valor_atual: item.visibilidade === "leitura" ? item.valor_atual : null, resposta: item.resposta, situacao: item.situacao, motivo: item.situacao === "recusado" ? item.motivo : null,
      editavel: acerto.situacao === "aguardando" && itemEditavel(item),
    })),
  };
}

export class ErroDoAcerto extends Error {
  constructor(public status: number, mensagem: string, public extra: Record<string, unknown> = {}) { super(mensagem); }
}

type ChamadaRpc = { rpc: (nome: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> };

const MOTIVO_DA_RESPOSTA: Record<string, { status: number; texto: string }> = {
  inexistente: { status: 404, texto: "Link não encontrado." },
  revogado: { status: 410, texto: "Este link foi desativado." },
  expirado: { status: 410, texto: "Este link expirou." },
  cancelado: { status: 410, texto: "Este acerto foi cancelado." },
  indisponivel: { status: 409, texto: "Este acerto já foi enviado e está em revisão." },
  sem_respostas: { status: 422, texto: "Não há nada novo para enviar." },
};

/**
 * Grava a resposta da casa: confere o link, o nome, e cada valor pelo tipo do campo; só entram os itens que ela pode
 * preencher agora. A gravação é de uma vez só (função do banco). Devolve o acerto e a hora do envio.
 */
export async function responderAoAcerto(admin: Admin, codigo: string, corpo: Record<string, unknown>): Promise<{ acertoId: string; organizationId: string; dataId: string; respondente: string }> {
  const link = await conferirLinkDoAcerto(admin, codigo);
  if (link.situacao !== "valido" || !link.acerto) {
    const aviso = AVISO_DO_LINK[link.situacao === "valido" ? "inexistente" : link.situacao];
    throw new ErroDoAcerto(aviso.status, aviso.titulo, { situacao: link.situacao });
  }
  const respondente = lerRespondente(corpo.nome, corpo.email);
  if (!respondente.ok) throw new ErroDoAcerto(422, respondente.erro, { campo: "nome" });
  const entrada = corpo.respostas && typeof corpo.respostas === "object" && !Array.isArray(corpo.respostas) ? (corpo.respostas as Record<string, unknown>) : {};
  const itens = await itensDoAcerto(admin, link.acerto.id);
  const leitura = lerRespostas(itens, entrada);
  if (!leitura.ok) throw new ErroDoAcerto(422, "Confira os campos marcados.", { erros: leitura.erros });
  const { data, error } = await (admin as unknown as ChamadaRpc).rpc("fn_producao_acerto_responder", {
    p_hash: hashDoCodigo(codigo), p_nome: respondente.nome, p_email: respondente.email ?? "", p_respostas: leitura.respostas,
  });
  if (error) throw new Error("não foi possível gravar a resposta");
  if (data !== "ok") {
    const motivo = MOTIVO_DA_RESPOSTA[typeof data === "string" ? data : ""] ?? { status: 409, texto: "Não foi possível enviar agora." };
    throw new ErroDoAcerto(motivo.status, motivo.texto, { situacao: data });
  }
  return { acertoId: link.acerto.id, organizationId: link.acerto.organization_id, dataId: link.acerto.data_id, respondente: respondente.nome };
}
