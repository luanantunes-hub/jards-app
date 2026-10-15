// Como a pessoa usa os módulos em todas as organizações dela, lido do banco, para
// as decisões que o servidor toma sem saber qual organização está aberta no
// navegador: o bloqueio de cada módulo nos layouts de servidor e a página de
// entrada (paginaDeEntrada, em lib/modulos.ts).
//
// Recebe o cliente de quem chama (servidor, proxy ou navegador), então não
// importa nada de next/headers e roda em qualquer lugar. É só leitura e não
// decide segurança: o isolamento entre organizações e entre módulos continua
// nas regras do banco.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  INICIO_DO_MODULO,
  modulosDaOrganizacao,
  normalizarModulos,
  paginaDeEntrada,
  usaModuloEmAlgumaOrganizacao,
  type ModuloId,
  type VinculoModulos,
} from "@/lib/modulos";

export type AcessoAosModulos = {
  superAdmin: boolean;
  vinculos: VinculoModulos[];
  /**
   * Alguma consulta falhou. O que veio vale para o bloqueio de um módulo, que
   * sempre foi assim (sem leitura, não libera), mas nunca para tirar alguém da
   * página de entrada: sem certeza, a pessoa fica onde está.
   */
  incompleto: boolean;
};

type Organizacao = { modulos_ativos: unknown; modulos_leitura: unknown };
type Vinculo = { modulos_acesso: unknown; organizations: Organizacao | Organizacao[] | null };

/** A organização do vínculo: o PostgREST devolve um objeto (relação para um), e a tipagem solta a vê como lista. */
function organizacaoDe(vinculo: Vinculo): Organizacao | null {
  const organizacao = vinculo.organizations;
  return (Array.isArray(organizacao) ? organizacao[0] : organizacao) ?? null;
}

const SEM_LEITURA: AcessoAosModulos = { superAdmin: false, vinculos: [], incompleto: true };

async function consultar(
  supabase: SupabaseClient<any>, // eslint-disable-line @typescript-eslint/no-explicit-any
  userId: string,
): Promise<AcessoAosModulos> {
  try {
    const [perfil, membros] = await Promise.all([
      supabase.from("profiles").select("jards_super_admin").eq("id", userId).maybeSingle(),
      supabase
        .from("organization_members")
        .select("modulos_acesso, organizations(modulos_ativos, modulos_leitura)")
        .eq("user_id", userId),
    ]);
    const vinculos = membros.error
      ? []
      : ((membros.data ?? []) as unknown as Vinculo[]).map(v => ({
          modulosMembro: normalizarModulos(v.modulos_acesso),
          modulosOrganizacao: modulosDaOrganizacao(organizacaoDe(v)?.modulos_ativos, organizacaoDe(v)?.modulos_leitura),
        }));
    return {
      superAdmin: !perfil.error && (perfil.data as { jards_super_admin?: boolean } | null)?.jards_super_admin === true,
      vinculos,
      incompleto: Boolean(perfil.error || membros.error),
    };
  } catch {
    return { ...SEM_LEITURA };
  }
}

/**
 * Lê se a pessoa é super admin e os módulos de cada vínculo dela. Coluna nula,
 * vazia ou ausente vale só a captação, como sempre foi (normalizarModulos).
 * Nunca lança: falha vira `incompleto`. Com `limiteMs`, a consulta que passa do
 * prazo também vira `incompleto` (o proxy não espera mais que isso por uma
 * leitura que só decide para onde ir).
 */
export async function lerAcessoAosModulos(
  supabase: SupabaseClient<any>, // eslint-disable-line @typescript-eslint/no-explicit-any
  userId: string,
  opcoes: { limiteMs?: number } = {},
): Promise<AcessoAosModulos> {
  const leitura = consultar(supabase, userId);
  if (!opcoes.limiteMs) return leitura;
  let relogio: ReturnType<typeof setTimeout> | undefined;
  const prazo = new Promise<AcessoAosModulos>(resolve => {
    relogio = setTimeout(() => resolve({ ...SEM_LEITURA }), opcoes.limiteMs);
  });
  try {
    return await Promise.race([leitura, prazo]);
  } finally {
    clearTimeout(relogio);
  }
}

/**
 * Página de entrada da pessoa (paginaDeEntrada). Sem leitura completa, a da
 * captação, que é a de sempre: ninguém sai dela por uma consulta que falhou.
 */
export function entradaDoAcesso(acesso: AcessoAosModulos): string {
  return acesso.incompleto ? INICIO_DO_MODULO.captacao : paginaDeEntrada(acesso.superAdmin, acesso.vinculos);
}

/**
 * Para onde o servidor manda quem abre as telas de um módulo sem usá-lo em
 * nenhuma organização; null quando pode entrar. Quem não pode vai para a página
 * de entrada dela, nunca para uma que também a barre.
 */
export function destinoDeQuemNaoUsa(modulo: ModuloId, acesso: AcessoAosModulos): string | null {
  if (usaModuloEmAlgumaOrganizacao(acesso.superAdmin, acesso.vinculos, modulo)) return null;
  return entradaDoAcesso(acesso);
}
