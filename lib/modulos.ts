// Módulos do Jards (captação, prestação de contas, produção e ticketeria) e quem pode usar cada um.
//
// Regra: a pessoa usa um módulo quando a organização o tem ativo
// (organizations.modulos_ativos) e o vínculo dela com a organização dá acesso
// a ele (organization_members.modulos_acesso). Super admin usa todos.
// Sem valor nas colunas vale só a captação, como sempre foi.

export type ModuloId = "captacao" | "prestacao" | "producao" | "ticketeria";

export const MODULOS: readonly ModuloId[] = ["captacao", "prestacao", "producao", "ticketeria"];

/**
 * Módulos ainda em construção: só aparecem (no seletor, nos convites) para a
 * organização que já os tem, como os pilotos liberados por cortesia. O banco
 * já aceita a produção (PD0.1, aplicada em 15/10/2026) e a página /producoes
 * existe (PD0.3), mas o módulo ainda não tem funcionalidade: a produção só sai
 * desta lista quando o plano do módulo de produção mandar.
 *
 * A ticketeria (venda de ingressos, T0 do plano em
 * docs/acoes-futuras/estudos/plano-modulo-ticketeria.md) entra escondida: o
 * módulo está registrado, o banco o aceita e a página /ingressos existe
 * (jards.com.br/ticketeria é a página pública do produto, por isso a rota do
 * app tem outro nome), mas só o super admin e quem já o tem o veem.
 */
export const MODULOS_EM_CONSTRUCAO: readonly ModuloId[] = ["producao", "ticketeria"];

/** Página inicial de cada módulo, para onde vai quem entra nele. */
export const INICIO_DO_MODULO: Record<ModuloId, string> = {
  captacao: "/dashboard",
  prestacao: "/prestacoes",
  producao: "/producoes",
  ticketeria: "/ingressos",
};

/**
 * Módulo em construção aparece só para a organização que já o tem e, no
 * seletor, para o super admin, que testa o módulo antes de ele abrir para os
 * clientes (o banco já deixa o super admin usar qualquer módulo).
 */
export function moduloVisivel(modulo: ModuloId, modulosOrganizacao: readonly ModuloId[], superAdmin = false): boolean {
  return superAdmin || !MODULOS_EM_CONSTRUCAO.includes(modulo) || modulosOrganizacao.includes(modulo);
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
  ticketeria: ["/ingressos"],
};

function casaPrefixo(path: string, prefixo: string): boolean {
  return path === prefixo || path.startsWith(`${prefixo}/`);
}

/** Módulo dono da rota; o que não é de outro módulo é da captação. */
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

/** O vínculo de uma pessoa com uma organização, do ponto de vista dos módulos. */
export type VinculoModulos = { modulosOrganizacao: readonly ModuloId[]; modulosMembro: readonly ModuloId[] };

/** Para o bloqueio no servidor, que não sabe qual organização está aberta no navegador. */
/**
 * Página inicial do primeiro módulo que a pessoa usa, deixando de fora `exceto`.
 * É o destino de "Sair da Ticketeria", que não tem seletor de módulo; sem outro
 * módulo, a página inicial da captação.
 */
export function inicioDeOutroModulo(acesso: AcessoModulos, exceto: ModuloId): string {
  const outro = modulosDisponiveis(acesso).find(modulo => modulo !== exceto);
  return INICIO_DO_MODULO[outro ?? "captacao"];
}

export function usaModuloEmAlgumaOrganizacao(
  superAdmin: boolean,
  vinculos: readonly VinculoModulos[],
  modulo: ModuloId,
): boolean {
  if (superAdmin) return true;
  return vinculos.some(v => podeUsarModulo({ superAdmin: false, ...v }, modulo));
}

/**
 * Para onde vai quem abre o app (raiz, login, /dashboard): a página da captação,
 * a menos que a pessoa não a use em nenhuma organização; então vai à página
 * inicial do primeiro módulo que usa (quem só tem a produção entra em
 * /producoes sem passar pela captação). O servidor não sabe qual organização
 * está aberta no navegador, por isso olha todas (usaModuloEmAlgumaOrganizacao).
 * Sem nenhum módulo em uso fica a da captação: quem decide o resto é o layout de
 * cliente (destinoSemAcesso), que conhece a organização aberta.
 */
export function paginaDeEntrada(superAdmin: boolean, vinculos: readonly VinculoModulos[]): string {
  const modulo = MODULOS.find(m => usaModuloEmAlgumaOrganizacao(superAdmin, vinculos, m));
  return INICIO_DO_MODULO[modulo ?? "captacao"];
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
