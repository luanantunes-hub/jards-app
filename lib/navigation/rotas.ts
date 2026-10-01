/**
 * Títulos de aba e seção ativa do menu lateral para as rotas pós-login.
 * Mantido puro (sem React) para ser testável.
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
  ["/contatos", "Contatos"],
  ["/contas-patrocinio", "Clientes"],
  ["/contratos", "Contrato"],
  ["/entregas", "Entrega"],
  ["/ativacoes", "Ativação"],
  ["/prestacoes", "Prestações"],
  ["/configuracoes/mcp", "Claude e ChatGPT (MCP)"],
  ["/configuracoes", "Configurações"],
  ["/meu-plano", "Meu plano"],
  ["/notificacoes", "Notificações"],
  ["/gerenciar-blog", "Blog"],
  ["/workspace-captador", "Meu workspace"],
  ["/workspace-proponente", "Meus projetos"],
];

/** Páginas sem item próprio no menu que pertencem a outra seção. */
const SECAO_DO_MENU: Record<string, string> = {
  "/contratos": "/contas-patrocinio",
  "/entregas": "/contas-patrocinio",
  "/ativacoes": "/contas-patrocinio",
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

export function tituloDaPagina(path: string): string {
  const encontrado = TITULOS
    .filter(([prefixo]) => correspondeRota(path, prefixo))
    .sort((a, b) => b[0].length - a[0].length)[0];
  return encontrado ? `${encontrado[1]} · Jards` : "Jards";
}
