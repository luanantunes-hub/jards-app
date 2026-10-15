// Módulos e função na prestação de quem entra na equipe (P0.6).
//
// O banco confere tudo de novo (fn_conferir_modulos em
// 20261005130000_convites_por_modulo.sql); aqui o pedido é lido e explicado
// antes, para a rota responder com uma mensagem clara.

import { INICIO_DO_MODULO, MODULOS, type ModuloId } from "@/lib/modulos";
import { mensagemErroAcesso } from "@/lib/modulos-contrato";

export type FuncaoPrestacao = "preparador" | "revisor" | "responsavel";

export const FUNCOES_PRESTACAO: readonly { value: FuncaoPrestacao; label: string; descricao: string }[] = [
  { value: "preparador", label: "Preparador", descricao: "Lança despesas, comprovantes e atividades." },
  { value: "revisor", label: "Revisor", descricao: "Aceita ou recusa despesas e aprova justificativas." },
  { value: "responsavel", label: "Responsável", descricao: "Muda o status e registra o envio ao órgão." },
];

export const MODULO_LABEL: Record<ModuloId, string> = {
  captacao: "Captação",
  prestacao: "Prestação de contas",
  producao: "Produção",
};

/** Captador e proponente são externos: usam só a captação e não ocupam vaga. */
export const PAPEIS_EXTERNOS: readonly string[] = ["captador", "proponente"];

export type PedidoModulos = { modulos: ModuloId[]; funcao: FuncaoPrestacao | null };

type Leitura = { ok: true; valor: PedidoModulos } | { ok: false; erro: string };

/**
 * Lê módulos e função vindos do navegador.
 * `disponiveis` são os módulos que podem ser dados: os ativos na organização,
 * mais os que a pessoa já tem (ela não perde o que já usa).
 * Sem módulos informados vale "só captação", como antes da P0.6.
 */
export function lerPedidoModulos(
  papel: string,
  modulos: unknown,
  funcao: unknown,
  disponiveis: readonly string[],
): Leitura {
  const pedidos = modulos === undefined ? ["captacao"] : modulos;
  if (!Array.isArray(pedidos) || pedidos.some(m => !MODULOS.includes(m as ModuloId))) {
    return { ok: false, erro: "Módulos inválidos." };
  }
  const canonicos = MODULOS.filter(m => pedidos.includes(m));
  if (canonicos.length === 0) return { ok: false, erro: "Escolha ao menos um módulo." };
  if (PAPEIS_EXTERNOS.includes(papel) && canonicos.some(m => m !== "captacao")) {
    return { ok: false, erro: mensagemErroAcesso("captador_sem_modulo") };
  }
  const faltando = canonicos.find(m => !disponiveis.includes(m));
  if (faltando) return { ok: false, erro: `A organização não tem ${MODULO_LABEL[faltando].toLowerCase()} ativa.` };

  if (funcao !== undefined && funcao !== null && funcao !== ""
      && !FUNCOES_PRESTACAO.some(f => f.value === funcao)) {
    return { ok: false, erro: mensagemErroAcesso("funcao_invalida") };
  }
  const funcaoValida = canonicos.includes("prestacao") && typeof funcao === "string" && funcao
    ? funcao as FuncaoPrestacao
    : null;
  return { ok: true, valor: { modulos: canonicos, funcao: funcaoValida } };
}

/** Para onde o convite leva no primeiro acesso. */
export function destinoDoConvite(papel: string, modulos: readonly ModuloId[]): string {
  if (papel === "captador") return "/workspace-captador";
  if (papel === "proponente") return "/workspace-proponente";
  const semCaptacao = modulos.find(m => m !== "captacao");
  if (!modulos.includes("captacao") && semCaptacao) return INICIO_DO_MODULO[semCaptacao];
  return "/configuracoes";
}

export type RespostaErro = { status: number; error: string; code?: string };

/** Erro das funções de convite e de módulos, como resposta da rota. */
export function respostaErroEquipe(erro: { code?: string; message?: string }): RespostaErro {
  const mensagem = erro.message ?? "";
  if (erro.code === "23505") {
    return { status: 409, error: "Esta pessoa já faz parte da equipe ou possui um convite pendente." };
  }
  if (mensagem.includes("sem_vaga_prestacao")) {
    return { status: 409, error: mensagemErroAcesso(mensagem), code: "NO_SEATS_PRESTACAO" };
  }
  if (erro.code === "23514" || mensagem.includes("sem_vaga") || mensagem.includes("assentos disponiveis")) {
    return { status: 409, error: mensagemErroAcesso("sem_vaga_captacao"), code: "NO_SEATS" };
  }
  const conhecida = mensagemErroAcesso(mensagem);
  if (!conhecida.includes("Tente de novo")) return { status: 409, error: conhecida };
  return { status: 500, error: mensagem || "Não foi possível concluir. Tente de novo." };
}
