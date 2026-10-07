// Conversão "Inscrição" no Google Ads, avisada pela tag do Google no momento
// em que a conta é criada, com o e-mail para as conversões otimizadas (a tag o
// criptografa antes de enviar). Sem o aceite do aviso de cookies a tag nem é
// carregada (public/consentimento.js) e nada é enviado.

export const CONVERSAO_CADASTRO_ADS = "AW-18498679750/Ev-4CMq2hJQdEMbn7fRE";
// Quanto vale um cadastro: 1 em 14 vira assinante, que rende uns R$ 240.
export const VALOR_CADASTRO = 17;

const ESPERA_MS = 1500;

type Gtag = (...args: unknown[]) => void;

function tagDoGoogle(): Gtag | null {
  const gtag = (globalThis as { gtag?: unknown }).gtag;
  return typeof gtag === "function" ? (gtag as Gtag) : null;
}

// Resolve quando o Google confirma o envio, ou em 1,5 s: o cadastro nunca
// fica esperando o Google.
export function registrarCadastroNoGoogleAds(email: string): Promise<void> {
  const gtag = tagDoGoogle();
  if (!gtag) return Promise.resolve();
  return new Promise((resolve) => {
    const fim = setTimeout(resolve, ESPERA_MS);
    gtag("set", "user_data", { email: email.trim().toLowerCase() });
    gtag("event", "conversion", {
      send_to: CONVERSAO_CADASTRO_ADS,
      value: VALOR_CADASTRO,
      currency: "BRL",
      event_callback: () => {
        clearTimeout(fim);
        resolve();
      },
    });
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
