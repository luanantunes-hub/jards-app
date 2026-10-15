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

/** Página inicial do primeiro módulo que a pessoa usa na organização; sem nenhum, as configurações. */
export function inicioNaOrganizacao(acesso: AcessoModulos): string {
  const modulo = modulosDisponiveis(acesso)[0];
  return modulo ? INICIO_DO_MODULO[modulo] : "/configuracoes";
}

/** O vínculo da pessoa com uma organização, como o servidor o lê. */
export type VinculoModulos = { modulosOrganizacao: readonly ModuloId[]; modulosMembro: readonly ModuloId[] };

/** Para o bloqueio no servidor, que não sabe qual organização está aberta no navegador. */
export function usaModuloEmAlgumaOrganizacao(
  superAdmin: boolean,
  vinculos: readonly VinculoModulos[],
  modulo: ModuloId,
): boolean {
  if (superAdmin) return true;
  return vinculos.some(v => podeUsarModulo({ superAdmin: false, ...v }, modulo));
}

/**
 * Página inicial do primeiro módulo que a pessoa usa em alguma organização,
 * na ordem de MODULOS; sem nenhum, as configurações (que não têm bloqueio).
 */
export function inicioEmAlgumaOrganizacao(superAdmin: boolean, vinculos: readonly VinculoModulos[]): string {
  const modulo = MODULOS.find(m => usaModuloEmAlgumaOrganizacao(superAdmin, vinculos, m));
  return modulo ? INICIO_DO_MODULO[modulo] : "/configuracoes";
}

type ModulosDaLinha = { modulos_ativos?: unknown; modulos_leitura?: unknown };

/** Linha de organization_members com os módulos da organização embutidos. */
export type LinhaVinculo = {
  papel?: unknown;
  modulos_acesso?: unknown;
  /** O PostgREST devolve um objeto; sem o tipo Database, o supabase-js o declara como lista. */
  organizations?: ModulosDaLinha | readonly ModulosDaLinha[] | null;
};

/** Lê a linha com as mesmas regras do navegador, para servidor e navegador decidirem igual. */
export function vinculoDaLinha(linha: LinhaVinculo): VinculoModulos {
  const org = Array.isArray(linha.organizations) ? linha.organizations[0] : linha.organizations;
  return {
    modulosMembro: normalizarModulos(linha.modulos_acesso),
    modulosOrganizacao: modulosDaOrganizacao(org?.modulos_ativos, org?.modulos_leitura),
  };
}

/** O que o servidor sabe dos vínculos da pessoa. */
export type VinculosLidos = {
  superAdmin: boolean;
  vinculos: readonly VinculoModulos[];
  /** Algum vínculo é de captador: o navegador o leva ao workspace dele. */
  captador: boolean;
  /** A leitura falhou. Os vínculos vêm vazios. */
  erro: boolean;
};

/**
 * Bloqueio de um módulo no servidor: null deixa entrar; senão, a página
 * inicial do módulo que a pessoa usa. Com a leitura falhando, os vínculos vêm
 * vazios e o destino são as configurações, nunca o /dashboard: a entrada abre
 * na falha e o navegador mandaria de volta, num laço.
 */
export function destinoDoBloqueio(modulo: ModuloId, lidos: VinculosLidos): string | null {
  if (usaModuloEmAlgumaOrganizacao(lidos.superAdmin, lidos.vinculos, modulo)) return null;
  return inicioEmAlgumaOrganizacao(lidos.superAdmin, lidos.vinculos);
}

/**
 * Entrada no app (o /dashboard): quem não usa a captação em nenhuma
 * organização vai direto para a página do módulo dele. Na dúvida (erro,
 * super admin, captador, nenhum vínculo) deixa abrir: o layout do navegador
 * decide, como sempre fez.
 */
export function destinoDaEntrada(lidos: VinculosLidos): string | null {
  if (lidos.erro || lidos.superAdmin || lidos.captador || lidos.vinculos.length === 0) return null;
  return destinoDoBloqueio("captacao", lidos);
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
  // Sem nenhum módulo: as configurações continuam abertas para pedir acesso.
  return inicioNaOrganizacao(acesso);
}

export type SituacaoNoSeletor =
  | { tipo: "livre" }
  /** Os módulos da organização ainda não chegaram: nada é bloqueado nem oferecido. */
  | { tipo: "carregando" }
  /** A organização nunca teve o módulo: a escolha abre o convite do teste grátis. */
  | { tipo: "teste" }
  | { tipo: "bloqueado"; motivo: string };

/**
 * Como o módulo aparece no seletor. A prestação nunca aparece como não
 * contratada: toda organização tem direito ao teste grátis, e quem já teve o
 * módulo (em vigor ou só para leitura, depois do teste) entra nele, onde o
 * aviso da assinatura explica o que mudou.
 */
export function situacaoNoSeletor(acesso: AcessoModulos & { carregado: boolean }, modulo: ModuloId): SituacaoNoSeletor {
  if (acesso.superAdmin) return { tipo: "livre" };
  if (!acesso.carregado) return { tipo: "carregando" };
  if (!acesso.modulosOrganizacao.includes(modulo)) {
    return modulo === "prestacao" ? { tipo: "teste" } : { tipo: "bloqueado", motivo: "Módulo não contratado: fale com o suporte" };
  }
  if (!acesso.modulosMembro.includes(modulo)) {
    return { tipo: "bloqueado", motivo: "Você não tem acesso: peça a quem administra a organização" };
  }
  return { tipo: "livre" };
}

/** O seletor só faz sentido para quem usa mais de um módulo. */
export function mostraSeletorDeModulo(acesso: AcessoModulos): boolean {
  return modulosDisponiveis(acesso).length > 1;
}
