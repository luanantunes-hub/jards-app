// Módulos do Jards (captação, prestação de contas e produção) e quem pode usar cada um.
//
// Regra: a pessoa usa um módulo quando a organização o tem ativo
// (organizations.modulos_ativos) e o vínculo dela com a organização dá acesso
// a ele (organization_members.modulos_acesso). Super admin usa todos.
// Sem valor nas colunas vale só a captação, como sempre foi.

export type ModuloId = "captacao" | "prestacao" | "producao";

export const MODULOS: readonly ModuloId[] = ["captacao", "prestacao", "producao"];

/**
 * Módulos ainda em construção: só aparecem (no seletor, nos convites) para a
 * organização que já os tem, como os pilotos liberados por cortesia. O banco
 * ainda não aceita a produção (plano do módulo de produção, PD0.1).
 */
export const MODULOS_EM_CONSTRUCAO: readonly ModuloId[] = ["producao"];

/** Página inicial de cada módulo, para onde vai quem entra nele. */
export const INICIO_DO_MODULO: Record<ModuloId, string> = {
  captacao: "/dashboard",
  prestacao: "/prestacoes",
  producao: "/producoes",
};

/** Módulo em construção aparece só para a organização que já o tem. */
export function moduloVisivel(modulo: ModuloId, modulosOrganizacao: readonly ModuloId[]): boolean {
  return !MODULOS_EM_CONSTRUCAO.includes(modulo) || modulosOrganizacao.includes(modulo);
}

const PADRAO: readonly ModuloId[] = ["captacao"];

/**
 * Lê a coluna do banco. Valores desconhecidos são ignorados; null, ausente ou
 * lista vazia viram o padrão. A lista vazia vira padrão até a migration da
 * P0.5 definir a coluna: assim ninguém perde a captação por um valor vazio
 * que já exista em produção.
 */
export function normalizarModulos(valor: unknown): ModuloId[] {
  if (!Array.isArray(valor)) return [...PADRAO];
  const modulos = MODULOS.filter(modulo => valor.includes(modulo));
  return modulos.length > 0 ? modulos : [...PADRAO];
}

/**
 * Módulos que a organização usa, em vigor ou só para leitura
 * (organizations.modulos_leitura, P5.6): sem assinatura a pessoa continua
 * abrindo as telas para consultar e exportar; o banco não deixa escrever.
 */
export function modulosDaOrganizacao(ativos: unknown, leitura: unknown): ModuloId[] {
  const emLeitura = Array.isArray(leitura) ? leitura : [];
  const emVigor = normalizarModulos(ativos);
  return MODULOS.filter(modulo => emVigor.includes(modulo) || emLeitura.includes(modulo));
}

const ROTAS_DO_MODULO: Record<ModuloId, readonly string[]> = {
  captacao: [],
  prestacao: ["/prestacoes"],
  producao: ["/producoes"],
};

function casaPrefixo(path: string, prefixo: string): boolean {
  return path === prefixo || path.startsWith(`${prefixo}/`);
}

/** Módulo dono da rota; o que não é da prestação nem da produção é da captação. */
export function moduloDaRota(path: string): ModuloId {
  for (const modulo of MODULOS) {
    if (ROTAS_DO_MODULO[modulo].some(prefixo => casaPrefixo(path, prefixo))) return modulo;
  }
  return "captacao";
}

export type AcessoModulos = {
  superAdmin: boolean;
  modulosOrganizacao: readonly ModuloId[];
  modulosMembro: readonly ModuloId[];
};

export function podeUsarModulo(acesso: AcessoModulos, modulo: ModuloId): boolean {
  if (acesso.superAdmin) return true;
  return acesso.modulosOrganizacao.includes(modulo) && acesso.modulosMembro.includes(modulo);
}

/** Módulos que a pessoa usa na organização atual, na ordem de MODULOS. */
export function modulosDisponiveis(acesso: AcessoModulos): ModuloId[] {
  return MODULOS.filter(modulo => podeUsarModulo(acesso, modulo));
}

/** Para o bloqueio no servidor, que não sabe qual organização está aberta no navegador. */
export function usaModuloEmAlgumaOrganizacao(
  superAdmin: boolean,
  vinculos: readonly { modulosOrganizacao: readonly ModuloId[]; modulosMembro: readonly ModuloId[] }[],
  modulo: ModuloId,
): boolean {
  if (superAdmin) return true;
  return vinculos.some(v => podeUsarModulo({ superAdmin: false, ...v }, modulo));
}

/** Rotas comuns que não pertencem a nenhum módulo. */
const ROTAS_COMUNS = ["/configuracoes", "/meu-plano", "/notificacoes"];

/**
 * Para onde mandar quem abriu uma rota de um módulo que não usa.
 * Devolve null quando a rota pode ser aberta.
 */
export function destinoSemAcesso(path: string, acesso: AcessoModulos): string | null {
  if (ROTAS_COMUNS.some(prefixo => casaPrefixo(path, prefixo))) return null;
  const modulo = moduloDaRota(path);
  if (podeUsarModulo(acesso, modulo)) return null;
  const outro = modulosDisponiveis(acesso)[0];
  // Sem nenhum módulo: as configurações continuam abertas para pedir acesso.
  return outro ? INICIO_DO_MODULO[outro] : "/configuracoes";
}

/** O seletor só faz sentido para quem usa mais de um módulo. */
export function mostraSeletorDeModulo(acesso: AcessoModulos): boolean {
  return modulosDisponiveis(acesso).length > 1;
}
