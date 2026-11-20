// O aceite de novidades na compra: "Quero receber novidades e ofertas deste produtor". É um aceite à parte dos Termos de compra, desmarcado de início, e o pedido guarda QUAL texto foi
// aceito (a versão) e QUANDO. O WhatsApp é opcional e só é guardado junto com o aceite. Só o texto, a versão e as contas do número, sem banco e sem imports de servidor: a tela de compra,
// o servidor e os testes usam os mesmos números. TROCAR O TEXTO = trocar a versão.

/** A versão do texto abaixo. Muda toda vez que o texto muda; o pedido guarda a versão que o comprador aceitou. */
export const VERSAO_DAS_NOVIDADES = "2026-11-20";
export const TEXTO_DAS_NOVIDADES = "Quero receber novidades e ofertas deste produtor, por e-mail e pelo WhatsApp (se eu informar o número). Posso sair da lista quando quiser.";

/** Só os dígitos do número, com o 55 na frente (DDD e número de 10 ou 11 dígitos), ou null se não for um telefone do Brasil. */
export function lerWhatsapp(entrada: unknown): string | null {
  if (typeof entrada !== "string") return null;
  let d = entrada.replace(/\D/g, "");
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) return null;
  if (!/^[1-9][1-9]/.test(d)) return null;
  if (d.length === 11 && d[2] !== "9") return null;
  return `55${d}`;
}

/** O número como a pessoa vai digitando: (15) 99712-4410 (celular, que começa em 9 depois do DDD) ou (15) 3333-4410 (fixo). */
export function mascararWhatsapp(entrada: string): string {
  const d = entrada.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  const ddd = `(${d.slice(0, 2)}) `;
  const resto = d.slice(2);
  const corte = resto[0] === "9" ? 5 : 4;
  return resto.length <= corte ? ddd + resto : `${ddd}${resto.slice(0, corte)}-${resto.slice(corte)}`;
}

export type NovidadesDaCompra = { versao: string; whatsapp: string | null };
