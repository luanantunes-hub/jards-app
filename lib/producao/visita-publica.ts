import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { CODIGO_DO_LINK_DE_VISITAS, lerPedidoDeVisita, ocupacaoDosHorarios, type AgendamentoDeVisita, type HorarioDeVisita } from "@/lib/producao/visitas";
import type { Database } from "@/lib/supabase/types";

// A página pública de agendamento de visitas (PD7.5): /visita/[código]. Sem login: o código do link é a autorização, e só o hash dele
// fica no banco. O servidor escreve com a chave de serviço, então confere de novo o link e a validade a cada passo; a pessoa nunca escolhe
// a organização nem o espaço. A página mostra só o nome da organização e do espaço e os horários de hoje em diante com as vagas livres;
// nunca quem já agendou.

type Admin = SupabaseClient<Database>;

export const hashDoCodigoDeVisitas = (codigo: string) => createHash("sha256").update(codigo).digest("hex");

export type SituacaoDoLinkDeVisitas = "valido" | "inexistente" | "revogado" | "expirado";

/** O que a pessoa lê quando o link não vale. Não diz nada da produção. */
export const AVISO_DO_LINK_DE_VISITAS: Record<Exclude<SituacaoDoLinkDeVisitas, "valido">, { status: number; titulo: string; texto: string }> = {
  inexistente: { status: 404, titulo: "Link não encontrado", texto: "Confira o endereço que você recebeu ou peça um novo link a quem enviou." },
  revogado: { status: 410, titulo: "Os agendamentos se encerraram", texto: "Este link foi desativado. Fale com quem enviou." },
  expirado: { status: 410, titulo: "Os agendamentos se encerraram", texto: "Este link expirou. Fale com quem enviou." },
};

type LinkDeVisitas = { organization_id: string; espaco_id: string; titulo: string | null; expira_em: string };

export async function conferirLinkDeVisitas(admin: Admin, codigo: string): Promise<{ situacao: SituacaoDoLinkDeVisitas; link?: LinkDeVisitas }> {
  if (!CODIGO_DO_LINK_DE_VISITAS.test(codigo)) return { situacao: "inexistente" };
  const { data, error } = await clienteDaProducao(admin).from("producao_visitas_links")
    .select("organization_id, espaco_id, titulo, expira_em, revogado_em")
    .eq("token_hash", hashDoCodigoDeVisitas(codigo)).maybeSingle();
  if (error) throw new Error("não foi possível conferir o link");
  if (!data) return { situacao: "inexistente" };
  if (data.revogado_em) return { situacao: "revogado" };
  if (new Date(data.expira_em).getTime() <= Date.now()) return { situacao: "expirado" };
  return { situacao: "valido", link: { organization_id: data.organization_id, espaco_id: data.espaco_id, titulo: data.titulo, expira_em: data.expira_em } };
}

export type HorarioOferecido = { id: string; dia: string; inicio: string; fim: string; livres: number };
export type VisitaPublica = { organizacao: string; espaco: string; titulo: string | null; horarios: HorarioOferecido[] };

/** O que a página mostra: o contexto mínimo e os horários de hoje em diante com as vagas livres (sem dizer quem já agendou). */
export async function carregarVisitaPublica(admin: Admin, link: LinkDeVisitas): Promise<VisitaPublica> {
  const producao = clienteDaProducao(admin);
  const hoje = new Date().toISOString().slice(0, 10);
  const [organizacao, espaco, horarios] = await Promise.all([
    admin.from("organizations").select("nome").eq("id", link.organization_id).maybeSingle(),
    producao.from("producao_espacos").select("nome").eq("id", link.espaco_id).maybeSingle(),
    producao.from("producao_visitas_horarios").select("id, dia, inicio, fim, capacidade, publico_avulso, notas").eq("espaco_id", link.espaco_id).gte("dia", hoje).order("dia").order("inicio").limit(200),
  ]);
  const lista = (horarios.data ?? []) as HorarioDeVisita[];
  const agendamentos = lista.length > 0
    ? await producao.from("producao_visitas_agendamentos").select("id, horario_id, grupo, responsavel, email, telefone, pessoas, situacao, presentes, observacao").in("horario_id", lista.map(horario => horario.id))
    : { data: [] as AgendamentoDeVisita[] };
  const ocupacao = ocupacaoDosHorarios(lista, (agendamentos.data ?? []) as AgendamentoDeVisita[]);
  return {
    organizacao: (organizacao.data as { nome?: string | null } | null)?.nome ?? "A produção",
    espaco: espaco.data?.nome ?? "o espaço", titulo: link.titulo,
    horarios: lista.map(horario => ({ id: horario.id, dia: horario.dia, inicio: horario.inicio.slice(0, 5), fim: horario.fim.slice(0, 5), livres: Math.max(ocupacao.get(horario.id)?.livres ?? 0, 0) })),
  };
}

export class ErroDeVisita extends Error {
  constructor(public status: number, mensagem: string, public extra: Record<string, unknown> = {}) { super(mensagem); }
}

type ChamadaRpc = { rpc: (nome: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> };

const MOTIVO_DO_AGENDAMENTO: Record<string, { status: number; texto: string }> = {
  inexistente: { status: 404, texto: "Link não encontrado." },
  revogado: { status: 410, texto: "Os agendamentos se encerraram." },
  expirado: { status: 410, texto: "Os agendamentos se encerraram." },
  horario_invalido: { status: 422, texto: "Esse horário não está mais disponível. Escolha outro." },
  lotado: { status: 409, texto: "Não há vagas suficientes nesse horário para o seu grupo. Escolha outro horário ou fale com quem enviou o link." },
};

/**
 * Grava o agendamento: confere o link e cada valor, e a gravação é de uma vez só (função do banco, só do servidor, que também confere a
 * capacidade). Devolve "armadilha" quando o campo escondido veio preenchido: responde como se tivesse dado certo, sem gravar nada.
 */
export async function agendarVisita(admin: Admin, codigo: string, corpo: Record<string, unknown>): Promise<"ok" | "armadilha"> {
  const link = await conferirLinkDeVisitas(admin, codigo);
  if (link.situacao !== "valido") {
    const aviso = AVISO_DO_LINK_DE_VISITAS[link.situacao];
    throw new ErroDeVisita(aviso.status, aviso.titulo, { situacao: link.situacao });
  }
  const leitura = lerPedidoDeVisita(corpo);
  if (leitura.ok === "armadilha") return "armadilha";
  if (!leitura.ok) throw new ErroDeVisita(422, leitura.erro, { campo: leitura.campo });
  const { valor } = leitura;
  const { data, error } = await (admin as unknown as ChamadaRpc).rpc("fn_producao_visita_agendar", {
    p_hash: hashDoCodigoDeVisitas(codigo), p_horario: valor.horario_id, p_grupo: valor.grupo, p_responsavel: valor.responsavel, p_email: valor.email ?? "",
    p_telefone: valor.telefone ?? "", p_pessoas: valor.pessoas, p_observacao: valor.observacao ?? "",
  });
  if (error) throw new Error("não foi possível gravar o agendamento");
  if (data !== "ok") {
    const motivo = MOTIVO_DO_AGENDAMENTO[typeof data === "string" ? data : ""] ?? { status: 409, texto: "Não foi possível enviar agora." };
    throw new ErroDeVisita(motivo.status, motivo.texto, { situacao: data });
  }
  return "ok";
}
