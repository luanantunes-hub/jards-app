// Pede ao servidor uma nova verificação da prestação (P2.7) e avisa as telas
// abertas. Depois de uma gravação, pedirVerificacao junta os pedidos de um
// instante num só; o botão "Verificar agora" usa verificarAgora.

export type ResumoVerificacao = {
  abertas: number;
  bloqueios: number;
  avisos: number;
  justificadas: number;
  dispensadas: number;
  resolvidas: number;
  verificada_em: string;
  achados: number;
};

/** Evento que o painel de verificações escuta para ler de novo. */
export const EVENTO_VERIFICADA = "prestacao:verificada";

export async function verificarAgora(prestacaoId: string): Promise<ResumoVerificacao> {
  const resposta = await fetch(`/api/prestacoes/${prestacaoId}/verificar`, { method: "POST" });
  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(typeof corpo.error === "string" ? corpo.error : "verificacao_falhou");
  window.dispatchEvent(new CustomEvent(EVENTO_VERIFICADA, { detail: { prestacaoId } }));
  return corpo as ResumoVerificacao;
}

const agendadas = new Map<string, ReturnType<typeof setTimeout>>();

/** Verifica pouco depois da gravação; vários pedidos seguidos viram um. Falha fica calada: o painel tem o botão. */
export function pedirVerificacao(prestacaoId: string, esperaMs = 1200): void {
  const anterior = agendadas.get(prestacaoId);
  if (anterior) clearTimeout(anterior);
  agendadas.set(prestacaoId, setTimeout(() => {
    agendadas.delete(prestacaoId);
    verificarAgora(prestacaoId).catch(() => {});
  }, esperaMs));
}
