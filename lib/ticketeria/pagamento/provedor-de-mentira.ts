// O provedor de mentira (T4): implementa a interface do provedor sem dinheiro nenhum, para o núcleo ser provado de ponta a ponta antes
// da escolha do provedor real (decisão do dono). A cobrança é um Pix falso; o aviso de pagamento é assinado com HMAC-SHA256 como os
// provedores de verdade fazem, e `simularAviso` o produz nos testes. Nunca roda em produção: `provedorDeMentira` recusa.

import { createHmac, timingSafeEqual } from "node:crypto";
import type { AvisoDoProvedor, Cobranca, LeituraDoAviso, ProvedorDePagamento } from "@/lib/ticketeria/pagamento/provedor";

const assinar = (corpo: string, segredo: string) => createHmac("sha256", segredo).update(corpo).digest("hex");

const TIPOS = new Set<AvisoDoProvedor["tipo"]>(["pagamento_confirmado", "pagamento_recusado", "estorno_confirmado"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ProvedorDeMentira implements ProvedorDePagamento {
  readonly nome = "mentira";
  readonly estornos: { ref: string; valor: number }[] = [];

  constructor(private readonly segredo: string) {
    if (segredo.length < 16) throw new Error("o segredo do provedor de mentira tem de ter ao menos 16 letras");
  }

  async criarCobranca(pedido: Parameters<ProvedorDePagamento["criarCobranca"]>[0]): Promise<Cobranca> {
    return { ref: `mentira_${pedido.id}`, pix_copia_e_cola: `PIX-DE-MENTIRA:${pedido.codigo}:${pedido.total_centavos}`, url: null, expira_em: pedido.expira_em };
  }

  async estornar(ref: string, valorCentavos: number): Promise<{ ok: boolean }> {
    this.estornos.push({ ref, valor: valorCentavos });
    return { ok: true };
  }

  /** O aviso como o provedor mandaria: o corpo em JSON e a assinatura dele. */
  simularAviso(aviso: AvisoDoProvedor): { corpo: string; assinatura: string } {
    const corpo = JSON.stringify(aviso);
    return { corpo, assinatura: assinar(corpo, this.segredo) };
  }

  lerAviso(corpo: string, assinatura: string | null): LeituraDoAviso {
    const esperada = Buffer.from(assinar(corpo, this.segredo), "hex");
    const recebida = Buffer.from(/^[0-9a-f]{64}$/i.test(assinatura ?? "") ? assinatura! : "", "hex");
    if (recebida.length !== esperada.length || !timingSafeEqual(recebida, esperada)) return { ok: false, motivo: "assinatura_invalida" };
    let dados: unknown;
    try {
      dados = JSON.parse(corpo);
    } catch {
      return { ok: false, motivo: "corpo_invalido" };
    }
    const a = (dados && typeof dados === "object" ? dados : {}) as Record<string, unknown>;
    if (typeof a.id_externo !== "string" || a.id_externo === "" || a.id_externo.length > 200) return { ok: false, motivo: "corpo_invalido" };
    if (typeof a.tipo !== "string" || !TIPOS.has(a.tipo as AvisoDoProvedor["tipo"])) return { ok: false, motivo: "corpo_invalido" };
    if (typeof a.pedido_id !== "string" || !UUID.test(a.pedido_id)) return { ok: false, motivo: "corpo_invalido" };
    if (typeof a.ref !== "string" || a.ref === "" || a.ref.length > 200) return { ok: false, motivo: "corpo_invalido" };
    if (typeof a.valor_centavos !== "number" || !Number.isSafeInteger(a.valor_centavos) || a.valor_centavos < 0) return { ok: false, motivo: "corpo_invalido" };
    return { ok: true, aviso: { id_externo: a.id_externo, tipo: a.tipo as AvisoDoProvedor["tipo"], pedido_id: a.pedido_id, ref: a.ref, valor_centavos: a.valor_centavos } };
  }
}

/**
 * O provedor de mentira, só fora de produção e só com o segredo configurado (TICKETERIA_SEGREDO_DE_MENTIRA). Em produção, ou sem o
 * segredo, devolve null: nenhum aviso falso confirma pedido de verdade.
 */
export function provedorDeMentira(ambiente: { NODE_ENV?: string; VERCEL_ENV?: string; TICKETERIA_SEGREDO_DE_MENTIRA?: string } = process.env): ProvedorDeMentira | null {
  if (ambiente.NODE_ENV === "production" || ambiente.VERCEL_ENV === "production") return null;
  const segredo = ambiente.TICKETERIA_SEGREDO_DE_MENTIRA ?? "";
  return segredo.length >= 16 ? new ProvedorDeMentira(segredo) : null;
}
