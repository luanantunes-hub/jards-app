// A página de Vendas: uma caixa para cada forma de vender, como no Começar. Cada caixa leva à página dela, ou diz "Em breve" quando ainda não existe.
// Só a lista e a regra de qual caixa está "em uso" (a Bilheteria e a Loja online dependem do que a loja escolheu): sem tela e sem banco, roda nos testes
// (tests/ticketeria-vender.test.ts). Quem desenha é components/ticketeria/VenderView.tsx.

import type { Canal, EscolhasDaLoja } from "@/lib/ticketeria/menu";

export type IconeDaCaixa =
  | "store" | "qr" | "globe" | "arroba" | "vitrine" | "codigo" | "botao" | "janela" | "link" | "parceria" | "pessoas" | "api" | "webhook" | "plug";

export type GrupoDeCaixas = { id: string; titulo: string };

export type Caixa = {
  id: string;
  grupo: string;
  titulo: string;
  /** Uma frase, em palavra comum: o que a pessoa ganha. */
  descricao: string;
  icone: IconeDaCaixa;
  /** Para onde a caixa leva. null = ainda não existe ("Em breve"). */
  href: string | null;
  /** Se a caixa é um canal da loja: abrir uma que a loja ainda não escolheu a adiciona (como o "+" fazia). */
  canal?: Canal;
};

export const GRUPOS_DE_CAIXAS: GrupoDeCaixas[] = [
  { id: "balcao", titulo: "No balcão e no cartaz" },
  { id: "site", titulo: "No seu site" },
  { id: "outros", titulo: "Em outros sites e nas redes" },
  { id: "parcerias", titulo: "Com parceiros" },
  { id: "programadores", titulo: "Para programadores" },
];

export const CAIXAS: Caixa[] = [
  { id: "bilheteria", grupo: "balcao", titulo: "Bilheteria", descricao: "Venda no balcão, no dia do evento.", icone: "store", href: "/ingressos/bilheteria", canal: "porta" },
  { id: "qr-cartaz", grupo: "balcao", titulo: "QR Code em cartaz de venda", descricao: "Um cartaz com QR Code que leva direto à compra.", icone: "qr", href: null },

  { id: "site-cms", grupo: "site", titulo: "Site próprio", descricao: "Um site completo para a sua loja, no seu endereço.", icone: "globe", href: "/ingressos/site", canal: "online" },
  { id: "endereco-gratis", grupo: "site", titulo: "Endereço grátis do site", descricao: "Seu site num endereço do Jards, sem precisar de domínio.", icone: "arroba", href: null },
  { id: "vitrine", grupo: "site", titulo: "Criar vitrine", descricao: "Uma página que reúne ingressos, sua e de quem você quiser.", icone: "vitrine", href: null },

  { id: "widget", grupo: "outros", titulo: "Widget para colar no site", descricao: "Cole uma linha no seu site e os ingressos aparecem lá.", icone: "codigo", href: "/ingressos/integracoes" },
  { id: "botao-avulso", grupo: "outros", titulo: "Botão Comprar avulso", descricao: "Um botão de uma sessão só, para colar onde quiser.", icone: "botao", href: null },
  { id: "janela", grupo: "outros", titulo: "Compra em janela sobreposta", descricao: "O cliente compra sem sair do seu site.", icone: "janela", href: null },
  { id: "link-sessao", grupo: "outros", titulo: "Link de venda por sessão", descricao: "Um endereço para mandar por WhatsApp, e-mail e redes. Fica em cada evento.", icone: "link", href: "/ingressos/eventos" },

  { id: "collab", grupo: "parcerias", titulo: "Collab", descricao: "Um evento vendido por dois produtores, cada um no seu site.", icone: "parceria", href: null },
  { id: "afiliados", grupo: "parcerias", titulo: "Promotores e afiliados", descricao: "Pessoas que vendem por um link próprio e ganham comissão.", icone: "pessoas", href: null },

  { id: "api-leitura", grupo: "programadores", titulo: "API pública de leitura", descricao: "Leia eventos e disponibilidade no seu site ou aplicativo.", icone: "api", href: "/ingressos/integracoes" },
  { id: "api-pedido", grupo: "programadores", titulo: "API de criação do pedido", descricao: "Crie pedidos de fora do Jards, pelo seu sistema.", icone: "plug", href: null },
  { id: "webhooks", grupo: "programadores", titulo: "Webhooks de saída", descricao: "Receba um aviso no seu sistema a cada venda.", icone: "webhook", href: "/ingressos/integracoes" },
];

/** "em_uso": a loja escolheu este canal; "disponivel": existe e a loja ainda não o usa (ou nunca escolheu); "em_breve": ainda não existe. */
export type EstadoDaCaixa = "em_uso" | "disponivel" | "em_breve";

export function estadoDaCaixa(caixa: Caixa, loja: EscolhasDaLoja): EstadoDaCaixa {
  if (caixa.href === null) return "em_breve";
  if (caixa.canal && loja.canais !== null && loja.canais.includes(caixa.canal)) return "em_uso";
  return "disponivel";
}

/** As caixas de cada grupo, na ordem, já com o estado para esta loja. Grupo sem caixa não aparece. */
export function gruposDaLoja(loja: EscolhasDaLoja): { grupo: GrupoDeCaixas; caixas: (Caixa & { estado: EstadoDaCaixa })[] }[] {
  return GRUPOS_DE_CAIXAS
    .map(grupo => ({ grupo, caixas: CAIXAS.filter(c => c.grupo === grupo.id).map(c => ({ ...c, estado: estadoDaCaixa(c, loja) })) }))
    .filter(g => g.caixas.length > 0);
}
