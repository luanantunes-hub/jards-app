// Canais da equipe que o botão "?" do app oferece além da caixa de mensagem. É o mesmo número do botão de WhatsApp
// das páginas públicas (public/*.html).
const WHATSAPP_DA_EQUIPE = "5515997160914";

/** Abre o WhatsApp da equipe com o texto pronto. */
export function linkDoWhatsapp(texto: string): string {
  return `https://wa.me/${WHATSAPP_DA_EQUIPE}?text=${encodeURIComponent(texto)}`;
}

/** Perguntas de exemplo da primeira tela da ajuda: o que mais se procura, para a pessoa reconhecer e clicar. */
export const PERGUNTAS_DE_EXEMPLO = [
  "Como crio uma negociação?",
  "Como funcionam os créditos?",
  "Como conecto o Claude ao Jards?",
] as const;
