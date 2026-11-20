// Assinatura no padrão Svix (usado pelos webhooks do Resend), sem o pacote:
// HMAC-SHA256 de "<id>.<timestamp>.<corpo>" com a chave do segredo
// (whsec_<base64>), comparado em tempo constante com cada "v1,<base64>" do
// cabeçalho. Separado de webhook-resend para poder ser testado.

import { createHmac, timingSafeEqual } from "node:crypto";

export const TOLERANCIA_SEGUNDOS = 5 * 60;

export function assinarSvix(segredo: string, id: string, timestamp: string, corpo: string): string {
  const chave = Buffer.from(segredo.replace(/^whsec_/, ""), "base64");
  return createHmac("sha256", chave).update(`${id}.${timestamp}.${corpo}`).digest("base64");
}

export function conferirAssinaturaSvix(p: {
  segredo: string;
  id: string | null;
  timestamp: string | null;
  assinaturas: string | null;
  corpo: string;
  agora: number;
}): boolean {
  if (!p.segredo || !p.id || !p.timestamp || !p.assinaturas) return false;
  const segundos = Number(p.timestamp);
  if (!Number.isFinite(segundos) || Math.abs(p.agora / 1000 - segundos) > TOLERANCIA_SEGUNDOS) return false;
  const esperada = Buffer.from(assinarSvix(p.segredo, p.id, p.timestamp, p.corpo));
  return p.assinaturas.split(" ").some(parte => {
    const [versao, assinatura] = parte.split(",");
    if (versao !== "v1" || !assinatura) return false;
    const recebida = Buffer.from(assinatura);
    return recebida.length === esperada.length && timingSafeEqual(recebida, esperada);
  });
}
