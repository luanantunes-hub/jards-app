// A porta (passo C5 da T5): o que a conferência de ingressos devolve do banco, em frases e horas para a tela. Só a conta, sem banco e sem imports de servidor: roda no
// navegador e nos testes (tests/ticketeria-porta.test.ts). O banco decide tudo (fn_ticketeria_conferir_ingresso); aqui só se lê e se formata.

import type { EntradaRecente, ResultadoDaConferencia } from "@/components/ticketeria/PortaView";
import { diaEHoraDoEvento } from "@/lib/ticketeria/pagamento/ingressos";

/** O código lido do QR Code ou digitado: sem espaços e traços, em maiúsculas; se vier dentro de um endereço ou de um texto, acha as 10 letras e números do ingresso. */
export function normalizarCodigo(texto: string): string {
  const bruto = (texto ?? "").toUpperCase();
  const achado = /(?:^|[^A-Z0-9])([A-HJ-NP-Z2-9]{10})(?:[^A-Z0-9]|$)/.exec(bruto);
  if (achado) return achado[1];
  return bruto.replace(/[^A-Z0-9]/g, "");
}

/** "19:58", no fuso do local. */
export function horaNoFuso(iso: string, fuso: string): string {
  try { return new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso)); } catch { return iso; }
}

const texto = (v: unknown) => (typeof v === "string" ? v : "");

/** A resposta do banco como a tela mostra; null se veio algo que não se entende (a tela diz "tente de novo", nunca "pode entrar"). */
export function resultadoDaConferencia(bruto: unknown, fusoDaSessao: string): ResultadoDaConferencia | null {
  const r = (bruto && typeof bruto === "object" ? bruto : {}) as Record<string, unknown>;
  const codigo = texto(r.codigo);
  switch (r.tipo) {
    case "pode_entrar":
      return typeof r.restantes === "number" ? { tipo: "pode_entrar", ingresso: texto(r.ingresso), comprador: texto(r.comprador), codigo, restantes: r.restantes } : null;
    case "ja_usado":
      return { tipo: "ja_usado", ingresso: texto(r.ingresso), comprador: texto(r.comprador), codigo, usado_em: horaNoFuso(texto(r.usado_em), texto(r.fuso) || fusoDaSessao) };
    case "outra_sessao": {
      const quando = texto(r.sessao_inicio) ? diaEHoraDoEvento(texto(r.sessao_inicio), texto(r.sessao_fuso) || fusoDaSessao) : "";
      return { tipo: "outra_sessao", ingresso: texto(r.ingresso), sessao_do_ingresso: [texto(r.evento), quando].filter(Boolean).join(", "), codigo };
    }
    case "cancelado": return { tipo: "cancelado", ingresso: texto(r.ingresso), codigo };
    case "nao_encontrado": return { tipo: "nao_encontrado", codigo };
    default: return null;
  }
}

export type ResumoDaPorta = { validos: number; entraram: number; recentes: EntradaRecente[] };

export function resumoDaPorta(bruto: unknown): ResumoDaPorta | null {
  const r = (bruto && typeof bruto === "object" ? bruto : {}) as Record<string, unknown>;
  if (typeof r.validos !== "number" || typeof r.entraram !== "number" || !Array.isArray(r.recentes)) return null;
  const fuso = texto(r.fuso) || "America/Sao_Paulo";
  return {
    validos: r.validos, entraram: r.entraram,
    recentes: r.recentes.map(x => { const e = (x && typeof x === "object" ? x : {}) as Record<string, unknown>; return { codigo: texto(e.codigo), ingresso: texto(e.ingresso), comprador: texto(e.comprador), hora: horaNoFuso(texto(e.usado_em), fuso) }; }),
  };
}
