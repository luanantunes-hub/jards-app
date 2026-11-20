/** Quem recebe os exemplos: só quem acabou de criar a própria conta, numa organização vazia e só dela. */
export const JANELA_DE_CONTA_NOVA_MS = 3 * 24 * 60 * 60 * 1000;

export type SituacaoDaConta = {
  papelNaOrganizacao: string | null;
  membrosDaOrganizacao: number;
  /** Convites (pendentes, aceitos ou revogados) feitos para esta pessoa. */
  convitesRecebidos: number;
  /** Registros que a organização já tem (projetos, empresas, negociações, atividades, contatos, proponentes). */
  registrosDaOrganizacao: number;
  contaCriadaEm: string | null;
  agora: number;
};

export type MotivoDeNaoSemear = "nao_e_admin" | "equipe" | "convidado" | "organizacao_com_dados" | "conta_antiga";

export function motivoDeNaoSemear(situacao: SituacaoDaConta): MotivoDeNaoSemear | null {
  if (situacao.papelNaOrganizacao !== "admin") return "nao_e_admin";
  if (situacao.membrosDaOrganizacao !== 1) return "equipe";
  if (situacao.convitesRecebidos > 0) return "convidado";
  if (situacao.registrosDaOrganizacao > 0) return "organizacao_com_dados";
  const criada = situacao.contaCriadaEm ? Date.parse(situacao.contaCriadaEm) : Number.NaN;
  if (!Number.isFinite(criada) || situacao.agora - criada > JANELA_DE_CONTA_NOVA_MS) return "conta_antiga";
  return null;
}

/** Quanto da barra de "Configurando o ambiente" já andou: sobe depressa e se aproxima de 92% sem nunca chegar. */
export function progressoDaConfiguracao(decorridoMs: number): number {
  const t = Math.max(0, decorridoMs);
  return Math.min(92, 92 * (1 - Math.exp(-t / 1500)));
}
