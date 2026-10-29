// Aparência do checkout do Stripe, igual nos dois pagamentos: o da Captação
// (função stripe-checkout) e o da prestação de contas (app/api/prestacao/assinatura).
// Segue a capa do LinkedIn: lilás quase branco, botão grafite, cantos de 4px e o
// logo novo. Nome, texto e imagem de cada plano ficam no produto do Stripe.

export const MARCA_DO_CHECKOUT = {
  display_name: "Jards",
  background_color: "#F3EFF9",
  button_color: "#282525",
  border_style: "rounded",
  // O Stripe não oferece a Google Sans; é a mais próxima da lista dele.
  font_family: "be_vietnam_pro",
  logo: { type: "url", url: "https://jards.com.br/stripe/jards-logo.png" },
} as const;

/** O Stripe só aceita branding_settings a partir da API 2025-09-30.clover. */
export const VERSAO_DA_API_COM_MARCA = "2026-06-24.dahlia";
