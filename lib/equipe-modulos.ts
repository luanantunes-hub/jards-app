// Módulos, função na prestação e vagas de quem entra na equipe (P0.6, PD0.5).
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

/**
 * Os módulos que um papel externo pode ter: só a captação. Quem é de fora entra
 * na prestação e na produção por link ou portal, nunca como membro (plano da
 * produção, decisão 3). É um registro por módulo para que um módulo novo
 * obrigue a decidir aqui: sem a linha, o typecheck acusa.
 */
const EXTERNO_PODE: Record<ModuloId, boolean> = { captacao: true, prestacao: false, producao: false };

/** O papel pode usar o módulo? Os papéis da equipe usam todos; os externos, só a captação. */
export function papelPodeUsarModulo(papel: string, modulo: ModuloId): boolean {
  return !PAPEIS_EXTERNOS.includes(papel) || EXTERNO_PODE[modulo];
}

/** Dos módulos informados, os que o papel não pode ter, na ordem de MODULOS. */
export function modulosVetadosAoPapel(papel: string, modulos: readonly string[]): ModuloId[] {
  return MODULOS.filter(m => modulos.includes(m) && !papelPodeUsarModulo(papel, m));
}

/** "a", "a e b", "a, b e c". */
function juntar(partes: readonly string[]): string {
  if (partes.length <= 1) return partes.join("");
  return `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`;
}

/** Recusa de tornar externa uma pessoa que usa módulos que o externo não pode ter. */
export function mensagemTirarModulosDoExterno(papel: string, modulos: readonly ModuloId[]): string {
  const acessos = juntar(modulos.map(m => `à ${MODULO_LABEL[m].toLowerCase()}`));
  return `Tire o acesso ${acessos} antes de tornar a pessoa ${papel === "proponente" ? "proponente" : "captador"} externo.`;
}

/**
 * De onde vêm as vagas de cada módulo: a captação usa o plano da organização
 * (organization_seats); os outros, o contrato do módulo (organization_modulos).
 * Cada módulo conta só as próprias vagas: convidar para a produção não gasta
 * vaga da captação. Registro por módulo: um módulo novo obriga a decidir aqui.
 */
export const ORIGEM_DAS_VAGAS: Record<ModuloId, "plano" | "contrato"> = {
  captacao: "plano",
  prestacao: "contrato",
  producao: "contrato",
};

/** Módulos com contrato próprio, os pagos além da captação. */
export const MODULOS_COM_CONTRATO: readonly ModuloId[] = MODULOS.filter(m => ORIGEM_DAS_VAGAS[m] === "contrato");

/** Código que as rotas devolvem quando falta vaga no módulo; a tela decide o que fazer com ele. */
export const CODIGO_SEM_VAGA: Record<ModuloId, string> = {
  captacao: "NO_SEATS",
  prestacao: "NO_SEATS_PRESTACAO",
  producao: "NO_SEATS_PRODUCAO",
};

/**
 * Módulo pedido na rota de vagas. Sem o campo vale a captação, como sempre foi;
 * um nome que não é módulo é recusado (null), nunca tratado como captação.
 */
export function lerModuloDeVagas(valor: unknown): ModuloId | null {
  if (valor === undefined || valor === null) return "captacao";
  return MODULOS.find(m => m === valor) ?? null;
}

/**
 * Resposta da rota de vagas ao pedido de compra de vagas extras de um módulo
 * que ainda não as vende: a produção espera a cobrança por módulo (PDL.1), que
 * depende do preço, decisão do dono.
 */
export function mensagemCompraIndisponivel(modulo: ModuloId): string {
  return `A compra de usuários extras da ${MODULO_LABEL[modulo].toLowerCase()} ainda não está disponível. Fale com o suporte do Jards.`;
}

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
  if (modulosVetadosAoPapel(papel, canonicos).length > 0) {
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
  // Falta de vaga num módulo com contrato: a mensagem e o código nomeiam o módulo.
  const semVaga = MODULOS_COM_CONTRATO.find(m => mensagem.includes(`sem_vaga_${m}`));
  if (semVaga) return { status: 409, error: mensagemErroAcesso(mensagem), code: CODIGO_SEM_VAGA[semVaga] };
  // Captação, e as funções antigas, que só conhecem a captação.
  if (erro.code === "23514" || mensagem.includes("sem_vaga") || mensagem.includes("assentos disponiveis")) {
    return { status: 409, error: mensagemErroAcesso("sem_vaga_captacao"), code: CODIGO_SEM_VAGA.captacao };
  }
  const conhecida = mensagemErroAcesso(mensagem);
  if (!conhecida.includes("Tente de novo")) return { status: 409, error: conhecida };
  return { status: 500, error: mensagem || "Não foi possível concluir. Tente de novo." };
}

// ─── Telas de equipe ────────────────────────────────────────────────────────

/**
 * Módulos que a tela de equipe oferece a uma pessoa: os do plano (a captação,
 * que toda organização tem), os que a organização tem ativos e os que a pessoa
 * já usa (ela não perde o que já tem).
 */
export function modulosDaEquipe(ativosDaOrganizacao: readonly ModuloId[], daPessoa: readonly string[]): ModuloId[] {
  return MODULOS.filter(m => ORIGEM_DAS_VAGAS[m] === "plano" || ativosDaOrganizacao.includes(m) || daPessoa.includes(m));
}

/** Marca ou desmarca um módulo no convite: sempre fica ao menos um, na ordem de MODULOS. */
export function alternarModulo(escolhidos: ModuloId[], modulo: ModuloId): ModuloId[] {
  if (escolhidos.includes(modulo)) return escolhidos.length > 1 ? escolhidos.filter(m => m !== modulo) : escolhidos;
  return MODULOS.filter(m => m === modulo || escolhidos.includes(m));
}

/** Os módulos que o convite pede: os marcados que a organização ainda oferece, na ordem de MODULOS; sem nenhum, a captação. */
export function modulosDoConvite(marcados: readonly ModuloId[], oferecidos: readonly ModuloId[]): ModuloId[] {
  const validos = MODULOS.filter(m => marcados.includes(m) && oferecidos.includes(m));
  return validos.length > 0 ? validos : ["captacao"];
}

/** Dos módulos escolhidos, os sem vaga livre; sem a contagem do módulo, vale como sem vaga. */
export function modulosSemVaga(escolhidos: readonly ModuloId[], livres: Partial<Record<ModuloId, number>>): ModuloId[] {
  return escolhidos.filter(m => (livres[m] ?? 0) === 0);
}

const SO_DO_MODULO: Record<ModuloId, string> = {
  captacao: "da captação",
  prestacao: "da prestação",
  producao: "da produção",
};

const ENTRA_DIRETO_EM: Record<ModuloId, string> = {
  captacao: "na captação",
  prestacao: "nas prestações de contas",
  producao: "na produção",
};

/** Aviso do convite a quem fica sem a captação; null quando a pessoa tem a captação ou não há módulo. */
export function avisoSemCaptacao(escolhidos: readonly ModuloId[]): string | null {
  if (escolhidos.includes("captacao")) return null;
  const outros = MODULOS.filter(m => escolhidos.includes(m));
  if (outros.length === 0) return null;
  return `Usuário só ${juntar(outros.map(m => SO_DO_MODULO[m]))}: entra direto ${ENTRA_DIRETO_EM[outros[0]]} e não vê a captação.`;
}
