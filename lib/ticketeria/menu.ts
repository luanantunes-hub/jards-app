// As abas da Ticketeria: o menu lateral tem seis itens e, dentro de Vendas, Divulgação e Configurações, uma barra de abas leva às
// páginas que antes eram itens soltos. Puro (sem imports de servidor) para rodar nos testes (tests/ticketeria-menu.test.ts).

export type Aba = { rotulo: string; href: string; /** Outras rotas que acendem esta aba (a página de detalhe, o relatório). */ tambem?: string[] };
export type GrupoDeAbas = { id: "vendas" | "divulgacao" | "configuracoes"; abas: Aba[] };

export const GRUPOS_DE_ABAS: GrupoDeAbas[] = [
  { id: "vendas", abas: [
    { rotulo: "Pedidos", href: "/ingressos/vendas" },
    { rotulo: "Porta", href: "/ingressos/porta" },
    { rotulo: "Bilheteria", href: "/ingressos/bilheteria" },
  ] },
  { id: "divulgacao", abas: [
    { rotulo: "Campanhas", href: "/ingressos/divulgacao" },
    { rotulo: "Cupons", href: "/ingressos/cupons" },
    { rotulo: "Lista de espera", href: "/ingressos/espera" },
    { rotulo: "Público", href: "/ingressos/publico" },
  ] },
  { id: "configuracoes", abas: [
    { rotulo: "Loja", href: "/ingressos/site" },
    { rotulo: "Integrações", href: "/ingressos/integracoes" },
    { rotulo: "Espaços", href: "/ingressos/locais" },
  ] },
];

const casa = (path: string, href: string) => path === href || path.startsWith(href + "/");

/** O grupo de abas da página aberta e a aba acesa; null nas páginas que não pertencem a um grupo (Início, Programação, Financeiro, Começar). */
export function abasDaRota(path: string): { grupo: GrupoDeAbas; ativa: Aba } | null {
  for (const grupo of GRUPOS_DE_ABAS) {
    const ativa = grupo.abas.find(aba => casa(path, aba.href) || (aba.tambem ?? []).some(extra => casa(path, extra)));
    if (ativa) return { grupo, ativa };
  }
  return null;
}
