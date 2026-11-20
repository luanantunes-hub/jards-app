import { Plus_Jakarta_Sans } from "next/font/google";

// Fonte própria da Ticketeria (escolha do dono, 20/11/2026): Plus Jakarta Sans, leve.
// Vale só no painel /ingressos e nas páginas públicas de compra, pedido e termos;
// o resto do Jards continua na Google Sans. As regras de peso estão em globals.css
// (.fonte-ticketeria): o texto corrido é 300, "font-normal" 300, "font-medium" 400
// e "font-semibold" 500.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500"],
  variable: "--font-jakarta",
  display: "swap",
});

// `contents` não cria caixa: o conteúdo continua onde estava; só a fonte é herdada.
export const CLASSE_FONTE_TICKETERIA = `${jakarta.variable} fonte-ticketeria contents`;
