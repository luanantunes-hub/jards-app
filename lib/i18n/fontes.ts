import { Noto_Sans_Arabic, Noto_Sans_JP, Noto_Sans_SC } from "next/font/google";

// Fontes das escritas que a Plus Jakarta Sans (Ticketeria) e a Google Sans (resto do app) não cobrem: chinês, japonês e árabe.
// São hospedadas pelo próprio Jards (o next/font baixa no build): o navegador de quem compra não fala com o Google. Cada fonte só é
// baixada pelo navegador quando a página tem um caractere dela (as fontes de chinês e japonês vêm em fatias por faixa de caracteres).
// O russo usa a Google Sans, que já cobre o cirílico. As regras de qual fonte vale em qual idioma estão em globals.css (.fonte-ticketeria:lang(...)).
// Pesos 300/400/500, os mesmos da Ticketeria.
// (o next/font exige valores escritos no próprio arquivo: nada de constante ou spread nas opções)
const chines = Noto_Sans_SC({ weight: ["300", "400", "500"], variable: "--font-noto-sc", display: "swap", preload: false });
const japones = Noto_Sans_JP({ weight: ["300", "400", "500"], variable: "--font-noto-jp", display: "swap", preload: false });
const arabe = Noto_Sans_Arabic({ weight: ["300", "400", "500"], subsets: ["arabic"], variable: "--font-noto-ar", display: "swap", preload: false });

export const CLASSE_FONTES_DE_IDIOMA = `${chines.variable} ${japones.variable} ${arabe.variable}`;
