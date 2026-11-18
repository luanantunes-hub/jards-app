// Perfis de e2e por módulo (PD0.3): quem usa só a captação, só a prestação, só a
// produção, ou a captação e a produção. Cada perfil é um usuário semeado no
// ambiente de teste do banco (nunca na produção), com o módulo liberado por
// cortesia à organização dele; o login vem de variáveis de ambiente, no
// .env.local:
//
//   E2E_PERFIL_SO_CAPTACAO_EMAIL / E2E_PERFIL_SO_CAPTACAO_PASSWORD
//   E2E_PERFIL_SO_PRESTACAO_EMAIL / E2E_PERFIL_SO_PRESTACAO_PASSWORD
//   E2E_PERFIL_SO_PRODUCAO_EMAIL / E2E_PERFIL_SO_PRODUCAO_PASSWORD
//   E2E_PERFIL_CAPTACAO_PRODUCAO_EMAIL / E2E_PERFIL_CAPTACAO_PRODUCAO_PASSWORD
//
// Perfil sem as duas variáveis é pulado, sem falha: quem roda só os specs de
// sempre não precisa de nada disto. A sessão de cada perfil é salva por
// e2e/perfis.setup.ts em playwright/.auth/ (o .gitignore já a ignora).
//
// Este arquivo só importa lib/modulos (TypeScript puro), então os testes de
// unidade o usam para conferir que o que o e2e espera é o que o app decide.

import { INICIO_DO_MODULO, MODULOS, moduloDaRota, type ModuloId } from "../lib/modulos";

export type Perfil = {
  id: string;
  rotulo: string;
  /** Os módulos que a pessoa usa na organização dela. */
  modulos: readonly ModuloId[];
  emailVar: string;
  senhaVar: string;
  /** Onde a sessão do perfil fica salva depois do login. */
  arquivo: string;
};

function perfil(id: string, rotulo: string, modulos: readonly ModuloId[]): Perfil {
  const variavel = id.toUpperCase().replace(/-/g, "_");
  return {
    id,
    rotulo,
    modulos,
    emailVar: `E2E_PERFIL_${variavel}_EMAIL`,
    senhaVar: `E2E_PERFIL_${variavel}_PASSWORD`,
    arquivo: `playwright/.auth/perfil-${id}.json`,
  };
}

export const PERFIS: readonly Perfil[] = [
  perfil("so-captacao", "só captação", ["captacao"]),
  perfil("so-prestacao", "só prestação", ["prestacao"]),
  perfil("so-producao", "só produção", ["producao"]),
  perfil("captacao-producao", "captação e produção", ["captacao", "producao"]),
];

export function perfilConfigurado(p: Perfil): boolean {
  return Boolean(process.env[p.emailVar] && process.env[p.senhaVar]);
}

export function usa(p: Perfil, modulo: ModuloId): boolean {
  return p.modulos.includes(modulo);
}

/** A página inicial do primeiro módulo (na ordem de MODULOS) que a pessoa usa: para onde ela vai ao entrar. */
export function inicioDo(p: Perfil): string {
  return INICIO_DO_MODULO[MODULOS.find(m => usa(p, m)) ?? "captacao"];
}

/** Rotas que não são de módulo nenhum: abrem para todos. */
const ROTAS_COMUNS = ["/configuracoes", "/meu-plano", "/notificacoes"];

function ehComum(rota: string): boolean {
  return ROTAS_COMUNS.some(r => rota === r || rota.startsWith(`${r}/`));
}

/** Onde a pessoa para ao abrir `rota` pela URL: nela mesma se pode usá-la, senão na página inicial dela. */
export function destinoAoAbrir(p: Perfil, rota: string): string {
  return ehComum(rota) || usa(p, moduloDaRota(rota)) ? rota : inicioDo(p);
}

/**
 * O módulo cujo menu aparece em `rota`: o da própria rota, ou, nas rotas comuns
 * (configurações, plano), o primeiro que a pessoa usa.
 */
export function moduloDoMenu(p: Perfil, rota: string): ModuloId {
  return ehComum(rota) ? (MODULOS.find(m => usa(p, m)) ?? "captacao") : moduloDaRota(rota);
}

/** Os itens do menu lateral de cada módulo (app/(dashboard)/layout.tsx, NAV_POR_MODULO). */
export const ITENS_DO_MENU: Record<ModuloId, readonly string[]> = {
  captacao: [
    "Visão geral", "Atividades", "Projetos", "Patrocinadores", "Comparativo", "Editais",
    "Empresas", "Negociações", "Inscrições", "Proponentes", "Captadores", "Contatos", "Clientes",
  ],
  prestacao: ["Prestações", "Fornecedores"],
  producao: ["Agenda"],
  ticketeria: ["Ingressos"],
};
