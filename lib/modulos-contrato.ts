// Contrato de um módulo por organização (tabela organization_modulos).
//
// As regras de vigência e de vagas são as mesmas do banco
// (supabase/migrations/20261005120000_organization_modulos.sql): o banco
// decide o acesso; aqui elas servem para a tela explicar a situação e para a
// rota de admin validar o pedido antes de gravar.

export type StatusContrato = "ativo" | "teste" | "atraso" | "cancelado" | "cortesia";

export type ContratoModulo = {
  status: StatusContrato;
  cortesia_ate: string | null;
  past_due_since: string | null;
  vagas_cortesia: number;
  vagas_compradas: number;
};

/** Carência do atraso, a mesma da captação. */
export const CARENCIA_ATRASO_DIAS = 15;
export const VAGAS_CORTESIA_MAX = 50;
/** Cortesia longa vira contrato esquecido: até um ano por vez. */
export const CORTESIA_MAX_DIAS = 366;

const DIA_MS = 24 * 60 * 60 * 1000;

/** Data de hoje em Brasília, no formato do banco (AAAA-MM-DD). */
export function hojeEmBrasilia(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(agora);
}

function ehData(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const data = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}

/** Dias corridos de `de` até `ate` (datas AAAA-MM-DD). */
export function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / DIA_MS);
}

/** A cortesia vale até o fim do último dia, no horário de Brasília. */
export function contratoEmVigor(contrato: ContratoModulo, agora: Date = new Date()): boolean {
  switch (contrato.status) {
    case "ativo":
    case "teste":
      return true;
    case "atraso":
      return contrato.past_due_since === null
        || agora.getTime() - Date.parse(contrato.past_due_since) < CARENCIA_ATRASO_DIAS * DIA_MS;
    case "cortesia":
      return contrato.cortesia_ate === null || contrato.cortesia_ate >= hojeEmBrasilia(agora);
    default:
      return false;
  }
}

/** Quantas pessoas da organização podem usar o módulo. */
export function limiteDeVagas(contrato: ContratoModulo): number {
  return contrato.status === "cortesia" ? contrato.vagas_cortesia : 1 + contrato.vagas_compradas;
}

/** Assinatura paga: a cortesia não pode substituí-la nem encerrá-la. */
export function contratoPago(contrato: Pick<ContratoModulo, "status"> | null): boolean {
  return contrato !== null && ["ativo", "teste", "atraso"].includes(contrato.status);
}

export type PedidoCortesia = { ate: string; motivo: string; vagas: number };

/** Devolve a mensagem para a tela ou null quando o pedido pode ser gravado. */
export function validarCortesia(pedido: PedidoCortesia, emUso: number, hoje: string): string | null {
  if (!ehData(pedido.ate)) return "Informe a data final da cortesia.";
  if (pedido.ate < hoje) return "A data final não pode estar no passado.";
  if (diasEntre(hoje, pedido.ate) > CORTESIA_MAX_DIAS) return "A cortesia pode durar até um ano por vez.";
  const motivo = pedido.motivo.trim();
  if (motivo.length < 3) return "Explique o motivo da cortesia.";
  if (motivo.length > 500) return "O motivo pode ter até 500 caracteres.";
  if (!Number.isInteger(pedido.vagas) || pedido.vagas < 1 || pedido.vagas > VAGAS_CORTESIA_MAX) {
    return `As vagas vão de 1 a ${VAGAS_CORTESIA_MAX}.`;
  }
  if (pedido.vagas < emUso) {
    return `${emUso} pessoas já usam a prestação. Tire o acesso de alguém antes de reduzir as vagas.`;
  }
  return null;
}

/**
 * Erros das funções de acesso por módulo (admin_definir_acesso_modulo,
 * alterar_modulos_membro, convites), em linguagem da tela. Os códigos mais
 * específicos vêm antes: "sem_vaga_prestacao" também contém "sem_vaga".
 */
const ERROS_ACESSO: Record<string, string> = {
  membro_inexistente: "Essa pessoa não faz parte da organização.",
  captador_sem_modulo: "Captadores e proponentes externos usam só a captação.",
  modulo_inativo: "A organização não tem esse módulo ativo.",
  modulo_invalido: "Módulo desconhecido.",
  funcao_invalida: "Função na prestação desconhecida.",
  sem_vaga_captacao: "Todas as vagas da captação estão em uso. Compre usuários extras antes.",
  sem_vaga_prestacao: "Todas as vagas da prestação de contas estão em uso.",
  sem_vaga: "Todas as vagas estão em uso.",
  ultimo_modulo: "A pessoa ficaria sem nenhum módulo.",
};

export function mensagemErroAcesso(erro: string | null | undefined): string {
  const codigo = Object.keys(ERROS_ACESSO).find(chave => erro?.includes(chave));
  return codigo ? ERROS_ACESSO[codigo] : "Não foi possível alterar o acesso. Tente de novo.";
}

/** Texto curto da situação, para a lista de organizações. */
export function situacaoDoContrato(contrato: ContratoModulo | null, agora: Date = new Date()): string {
  if (!contrato) return "Sem prestação";
  const hoje = hojeEmBrasilia(agora);
  switch (contrato.status) {
    case "cortesia": {
      if (!contrato.cortesia_ate) return "Cortesia sem prazo";
      if (!contratoEmVigor(contrato, agora)) return "Cortesia vencida";
      const dias = diasEntre(hoje, contrato.cortesia_ate);
      const data = contrato.cortesia_ate.split("-").reverse().join("/");
      return dias === 0 ? "Cortesia termina hoje" : `Cortesia até ${data}`;
    }
    case "ativo": return "Assinatura ativa";
    case "teste": return "Em teste";
    case "atraso": return contratoEmVigor(contrato, agora) ? "Pagamento em atraso" : "Suspensa por atraso";
    case "cancelado": return "Encerrada";
  }
}
