// Motor de checagens (P2.7, P2.8).
//
// Cada checagem é uma função pura que olha o estado da prestação (despesas,
// fornecedores, orçamento, pagamentos, extrato, datas, metas, locais e evidências) e o regime, e devolve
// achados com código estável. A rota /api/prestacoes/[id]/verificar monta o
// estado no servidor (estado.ts), roda tudo e grava em prestacao_verificacoes
// por fn_prestacao_verificacoes_sincronizar: achado novo abre, achado que
// sumiu se resolve sozinho, e a decisão de uma pessoa (justificar, dispensar)
// fica com o achado enquanto ele existir.
//
// A chave do achado (código, entidade e referência) liga uma verificação à
// seguinte; a mensagem pode mudar (um valor corrigido) sem perder a decisão.
// Na dúvida, o achado é "revisar"; quando falta dado, "não calculável", nunca
// um conforme calado. Sem React e sem Supabase.

import type { Achado, EstadoDaPrestacao, SeveridadeChecagem } from "./catalogo";
import { checarConciliacao } from "./checar-conciliacao";
import { checarDespesas } from "./checar-despesas";
import { checarConcentracao, checarOrcamento, checarPeriodo } from "./checar-financeiro";
import { checarEvidencias } from "./checar-evidencias";
import { checarCobertura, checarObjeto } from "./checar-objeto";
import { checarDistribuicao } from "./checar-distribuicao";

export * from "./catalogo";
export { captadoDoExtrato } from "./checar-financeiro";

/** As checagens, na ordem em que a tela mostra. */
export const CHECAGENS: readonly { id: string; titulo: string; executar: (estado: EstadoDaPrestacao) => Achado[] }[] = [
  { id: "despesas", titulo: "Despesas, fornecedores e pagamentos", executar: checarDespesas },
  { id: "conciliacao", titulo: "Conciliação com o extrato", executar: checarConciliacao },
  { id: "periodo", titulo: "Período dos documentos e liberação", executar: checarPeriodo },
  { id: "orcamento", titulo: "Saldo dos itens, tetos e alterações", executar: checarOrcamento },
  { id: "concentracao", titulo: "Concentração por fornecedor e partes relacionadas", executar: checarConcentracao },
  { id: "objeto", titulo: "Metas e locais do objeto", executar: checarObjeto },
  { id: "evidencias", titulo: "Evidências: vínculo, data e local da foto", executar: checarEvidencias },
  { id: "cobertura", titulo: "Cobertura das metas e atividades por evidências", executar: checarCobertura },
  { id: "distribuicao", titulo: "Plano de distribuição: cotas, preços e realizado", executar: checarDistribuicao },
];

/** Roda todas as checagens; chaves repetidas ganham um sufixo para continuarem únicas. */
export function executarChecagens(estado: EstadoDaPrestacao): Achado[] {
  const vistas = new Map<string, number>();
  return CHECAGENS.flatMap(c => c.executar(estado)).map(achado => {
    const vezes = (vistas.get(achado.chave) ?? 0) + 1;
    vistas.set(achado.chave, vezes);
    return vezes === 1 ? achado : { ...achado, chave: `${achado.chave}#${vezes}` };
  });
}

/** Conta o que pede ação: abertas por severidade (info fica de fora). */
export function pendenciasPorSeveridade(verificacoes: readonly { severidade: string; status: string }[]): Record<Exclude<SeveridadeChecagem, "info">, number> {
  const contagem = { bloqueio: 0, alerta: 0, justificativa: 0 };
  for (const v of verificacoes) {
    if (v.status !== "aberta" || v.severidade === "info") continue;
    if (v.severidade in contagem) contagem[v.severidade as keyof typeof contagem]++;
  }
  return contagem;
}
