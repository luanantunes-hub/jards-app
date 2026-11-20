// O tratamento do pedido HTTP do aviso (webhook) do provedor, sem depender do Next nem do banco: a rota só liga as peças reais
// (T5, parte 3). Responde 503 quando o provedor não está configurado (sandbox sem chave: a rota fica inerte), 413 para corpo grande
// demais, e para o resto devolve o que `processarAviso` decidiu. Falha passageira vira 500, para o provedor reenviar.

import { processarAviso, type PortasDosAvisos } from "@/lib/ticketeria/pagamento/avisos";
import type { ProvedorDePagamento } from "@/lib/ticketeria/pagamento/provedor";

/** O maior corpo aceito. Os avisos do Asaas têm poucos KB. */
export const TAMANHO_MAXIMO_DO_AVISO = 64 * 1024;

export type RespostaDoAviso = { status: number; corpo: { resultado?: string; error?: string } };

export async function tratarAvisoDoProvedor(entrada: {
  provedor: ProvedorDePagamento | null;
  portas: () => PortasDosAvisos;
  corpo: string;
  assinatura: string | null;
  registrarErro?: (erro: unknown) => void;
}): Promise<RespostaDoAviso> {
  if (!entrada.provedor) return { status: 503, corpo: { error: "provedor_nao_configurado" } };
  if (new TextEncoder().encode(entrada.corpo).length > TAMANHO_MAXIMO_DO_AVISO) return { status: 413, corpo: { error: "corpo_grande_demais" } };
  try {
    const r = await processarAviso(entrada.provedor, entrada.portas(), entrada.corpo, entrada.assinatura);
    return { status: r.status, corpo: { resultado: r.resultado } };
  } catch (erro) {
    entrada.registrarErro?.(erro);
    return { status: 500, corpo: { error: "falha_ao_processar" } };
  }
}
