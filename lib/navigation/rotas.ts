/**
 * Títulos de aba e seção ativa do menu lateral para as rotas pós-login.
 * Mantido puro (sem React) para ser testável e importável pelos layouts de
 * servidor de cada seção, que publicam o título como metadata.
 */

const TITULOS: [prefixo: string, titulo: string][] = [
  ["/dashboard", "Visão geral"],
  ["/atividades", "Atividades"],
  ["/projetos", "Projetos"],
  ["/patrocinadores", "Patrocinadores"],
  ["/comparativo", "Comparativo"],
  ["/editais-abertos", "Editais"],
  ["/empresas-crm", "Empresas"],
  ["/captacoes", "Negociações"],
  ["/editais-inscritos", "Inscrições"],
  ["/proponentes", "Proponentes"],
  ["/captadores", "Captadores"],
  ["/equipe", "Equipe"],
  ["/contatos", "Contatos"],
  ["/contas-patrocinio", "Clientes"],
  ["/contratos", "Contrato"],
  ["/entregas", "Entrega"],
  ["/ativacoes", "Ativação"],
  ["/prestacoes/fornecedores", "Fornecedores"],
  ["/prestacoes", "Prestações"],
  ["/producoes/equipe", "Equipe da produção"],
  ["/producoes/espacos", "Espaços da produção"],
  ["/producoes/pauta", "Pauta dos espaços"],
  ["/producoes/programacao", "Programação dos espaços"],
  ["/producoes/expografia", "Expografia das salas"],
  ["/producoes/acessibilidade", "Acessibilidade das sessões"],
  ["/producoes/visitacao", "Visitação e grupos"],
  ["/producoes/formacao", "Formação"],
  ["/producoes/mapa", "Mapa da turnê"],
  ["/producoes/linha-do-tempo", "Linha do tempo da produção"],
  ["/producoes/inventario", "Inventário da produção"],
  ["/producoes/veiculos", "Veículos da produção"],
  ["/producoes/plantas", "Plantas da produção"],
  ["/producoes/riders", "Riders da produção"],
  ["/producoes/tarefas", "Tarefas da produção"],
  ["/producoes/documentos", "Documentos da produção"],
  ["/producoes/acertos", "Acerto técnico"],
  ["/producoes/pedidos", "Pedido de pagamento"],
  ["/producoes/faturas", "Fatura"],
  ["/producoes/acordos", "Acordo"],
  ["/producoes/adiantamentos", "Adiantamento"],
  ["/producoes/linhas-do-orcamento", "Linha do orçamento"],
  ["/producoes", "Produção"],
  ["/ingressos/site", "Site da loja"],
  ["/ingressos/vendas", "Vendas"],
  ["/ingressos/porta/relatorio", "Relatório da porta"],
  ["/ingressos/porta", "Porta"],
  ["/ingressos/recebimentos", "Recebimentos"],
  ["/ingressos/cupons", "Cupons"],
  ["/ingressos/espera", "Lista de espera"],
  ["/ingressos/locais", "Locais"],
  ["/ingressos/eventos", "Evento"],
  ["/ingressos", "Ingressos"],
  ["/configuracoes/mcp", "Claude e ChatGPT (MCP)"],
  ["/configuracoes", "Configurações"],
  ["/meu-plano", "Meu plano"],
  ["/notificacoes", "Notificações"],
  ["/gerenciar-blog", "Publicações"],
  ["/workspace-captador", "Meu workspace"],
  ["/workspace-proponente", "Meus projetos"],
];

/** Páginas sem item próprio no menu que pertencem a outra seção. */
const SECAO_DO_MENU: Record<string, string> = {
  "/contratos": "/contas-patrocinio",
  "/entregas": "/contas-patrocinio",
  "/ativacoes": "/contas-patrocinio",
  // Páginas de detalhe da produção que nascem de uma temporada: o menu acende Temporadas, não a Agenda.
  "/producoes/pedidos": "/producoes/temporadas",
  "/producoes/faturas": "/producoes/temporadas",
  "/producoes/acordos": "/producoes/temporadas",
  "/producoes/adiantamentos": "/producoes/temporadas",
  "/producoes/linhas-do-orcamento": "/producoes/temporadas",
  // A página de um evento nasce da lista de eventos: o menu acende Eventos.
  "/ingressos/eventos": "/ingressos",
};

export function correspondeRota(path: string, prefixo: string): boolean {
  return path === prefixo || path.startsWith(prefixo + "/");
}

/** href do item do menu que deve aparecer ativo para `path`. */
export function itemAtivoDoMenu(path: string): string {
  for (const [prefixo, secao] of Object.entries(SECAO_DO_MENU)) {
    if (correspondeRota(path, prefixo)) return secao;
  }
  return path;
}

/**
 * Entre os itens do menu que casam com o caminho, o mais específico: em
 * /prestacoes/fornecedores, "Fornecedores" fica ativo e "Prestações" não.
 */
export function hrefAtivoDoMenu(path: string, hrefs: readonly string[]): string | null {
  return hrefs.filter(href => correspondeRota(path, href)).sort((a, b) => b.length - a.length)[0] ?? null;
}

export function tituloDaPagina(path: string): string {
  const encontrado = TITULOS
    .filter(([prefixo]) => correspondeRota(path, prefixo))
    .sort((a, b) => b[0].length - a[0].length)[0];
  // Mesmo formato das páginas públicas ("Entrar — Jards", "Publicações — Jards").
  return encontrado ? `${encontrado[1]} — Jards` : "Jards";
}
