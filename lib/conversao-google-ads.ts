// Conversões do Google Ads avisadas pela tag do Google: "Inscrição", quando a
// conta é criada (com o e-mail para as conversões otimizadas, que a tag
// criptografa antes de enviar), e "Compra", quando a assinatura é paga. Sem o
// aceite do aviso de cookies a tag nem é carregada (public/consentimento.js)
// e nada é enviado.

export const CONVERSAO_CADASTRO_ADS = "AW-18498679750/Ev-4CMq2hJQdEMbn7fRE";
export const CONVERSAO_ASSINATURA_ADS = "AW-18498679750/CrTtCMvchpQdEMbn7fRE";
// Quanto vale um cadastro: 1 em 14 vira assinante, que rende uns R$ 240.
export const VALOR_CADASTRO = 17;

// Assinatura conferida no Stripe: valor pago, moeda e o código do pagamento,
// que evita contar a mesma compra duas vezes.
export type CompraVerificada = { valor: number; moeda: string; transacao: string };

const ESPERA_MS = 1500;

type Gtag = (...args: unknown[]) => void;

function tagDoGoogle(): Gtag | null {
  const gtag = (globalThis as { gtag?: unknown }).gtag;
  return typeof gtag === "function" ? (gtag as Gtag) : null;
}

// Resolve quando o Google confirma o envio, ou em 1,5 s: quem está se
// cadastrando ou assinando nunca fica esperando o Google.
function enviarConversao(gtag: Gtag, dados: Record<string, unknown>): Promise<void> {
  return new Promise((resolve) => {
    const fim = setTimeout(resolve, ESPERA_MS);
    gtag("event", "conversion", {
      ...dados,
      event_callback: () => {
        clearTimeout(fim);
        resolve();
      },
    });
  });
}

export function registrarCadastroNoGoogleAds(email: string): Promise<void> {
  const gtag = tagDoGoogle();
  if (!gtag) return Promise.resolve();
  gtag("set", "user_data", { email: email.trim().toLowerCase() });
  return enviarConversao(gtag, { send_to: CONVERSAO_CADASTRO_ADS, value: VALOR_CADASTRO, currency: "BRL" });
}

export function registrarAssinaturaNoGoogleAds(compra: CompraVerificada): Promise<void> {
  const gtag = tagDoGoogle();
  if (!gtag) return Promise.resolve();
  return enviarConversao(gtag, {
    send_to: CONVERSAO_ASSINATURA_ADS,
    value: compra.valor,
    currency: compra.moeda,
    transaction_id: compra.transacao,
  });
}

// A tag carrega logo depois da página; espera ela aparecer, até um limite.
export async function esperarTagDoGoogle(limiteMs = 2500): Promise<boolean> {
  const inicio = Date.now();
  while (Date.now() - inicio < limiteMs) {
    if (tagDoGoogle()) return true;
    await new Promise((pronto) => setTimeout(pronto, 100));
  }
  return tagDoGoogle() !== null;
}
