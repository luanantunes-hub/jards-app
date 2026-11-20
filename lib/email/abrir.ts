/** Para onde levar a pessoa quando ela pede para abrir a conversa no Gmail ou no Outlook. */

/** A conversa no Gmail. `u/<e-mail>` abre a conta certa mesmo com várias contas logadas no mesmo navegador. */
export function enderecoNoGmail(contaEmail: string | null, threadId: string): string {
  const conta = contaEmail ? encodeURIComponent(contaEmail).replace(/%40/g, "@") : "0";
  return `https://mail.google.com/mail/u/${conta}/#all/${encodeURIComponent(threadId)}`;
}

/** Quando o Outlook não devolve o endereço da mensagem, a pessoa cai na caixa de entrada. */
export const CAIXA_DE_ENTRADA_DO_OUTLOOK = "https://outlook.office.com/mail/";

/**
 * O Microsoft Graph informa o endereço da mensagem no Outlook na web (`webLink`).
 * Só endereços https da própria Microsoft servem de destino; qualquer outra coisa é descartada.
 */
export function enderecoDoOutlookValido(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  try {
    const url = new URL(valor);
    if (url.protocol !== "https:") return null;
    return /(^|\.)(office|office365|outlook|live)\.com$/i.test(url.hostname) ? url.toString() : null;
  } catch {
    return null;
  }
}
